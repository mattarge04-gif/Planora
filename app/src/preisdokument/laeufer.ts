import type pg from "pg";
import type { Ablage } from "../ablage/ablage.js";
import { LeseFehler, kostenUsd, type LeseAdapter, type LeseKontext, type LeseVerbrauch } from "./adapter.js";
import { pruefeVorschlaege } from "./pruefung.js";
import { KATALOG_V2 } from "../welt/katalog.v2.js";

export interface Laeufer {
  starte(dokumentId: string): void;
  warteLeer(): Promise<void>;
  zustand(): { auslesen: "an" | "kein_schluessel"; verbrauchtUsd: () => Promise<number>; limitUsd: number };
}

// In der DB landen nur diese festen Texte, nie rohe Adapter-Meldungen.
const TEXT: Record<LeseFehler["grund"] | "budget" | "intern", string> = {
  ablehnung: "Das Modell hat das Dokument abgelehnt.", schema: "Antwort hatte ein unerwartetes Format.",
  abgeschnitten: "Antwort war unvollständig.", api: "Der Lesedienst ist nicht erreichbar. Bitte später erneut lesen.",
  budget: "Monatsbudget erreicht.", intern: "Interner Fehler beim Lesen.",
};

export async function ladeKontext(c: Pick<pg.ClientBase, "query">, gebaeudeId: string): Promise<LeseKontext> {
  const namen = new Map(KATALOG_V2.eintraege.map((e) => [e.id, e.name]));
  const rows = (await c.query(
    `select b.id, b.katalog_id, b.menge, b.hersteller, b.typ, coalesce(gs.code, ge.code) geschoss, e.bezeichnung einheit
       from bauteil b left join einheit e on e.id=b.einheit_id left join geschoss ge on ge.id=e.geschoss_id left join geschoss gs on gs.id=b.geschoss_id
      where b.gebaeude_id=$1 order by b.reihenfolge`, [gebaeudeId])).rows;
  const bauteile = rows.map((r) => ({ id: r.id as string, katalogId: r.katalog_id as string, name: namen.get(r.katalog_id) ?? (r.katalog_id as string),
    ort: r.einheit ? `${r.geschoss} · ${r.einheit}` : (r.geschoss as string), hersteller: r.hersteller as string | null, typ: r.typ as string | null, menge: r.menge as number | null }));
  const ids = new Set(bauteile.map((b) => b.katalogId));
  return { bauteile, katalog: KATALOG_V2.eintraege.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, name: e.name })) };
}

/**
 * Beim Serverstart: unterbrochene ('liest') und wartende ('neu') Lesevorgaenge als abgebrochen markieren.
 * Die Warteschlange lebt nur im Speicher; 'neu' wuerde sonst ewig als laufend gelten. Bewusst kein
 * automatisches Neu-Einreihen: kein unbemerkter KI-Aufruf nach einem Update, das FM liest per "Erneut lesen".
 */
export async function markiereAbgebrochen(pool: pg.Pool): Promise<number> {
  return (await pool.query("update dokument set auslesen_status='abgebrochen' where auslesen_status in ('neu','liest')")).rowCount ?? 0;
}

/** Modulschalter "preisdokument" direkt aus der DB (Lieferstufe prueft bereits der Routen-Guard beim Einreihen). */
export async function preisdokumentAktiv(pool: pg.Pool): Promise<boolean> {
  return (await pool.query("select aktiv from modul_schalter where modul_id='preisdokument'")).rows[0]?.aktiv === true;
}

