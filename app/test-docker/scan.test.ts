// Echter clamd (Spec Anlagenakte Abschnitt 6): EICAR abgelehnt, sauberes PDF durch. Eigener Container, Port nur auf 127.0.0.1.
// Signaturen kommen aus dem Image bzw. freshclam beim Start; clamd-Konfiguration wie im Compose-Paket (StreamMaxLength >= 100 MB).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DOCKER_TESTS, clamavReferenz, docker, stelleImageBereit } from "./paket-hilfe.js";
import { clamdScanner } from "../src/dokumente/clamd.js";
import { EICAR } from "../src/dokumente/scanner.js";

const NAME = "planora-scan-test", PORT = 13310;
const scanner = clamdScanner({ host: "127.0.0.1", port: PORT, versuche: 1 });

describe.skipIf(!DOCKER_TESTS)("ClamAV (Docker)", () => {
  beforeAll(async () => {
    const ref = clamavReferenz();
    await stelleImageBereit(ref);
    await docker(["rm", "-f", NAME], { erlaubeFehler: true });
    await docker(["run", "-d", "--name", NAME, "-p", `127.0.0.1:${PORT}:3310`, ref]);
    for (let i = 0; i < 300 && !(await scanner.ping()); i++) await new Promise((r) => setTimeout(r, 1000));
    expect(await scanner.ping()).toBe(true);
  }, 400_000);
  afterAll(async () => { await docker(["rm", "-f", NAME], { erlaubeFehler: true }); });

  it("EICAR -> Befund", async () => {
    const r = await scanner.pruefe(Buffer.from(EICAR));
    expect(r.ergebnis).toBe("befund");
    expect(r.ergebnis === "befund" && r.signatur).toMatch(/eicar/i);
  });
  it("sauberes PDF -> sauber", async () => {
    expect(await scanner.pruefe(Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF"))).toEqual({ ergebnis: "sauber" });
  });
});
