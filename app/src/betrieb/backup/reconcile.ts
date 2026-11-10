import pg from "pg";
import { fileURLToPath } from "node:url";
import { geheimnis } from "./cli.js";
/** Der Host muss den Containerstatus vor dem Aufruf positiv feststellen. */
export async function reconcile(pool: pg.Pool, containerLaeuft: boolean) {
  return (await pool.query("select backup_reconcile($1) anzahl",[containerLaeuft])).rows[0].anzahl as number;
}
export async function reconcileCli(args: string[]) {
  if (args.length!==3 || args[0]!=="reconcile" || args[1]!=="--container-laeuft" || !["true","false"].includes(args[2])) throw new Error("Aufruf: reconcile --container-laeuft true|false");
  const pool=new pg.Pool({connectionString:await geheimnis("PLANORA_BETRIEB_DB")});
  try { console.log(JSON.stringify({fehlgeschlagen:await reconcile(pool,args[2]==="true")})); } finally {await pool.end();}
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) reconcileCli(process.argv.slice(2)).catch(()=>{console.error("Reconcile fehlgeschlagen");process.exitCode=1;});
