import { describe, it, expect } from "vitest";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { AuslesenFehler, docxTeile, liesText, liesTextBegrenzt, nameText, pdfTeile, teileAbschnitte, xlsxTeile, ABSCHNITT_ZEICHEN, MAX_ABSCHNITTE, MAX_PDF_SEITEN } from "../src/suche/auslesen.js";
import { MIME, zipLies, zipVerzeichnis } from "../src/dokumente/typ.js";
import { docxText, pdfBombe, pdfText, png, pptx, xlsxText, zip } from "./hilfe-dateien.js";

describe("ZIP-Eintraege lesen", () => {
  it("gespeichert und deflate, Grenze und Formfehler -> null", () => {
    const d = zip(["a.xml"], { "a.xml": "Hallo Wärme" }, true);
    const e = zipVerzeichnis(d)![0];
    expect([e.name, e.methode, e.groesse]).toEqual(["a.xml", 8, Buffer.byteLength("Hallo Wärme")]);
    expect(zipLies(d, e, 1000)!.toString("utf8")).toBe("Hallo Wärme");
    expect(zipLies(d, e, 5)).toBeNull(); // groesser als max
    const g = zip(["b.xml"], { "b.xml": "roh" });
    expect(zipLies(g, zipVerzeichnis(g)![0], 100)!.toString()).toBe("roh");
    expect(zipLies(g, { ...zipVerzeichnis(g)![0], methode: 12 }, 100)).toBeNull(); // unbekannte Methode
    expect(zipLies(g, { ...zipVerzeichnis(g)![0], offset: 3 }, 100)).toBeNull();   // kein lokaler Kopf
    expect(zipLies(d, { ...e, groesse: 3 }, 1000)).toBeNull(); // entpackt laenger als angegeben (Zip-Bombe)
  });
});

