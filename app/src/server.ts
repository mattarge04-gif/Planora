import Fastify, { type FastifyError } from "fastify";
import type pg from "pg";
import { baueAuth } from "./auth/auth.js";
import { registriereAuth } from "./auth/fastify.js";
import { registriereSitzungsregeln } from "./auth/sitzung.js";
import { registriereModulGuard, schalteEin, schalteAus, aktiveOptionen } from "./module/schalter.js";
import { MANIFEST, geliefert, type ModulId, type Stufe } from "./module/manifest.js";
import { pruefe, type Recht } from "./rechte/rechte.js";
import { dateiAblage, type Ablage } from "./ablage/ablage.js";
import { wartungAktiv, wartungsLage } from "./betrieb/wartung.js";
import { bestaetigeRestoreKonto } from "./betrieb/freigabe.js";
import { registriereWeltRouten } from "./welt/routen.js";
import { registriereLebensdauerRouten } from "./lebensdauer/routen.js";
import { join } from "node:path";
import { registriereDokumentRouten } from "./dokumente/routen.js";
import { registriereBestandRouten } from "./bestand/routen.js";
import { erzeugePruefer, raeumeAbgelehnteAuf } from "./dokumente/pruefer.js";
import { clamdScanner } from "./dokumente/clamd.js";
import { scannerKonfig, type VirenScanner } from "./dokumente/scanner.js";
import { registrierePreisdokumentRouten } from "./preisdokument/routen.js";
import { registriereSucheRouten } from "./suche/routen.js";
import { erzeugeLaeufer, markiereAbgebrochen } from "./preisdokument/laeufer.js";
import { openaiAdapter } from "./preisdokument/openai.js";
import type { LeseAdapter } from "./preisdokument/adapter.js";
import { registriereWeb } from "./web.js";

declare module "fastify" { interface FastifyInstance { ablage: Ablage } }

// vertrauteProxies: nur Adressen des eigenen Reverse Proxy (Caddy im Compose-Netz); leer = Client-IP nur aus dem Socket (PP7-5)
export type ServerOptionen = { pool: pg.Pool; stufe: Stufe; baseURL: string; secret: string; ablageWurzel: string; vertrauteProxies?: string[]; release?: string; /** gebautes Frontend; fehlt das Verzeichnis, wird nichts ausgeliefert */ webWurzel?: string; /** Tests injizieren hier einen Fake; undefined = Adapter aus OPENAI_API_KEY, null = aus */ leseAdapter?: LeseAdapter | null; /** Tests injizieren einen Fake; sonst clamd aus PLANORA_CLAMD_HOST; ohne beides wirft baueServer (nie ein stiller Fake) */ virenScanner?: VirenScanner; /** false (Update-Smoke): keine Hintergrundarbeit (Pruefer-Requeue, Bereinigung, Leser-Reset); Standard true */ hintergrund?: boolean };

