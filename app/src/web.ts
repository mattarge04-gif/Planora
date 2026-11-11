import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

/** CSP fuer die ausgelieferte Seite (M2b-1 Spec §4.4), ohne unsafe-inline: React setzt Stile per CSSOM. */
export const WEB_CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const LANG = "public, max-age=31536000, immutable";

function webPfadErlaubt(url: string): boolean {
  try {
    const pfad = decodeURIComponent(url.split("?", 1)[0]);
    return !/^\/api(?:[\\/]|$)/i.test(pfad) && !pfad.split(/[\\/]/).some((teil) => teil.startsWith("."));
  } catch {
    return false;
  }
}

/** Liefert das gebaute Frontend aus; nur wenn <wurzel>/index.html existiert. /api bleibt unberuehrt. */
export async function registriereWeb(app: FastifyInstance, wurzel: string): Promise<boolean> {
  if (!existsSync(join(wurzel, "index.html"))) return false;
  await app.register(fastifyStatic, {
    root: wurzel,
    prefix: "/",
    index: ["index.html"],
    dotfiles: "ignore",
    allowedPath: (_pfad, _wurzel, req) => webPfadErlaubt(req.url),
    // @fastify/static 10 uebergibt hier die FastifyReply (nicht das Node-Response-Objekt)
    setHeaders(reply, pfad) {
      reply.header("content-security-policy", WEB_CSP);
      const relativ = relative(wurzel, pfad).split(sep).join("/");
      reply.header("cache-control", /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^/.]+$/.test(relativ) ? LANG : "no-cache");
    },
  });
  app.setNotFoundHandler((req, reply) => {
    const istSeite = (req.method === "GET" || req.method === "HEAD") && webPfadErlaubt(req.url);
    if (!istSeite) return reply.code(404).send({ fehler: "nicht gefunden" });
    return reply.header("content-security-policy", WEB_CSP).header("cache-control", "no-cache").type("text/html; charset=utf-8").sendFile("index.html");
  });
  return true;
}
