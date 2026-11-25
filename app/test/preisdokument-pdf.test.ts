import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { zaehleSeiten } from "../src/dokumente/pdf.js";
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
describe("zaehleSeiten", () => {
  it("zaehlt Seiten", () => expect(zaehleSeiten(pdf(3))).toBe(3));
  it("zaehlt mehr als 100 Seiten", () => expect(zaehleSeiten(pdf(101))).toBe(101));
  it("zaehlt Seiten im komprimierten Objekt-Stream", () => expect(zaehleSeiten(objStmPdf(7))).toBe(7));
  it("Objekt-Stream mit mehr als 100 Seiten", () => expect(zaehleSeiten(objStmPdf(120))).toBe(120));
  it("nimmt das Maximum aus Klartext und Objekt-Stream (kleiner /Count im Klartext)", () =>
    expect(zaehleSeiten(objStmPdf(5, [Buffer.from("99 0 obj << /Type /Pages /Count 1 >> endobj\n")]))).toBe(5));
  it("Zip-Bombe: Stream ueber 8 MB entpackt wird uebersprungen und bleibt schnell", () => {
    const t = Date.now();
    const bombe = flateStream(Buffer.concat([Buffer.from("/Type /Pages /Count 500 "), Buffer.alloc(20 * 1024 * 1024, 32)]));
    expect(zaehleSeiten(Buffer.concat([objStmPdf(3), bombe]))).toBe(3);
    expect(Date.now() - t).toBeLessThan(3000);
  });
  it("kaputter Stream fuehrt nicht zum Fehler", () =>
    expect(zaehleSeiten(Buffer.concat([objStmPdf(2), Buffer.from("8 0 obj << /Filter /FlateDecode >>\nstream\nkein zlib\nendstream\nendobj\n")]))).toBe(2));
  it("32 MB ohne Objekt-Streams bleibt schnell", () => {
    const t = Date.now();
    const gross = Buffer.concat([pdf(4), Buffer.alloc(32 * 1024 * 1024 - 400, 65)]);
    expect(zaehleSeiten(gross)).toBe(4);
    expect(Date.now() - t).toBeLessThan(3000);
  });
});

import { lesbar } from "../src/preisdokument/pdf.js";
describe("lesbar", () => {
  const ok = { art: "pdf", scanStatus: "sauber", seiten: 3, groesse: 1000 };
  it("nur sauberes PDF innerhalb der Lesegrenzen", () => {
    expect(lesbar(ok)).toBeNull();
    expect(lesbar({ ...ok, art: "office" })).toBe("kein_pdf");
    expect(lesbar({ ...ok, scanStatus: "quarantaene" })).toBe("nicht_sauber");
    expect(lesbar({ ...ok, groesse: 32 * 1024 * 1024 + 1 })).toBe("zu_gross_lesen");
    expect(lesbar({ ...ok, seiten: 101 })).toBe("zu_viele_seiten");
  });
});
