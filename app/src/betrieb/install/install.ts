// Ablauf von `planora install` (Spec §9). Seiteneffekte auf Docker hinter InstallUmgebung, damit Unit-Tests mit Fake laufen.
import { existsSync, mkdirSync, readdirSync, readFileSync, statfsSync, copyFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { pruefeRelease, type Release } from "../release.js";
import { composeArgs, imageId, letzteZeile, mussGelingen, sql, type Ausfuehrer, type InstanzPfad } from "../update/docker.js";
import { envWerte, erzeugeSecrets, etcWurzel, instanzPfade, leseEnv, planeInstanz, planeVorneNetz, pruefeKollision, pruefePlattform, schreibeEnv, type Bestand, type InstallEingabe, type PlattformIst } from "./plan.js";
import { backupVorbereiten, backupKonfigurieren } from "./backup.js";
import { reconcileHost } from "../host.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface InstallUmgebung {
  plattform(): Promise<PlattformIst>;
  projekte(): Promise<string[]>;
  volumes(): Promise<string[]>;
  /** Subnetze aller vorhandenen Docker-Netze */
  subnetze(): Promise<string[]>;
  ladeImage(archiv: string): Promise<void>;
  imageId(referenz: string): Promise<string | null>;
  /** db → migrator → api/worker → proxy, ohne Pull; wartet bis alles gesund ist */
  starte(i: InstanzPfad): Promise<void>;
  sql(i: InstanzPfad, rolle: string, befehl: string): Promise<string>;
  setupToken(i: InstanzPfad): Promise<string>;
  backupStart?(i: InstanzPfad): Promise<void>;
}

export type InstallOptionen = InstallEingabe & {
  /** Bundle-Verzeichnis: compose.yaml, Caddyfile, wartung.html, release.json, images/ */
  bundle: string;
  /** Oeffentlicher Release-Schluessel (Vertrauensanker); wird nach /etc/planora/<instanz>/release.pub kopiert */
  schluessel: string;
  recoveryEmpfaenger?: string;
  melde?: (text: string) => void;
};
export type InstallErgebnis = { instanz: string; projekt: string; baseURL: string; release: string; envDatei: string; setupToken: string; warnungen: string[] };

/** Bereits installierte Instanzen aus /etc/planora/<name>/instanz.env. */
export function leseInstanzen(): Bestand["instanzen"] {
  const wurzel = etcWurzel();
  if (!existsSync(wurzel)) return [];
  return readdirSync(wurzel, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const env = join(wurzel, d.name, "instanz.env");
    const w = existsSync(env) ? leseEnv(env) : {};
    return { instanz: d.name, vorneSubnetz: w.PLANORA_VORNE_SUBNETZ, backupZiel: w.PLANORA_BACKUP_ZIEL, httpsPort: w.PLANORA_HTTPS_PORT ? Number(w.PLANORA_HTTPS_PORT) : undefined, httpPort: w.PLANORA_HTTP_PORT ? Number(w.PLANORA_HTTP_PORT) : undefined };
  });
}

export const composeDateien = (bundle: string) => [join(bundle, "compose.yaml"), ...(existsSync(join(bundle, "compose.backup.yaml")) ? [join(bundle, "compose.backup.yaml")] : [])];

/** Laedt die Images des Release (falls im Bundle) und prueft jede Image-ID gegen das Manifest (§8 Schritt 4, §9 offline). */
export async function ladeUndPruefeImages(release: Release, bundle: string, u: Pick<InstallUmgebung, "ladeImage" | "imageId">, dienste?: string[]) {
  for (const img of release.images) {
    if (dienste && !dienste.includes(img.dienst)) continue;
    if (img.archiv) {
      const archiv = resolve(bundle, img.archiv);
      if (!archiv.startsWith(resolve(bundle))) throw new Error(`Image-Archiv ausserhalb des Bundles: ${img.archiv}`);
      if (!existsSync(archiv)) throw new Error(`Image-Archiv fehlt im Bundle: ${img.archiv}`);
      await u.ladeImage(archiv);
    }
    const id = await u.imageId(img.referenz);
    if (id === null) throw new Error(`Image ${img.referenz} ist nicht vorhanden (offline, kein Pull)`);
    if (id !== img.imageId) throw new Error(`Image-ID von ${img.referenz} weicht vom Manifest ab`);
  }
}

