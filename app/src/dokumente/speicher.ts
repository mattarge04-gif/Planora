import type pg from "pg";
import { FachFehler } from "../welt/speicher.js";
import type { Art, Kategorie } from "./typ.js";
type Q = Pick<pg.ClientBase, "query">;

export type ScanStatus = "quarantaene" | "sauber" | "abgelehnt" | "scan_fehler";
export type AuslesenStatus = "neu" | "liest" | "fertig" | "fehler" | "abgebrochen" | "aus";
export interface AblageZeile { id: string; dateiname: string; art: Art; mime: string; kategorie: Kategorie; groesse: number; seiten: number | null;
  hochgeladenAm: string; scanStatus: ScanStatus; scanGrund: string | null; gescanntAm: string | null; bauteilIds: string[] }
export interface AblageBauteil { id: string; katalogId: string; geschoss: string; ort: string; hersteller: string | null; typ: string | null }

/** Ablage eines Gebaeudes, neueste zuerst; mit nurId genau ein Dokument. */
export async function ladeAblage(c: Q, gebaeudeId: string, nurId: string | null = null): Promise<AblageZeile[]> {
  const r = await c.query(
    `select d.id, d.dateiname, d.art, d.mime, d.kategorie, d.groesse, d.seiten, d.hochgeladen_am, d.scan_status, d.scan_grund, d.gescannt_am,
            coalesce(array_agg(v.bauteil_id::text order by v.bauteil_id) filter (where v.bauteil_id is not null), '{}') bauteil_ids
       from dokument d left join dokument_bauteil v on v.dokument_id = d.id
      where d.gebaeude_id = $1 and ($2::uuid is null or d.id = $2::uuid)
      group by d.id order by d.hochgeladen_am desc, d.id`, [gebaeudeId, nurId]);
  return r.rows.map((x) => ({ id: x.id, dateiname: x.dateiname, art: x.art, mime: x.mime, kategorie: x.kategorie, groesse: Number(x.groesse),
    seiten: x.seiten, hochgeladenAm: x.hochgeladen_am.toISOString(), scanStatus: x.scan_status, scanGrund: x.scan_grund,
    gescanntAm: x.gescannt_am ? x.gescannt_am.toISOString() : null, bauteilIds: x.bauteil_ids }));
}

/** Bauteile fuer die Verknuepfung (Filter Typ, Geschoss, Name im Web). */
export async function ladeAblageBauteile(c: Q, gebaeudeId: string): Promise<AblageBauteil[]> {
  const rows = (await c.query(
    `select b.id, b.katalog_id, b.hersteller, b.typ, coalesce(gs.code, ge.code) geschoss, e.bezeichnung einheit
       from bauteil b left join einheit e on e.id=b.einheit_id left join geschoss ge on ge.id=e.geschoss_id left join geschoss gs on gs.id=b.geschoss_id
      where b.gebaeude_id=$1 order by b.reihenfolge`, [gebaeudeId])).rows;
  return rows.map((r) => ({ id: r.id, katalogId: r.katalog_id, geschoss: r.geschoss, ort: r.einheit ? `${r.geschoss} · ${r.einheit}` : r.geschoss,
    hersteller: r.hersteller, typ: r.typ }));
}

/** Nur fuer Tests und Skripte; die Routen setzen alle Felder selbst. */
export async function legeDokumentAn(c: Q, a: { gebaeudeId: string; liegenschaftId: string; dateiname: string; schluessel: string; sha256: string; groesse: number;
  seiten: number | null; von: string; status: AuslesenStatus; art?: Art; mime?: string; kategorie?: Kategorie; scanStatus?: ScanStatus }) {
  const r = await c.query(
    `insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status, art, mime, kategorie, scan_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (gebaeude_id, sha256) do nothing returning id`,
    [a.gebaeudeId, a.liegenschaftId, a.dateiname, a.schluessel, a.sha256, a.groesse, a.seiten, a.von, a.status,
      a.art ?? "pdf", a.mime ?? "application/pdf", a.kategorie ?? "offerte", a.scanStatus ?? "sauber"]);
  if (r.rows[0]) return { id: r.rows[0].id as string, neu: true };
  const alt = await c.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [a.gebaeudeId, a.sha256]);
  return { id: alt.rows[0].id as string, neu: false };
}

