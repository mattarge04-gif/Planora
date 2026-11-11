import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3997";
const pw = randomBytes(12).toString("base64url");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kBetr: string, kBearb: string, kLeser: string, kFremd: string;
let G: string;

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
const urlB = () => `/api/struktur/gebaeude/${G}/beschreibung`;
const urlW = () => `/api/szene/gebaeude/${G}/welt`;

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
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kBearb = await konto("bearb@planora.invalid", "bearbeiter", [L1]);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  kFremd = await konto("fremd@planora.invalid", "leser", [L2]);
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Welt-API", () => {
  it("Betreiber legt Huelle an; andere Rollen nicht; Betreiber sieht keine Fachdaten", async () => {
    expect((await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBearb, HUELLE)).statusCode).toBe(403);
    expect((await anfrage("POST", `/api/struktur/liegenschaften/${randomUUID()}/gebaeude`, kBetr, HUELLE)).statusCode).toBe(404);
    expect((await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, { ...HUELLE, breiteM: 2 })).statusCode).toBe(422);
    const r = await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE);
    expect(r.statusCode).toBe(201);
    G = r.json().id;
    expect((await anfrage("GET", `/api/struktur/gebaeude/${G}/huelle`, kBetr)).json().geschosse.map((g: any) => g.code)).toEqual(["EG", "OG1"]);
    expect((await anfrage("GET", urlB(), kBetr)).statusCode).toBe(404);
  });
  it("Bearbeiter schreibt; unveraendert zurueck ergibt gleiche IDs und gleichen Welt-Hash", async () => {
    const leer = (await anfrage("GET", urlB(), kBearb)).json();
    const put = await anfrage("PUT", urlB(), kBearb, erstbefuellung(leer));
    expect(put.statusCode).toBe(200);
    const b1 = put.json();
    const w1 = (await anfrage("GET", urlW(), kBearb)).json();
    const b2 = (await anfrage("PUT", urlB(), kBearb, b1)).json();
    expect(b2.einheiten.map((e: any) => e.id)).toEqual(b1.einheiten.map((e: any) => e.id));
    expect(b2.bauteile.map((t: any) => t.id)).toEqual(b1.bauteile.map((t: any) => t.id));
    const w2 = (await anfrage("GET", urlW(), kBearb)).json();
    expect(w2.hash).toBe(w1.hash);
    expect(w1.symbole.filter((s: any) => s.katalogId === "heizung.heizkoerper")).toHaveLength(2);
    const audit = await db.pool.query("select count(*)::int n from audit_eintrag where art='gebaeude.beschreibung'");
    expect(audit.rows[0].n).toBe(2);
  });
  it("Leser liest, schreibt aber nicht; fremde Liegenschaft sieht nichts", async () => {
    const b = (await anfrage("GET", urlB(), kLeser)).json();
    expect((await anfrage("GET", urlW(), kLeser)).statusCode).toBe(200);
    expect((await anfrage("PUT", urlB(), kLeser, b)).statusCode).toBe(403);
    expect((await anfrage("GET", urlB(), kFremd)).statusCode).toBe(404);
    expect((await anfrage("GET", urlW(), kFremd)).statusCode).toBe(404);
  });
  it("veralteter Stand → 409", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    expect((await anfrage("PUT", urlB(), kBearb, { ...b, stand: b.stand - 1 })).statusCode).toBe(409);
  });
  it("fachliche Fehler → 422 mit Codes; Strukturfehler → 400", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    const fbhInA = { katalogId: "heizung.fbh_kreis", standort: { einheitId: b.einheiten[0].id }, menge: 2, status: "bestaetigt", versorgt: [] };
    const r = await anfrage("PUT", urlB(), kBearb, { ...b, bauteile: [...b.bauteile, fbhInA] });
    expect(r.statusCode).toBe(422);
    expect(r.json().fehler.map((f: any) => f.code)).toEqual(["bestaetigt_bei_unbekannt"]);
    const fremd = await anfrage("POST", `/api/struktur/liegenschaften/${L2}/gebaeude`, kBetr, HUELLE);
    const fremdesGeschoss = (await anfrage("GET", `/api/struktur/gebaeude/${fremd.json().id}/huelle`, kBetr)).json().geschosse[0].id;
    const r2 = await anfrage("PUT", urlB(), kBearb, { ...b, einheiten: [...b.einheiten, { geschossId: fremdesGeschoss, bezeichnung: "X", art: "buero", flaecheM2: null }] });
    expect(r2.json().fehler.map((f: any) => f.code)).toEqual(["verweis_ungueltig"]);
    const r3 = await anfrage("PUT", urlB(), kBearb, { ...b, einheiten: [{ ...b.einheiten[0], id: randomUUID() }, ...b.einheiten.slice(1)] });
    expect(r3.json().fehler.map((f: any) => f.code)).toContain("id_unbekannt");
    expect((await anfrage("PUT", urlB(), kBearb, { ...b, bauteile: [{ ...b.bauteile[0], status: "kaputt" }] })).statusCode).toBe(400);
    expect((await anfrage("GET", "/api/struktur/gebaeude/keine-uuid/beschreibung", kBearb)).statusCode).toBe(400);
  });
  it("Kopie mit manuellem Layout; Loeschen dann blockiert", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    const { id: _weg, ...kopie } = b.einheiten[2];
    const neu = (await anfrage("PUT", urlB(), kBearb, { ...b, einheiten: [...b.einheiten, { ...kopie, bezeichnung: "Kopie", layoutManuell: { x: 0, z: 0, breite: 5, tiefe: 5 } }] })).json();
    expect(neu.einheiten).toHaveLength(4);
    expect(neu.einheiten[3].id).not.toBe(neu.einheiten[2].id);
    const w = (await anfrage("GET", urlW(), kBearb)).json();
    expect(w.einheiten.find((e: any) => e.id === neu.einheiten[3].id).quelle).toBe("manuell");
    const r = await anfrage("PUT", urlB(), kBearb, { ...neu, einheiten: neu.einheiten.slice(0, 3) });
    expect(r.statusCode).toBe(422);
    expect(r.json().fehler.map((f: any) => f.code)).toEqual(["loeschen_blockiert"]);
  });
  it("Strukturfehler werden nicht stillschweigend bereinigt; Huelle nur durch Betreiber", async () => {
    const b = (await anfrage("GET", urlB(), kBearb)).json();
    const mitTippfehler = { ...b, einheiten: [{ ...b.einheiten[0], heizungAusname: { fbh: "ja" } }, ...b.einheiten.slice(1)] };
    expect((await anfrage("PUT", urlB(), kBearb, mitTippfehler)).statusCode).toBe(400);
    expect((await anfrage("PUT", urlB(), kBearb, { ...b, stand: String(b.stand) })).statusCode).toBe(400);
    const h = (await anfrage("GET", `/api/struktur/gebaeude/${G}/huelle`, kBetr)).json();
    const neu = { ...h, geschosse: [...h.geschosse, { code: "OG2" }] };
    expect((await anfrage("PUT", `/api/struktur/gebaeude/${G}/huelle`, kBearb, neu)).statusCode).toBe(403);
    const ok = await anfrage("PUT", `/api/struktur/gebaeude/${G}/huelle`, kBetr, neu);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().geschosse).toHaveLength(3);
  });
});
