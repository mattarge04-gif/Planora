import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { backupVorbereiten, backupKonfigurieren } from "../src/betrieb/install/backup.js";
import { erzeugeSecrets, instanzPfade, leseEnv, schreibeEnv } from "../src/betrieb/install/plan.js";

it("verbindet externe Konfiguration und Inventar mit den tatsaechlich verwendeten Secrets und DB-Zielen", () => {
  const dir = mkdtempSync(join(tmpdir(), "backup-install-")), alt = process.env.PLANORA_ETC;
  process.env.PLANORA_ETC = dir;
  try {
    const p = instanzPfade("test-kunde"); mkdirSync(p.etc); erzeugeSecrets(p.secrets);
    expect(() => backupVorbereiten("test-kunde", "relativ", "age1" + "q".repeat(58))).toThrow(/absoluter/);
    const env = backupVorbereiten("test-kunde", join(dir, "ziel"), "age1" + "q".repeat(58));
    schreibeEnv(p.envDatei, { ...env, PLANORA_RELEASE: "test-1", PLANORA_DOMAIN: "planora.test", PLANORA_TLS: "internal" });
    const id = randomUUID(); backupKonfigurieren("test-kunde", id);
    const inventar = JSON.parse(readFileSync(join(p.etc, "backup/inventar.json"), "utf8"));
    expect(inventar.instanzId).toBe(id);
    expect(inventar.appSecrets.auth).toBe(readFileSync(join(p.secrets, "app/auth_secret"), "utf8"));
    expect(inventar.dbRollen.planora_backup).toBe(readFileSync(join(p.secrets, "db/db_backup_passwort"), "utf8"));
    expect(leseEnv(env.PLANORA_BACKUP_ENV).RESTIC_PASSWORD_FILE).toBe("/run/backup/restic_passwort");
    backupKonfigurieren("test-kunde", id, "test-2", "planora_restore_probe");
    expect(readFileSync(join(p.etc, "backup/backup_db"), "utf8")).toContain("/planora_restore_probe");
    expect(JSON.parse(readFileSync(join(p.etc, "backup/konfiguration.json"), "utf8")).release).toBe("test-2");
    expect(readFileSync(env.PLANORA_BACKUP_ENV, "utf8")).not.toContain(inventar.appSecrets.auth);
  } finally { if (alt === undefined) delete process.env.PLANORA_ETC; else process.env.PLANORA_ETC = alt; rmSync(dir, { recursive: true, force: true }); }
});
