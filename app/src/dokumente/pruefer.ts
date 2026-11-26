import type pg from "pg";
import { Readable } from "node:stream";
import { speichereUndReferenziere, type Ablage } from "../ablage/ablage.js";
import { auditEreignis } from "../audit/audit.js";
import { inTx } from "../rechte/zugriff.js";
import type { VirenScanner } from "./scanner.js";
import { GrenzeFehler } from "./clamd.js";
import { gibReferenzFrei } from "./speicher.js";

/** Fester Text in der DB; rohe Scanner-Meldungen nur im Log. */
export const SCAN_FEHLER_TEXT = "Virenprüfung nicht erreichbar.";
export const DATEI_FEHLT_TEXT = "Datei fehlt, bitte neu ablegen.";
export const GRENZE_TEXT = "Datei zu gross oder zu verschachtelt für die Virenprüfung.";
export interface Pruefer { starte(id: string): void; warteLeer(): Promise<void>; reiheNeuEin(): Promise<number> }

/** Signaturname fuer DB und Anzeige: ohne Steuerzeichen, hoechstens 300 Zeichen. */
export const bereinigeSignatur = (s: string) => s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 300) || "Befund";

/** Loescht die Quarantaene-Kopie, wenn kein ungeprueftes oder abgelehntes Dokument sie noch braucht (best effort). */
export async function raeumeQuarantaeneKopie(pool: Pick<pg.Pool, "query">, quarantaene: Ablage, schluessel: string) {
  const noch = await pool.query("select 1 from dokument where schluessel=$1 and scan_status <> 'sauber' limit 1", [schluessel]);
  if (!noch.rowCount) await quarantaene.entferne(schluessel).catch(() => {});
}

/** Abgelehnte Dateien bleiben 7 Tage [A] ohne Vorschau und Download; danach Zeile und Kopie weg (Audit bleibt). */
export async function raeumeAbgelehnteAuf(pool: pg.Pool, quarantaene: Ablage, tage = 7): Promise<number> {
  const r = (await pool.query("delete from dokument where scan_status='abgelehnt' and gescannt_am < now() - make_interval(days => $1) returning schluessel", [tage])).rows;
  for (const { schluessel } of r) await raeumeQuarantaeneKopie(pool, quarantaene, schluessel);
  return r.length;
}

export function erzeugePruefer(pool: pg.Pool, ablage: Ablage, quarantaene: Ablage, scanner: VirenScanner, o: { gleichzeitig?: number } = {}): Pruefer {
  const max = o.gleichzeitig ?? 2;
  const warteschlange: string[] = [];
  const eingereiht = new Set<string>();
  let laufend = 0; let leer: (() => void)[] = [];
  const setzeFehler = (id: string, text = SCAN_FEHLER_TEXT) => pool.query(
    "update dokument set scan_status='scan_fehler', scan_grund=$2, gescannt_am=now() where id=$1 and scan_status='quarantaene'", [id, text]);

  async function pruefe(id: string) {
    const d = (await pool.query("select gebaeude_id, schluessel, sha256 from dokument where id=$1 and scan_status='quarantaene'", [id])).rows[0];
    if (!d) return;
    let daten: Buffer;
    try {
      const teile: Buffer[] = [];
      for await (const t of quarantaene.lese(d.schluessel)) teile.push(t as Buffer);
      daten = Buffer.concat(teile);
    } catch { await setzeFehler(id, DATEI_FEHLT_TEXT); return; }
    let erg;
    try { erg = await scanner.pruefe(daten); }
    catch (e) {
      console.error(`dokumente: Virenpruefung fehlgeschlagen: ${e instanceof Error ? e.message.slice(0, 200) : "unbekannt"}`);
      await setzeFehler(id, e instanceof GrenzeFehler ? GRENZE_TEXT : SCAN_FEHLER_TEXT); return;
    }
    if (erg.ergebnis === "befund") {
      const signatur = bereinigeSignatur(erg.signatur);
      await inTx(pool, "begin", async (c) => {
        const r = await c.query(`update dokument set scan_status='abgelehnt', scan_grund=$2, gescannt_am=now(), ort_geschoss_id=null, ort_einheit_id=null, allgemein=false
          where id=$1 and scan_status='quarantaene' returning id`, [id, signatur]);
        if (!r.rowCount) return;
        await c.query("delete from dokument_bauteil where dokument_id=$1", [id]);
        await auditEreignis(c, null, "dokument.abgelehnt", { dokumentId: id, gebaeudeId: d.gebaeude_id, signatur });
      });
      return;
    }
    const objekt = `dokument:${id}`;
    const gespeichert = await speichereUndReferenziere(pool, ablage, Readable.from(daten), objekt);
    let uebernommen = false;
    await inTx(pool, "begin", async (c) => {
      // Zeile sperren: parallel geloescht -> Referenz freigeben; schon sauber (zweiter Pruefer) -> Referenz gehoert dem Dokument.
      const s = (await c.query("select scan_status from dokument where id=$1 for update", [id])).rows[0]?.scan_status;
      if (s === "quarantaene" && gespeichert.sha256 === d.sha256) {
        await c.query("update dokument set scan_status='sauber', scan_grund=null, gescannt_am=now() where id=$1", [id]);
        uebernommen = true;
      } else if (s !== "sauber") await gibReferenzFrei(c, gespeichert.schluessel, objekt);
    });
    if (gespeichert.sha256 !== d.sha256) await setzeFehler(id);
    if (uebernommen) await raeumeQuarantaeneKopie(pool, quarantaene, d.schluessel);
  }

  function verfolge(id: string) {
    laufend++;
    void pruefe(id).catch(async (e) => {
      console.error(`dokumente: Pruefung abgebrochen: ${e instanceof Error ? e.message.slice(0, 200) : "unbekannt"}`);
      await setzeFehler(id).catch(() => {});
    }).finally(() => {
      laufend--; eingereiht.delete(id); weiter();
      if (!laufend && !warteschlange.length) { leer.forEach((f) => f()); leer = []; }
    });
  }
  function weiter() { while (laufend < max && warteschlange.length) verfolge(warteschlange.shift()!); }
  const starte = (id: string) => { if (eingereiht.has(id)) return; eingereiht.add(id); warteschlange.push(id); weiter(); };
  return {
    starte,
    warteLeer: () => (!laufend && !warteschlange.length ? Promise.resolve() : new Promise<void>((r) => leer.push(r))),
    async reiheNeuEin() {
      const r = await pool.query("select id from dokument where scan_status='quarantaene' order by hochgeladen_am, id");
      for (const x of r.rows) starte(x.id);
      return r.rowCount ?? 0;
    },
  };
}
