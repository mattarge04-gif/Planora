// Reine Logik von `planora install` (Spec §9, Abnahme A2): Eingaben pruefen, Kollisionen ablehnen, Plattform pruefen,
// Secrets und instanz.env anlegen. Keine Docker-Aufrufe hier; nur node:-Module.
import { randomBytes } from "node:crypto";
import { chmodSync, chownSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type TlsModus = "acme" | "internal";
export type InstallEingabe = {
  instanz: string; domain: string; tls: TlsModus; acmeKontakt?: string;
  httpsPort?: number; httpPort?: number; backupZiel?: string;
};
export type InstanzPlan = {
  instanz: string; projekt: string; domain: string; tlsWert: string; httpsPort: number; httpPort: number; baseURL: string; backupZiel?: string;
};

export const projektName = (instanz: string) => `planora-${instanz}`;
export const etcWurzel = () => process.env.PLANORA_ETC ?? "/etc/planora";
export const varWurzel = () => process.env.PLANORA_VAR ?? "/var/lib/planora";
export const instanzPfade = (instanz: string) => {
  const etc = join(etcWurzel(), instanz), v = join(varWurzel(), instanz);
  return { etc, secrets: join(etc, "secrets"), envDatei: join(etc, "instanz.env"), schluessel: join(etc, "release.pub"), var: v, zustand: join(v, "update.json"), sperre: join(v, "update.lock") };
};

const INSTANZ = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;
const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
const istPort = (p: number) => Number.isInteger(p) && p >= 1 && p <= 65535;

/** Prueft die Eingaben und leitet Projektname, TLS-Wert und Basis-URL ab. Wirft mit allen Fehlern. */
export function planeInstanz(e: InstallEingabe): InstanzPlan {
  const fehler: string[] = [];
  if (!INSTANZ.test(e.instanz ?? "")) fehler.push("--instanz: 2–32 Zeichen, Kleinbuchstaben, Ziffern, Bindestrich, beginnt mit Buchstabe");
  const domain = (e.domain ?? "").toLowerCase();
  if (!DOMAIN.test(domain)) fehler.push("--domain: kein gueltiger Hostname");
  if (e.tls !== "acme" && e.tls !== "internal") fehler.push("--tls: acme oder internal");
  if (e.tls === "acme" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.acmeKontakt ?? "")) fehler.push("--acme-kontakt: E-Mail-Adresse fuer ACME noetig");
  if (e.tls === "acme" && (domain === "localhost" || !domain.includes("."))) fehler.push("--tls acme braucht einen oeffentlichen Hostnamen");
  const httpsPort = e.httpsPort ?? 443, httpPort = e.httpPort ?? 80;
  if (!istPort(httpsPort) || !istPort(httpPort) || httpsPort === httpPort) fehler.push("Ports: 1–65535 und verschieden");
  if (e.backupZiel !== undefined && !e.backupZiel.trim()) fehler.push("--backup-ziel: leer");
  if (fehler.length) throw new Error(fehler.join("; "));
  return {
    instanz: e.instanz, projekt: projektName(e.instanz), domain, tlsWert: e.tls === "internal" ? "internal" : e.acmeKontakt!,
    httpsPort, httpPort, baseURL: `https://${domain}${httpsPort === 443 ? "" : `:${httpsPort}`}`, backupZiel: e.backupZiel?.trim(),
  };
}

/** Vergleichsform eines Backup-Ziels: Gross/Klein, abschliessende Schraegstriche und Leerraum zaehlen nicht. */
export const normalisiereZiel = (z: string) => z.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

export type Bestand = {
  /** vorhandene Compose-Projekte (`docker compose ls -a`) */
  projekte: string[];
  /** vorhandene Volumes (`docker volume ls`) */
  volumes: string[];
  /** bereits installierte Instanzen laut /etc/planora/<name>/instanz.env */
  instanzen: { instanz: string; backupZiel?: string; httpsPort?: number; httpPort?: number }[];
};

/**
 * Abnahme A2: eine zweite Instanz darf nichts mit einer bestehenden teilen. Liefert alle Ablehnungsgruende (leer = ok).
 * Volumes und Netze tragen den Projektnamen als Praefix; deshalb genuegt es, Projektname und Volume-Praefix zu pruefen.
 */
