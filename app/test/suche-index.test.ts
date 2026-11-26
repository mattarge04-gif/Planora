import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { starteTestServer } from "./hilfe-suche.js";
import { docxText, pdfBombe, pdfText, png, zip } from "./hilfe-dateien.js";
import { AUSLESEN_FEHLER_TEXT, GEKUERZT_TEXT, ZU_VIEL_TEXT, erzeugeIndexierer } from "../src/suche/indexierer.js";
import { MAX_ABSCHNITTE, MAX_PDF_SEITEN } from "../src/suche/auslesen.js";
import { schalteAus, schalteEin } from "../src/module/schalter.js";

let t: Awaited<ReturnType<typeof starteTestServer>>;
const abschnitte = async (id: string) => (await t.db.pool.query("select nr, ort_art, ort, text from dokument_abschnitt where dokument_id=$1 order by nr", [id])).rows;
const grund = async (id: string) => (await t.db.pool.query("select text_grund from dokument where id=$1", [id])).rows[0].text_grund;
const fertig = (id: string) => t.warte(id, (z) => z.scanStatus === "sauber" && z.textStatus !== "offen");

beforeAll(async () => { t = await starteTestServer(3992); });
afterAll(async () => { await t.ende(); });

describe("Indexierer", () => {
  it("PDF nach sauberem Scan: Dateiname + eine Zeile je Seite", async () => {
    const id = (await t.ablegen(pdfText(["Datenblatt Wärmepumpe", "Heizleistung 12.4 kW"]), "Datenblatt_WP.pdf")).json().id;
    expect((await fertig(id)).textStatus).toBe("fertig");
    const a = await abschnitte(id);
    expect(a.map((x) => [x.nr, x.ort_art, x.ort])).toEqual([[0, "name", 0], [1, "seite", 1], [2, "seite", 2]]);
    expect(a[0].text).toBe("Datenblatt WP");
    expect(a[2].text).toContain("Heizleistung 12.4 kW");
    expect(await grund(id)).toBeNull();
  });
  it("Bild: ohne_text, nur der Name", async () => {
    const id = (await t.ablegen(png("ix"), "Foto Zentrale.png")).json().id;
    expect((await fertig(id)).textStatus).toBe("ohne_text");
    expect((await abschnitte(id)).map((x) => x.text)).toEqual(["Foto Zentrale"]);
  });
  it("defektes docx: fehler mit festem Text, Dokument bleibt nutzbar", async () => {
    const id = (await t.ablegen(zip(["[Content_Types].xml", "word/x.xml"]), "kaputt.docx")).json().id;
    const z = await fertig(id);
    expect(z.textStatus).toBe("fehler");
    expect(await grund(id)).toBe(AUSLESEN_FEHLER_TEXT);
    expect(z.scanStatus).toBe("sauber");
    expect((await abschnitte(id)).length).toBe(1); // Name bleibt findbar
  });
  it("zu viele Abschnitte: fehler ZU_VIEL_TEXT, nur der Name", async () => {
    const absaetze = Array.from({ length: MAX_ABSCHNITTE + 1 }, (_, i) => `Absatz ${i} ${"x".repeat(1000)}`);
    const id = (await t.ablegen(docxText(absaetze), "Riesig.docx")).json().id;
    expect((await fertig(id)).textStatus).toBe("fehler");
    expect(await grund(id)).toBe(ZU_VIEL_TEXT);
    expect((await abschnitte(id)).map((x) => x.text)).toEqual(["Riesig"]);
  });
  it("PDF ueber der Seitengrenze: fertig, aber mit Hinweis im Grund", async () => {
    const id = (await t.ablegen(pdfText(Array.from({ length: MAX_PDF_SEITEN + 1 }, (_, i) => `Seite ${i + 1}`)), "Handbuch.pdf")).json().id;
    expect((await fertig(id)).textStatus).toBe("fertig");
    expect(await grund(id)).toBe(GEKUERZT_TEXT);
    expect((await abschnitte(id)).length).toBe(MAX_PDF_SEITEN + 1);
  });
  it("Flate-Bombe im PDF: fehler mit lesbarem Grund, API bleibt am Leben", async () => {
    const id = (await t.ablegen(await pdfBombe(2048), "Bombe.pdf")).json().id;
    expect((await fertig(id)).textStatus).toBe("fehler");
    expect(await grund(id)).toBe(AUSLESEN_FEHLER_TEXT);
    expect((await abschnitte(id)).map((x) => x.text)).toEqual(["Bombe"]);
    expect((await t.anfrage("GET", `/api/dokumente/gebaeude/${t.ids.G}`, t.kBearb)).statusCode).toBe(200);
  }, 60_000);
  it("Modul aus: bleibt offen; Nachholen nach dem Einschalten", async () => {
    await schalteAus(t.db.pool, "suche", randomUUID());
    const id = (await t.ablegen(pdfText(["Spaeter gelesen"]), "spaeter.pdf")).json().id;
    await t.warte(id, (z) => z.scanStatus === "sauber");
    await new Promise((r) => setTimeout(r, 300));
    expect((await t.db.pool.query("select text_status from dokument where id=$1", [id])).rows[0].text_status).toBe("offen");
    await schalteEin(t.db.pool, "suche", 4, randomUUID());
    const ix = erzeugeIndexierer(t.db.pool, t.app.ablage);
    expect(await ix.reiheNeuEin()).toBeGreaterThanOrEqual(1);
    await ix.warteLeer();
    expect((await t.db.pool.query("select text_status from dokument where id=$1", [id])).rows[0].text_status).toBe("fertig");
  });
  it("beende(): laufendes Kind wird beendet, Dokument bleibt offen", async () => {
    await schalteAus(t.db.pool, "suche", randomUUID());
    const id = (await t.ablegen(pdfText(["Beim Schliessen"]), "schliessen.pdf")).json().id;
    await t.warte(id, (z) => z.scanStatus === "sauber");
    await schalteEin(t.db.pool, "suche", 4, randomUUID());
    const ix = erzeugeIndexierer(t.db.pool, t.app.ablage);
    ix.starte(id);
    await new Promise((r) => setTimeout(r, 300)); // Kind laeuft (Start unter tsx ~1 s)
    const start = Date.now();
    ix.beende();
    await ix.warteLeer();
    expect(Date.now() - start).toBeLessThan(2000);
    expect((await t.db.pool.query("select text_status from dokument where id=$1", [id])).rows[0].text_status).toBe("offen");
    const ix2 = erzeugeIndexierer(t.db.pool, t.app.ablage); // danach (Neustart) wird es nachgeholt
    await ix2.reiheNeuEin(); await ix2.warteLeer();
    expect((await t.db.pool.query("select text_status from dokument where id=$1", [id])).rows[0].text_status).toBe("fertig");
  });
  it("Loeschen durch den Bearbeiter entfernt die Abschnitte", async () => {
    const id = (await t.ablegen(pdfText(["Weg damit"]), "weg.pdf")).json().id;
    await fertig(id);
    expect((await abschnitte(id)).length).toBe(2);
    expect((await t.anfrage("DELETE", `/api/dokumente/${id}`, t.kBearb)).statusCode).toBe(204);
    expect((await abschnitte(id)).length).toBe(0);
  });
});
