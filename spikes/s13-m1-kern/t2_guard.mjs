// T2: Modul-Guard ohne Prozess-Cache. Fastify-Hook liest pro Anfrage
//   select aktiv from modul_schalter where modul_id=$1
// Messung: 2000 Anfragen, 20 parallele Clients, mit/ohne Guard; deaktiviertes Modul -> 404 auch bei Direktaufruf.
// Aufruf: node t2_guard.mjs [anfragen=2000] [parallel=20]
import Fastify from "fastify";
import http from "node:http";
import { startePg, perzentil, speichereErgebnis } from "./db.mjs";

const N = Number(process.argv[2] ?? 2000), P = Number(process.argv[3] ?? 20), RUNDEN = 3;
// Modulmanifest-Auszug (Spec §4): Routen-Prefix -> Modul
const MANIFEST = [{ id: "lebensdauer", routen: ["/api/lebensdauer"] }, { id: "zustand", routen: ["/api/zustand"] }];
const modulFuer = (url) => MANIFEST.find((m) => m.routen.some((r) => url === r || url.startsWith(r + "/")))?.id;

const tests = [];
const ok = (name, bestanden, detail) => { tests.push({ name, bestanden, detail }); console.log(bestanden ? "BESTANDEN" : "NICHT BESTANDEN", "-", name, JSON.stringify(detail ?? {})); };