export function pruefeKollision(plan: InstanzPlan, bestand: Bestand): string[] {
  const fehler: string[] = [];
  if (bestand.instanzen.some((i) => i.instanz === plan.instanz)) fehler.push(`Instanz ${plan.instanz} ist bereits installiert (Konfiguration vorhanden)`);
  if (bestand.projekte.includes(plan.projekt)) fehler.push(`Compose-Projekt ${plan.projekt} existiert bereits`);
  const praefix = `${plan.projekt}_`;
  const volumes = bestand.volumes.filter((v) => v.startsWith(praefix));
  if (volumes.length) fehler.push(`Volumes mit dem Namen dieser Instanz existieren bereits: ${volumes.sort().join(", ")}`);
  for (const i of bestand.instanzen) {
    if (i.instanz === plan.instanz) continue;
    if (plan.backupZiel && i.backupZiel && normalisiereZiel(plan.backupZiel) === normalisiereZiel(i.backupZiel)) fehler.push(`Backup-Ziel wird bereits von Instanz ${i.instanz} verwendet`);
    const belegt = [i.httpsPort, i.httpPort].filter((p): p is number => p !== undefined);
    for (const p of [plan.httpsPort, plan.httpPort]) if (belegt.includes(p)) fehler.push(`Host-Port ${p} wird bereits von Instanz ${i.instanz} verwendet`);
  }
  return fehler;
}

export type PlattformIst = { betriebssystem: string; architektur: string; engine: string; compose: string; freiBytes: number; ramBytes: number; cpus: number };
// [A] Mindestversionen = Staende, mit denen das Paket getestet ist (Spec §13: Mindestversionen Docker/Compose offen).
export const MINDEST = { engine: [29, 0], compose: [2, 24], freiBytes: 20 * 2 ** 30 } as const;
export const EMPFOHLEN = { freiBytes: 100 * 2 ** 30, ramBytes: 8 * 2 ** 30, cpus: 4 } as const;

const version = (v: string) => (/(\d+)\.(\d+)/.exec(v) ?? []).slice(1).map(Number);
const mindestens = (v: string, min: readonly number[]) => { const [a, b] = version(v); return a !== undefined && (a > min[0] || (a === min[0] && b >= min[1])); };
const gib = (b: number) => `${(b / 2 ** 30).toFixed(1)} GiB`;

/** Plattform- und Platzcheck (Spec §3 Zielplattform). fehler = Abbruch, warnungen = Hinweis. */
export function pruefePlattform(ist: PlattformIst, releaseArchitektur?: string): { fehler: string[]; warnungen: string[] } {
  const fehler: string[] = [], warnungen: string[] = [];
  if (ist.architektur !== "amd64") fehler.push(`Architektur ${ist.architektur}: unterstuetzt ist nur amd64 (x86-64)`);
  if (releaseArchitektur && releaseArchitektur !== ist.architektur) fehler.push(`Release ist fuer ${releaseArchitektur} gebaut, Host ist ${ist.architektur}`);
  if (!mindestens(ist.engine, MINDEST.engine)) fehler.push(`Docker Engine ${ist.engine || "unbekannt"}: mindestens ${MINDEST.engine.join(".")}`);
  if (!mindestens(ist.compose, MINDEST.compose)) fehler.push(`Docker Compose ${ist.compose || "unbekannt"}: mindestens ${MINDEST.compose.join(".")}`);
  if (ist.freiBytes < MINDEST.freiBytes) fehler.push(`freier Platz ${gib(ist.freiBytes)}: mindestens ${gib(MINDEST.freiBytes)}`);
  else if (ist.freiBytes < EMPFOHLEN.freiBytes) warnungen.push(`freier Platz ${gib(ist.freiBytes)}: empfohlen ${gib(EMPFOHLEN.freiBytes)}`);
  if (ist.betriebssystem !== "linux") warnungen.push(`Betriebssystem ${ist.betriebssystem}: Zielplattform ist Ubuntu 24.04 LTS oder Debian 12`);
  if (ist.ramBytes < EMPFOHLEN.ramBytes) warnungen.push(`Arbeitsspeicher ${gib(ist.ramBytes)}: empfohlen ${gib(EMPFOHLEN.ramBytes)}`);
  if (ist.cpus < EMPFOHLEN.cpus) warnungen.push(`${ist.cpus} CPU: empfohlen ${EMPFOHLEN.cpus}`);
  return { fehler, warnungen };
}

/**
 * Secret-Dateien. Kanonisch liegen alle unter secrets/ (Quelle fuer das Schluesselinventar, Spur B). Compose-Datei-Secrets
 * sind Bind-Mounts mit den Rechten des Hosts; bei Modus 600 muss der Eigentuemer die UID im Container sein. Deshalb gibt es
 * Kopien je Empfaenger: secrets/db/ (postgres, UID 999) und secrets/app/ (node, UID 1000).
 */
