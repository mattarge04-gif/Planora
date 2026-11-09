import type pg from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPasswort } from "./auth.js";
import { auditEreignis } from "../audit/audit.js";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
export async function erzeugeSetupToken(pool: pg.Pool) {
  const t = randomBytes(24).toString("base64url");
  await pool.query("insert into setup_token(hash, gueltig_bis) values ($1, now() + interval '15 minutes')", [sha(t)]);
  return t;
}
export async function loeseSetupTokenEin(pool: pg.Pool, token: string, email: string, name: string, passwort: string) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const r = await c.query("update setup_token set eingeloest=true where hash=$1 and not eingeloest and gueltig_bis > now() returning hash", [sha(token)]);
    if (r.rowCount !== 1) throw new Error("Token ungueltig oder abgelaufen");
    const id = randomUUID(), audit = randomUUID(), jetzt = new Date();
    await c.query(`insert into "user"(id, name, email, email_verified, created_at, updated_at) values ($1,$2,$3,true,$4,$4)`, [id, name, email, jetzt]);
    await c.query(`insert into account(id, account_id, provider_id, user_id, password, created_at, updated_at) values ($1,$2,'credential',$2,$3,$4,$4)`, [randomUUID(), id, await hashPasswort(passwort), jetzt]);
    await c.query("insert into konto_status(benutzer_id, status, audit_id) values ($1,'aktiv',$2)", [id, audit]);
    await c.query("insert into audit_person(audit_id, benutzer_id) values ($1,$2)", [audit, id]);
    await auditEreignis(c, audit, "konto.erstadmin");
    await c.query("commit"); return { benutzerId: id };
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
