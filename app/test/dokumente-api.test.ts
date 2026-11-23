import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { anfrageMit, legeKontoAn } from "./hilfe-api.js";
import { pdf, xlsx, png, exe, docx } from "./hilfe-dateien.js";
import { Readable } from "node:stream";
import { dateiAblage } from "../src/ablage/ablage.js";
import { baueServer } from "../src/server.js";
import { EICAR, fakeScanner } from "../src/dokumente/scanner.js";
import { ergaenzeVerknuepfungen } from "../src/dokumente/speicher.js";

const ORIGIN = "http://localhost:3995";
const pw = randomBytes(12).toString("base64url");
const SECRET = randomBytes(32).toString("hex");
const HUELLE = { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };
let ausfall = false;
const scanner = fakeScanner({ ausfall: () => ausfall });
let WURZEL: string;
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
  app = await baueServer({ pool: db.pool, stufe: 4, baseURL: ORIGIN, secret: SECRET, ablageWurzel: (WURZEL = mkdtempSync(join(tmpdir(), "ablage-"))), virenScanner: scanner });
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
    expect(r.json().scanStatus).toBe("quarantaene");
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

describe("Dokumente-API: Loeschrennen", () => {
  it("paralleles Loeschen war schneller -> 404 ohne Audit", async () => {
    const id = (await ablegen(kBearb, pdf(1, "% rennen"), "Rennen.pdf")).json().id;
    await warteScan(id);
    // Trigger ueberspringt das Loeschen (Zeile "verschwindet" fuer diese Abfrage wie bei einem parallelen Delete).
    await db.pool.query("create function t2_ueberspringe() returns trigger language plpgsql as 'begin return null; end'");
    await db.pool.query(`create trigger t2_rennen before delete on dokument for each row when (old.id = '${id}') execute function t2_ueberspringe()`);
    try {
      const vorher = (await db.pool.query("select count(*)::int n from audit_eintrag where art='dokument.geloescht'")).rows[0].n;
      expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(404);
      expect((await db.pool.query("select count(*)::int n from audit_eintrag where art='dokument.geloescht'")).rows[0].n).toBe(vorher);
    } finally {
      await db.pool.query("drop trigger t2_rennen on dokument");
      await db.pool.query("drop function t2_ueberspringe()");
    }
  });
});