/** Gibt die Referenz frei; ohne weitere Referenz kommt der Schluessel ins Loesch-Journal (GC raeumt auf). */
export async function gibReferenzFrei(c: Q, schluessel: string, objekt: string) {
  await c.query("delete from datei_referenz where schluessel=$1 and objekt=$2", [schluessel, objekt]);
  const rest = await c.query("select 1 from datei_referenz where schluessel=$1", [schluessel]);
  if (!rest.rowCount) await c.query("select journal_eintrag('datei.loeschen', $1)", [schluessel]);
}

/**
 * Loescht das Dokument (Verknuepfungen und Vorschlaege per cascade; uebernommene Preise behalten Quelle "dokument"
 * mit preis_vorschlag_id null = "Dokument (gelöscht)"). Nur saubere Dokumente haben regulaer eine Ablage-Referenz; die Freigabe laeuft immer.
 * Die Quarantaene-Kopie raeumt der Aufrufer (Task 3).
 */
export async function loescheDokument(c: Q, dokumentId: string): Promise<{ schluessel: string; scanStatus: ScanStatus } | null> {
  const r = (await c.query("delete from dokument where id=$1 returning schluessel, scan_status", [dokumentId])).rows[0];
  if (!r) return null;
  await gibReferenzFrei(c, r.schluessel, `dokument:${dokumentId}`); // idempotent: raeumt auch Reste nach Absturz oder gescheiterter Uebernahme
  return { schluessel: r.schluessel, scanStatus: r.scan_status };
}

const bauteilUnbekannt = () => new FachFehler([{ pfad: "bauteilIds", code: "bauteil_unbekannt", meldung: "Bauteil gehört nicht zu diesem Gebäude" }], 400);

/** Normalisiert IDs; alle muessen zum Gebaeude gehoeren (sonst 400 bauteil_unbekannt). */
export async function pruefeBauteile(c: Q, gebaeudeId: string, ids: string[]): Promise<string[]> {
  const eindeutig = [...new Set(ids.map((x) => x.toLowerCase()))];
  if (!eindeutig.length) return [];
  const da = (await c.query("select id from bauteil where gebaeude_id=$1 and id = any($2::uuid[])", [gebaeudeId, eindeutig])).rows.length;
  if (da !== eindeutig.length) throw bauteilUnbekannt();
  return eindeutig;
}

/** Ersetzt die verknuepften Bauteile des Dokuments durch `ids` (bereits geprueft). */
export async function setzeVerknuepfungen(c: Q, dokumentId: string, ids: string[]) {
  await c.query("delete from dokument_bauteil where dokument_id=$1 and not (bauteil_id = any($2::uuid[]))", [dokumentId, ids]);
  try {
    for (const b of ids) await c.query("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2) on conflict do nothing", [dokumentId, b]);
  } catch (e) {
    if ((e as { code?: string }).code === "23503") throw bauteilUnbekannt(); // Bauteil zwischen Pruefung und Einfuegen geloescht
    throw e;
  }
}

/** Fuegt Verknuepfungen hinzu, ohne vorhandene zu entfernen (Duplikat-Upload). Nur innerhalb einer Transaktion aufrufen:
 *  Die Zeile wird gesperrt, damit der Pruefer (abgelehnt + Links loeschen) nicht dazwischenfaehrt; bei abgelehnt wird nichts eingefuegt. */
export async function ergaenzeVerknuepfungen(c: Q, dokumentId: string, ids: string[]) {
  const s = (await c.query("select scan_status from dokument where id=$1 for update", [dokumentId])).rows[0];
  if (!s || s.scan_status === "abgelehnt") return;
  try {
    for (const b of ids) await c.query("insert into dokument_bauteil(dokument_id, bauteil_id) values ($1,$2) on conflict do nothing", [dokumentId, b]);
  } catch (e) {
    if ((e as { code?: string }).code === "23503") throw bauteilUnbekannt();
    throw e;
  }
}
