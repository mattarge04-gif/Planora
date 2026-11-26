import type pg from "pg";
import type { Ablage } from "../ablage/ablage.js";
import { inTx } from "../rechte/zugriff.js";
import { AuslesenFehler, MAX_ABSCHNITTE, MAX_PDF_SEITEN, liesTextBegrenzt, nameText, teileAbschnitte, type Teil } from "./auslesen.js";

/** Feste Texte in der DB; rohe Meldungen nur im Log. */
export const AUSLESEN_FEHLER_TEXT = "Text konnte nicht gelesen werden.";
export const ZU_LANGE_TEXT = "Text auslesen dauerte zu lange.";
export const ZU_VIEL_TEXT = "Dokument hat zu viel Text für die Suche.";
export const GEKUERZT_TEXT = `Nur die ersten ${MAX_PDF_SEITEN} Seiten sind durchsuchbar.`;
export interface Indexierer { starte(id: string): void; warteLeer(): Promise<void>; reiheNeuEin(): Promise<number> }
export const sucheAktiv = async (q: Pick<pg.Pool, "query">) => (await q.query("select aktiv from modul_schalter where modul_id='suche'")).rows[0]?.aktiv === true;

/** Hintergrundjob (Muster wie Pruefer/Laeufer): nach sauberem Scan und beim Start/Nachholtakt fuer text_status='offen'. */
export function erzeugeIndexierer(pool: pg.Pool, ablage: Ablage, o: { gleichzeitig?: number; istAktiv?: () => Promise<boolean> } = {}): Indexierer {
  const max = o.gleichzeitig ?? 1; // je Job ein Worker-Thread mit bis 512 MB
  const istAktiv = o.istAktiv ?? (() => sucheAktiv(pool));
  const warteschlange: string[] = [];
  const eingereiht = new Set<string>();
  let laufend = 0; let leer: (() => void)[] = [];

  async function liesAus(id: string) {
    const d = (await pool.query("select dateiname, schluessel, mime from dokument where id=$1 and scan_status='sauber' and text_status='offen'", [id])).rows[0];
    if (!d) return;
    let teile: Teil[] = []; let status: "fertig" | "ohne_text" | "fehler"; let grund: string | null = null;
    try {
      const stuecke: Buffer[] = [];
      for await (const s of ablage.lese(d.schluessel)) stuecke.push(s as Buffer);
      const r = await liesTextBegrenzt(Buffer.concat(stuecke), d.mime);
      teile = teileAbschnitte(r.teile); status = r.status;
      if (r.gekuerzt) grund = GEKUERZT_TEXT;
      if (teile.length > MAX_ABSCHNITTE) { teile = []; status = "fehler"; grund = ZU_VIEL_TEXT; }
    } catch (e) {
      if (!(e instanceof AuslesenFehler)) console.error(`suche: Auslesen abgebrochen: ${e instanceof Error ? e.message.slice(0, 200) : "unbekannt"}`);
      status = "fehler"; grund = e instanceof AuslesenFehler && e.message === "zeit" ? ZU_LANGE_TEXT : AUSLESEN_FEHLER_TEXT;
    }
    const alle: Teil[] = [{ ortArt: "name", ort: 0, text: nameText(d.dateiname) }, ...teile];
    await inTx(pool, "begin", async (c) => {
      // Zeilensperre ueber das Update: parallel geloescht oder schon ausgelesen -> nichts schreiben
      const r = await c.query("update dokument set text_status=$2, text_grund=$3 where id=$1 and text_status='offen' returning id", [id, status, grund]);
      if (!r.rowCount) return;
      await c.query("delete from dokument_abschnitt where dokument_id=$1", [id]);
      await c.query(`insert into dokument_abschnitt(dokument_id, nr, ort_art, ort, text)
        select $1, x.n - 1, x.a, x.o, x.t from unnest($2::text[], $3::int[], $4::text[]) with ordinality as x(a, o, t, n)`,
        [id, alle.map((x) => x.ortArt), alle.map((x) => x.ort), alle.map((x) => x.text)]);
    });
  }
  async function arbeite(id: string) {
    if (!(await istAktiv())) return; // Modul aus: bleibt offen, Nachholtakt holt es nach
    await liesAus(id);
  }

  function verfolge(id: string) {
    laufend++;
    void arbeite(id).catch(async (e) => {
      console.error(`suche: Indexierung abgebrochen: ${e instanceof Error ? e.message.slice(0, 200) : "unbekannt"}`);
      await pool.query("update dokument set text_status='fehler', text_grund=$2 where id=$1 and text_status='offen'", [id, AUSLESEN_FEHLER_TEXT]).catch(() => {});
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
      if (!(await istAktiv())) return 0;
      const r = await pool.query("select id from dokument where scan_status='sauber' and text_status='offen' order by hochgeladen_am, id");
      for (const x of r.rows) starte(x.id);
      return r.rowCount ?? 0;
    },
  };
}
