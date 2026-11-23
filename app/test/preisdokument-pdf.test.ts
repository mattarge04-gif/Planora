import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { pruefePdf } from "../src/preisdokument/pdf.js";
const pdf = (seiten: number) => Buffer.from(`%PDF-1.7\n${Array.from({ length: seiten }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj`).join("\n")}\n2 0 obj << /Type /Pages /Count ${seiten} >> endobj\n%%EOF`);
// PDF 1.5+: Seitenbaum nur in einem komprimierten Objekt-Stream (/ObjStm), Klartext ohne /Type /Page(s)
const objStmPdf = (seiten: number, zusatz: Buffer[] = []) => {
  const objekte = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Kids [${Array.from({ length: seiten }, (_, i) => `${i + 3} 0 R`).join(" ")}] /Count ${seiten} /Type /Pages >>`,
    ...Array.from({ length: seiten }, () => "<< /Type /Page /Parent 2 0 R >>")];
  const z = deflateSync(Buffer.from(objekte.join("\n"), "latin1"));
  return Buffer.concat([Buffer.from(`%PDF-1.7\n${seiten + 3} 0 obj\n<< /Type /ObjStm /N ${objekte.length} /First 0 /Filter /FlateDecode /Length ${z.length} >>\nstream\n`, "latin1"),
    z, Buffer.from("\nendstream\nendobj\n", "latin1"), ...zusatz, Buffer.from("%%EOF", "latin1")]);
};
const flateStream = (inhalt: Buffer) => {
  const z = deflateSync(inhalt);
  return Buffer.concat([Buffer.from(`9 0 obj\n<< /Filter /FlateDecode /Length ${z.length} >>\nstream\n`), z, Buffer.from("\nendstream\nendobj\n")]);
};
describe("pruefePdf", () => {
  it("erkennt PDF und zaehlt Seiten", () => expect(pruefePdf(pdf(3))).toEqual({ ok: true, seiten: 3 }));
  it("lehnt Nicht-PDF ab", () => expect(pruefePdf(Buffer.from("GIF89a"))).toEqual({ ok: false, grund: "kein_pdf" }));
  it("lehnt mehr als 100 Seiten ab", () => expect(pruefePdf(pdf(101))).toEqual({ ok: false, grund: "zu_viele_seiten" }));
  it("zaehlt Seiten im komprimierten Objekt-Stream", () => expect(pruefePdf(objStmPdf(7))).toEqual({ ok: true, seiten: 7 }));
  it("Objekt-Stream mit mehr als 100 Seiten wird abgelehnt", () => expect(pruefePdf(objStmPdf(120))).toEqual({ ok: false, grund: "zu_viele_seiten" }));
  it("nimmt das Maximum aus Klartext und Objekt-Stream (kleiner /Count im Klartext)", () =>
    expect(pruefePdf(objStmPdf(5, [Buffer.from("99 0 obj << /Type /Pages /Count 1 >> endobj\n")]))).toEqual({ ok: true, seiten: 5 }));
  it("Zip-Bombe: Stream ueber 8 MB entpackt wird uebersprungen und bleibt schnell", () => {
    const t = Date.now();
    const bombe = flateStream(Buffer.concat([Buffer.from("/Type /Pages /Count 500 "), Buffer.alloc(20 * 1024 * 1024, 32)]));
    expect(pruefePdf(Buffer.concat([objStmPdf(3), bombe]))).toEqual({ ok: true, seiten: 3 });
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it("kaputter Stream fuehrt nicht zum Fehler", () =>
    expect(pruefePdf(Buffer.concat([objStmPdf(2), Buffer.from("8 0 obj << /Filter /FlateDecode >>\nstream\nkein zlib\nendstream\nendobj\n")]))).toEqual({ ok: true, seiten: 2 }));
  it("32 MB ohne Objekt-Streams bleibt schnell", () => {
    const t = Date.now();
    const gross = Buffer.concat([pdf(4), Buffer.alloc(32 * 1024 * 1024 - 400, 65)]);
    expect(pruefePdf(gross)).toEqual({ ok: true, seiten: 4 });
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it("lehnt ueber 32 MB ab", () => expect(pruefePdf(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(32 * 1024 * 1024)]))).toEqual({ ok: false, grund: "zu_gross" }));
});
