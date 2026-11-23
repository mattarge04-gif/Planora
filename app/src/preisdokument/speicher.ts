import type pg from "pg";
import { FachFehler } from "../welt/speicher.js";
export type Status = "neu" | "liest" | "fertig" | "fehler" | "abgebrochen" | "aus";
export interface DokumentZeile { id: string; dateiname: string; groesse: number; seiten: number; hochgeladenAm: string; status: Status; fehler: string | null; vorschlaege: VorschlagZeile[] }
export interface VorschlagZeile { id: string; position: string; seite: number; zitat: string; materialNetto: number | null; rabattText: string | null;
  montageAnteil: number | null; ersatzpreis: number; rechenweg: string; katalogId: string | null; bauteilIds: string[]; fehlendeBauteile: string[];
  sicherheit: "hoch" | "mittel" | "tief"; status: "offen" | "uebernommen" | "verworfen"; alsTyppreis: boolean }
const zahl = (v: string | null) => (v === null ? null : Number(v));

export async function legeDokumentAn(c: Pick<pg.ClientBase, "query">, a: { gebaeudeId: string; liegenschaftId: string; dateiname: string; schluessel: string; sha256: string; groesse: number; seiten: number; von: string; status: Status }) {
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

const f = (code: string, meldung: string, status: 400 | 404 | 409) => new FachFehler([{ pfad: "vorschlag", code, meldung }], status);

export async function uebernimm(c: pg.ClientBase, a: { vorschlagId: string; gebaeudeId: string; bauteilIds: string[]; alsTyppreis: boolean; stand: number; ueberschreibeHandeingabe: boolean; von: string }) {
  const g = (await c.query("select liegenschaft_id, stand from gebaeude where id=$1 for update", [a.gebaeudeId])).rows[0];
  if (!g) throw f("nicht_gefunden", "Gebaeude nicht gefunden", 404);
  if (g.stand !== a.stand) throw f("stand_veraltet", "Daten wurden inzwischen geaendert; bitte neu laden", 409);
  const v = (await c.query(`select v.* from preis_vorschlag v join dokument d on d.id=v.dokument_id where v.id=$1 and d.gebaeude_id=$2 for update of v`, [a.vorschlagId, a.gebaeudeId])).rows[0];
  if (!v) throw f("nicht_gefunden", "Vorschlag nicht gefunden", 404);
  if (v.status !== "offen") throw f("nicht_offen", "Vorschlag ist bereits entschieden", 409);
  if (!v.katalog_id) throw f("ohne_katalog", "Vorschlag ist keinem Bauteiltyp zugeordnet", 400);
  const ids = [...new Set(a.bauteilIds.map((x) => x.toLowerCase()))];
  const passend = (await c.query("select id from bauteil where gebaeude_id=$1 and katalog_id=$2 and id = any($3)", [a.gebaeudeId, v.katalog_id, ids])).rows.map((r) => r.id as string);
  if (passend.length !== ids.length || (!ids.length && !a.alsTyppreis)) throw f("bauteil_unpassend", "Bauteile passen nicht zum Vorschlag", 400);
  if (!a.ueberschreibeHandeingabe) {
    const hand = (await c.query("select bauteil_id from bauteil_akte where bauteil_id = any($1) and quelle_preis='kunde'", [ids])).rows.length;
    const typHand = a.alsTyppreis && (await c.query("select 1 from lebensdauer_typ where liegenschaft_id=$1 and katalog_id=$2 and quelle_preis='kunde'", [g.liegenschaft_id, v.katalog_id])).rowCount;
    if (hand || typHand) throw f("handeingabe", "Von Hand erfasster Preis vorhanden; Überschreiben bestätigen", 409);
  }
  for (const id of ids) await c.query(
    `insert into bauteil_akte(bauteil_id, liegenschaft_id, stueckpreis, quelle_preis, preis_vorschlag_id) values ($1,$2,$3,'dokument',$4)
     on conflict (bauteil_id) do update set stueckpreis=excluded.stueckpreis, quelle_preis='dokument', preis_vorschlag_id=excluded.preis_vorschlag_id`,
    [id, g.liegenschaft_id, v.ersatzpreis, v.id]);
  if (a.alsTyppreis) await c.query(
    `insert into lebensdauer_typ(liegenschaft_id, katalog_id, stueckpreis, quelle_preis, preis_vorschlag_id) values ($1,$2,$3,'dokument',$4)
     on conflict (liegenschaft_id, katalog_id) do update set stueckpreis=excluded.stueckpreis, quelle_preis='dokument', preis_vorschlag_id=excluded.preis_vorschlag_id`,
    [g.liegenschaft_id, v.katalog_id, v.ersatzpreis, v.id]);
  await c.query("update preis_vorschlag set status='uebernommen', bauteil_ids=$2, als_typpreis=$3, entschieden_von=$4, entschieden_am=now() where id=$1", [v.id, ids, a.alsTyppreis, a.von]);
  return { bauteile: ids.length, typ: a.alsTyppreis };
}

export async function verwirf(c: pg.ClientBase, vorschlagId: string, von: string) {
  const r = await c.query("update preis_vorschlag set status='verworfen', entschieden_von=$2, entschieden_am=now() where id=$1 and status='offen'", [vorschlagId, von]);
  if (!r.rowCount) throw f("nicht_offen", "Vorschlag ist bereits entschieden", 409);
}

export async function uebernimmAlleSicheren(c: pg.ClientBase, gebaeudeId: string, stand: number, von: string) {
  const v = (await c.query(`select v.id, v.bauteil_ids from preis_vorschlag v join dokument d on d.id=v.dokument_id
    where d.gebaeude_id=$1 and v.status='offen' and v.sicherheit='hoch' and v.katalog_id is not null and cardinality(v.bauteil_ids) > 0 order by d.hochgeladen_am, v.reihenfolge`, [gebaeudeId])).rows;
  let uebernommen = 0, uebersprungen = 0;
  for (const x of v) {
    await c.query("savepoint sp");
    try { await uebernimm(c, { vorschlagId: x.id, gebaeudeId, bauteilIds: x.bauteil_ids, alsTyppreis: false, stand, ueberschreibeHandeingabe: false, von }); uebernommen++; await c.query("release savepoint sp"); }
    catch (e) {
      await c.query("rollback to savepoint sp");
      if (e instanceof FachFehler && (e.status === 409 || e.status === 400) && e.fehler[0]?.code !== "stand_veraltet") uebersprungen++; else throw e;
    }
  }
  return { uebernommen, uebersprungen };
}
