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
  const wurzel = join(mkdtempSync(join(tmpdir(), "web-")), "assets");
  mkdirSync(wurzel);
  writeFileSync(join(wurzel, "index.html"), INDEX);
  mkdirSync(join(wurzel, "assets"));
  writeFileSync(join(wurzel, "assets", "index-abc12345.js"), "console.log(1)");
  writeFileSync(join(wurzel, "assets", "index-abc123.js"), "console.log(2)");
  writeFileSync(join(wurzel, "assets", "plain.js"), "console.log(3)");
  mkdirSync(join(wurzel, "assets", "nested"));
  writeFileSync(join(wurzel, "assets", "nested", "index-abc12345.js"), "console.log(4)");
  mkdirSync(join(wurzel, "api"));
  writeFileSync(join(wurzel, "api", "leak.txt"), "API-GEHEIMNIS");
  writeFileSync(join(wurzel, ".env"), "ENV-GEHEIMNIS");
  mkdirSync(join(wurzel, ".git"));
  writeFileSync(join(wurzel, ".git", "config"), "GIT-GEHEIMNIS");
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
    const r = await mitWeb.inject({ url: "/assets/index-abc12345.js" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });
  it.each(["/assets/plain.js", "/assets/index-abc123.js", "/assets/nested/index-abc12345.js"])("%s bleibt no-cache", async (url) => {
    const r = await mitWeb.inject({ url });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-cache");
  });
  it.each(["/api/leak.txt", "/%61pi/leak.txt", "/%61pi/missing", "/API/missing", "/api", "/%61pi"])("%s liefert keine Web-Datei und keinen SPA-Fallback", async (url) => {
    const r = await mitWeb.inject({ url });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ fehler: "nicht gefunden" });
  });
  it.each(["/.env", "/%2eenv", "/.git/config", "/.git/missing", "/assets/.missing"])("Dotfile-Pfad %s bleibt 404 ohne Inhalt", async (url) => {
    const r = await mitWeb.inject({ url });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ fehler: "nicht gefunden" });
  });
  it("HEAD / liefert CSP und no-cache ohne Body", async () => {
    const r = await mitWeb.inject({ method: "HEAD", url: "/" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-security-policy"]).toBe(WEB_CSP);
    expect(r.headers["cache-control"]).toBe("no-cache");
    expect(r.body).toBe("");
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