export async function installiere(o: InstallOptionen, u: InstallUmgebung): Promise<InstallErgebnis> {
  const melde = o.melde ?? (() => {});
  // 1. Eingaben, Bundle, Signatur – nichts wird veraendert
  const plan = planeInstanz(o);
  for (const f of ["compose.yaml", "Caddyfile", "wartung.html", "release.json"]) if (!existsSync(join(o.bundle, f))) throw new Error(`Bundle unvollstaendig: ${f} fehlt`);
  if (!existsSync(o.schluessel)) throw new Error("Oeffentlicher Release-Schluessel fehlt (--schluessel)");
  const release = pruefeRelease(readFileSync(join(o.bundle, "release.json"), "utf8"), readFileSync(o.schluessel, "utf8"));
  const mitBackup = release.images.some((img) => img.dienst === "backup");
  if (mitBackup && (!existsSync(join(o.bundle, "compose.backup.yaml")) || !o.backupZiel || !/^age1[0-9a-z]{58}$/.test(o.recoveryEmpfaenger ?? ""))) throw new Error("Backup verlangt Overlay, --backup-ziel (lokaler Pfad) und --recovery-empfaenger (oeffentlicher age-Key)");
  if (mitBackup) for (const f of ["planora-betrieb@.service", "planora-sicherung@.service", "planora-sicherung@.timer"]) if (!existsSync(join(o.bundle, f))) throw new Error(`Bundle unvollstaendig: ${f}`);
  melde(`Release ${release.version} geprueft (Signatur gueltig)`);
  // 2. Plattform und Platz
  const p = pruefePlattform(await u.plattform(), release.architektur);
  if (p.fehler.length) throw new Error(`Plattform ungeeignet: ${p.fehler.join("; ")}`);
  p.warnungen.forEach((w) => melde(`Warnung: ${w}`));
  // 3. Kollisionen (A2)
  const bestand = { projekte: await u.projekte(), volumes: await u.volumes(), instanzen: leseInstanzen(), subnetze: await u.subnetze() };
  const kollision = pruefeKollision(plan, bestand);
  if (kollision.length) throw new Error(`Installation abgelehnt: ${kollision.join("; ")}`);
  const vorne = planeVorneNetz(bestand, o.vorneSubnetz);
  // 4. Images offline laden und gegen das Manifest pruefen (clamav nur, wenn im Bundle: Profil scan ist in Stufe 1 aus)
  await ladeUndPruefeImages(release, o.bundle, u, release.images.filter((i) => i.dienst !== "clamav" || i.archiv).map((i) => i.dienst));
  // 5. Erst jetzt Dateien anlegen: Secrets (600), Vertrauensanker, instanz.env
  const pfade = instanzPfade(plan.instanz);
  mkdirSync(pfade.etc, { recursive: true, mode: 0o700 });
  mkdirSync(pfade.var, { recursive: true, mode: 0o700 });
  erzeugeSecrets(pfade.secrets);
  copyFileSync(o.schluessel, pfade.schluessel);
  const ref = (d: string) => release.images.find((i) => i.dienst === d)?.referenz;
  const backupEnv = mitBackup ? backupVorbereiten(plan.instanz, o.backupZiel!, o.recoveryEmpfaenger!) : {};
  schreibeEnv(pfade.envDatei, { ...envWerte(plan, { secrets: pfade.secrets, release: release.version, vorne, images: { app: ref("app"), db: ref("db"), proxy: ref("proxy"), clamav: ref("clamav") } }), ...backupEnv, PLANORA_BUNDLE_DIR: resolve(o.bundle), PLANORA_RECOVERY_BUNDLE_DIR: resolve(o.bundle), PLANORA_BACKUP_IMAGE: ref("backup") });
  copyFileSync(join(o.bundle, "release.json"), join(pfade.etc, "release.json"));
  melde(`Konfiguration angelegt: ${pfade.etc}`);
  // 6. Start ohne Pull
  const instanz: InstanzPfad = { projekt: plan.projekt, envDatei: pfade.envDatei, composeDateien: composeDateien(o.bundle) };
  await u.starte(instanz);
  if (mitBackup) {
    const instanzId = JSON.parse(await u.sql(instanz, "planora_betrieb", "select wert from instanz_einstellung where schluessel='instanz_id'"));
    backupKonfigurieren(plan.instanz, instanzId);
    if (!u.backupStart) throw new Error("Backup-Start fehlt in Installationsumgebung");
    await u.backupStart(instanz);
  }
  // 7. Installationsprofil P1 (Kern Stufe 1): alle Optionen aus (ADR 0029). Pruefen statt annehmen, dann auditieren.
  const aktiv = Number(await u.sql(instanz, "planora_app", "select count(*) from modul_schalter where aktiv"));
  if (aktiv !== 0) throw new Error(`Profil P1 verletzt: ${aktiv} Option(en) aktiv`);
  await u.sql(instanz, "planora_betrieb", `select betrieb_ereignis('install', jsonb_build_object('release', '${release.version.replace(/'/g, "''")}', 'profil', 'P1'))`);
  // 8. Setup-Token (15 min) fuer den Erstadmin
  const setupToken = await u.setupToken(instanz);
  return { instanz: plan.instanz, projekt: plan.projekt, baseURL: plan.baseURL, release: release.version, envDatei: pfade.envDatei, setupToken, warnungen: p.warnungen };
}

