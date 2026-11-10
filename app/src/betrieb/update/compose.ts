import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { leseEnv, schreibeEnv } from "../install/plan.js";
import type { Release } from "../release.js";
import { composeArgs, mussGelingen, type Ausfuehrer, type InstanzPfad } from "./docker.js";

/** Effektive Compose-Konfiguration gegen das signierte Manifest pruefen, nicht nur Env-Werte. */
export async function pruefeComposeBindung(docker: Ausfuehrer, i: InstanzPfad, release: Release) {
  const dir = mkdtempSync(join(tmpdir(), "planora-compose-pruefung-"));
  try {
    const werte = leseEnv(i.envDatei);
    for (const img of release.images) werte[img.dienst === "backup" ? "PLANORA_BACKUP_IMAGE" : `PLANORA_IMAGE_${img.dienst.toUpperCase()}`] = img.referenz;
    const envDatei = join(dir, "instanz.env"); schreibeEnv(envDatei, werte);
    const r = await mussGelingen(docker, [...composeArgs({ ...i, envDatei }), "--profile", "*", "config", "--format", "json"]);
    const services = JSON.parse(r.stdout).services as Record<string, { image: string }>;
    const zuordnung: Record<string, string> = { api: "app", worker: "app", migrator: "app", konsole: "app", proxy: "proxy", "proxy-init": "proxy", db: "db", backup: "backup", journal: "backup", restore: "backup", clamav: "clamav" };
    for (const name of ["api", "worker", "migrator", "proxy", "db", "backup", "journal", "restore"]) if (!services[name]) throw new Error(`Compose-Pflichtdienst fehlt: ${name}`);
    for (const [name, service] of Object.entries(services)) {
      const image = release.images.find((img) => img.dienst === zuordnung[name]);
      if (name === "clamav" && !image) continue; // Profil scan ist ohne geliefertes Image nicht aktiv.
      if (!image || service.image !== image.referenz) throw new Error(`Compose-Image von ${name} weicht vom signierten Manifest ab`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
