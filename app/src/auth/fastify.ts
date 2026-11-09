import type { FastifyInstance, FastifyRequest } from "fastify";
import { CLIENT_IP_HEADER, type Auth } from "./auth.js";
export { baueAuth } from "./auth.js";
/** Header, ueber die ein Client seine IP behaupten koennte; werden vor Better Auth entfernt. */
const IP_HEADER = ["x-forwarded-for", "x-real-ip", "forwarded", "cf-connecting-ip", "true-client-ip", CLIENT_IP_HEADER];
export const alsHeaders = (req: FastifyRequest) => { const h = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v) h.append(k, String(v)); return h; };
/**
 * Headers fuer Better Auth: Client-IP ausschliesslich aus req.ip. Ohne Fastify-Option trustProxy ist das die
 * Socket-Adresse; X-Forwarded-For wird nur ausgewertet, wenn der Server (server.ts) einen vertrauenswuerdigen Proxy
 * per trustProxy konfiguriert (PP7-5).
 */
export const authHeaders = (req: FastifyRequest) => {
  const h = alsHeaders(req);
  for (const k of IP_HEADER) h.delete(k);
  if (req.ip) h.set(CLIENT_IP_HEADER, req.ip);
  return h;
};
export function registriereAuth(app: FastifyInstance, auth: Auth, baseURL: string) {
  app.route({ method: ["GET", "POST"], url: "/api/auth/*", async handler(req, reply) {
    const res = await auth.handler(new Request(new URL(req.url, baseURL), { method: req.method, headers: authHeaders(req), body: req.body ? JSON.stringify(req.body) : undefined }));
    reply.status(res.status);
    res.headers.forEach((v, k) => { if (k !== "set-cookie") reply.header(k, v); });
    const sc = res.headers.getSetCookie(); if (sc.length) reply.header("set-cookie", sc);
    return reply.send(res.body ? await res.text() : null);
  } });
}
