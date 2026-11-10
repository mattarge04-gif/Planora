import type pg from "pg";
import type { Ziel } from "../backup/ziel.js";
import type { Verschluesseln } from "./age.js";
export type JournalEintrag = { instanzId: string; seq: string; art: string; ziel: string; zeit: string };
export type JournalStand = { instanzId: string; letzteQuittierteSeq: string; zeit: string };
export type OutboxOptionen = { pool: pg.Pool; ziel: Ziel; verschluesseln: Verschluesseln; alarm: (text: string) => void };
const LOCK=7_310_003;
export async function sendeJournal(o: OutboxOptionen) {
  const c=await o.pool.connect(); let gesperrt=false;
  try {
    gesperrt=(await c.query("select pg_try_advisory_lock($1) ok",[LOCK])).rows[0].ok;
    if (!gesperrt) return;
    const instanzId=(await c.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0].wert as string;
    const offen=await c.query("select seq::text,art,ziel,zeit,zeit < clock_timestamp()-interval '15 minutes' alt from loesch_journal where zustand='offen' order by seq");
    let versandFehler:unknown;
    try { for (const r of offen.rows) {
      if (r.alt) o.alarm(`Journal-Sicherung seit ueber 15 Minuten offen (seq ${r.seq})`);
      const eintrag: JournalEintrag={instanzId,seq:r.seq,art:r.art,ziel:r.ziel,zeit:r.zeit.toISOString()};
      const neu=await o.verschluesseln(Buffer.from(JSON.stringify(eintrag)));
      const verschluesselt=(await c.query("select journal_vorbereiten($1,$2) inhalt",[r.seq,neu])).rows[0].inhalt as Buffer;
      const gespeichert=await o.ziel.schreibe(`journal/${instanzId}/${r.seq}.age`,verschluesselt,true);
      if (!gespeichert.equals(verschluesselt)) throw new Error("Journal-Objektkonflikt; keine Quittung");
      await c.query("select journal_quittiere($1)",[r.seq]);
    } } catch(e) { versandFehler=e; }
    const stand=(await c.query("select coalesce(max(seq),0)::text seq,clock_timestamp() zeit from loesch_journal where zustand='quittiert'")).rows[0];
    const daten: JournalStand={instanzId,letzteQuittierteSeq:stand.seq,zeit:stand.zeit.toISOString()};
    try {
      await o.ziel.schreibe(`journal/${instanzId}/stand.age`,await o.verschluesseln(Buffer.from(JSON.stringify(daten))),false);
    } catch(e) {
      o.alarm("Journal-Stand konnte nicht aktualisiert werden");
      throw versandFehler??e;
    }
    if(versandFehler)throw versandFehler;
    return daten;
  } finally {
    try { if (gesperrt) await c.query("select pg_advisory_unlock($1)",[LOCK]); } finally { c.release(); }
  }
}
/** Host-Timer kann alternativ einmal pro Minute `journal --einmal` starten. */
export async function journalDienst(o: OutboxOptionen, signal: AbortSignal, intervallMs=60_000) {
  while (!signal.aborted) {
    try { await sendeJournal(o); } catch { o.alarm("Journal-Ziel nicht quittiert; Wiederholung folgt"); }
    if (signal.aborted) break;
    await new Promise<void>((resolve) => {
      const fertig=() => { clearTimeout(timer); signal.removeEventListener("abort",fertig); resolve(); };
      const timer=setTimeout(fertig,intervallMs); signal.addEventListener("abort",fertig,{once:true});
    });
  }
}