export const SECRETS = ["db_superuser_passwort", "db_app_passwort", "db_migrator_passwort", "db_backup_passwort", "db_betrieb_passwort", "auth_secret"] as const;
const KOPIEN: Record<string, { uid: number; namen: readonly string[] }> = {
  db: { uid: 999, namen: ["db_superuser_passwort", "db_app_passwort", "db_migrator_passwort", "db_backup_passwort", "db_betrieb_passwort"] },
  app: { uid: 1000, namen: ["db_app_passwort", "db_migrator_passwort", "db_betrieb_passwort", "auth_secret"] },
};

/** Legt secrets/ neu an (nie ueberschreiben). Werte: 32 Zufallsbytes hex. Gibt nur Pfade zurueck, nie Inhalte. */
export function erzeugeSecrets(verzeichnis: string): { verzeichnis: string; dateien: string[] } {
  if (existsSync(verzeichnis)) throw new Error(`Secret-Verzeichnis existiert bereits: ${verzeichnis}`);
  const istRoot = typeof process.getuid === "function" && process.getuid() === 0;
  mkdirSync(verzeichnis, { recursive: true, mode: 0o700 });
  const dateien: string[] = [];
  const schreibe = (pfad: string, wert: string, uid?: number) => {
    writeFileSync(pfad, wert, { mode: 0o600, flag: "wx" }); chmodSync(pfad, 0o600);
    if (istRoot && uid !== undefined) chownSync(pfad, uid, uid);
    dateien.push(pfad);
  };
  const werte = new Map(SECRETS.map((n) => [n as string, randomBytes(32).toString("hex")]));
  for (const [n, w] of werte) schreibe(join(verzeichnis, n), w);
  for (const [unter, k] of Object.entries(KOPIEN)) {
    const d = join(verzeichnis, unter); mkdirSync(d, { mode: 0o700 });
    if (istRoot) chownSync(d, k.uid, k.uid);
    for (const n of k.namen) schreibe(join(d, n), werte.get(n)!, k.uid);
  }
  return { verzeichnis, dateien };
}

/** KEY=VALUE-Datei lesen (Kommentare und Leerzeilen ignoriert). */
export function leseEnv(datei: string): Record<string, string> {
  const werte: Record<string, string> = {};
  for (const zeile of readFileSync(datei, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(zeile.trim());
    if (m) werte[m[1]] = m[2];
  }
  return werte;
}

/** Datei atomar ersetzen: temp + fsync + rename (Spec §14.4), danach das Verzeichnis syncen (wo das Betriebssystem es zulaesst). */
export function schreibeAtomar(datei: string, inhalt: string, modus = 0o600) {
  mkdirSync(dirname(datei), { recursive: true });
  const temp = `${datei}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  const fd = openSync(temp, "wx", modus);
  try { writeFileSync(fd, inhalt); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, datei);
  try { const d = openSync(dirname(datei), "r"); try { fsyncSync(d); } finally { closeSync(d); } } catch { /* Windows: Verzeichnis-fsync nicht moeglich */ }
}

export function schreibeEnv(datei: string, werte: Record<string, string | undefined>) {
  const zeilen = Object.entries(werte).filter((e): e is [string, string] => e[1] !== undefined).map(([k, v]) => {
    if (/[\r\n]/.test(v)) throw new Error(`Wert fuer ${k} enthaelt Zeilenumbruch`);
    return `${k}=${v}`;
  });
  schreibeAtomar(datei, zeilen.join("\n") + "\n", 0o600);
}

/** Inhalt von instanz.env: nur Konfiguration, keine Geheimnisse (die liegen als Dateien unter PLANORA_SECRETS). */
export function envWerte(plan: InstanzPlan, o: { secrets: string; release: string; images: Partial<Record<"app" | "db" | "proxy" | "clamav", string>> }): Record<string, string | undefined> {
  return {
    PLANORA_INSTANZ: plan.instanz, PLANORA_RELEASE: o.release, PLANORA_SECRETS: o.secrets.replace(/\\/g, "/"),
    PLANORA_DOMAIN: plan.domain, PLANORA_TLS: plan.tlsWert, PLANORA_HTTPS_PORT: String(plan.httpsPort), PLANORA_HTTP_PORT: String(plan.httpPort),
    PLANORA_BASE_URL: plan.baseURL, PLANORA_IMAGE_APP: o.images.app, PLANORA_IMAGE_DB: o.images.db, PLANORA_IMAGE_PROXY: o.images.proxy,
    PLANORA_IMAGE_CLAMAV: o.images.clamav, PLANORA_BACKUP_ZIEL: plan.backupZiel,
  };
}
