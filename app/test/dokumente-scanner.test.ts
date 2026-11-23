import { describe, it, expect } from "vitest";
import { createServer, type AddressInfo } from "node:net";
import { EICAR, fakeScanner, scannerKonfig } from "../src/dokumente/scanner.js";
import { clamdScanner, deuteAntwort } from "../src/dokumente/clamd.js";
import { pdf } from "./hilfe-dateien.js";

/** Minimaler clamd (zPING, zINSTREAM) fuer Protokolltests. */
function fakeClamd(antwort: (daten: Buffer) => string) {
  const server = createServer((s) => {
    let puffer = Buffer.alloc(0);
    s.on("data", (d: Buffer) => {
      puffer = Buffer.concat([puffer, d]);
      if (puffer.subarray(0, 6).toString("latin1") === "zPING\0") { s.end("PONG\0"); return; }
      const kopf = "zINSTREAM\0";
      if (puffer.length < kopf.length || puffer.subarray(0, kopf.length).toString("latin1") !== kopf) return;
      let p = kopf.length; const teile: Buffer[] = [];
      while (p + 4 <= puffer.length) {
        const n = puffer.readUInt32BE(p);
        if (n === 0) { s.end(antwort(Buffer.concat(teile)) + "\0"); return; }
        if (p + 4 + n > puffer.length) return;
        teile.push(puffer.subarray(p + 4, p + 4 + n)); p += 4 + n;
      }
    });
  });
  return new Promise<{ port: number; schliesse: () => Promise<void> }>((ok) => server.listen(0, "127.0.0.1", () =>
    ok({ port: (server.address() as AddressInfo).port, schliesse: () => new Promise<void>((r) => server.close(() => r())) })));
}

describe("Fake-Scanner", () => {
  it("sauber, EICAR in einer PDF-Huelle, Ausfall", async () => {
    let aus = false;
    const s = fakeScanner({ ausfall: () => aus });
    expect(await s.pruefe(pdf(1))).toEqual({ ergebnis: "sauber" });
    expect(await s.pruefe(Buffer.concat([pdf(1), Buffer.from(EICAR)]))).toEqual({ ergebnis: "befund", signatur: "Eicar-Test-Signature" });
    aus = true;
    await expect(s.pruefe(pdf(1))).rejects.toThrow(/Ausfall/);
    expect(s.aufrufe).toBe(3);
    expect(EICAR).toHaveLength(68);
  });
});
describe("scannerKonfig", () => {
  it("ohne Host null, mit Host Standardport 3310, ungueltiger Port wirft", () => {
    expect(scannerKonfig({})).toBeNull();
    expect(scannerKonfig({ PLANORA_CLAMD_HOST: "clamav" })).toEqual({ host: "clamav", port: 3310 });
    expect(scannerKonfig({ PLANORA_CLAMD_HOST: "clamav", PLANORA_CLAMD_PORT: "4000" })).toEqual({ host: "clamav", port: 4000 });
    expect(() => scannerKonfig({ PLANORA_CLAMD_HOST: "clamav", PLANORA_CLAMD_PORT: "x" })).toThrow(/PLANORA_CLAMD_PORT/);
  });
});
describe("clamd-Adapter", () => {
  it("deuteAntwort", () => {
    expect(deuteAntwort("stream: OK")).toEqual({ ergebnis: "sauber" });
    expect(deuteAntwort("stream: Win.Test.EICAR_HDB-1 FOUND")).toEqual({ ergebnis: "befund", signatur: "Win.Test.EICAR_HDB-1" });
    expect(() => deuteAntwort("INSTREAM size limit exceeded. ERROR")).toThrow(/size limit/);
    expect(() => deuteAntwort("")).toThrow(/leere Antwort/);
  });
  it("INSTREAM in Bloecken, Antwort OK/FOUND, PING", async () => {
    let erhalten: Buffer = Buffer.alloc(0);
    const c = await fakeClamd((d) => { erhalten = d; return d.includes(Buffer.from("BOESE")) ? "stream: Test.Boese FOUND" : "stream: OK"; });
    try {
      const s = clamdScanner({ host: "127.0.0.1", port: c.port });
      const gross = Buffer.alloc(200_000, 7);
      expect(await s.pruefe(gross)).toEqual({ ergebnis: "sauber" });
      expect(Buffer.compare(erhalten, gross)).toBe(0);
      expect(await s.pruefe(Buffer.from("xxBOESExx"))).toEqual({ ergebnis: "befund", signatur: "Test.Boese" });
      expect(await s.ping()).toBe(true);
    } finally { await c.schliesse(); }
  });
  it("nicht erreichbar -> wirft nach Wiederholungen; ping false", async () => {
    const c = await fakeClamd(() => "stream: OK"); const port = c.port; await c.schliesse();
    const s = clamdScanner({ host: "127.0.0.1", port, versuche: 2, pauseMs: 10 });
    await expect(s.pruefe(Buffer.from("x"))).rejects.toThrow();
    expect(await s.ping()).toBe(false);
  });
  it("Verbindungsabbruch nach dem Senden wird nicht wiederholt", async () => {
    let verbindungen = 0;
    const server = createServer((s) => { verbindungen++; s.on("data", () => s.destroy()); });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    try {
      const s = clamdScanner({ host: "127.0.0.1", port: (server.address() as AddressInfo).port, versuche: 3, pauseMs: 10 });
      await expect(s.pruefe(Buffer.from("x"))).rejects.toThrow();
      expect(verbindungen).toBe(1);
    } finally { await new Promise<void>((r) => server.close(() => r())); }
  });
});
