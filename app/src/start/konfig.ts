import { readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";

/** Geheimnisse kommen nur aus Dateien (Compose-Secrets unter /run/secrets, Quelle /etc/planora/<instanz>/), nie aus Env oder Image. */
export function geheimnis(name: string): string {
  const verzeichnis = process.env.PLANORA_SECRETS_DIR ?? "/run/secrets";
  let wert: string;
  try { wert = readFileSync(join(verzeichnis, name), "utf8").trim(); }
  catch { throw new Error(`Secret-Datei fehlt oder ist nicht lesbar: ${name}`); } // Pfad/Name nennen, nie den Inhalt
  if (!wert) throw new Error(`Secret-Datei ist leer: ${name}`);
  return wert;
}

export function env(name: string, standard?: string): string {
  const wert = process.env[name]?.trim();
  if (wert) return wert;
  if (standard !== undefined) return standard;
  throw new Error(`Umgebungsvariable fehlt: ${name}`);
}

export type DbRolle = "planora_app" | "planora_migrator" | "planora_betrieb";
const SECRET: Record<DbRolle, string> = { planora_app: "db_app_passwort", planora_migrator: "db_migrator_passwort", planora_betrieb: "db_betrieb_passwort" };

export function dbKonfig(rolle: DbRolle): pg.PoolConfig {
  return {
    host: env("PLANORA_DB_HOST", "db"), port: Number(env("PLANORA_DB_PORT", "5432")), database: env("PLANORA_DB_NAME", "planora"),
    user: rolle, password: geheimnis(SECRET[rolle]), application_name: `planora-${process.env.PLANORA_DIENST ?? "app"}`,
  };
}

export const release = () => env("PLANORA_RELEASE", "unbekannt");

/** Zeilenweises JSON auf stdout: Docker sammelt es als Container-Log. Keine Geheimnisse, keine Personendaten. */
export function logge(ereignis: string, daten: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ zeit: new Date().toISOString(), dienst: process.env.PLANORA_DIENST ?? "app", ereignis, ...daten }));
}

/** Startet einen Einstieg; unbehandelte Fehler beenden den Prozess mit Exit 1 und nur der Meldung (kein Stack mit Konfiguration). */
export function starte(haupt: () => Promise<void>) {
  haupt().catch((e) => { logge("abbruch", { fehler: (e as Error).message }); process.exit(1); });
}
