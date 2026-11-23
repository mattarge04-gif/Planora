import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { anfrageMit, legeKontoAn } from "./hilfe-api.js";
import { pdf, xlsx, png, exe, docx } from "./hilfe-dateien.js";
import { baueServer } from "../src/server.js";

const ORIGIN = "http://localhost:3995";
const pw = randomBytes(12).toString("base64url");
const SECRET = randomBytes(32).toString("hex");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
let L1: string, L2: string, kBetr: string, kBearb: string, kLeser: string, kFremd: string;
let G: string, B1: string, B2: string;

const anfrage = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, cookie: string, body?: unknown) => anfrageMit(app, ORIGIN)(method, url, cookie, body);
const konto = (email: string, rolle: string, scopes: string[]) => legeKontoAn(app, db.pool, ORIGIN, pw, email, rolle, scopes);
const ablegen = (cookie: string, daten: Buffer, name = "Datenblatt.pdf", query = "") => app.inject({
  method: "POST", url: `/api/dokumente/gebaeude/${G}${query}`,
  headers: { cookie, origin: ORIGIN, "x-planora-request": "1", "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(name) },
  payload: daten,
});
const liste = (cookie = kBearb) => anfrage("GET", `/api/dokumente/gebaeude/${G}`, cookie);
/** Wartet, bis die Virenpruefung fertig ist (ab Task 3 asynchron). */
async function warteScan(id: string) {
  for (let i = 0; i < 600; i++) {
    const d = (await liste()).json().dokumente.find((x: any) => x.id === id);
    if (d && d.scanStatus !== "quarantaene") return d;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Scan nicht fertig: " + id);
}

beforeAll(async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 4, baseURL: ORIGIN, secret: SECRET, ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  kBearb = await konto("bearb@planora.invalid", "bearbeiter", [L1]);
  kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  kFremd = await konto("fremd@planora.invalid", "leser", [L2]);
  G = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, HUELLE)).json().id;
  const leer = (await anfrage("GET", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb)).json();
  const [eg] = leer.geschosse;
  const put = await anfrage("PUT", `/api/struktur/gebaeude/${G}/beschreibung`, kBearb, { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [{ geschossId: eg.id, bezeichnung: "Buero A", art: "buero", flaecheM2: null }, { geschossId: eg.id, bezeichnung: "Buero B", art: "buero", flaecheM2: null }],
    bauteile: [{ katalogId: "heizung.heizkoerper", standort: { einheitIndex: 0 }, menge: 4, status: "bestaetigt", versorgt: [] },
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 1 }, menge: 2, status: "bestaetigt", versorgt: [] }] });
  expect(put.statusCode).toBe(200);
  [B1, B2] = (await db.pool.query("select id from bauteil where gebaeude_id=$1 and katalog_id='heizung.heizkoerper' order by reihenfolge", [G])).rows.map((r) => r.id);
});
afterAll(async () => { vi.unstubAllEnvs(); await app.close(); await db.ende(); });

describe("Dokumente-API: Ablegen", () => {
  it("PDF ablegen -> 201 mit Art, Kategorie, Seiten; Duplikat 200; sauber nach Pruefung", async () => {
    const daten = pdf(2, "% a");
    const r = await ablegen(kBearb, daten);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ dateiname: "Datenblatt.pdf", art: "pdf", mime: "application/pdf", kategorie: "sonstiges", seiten: 2, groesse: daten.length, bauteilIds: [] });
    const r2 = await ablegen(kBearb, daten, "anders.pdf");
    expect([r2.statusCode, r2.json().id, r2.json().dateiname]).toEqual([200, r.json().id, "Datenblatt.pdf"]);
    expect((await warteScan(r.json().id)).scanStatus).toBe("sauber");
    expect((await db.pool.query("select auslesen_status from dokument where id=$1", [r.json().id])).rows[0].auslesen_status).toBe("aus");
  });
  it("JSON oder leer -> 400", async () => {
    const j = await anfrage("POST", `/api/dokumente/gebaeude/${G}`, kBearb, { a: 1 });
    expect([j.statusCode, j.json()]).toEqual([400, { fehler: "typ_unbekannt" }]);
    const leer = await app.inject({ method: "POST", url: `/api/dokumente/gebaeude/${G}`, headers: { cookie: kBearb, origin: ORIGIN, "x-planora-request": "1" } });
    expect([leer.statusCode, leer.json()]).toEqual([400, { fehler: "leer" }]);
    expect((await ablegen(kBearb, Buffer.from("GIF89a"))).json()).toEqual({ fehler: "typ_unbekannt" });
  });
  it("Dateiname ohne Steuer- und Bidi-Zeichen", async () => {
    const zeichen = [0x01, 0x1f, 0x7f, 0x200e, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069].map((c) => String.fromCharCode(c)).join("");
    const r = await ablegen(kBearb, pdf(1, "% bidi"), `Rechnung${zeichen}fdp.pdf`);
    expect([r.statusCode, r.json().dateiname]).toEqual([201, "Rechnungfdp.pdf"]);
  });
  it("Gebaeude zwischen Zugriffspruefung und Einfuegen geloescht -> 404", async () => {
    const orig = db.pool.query.bind(db.pool);
    const spion = vi.spyOn(db.pool, "query").mockImplementation(((sql: unknown, p?: unknown) =>
      typeof sql === "string" && sql.startsWith("select liegenschaft_id from gebaeude") ? Promise.resolve({ rows: [] }) : orig(sql as string, p as unknown[])) as typeof db.pool.query);
    try {
      expect((await ablegen(kBearb, pdf(1, "% weg"))).statusCode).toBe(404);
    } finally { spion.mockRestore(); }
  });
  it("Leser liest inkl. Bauteile, darf nicht ablegen; Fremd 404", async () => {
    const r = await liste(kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.json().darfAendern).toBe(false);
    expect(r.json().bauteile.map((b: any) => b.id)).toEqual(expect.arrayContaining([B1, B2]));
    expect(r.json().bauteile[0]).toMatchObject({ katalogId: "heizung.heizkoerper", geschoss: "EG", ort: "EG · Buero A" });
    expect((await ablegen(kLeser, pdf(1, "% leser"))).statusCode).toBe(403);
    expect((await liste(kFremd)).statusCode).toBe(404);
    expect((await ablegen(kFremd, pdf(1, "% fremd"))).statusCode).toBe(404);
  });
});

