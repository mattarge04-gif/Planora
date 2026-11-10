import Fastify from "fastify";
import type pg from "pg";
import { baueAuth } from "./auth/auth.js";
import { registriereAuth } from "./auth/fastify.js";
import { registriereSitzungsregeln } from "./auth/sitzung.js";
import { registriereModulGuard, schalteEin, schalteAus, aktiveOptionen } from "./module/schalter.js";
import { MANIFEST, geliefert, type ModulId, type Stufe } from "./module/manifest.js";
import { pruefe, type Recht } from "./rechte/rechte.js";
import { dateiAblage, type Ablage } from "./ablage/ablage.js";
import { wartungAktiv, wartungsLage } from "./betrieb/wartung.js";

declare module "fastify" { interface FastifyInstance { ablage: Ablage } }

// vertrauteProxies: nur Adressen des eigenen Reverse Proxy (Caddy im Compose-Netz); leer = Client-IP nur aus dem Socket (PP7-5)
export type ServerOptionen = { pool: pg.Pool; stufe: Stufe; baseURL: string; secret: string; ablageWurzel: string; vertrauteProxies?: string[]; release?: string };

const MUTIEREND = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function baueServer(o: ServerOptionen) {
  const app = Fastify({ logger: false, trustProxy: o.vertrauteProxies?.length ? o.vertrauteProxies : false });
  const auth = baueAuth(o.pool, { baseURL: o.baseURL, secret: o.secret });
  app.decorate("ablage", dateiAblage(o.ablageWurzel, { pool: o.pool }));
  // Erster onRequest-Hook, vor Modul-Guard und Sitzungsregeln.
  // Health: ohne Auth (Proxy, Container-Healthcheck, Update-Smoke). Bewusst keine registrierte Route, sondern exakter
  // Vergleich des rohen Pfads: Guard und Sitzungsregeln gelten fuer jede registrierte /api-Route und bleiben unberuehrt.
  // 503, wenn die DB nicht antwortet; Wartung allein ist kein Fehler.
  // Wartung (Spec §8 Schritt 1, §14.4): alle Mutationen gesperrt, Abmelden bleibt moeglich. Read pro Anfrage, DB-Fehler → 503.
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "GET" && req.url.split("?", 1)[0] === "/api/health") {
      const lage = await wartungsLage(o.pool);
      return reply.code(lage.db ? 200 : 503).header("cache-control", "no-store")
        .send({ ok: lage.db, db: lage.db, wartung: lage.wartung, release: o.release ?? "unbekannt" });
    }
    if (!MUTIEREND.has(req.method)) return;
    if (req.routeOptions.url === "/api/auth/*" && (req.params as Record<string, string>)["*"] === "sign-out") return;
    if (await wartungAktiv(o.pool)) return reply.code(503).header("retry-after", "60").send({ fehler: "wartung" });
  });
  registriereModulGuard(app, o.pool, o.stufe);       // onRequest: nicht gelieferte/inaktive Module → 404, DB-Fehler → 503
  registriereAuth(app, auth, o.baseURL);              // /api/auth/*
  registriereSitzungsregeln(app, auth, o.pool, [o.baseURL]); // preHandler: Sitzung, Leerlauf, Kontostatus, Schreib-Header

  const darf = async (benutzerId: string, recht: Recht) => {
    const c = await o.pool.connect();
    try { return await pruefe(c, benutzerId, recht); } finally { c.release(); }
  };

  app.get("/api/ich", async (req) => ({ id: req.kontext!.benutzerId }));

  app.get("/api/admin/module", async (req, reply) => {
    if (!(await darf(req.kontext!.benutzerId, "module.schalten"))) return reply.code(403).send({ fehler: "keine Berechtigung" });
    const c = await o.pool.connect();
    try {
      const aktiv = await aktiveOptionen(c);
      return geliefert(o.stufe).map((m) => ({ id: m.id, art: m.art, aktiv: m.art === "kern" || aktiv.has(m.id) }));
    } finally { c.release(); }
  });

  app.post<{ Params: { id: string; aktion: string } }>("/api/admin/module/:id/:aktion", async (req, reply) => {
    if (!(await darf(req.kontext!.benutzerId, "module.schalten"))) return reply.code(403).send({ fehler: "keine Berechtigung" });
    const { id, aktion } = req.params;
    if (!MANIFEST.some((m) => m.id === id) || (aktion !== "ein" && aktion !== "aus")) return reply.code(404).send({ fehler: "nicht gefunden" });
    try {
      if (aktion === "ein") { await schalteEin(o.pool, id as ModulId, o.stufe, req.kontext!.auditId); return { ok: true }; }
      return { aus: await schalteAus(o.pool, id as ModulId, req.kontext!.auditId) };
    } catch (e) { return reply.code(409).send({ fehler: (e as Error).message }); }
  });

  // Platzhalter fuer Fachmodule bis M2–M8: erreichbar nur, wenn Guard und Sitzung sie durchlassen
  for (const m of MANIFEST) for (const r of m.routen) {
    if (r.startsWith("/api/auth") || r.startsWith("/api/admin")) continue;
    app.all(`${r.replace(/\/$/, "")}/*`, async (_req, reply) => reply.code(501).send({ fehler: "noch nicht umgesetzt" }));
  }
  return app;
}