describe("Text auslesen", () => {
  it("PDF: Text je Seite, Umlaute und Zeilen", async () => {
    const t = await pdfTeile(pdfText(["Datenblatt Wärmepumpe", "Heizleistung 12.4 kW\nKältemittel R290"]));
    expect(t.map((x) => [x.ortArt, x.ort])).toEqual([["seite", 1], ["seite", 2]]);
    expect(t[0].text).toContain("Wärmepumpe");
    expect(t[1].text).toContain("Heizleistung 12.4 kW");
    expect(t[1].text).toContain("Kältemittel R290");
  });
  it("PDF ohne Text -> ohne_text; kaputtes PDF -> AuslesenFehler", async () => {
    expect(await liesText(pdfText(["", ""]), "application/pdf")).toEqual({ status: "ohne_text", teile: [] });
    await expect(liesText(Buffer.from("%PDF-1.7 kaputt"), "application/pdf")).rejects.toBeInstanceOf(AuslesenFehler);
  });
  it("PDF ueber der Seitengrenze: erste Seiten gelesen, als gekuerzt gemeldet", async () => {
    const r = await liesText(pdfText(Array.from({ length: MAX_PDF_SEITEN + 1 }, (_, i) => `Seite ${i + 1}`)), "application/pdf");
    expect([r.status, r.teile.length, r.gekuerzt]).toEqual(["fertig", MAX_PDF_SEITEN, true]);
    expect((await liesText(pdfText(["kurz"]), "application/pdf")).gekuerzt).toBeUndefined();
  });
  it("docx: Absaetze, Entities, Gruppen", () => {
    const t = docxTeile(docxText(["Wartungsvertrag", "Reaktionszeit 4 Stunden & mehr", "Kündigung <3 Monate>"]));
    expect(t).toEqual([{ ortArt: "absatz", ort: 1, text: "Wartungsvertrag\nReaktionszeit 4 Stunden & mehr\nKündigung <3 Monate>" }]);
    const lang = docxTeile(docxText(Array.from({ length: 30 }, (_, i) => `Absatz ${i} ${"x".repeat(100)}`)));
    expect(lang.length).toBeGreaterThan(1);
    expect(lang.every((x) => x.text.length <= ABSCHNITT_ZEICHEN)).toBe(true);
    expect(() => docxTeile(zip(["[Content_Types].xml", "word/x.xml"]))).toThrow(AuslesenFehler);
  });
  it("xlsx: Blattname aus workbook.xml, geteilte, Inline- und Zahlenzellen", () => {
    const t = xlsxTeile(xlsxText([[["Anlage", "#0"], ["Pumpe", "2019"]], [["Wärmezähler Nord", "4711"]]], ["Baujahr"], ["Anlagen", "Zähler & Co"]));
    expect(t).toEqual([{ ortArt: "blatt", ort: 1, text: "Anlagen\nAnlage | Baujahr\nPumpe | 2019" }, { ortArt: "blatt", ort: 2, text: "Zähler & Co\nWärmezähler Nord | 4711" }]);
  });
  it("xlsx: Reihenfolge laut Workbook, nicht nach Dateinummer", () => {
    const blatt = (s: string) => `<worksheet><sheetData><row><c t="inlineStr"><is><t>${s}</t></is></c></row></sheetData></worksheet>`;
    const d = zip(["[Content_Types].xml", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"], {
      "xl/workbook.xml": `<workbook><sheets><sheet name="Übersicht" sheetId="2" r:id="rId2"/><sheet name="Daten" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
      "xl/worksheets/sheet1.xml": blatt("eins"), "xl/worksheets/sheet2.xml": blatt("zwei") }, true);
    expect(xlsxTeile(d)).toEqual([{ ortArt: "blatt", ort: 1, text: "Übersicht\nzwei" }, { ortArt: "blatt", ort: 2, text: "Daten\neins" }]);
  });
  it("boesartiges XML (viele offene Tags) laeuft in linearer Zeit", () => {
    const viel = "<c ".repeat(300_000) + "<w:t " .repeat(300_000);
    const start = Date.now();
    xlsxTeile(zip(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"], { "xl/worksheets/sheet1.xml": `<row>${viel}` }, true));
    docxTeile(zip(["[Content_Types].xml", "word/document.xml"], { "word/document.xml": `<w:p>${viel.replace(/<c /g, "<w:t ")}` }, true));
    expect(Date.now() - start).toBeLessThan(3000);
  });
  it("Bild und pptx -> ohne_text; docx/xlsx ueber den MIME-Typ", async () => {
    expect(await liesText(png(), "image/png")).toEqual({ status: "ohne_text", teile: [] });
    expect(await liesText(pptx(), MIME.pptx)).toEqual({ status: "ohne_text", teile: [] });
    expect((await liesText(docxText(["Hallo"]), MIME.docx)).status).toBe("fertig");
    expect((await liesText(xlsxText([[["A"]]]), MIME.xlsx)).status).toBe("fertig");
  });
  it("Abschnitte: lange Seite in Stuecke mit Ueberlappung, leere weg, Steuerzeichen weg", () => {
    const wort = "Wärme ";
    const a = teileAbschnitte([{ ortArt: "seite", ort: 3, text: wort.repeat(600) }, { ortArt: "seite", ort: 4, text: " \u0002 " }]);
    expect(a.length).toBe(3);
    expect(a.every((x) => x.ortArt === "seite" && x.ort === 3 && x.text.length <= ABSCHNITT_ZEICHEN)).toBe(true);
    expect(a[1].text.startsWith("Wärme")).toBe(true); // Schnitt am Leerzeichen
  });
  it("Abschnitte: linear ohne Leerzeichen, Abbruch nach MAX_ABSCHNITTE", () => {
    let start = Date.now();
    const a = teileAbschnitte([{ ortArt: "seite", ort: 1, text: "x".repeat(2_900_000) }]);
    expect(Date.now() - start).toBeLessThan(300); // vorher quadratisch: ~640 ms
    expect(a.length).toBe(Math.ceil(2_900_000 / ABSCHNITT_ZEICHEN));
    start = Date.now();
    expect(teileAbschnitte([{ ortArt: "seite", ort: 1, text: "Wärme ".repeat(3_000_000) }]).length).toBe(MAX_ABSCHNITTE + 1);
    expect(Date.now() - start).toBeLessThan(1000);
  });
  it("xlsx: phonetische Lesehilfen <rPh> gehoeren nicht zum Text", () => {
    const d = zip(["[Content_Types].xml", "xl/workbook.xml", "xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"], {
      "xl/sharedStrings.xml": `<sst><si><t>東京</t><rPh sb="0" eb="2"><t>トウキョウ</t></rPh></si><si><t>B</t><rPh><t>offen</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>` }, true);
    expect(xlsxTeile(d)).toEqual([{ ortArt: "blatt", ort: 1, text: "東京 | B" }]);
  });
  it("gekuerzt auch ohne Text gemeldet", async () => {
    expect(await liesText(pdfText(Array.from({ length: MAX_PDF_SEITEN + 1 }, () => "")), "application/pdf")).toEqual({ status: "ohne_text", teile: [], gekuerzt: true });
  });
  it("Dateiname als Text", () => {
    expect(nameText("Datenblatt_WP-Vitocal.250.pdf")).toBe("Datenblatt WP Vitocal 250");
    expect(nameText(".pdf")).toBe(".pdf");
  });
});

describe("Auslesen im Kindprozess", () => {
  const beendet = (k: ChildProcess) => k.exitCode !== null || k.signalCode !== null ? Promise.resolve() : once(k, "exit");
  it("liefert fertige Abschnitte; Fehler bleiben AuslesenFehler; Kind endet", async () => {
    let kind: ChildProcess | undefined;
    const r = await liesTextBegrenzt(pdfText(["Datenblatt Wärmepumpe"]), "application/pdf", { aufKind: (k) => { kind = k; } });
    expect(r).toEqual({ status: "fertig", teile: [{ ortArt: "seite", ort: 1, text: "Datenblatt Wärmepumpe" }] });
    await beendet(kind!);
    await expect(liesTextBegrenzt(docxText(["x"]).subarray(0, 40), MIME.docx)).rejects.toBeInstanceOf(AuslesenFehler);
  });
  it("16 MB Text ohne Leerzeichen: in der Zeitgrenze, Abbruch nach MAX_ABSCHNITTE", async () => {
    const d = docxText(["x".repeat(15 * 1024 * 1024)]);
    const r = await liesTextBegrenzt(d, MIME.docx, { zeitMs: 20_000 });
    expect(r.teile.length).toBe(MAX_ABSCHNITTE + 1);
    expect(r.teile.every((t) => t.text.length === ABSCHNITT_ZEICHEN)).toBe(true);
  });
  it("Zeitlimit: beschaeftigtes Kind wird beendet, Fehler 'zeit'", async () => {
    let kind: ChildProcess | undefined;
    const e = await liesTextBegrenzt(await bombe(), "application/pdf", { zeitMs: 1500, rssMb: 100_000, aufKind: (k) => { kind = k; } }).catch((x) => x);
    expect(e).toBeInstanceOf(AuslesenFehler);
    expect(e.message).toBe("zeit");
    await beendet(kind!);
    expect(kind!.signalCode ?? kind!.exitCode).not.toBeNull();
  });
  it("Flate-Bombe: Speichergrenze beendet das Kind, dieser Prozess bleibt klein", async () => {
    const vorher = process.memoryUsage.rss();
    const e = await liesTextBegrenzt(await bombe(), "application/pdf", { zeitMs: 50_000 }).catch((x) => x);
    expect(e).toBeInstanceOf(AuslesenFehler);
    expect(["speicher", "abbruch"]).toContain(e.message); // Linux: Elternwaechter, sonst Waechter im Kind
    expect(process.memoryUsage.rss() - vorher).toBeLessThan(200 * 1024 * 1024);
  }, 60_000);
});

let bombeCache: Buffer | undefined;
const bombe = async () => (bombeCache ??= await pdfBombe(2048));
