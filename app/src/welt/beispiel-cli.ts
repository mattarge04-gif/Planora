import pg from "pg";
import { beispielAnlegen } from "./beispiel.js";

// Nur Entwicklung: legt die Beispielliegenschaft in der Datenbank aus PLANORA_DB_URL an.
const url = process.env.PLANORA_DB_URL;
if (!url) { console.error("PLANORA_DB_URL fehlt (nur fuer Entwicklung)"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
beispielAnlegen(pool)
  .then((r) => console.log(JSON.stringify(r)), (e: Error) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