describe("Dokumente-API: Oeffnen, Herunterladen, Loeschen", () => {
  it("PDF inline mit nosniff, download=1 als attachment, Fremd 404", async () => {
    const daten = pdf(1, "% oeffnen");
    const id = (await ablegen(kBearb, daten)).json().id;
    await warteScan(id);
    const r = await anfrage("GET", `/api/dokumente/${id}/datei`, kLeser);
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    expect(String(r.headers["content-disposition"])).toMatch(/^inline/);
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(r.rawPayload, daten)).toBe(0);
    expect(String((await anfrage("GET", `/api/dokumente/${id}/datei?download=1`, kLeser)).headers["content-disposition"])).toMatch(/^attachment/);
    expect((await anfrage("GET", `/api/dokumente/${id}/datei?download=ja`, kLeser)).statusCode).toBe(400);
    expect((await anfrage("GET", `/api/dokumente/${id}/datei`, kFremd)).statusCode).toBe(404);
  });
  it("Loeschen: Leser 403, Bearbeiter 204, Referenz weg, Journal", async () => {
    const id = (await ablegen(kBearb, pdf(1, "% loeschen"))).json().id;
    await warteScan(id);
    const schluessel = (await db.pool.query("select schluessel from dokument where id=$1", [id])).rows[0].schluessel;
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kLeser)).statusCode).toBe(403);
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(204);
    expect((await liste()).json().dokumente.some((d: any) => d.id === id)).toBe(false);
    expect((await db.pool.query("select 1 from datei_referenz where objekt=$1", [`dokument:${id}`])).rowCount).toBe(0);
    expect((await db.pool.query("select 1 from loesch_journal where art='datei.loeschen' and ziel=$1", [schluessel])).rowCount).toBeGreaterThan(0);
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(404);
  });
});

describe("Dokumente-API: Typen", () => {
  it("Excel -> office, attachment auch ohne download", async () => {
    const r = await ablegen(kBearb, xlsx(), "Kosten.xlsx");
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ art: "office", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kategorie: "sonstiges", seiten: null });
    await warteScan(r.json().id);
    const f = await anfrage("GET", `/api/dokumente/${r.json().id}/datei`, kLeser);
    expect(String(f.headers["content-disposition"])).toMatch(/^attachment/);
    expect(f.headers["x-content-type-options"]).toBe("nosniff");
  });
  it("falsche Endung: PNG als .pdf -> bild/foto, inline image/png", async () => {
    const r = await ablegen(kBearb, png("a"), "foto.pdf");
    expect(r.json()).toMatchObject({ dateiname: "foto.pdf", art: "bild", mime: "image/png", kategorie: "foto" });
    await warteScan(r.json().id);
    const f = await anfrage("GET", `/api/dokumente/${r.json().id}/datei`, kLeser);
    expect([f.headers["content-type"], String(f.headers["content-disposition"]).startsWith("inline")]).toEqual(["image/png", true]);
  });
  it("EXE als .pdf und Makro-Datei -> 400", async () => {
    expect((await ablegen(kBearb, exe(), "rechnung.pdf")).json()).toEqual({ fehler: "typ_unbekannt" });
    expect((await ablegen(kBearb, docx("word/vbaProject.bin"), "brief.docx")).json()).toEqual({ fehler: "makro" });
  });
  it("Kategorie beim Ablegen; ungueltige Kategorie 400", async () => {
    expect((await ablegen(kBearb, pdf(1, "% offerte"), "o.pdf", "?kategorie=offerte")).json().kategorie).toBe("offerte");
    expect((await ablegen(kBearb, pdf(1, "% x"), "o.pdf", "?kategorie=rechnung")).statusCode).toBe(400);
  });
});
