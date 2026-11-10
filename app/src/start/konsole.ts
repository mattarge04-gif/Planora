import pg from "pg";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../auth/setup.js";
import { dbKonfig, starte } from "./konfig.js";

/**
 * Host-Konsole (Spec §5 Erstadmin): laeuft als einmaliger Container `konsole` (Compose-Profil), nie im api-Container.
 *   setup-token   druckt ein Einmal-Token (15 min) auf stdout
 *   erstadmin     liest {"token","email","name","passwort"} als JSON von stdin und legt den ersten Admin an
 * [A] DB-Rolle: planora_migrator (Eigentuemer). planora_app hat bewusst kein Recht auf setup_token; das Passwort der
 * Eigentuemerrolle liegt nur in den Secrets von migrator und konsole.
 */
async function stdinText(): Promise<string> {
  const teile: Buffer[] = [];
  for await (const t of process.stdin) teile.push(t as Buffer);
  return Buffer.concat(teile).toString("utf8");
}

starte(async () => {
  const befehl = process.argv[2];
  if (befehl !== "setup-token" && befehl !== "erstadmin") throw new Error("Aufruf: konsole setup-token | erstadmin (JSON auf stdin)");
  const pool = new pg.Pool({ ...dbKonfig("planora_migrator"), max: 1 });
  try {
    if (befehl === "setup-token") {
      // Das Token geht nur auf stdout der Konsole, nie ins Log und nur gehasht in die DB.
      process.stdout.write((await erzeugeSetupToken(pool)) + "\n");
      return;
    }
    let e: { token?: unknown; email?: unknown; name?: unknown; passwort?: unknown };
    try { e = JSON.parse(await stdinText()); } catch { throw new Error("stdin ist kein JSON"); }
    for (const k of ["token", "email", "name", "passwort"] as const) if (typeof e[k] !== "string" || !e[k]) throw new Error(`Feld fehlt: ${k}`);
    if ((e.passwort as string).length < 12) throw new Error("Passwort zu kurz (mindestens 12 Zeichen)");
    const r = await loeseSetupTokenEin(pool, e.token as string, e.email as string, e.name as string, e.passwort as string);
    process.stdout.write(JSON.stringify({ ok: true, benutzerId: r.benutzerId }) + "\n");
  } finally { await pool.end().catch(() => {}); }
});
