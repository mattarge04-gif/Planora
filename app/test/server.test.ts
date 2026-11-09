import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3998";
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
const pw = randomBytes(12).toString("base64url");
let ipNr = 0;
const post = (url: string, body: object, h: Record<string, string> = {}) => app.inject({ method: "POST", url, headers: { "content-type": "application/json", origin: ORIGIN, ...h }, payload: JSON.stringify(body) });
const cookie = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
async function login(email: string) {
  const r = await post("/api/auth/sign-in/email", { email, password: pw }, { "x-forwarded-for": `203.0.113.${++ipNr}` });
  expect(r.statusCode).toBe(200);
  return cookie(r);
}

beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer({ pool: db.pool, stufe: 2, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
  await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), "admin@planora.invalid", "Admin", pw);
  const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), "betrieb@planora.invalid", "Betrieb", pw);
  await db.pool.query("update rolle_zuordnung set rolle='betreiber' where benutzer_id=$1", [benutzerId]);
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Server", () => {
  it("angemeldeter Admin erreicht /api/ich, darf aber keine Module schalten", async () => {
    const c = await login("admin@planora.invalid");
    expect((await app.inject({ url: "/api/ich", headers: { cookie: c } })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/admin/module", headers: { cookie: c } })).statusCode).toBe(403);
  });
  it("ohne Anmeldung 401", async () => {
    expect((await app.inject({ url: "/api/ich" })).statusCode).toBe(401);
  });
  it("Betreiber schaltet lebensdauer ein; Route danach erreichbar (501 statt 404)", async () => {
    const c = await login("betrieb@planora.invalid");
    expect((await app.inject({ url: "/api/lebensdauer/x", headers: { cookie: c } })).statusCode).toBe(404);
    const liste = await app.inject({ url: "/api/admin/module", headers: { cookie: c } });
    expect(liste.statusCode).toBe(200);
    expect(liste.json().find((m: any) => m.id === "lebensdauer").aktiv).toBe(false);
    const ohneHeader = await post("/api/admin/module/lebensdauer/ein", {}, { cookie: c });
    expect(ohneHeader.statusCode).toBe(403);
    const ein = await post("/api/admin/module/lebensdauer/ein", {}, { cookie: c, "x-planora-request": "1" });
    expect(ein.statusCode).toBe(200);
    expect((await app.inject({ url: "/api/lebensdauer/x", headers: { cookie: c } })).statusCode).toBe(501);
  });
  it("Abhaengigkeit fehlt → 409; Stufe-3-Modul in Stufe-2-Release → 404", async () => {
    const c = await login("betrieb@planora.invalid");
    await post("/api/admin/module/lebensdauer/aus", {}, { cookie: c, "x-planora-request": "1" });
    expect((await post("/api/admin/module/hinweise/ein", {}, { cookie: c, "x-planora-request": "1" })).statusCode).toBe(409);
    expect((await app.inject({ url: "/api/suche/x", headers: { cookie: c } })).statusCode).toBe(404);
  });
});
