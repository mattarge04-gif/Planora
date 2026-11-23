import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { schalteAus, schalteEin } from "../src/module/schalter.js";
import { fakeAdapter } from "../src/preisdokument/fake.js";

const ORIGIN = "http://localhost:3994";
const pw = randomBytes(12).toString("base64url");
const SECRET = randomBytes(32).toString("hex");
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


beforeAll(async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 4, baseURL: ORIGIN, secret: SECRET, ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  await schalteEin(db.pool, "lebensdauer", 4, randomUUID());
  await schalteEin(db.pool, "preisdokument", 4, randomUUID());
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kBearb = await konto("bearb@planora.invalid", "bearbeiter", [L1]);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  kFremd = await konto("fremd@planora.invalid", "leser", [L2]);
  G = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE)).json().id;
});
afterAll(async () => { vi.unstubAllEnvs(); await app.close(); await db.ende(); });

const NL = String.fromCharCode(10);
const pdf = (seiten: number, zusatz = "") => Buffer.from(["%PDF-1.7", ...Array.from({ length: seiten }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj`), `2 0 obj << /Type /Pages /Count ${seiten} >> endobj`, zusatz + "%%EOF"].join(NL));
const hochladen = (cookie: string, gid: string, daten: Buffer, name = "Offerte Pumpen.pdf") => app.inject({
  method: "POST", url: `/api/preisdokument/gebaeude/${gid}/dokumente`,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", "content-type": "application/pdf", "x-dateiname": encodeURIComponent(name) },
  payload: daten,
});
const liste = () => `/api/preisdokument/gebaeude/${G}`;

describe("Preisdokument-API", () => {
  it("Upload, Duplikat, Nicht-PDF", async () => {
    const daten = pdf(2);
    const r = await hochladen(kBearb, G, daten);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ dateiname: "Offerte Pumpen.pdf", seiten: 2, status: "aus", vorschlaege: [] });
    const r2 = await hochladen(kBearb, G, daten);
    expect(r2.statusCode).toBe(200);
    expect(r2.json().id).toBe(r.json().id);
    const g = await hochladen(kBearb, G, Buffer.from("GIF89a"));
    expect(g.statusCode).toBe(400);
    expect(g.json()).toEqual({ fehler: "kein_pdf" });
  });
  it("Body ohne application/pdf (JSON, leer) -> 400 kein_pdf statt 500", async () => {
    const j = await anfrage("POST", `/api/preisdokument/gebaeude/${G}/dokumente`, kBearb, { a: 1 });
    expect([j.statusCode, j.json()]).toEqual([400, { fehler: "kein_pdf" }]);
    const leer = await app.inject({ method: "POST", url: `/api/preisdokument/gebaeude/${G}/dokumente`, headers: { cookie: kBearb, origin: ORIGIN, "x-planora-request": "1" } });
    expect([leer.statusCode, leer.json()]).toEqual([400, { fehler: "kein_pdf" }]);
  });
  it("Gebaeude zwischen Zugriffspruefung und Einfuegen geloescht -> 404", async () => {
    const orig = db.pool.query.bind(db.pool);
    const spion = vi.spyOn(db.pool, "query").mockImplementation(((sql: unknown, p?: unknown) =>
      typeof sql === "string" && sql.startsWith("select liegenschaft_id from gebaeude") ? Promise.resolve({ rows: [] }) : orig(sql as string, p as unknown[])) as typeof db.pool.query);
    try {
      expect((await hochladen(kBearb, G, pdf(1, "% weg"))).statusCode).toBe(404);
    } finally { spion.mockRestore(); }
  });
  it("Dateiname ohne Steuer- und Bidi-Zeichen", async () => {
    const zeichen = [0x01, 0x1f, 0x7f, 0x200e, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069].map((c) => String.fromCharCode(c)).join("");
    const r = await hochladen(kBearb, G, pdf(1, "% bidi"), `Rechnung${zeichen}fdp.pdf`);
    expect(r.statusCode).toBe(201);
    expect(r.json().dateiname).toBe("Rechnungfdp.pdf");
  });
  it("Leser liest, darf nicht hochladen; Fremd 404", async () => {
    const r = await anfrage("GET", liste(), kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ darfAendern: false, auslesen: "kein_schluessel" });
    expect(r.json().dokumente.length).toBeGreaterThan(0);
    expect((await hochladen(kLeser, G, pdf(1, "% leser"))).statusCode).toBe(403);
    expect((await anfrage("GET", liste(), kFremd)).statusCode).toBe(404);
    expect((await hochladen(kFremd, G, pdf(1, "% fremd"))).statusCode).toBe(404);
  });
  it("Datei oeffnen inline", async () => {
    const daten = pdf(1, "% oeffnen");
    const id = (await hochladen(kBearb, G, daten)).json().id;
    const r = await anfrage("GET", `/api/preisdokument/dokumente/${id}/datei`, kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(String(r.headers["content-disposition"])).toMatch(/^inline/);
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(r.rawPayload, daten)).toBe(0);
    expect((await anfrage("GET", `/api/preisdokument/dokumente/${id}/datei`, kFremd)).statusCode).toBe(404);
  });
  it("Loeschen: 204, Liste, Referenz weg, Journal", async () => {
    const id = (await hochladen(kBearb, G, pdf(1, "% loeschen"))).json().id;
    const schluessel = (await db.pool.query("select schluessel from dokument where id=$1", [id])).rows[0].schluessel;
    expect((await anfrage("DELETE", `/api/preisdokument/dokumente/${id}`, kLeser)).statusCode).toBe(403);
    expect((await anfrage("DELETE", `/api/preisdokument/dokumente/${id}`, kBearb)).statusCode).toBe(204);
    expect((await anfrage("GET", liste(), kBearb)).json().dokumente.some((d: any) => d.id === id)).toBe(false);
    expect((await db.pool.query("select 1 from datei_referenz where objekt=$1", [`dokument:${id}`])).rowCount).toBe(0);
    const j = await db.pool.query("select 1 from loesch_journal where art='datei.loeschen' and ziel=$1", [schluessel]);
    expect(j.rowCount).toBeGreaterThan(0);
  });
  it("Modul aus -> 404", async () => {
    await schalteAus(db.pool, "preisdokument", randomUUID());
    expect((await anfrage("GET", liste(), kBearb)).statusCode).toBe(404);
    await schalteEin(db.pool, "preisdokument", 4, randomUUID());
  });
});

describe("Preisdokument-API mit Leseadapter", () => {
  let app2: FastifyInstance; let B: string;
  const gueltig = () => ({ vorschlaege: [{ position: "Pumpe", seite: 1, zitat: "Pumpe 1240.00", materialNetto: 1116, rabattText: null, montageAnteil: 180,
    ersatzpreis: 1296, rechenweg: "1240 + 180", katalogId: "heizung.heizkoerper", bauteilIds: [B], sicherheit: "hoch" }] });
  const bauApp = (leseAdapter: any) => baueServer({ pool: db.pool, stufe: 4, baseURL: ORIGIN, secret: SECRET, ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")), leseAdapter });
  const gib = (a: FastifyInstance, method: "GET" | "POST", url: string, cookie: string) => a.inject({ method, url, headers: { cookie, origin: ORIGIN, "x-planora-request": "1" } });
  const warteStatus = async (id: string, status: string) => {
    // grosszuegige Grenze (30 s), damit Last auf Windows/eingebettetem PG nicht zu Fehlalarmen fuehrt
    for (let i = 0; i < 600; i++) {
      const d = (await gib(app2, "GET", liste(), kBearb)).json().dokumente.find((x: any) => x.id === id);
      if (d?.status === status) return d;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Status " + status + " nicht erreicht");
  };
  beforeAll(async () => {
    const leer = (await anfrage("GET", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb)).json();
    const [eg] = leer.geschosse;
    const put = await anfrage("PUT", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb, { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: [{ geschossId: eg.id, bezeichnung: "Buero A", art: "buero", flaecheM2: null }],
      bauteile: [{ katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 4, status: "bestaetigt", versorgt: [] }] });
    expect(put.statusCode).toBe(200);
    B = (await db.pool.query("select id from bauteil where gebaeude_id=$1 and katalog_id='heizung.heizkoerper'", [G])).rows[0].id;
    app2 = await bauApp(fakeAdapter(() => gueltig()));
  });
  afterAll(async () => { await app2.close(); });
  it("Upload liest im Hintergrund, Vorschlag mit bauteilIds, Neu lesen", async () => {
    const r = await app2.inject({ method: "POST", url: `/api/preisdokument/gebaeude/${G}/dokumente`,
      headers: { cookie: kBearb, origin: ORIGIN, "x-planora-request": "1", "content-type": "application/pdf", "x-dateiname": "a.pdf" }, payload: pdf(1, "% lesen") });
    expect(r.statusCode).toBe(201);
    expect(r.json().status).toBe("neu");
    const d = await warteStatus(r.json().id, "fertig");
    expect(d.vorschlaege).toHaveLength(1);
    expect(d.vorschlaege[0].bauteilIds).toEqual([B]);
    expect((await gib(app2, "GET", liste(), kBearb)).json()).toMatchObject({ auslesen: "an", budget: { limitUsd: 20 } });
    const n = await gib(app2, "POST", `/api/preisdokument/dokumente/${r.json().id}/neu-lesen`, kBearb);
    expect(n.statusCode).toBe(202);
    const d2 = await warteStatus(r.json().id, "fertig");
    expect(d2.vorschlaege).toHaveLength(1);
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${r.json().id}/neu-lesen`, kLeser)).statusCode).toBe(403);
    expect((await gib(app2, "POST", `/api/preisdokument/dokumente/${r.json().id}/neu-lesen`, kFremd)).statusCode).toBe(404);
  });
  it("neu-lesen waehrend 'liest' -> 409 ohne Audit", async () => {
    const id = (await hochladen(kBearb, G, pdf(1, "% liest"))).json().id;
    await db.pool.query("update dokument set auslesen_status='liest' where id=$1", [id]);
    const vorher = (await db.pool.query("select count(*) n from audit_eintrag where art='preisdokument.neu_lesen'")).rows[0].n;
    const r = await gib(app2, "POST", `/api/preisdokument/dokumente/${id}/neu-lesen`, kBearb);
    expect([r.statusCode, r.json()]).toEqual([409, { fehler: "liest_bereits" }]);
    expect((await db.pool.query("select count(*) n from audit_eintrag where art='preisdokument.neu_lesen'")).rows[0].n).toBe(vorher);
  });
  it("ohne Adapter: neu-lesen -> 409", async () => {
    const app3 = await bauApp(null);
    try {
      const id = (await hochladen(kBearb, G, pdf(1, "% ohne"))).json().id;
      const r = await gib(app3, "POST", `/api/preisdokument/dokumente/${id}/neu-lesen`, kBearb);
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({ fehler: "auslesen_aus" });
    } finally { await app3.close(); }
  });
});

