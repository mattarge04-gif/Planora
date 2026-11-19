import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { schalteAus, schalteEin } from "../src/module/schalter.js";

const ORIGIN = "http://localhost:3996";
const pw = randomBytes(12).toString("base64url");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kBetr: string, kBearb: string, kLeser: string, kFremd: string;
let G: string;

const anfrage = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, cookie: string, body?: unknown) => app.inject({
  method, url,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
  payload: body !== undefined ? JSON.stringify(body) : undefined,
});
const cookieVon = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
async function konto(email: string, rolle: string, scopes: string[]) {
  const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), email, email, pw);
  await db.pool.query("update rolle_zuordnung set rolle=$2 where benutzer_id=$1", [benutzerId, rolle]);
  for (const l of scopes) await db.pool.query("insert into rolle_liegenschaft(benutzer_id, liegenschaft_id) values ($1,$2)", [benutzerId, l]);
  const r = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { "content-type": "application/json", origin: ORIGIN }, payload: JSON.stringify({ email, password: pw }) });
  expect(r.statusCode).toBe(200);
  return cookieVon(r);
}

function erstbefuellung(leer: any) {
  const [eg, og1] = leer.geschosse;
  return {
    ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [
      { geschossId: eg.id, bezeichnung: "Buero A", art: "buero", flaecheM2: null },
      { geschossId: eg.id, bezeichnung: "Technik", art: "technik", flaecheM2: 30 },
      { geschossId: og1.id, bezeichnung: "Buero C", art: "buero", flaecheM2: null, heizungAusnahme: { fbh: "ja" } },
    ],
    bauteile: [
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 12, status: "bestaetigt", hersteller: "Zehnder", versorgt: [] },
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 3, status: "bestaetigt", hersteller: "Prolux", versorgt: [] },
      { katalogId: "heizung.verteiler", standort: { einheitIndex: 1 }, menge: 1, status: "bestaetigt", versorgt: [{ einheitIndex: 2 }] },
    ],
  };
}

beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 2, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  await schalteEin(db.pool, "lebensdauer", 2, randomUUID());
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kBearb = await konto("bearb@planora.invalid", "bearbeiter", [L1]);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  kFremd = await konto("fremd@planora.invalid", "leser", [L2]);
  G = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE)).json().id;
  const leer = (await anfrage("GET", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb)).json();
  const put = await anfrage("PUT", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb, erstbefuellung(leer));
  expect(put.statusCode).toBe(200);
});
afterAll(async () => { await app.close(); await db.ende(); });

const url = () => `/api/lebensdauer/gebaeude/${G}`;
const JAHR = new Date().getFullYear();

describe("Lebensdauer-API", () => {
  it("Leser liest, Fremde 404, Betreiber 404", async () => {
    const r = await anfrage("GET", url(), kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ gebaeudeId: G, ergebnis: { stichtag: JAHR } });
    expect((await anfrage("GET", url(), kFremd)).statusCode).toBe(404);
    expect((await anfrage("GET", url(), kBetr)).statusCode).toBe(404);
  });
  it("Leser darf nicht schreiben (403), Bearbeiter schon; Audit", async () => {
    const s = (await anfrage("GET", url(), kBearb)).json();
    expect((await anfrage("PUT", url(), kLeser, { stand: s.stand, heizungBaujahr: 2008 })).statusCode).toBe(403);
    const put = await anfrage("PUT", url(), kBearb, { stand: s.stand, heizungBaujahr: JAHR - 35 });
    expect(put.statusCode).toBe(200);
    expect(put.json().ergebnis.zaehler.rot).toBeGreaterThan(0);
    expect((await db.pool.query("select count(*)::int n from audit_eintrag where art='lebensdauer.geaendert'")).rows[0].n).toBe(1);
  });
  it("ungueltige Werte -> 400 im einheitlichen Format", async () => {
    const s = (await anfrage("GET", url(), kBearb)).json();
    for (const body of [{ stand: s.stand, heizungBaujahr: 1700 }, { stand: s.stand, bauteile: [{ id: s.bauteile[0].id, zustand: "super" }] },
      { stand: s.stand, typen: [{ katalogId: "heizung.verteiler", stueckpreis: -5 }] }, { stand: s.stand, unbekannt: 1 }]) {
      const r = await anfrage("PUT", url(), kBearb, body);
      expect(r.statusCode, JSON.stringify(body)).toBe(400);
      expect(r.json().fehler[0]).toMatchObject({ pfad: expect.any(String), code: expect.any(String) });
    }
  });
  it("400 aus dem Speicher (fremde Bauteil-ID) schreibt nichts (Rollback)", async () => {
    const s = (await anfrage("GET", url(), kBearb)).json();
    const r = await anfrage("PUT", url(), kBearb, { stand: s.stand, heizungBaujahr: 1999, bauteile: [{ id: randomUUID(), zustand: "gut" }] });
    expect(r.statusCode).toBe(400);
    expect(r.json().fehler[0]).toMatchObject({ code: "bauteil_unbekannt" });
    const danach = (await anfrage("GET", url(), kBearb)).json();
    expect(danach.heizungBaujahr).toBe(s.heizungBaujahr);
    expect(danach.stand).toBe(s.stand);
  });
  it("veralteter Stand -> 409; Assistent mit altem Stand nach Baujahr-Aenderung -> 409", async () => {
    const b = (await anfrage("GET", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb)).json();
    const s = (await anfrage("GET", url(), kBearb)).json();
    expect((await anfrage("PUT", url(), kBearb, { stand: s.stand - 1 })).statusCode).toBe(409);
    await anfrage("PUT", url(), kBearb, { stand: s.stand, bauteile: [{ id: s.bauteile[0].id, baujahr: 2015 }] });
    expect((await anfrage("PUT", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb, b)).statusCode).toBe(409);
  });
  it("Modul aus -> 404", async () => {
    await schalteAus(db.pool, "lebensdauer", randomUUID());
    expect((await anfrage("GET", url(), kBearb)).statusCode).toBe(404);
    await schalteEin(db.pool, "lebensdauer", 2, randomUUID());
  });
  it("CSV-Export: Rechte, Typ, Dateiname", async () => {
    const r = await anfrage("GET", `${url()}/export.csv`, kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv; charset=utf-8/);
    expect(r.headers["content-disposition"]).toMatch(/attachment; filename="erneuerungsplan-.*\.csv"/);
    expect(r.body.split("\r\n").length).toBeGreaterThan(3);
    expect((await anfrage("GET", `${url()}/export.csv`, kFremd)).statusCode).toBe(404);
  });
});
