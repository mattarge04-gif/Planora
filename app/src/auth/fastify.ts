import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Auth } from "./auth.js";
export { baueAuth } from "./auth.js";
export const alsHeaders = (req: FastifyRequest) => { const h = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v) h.append(k, String(v)); return h; };
export function registriereAuth(app: FastifyInstance, auth: Auth, baseURL: string) {
  app.route({ method: ["GET", "POST"], url: "/api/auth/*", async handler(req, reply) {
    const res = await auth.handler(new Request(new URL(req.url, baseURL), { method: req.method, headers: alsHeaders(req), body: req.body ? JSON.stringify(req.body) : undefined }));
    reply.status(res.status);
    res.headers.forEach((v, k) => { if (k !== "set-cookie") reply.header(k, v); });
    const sc = res.headers.getSetCookie(); if (sc.length) reply.header("set-cookie", sc);
    return reply.send(res.body ? await res.text() : null);
  } });
}