describe("Preisdokument-API Entscheidungen", () => {
  let B: string, V: string, DOK: string, L: string;
  const post = (url: string, cookie: string, body?: unknown) => anfrage("POST", url, cookie, body ?? {});
  const neuerVorschlag = async (sicherheit = "hoch") => {
    const id = randomUUID();
    await db.pool.query(`insert into preis_vorschlag(id, dokument_id, reihenfolge, position, seite, zitat, ersatzpreis, rechenweg, katalog_id, bauteil_ids, sicherheit)
      values ($1,$2,0,'HK',2,'z',250,'r','heizung.heizkoerper',$3,$4)`, [id, DOK, [B], sicherheit]);
    return id;
  };
  const standG = async () => (await db.pool.query("select stand from gebaeude where id=$1", [G])).rows[0].stand as number;
  const zaehle = async (art: string) => Number((await db.pool.query("select count(*) n from audit_eintrag where art=$1", [art])).rows[0].n);
  beforeAll(async () => {
    B = (await db.pool.query("select id from bauteil where gebaeude_id=$1 and katalog_id='heizung.heizkoerper'", [G])).rows[0].id;
    L = (await db.pool.query("select liegenschaft_id from gebaeude where id=$1", [G])).rows[0].liegenschaft_id;
    DOK = randomUUID();
    await db.pool.query(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status)
      values ($1,$2,$3,'e.pdf','k',$4,10,3,$5,'fertig')`, [DOK, G, L, randomUUID(), randomUUID()]);
    V = await neuerVorschlag();
  });
  it("Leser 403, Fremd 404, unbekannt 404", async () => {
    const s = await standG();
    const koerper = { bauteilIds: [B], alsTyppreis: false, stand: s };
    for (const [url, body] of [[`/api/preisdokument/vorschlaege/${V}/uebernehmen`, koerper], [`/api/preisdokument/vorschlaege/${V}/verwerfen`, {}], [`/api/preisdokument/gebaeude/${G}/alle-sicheren`, { stand: s }]] as const) {
      expect((await post(url, kLeser, body)).statusCode).toBe(403);
      expect((await post(url, kFremd, body)).statusCode).toBe(404);
    }
    const unbekannt = randomUUID();
    expect((await post(`/api/preisdokument/vorschlaege/${unbekannt}/uebernehmen`, kBearb, koerper)).statusCode).toBe(404);
    expect((await post(`/api/preisdokument/vorschlaege/${unbekannt}/verwerfen`, kBearb)).statusCode).toBe(404);
    expect((await post(`/api/preisdokument/gebaeude/${randomUUID()}/alle-sicheren`, kBearb, { stand: 0 })).statusCode).toBe(404);
  });
  it("ungueltiger Body -> 400", async () => {
    const u = `/api/preisdokument/vorschlaege/${V}/uebernehmen`;
    expect((await post(u, kBearb, { bauteilIds: ["x"], alsTyppreis: false, stand: 0 })).statusCode).toBe(400);
    expect((await post(u, kBearb, { bauteilIds: [B], alsTyppreis: false, stand: 0, extra: 1 })).statusCode).toBe(400);
    expect((await post(u, kBearb, { bauteilIds: [B], alsTyppreis: false })).statusCode).toBe(400);
    expect((await post(`/api/preisdokument/gebaeude/${G}/alle-sicheren`, kBearb, {})).statusCode).toBe(400);
  });
  it("Uebersicht enthaelt stand", async () => {
    expect((await anfrage("GET", liste(), kBearb)).json().stand).toBe(await standG());
  });
  it("Handeingabe -> 409 mit fehler-Liste; mit Bestaetigung Erfolg inkl. Audit und Antwortform", async () => {
    await db.pool.query("insert into bauteil_akte(bauteil_id, liegenschaft_id, stueckpreis, quelle_preis) values ($1,$2,99,'kunde') on conflict (bauteil_id) do update set stueckpreis=99, quelle_preis='kunde', preis_vorschlag_id=null", [B, L]);
    const s = await standG();
    const u = `/api/preisdokument/vorschlaege/${V}/uebernehmen`;
    const r = await post(u, kBearb, { bauteilIds: [B], alsTyppreis: false, stand: s });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ fehler: [{ code: "handeingabe" }] });
    const vorher = await zaehle("preisdokument.uebernommen");
    const ok = await post(u, kBearb, { bauteilIds: [B], alsTyppreis: false, stand: s, ueberschreibeHandeingabe: true });
    expect(ok.statusCode).toBe(200);
    const j = ok.json();
    expect(j).toMatchObject({ stand: s, darfAendern: true, auslesen: expect.any(String), budget: expect.any(Object) });
    expect(j.dokumente.find((d: any) => d.id === DOK).vorschlaege.find((v: any) => v.id === V)).toMatchObject({ status: "uebernommen", bauteilIds: [B] });
    expect(await zaehle("preisdokument.uebernommen")).toBe(vorher + 1);
    expect((await post(u, kBearb, { bauteilIds: [B], alsTyppreis: false, stand: s })).statusCode).toBe(409);
  });
  it("verwerfen und alle-sicheren: Antwort und Audit", async () => {
    const v = await neuerVorschlag("mittel");
    const vw = await zaehle("preisdokument.verworfen");
    const r = await post(`/api/preisdokument/vorschlaege/${v}/verwerfen`, kBearb);
    expect(r.statusCode).toBe(200);
    expect(r.json().dokumente.find((d: any) => d.id === DOK).vorschlaege.find((x: any) => x.id === v).status).toBe("verworfen");
    expect(await zaehle("preisdokument.verworfen")).toBe(vw + 1);
    const h = await neuerVorschlag("hoch");
    await db.pool.query("delete from bauteil_akte where bauteil_id=$1", [B]);
    const al = await zaehle("preisdokument.alle_sicheren");
    const a = await post(`/api/preisdokument/gebaeude/${G}/alle-sicheren`, kBearb, { stand: await standG() });
    expect(a.statusCode).toBe(200);
    expect(a.json().dokumente.find((d: any) => d.id === DOK).vorschlaege.find((x: any) => x.id === h).status).toBe("uebernommen");
    expect(await zaehle("preisdokument.alle_sicheren")).toBe(al + 1);
    const veraltet = await post(`/api/preisdokument/gebaeude/${G}/alle-sicheren`, kBearb, { stand: (await standG()) + 5 });
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json()).toMatchObject({ fehler: [{ code: "stand_veraltet" }] });
  });
});