/** Echte Umgebung: Docker-CLI des Hosts. */
export function dockerInstallUmgebung(docker: Ausfuehrer, platzPfad: string): InstallUmgebung {
  const zeilen = (t: string) => t.split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  return {
    async plattform() {
      const v = await mussGelingen(docker, ["version", "--format", "{{.Server.Version}}|{{.Server.Arch}}|{{.Server.Os}}"], { timeoutMs: 60_000 });
      const [engine, architektur, betriebssystem] = v.stdout.trim().split("|");
      const c = await mussGelingen(docker, ["compose", "version", "--short"], { timeoutMs: 60_000 });
      const s = statfsSync(existsSync(platzPfad) ? platzPfad : ".");
      // betriebssystem: Betriebssystem des Hosts, auf dem das Werkzeug laeuft (Docker Desktop meldet fuer die Engine immer linux)
      return { betriebssystem: process.platform === "linux" ? betriebssystem : process.platform, architektur, engine, compose: c.stdout.trim().replace(/^v/, ""), freiBytes: Number(s.bavail) * Number(s.bsize), ramBytes: totalmem(), cpus: cpus().length };
    },
    async projekte() {
      const r = await mussGelingen(docker, ["compose", "ls", "-a", "--format", "json"], { timeoutMs: 60_000 });
      return (JSON.parse(r.stdout || "[]") as { Name: string }[]).map((p) => p.Name);
    },
    async subnetze() {
      const ids = zeilen((await mussGelingen(docker, ["network", "ls", "-q"], { timeoutMs: 60_000 })).stdout);
      if (!ids.length) return [];
      const r = await mussGelingen(docker, ["network", "inspect", ...ids, "--format", "{{range .IPAM.Config}}{{.Subnet}} {{end}}"], { timeoutMs: 60_000 });
      return r.stdout.split(/\s+/).filter(Boolean);
    },
    async volumes() { return zeilen((await mussGelingen(docker, ["volume", "ls", "--format", "{{.Name}}"], { timeoutMs: 60_000 })).stdout); },
    async ladeImage(archiv) { await mussGelingen(docker, ["load", "-i", archiv], { timeoutMs: 1_800_000 }); },
    imageId: (referenz) => imageId(docker, referenz),
    async starte(i) { await mussGelingen(docker, [...composeArgs(i), "up", "-d", "--pull", "never", "--wait", "--wait-timeout", "300"], { timeoutMs: 600_000 }); },
    async backupStart(i) {
      await mussGelingen(docker, [...composeArgs(i), "run", "--pull", "never", "--rm", "-T", "backup", "initialisieren"]);
      await reconcileHost(docker, i);
      await mussGelingen(docker, [...composeArgs(i), "run", "--pull", "never", "--rm", "-T", "backup", "journal", "--einmal"]);
      await mussGelingen(docker, [...composeArgs(i), "up", "-d", "--no-deps", "--pull", "never", "journal"]);
      if (process.platform === "linux") {
        if (process.getuid?.() !== 0 || !existsSync("/run/systemd/system")) throw new Error("Periodischer Host-Betrieb verlangt root und systemd; Journal laeuft, Timer noch nicht aktiviert");
        if (etcWurzel() !== "/etc/planora") throw new Error("systemd-Vorlagen verlangen /etc/planora; fuer abweichende Pfade Betriebsdienst manuell konfigurieren");
        const bundle = leseEnv(i.envDatei).PLANORA_BUNDLE_DIR;
        for (const name of ["planora-betrieb@.service", "planora-sicherung@.service", "planora-sicherung@.timer"]) {
          const ziel = join("/etc/systemd/system", name), quelle = join(bundle, name);
          if (existsSync(ziel) && readFileSync(ziel, "utf8") !== readFileSync(quelle, "utf8")) throw new Error(`Vorhandene abweichende systemd-Datei bleibt erhalten: ${ziel}`);
          if (!existsSync(ziel)) copyFileSync(quelle, ziel);
        }
        const aus = promisify(execFile);
        await aus("systemctl", ["daemon-reload"]);
        const instanz = i.projekt.replace(/^planora-/, "");
        await aus("systemctl", ["enable", "--now", `planora-betrieb@${instanz}.service`, `planora-sicherung@${instanz}.timer`]);
      }
    },
    sql: (i, rolle, befehl) => sql(docker, i, rolle, befehl),
    async setupToken(i) {
      const r = await mussGelingen(docker, [...composeArgs(i), "--profile", "konsole", "run", "--pull", "never", "--rm", "-T", "konsole", "setup-token"], { timeoutMs: 120_000 });
      return letzteZeile(r.stdout);
    },
  };
}