const MUTIEREND = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function baueServer(o: ServerOptionen) {
  // ajv strikt (kein removeAdditional, kein coerceTypes): Strukturfehler → 400, nichts stillschweigend entfernen oder umwandeln.
  // Kuenftige Querystring-/Params-Schemas muessen daher Strings erwarten oder eine eigene Konvertierung haben.
  const app = Fastify({ logger: false, trustProxy: o.vertrauteProxies?.length ? o.vertrauteProxies : false,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  // Einheitliches Fehlerformat fuer Schemafehler (M2b-1 Spec §4.3): wie fachliche Fehler { fehler: [{ pfad, code, meldung }] }.
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err.validation) {
      return reply.code(400).send({
        fehler: err.validation.map((v) => ({ pfad: `${err.validationContext ?? "body"}${v.instancePath ?? ""}`, code: "struktur_ungueltig", meldung: v.message ?? "ungueltig" })),
      });
    }
    throw err; // alle anderen Fehler wie bisher (Fastify-Standard)
  });
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

  app.get("/api/admin/benutzer", async (req, reply) => {
    if (!(await darf(req.kontext!.benutzerId, "benutzer.verwalten"))) return reply.code(403).send({ fehler: "keine Berechtigung" });
    return (await o.pool.query("select restore_admin_uebersicht($1) daten", [req.kontext!.benutzerId])).rows[0].daten;
  });
  app.post<{ Params: { id: string } }>("/api/admin/benutzer/:id/bestaetigen", async (req, reply) => {
    if (!(await darf(req.kontext!.benutzerId, "benutzer.verwalten"))) return reply.code(403).send({ fehler: "keine Berechtigung" });
    try { await bestaetigeRestoreKonto(o.pool, req.kontext!.benutzerId, req.params.id); return { ok: true }; }
    catch { return reply.code(409).send({ fehler: "Konto kann nicht bestaetigt werden; Host-Freigabe und Kontostatus pruefen" }); }
  });

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

  registriereWeltRouten(app, o.pool); // M2a: /api/struktur/… (Huelle, Beschreibung), /api/szene/…/welt
  // Anlagenakte (E46): Quarantaene + Virenpruefung im Hintergrund (max. 2), Neustart reiht offene Pruefungen neu ein.
  const quarantaene = dateiAblage(join(o.ablageWurzel, "quarantaene"));
  const clamd = scannerKonfig(process.env);
  const hintergrund = o.hintergrund !== false;
  // Nie ein stiller Fake: ohne Injektion und ohne clamd-Konfiguration kein Server (ausser ohne Hintergrundarbeit, dann lehnt der Scanner jede Pruefung ab).
  const scanner: VirenScanner = o.virenScanner ?? (clamd ? clamdScanner(clamd)
    : hintergrund ? (() => { throw new Error("PLANORA_CLAMD_HOST fehlt: Virenpruefung ist Pflicht"); })()
      : { pruefe: () => Promise.reject(new Error("Virenpruefung nicht konfiguriert")) });
  const pruefer = erzeugePruefer(o.pool, app.ablage, quarantaene, scanner);
  const bereinige = () => void raeumeAbgelehnteAuf(o.pool, quarantaene).catch(() => {});
  if (hintergrund) {
    void pruefer.reiheNeuEin().catch(() => {}); // DB evtl. nicht erreichbar (Wartung): Start nicht blockieren
    bereinige();
  }
  const bereinigungsTakt = hintergrund ? setInterval(bereinige, 24 * 60 * 60 * 1000) : undefined;
  bereinigungsTakt?.unref();
  // Holt Pruefungen nach, wenn die DB beim Start fehlte (laufende ueberspringt der Pruefer selbst).
  const nachholTakt = hintergrund ? setInterval(() => void pruefer.reiheNeuEin().catch(() => {}), 5 * 60 * 1000) : undefined;
  nachholTakt?.unref();
  app.addHook("onClose", async () => {
    if (bereinigungsTakt) clearInterval(bereinigungsTakt);
    if (nachholTakt) clearInterval(nachholTakt);
    await Promise.race([pruefer.warteLeer(), new Promise((r) => setTimeout(r, 5000).unref())]);
  });
  registriereDokumentRouten(app, o.pool, { pruefer, quarantaene }); // /api/dokumente/… (Kernmodul, immer aktiv)
  registriereBestandRouten(app, o.pool); // Datenblatt je Bauteil (Bibliothek, E46)
  registriereLebensdauerRouten(app, o.pool); // M7 Demo-Schnitt: /api/lebensdauer/… (Modul-Guard schaltet)
  // Preis aus Dokument: Hintergrundleser; ohne Schluessel kein Adapter (Status "aus")
  const schluessel = process.env.OPENAI_API_KEY?.trim();
  const leseAdapter = o.leseAdapter !== undefined ? o.leseAdapter
    : schluessel ? openaiAdapter({ apiKey: schluessel, modell: process.env.PLANORA_KI_MODELL_PREIS || "gpt-6.2-sol", basisUrl: process.env.PLANORA_KI_BASIS_URL || undefined }) : null;
  // Nicht warten: bei nicht erreichbarer oder haengender DB darf der Serverstart (Wartungsmodus) nicht blockieren.
  // Markiert auch 'neu' (Warteschlange lebt nur im Speicher), damit "Erneut lesen" angeboten wird.
  if (hintergrund) void markiereAbgebrochen(o.pool).catch(() => {});
  const laeufer = erzeugeLaeufer(o.pool, app.ablage, leseAdapter, { limitUsd: Number(process.env.PLANORA_KI_BUDGET_USD_MONAT || 20) });
  // Beim Schliessen laufende Lesungen abwarten (max. 5 s), damit sie nicht auf einen geschlossenen Pool treffen.
  app.addHook("onClose", async () => { await Promise.race([laeufer.warteLeer(), new Promise((r) => setTimeout(r, 5000).unref())]); });
  registrierePreisdokumentRouten(app, o.pool, laeufer);
  registriereSucheRouten(app, o.pool); // Schlaue Suche (E48), Option Lieferstufe 3
  // Platzhalter fuer Fachmodule bis M2–M8: erreichbar nur, wenn Guard und Sitzung sie durchlassen
  for (const m of MANIFEST) for (const r of m.routen) {
    if (r.startsWith("/api/auth") || r.startsWith("/api/admin")) continue;
    app.all(`${r.replace(/\/$/, "")}/*`, async (_req, reply) => reply.code(501).send({ fehler: "noch nicht umgesetzt" }));
  }
  if (o.webWurzel) await registriereWeb(app, o.webWurzel);
  return app;
}
