import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { frischeDb } from "./hilfe.js";
import { ladeVorlagen, schreibeVorlagen, type VorlagenEingabe } from "../src/welt/vorlage.js";

let db: Awaited<ReturnType<typeof frischeDb>>;
let L: string, G: string, EG: string, OG1: string, E1: string, E2: string;
const q = (sql: string, p: unknown[] = []) => db.pool.query(sql, p);
const tx = async <T>(f: (c: any) => Promise<T>) => {
  const c = await db.pool.connect();
  try { await c.query("begin"); const r = await f(c); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
};

beforeAll(async () => {
  db = await frischeDb();
  L = (await q("insert into liegenschaft(name) values ('L') returning id")).rows[0].id;
  G = (await q("insert into gebaeude(liegenschaft_id, name, grundform, regelwerk_version) values ($1,'G','quader',2) returning id", [L])).rows[0].id;
  EG = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'EG',0,3) returning id", [L, G])).rows[0].id;
  OG1 = (await q("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'OG1',1,3) returning id", [L, G])).rows[0].id;
  E1 = (await q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'Büro 1.01','buero',0) returning id", [L, OG1])).rows[0].id;
  E2 = (await q("insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, reihenfolge) values ($1,$2,'Büro 1.02','buero',1) returning id", [L, OG1])).rows[0].id;
});
afterAll(async () => { await db.ende(); });

const eingabe = (zuordnung: VorlagenEingabe["zuordnung"], geschosse: string[] = []): VorlagenEingabe => ({
  version: 1,
  vorlagen: [{ schluessel: "v1", name: "Regel-OG", geschosse: geschosse.length ? geschosse : [OG1], ausgelassen: [],
    plaetze: [{ schluessel: "p1", art: "buero", ausnahme: {}, mengen: { hk: 4 } }, { schluessel: "p2", art: "buero", ausnahme: { fbh: "ja" }, mengen: {} }] }],
  zuordnung,
});

describe("Migration 015", () => {
  it("planora_app darf geschoss_vorlage lesen und schreiben", async () => {
    expect((await q("select has_table_privilege('planora_app', 'geschoss_vorlage', 'select,insert,update,delete') ok")).rows[0].ok).toBe(true);
  });
  it("fremde Liegenschaft scheitert am Fremdschluessel", async () => {
    const L2 = (await q("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
    await expect(q("insert into geschoss_vorlage(gebaeude_id, liegenschaft_id, daten) values ($1,$2,'{}')", [G, L2])).rejects.toThrow(/foreign key/);
  });
  it("Loeschen des Gebaeudes loescht die Vorlage", async () => {
    const g = (await q("insert into gebaeude(liegenschaft_id, name, grundform, regelwerk_version) values ($1,'Weg','quader',2) returning id", [L])).rows[0].id;
    await q("insert into geschoss_vorlage(gebaeude_id, liegenschaft_id, daten) values ($1,$2,'{}')", [g, L]);
    await q("delete from gebaeude where id=$1", [g]);
    expect((await q("select count(*)::int n from geschoss_vorlage where gebaeude_id=$1", [g])).rows[0].n).toBe(0);
  });
});

describe("Vorlagen speichern", () => {
  it("loest Index-Verweise ueber einheitIds auf und speichert je Einheit-ID", async () => {
    const n = await tx((c) => schreibeVorlagen(c, G, eingabe([
      { einheit: { einheitIndex: 0 }, vorlage: "v1", platz: "p1", abweichend: [] },
      { einheit: { einheitId: E2 }, vorlage: "v1", platz: "p2", abweichend: ["bezeichnung"] },
    ]), [E1, E2]));
    expect(n).toBe(1);
    const v = await tx((c) => ladeVorlagen(c, G));
    expect(v!.version).toBe(1);
    expect(v!.vorlagen[0].geschosse).toEqual([OG1]);
    expect(v!.zuordnung).toEqual({ [E1]: { vorlage: "v1", platz: "p1", abweichend: [] }, [E2]: { vorlage: "v1", platz: "p2", abweichend: ["bezeichnung"] } });
  });
  it("verwirft unbekannte Einheiten, Geschosse und Plaetze still", async () => {
    await tx((c) => schreibeVorlagen(c, G, eingabe([
      { einheit: { einheitIndex: 7 }, vorlage: "v1", platz: "p1", abweichend: [] },
      { einheit: { einheitId: "00000000-0000-4000-8000-000000000999" }, vorlage: "v1", platz: "p1", abweichend: [] },
      { einheit: { einheitId: E1 }, vorlage: "vX", platz: "p1", abweichend: [] },
    ], [OG1, "00000000-0000-4000-8000-000000000998"]), [E1, E2]));
    const v = await tx((c) => ladeVorlagen(c, G));
    expect(v!.zuordnung).toEqual({});
    expect(v!.vorlagen[0].geschosse).toEqual([OG1]);
  });
  it("ohne Eingabe wird der Eintrag geloescht", async () => {
    expect(await tx((c) => schreibeVorlagen(c, G, undefined, [E1, E2]))).toBe(0);
    expect(await tx((c) => ladeVorlagen(c, G))).toBeNull();
  });
  it("leere Vorlagenliste loescht ebenfalls", async () => {
    await tx((c) => schreibeVorlagen(c, G, eingabe([]), [E1]));
    expect(await tx((c) => schreibeVorlagen(c, G, { version: 1, vorlagen: [], zuordnung: [] }, [E1]))).toBe(0);
    expect(await tx((c) => ladeVorlagen(c, G))).toBeNull();
  });
});
