import type pg from "pg";
export type Status = "neu" | "liest" | "fertig" | "fehler" | "abgebrochen" | "aus";
export interface DokumentZeile { id: string; dateiname: string; groesse: number; seiten: number; hochgeladenAm: string; status: Status; fehler: string | null; vorschlaege: VorschlagZeile[] }
export interface VorschlagZeile { id: string; position: string; seite: number; zitat: string; materialNetto: number | null; rabattText: string | null;
  montageAnteil: number | null; ersatzpreis: number; rechenweg: string; katalogId: string | null; bauteilIds: string[]; fehlendeBauteile: string[];
  sicherheit: "hoch" | "mittel" | "tief"; status: "offen" | "uebernommen" | "verworfen"; alsTyppreis: boolean }
const zahl = (v: string | null) => (v === null ? null : Number(v));

export async function legeDokumentAn(c: pg.ClientBase, a: { gebaeudeId: string; liegenschaftId: string; dateiname: string; schluessel: string; sha256: string; groesse: number; seiten: number; von: string; status: Status }) {
  const r = await c.query(
    `insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (gebaeude_id, sha256) do nothing returning id`,
    [a.gebaeudeId, a.liegenschaftId, a.dateiname, a.schluessel, a.sha256, a.groesse, a.seiten, a.von, a.status]);
  if (r.rows[0]) return { id: r.rows[0].id as string, neu: true };
  const alt = await c.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [a.gebaeudeId, a.sha256]);
  return { id: alt.rows[0].id as string, neu: false };
}

export async function ladeDokumente(c: pg.ClientBase, gebaeudeId: string): Promise<DokumentZeile[]> {
  const d = (await c.query(`select id, dateiname, groesse, seiten, hochgeladen_am, auslesen_status, auslesen_fehler from dokument where gebaeude_id=$1 order by hochgeladen_am, id`, [gebaeudeId])).rows;
  const ids = d.map((r) => r.id);
  const vorhandene = new Set((await c.query("select id from bauteil where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => r.id as string));
  const v = ids.length ? (await c.query(`select * from preis_vorschlag where dokument_id = any($1) order by dokument_id, reihenfolge`, [ids])).rows : [];
  return d.map((r) => ({
    id: r.id, dateiname: r.dateiname, groesse: Number(r.groesse), seiten: r.seiten, hochgeladenAm: r.hochgeladen_am.toISOString(),
    status: r.auslesen_status, fehler: r.auslesen_fehler,
    vorschlaege: v.filter((x) => x.dokument_id === r.id).map((x) => ({
      id: x.id, position: x.position, seite: x.seite, zitat: x.zitat, materialNetto: zahl(x.material_netto), rabattText: x.rabatt_text,
      montageAnteil: zahl(x.montage_anteil), ersatzpreis: Number(x.ersatzpreis), rechenweg: x.rechenweg, katalogId: x.katalog_id,
      bauteilIds: (x.bauteil_ids as string[]).filter((b) => vorhandene.has(b)), fehlendeBauteile: (x.bauteil_ids as string[]).filter((b) => !vorhandene.has(b)),
      sicherheit: x.sicherheit, status: x.status, alsTyppreis: x.als_typpreis,
    })),
  }));
}

/** Gibt die Referenz frei; ohne weitere Referenz kommt der Schluessel ins Loesch-Journal (GC raeumt auf). */
export async function gibReferenzFrei(c: pg.ClientBase, schluessel: string, objekt: string) {
  await c.query("delete from datei_referenz where schluessel=$1 and objekt=$2", [schluessel, objekt]);
  const rest = await c.query("select 1 from datei_referenz where schluessel=$1", [schluessel]);
  if (!rest.rowCount) await c.query("select journal_eintrag('datei.loeschen', $1)", [schluessel]);
}

export async function loescheDokument(c: pg.ClientBase, dokumentId: string) {
  const r = (await c.query("delete from dokument where id=$1 returning schluessel", [dokumentId])).rows[0];
  if (!r) return false;
  await gibReferenzFrei(c, r.schluessel, `dokument:${dokumentId}`);
  return true;
}
