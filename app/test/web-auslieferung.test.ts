import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { WEB_CSP } from "../src/web.js";

let db: Awaited<ReturnType<typeof frischeDb>>; let mitWeb: FastifyInstance; let ohneWeb: FastifyInstance;
const INDEX = '<!doctype html><html><body><div id="app"></div></body></html>';

beforeAll(async () => {
  db = await frischeDb();
  const wurzel = mkdtempSync(join(tmpdir(), "web-"));
  writeFileSync(join(wurzel, "index.html"), INDEX);
  mkdirSync(join(wurzel, "assets"));
  writeFileSync(join(wurzel, "assets", "index-abc123.js"), "console.log(1)");
  const basis = { pool: db.pool, stufe: 2 as const, baseURL: "http://localhost:3995", secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) };
  mitWeb = await baueServer({ ...basis, webWurzel: wurzel });
  ohneWeb = await baueServer({ ...basis, webWurzel: join(tmpdir(), "gibt-es-nicht-" + randomBytes(4).toString("hex")) });
});
afterAll(async () => { await mitWeb.close(); await ohneWeb.close(); await db.ende(); });

describe("Auslieferung Frontend", () => {
  it("GET / liefert index.html mit CSP und no-cache", async () => {
    const r = await mitWeb.inject({ url: "/" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/html/);
    expect(r.body).toContain('<div id="app">');
    expect(r.headers["content-security-policy"]).toBe(WEB_CSP);
    expect(r.headers["cache-control"]).toBe("no-cache");
  });
  it("unbekannter Seitenpfad faellt auf index.html zurueck", async () => {
    const r = await mitWeb.inject({ url: "/gebaeude/irgendwas" });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('<div id="app">');
    expect(r.headers["content-security-policy"]).toBe(WEB_CSP);
  });
  it("Assets mit Hash sind lange cachebar", async () => {
    const r = await mitWeb.inject({ url: "/assets/index-abc123.js" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });
  it("unbekannte API-Pfade bleiben 404 JSON, nicht index.html", async () => {
    const r = await mitWeb.inject({ url: "/api/gibt-es-nicht" });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ fehler: "nicht gefunden" });
  });
  it("nicht-GET auf Seitenpfade ergibt 404", async () => {
    expect((await mitWeb.inject({ method: "POST", url: "/irgendwas" })).statusCode).toBe(404);
  });
  it("API laeuft unveraendert", async () => {
    expect((await mitWeb.inject({ url: "/api/health" })).statusCode).toBe(200);
    expect((await mitWeb.inject({ url: "/api/ich" })).statusCode).toBe(401);
  });
  it("ohne Web-Verzeichnis keine Auslieferung", async () => {
    expect((await ohneWeb.inject({ url: "/" })).statusCode).toBe(404);
    expect((await ohneWeb.inject({ url: "/api/health" })).statusCode).toBe(200);
  });
});
