import { expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { erzeugeRelease, signiereRelease } from "../src/betrieb/release.js";

it("erzeugt ein ungeprueftes Dossier nur aus signiertem Release und ueberschreibt keines", () => {
  const dir = mkdtempSync(join(tmpdir(), "planora-dossier-")), key = generateKeyPairSync("ed25519");
  try {
    const digest = `sha256:${"a".repeat(64)}`;
    const release = erzeugeRelease({ version: "dossier-test", architektur: "amd64", images: [{ dienst: "app", referenz: `planora:test@${digest}`, imageId: digest, digest: null, architektur: "amd64" }],
      migrationsVerzeichnis: resolve("src/db/migrationen"), modulmanifestVersion: "test", vonVersionen: [], schemaVorher: [] });
    writeFileSync(join(dir, "release.json"), JSON.stringify(signiereRelease(release, key.privateKey.export({ type: "pkcs8", format: "pem" }) as string)));
    writeFileSync(join(dir, "release.pub"), key.publicKey.export({ type: "spki", format: "pem" }));
    const ausgabe = join(dir, "dossier");
    const args = ["--import", "tsx", "src/betrieb/dossier.ts", "--bundle", dir, "--schluessel", join(dir, "release.pub"), "--lockfile", "package-lock.json", "--ausgabe", ausgabe];
    expect(spawnSync(process.execPath, args, { windowsHide: true }).status).toBe(0);
    expect(JSON.parse(readFileSync(join(ausgabe, "komponenten.json"), "utf8")).status).toBe("UNGEPRUEFT");
    expect(readFileSync(join(ausgabe, "FREIGABE.md"), "utf8")).toContain("keine Lieferfreigabe");
    expect(spawnSync(process.execPath, args, { windowsHide: true }).status).not.toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
