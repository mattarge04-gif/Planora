import { describe, it, expect } from "vitest";
import { pruefePdf } from "../src/preisdokument/pdf.js";
const pdf = (seiten: number) => Buffer.from(`%PDF-1.7\n${Array.from({ length: seiten }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj`).join("\n")}\n2 0 obj << /Type /Pages /Count ${seiten} >> endobj\n%%EOF`);
describe("pruefePdf", () => {
  it("erkennt PDF und zaehlt Seiten", () => expect(pruefePdf(pdf(3))).toEqual({ ok: true, seiten: 3 }));
  it("lehnt Nicht-PDF ab", () => expect(pruefePdf(Buffer.from("GIF89a"))).toEqual({ ok: false, grund: "kein_pdf" }));
  it("lehnt mehr als 100 Seiten ab", () => expect(pruefePdf(pdf(101))).toEqual({ ok: false, grund: "zu_viele_seiten" }));
  it("lehnt ueber 32 MB ab", () => expect(pruefePdf(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(32 * 1024 * 1024)]))).toEqual({ ok: false, grund: "zu_gross" }));
});