describe("Dokumente-API: Virenpruefung", () => {
  const roh = async (status: string, grund: string | null = null, schluessel = "k") => (await db.pool.query(
    `insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, scan_status, scan_grund)
     values ($1,$2,'r.pdf',$3,$4,10,1,$5,$6,$7) returning id`, [G, L1, schluessel, String(Math.random()), L1, status, grund])).rows[0].id as string;
  it("nicht sauber liefert nie Bytes, auch nicht an den Admin", async () => {
    const kAdmin = await konto("admin@planora.invalid", "admin", [L1]);
    for (const s of ["quarantaene", "abgelehnt", "scan_fehler"]) {
      const id = await roh(s, s === "quarantaene" ? null : "X");
      for (const k of [kBearb, kAdmin]) {
        const r = await anfrage("GET", `/api/dokumente/${id}/datei`, k);
        expect([r.statusCode, r.json()]).toEqual([409, { fehler: "nicht_sauber" }]);
      }
    }
  });
  it("EICAR in einer PDF-Huelle -> abgelehnt mit Signatur", async () => {
    const r = await ablegen(kBearb, Buffer.concat([pdf(1, "% eicar"), Buffer.from(EICAR)]), "eicar.pdf");
    expect(r.statusCode).toBe(201);
    expect(await warteScan(r.json().id)).toMatchObject({ scanStatus: "abgelehnt", scanGrund: "Eicar-Test-Signature" });
  });
  it("Ausfall -> scan_fehler; erneut pruefen nur mit Schreibrecht; danach sauber", async () => {
    ausfall = true;
    const id = (await ablegen(kBearb, pdf(1, "% ausfall"))).json().id;
    expect((await warteScan(id)).scanStatus).toBe("scan_fehler");
    ausfall = false;
    expect((await anfrage("POST", `/api/dokumente/${id}/erneut-pruefen`, kLeser, {})).statusCode).toBe(403);
    const r = await anfrage("POST", `/api/dokumente/${id}/erneut-pruefen`, kBearb, {});
    expect([r.statusCode, r.json().scanStatus]).toEqual([202, "quarantaene"]);
    expect((await warteScan(id)).scanStatus).toBe("sauber");
    expect((await anfrage("POST", `/api/dokumente/${id}/erneut-pruefen`, kBearb, {})).json()).toEqual({ fehler: "nicht_scan_fehler" });
  });
  it("Loeschen in Quarantaene: Zeile weg, Quarantaene-Kopie weg, Audit", async () => {
    const x = await dateiAblage(join(WURZEL, "quarantaene")).schreibeNeu(Readable.from(pdf(1, "% quarantaenekopie")));
    const id = await roh("scan_fehler", "X", x.schluessel);
    const q = dateiAblage(join(WURZEL, "quarantaene"));
    expect(await q.existiert(x.schluessel)).toBe(true);
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(204);
    expect((await db.pool.query("select 1 from dokument where id=$1", [id])).rowCount).toBe(0);
    expect(await q.existiert(x.schluessel)).toBe(false);
    expect((await db.pool.query("select 1 from audit_eintrag where art='dokument.geloescht' and daten->>'dokumentId'=$1", [id])).rowCount).toBe(1);
  });
});

describe("baueServer: Scanner und Hintergrund", () => {
  const basis = () => ({ pool: db.pool, stufe: 2 as const, baseURL: ORIGIN, secret: SECRET, ablageWurzel: WURZEL });
  it("ohne Scanner und ohne clamd-Konfiguration wirft baueServer (kein stiller Fake)", async () => {
    vi.stubEnv("PLANORA_CLAMD_HOST", "");
    await expect(baueServer(basis())).rejects.toThrow(/PLANORA_CLAMD_HOST/);
  });
  it("hintergrund:false (Smoke) baut ohne Scanner und reiht nichts ein", async () => {
    vi.stubEnv("PLANORA_CLAMD_HOST", "");
    const x = await dateiAblage(join(WURZEL, "quarantaene")).schreibeNeu(Readable.from(pdf(1, "% smoke")));
    const id = (await db.pool.query(`insert into dokument(gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, scan_status)
      values ($1,$2,'s.pdf',$3,$4,10,1,$5,'quarantaene') returning id`, [G, L1, x.schluessel, x.sha256, L1])).rows[0].id;
    const smoke = await baueServer({ ...basis(), hintergrund: false });
    await new Promise((r) => setTimeout(r, 300));
    await smoke.close();
    expect((await db.pool.query("select scan_status from dokument where id=$1", [id])).rows[0].scan_status).toBe("quarantaene");
  });
});

