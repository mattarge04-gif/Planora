import { describe, it, expect } from "vitest";
import { erkenneTyp, startKategorie, MAX_BYTES, zipNamen } from "../src/dokumente/typ.js";
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
    expect(typ(ole("Root Entry", "WordDocument"))).toEqual(["office", "application/msword"]);
    expect(typ(ole("Root Entry", "Workbook"))).toEqual(["office", "application/vnd.ms-excel"]);
    expect(typ(ole("Root Entry", "PowerPoint Document"))).toEqual(["office", "application/vnd.ms-powerpoint"]);
  });
  it("Makros, fremde Container, EXE, Text", () => {
    expect(typ(docx("word/vbaProject.bin"))).toBe("makro");
    expect(typ(ole("Root Entry", "Workbook", "_VBA_PROJECT"))).toBe("makro");
    expect(typ(ole("Root Entry", "SummaryInformation"))).toBe("typ_unbekannt"); // z. B. MSI
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
  });
});
