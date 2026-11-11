import pg from "pg";
import { fileURLToPath } from "node:url";
import { sichern } from "./satz.js";
import { pruefeKonfiguration } from "./konfiguration.js";
import { geheimnis, zielAusUmgebung } from "./umgebung.js";
export { geheimnis } from "./umgebung.js";
import { ageVerschluesseln } from "../journal/age.js";
import { pruefeInventar } from "./inventar.js";
export async function cli(args: string[]) {
  if (args.length === 1 && args[0] === "initialisieren") {
    const { erfolgreich, prozess } = await import("./prozess.js");
    await erfolgreich(prozess, { programm: "restic", args: ["init"], env: { RESTIC_REPOSITORY: await geheimnis("RESTIC_REPOSITORY"), RESTIC_PASSWORD: await geheimnis("RESTIC_PASSWORD") } });
    return;
  }
  if(args[0]==="restore")return(await import("../restore/cli.js")).restoreCli(args.slice(1));
  if(args[0]==="freigabe")return(await import("../freigabe.js")).freigabeCli(args.slice(1));
  if(args[0]==="journal")return(await import("../journal/cli.js")).journalCli(args.slice(1));
  if(args[0]==="reconcile")return(await import("./reconcile.js")).reconcileCli(args);
  if(args[0]==="aufbewahren")return aufbewahrenCli(args);
  if (args[0] !== "sichern" || args[1] !== "--anlass" || !args[2] || args.length !== 3) throw new Error("Aufruf: sichern --anlass <anlass>");
  const betrieb = new pg.Pool({ connectionString: await geheimnis("PLANORA_BETRIEB_DB") });
  try {
    const url = new URL(await geheimnis("PLANORA_BACKUP_DB"));
    const pgEnv = { PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get("sslmode") ?? "prefer" };
    const konfiguration=JSON.parse(await geheimnis("PLANORA_KONFIGURATION")); pruefeKonfiguration(konfiguration);
    const inventar=JSON.parse(await geheimnis("PLANORA_INVENTAR")); pruefeInventar(inventar);
    const ergebnis = await sichern({ betrieb, backupDb: { connectionString: url.href }, pgEnv,
      resticEnv: { RESTIC_REPOSITORY: await geheimnis("RESTIC_REPOSITORY"), RESTIC_PASSWORD: await geheimnis("RESTIC_PASSWORD") },
      dokumente: process.env.PLANORA_DOKUMENTE ?? "/dokumente", staging: process.env.PLANORA_STAGING ?? "/staging",
      release: await geheimnis("PLANORA_RELEASE"), anlass: args[2], konfiguration,
      inventar:{inhalt:inventar,ziel:await zielAusUmgebung(),verschluesseln:ageVerschluesseln(await geheimnis("PLANORA_RECOVERY_EMPFAENGER"))},
    });
    console.log(JSON.stringify(ergebnis));
  } finally { await betrieb.end(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cli(process.argv.slice(2)).catch(() => { console.error(process.argv[2]==="restore"?"Restore fehlgeschlagen; Freigabe bleibt gesperrt":"Betriebsbefehl fehlgeschlagen; Betriebsalarm: Sicherung pruefen"); process.exitCode=1; });
}
/** Retention (M1-Abnahme Punkt 3): `aufbewahren`. Politik aus PLANORA_RETENTION_* ([A] Standard 14/8/12). */
export async function aufbewahrenCli(args: string[]) {
  // aufbewahren [--reserviert <backup-id>]... (Host uebergibt Saetze offener Update-/Restore-Vorgaenge)
  const reserviert: string[] = [];
  for (let n = 1; n < args.length; n += 2) {
    if (args[n] !== "--reserviert" || !args[n + 1]) throw new Error("Aufruf: aufbewahren [--reserviert <backup-id>]...");
    reserviert.push(args[n + 1]);
  }
  const { aufbewahren, pgRetentionDb, politikAusUmgebung } = await import("./retention.js");
  const politik = politikAusUmgebung();
  const konfiguration = JSON.parse(await geheimnis("PLANORA_KONFIGURATION")); pruefeKonfiguration(konfiguration);
  const pool = new pg.Pool({ connectionString: await geheimnis("PLANORA_BETRIEB_DB") });
  try {
    console.log(JSON.stringify(await aufbewahren({ db: pgRetentionDb(pool), ziel: await zielAusUmgebung(), instanzId: konfiguration.instanzId, politik, zeitzone: konfiguration.zeitzone, reserviert,
      resticEnv: { RESTIC_REPOSITORY: await geheimnis("RESTIC_REPOSITORY"), RESTIC_PASSWORD: await geheimnis("RESTIC_PASSWORD") } })));
  } finally { await pool.end(); }
}