export function erzeugeLaeufer(pool: pg.Pool, ablage: Ablage, adapter: LeseAdapter | null,
  o: { gleichzeitig?: number; limitUsd?: number; preise?: { ein: number; aus: number }; istAktiv?: () => Promise<boolean> } = {}): Laeufer {
  const max = o.gleichzeitig ?? 2, limitUsd = o.limitUsd ?? 20, preise = o.preise ?? { ein: 2.0, aus: 10.0 };
  const istAktiv = o.istAktiv ?? (() => preisdokumentAktiv(pool));
  const warteschlange: string[] = []; let laufend = 0; let leer: (() => void)[] = [];
  const verbrauchtUsd = async () => Number((await pool.query(
    "select coalesce(sum(kosten_usd),0) s from preis_lesung where am >= date_trunc('month', now())")).rows[0].s);
  // Ledger-Zeile sofort nach der Antwort, eigene Anweisung vor der Vorschlags-Transaktion:
  // so zaehlen auch verrechnete Antworten, die danach scheitern, zum Monatsbudget.
  const bucheVerbrauch = (id: string, v: LeseVerbrauch, kosten: number) =>
    pool.query("insert into preis_lesung(dokument_id, modell, tokens_ein, tokens_aus, kosten_usd) values ($1,$2,$3,$4,$5)", [id, v.modell, v.tokensEin, v.tokensAus, kosten]);
  async function lies(id: string) {
    const d = (await pool.query("update dokument set auslesen_status='liest', auslesen_fehler=null where id=$1 and scan_status='sauber' and auslesen_status in ('neu','abgebrochen','fehler') returning gebaeude_id, schluessel, dateiname, seiten", [id])).rows[0];
    if (!d) return;
    const fehler = (text: string, v?: LeseVerbrauch, kosten?: number) => v
      ? pool.query("update dokument set auslesen_status='fehler', auslesen_fehler=$2, modell=$3, tokens_ein=$4, tokens_aus=$5, kosten_usd=$6, gelesen_am=now() where id=$1",
        [id, text, v.modell, v.tokensEin, v.tokensAus, kosten])
      : pool.query("update dokument set auslesen_status='fehler', auslesen_fehler=$2 where id=$1", [id, text]);
    try {
      // ADR 0030 "KI aus -> 0 Anfragen": in der Warteschlange liegende Lesungen nach dem Abschalten nicht mehr senden.
      if (!(await istAktiv())) { await pool.query("update dokument set auslesen_status='aus' where id=$1", [id]); return; }
      if ((await verbrauchtUsd()) >= limitUsd) { await fehler(TEXT.budget); return; }
      const chunks: Buffer[] = []; for await (const ch of ablage.lese(d.schluessel)) chunks.push(ch as Buffer);
      const kontext = await ladeKontext(pool, d.gebaeude_id);
      let e;
      try { e = await adapter!.lies(Buffer.concat(chunks), d.dateiname, kontext); }
      catch (x) {
        if (x instanceof LeseFehler && x.verbrauch) {
          const kosten = kostenUsd(x.verbrauch.tokensEin, x.verbrauch.tokensAus, preise.ein, preise.aus);
          await bucheVerbrauch(id, x.verbrauch, kosten);
          console.error(`preisdokument: Lesefehler (${x.grund}): ${x.message}`); // Meldung bereits bereinigt
          await fehler(TEXT[x.grund], x.verbrauch, kosten);
          return;
        }
        throw x;
      }
      const kosten = kostenUsd(e.tokensEin, e.tokensAus, preise.ein, preise.aus);
      await bucheVerbrauch(id, e, kosten);
      let vorschlaege;
      try { vorschlaege = pruefeVorschlaege(e.roh, kontext, d.seiten); }
      catch { await fehler(TEXT.schema, e, kosten); return; }
      const c = await pool.connect();
      try {
        await c.query("begin");
        // Bereits uebernommene Vorschlaege bleiben (Neu lesen); neue Reihenfolge beginnt danach.
        const start = Number((await c.query("select coalesce(max(reihenfolge)+1,0) n from preis_vorschlag where dokument_id=$1", [id])).rows[0].n);
        for (const [i, v] of vorschlaege.entries()) await c.query(
          `insert into preis_vorschlag(dokument_id, reihenfolge, position, seite, zitat, material_netto, rabatt_text, montage_anteil, ersatzpreis, rechenweg, katalog_id, bauteil_ids, sicherheit)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [id, start + i, v.position, v.seite, v.zitat, v.materialNetto, v.rabattText, v.montageAnteil, v.ersatzpreis, v.rechenweg, v.katalogId, v.bauteilIds, v.sicherheit]);
        await c.query("update dokument set auslesen_status='fertig', modell=$2, tokens_ein=$3, tokens_aus=$4, kosten_usd=$5, gelesen_am=now() where id=$1",
          [id, e.modell, e.tokensEin, e.tokensAus, kosten]);
        await c.query("commit");
        c.release();
      } catch (x) {
        const rb = await c.query("rollback").then(() => undefined, (err) => err as Error);
        c.release(rb); throw x;
      }
    } catch (x) {
      if (x instanceof LeseFehler) console.error(`preisdokument: Lesefehler (${x.grund}): ${x.message}`); // Meldung bereits bereinigt
      await fehler(x instanceof LeseFehler ? TEXT[x.grund] : TEXT.intern).catch(() => {});
    }
  }
  // Jede Hintergrundarbeit zaehlt als laufend, damit warteLeer() auch sie abwartet (deterministische Tests, sauberes Schliessen).
  function verfolge(p: Promise<unknown>) {
    laufend++;
    void p.catch(() => {}).finally(() => { laufend--; weiter(); if (!laufend && !warteschlange.length) { leer.forEach((f) => f()); leer = []; } });
  }
  function weiter() {
    while (laufend < max && warteschlange.length) verfolge(lies(warteschlange.shift()!));
  }
  return {
    starte(id: string) {
      if (!adapter) { verfolge(pool.query("update dokument set auslesen_status='aus' where id=$1", [id])); return; }
      warteschlange.push(id); weiter();
    },
    warteLeer: () => (!laufend && !warteschlange.length ? Promise.resolve() : new Promise<void>((r) => leer.push(r))),
    zustand: () => ({ auslesen: adapter ? "an" as const : "kein_schluessel" as const, verbrauchtUsd, limitUsd }),
  };
}
