import pg from "pg";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sichern } from "./satz.js";
import { pruefeKonfiguration } from "./konfiguration.js";
export async function geheimnis(name: string) {
  const datei = process.env[`${name}_FILE`];
  const wert = datei ? (await readFile(datei,"utf8")).trim() : process.env[name];
  if (!wert) throw new Error(`Konfiguration fehlt: ${name}`);
  return wert;
}
export async function cli(args: string[]) {
  if (args[0] !== "sichern" || args[1] !== "--anlass" || !args[2] || args.length !== 3) throw new Error("Aufruf: sichern --anlass <anlass>");
  const betrieb = new pg.Pool({ connectionString: await geheimnis("PLANORA_BETRIEB_DB") });
  try {
    const url = new URL(await geheimnis("PLANORA_BACKUP_DB"));
    const pgEnv = { PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get("sslmode") ?? "prefer" };
    const konfiguration=JSON.parse(await geheimnis("PLANORA_KONFIGURATION")); pruefeKonfiguration(konfiguration);
    const ergebnis = await sichern({ betrieb, backupDb: { connectionString: url.href }, pgEnv,
      resticEnv: { RESTIC_REPOSITORY: await geheimnis("RESTIC_REPOSITORY"), RESTIC_PASSWORD: await geheimnis("RESTIC_PASSWORD") },
      dokumente: process.env.PLANORA_DOKUMENTE ?? "/dokumente", staging: process.env.PLANORA_STAGING ?? "/staging",
      release: await geheimnis("PLANORA_RELEASE"), anlass: args[2], konfiguration,
    });
    console.log(JSON.stringify(ergebnis));
  } finally { await betrieb.end(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cli(process.argv.slice(2)).catch(() => { console.error("Backup fehlgeschlagen; Betriebsalarm: Sicherung pruefen"); process.exitCode=1; });
}
