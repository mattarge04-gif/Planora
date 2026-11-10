import pg from "pg";
import { fileURLToPath } from "node:url";
import { geheimnis, zielAusUmgebung } from "../backup/umgebung.js";
import { ageVerschluesseln } from "./age.js";
import { journalDienst, sendeJournal } from "./outbox.js";
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
