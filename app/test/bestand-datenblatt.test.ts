import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { anfrageMit, legeKontoAn } from "./hilfe-api.js";
import { baueServer } from "../src/server.js";
import { fakeScanner } from "../src/dokumente/scanner.js";
import { pruefeDatenblatt } from "../src/bestand/datenblatt.js";
import { KATALOG_V2 } from "../src/welt/katalog.v2.js";
import { STANDARD_LEBENSDAUER } from "../src/lebensdauer/standard.js";

const PUMPE = KATALOG_V2.eintraege.find((e) => e.id === "heizung.umwaelzpumpe")!.datenblatt!;
describe("Katalog v2 Bibliothek", () => {
  it("jeder Typ hat Datenblatt, Quelle, Icon und Lebensdauer; neue Typen vorhanden", () => {
    for (const e of KATALOG_V2.eintraege) {
      expect(e.datenblatt?.length, e.id).toBeGreaterThan(0);
      expect(e.lebensdauerQuelle?.jahr, e.id).toBeGreaterThan(1990);
      expect(e.icon, e.id).toMatch(/^[a-z]+$/);
      expect(STANDARD_LEBENSDAUER[e.id], e.id).toBeGreaterThan(0);
      for (const f of e.datenblatt!) expect(f.schluessel).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    }
    expect(KATALOG_V2.eintraege.map((e) => e.id)).toEqual(expect.arrayContaining(["heizung.ausdehnungsgefaess", "heizung.sonstiges", "heizung.wmz"]));
  });
});
describe("pruefeDatenblatt", () => {
  it("Zahl und Text, leere Werte fallen weg", () => {
    expect(pruefeDatenblatt(PUMPE, { dn: 32, foerderhoehe_m: 6.5, leistung_w: null })).toEqual({ ok: true, werte: { dn: 32, foerderhoehe_m: 6.5 } });
    expect(pruefeDatenblatt(PUMPE, {})).toEqual({ ok: true, werte: null });
  });
  it("unbekannter Schluessel und falscher Typ", () => {
    expect(pruefeDatenblatt(PUMPE, { farbe: "rot" })).toMatchObject({ ok: false, fehler: [{ pfad: "werte/farbe", code: "feld_unbekannt" }] });
    expect(pruefeDatenblatt(PUMPE, { dn: "gross" })).toMatchObject({ ok: false, fehler: [{ code: "feld_typ" }] });
    expect(pruefeDatenblatt(PUMPE, { dn: Number.POSITIVE_INFINITY })).toMatchObject({ ok: false });
  });
});

const ORIGIN = "http://localhost:3996";
const pw = randomBytes(12).toString("base64url");
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let anfrage: ReturnType<typeof anfrageMit>;
let L1: string, L2: string, kBearb: string, kLeser: string, kFremd: string, G: string, P1: string, P2: string, V: string;
beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 4, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")), virenScanner: fakeScanner() });
  anfrage = anfrageMit(app, ORIGIN);
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBearb = await legeKontoAn(app, db.pool, ORIGIN, pw, "b@planora.invalid", "bearbeiter", [L1]);
  kLeser = await legeKontoAn(app, db.pool, ORIGIN, pw, "l@planora.invalid", "leser", [L1]);
  kFremd = await legeKontoAn(app, db.pool, ORIGIN, pw, "f@planora.invalid", "leser", [L2]);
  G = (await db.pool.query("insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,'G','quader',30,15,2) returning id", [L1])).rows[0].id;
  const gs = (await db.pool.query("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,'UG1',0,3.2) returning id", [L1, G])).rows[0].id;
  const bt = async (k: string, i: number) => (await db.pool.query("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,$3,$4,'bestaetigt',$5) returning id", [L1, G, k, gs, i])).rows[0].id;
  P1 = await bt("heizung.umwaelzpumpe", 0); P2 = await bt("heizung.umwaelzpumpe", 1); V = await bt("heizung.verteiler", 2);
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Datenblatt-API", () => {
  it("GET leer mit Feldern; PUT auf zwei Pumpen; Leser liest", async () => {
    const g = await anfrage("GET", `/api/bestand/bauteile/${P1}/datenblatt`, kBearb);
    expect(g.json()).toMatchObject({ bauteilId: P1, katalogId: "heizung.umwaelzpumpe", werte: {}, darfAendern: true });
    expect(g.json().felder.map((f: any) => f.schluessel)).toContain("foerderhoehe_m");
    const p = await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1, P2], werte: { dn: 32, foerderhoehe_m: 6.5 } });
    expect([p.statusCode, p.json().werte]).toEqual([200, { dn: 32, foerderhoehe_m: 6.5 }]);
    expect((await anfrage("GET", `/api/bestand/bauteile/${P2}/datenblatt`, kLeser)).json()).toMatchObject({ werte: { dn: 32 }, darfAendern: false });
  });
  it("Fehler: unbekanntes Feld, gemischte Typen, Leser 403, Fremd 404", async () => {
    expect((await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1], werte: { farbe: "rot" } })).json().fehler[0].code).toBe("feld_unbekannt");
    expect((await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1, V], werte: {} })).json().fehler[0].code).toBe("bauteil_gemischt");
    expect((await anfrage("PUT", "/api/bestand/datenblatt", kLeser, { bauteilIds: [P1], werte: {} })).statusCode).toBe(403);
    expect((await anfrage("GET", `/api/bestand/bauteile/${P1}/datenblatt`, kFremd)).statusCode).toBe(404);
  });
  it("leeres Datenblatt loescht die Akte-Zeile, wenn sonst nichts erfasst ist", async () => {
    await anfrage("PUT", "/api/bestand/datenblatt", kBearb, { bauteilIds: [P1, P2], werte: {} });
    expect((await db.pool.query("select 1 from bauteil_akte where bauteil_id = any($1::uuid[])", [[P1, P2]])).rowCount).toBe(0);
  });
});
