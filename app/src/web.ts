import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

/** CSP fuer die ausgelieferte Seite (M2b-1 Spec §4.4), ohne unsafe-inline: React setzt Stile per CSSOM. */
export const WEB_CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const LANG = "public, max-age=31536000, immutable";

/** Liefert das gebaute Frontend aus; nur wenn <wurzel>/index.html existiert. /api bleibt unberuehrt. */
export async function registriereWeb(app: FastifyInstance, wurzel: string): Promise<boolean> {
  if (!existsSync(join(wurzel, "index.html"))) return false;
  await app.register(fastifyStatic, {
    root: wurzel,
    prefix: "/",
    index: ["index.html"],
    // @fastify/static 10 uebergibt hier die FastifyReply (nicht das Node-Response-Objekt)
    setHeaders(reply, pfad) {
      reply.header("content-security-policy", WEB_CSP);
      reply.header("cache-control", /[\\/]assets[\\/]/.test(pfad) ? LANG : "no-cache");
    },
  });
  app.setNotFoundHandler((req, reply) => {
    const pfad = req.url.split("?", 1)[0];
    const istSeite = (req.method === "GET" || req.method === "HEAD") && pfad !== "/api" && !pfad.startsWith("/api/");
    if (!istSeite) return reply.code(404).send({ fehler: "nicht gefunden" });
    return reply.header("content-security-policy", WEB_CSP).header("cache-control", "no-cache").type("text/html; charset=utf-8").sendFile("index.html");
  });
  return true;
}
