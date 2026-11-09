import type pg from "pg";
import type { FastifyInstance } from "fastify";
import type { Auth } from "./auth.js";
import { alsHeaders } from "./fastify.js";
import { auditEreignis } from "../audit/audit.js";
export type Kontext = { benutzerId: string; auditId: string; sessionId: string };
declare module "fastify" { interface FastifyRequest { kontext?: Kontext } }
const SCHREIBEND = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const LEERLAUF = "30 minutes";

export function registriereSitzungsregeln(app: FastifyInstance, auth: Auth, pool: pg.Pool, erlaubteOrigins: string[]) {
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/api/") || req.url.startsWith("/api/auth/")) return;
    if (SCHREIBEND.has(req.method)) {
      const origin = req.headers.origin;
      if (req.headers["x-planora-request"] !== "1" || !origin || !erlaubteOrigins.includes(origin)) return reply.code(403).send({ fehler: "Anfrage abgelehnt" });
    }
    const s = await auth.api.getSession({ headers: alsHeaders(req) });
    if (!s) return reply.code(401).send({ fehler: "nicht angemeldet" });
    // Leerlauf: letzte Aktivitaet, sonst Anmeldezeitpunkt (Sitzung ohne Folgeanfrage darf nicht unbegrenzt frisch bleiben)
    const r = await pool.query(
      `select k.status, k.audit_id, coalesce(a.zuletzt_aktiv, s.created_at) > now() - interval '${LEERLAUF}' as frisch
         from konto_status k
         join session s on s.id = $2 and s.user_id = k.benutzer_id
         left join sitzung_aktivitaet a on a.session_id = s.id
        where k.benutzer_id = $1`, [s.user.id, s.session.id]);
    const z = r.rows[0];
    if (!z || z.status !== "aktiv" || !z.frisch) {
      if (z && !z.frisch) await pool.query("delete from session where id=$1", [s.session.id]);
      return reply.code(401).send({ fehler: "nicht angemeldet" });
    }
    await pool.query(
      `insert into sitzung_aktivitaet(session_id, zuletzt_aktiv) values ($1, now())
       on conflict (session_id) do update set zuletzt_aktiv = now()`, [s.session.id]);
    req.kontext = { benutzerId: s.user.id, auditId: z.audit_id, sessionId: s.session.id };
  });
}
export async function entzieheSitzungen(c: pg.ClientBase, benutzerId: string) {
  return (await c.query("delete from session where user_id=$1", [benutzerId])).rowCount ?? 0;
}
export async function setzeKontoStatus(pool: pg.Pool, benutzerId: string, status: "aktiv"|"gesperrt"|"zu_bestaetigen", auditIdAusloeser: string) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    // Konto-Lock: serialisiert mit dem Trigger session_regeln (FOR SHARE bei Sitzungsanlage) (PP7-4)
    const r = await c.query("select 1 from konto_status where benutzer_id=$1 for update", [benutzerId]);
    if (r.rowCount !== 1) throw new Error("Konto unbekannt");
    await c.query("update konto_status set status=$2 where benutzer_id=$1", [benutzerId, status]);
    if (status !== "aktiv") await entzieheSitzungen(c, benutzerId);
    await auditEreignis(c, auditIdAusloeser, "konto.status", { status });
    await c.query("commit");
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
