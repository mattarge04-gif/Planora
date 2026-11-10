import pg from "pg";
import { fileURLToPath } from "node:url";
import { geheimnis } from "../backup/cli.js";
import { lokalesZiel, s3Ziel } from "../backup/ziel.js";
import { ageVerschluesseln } from "./age.js";
import { journalDienst, sendeJournal } from "./outbox.js";
export async function zielAusUmgebung() {
  if (process.env.PLANORA_ZIEL_ART === "s3") return s3Ziel({endpoint:await geheimnis("PLANORA_S3_ENDPOINT"),region:await geheimnis("AWS_REGION"),bucket:await geheimnis("PLANORA_S3_BUCKET"),accessKeyId:await geheimnis("AWS_ACCESS_KEY_ID"),secretAccessKey:await geheimnis("AWS_SECRET_ACCESS_KEY")});
  return lokalesZiel(process.env.PLANORA_OBJEKT_ZIEL ?? "/ziel");
}
export async function journalCli(args: string[]) {
  if (args.length!==1 || !["--einmal","--dienst"].includes(args[0])) throw new Error("Aufruf: journal --einmal|--dienst");
  const pool=new pg.Pool({connectionString:await geheimnis("PLANORA_BETRIEB_DB")});
  try {
    const o={pool,ziel:await zielAusUmgebung(),verschluesseln:ageVerschluesseln(await geheimnis("PLANORA_RECOVERY_EMPFAENGER")),alarm:(s:string) => console.error(s)};
    if (args[0]==="--einmal") await sendeJournal(o);
    else {
      const ende=new AbortController(); const stop=() => ende.abort();
      process.once("SIGTERM",stop); process.once("SIGINT",stop);
      try { await journalDienst(o,ende.signal); } finally { process.removeListener("SIGTERM",stop); process.removeListener("SIGINT",stop); }
    }
  } finally { await pool.end(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) journalCli(process.argv.slice(2)).catch(() => {console.error("Journal-Sicherung fehlgeschlagen");process.exitCode=1;});
