import pg from "pg";
import { fileURLToPath } from "node:url";
import { sichern } from "./satz.js";
import { pruefeKonfiguration } from "./konfiguration.js";
import { geheimnis, zielAusUmgebung } from "./umgebung.js";
export { geheimnis } from "./umgebung.js";
import { ageVerschluesseln } from "../journal/age.js";
import { pruefeInventar } from "./inventar.js";
export async function cli(args: string[]) {
  if(args[0]==="restore")return(await import("../restore/cli.js")).restoreCli(args.slice(1));
  if(args[0]==="freigabe")return(await import("../freigabe.js")).freigabeCli(args.slice(1));
  if(args[0]==="journal")return(await import("../journal/cli.js")).journalCli(args.slice(1));
  if(args[0]==="reconcile")return(await import("./reconcile.js")).reconcileCli(args);
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