const pgi = await startePg("t2", 54332);
const pool = new pgi.pg.Pool({ ...pgi.cfg, max: 10 });
const apps = [];
try {
  await pool.query(`create table modul_schalter (modul_id text primary key, aktiv boolean not null, geaendert timestamptz not null default now());
    insert into modul_schalter values ('lebensdauer', true), ('zustand', false);
    create table bauteil (id serial primary key, name text); insert into bauteil(name) select 'B'||g from generate_series(1,1000) g;`);

  const baue = async (port, mitGuard) => {
    const app = Fastify();
    if (mitGuard) app.addHook("onRequest", async (req, reply) => {
      const modul = modulFuer(req.url.split("?")[0]);
      if (!modul) return; // Kernroute
      const r = await pool.query("select aktiv from modul_schalter where modul_id=$1", [modul]);
      if (!r.rows[0]?.aktiv) return reply.code(404).send({ fehler: "nicht gefunden" }); // vor Rechtepruefung, wie unbekannte Route
    });
    app.get("/api/lebensdauer/leer", async () => ({ ok: true }));                         // ohne DB-Arbeit
    app.get("/api/lebensdauer/daten", async () => (await pool.query("select id, name from bauteil where id=$1", [1 + Math.floor(Math.random() * 1000)])).rows[0]); // 1 Fachabfrage
    app.get("/api/zustand/liste", async () => ({ geheim: "darf nie kommen" }));
    await app.listen({ port, host: "127.0.0.1" }); apps.push(app); return app;
  };
  await baue(3021, false); await baue(3022, true);

  const agent = new http.Agent({ keepAlive: true, maxSockets: P });
  const get = (port, pfad) => new Promise((res, rej) => { const t = performance.now(); http.get({ host: "127.0.0.1", port, path: pfad, agent }, (r) => { r.resume(); r.on("end", () => res({ status: r.statusCode, ms: performance.now() - t })); }).on("error", rej); });
  const last = async (port, pfad, n) => {
    const zeiten = []; let i = 0, fehler = 0;
    const t0 = performance.now();
    await Promise.all(Array.from({ length: P }, async () => { while (i < n) { i++; const r = await get(port, pfad); if (r.status !== 200) fehler++; zeiten.push(r.ms); } }));
    const dauer = performance.now() - t0;
    return { n: zeiten.length, fehler, p50: +perzentil(zeiten, 50).toFixed(2), p95: +perzentil(zeiten, 95).toFixed(2), p99: +perzentil(zeiten, 99).toFixed(2), req_s: Math.round(zeiten.length / (dauer / 1000)) };
  };

  // Aufwaermen
  for (const port of [3021, 3022]) for (const pf of ["/api/lebensdauer/leer", "/api/lebensdauer/daten"]) await last(port, pf, 300);

  const messung = {};
  for (const pf of ["/api/lebensdauer/leer", "/api/lebensdauer/daten"]) {
    messung[pf] = { ohne: [], mit: [] };
    for (let r = 0; r < RUNDEN; r++) { messung[pf].ohne.push(await last(3021, pf, N)); messung[pf].mit.push(await last(3022, pf, N)); }
  }
  const med = (arr, k) => perzentil(arr.map((x) => x[k]), 50);
  const zusammen = Object.fromEntries(Object.entries(messung).map(([pf, m]) => [pf, {
    ohne_p50: med(m.ohne, "p50"), ohne_p95: med(m.ohne, "p95"), mit_p50: med(m.mit, "p50"), mit_p95: med(m.mit, "p95"),
    zuschlag_p50_ms: +(med(m.mit, "p50") - med(m.ohne, "p50")).toFixed(2), zuschlag_p95_ms: +(med(m.mit, "p95") - med(m.ohne, "p95")).toFixed(2),
    fehler: [...m.ohne, ...m.mit].reduce((s, x) => s + x.fehler, 0),
  }]));
  for (const [pf, z] of Object.entries(zusammen)) console.log(pf, JSON.stringify(z));
  // Kriterium [A, Spike-Vorschlag]: Guard-Zuschlag p95 <= 5 ms bei 20 parallelen Clients
  const zuschlagMax = Math.max(...Object.values(zusammen).map((z) => z.zuschlag_p95_ms));
  ok(`T2.1 Guard-Zuschlag p95 <= 5 ms (${N} Anfragen, ${P} parallel, Median aus ${RUNDEN} Runden)`, zuschlagMax <= 5 && Object.values(zusammen).every((z) => z.fehler === 0), { zuschlag_p95_max_ms: zuschlagMax });

  // 404 fuer deaktiviertes Modul, auch bei direktem Aufruf (ohne UI, auch mit Query/Trailing-Slash/Grossschreibung)
  const varianten = ["/api/zustand/liste", "/api/zustand/liste?x=1", "/api/zustand/liste/", "/api/zustand//liste", "/api/Zustand/liste", "/api/zustand/../zustand/liste", "/api/zustand/liste%2F"];
  const status = {}; for (const v of varianten) status[v] = (await get(3022, v)).status;
  const ohneGuard = (await get(3021, "/api/zustand/liste")).status;
  // Kontrolle: welche Varianten erreicht der Router ohne Guard ueberhaupt? (404 dort = Router, nicht Guard)
  const ohneGuardVarianten = {}; for (const v of varianten) ohneGuardVarianten[v] = (await get(3021, v)).status;
  ok("T2.2 deaktiviertes Modul: Direktaufruf liefert 404 (Varianten), Kontrolle ohne Guard 200", Object.values(status).every((s) => s === 404) && ohneGuard === 200, { mitGuard: status, ohneGuard: ohneGuardVarianten });

  // Umschalten wirkt ohne Cache sofort bei naechster Anfrage
  await pool.query("update modul_schalter set aktiv=false where modul_id='lebensdauer'");
  const nachAus = (await get(3022, "/api/lebensdauer/leer")).status;
  await pool.query("update modul_schalter set aktiv=true where modul_id='lebensdauer'");
  const nachEin = (await get(3022, "/api/lebensdauer/leer")).status;
  ok("T2.3 Umschalten wirkt bei naechster Anfrage (kein Cache)", nachAus === 404 && nachEin === 200, { nachAus, nachEin });

  agent.destroy();
  speichereErgebnis("t2", { pg: pgi.version, anfragen: N, parallel: P, runden: RUNDEN, pool_max: 10, zusammenfassung: zusammen, runden_roh: messung, tests });
} finally {
  for (const a of apps) await a.close();
  await pool.end(); await pgi.stop();
}
