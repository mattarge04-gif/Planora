// Host-Konfiguration fuer das vorhandene Backup-Image; nur node:-Module im Offline-Werkzeug.
import { randomBytes } from "node:crypto";
import { chmodSync, chownSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { KUNDENZERTIFIKAT_TLS, instanzPfade, leseEnv, schreibeAtomar, schreibeEnv } from "./plan.js";

export function lesbarFuerBackup(pfad: string, verzeichnis = false) {
  chmodSync(pfad, verzeichnis ? 0o700 : 0o600);
  if (process.getuid?.() === 0) chownSync(pfad, 1000, 1000);
}

export function backupVorbereiten(instanz: string, ziel: string, empfaenger: string) {
  if (!/^age1[0-9a-z]{58}$/.test(empfaenger)) throw new Error("Oeffentlicher age-Recovery-Empfaenger fehlt oder ist ungueltig");
  if (!isAbsolute(ziel)) throw new Error("Backup-Ziel muss ein absoluter lokaler Pfad sein; S3 separat konfigurieren");
  if (existsSync(ziel) && (lstatSync(ziel).isSymbolicLink() || !lstatSync(ziel).isDirectory() || readdirSync(ziel).length)) throw new Error("Backup-Ziel muss ein neues oder leeres eigenes Verzeichnis sein");
  const p = instanzPfade(instanz), d = join(p.etc, "backup");
  mkdirSync(d, { mode: 0o700 }); lesbarFuerBackup(d, true);
  const zielPfad = resolve(ziel);
  if (!existsSync(zielPfad)) mkdirSync(zielPfad, { recursive: true, mode: 0o700 });
  lesbarFuerBackup(zielPfad, true);
  writeFileSync(join(d, "restic_passwort"), randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  writeFileSync(join(d, "empfaenger"), empfaenger, { mode: 0o600, flag: "wx" });
  writeFileSync(join(d, "backup.env"), "", { mode: 0o600, flag: "wx" });
  return { PLANORA_BACKUP_ENV: join(d, "backup.env"), PLANORA_BACKUP_DATEIEN: d, PLANORA_BACKUP_ZIEL: zielPfad };
}

/** Materialisiert ausschliesslich die wirklich verwendeten Werte, keine neue Recovery-Identity. */
export function backupKonfigurieren(instanz: string, instanzId: string, release?: string, datenbank?: string) {
  if (!/^[0-9a-f-]{36}$/i.test(instanzId)) throw new Error("Instanz-ID fuer Backup ungueltig");
  const p = instanzPfade(instanz), w = leseEnv(p.envDatei), d = join(p.etc, "backup");
  if (!w.PLANORA_BACKUP_ENV) return;
  const secret = (name: string) => readFileSync(join(p.secrets, name), "utf8").trim();
  const dbName = datenbank ?? w.PLANORA_DB_NAME ?? "planora";
  const dbUrl = (rolle: string, passwort: string) => `postgres://${rolle}:${encodeURIComponent(passwort)}@db:5432/${encodeURIComponent(dbName)}`;
  const konfiguration = { format: 1, instanzId, domain: w.PLANORA_DOMAIN,
    tls: w.PLANORA_TLS === "internal" ? "internal" : w.PLANORA_TLS === KUNDENZERTIFIKAT_TLS || w.PLANORA_TLS?.startsWith("/zertifikat/") ? "kundenzertifikat" : "acme", profil: "P1", zeitzone: "Europe/Zurich",
    ...(existsSync(join(d, "konfiguration.json")) ? JSON.parse(readFileSync(join(d, "konfiguration.json"), "utf8")) : {}), release: release ?? w.PLANORA_RELEASE };
  const dbRollen = Object.fromEntries(["app", "migrator", "backup", "betrieb"].map((r) => [`planora_${r}`, secret(`db_${r}_passwort`)]));
  const passwort = readFileSync(join(d, "restic_passwort"), "utf8").trim();
  const dateien: Record<string, string> = {
    "konfiguration.json": JSON.stringify(konfiguration),
    "inventar.json": JSON.stringify({ format: 1, instanzId, restic: { repository: "/ziel/restic", passwort }, zielCredentials: {},
      appSecrets: { auth: secret("auth_secret"), db_superuser_passwort: secret("db_superuser_passwort") }, dbRollen }),
    "betrieb_db": dbUrl("planora_betrieb", dbRollen.planora_betrieb), "backup_db": dbUrl("planora_backup", dbRollen.planora_backup),
  };
  for (const [name, inhalt] of Object.entries(dateien)) { schreibeAtomar(join(d, name), inhalt); lesbarFuerBackup(join(d, name)); }
  lesbarFuerBackup(join(d, "restic_passwort")); lesbarFuerBackup(join(d, "empfaenger"));
  // Vom Betreiber gesetzte Betriebswerte (Retention, M1-Abnahme Punkt 3) bei jeder Neukonfiguration erhalten.
  const betreiber = existsSync(w.PLANORA_BACKUP_ENV) ? Object.fromEntries(Object.entries(leseEnv(w.PLANORA_BACKUP_ENV)).filter(([k]) => k.startsWith("PLANORA_RETENTION_"))) : {};
  schreibeEnv(w.PLANORA_BACKUP_ENV, { ...betreiber,
    PLANORA_BETRIEB_DB_FILE: "/run/backup/betrieb_db", PLANORA_BACKUP_DB_FILE: "/run/backup/backup_db",
    PLANORA_KONFIGURATION_FILE: "/run/backup/konfiguration.json", PLANORA_INVENTAR_FILE: "/run/backup/inventar.json",
    PLANORA_RECOVERY_EMPFAENGER_FILE: "/run/backup/empfaenger", RESTIC_PASSWORD_FILE: "/run/backup/restic_passwort",
    RESTIC_REPOSITORY: "/ziel/restic", PLANORA_RELEASE: konfiguration.release,
    PLANORA_RESTORE_KONFIGURATION_PFAD: "/ausgabe/konfiguration.json", PLANORA_RESTORE_INVENTAR_PFAD: "/ausgabe/inventar.json",
    PLANORA_RECOVERY_KEY_PFAD: "/run/recovery.key",
  });
}
