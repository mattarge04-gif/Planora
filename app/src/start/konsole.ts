import pg from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPasswort, normalisiereEmail } from "../auth/auth.js";
import { dbKonfig, starte } from "./konfig.js";

/**
 * Host-Konsole (Spec §5 Erstadmin): laeuft als einmaliger Container `konsole` (Compose-Profil), nie im api-Container.
 *   setup-token   druckt ein Einmal-Token (15 min) auf stdout
 *   erstadmin     liest {"token","email","name","passwort"} als JSON von stdin und legt den ersten Admin an
 * DB-Rolle: planora_betrieb. Sie darf nur die SECURITY-DEFINER-Funktionen setup_token_anlegen / erstadmin_anlegen (008)
 * ausfuehren – kein DML auf Auth-Tabellen, kein DDL, kein Eigentuemer- oder Migrator-Passwort im Container (PP9-3).
 */
type Abfrage = Pick<pg.Pool, "query">;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** Token nur gehasht in die DB; der Klartext geht ausschliesslich an den Aufrufer (stdout der Konsole). */
export async function konsoleSetupToken(db: Abfrage): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.query("select setup_token_anlegen($1)", [sha(token)]);
  return token;
}

export type ErstadminEingabe = { token: string; email: string; name: string; passwort: string };
export async function konsoleErstadmin(db: Abfrage, e: Partial<Record<keyof ErstadminEingabe, unknown>>): Promise<{ benutzerId: string }> {
  for (const k of ["token", "email", "name", "passwort"] as const) if (typeof e[k] !== "string" || !e[k]) throw new Error(`Feld fehlt: ${k}`);
  if ((e.passwort as string).length < 12) throw new Error("Passwort zu kurz (mindestens 12 Zeichen)");
  const benutzerId = randomUUID();
  try {
    await db.query("select erstadmin_anlegen($1,$2,$3,$4,$5,$6)",
      [sha(e.token as string), benutzerId, e.name, normalisiereEmail(e.email), await hashPasswort(e.passwort as string), randomUUID()]);
  } catch (f) {
    // nur die Meldung der Funktion weitergeben (kein SQL, keine Parameter)
    throw new Error((f as Error).message);
  }
  return { benutzerId };
}

async function stdinText(): Promise<string> {
  const teile: Buffer[] = [];
  for await (const t of process.stdin) teile.push(t as Buffer);
  return Buffer.concat(teile).toString("utf8");
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/start/konsole.js")) starte(async () => {
  const befehl = process.argv[2];
  if (befehl !== "setup-token" && befehl !== "erstadmin") throw new Error("Aufruf: konsole setup-token | erstadmin (JSON auf stdin)");
  const pool = new pg.Pool({ ...dbKonfig("planora_betrieb"), max: 1 });
  try {
    if (befehl === "setup-token") { process.stdout.write((await konsoleSetupToken(pool)) + "\n"); return; }
    let e: Partial<ErstadminEingabe>;
    try { e = JSON.parse(await stdinText()); } catch { throw new Error("stdin ist kein JSON"); }
    const r = await konsoleErstadmin(pool, e ?? {});
    process.stdout.write(JSON.stringify({ ok: true, benutzerId: r.benutzerId }) + "\n");
  } finally { await pool.end().catch(() => {}); }
});
