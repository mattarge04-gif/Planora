import { describe, it, expect, afterEach } from "vitest";
import pg from "pg";
import { createServer, type Server, type Socket } from "node:net";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { warte, workerSchleife } from "../src/start/worker.js";
import { beendeBegrenzt } from "../src/start/konfig.js";
import { wartungsLage } from "../src/betrieb/wartung.js";
import { baueServer } from "../src/server.js";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nie = () => new Promise<never>(() => {});

/** TCP-Server, der Verbindungen annimmt und nie antwortet: eine DB, die "haengt" (PP9-5). */
async function schwarzesLoch() {
  const sockets = new Set<Socket>();
  const server: Server = createServer((s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); s.on("error", () => {}); });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const port = (server.address() as { port: number }).port;
  return { port, async zu() { for (const s of sockets) s.destroy(); await new Promise((ok) => server.close(ok)); } };
}

describe("Worker-Platzhalter", () => {
  it("meldet Statuswechsel bereit → wartung → db_nicht_erreichbar und endet beim Abbruchsignal", async () => {
    let antwort: () => Promise<{ rows: unknown[] }> = async () => ({ rows: [{ wert: false }] });
    const pool = { query: () => antwort() } as unknown as pg.Pool;
    const status: string[] = []; const stopp = new AbortController();
    const lauf = workerSchleife(pool, { intervallMs: 10, signal: stopp.signal, melde: (s) => status.push(s) });
    await pause(50);
    antwort = async () => ({ rows: [{ wert: true }] });
    await pause(50);
    antwort = async () => { throw new Error("db weg"); };
    await pause(50);
    stopp.abort();
    await lauf;
    expect(status).toEqual(["bereit", "wartung", "db_nicht_erreichbar"]);
  });
  it("Abbruch waehrend der Wartezeit beendet sofort (SIGTERM-Pfad)", async () => {
    const pool = { query: async () => ({ rows: [{ wert: false }] }) } as unknown as pg.Pool;
    const stopp = new AbortController(); const t0 = Date.now();
    const lauf = workerSchleife(pool, { intervallMs: 60_000, signal: stopp.signal, melde: () => {} });
    await pause(20); stopp.abort(); await lauf;
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it("PP9-5: Abbruch waehrend einer nie beantworteten Abfrage beendet sofort", async () => {
    const pool = { query: nie } as unknown as pg.Pool;
    const stopp = new AbortController(); const t0 = Date.now();
    const lauf = workerSchleife(pool, { intervallMs: 60_000, signal: stopp.signal, melde: () => {}, abfrageTimeoutMs: 60_000 });
    await pause(30); stopp.abort(); await lauf;
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it("PP9-5: kommt der Abbruch, bevor die Abfrage antwortet, wird das Intervall nicht mehr abgewartet und kein Status gemeldet", async () => {
    let loese!: (w: { rows: unknown[] }) => void;
    const pool = { query: () => new Promise((ok) => { loese = ok; }) } as unknown as pg.Pool;
    const status: string[] = []; const stopp = new AbortController(); const t0 = Date.now();
    const lauf = workerSchleife(pool, { intervallMs: 60_000, signal: stopp.signal, melde: (s) => status.push(s), abfrageTimeoutMs: 60_000 });
    await pause(20);
    stopp.abort();                    // Signal zuerst …
    loese({ rows: [{ wert: false }] }); // … Antwort danach
    await lauf;
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(status).toEqual([]);
  });
  it("warte() kehrt bei bereits abgebrochenem Signal sofort zurueck", async () => {
    const stopp = new AbortController(); stopp.abort();
    const t0 = Date.now(); await warte(60_000, stopp.signal);
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("beendeBegrenzt wartet haengende Schritte nicht ab", async () => {
    const t0 = Date.now();
    expect(await beendeBegrenzt([nie], 100)).toBe("zeit");
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(await beendeBegrenzt([async () => { throw new Error("egal"); }, async () => 1], 1000)).toBe("fertig");
  });
});

describe("PP9-5: DB nimmt Verbindungen an und antwortet nie", () => {
  let loch: Awaited<ReturnType<typeof schwarzesLoch>> | undefined; let pool: pg.Pool | undefined;
  afterEach(async () => { await loch?.zu(); loch = undefined; pool?.end().catch(() => {}); pool = undefined; });
  const stillerPool = async () => {
    loch = await schwarzesLoch();
    // bewusst ohne jede Zeitgrenze im Pool: die Grenze muss aus wartungsLage selbst kommen
    pool = new pg.Pool({ host: "127.0.0.1", port: loch.port, user: "x", password: "x", database: "x" });
    pool.on("error", () => {});
    return pool;
  };
  it("wartungsLage antwortet zeitbegrenzt mit db: false, wartung: true", async () => {
    const p = await stillerPool(); const t0 = Date.now();
    expect(await wartungsLage(p, 300)).toEqual({ db: false, wartung: true });
    expect(Date.now() - t0).toBeLessThan(2000);
  });
  it("Health und Mutation liefern zeitbegrenzt 503 statt offen zu bleiben", async () => {
    const p = await stillerPool();
    const app = await baueServer({ pool: p, stufe: 1, baseURL: "http://localhost:3995", secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
    try {
      const t0 = Date.now();
      const [h, m] = await Promise.all([
        app.inject({ url: "/api/health" }),
        app.inject({ method: "POST", url: "/api/admin/module/lebensdauer/ein", headers: { origin: "http://localhost:3995", "x-planora-request": "1" } }),
      ]);
      expect(h.statusCode).toBe(503);
      expect(h.json()).toMatchObject({ ok: false, db: false });
      expect(m.statusCode).toBe(503);
      expect(m.json()).toEqual({ fehler: "wartung" });
      expect(Date.now() - t0).toBeLessThan(6000); // Grenze 3 s (WARTUNG_TIMEOUT_MS) plus Reserve
    } finally { await app.close(); }
  });
  it("Worker stoppt trotz haengender DB sofort beim Signal", async () => {
    const p = await stillerPool();
    const stopp = new AbortController(); const t0 = Date.now();
    const lauf = workerSchleife(p, { intervallMs: 5000, signal: stopp.signal, melde: () => {} });
    await pause(200); stopp.abort(); await lauf;
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(await beendeBegrenzt([() => p.end()], 500)).toBe("zeit"); // pool.end() haengt – der Stopp wartet es nicht ab
  });
});
