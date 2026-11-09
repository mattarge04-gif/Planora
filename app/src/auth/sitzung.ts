import type pg from "pg";
import type { FastifyInstance } from "fastify";
import type { Auth } from "./auth.js";
import { alsHeaders } from "./fastify.js";
import { auditEreignis } from "../audit/audit.js";
export type Kontext = { benutzerId: string; auditId: string; sessionId: string };
declare module "fastify" { interface FastifyRequest { kontext?: Kontext } }
const SCHREIBEND = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const LEERLAUF = "30 minutes";
/**
 * Better-Auth-Endpunkte ohne Sitzungspflicht (relativ zu /api/auth/). Alle anderen /api/auth/*-Endpunkte unterliegen
 * denselben Status-, Leerlauf- und Ablaufregeln wie Planora-Routen (PP7-3). Positivliste: neue Endpunkte sind geschuetzt.
 */
const OEFFENTLICH_AUTH = new Set(["sign-in/email", "request-password-reset", "reset-password", "ok", "error"]);
const istOeffentlicherAuthPfad = (pfad: string, methode: string) =>
  OEFFENTLICH_AUTH.has(pfad) || (methode === "GET" && /^reset-password\/[^/]+$/.test(pfad));

export function registriereSitzungsregeln(app: FastifyInstance, auth: Auth, pool: pg.Pool, erlaubteOrigins: string[]) {
  app.addHook("preHandler", async (req, reply) => {
    const route = req.routeOptions.url ?? "";
    if (!route.startsWith("/api/")) return;
    const istAuth = route === "/api/auth/*";
    // Pfad aus dem vom Router dekodierten Parameter, nicht aus der rohen URL (keine Umgehung per %-Kodierung)
    if (istAuth && istOeffentlicherAuthPfad((req.params as Record<string, string>)["*"] ?? "", req.method)) return;
    // Auth-Endpunkte: Origin/CSRF prueft Better Auth selbst; X-Planora-Request gilt fuer Planora-Routen
    if (!istAuth && SCHREIBEND.has(req.method)) {
      const origin = req.headers.origin;
      if (req.headers["x-planora-request"] !== "1" || !origin || !erlaubteOrigins.includes(origin)) return reply.code(403).send({ fehler: "Anfrage abgelehnt" });
    }
    const s = await auth.api.getSession({ headers: alsHeaders(req) });
    if (!s) return reply.code(401).send({ fehler: "nicht angemeldet" });
    // Pruefung und Aktivitaets-Upsert in einer Transaktion; FOR SHARE auf Sitzung und Konto serialisiert gegen Entzug
    // und Sperre: ein parallel committeter Entzug fuehrt zu 401 statt FK-Fehler/500 (PP7-11).
    // Leerlauf: letzte Aktivitaet, sonst Anmeldezeitpunkt (Sitzung ohne Folgeanfrage darf nicht unbegrenzt frisch bleiben)
    const c = await pool.connect();
    let z: { status: string; audit_id: string; frisch: boolean } | undefined;
    try {
      await c.query("begin");
      z = (await c.query(
        `select k.status, k.audit_id, coalesce(a.zuletzt_aktiv, s.created_at) > now() - interval '${LEERLAUF}' as frisch
           from konto_status k
           join session s on s.id = $2 and s.user_id = k.benutzer_id
           left join sitzung_aktivitaet a on a.session_id = s.id
          where k.benutzer_id = $1
          for share of s, k`, [s.user.id, s.session.id])).rows[0];
      if (z && z.status === "aktiv" && z.frisch) {
        await c.query(
          `insert into sitzung_aktivitaet(session_id, zuletzt_aktiv) values ($1, now())
           on conflict (session_id) do update set zuletzt_aktiv = now()`, [s.session.id]);
      } else if (z && !z.frisch) {
        await c.query("delete from session where id=$1", [s.session.id]);
      }
      await c.query("commit");
    } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
    if (!z || z.status !== "aktiv" || !z.frisch) return reply.code(401).send({ fehler: "nicht angemeldet" });
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
