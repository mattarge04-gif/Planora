import { describe, it, expect } from "vitest";
import { erkenneTyp, startKategorie, MAX_BYTES, zipNamen, oleNamen } from "../src/dokumente/typ.js";
import { pdf, docx, xlsx, pptx, ole, png, jpg, heic, exe, zip } from "./hilfe-dateien.js";

const typ = (d: Buffer) => { const r = erkenneTyp(d); return r.ok ? [r.typ.art, r.typ.mime] : r.grund; };
describe("erkenneTyp", () => {
  it("PDF, Bilder", () => {
    expect(typ(pdf())).toEqual(["pdf", "application/pdf"]);
    expect(typ(jpg())).toEqual(["bild", "image/jpeg"]);
    expect(typ(png())).toEqual(["bild", "image/png"]);
    expect(typ(heic())).toEqual(["bild", "image/heic"]);
    expect(typ(heic("mif1"))).toEqual(["bild", "image/heic"]);
    expect(typ(heic("avif"))).toBe("typ_unbekannt");
  });
  it("Office neu und alt", () => {
    expect(typ(docx())).toEqual(["office", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
    expect(typ(xlsx())).toEqual(["office", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
    expect(typ(pptx())).toEqual(["office", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
    expect(typ(ole(["WordDocument"]))).toEqual(["office", "application/msword"]);
    expect(typ(ole(["Workbook"]))).toEqual(["office", "application/vnd.ms-excel"]);
    expect(typ(ole(["PowerPoint Document"]))).toEqual(["office", "application/vnd.ms-powerpoint"]);
  });
  it("Makros, fremde Container, EXE, Text", () => {
    expect(typ(docx("word/vbaProject.bin"))).toBe("makro");
    expect(typ(ole(["Workbook", "_VBA_PROJECT_CUR", "VBA"]))).toBe("makro");
    expect(typ(ole(["SummaryInformation"]))).toBe("typ_unbekannt"); // z. B. MSI
    expect(typ(zip(["a.txt"]))).toBe("typ_unbekannt");
    expect(typ(zip(["[Content_Types].xml", "andere/x.xml"]))).toBe("typ_unbekannt");
    expect(typ(exe())).toBe("typ_unbekannt");
    expect(typ(Buffer.from("<svg onload=alert(1)>"))).toBe("typ_unbekannt");
  });
  it("leer und ueber 100 MB", () => {
    expect(typ(Buffer.alloc(0))).toBe("leer");
    expect(typ(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(MAX_BYTES)]))).toBe("zu_gross");
    expect(MAX_BYTES).toBe(104857600);
  });
  it("zipNamen: defektes Verzeichnis -> null", () => {
    expect(zipNamen(Buffer.from("PK\u0003\u0004kaputt"))).toBeNull();
    expect(zipNamen(docx())).toContain("word/document.xml");
  });
  it("startKategorie", () => {
    expect([startKategorie("bild"), startKategorie("pdf"), startKategorie("office")]).toEqual(["foto", "sonstiges", "sonstiges"]);
    // D8: Hinweis aus dem Dateinamen (Wortanfang, ohne Gross-/Kleinschreibung)
    expect([startKategorie("pdf", "o1-Offerte Pumpen.pdf"), startKategorie("pdf", "Angebot_2026.pdf"), startKategorie("pdf", "datenblatt-pumpe.pdf"),
      startKategorie("office", "Abnahmeprotokoll.docx"), startKategorie("pdf", "Grundriss-Plan EG.pdf"), startKategorie("bild", "offerte.jpg"), startKategorie("pdf", "planung.pdf")])
      .toEqual(["offerte", "offerte", "datenblatt", "protokoll", "plan", "foto", "sonstiges"]);
  });
  it("ZIP: Eintragslimit und Verzeichnislaenge fail closed", () => {
    const viele = zip([...Array.from({ length: 20_001 }, (_, i) => `f${i}.xml`), "word/vbaProject.bin"]);
    expect(zipNamen(viele)).toBeNull();
    expect(typ(zip(["[Content_Types].xml", "word/document.xml", ...Array.from({ length: 20_000 }, (_, i) => `f${i}`), "word/vbaProject.bin"]))).toBe("typ_unbekannt");
    const d = docx("word/vbaProject.bin");
    d.writeUInt16LE(2, d.length - 12); d.writeUInt16LE(2, d.length - 14); // EOCD-Anzahl kleiner als echtes Verzeichnis
    expect(zipNamen(d)).toBeNull();
    const z64 = docx(); z64.writeUInt16LE(0xffff, z64.length - 12); z64.writeUInt32LE(0xffffffff, z64.length - 6);
    expect(zipNamen(z64)).toBeNull();
    const k = docx(); expect(zipNamen(k.subarray(0, k.length - 40))).toBeNull(); // abgeschnitten
    expect(zipNamen(zip(["x".repeat(1025)]))).toBeNull();
  });
  it("Excel-4.0-Makroblaetter und Backslash-Pfade -> makro", () => {
    expect(typ(xlsx("xl/macrosheets/sheet1.xml"))).toBe("makro");
    expect(typ(docx("word\\vbaProject.bin"))).toBe("makro");
  });
  it("OLE2: nur echte Verzeichnisnamen zaehlen", () => {
    expect(typ(ole(["SummaryInformation"], { inhalt: "WordDocument" }))).toBe("typ_unbekannt"); // nur als Daten
    expect(typ(ole(["Bookmarks"]))).toBe("typ_unbekannt");
    expect(typ(ole(["WordDocument", "Macros"]))).toBe("makro");
    expect(typ(ole(["a", "b", "c", "d", "e", "WordDocument"]))).toEqual(["office", "application/msword"]); // zwei Verzeichnis-Sektoren
    const t0 = Date.now();
    expect(typ(ole(["WordDocument", "a", "b", "c", "d"], { schleife: true }))).toBe("typ_unbekannt");
    expect(Date.now() - t0).toBeLessThan(500);
    expect(oleNamen(ole(["WordDocument"]).subarray(0, 700))).toBeNull(); // abgeschnitten
    expect(typ(Buffer.concat([ole(["WordDocument"]).subarray(0, 8), Buffer.alloc(600)]))).toBe("typ_unbekannt");
  });
});
