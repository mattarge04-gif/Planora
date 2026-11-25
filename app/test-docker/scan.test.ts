// Echter clamd (Spec Anlagenakte Abschnitt 6): EICAR abgelehnt, sauberes PDF durch, Grenzueberschreitung fail closed.
// Eigener Container, Port nur auf 127.0.0.1. clamd laeuft mit dem Inhalt clamd_conf aus compose.yaml (wie im Paket; Gesamtreview W1/W2).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { BETRIEB, DOCKER_TESTS, clamavReferenz, docker, stelleImageBereit } from "./paket-hilfe.js";
import { GrenzeFehler, clamdScanner } from "../src/dokumente/clamd.js";
import { EICAR } from "../src/dokumente/scanner.js";

const NAME = "planora-scan-test", PORT = 13310;
const scanner = clamdScanner({ host: "127.0.0.1", port: PORT, versuche: 1 });

/** clamd_conf-Inhalt aus compose.yaml (Block unter "content: |", 6 Leerzeichen eingerueckt). */
function clamdConf(): string {
  const block = readFileSync(join(BETRIEB, "compose.yaml"), "utf8").split(/\r?\n  clamd_conf:\r?\n/)[1];
  const zeilen = block.split(/\r?\n/).slice(1);
  return zeilen.slice(0, zeilen.findIndex((z) => !z.startsWith("      "))).map((z) => z.slice(6)).join("\n") + "\n";
}

/** ZIP mit einem Eintrag, ohne Kompression. */
function zip(name: string, daten: Buffer): Buffer {
  const n = Buffer.from(name), crc = crc32(daten);
  const lokal = Buffer.alloc(30); lokal.writeUInt32LE(0x04034b50, 0); lokal.writeUInt16LE(20, 4);
  lokal.writeUInt32LE(crc, 14); lokal.writeUInt32LE(daten.length, 18); lokal.writeUInt32LE(daten.length, 22); lokal.writeUInt16LE(n.length, 26);
  const zentral = Buffer.alloc(46); zentral.writeUInt32LE(0x02014b50, 0); zentral.writeUInt16LE(20, 4); zentral.writeUInt16LE(20, 6);
  zentral.writeUInt32LE(crc, 16); zentral.writeUInt32LE(daten.length, 20); zentral.writeUInt32LE(daten.length, 24); zentral.writeUInt16LE(n.length, 28);
  const offset = 30 + n.length + daten.length;
  const ende = Buffer.alloc(22); ende.writeUInt32LE(0x06054b50, 0); ende.writeUInt16LE(1, 8); ende.writeUInt16LE(1, 10);
  ende.writeUInt32LE(46 + n.length, 12); ende.writeUInt32LE(offset, 16);
  return Buffer.concat([lokal, n, daten, zentral, n, ende]);
}

describe.skipIf(!DOCKER_TESTS)("ClamAV (Docker)", () => {
  let dir = "";
  beforeAll(async () => {
    const ref = clamavReferenz();
    await stelleImageBereit(ref);
    dir = mkdtempSync(join(tmpdir(), "clamd-conf-"));
    writeFileSync(join(dir, "clamd.conf"), clamdConf());
    await docker(["rm", "-f", NAME], { erlaubeFehler: true });
    await docker(["run", "-d", "--name", NAME, "-p", `127.0.0.1:${PORT}:3310`, "-v", `${join(dir, "clamd.conf")}:/etc/clamav/clamd.conf:ro`, ref]);
    for (let i = 0; i < 300 && !(await scanner.ping()); i++) await new Promise((r) => setTimeout(r, 1000));
    expect(await scanner.ping()).toBe(true);
  }, 400_000);
  afterAll(async () => { await docker(["rm", "-f", NAME], { erlaubeFehler: true }); if (dir) rmSync(dir, { recursive: true, force: true }); });

  it("clamd.conf aus compose wirkt; Healthcheck-Befehl (nc + PING) laeuft im Image", async () => {
    const conf = (await docker(["exec", NAME, "cat", "/etc/clamav/clamd.conf"])).stdout;
    expect(conf).toMatch(/^AlertExceedsMax yes$/m);
    expect(conf).toMatch(/^StreamMaxLength 101M$/m);
    const h = await docker(["exec", NAME, "sh", "-c", "printf 'PING\\n' | nc -w 2 127.0.0.1 3310 | grep -q PONG"], { erlaubeFehler: true });
    expect(h.code).toBe(0);
  });
  it("EICAR -> Befund", async () => {
    const r = await scanner.pruefe(Buffer.from(EICAR));
    expect(r.ergebnis).toBe("befund");
    expect(r.ergebnis === "befund" && r.signatur).toMatch(/eicar/i);
  });
  it("sauberes PDF -> sauber", async () => {
    expect(await scanner.pruefe(Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF"))).toEqual({ ergebnis: "sauber" });
  });
  it("verschachteltes ZIP ueber MaxRecursion -> GrenzeFehler (nie sauber)", async () => {
    let z: Buffer = Buffer.from(EICAR);
    for (let i = 0; i < 25; i++) z = zip(`e${i}.zip`, z);
    await expect(scanner.pruefe(z)).rejects.toBeInstanceOf(GrenzeFehler);
  });
});
