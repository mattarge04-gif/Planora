import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L1: string, L2: string, G1: string, GS1: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);

beforeAll(async () => {
  db = await frischeDb();
  L1 = (await q("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await q("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  G1 = (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'G','quader',30,15,1) returning id", [L1])).rows[0].id;
  GS1 = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3.2) returning id", [L1, G1])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Migration 013", () => {
  it("Einheit mit fremder Liegenschaft scheitert am zusammengesetzten Fremdschluessel", async () => {
    await expect(q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'X','buero',0)", [L2, GS1]))
      .rejects.toThrow(/foreign key/);
  });
  it("Bauteil braucht genau einen Standort", async () => {
    const sql = "insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, einheit_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',null,$3,'bestaetigt',0)";
    await expect(q(sql.replace(",$3,", ",null,"), [L1, G1])).rejects.toThrow(/check/);
    await expect(q(sql, [L1, G1, GS1])).resolves.toBeDefined();
  });
  it("negative Menge, unbekannter Status und ungueltiges Baujahr scheitern", async () => {
    const sql = "insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, menge, baujahr, reihenfolge) values ($1,$2,'heizung.verteiler',$3,$4,$5,$6,0)";
    await expect(q(sql, [L1, G1, GS1, "bestaetigt", -1, null])).rejects.toThrow(/check/);
    await expect(q(sql, [L1, G1, GS1, "vielleicht", 1, null])).rejects.toThrow(/check/);
    await expect(q(sql, [L1, G1, GS1, "bestaetigt", 1, 1700])).rejects.toThrow(/check/);
  });
  it("Heizungswerte nur ja/nein/unbekannt", async () => {
    await expect(q("insert into gebaeude_heizung_standard(gebaeude_id, liegenschaft_id, art, vorhanden) values ($1,$2,'hk','vielleicht')", [G1, L1])).rejects.toThrow(/check/);
  });
  it("planora_app darf alle neuen Tabellen lesen und schreiben", async () => {
    for (const t of ["gebaeude", "geschoss", "einheit", "gebaeude_heizung_standard", "einheit_heizung", "bauteil", "versorgung"])
      expect((await q("select has_table_privilege('planora_app', $1, 'select,insert,update,delete') ok", [t])).rows[0].ok).toBe(true);
  });
  it("Loeschen des Gebaeudes raeumt alles ab", async () => {
    const g = (await q("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'Weg','quader',20,10,1) returning id", [L1])).rows[0].id;
    const gs = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3) returning id", [L1, g])).rows[0].id;
    const e = (await q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'E','buero',0) returning id", [L1, gs])).rows[0].id;
    await q("insert into einheit_heizung(einheit_id, liegenschaft_id, art, vorhanden) values ($1,$2,'fbh','ja')", [e, L1]);
    const t = (await q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, einheit_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L1, g, e])).rows[0].id;
    await q("insert into versorgung(bauteil_id, einheit_id, liegenschaft_id) values ($1,$2,$3)", [t, e, L1]);
    await q("delete from gebaeude where id=$1", [g]);
    const anzahl = async (sql: string, p: unknown[]) => (await q(`select count(*)::int n from ${sql}`, p)).rows[0].n;
    expect(await anzahl("geschoss where gebaeude_id=$1", [g])).toBe(0);
    expect(await anzahl("einheit where id=$1", [e])).toBe(0);
    expect(await anzahl("einheit_heizung where einheit_id=$1", [e])).toBe(0);
    expect(await anzahl("bauteil where id=$1", [t])).toBe(0);
    expect(await anzahl("versorgung where bauteil_id=$1", [t])).toBe(0);
  });
});

describe("Migration 014", () => {
  const bauteil = (extra: string, p: unknown[]) =>
    q(`insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge${extra ? ", " + extra.split("=")[0] : ""}) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0${extra ? ",$4" : ""}) returning id`, p);
  it("Gebaeude v2 ohne Masse und mit quadrat, v1 ohne Masse scheitert", async () => {
    await expect(q("insert into gebaeude(liegenschaft_id, name, grundform, regelwerk_version) values ($1,'V2','quadrat',2)", [L1])).resolves.toBeDefined();
    await expect(q("insert into gebaeude(liegenschaft_id, name, grundform, regelwerk_version) values ($1,'V1','quader',1)", [L1])).rejects.toThrow(/gebaeude_masse_v1/);
  });
  it("bauteil_ort_exklusiv verhindert Gruppe und Vorbauteil zugleich", async () => {
    const v = (await bauteil("", [L1, G1, GS1])).rows[0].id;
    const v2 = (await bauteil("", [L1, G1, GS1])).rows[0].id;
    const gr = (await q("insert into gruppe(liegenschaft_id, gebaeude_id, verteiler_bauteil_id, nummer, bezeichnung, art, reihenfolge) values ($1,$2,$3,1,'G1','beimisch',0) returning id", [L1, G1, v])).rows[0].id;
    await expect(q("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge, gruppe_id, vor_bauteil_id) values ($1,$2,'heizung.umwaelzpumpe',$3,'bestaetigt',0,$4,$5)", [L1, G1, GS1, gr, v2]))
      .rejects.toThrow(/bauteil_ort_exklusiv/);
    const t = (await bauteil("gruppe_id=", [L1, G1, GS1, gr])).rows[0].id;
    await q("delete from gruppe where id=$1", [gr]);
    const r = (await q("select gruppe_id, liegenschaft_id from bauteil where id=$1", [t])).rows[0];
    expect(r.gruppe_id).toBeNull();
    expect(r.liegenschaft_id).toBe(L1);
  });
  it("gruppe_verbraucher: ein Bauteil nur in einer Gruppe", async () => {
    const v = (await bauteil("", [L1, G1, GS1])).rows[0].id;
    const mk = async (n: number) => (await q("insert into gruppe(liegenschaft_id, gebaeude_id, verteiler_bauteil_id, nummer, bezeichnung, art, reihenfolge) values ($1,$2,$3,$4,'G','ungeregelt',0) returning id", [L1, G1, v, n])).rows[0].id;
    const a = await mk(1), b = await mk(2);
    const x = (await bauteil("", [L1, G1, GS1])).rows[0].id;
    await q("insert into gruppe_verbraucher(gruppe_id, bauteil_id, liegenschaft_id) values ($1,$2,$3)", [a, x, L1]);
    await expect(q("insert into gruppe_verbraucher(gruppe_id, bauteil_id, liegenschaft_id) values ($1,$2,$3)", [b, x, L1])).rejects.toThrow(/unique|duplicate/);
  });
  it("planora_app darf gruppe, gruppe_verbraucher und entwurf nutzen", async () => {
    for (const t of ["gruppe", "gruppe_verbraucher", "entwurf"])
      expect((await q("select has_table_privilege('planora_app', $1, 'select,insert,update,delete') ok", [t])).rows[0].ok).toBe(true);
  });
});
