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

/**
 * Zeitgrenzen (PP9-5): ohne sie haengen Health, Mutationen und der Stopp, wenn die DB Verbindungen annimmt, aber nicht
 * antwortet. connectionTimeoutMillis = Verbindungsaufbau und Warten auf eine freie Pool-Verbindung; statement_timeout
 * bricht serverseitig ab, query_timeout clientseitig (greift auch, wenn der Server gar nicht mehr reagiert).
 * abfrageMs = 0 schaltet die Abfragegrenzen ab (Migrator: Migrationen duerfen lange laufen).
 */
export function dbKonfig(rolle: DbRolle, o: { abfrageMs?: number } = {}): pg.PoolConfig {
  const abfrageMs = o.abfrageMs ?? Number(env("PLANORA_DB_ABFRAGE_TIMEOUT_MS", "15000"));
  return {
    host: env("PLANORA_DB_HOST", "db"), port: Number(env("PLANORA_DB_PORT", "5432")), database: env("PLANORA_DB_NAME", "planora"),
    user: rolle, password: geheimnis(SECRET[rolle]), application_name: `planora-${process.env.PLANORA_DIENST ?? "app"}`,
    connectionTimeoutMillis: Number(env("PLANORA_DB_VERBINDUNG_TIMEOUT_MS", "5000")),
    ...(abfrageMs > 0 ? { statement_timeout: abfrageMs, query_timeout: abfrageMs + 1000, idle_in_transaction_session_timeout: 60_000 } : {}),
    keepAlive: true,
  };
}

/** Fuehrt Aufraeumschritte nacheinander aus, wartet aber insgesamt hoechstens maxMs (haengende Verbindungen blockieren den Stopp nicht). */
export async function beendeBegrenzt(schritte: (() => Promise<unknown>)[], maxMs: number): Promise<"fertig" | "zeit"> {
  let timer: NodeJS.Timeout | undefined;
  const alle = (async () => { for (const s of schritte) await s().catch(() => {}); return "fertig" as const; })();
  const r = await Promise.race([alle, new Promise<"zeit">((ok) => { timer = setTimeout(() => ok("zeit"), maxMs); })]);
  clearTimeout(timer);
  return r;
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
