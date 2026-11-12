import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3996";
const pw = randomBytes(12).toString("base64url");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kAdmin: string, kBetr: string, kLeser: string, G1: string, G2: string;

const anfrage = (method: "GET" | "POST" | "PUT", url: string, cookie: string, body?: unknown) => app.inject({
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

beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 2, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('B-Liegenschaft') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('A-Liegenschaft') returning id")).rows[0].id;
  kAdmin = await konto("admin@planora.invalid", "admin", []);
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  G1 = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE)).json().id;
  G2 = (await anfrage("POST", `/api/struktur/liegenschaften/${L2}/gebaeude`, kBetr, { ...HUELLE, name: "Annex", geschosse: [{ code: "EG" }] })).json().id;
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("GET /api/struktur/liegenschaften", () => {
  it("Betreiber sieht alle Liegenschaften (nur ID und Name), damit er Gebaeude anlegen kann", async () => {
    const r = await anfrage("GET", "/api/struktur/liegenschaften", kBetr);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([{ id: L2, name: "A-Liegenschaft" }, { id: L1, name: "B-Liegenschaft" }]);
  });
  it("Admin sieht alle, Leser nur seine", async () => {
    expect((await anfrage("GET", "/api/struktur/liegenschaften", kAdmin)).json().map((l: any) => l.id)).toEqual([L2, L1]);
    expect((await anfrage("GET", "/api/struktur/liegenschaften", kLeser)).json()).toEqual([{ id: L1, name: "B-Liegenschaft" }]);
  });
  it("ohne Sitzung 401", async () => {
    expect((await app.inject({ url: "/api/struktur/liegenschaften" })).statusCode).toBe(401);
  });
});

describe("GET /api/struktur/gebaeude", () => {
  it("Admin sieht alle, sortiert nach Liegenschaft und Name", async () => {
    const r = await anfrage("GET", "/api/struktur/gebaeude", kAdmin);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([
      { id: G2, name: "Annex", liegenschaftId: L2, liegenschaftName: "A-Liegenschaft", geschosse: 1 },
      { id: G1, name: "Haus", liegenschaftId: L1, liegenschaftName: "B-Liegenschaft", geschosse: 2 },
    ]);
  });
  it("Leser sieht nur seine Liegenschaft", async () => {
    expect((await anfrage("GET", "/api/struktur/gebaeude", kLeser)).json().map((g: any) => g.id)).toEqual([G1]);
  });
  it("Betreiber sieht keine Fachdaten", async () => {
    expect((await anfrage("GET", "/api/struktur/gebaeude", kBetr)).json()).toEqual([]);
  });
  it("ohne Sitzung 401", async () => {
    expect((await app.inject({ url: "/api/struktur/gebaeude" })).statusCode).toBe(401);
  });
});

describe("GET /api/katalog/v2", () => {
  it("liefert Eintraege mit Masse, ohne Sitzung 401", async () => {
    const k = (await anfrage("GET", "/api/katalog/v2", kLeser)).json();
    expect(k.version).toBe(2);
    expect(k.eintraege).toHaveLength(13);
    expect(k.eintraege.find((e: any) => e.id === "heizung.wmz")).toEqual({ id: "heizung.wmz", name: "Waermezaehler", bereich: "zubehoer", masse: [0.25, 0.2, 0.15] });
    expect((await app.inject({ url: "/api/katalog/v2" })).statusCode).toBe(401);
  });
});

describe("GET /api/katalog/v1", () => {
  it("liefert IDs, Namen und Bereich", async () => {
    const r = await anfrage("GET", "/api/katalog/v1", kLeser);
    expect(r.statusCode).toBe(200);
    const k = r.json();
    expect(k.version).toBe(1);
    expect(k.eintraege).toHaveLength(10);
    expect(k.eintraege.find((e: any) => e.id === "heizung.verteiler")).toEqual({ id: "heizung.verteiler", name: "Heizungsverteiler", bereich: "verteilung" });
  });
  it("ohne Sitzung 401", async () => {
    expect((await app.inject({ url: "/api/katalog/v1" })).statusCode).toBe(401);
  });
});

describe("Fehlerformat 400", () => {
  it("Schemafehler im Body als {fehler} mit Pfad", async () => {
    const b = (await anfrage("GET", `/api/struktur/gebaeude/${G1}/beschreibung`, kAdmin)).json();
    const r = await anfrage("PUT", `/api/struktur/gebaeude/${G1}/beschreibung`, kAdmin, { ...b, stand: "x" });
    expect(r.statusCode).toBe(400);
    expect(r.json().fehler[0]).toMatchObject({ pfad: "body/stand", code: "struktur_ungueltig" });
    expect(typeof r.json().fehler[0].meldung).toBe("string");
  });
  it("Schemafehler in Params", async () => {
    const r = await anfrage("GET", "/api/struktur/gebaeude/keine-uuid/beschreibung", kAdmin);
    expect(r.statusCode).toBe(400);
    expect(r.json().fehler[0]).toMatchObject({ pfad: "params/id", code: "struktur_ungueltig" });
  });
});
