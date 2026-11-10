import { describe, it, expect } from "vitest";
import type pg from "pg";
import { workerSchleife } from "../src/start/worker.js";

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Worker-Platzhalter", () => {
  it("meldet Statuswechsel bereit → wartung → db_nicht_erreichbar und endet beim Abbruchsignal", async () => {
    let antwort: () => Promise<{ rows: unknown[] }> = async () => ({ rows: [{ wert: false }] });
    const pool = { query: () => antwort() } as unknown as pg.Pool;
    const status: string[] = []; const stopp = new AbortController();
    const lauf = workerSchleife(pool, { intervallMs: 10, signal: stopp.signal, melde: (s) => status.push(s) });
    await warte(50);
    antwort = async () => ({ rows: [{ wert: true }] });
    await warte(50);
    antwort = async () => { throw new Error("db weg"); };
    await warte(50);
    stopp.abort();
    await lauf;
    expect(status).toEqual(["bereit", "wartung", "db_nicht_erreichbar"]);
  });
  it("Abbruch waehrend der Wartezeit beendet sofort (SIGTERM-Pfad)", async () => {
    const pool = { query: async () => ({ rows: [{ wert: false }] }) } as unknown as pg.Pool;
    const stopp = new AbortController(); const t0 = Date.now();
    const lauf = workerSchleife(pool, { intervallMs: 60_000, signal: stopp.signal, melde: () => {} });
    await warte(20); stopp.abort(); await lauf;
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