describe("Dokumente-API: Verknuepfen und Kategorie", () => {
  let D: string, B_FREMD: string;
  beforeAll(async () => {
    D = (await ablegen(kBearb, pdf(2, "% verkn"), "Pumpe.pdf")).json().id;
    await warteScan(D);
    const G2 = (await anfrage("POST", `/api/struktur/liegenschaften/${L1}/gebaeude`, kBetr, { ...HUELLE, name: "Haus 2" })).json().id;
    const gs = (await db.pool.query("select id from geschoss where gebaeude_id=$1 order by reihenfolge limit 1", [G2])).rows[0].id;
    B_FREMD = (await db.pool.query("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',$3,'bestaetigt',0) returning id", [L1, G2, gs])).rows[0].id;
  });
  it("setzen, ersetzen, leeren; Leser 403; fremdes Bauteil 400", async () => {
    const put = (ids: string[], k = kBearb) => anfrage("PUT", `/api/dokumente/${D}/bauteile`, k, { bauteilIds: ids });
    expect((await put([B1, B2])).json().bauteilIds.sort()).toEqual([B1, B2].sort());
    expect((await put([B2])).json().bauteilIds).toEqual([B2]);
    expect((await liste()).json().dokumente.find((d: any) => d.id === D).bauteilIds).toEqual([B2]);
    expect((await put([B1], kLeser)).statusCode).toBe(403);
    const f = await put([B_FREMD]);
    expect([f.statusCode, f.json().fehler[0].code]).toEqual([400, "bauteil_unbekannt"]);
    expect((await put([])).json().bauteilIds).toEqual([]);
    expect((await anfrage("PUT", `/api/dokumente/${D}/bauteile`, kBearb, { bauteilIds: ["x"] })).statusCode).toBe(400);
  });
  it("nur bei sauber; Ablegen mit ?bauteile verknuepft sofort", async () => {
    ausfall = true;
    const r = await ablegen(kBearb, pdf(1, "% sofort"), "Sofort.pdf", `?bauteile=${B1},${B2}`);
    expect(r.json().bauteilIds.sort()).toEqual([B1, B2].sort());
    await warteScan(r.json().id);
    ausfall = false;
    const p = await anfrage("PUT", `/api/dokumente/${r.json().id}/bauteile`, kBearb, { bauteilIds: [B1] });
    expect([p.statusCode, p.json().fehler[0].code]).toEqual([409, "nicht_sauber"]);
    expect((await ablegen(kBearb, pdf(1, "% fremd2"), "F.pdf", `?bauteile=${B_FREMD}`)).statusCode).toBe(400);
    expect((await ablegen(kBearb, pdf(1, "% fremd3"), "F.pdf", `?bauteile=${"-".repeat(36)}`)).statusCode).toBe(400);
  });
  it("Duplikat mit ?bauteile ergaenzt Verknuepfungen (Vereinigung); Befund entfernt sie", async () => {
    const daten = pdf(1, "% dup");
    const a = await ablegen(kBearb, daten, "Dup.pdf", `?bauteile=${B1}`);
    expect([a.statusCode, a.json().bauteilIds]).toEqual([201, [B1]]);
    await warteScan(a.json().id);
    const b = await ablegen(kBearb, daten, "Dup.pdf", `?bauteile=${B2}`);
    expect([b.statusCode, b.json().id, b.json().bauteilIds.sort()]).toEqual([200, a.json().id, [B1, B2].sort()]);
    const v = (await ablegen(kBearb, Buffer.concat([pdf(1, "% vir"), Buffer.from(EICAR)]), "v.pdf", `?bauteile=${B1}`)).json().id;
    expect((await warteScan(v)).scanStatus).toBe("abgelehnt");
    expect((await db.pool.query("select 1 from dokument_bauteil where dokument_id=$1", [v])).rowCount).toBe(0);
  });
  it("Bauteil geloescht -> Verknuepfung weg", async () => {
    const tmp = (await db.pool.query("insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, geschoss_id, status, reihenfolge) values ($1,$2,'heizung.verteiler',(select id from geschoss where gebaeude_id=$2 order by reihenfolge limit 1),'bestaetigt',99) returning id", [L1, G])).rows[0].id;
    expect((await anfrage("PUT", `/api/dokumente/${D}/bauteile`, kBearb, { bauteilIds: [tmp] })).json().bauteilIds).toEqual([tmp]);
    await db.pool.query("delete from bauteil where id=$1", [tmp]);
    expect((await liste()).json().dokumente.find((d: any) => d.id === D).bauteilIds).toEqual([]);
  });
  it("Kategorie aendern; ungueltig 400; abgelehnt 409", async () => {
    const r = await anfrage("PUT", `/api/dokumente/${D}/kategorie`, kBearb, { kategorie: "datenblatt" });
    expect([r.statusCode, r.json().kategorie]).toEqual([200, "datenblatt"]);
    expect((await anfrage("PUT", `/api/dokumente/${D}/kategorie`, kBearb, { kategorie: "rechnung" })).statusCode).toBe(400);
    expect((await anfrage("PUT", `/api/dokumente/${D}/kategorie`, kLeser, { kategorie: "plan" })).statusCode).toBe(403);
    const ab = (await ablegen(kBearb, Buffer.concat([pdf(1, "% ab"), Buffer.from(EICAR)]), "a.pdf")).json().id;
    await warteScan(ab);
    expect((await anfrage("PUT", `/api/dokumente/${ab}/kategorie`, kBearb, { kategorie: "plan" })).json()).toEqual({ fehler: "abgelehnt" });
  });
  it("Loeschen: Verknuepfungen weg, uebernommener Preis behaelt Quelle dokument", async () => {
    const id = (await ablegen(kBearb, pdf(1, "% preis"), "Offerte.pdf")).json().id;
    await warteScan(id);
    await anfrage("PUT", `/api/dokumente/${id}/bauteile`, kBearb, { bauteilIds: [B1] });
    const v = (await db.pool.query(`insert into preis_vorschlag(dokument_id, reihenfolge, position, seite, zitat, ersatzpreis, rechenweg, katalog_id, bauteil_ids, sicherheit, status)
      values ($1,0,'HK',1,'z',250,'r','heizung.heizkoerper',$2,'hoch','uebernommen') returning id`, [id, [B1]])).rows[0].id;
    await db.pool.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, stueckpreis, quelle_preis, preis_vorschlag_id) values ($1,$2,250,'dokument',$3)
      on conflict (bauteil_id) do update set stueckpreis=250, quelle_preis='dokument', preis_vorschlag_id=$3`, [B1, L1, v]);
    expect((await anfrage("DELETE", `/api/dokumente/${id}`, kBearb)).statusCode).toBe(204);
    expect((await db.pool.query("select 1 from dokument_bauteil where dokument_id=$1", [id])).rowCount).toBe(0);
    expect((await db.pool.query("select stueckpreis, quelle_preis, preis_vorschlag_id from bauteil_akte where bauteil_id=$1", [B1])).rows[0])
      .toEqual({ stueckpreis: "250.00", quelle_preis: "dokument", preis_vorschlag_id: null });
  });
});

describe("Dokumente-API: Duplikat-Verknuepfung Rennen und FK", () => {
  it("abgelehntes Dokument bekommt keine Verknuepfung (ergaenzeVerknuepfungen und Duplikat-Upload)", async () => {
    const daten = pdf(1, "% rennen");
    const id = (await ablegen(kBearb, daten, "R.pdf")).json().id;
    await warteScan(id);
    await db.pool.query("update dokument set scan_status='abgelehnt' where id=$1", [id]);
    const c = await db.pool.connect();
    try { await ergaenzeVerknuepfungen(c, id, [B1]); } finally { c.release(); }
    expect((await db.pool.query("select 1 from dokument_bauteil where dokument_id=$1", [id])).rowCount).toBe(0);
    const d = await ablegen(kBearb, daten, "R.pdf", `?bauteile=${B1}`);
    expect([d.statusCode, d.json().bauteilIds]).toEqual([200, []]);
  });
  it("FK-Verletzung bei geloeschtem Bauteil -> 400 bauteil_unbekannt", async () => {
    const c = await db.pool.connect();
    try {
      const id = (await ablegen(kBearb, pdf(1, "% fk"), "FK.pdf")).json().id;
      await expect(ergaenzeVerknuepfungen(c, id, ["00000000-0000-4000-8000-000000000000"])).rejects.toMatchObject({ status: 400 });
    } finally { c.release(); }
  });
});
