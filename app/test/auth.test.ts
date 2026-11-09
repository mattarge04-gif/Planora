import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { frischeDb } from "./hilfe.js";
import { baueAuth, registriereAuth } from "../src/auth/fastify.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3999";
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
const pw = randomBytes(12).toString("base64url"); const email = "admin@planora.invalid";
const post = (url: string, body: object, h: Record<string, string> = {}, remoteAddress = "127.0.0.1") => app.inject({ method: "POST", url, remoteAddress, headers: { "content-type": "application/json", origin: ORIGIN, ...h }, payload: JSON.stringify(body) });
const cookie = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");

beforeAll(async () => {
  db = await frischeDb();
  const auth = baueAuth(db.pool, { baseURL: ORIGIN, secret: randomBytes(32).toString("hex") });
  app = Fastify(); registriereAuth(app, auth, ORIGIN);
  app.get("/api/ich", async (req, reply) => { const s = await auth.api.getSession({ headers: new Headers(req.headers as any) }); return s ? { id: s.user.id } : reply.code(401).send(); });
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Login", () => {
  it("Selbstregistrierung ist gesperrt", async () => {
    expect((await post("/api/auth/sign-up/email", { email: "x@y.invalid", password: pw, name: "x" })).statusCode).not.toBe(200);
  });
  it("Setup-Token legt Erstadmin an, einmalig; Hash ist Argon2id (19 MiB/2/1)", async () => {
    const t = await erzeugeSetupToken(db.pool);
    await loeseSetupTokenEin(db.pool, t, email, "Admin", pw);
    await expect(loeseSetupTokenEin(db.pool, t, "b@y.invalid", "B", pw)).rejects.toThrow(/Token/);
    const h = (await db.pool.query("select password from account where provider_id='credential'")).rows[0].password;
    expect(h.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
    expect((await db.pool.query("select status from konto_status")).rows[0].status).toBe("aktiv");
  });
  it("Setup-Token wird nur gehasht gespeichert und laeuft nach 15 min ab", async () => {
    const t = await erzeugeSetupToken(db.pool);
    expect((await db.pool.query("select count(*)::int n from setup_token where hash=$1", [t])).rows[0].n).toBe(0);
    const r = (await db.pool.query("select extract(epoch from gueltig_bis - now())::int s from setup_token where not eingeloest")).rows[0];
    expect(r.s).toBeGreaterThan(14 * 60); expect(r.s).toBeLessThanOrEqual(15 * 60);
    await db.pool.query("update setup_token set gueltig_bis = now() - interval '1 second' where not eingeloest");
    await expect(loeseSetupTokenEin(db.pool, t, "c@y.invalid", "C", pw)).rejects.toThrow(/Token/);
  });
  it("Login ok, falsches Passwort 401, fremder Origin 403", async () => {
    expect((await post("/api/auth/sign-in/email", { email, password: pw })).statusCode).toBe(200);
    expect((await post("/api/auth/sign-in/email", { email, password: "x" + pw })).statusCode).toBe(401);
    expect((await post("/api/auth/sign-in/email", { email, password: pw }, { origin: "https://boese.example" })).statusCode).toBe(403);
  });
  it("Passwortwechsel mit revokeOtherSessions widerruft andere Sitzungen", async () => {
    const a = cookie(await post("/api/auth/sign-in/email", { email, password: pw }));
    const b = cookie(await post("/api/auth/sign-in/email", { email, password: pw }));
    const neu = randomBytes(12).toString("base64url");
    expect((await post("/api/auth/change-password", { currentPassword: pw, newPassword: neu, revokeOtherSessions: true }, { cookie: a })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/ich", headers: { cookie: b } })).statusCode).toBe(401);
    await post("/api/auth/change-password", { currentPassword: neu, newPassword: pw, revokeOtherSessions: true }, { cookie: cookie(await post("/api/auth/sign-in/email", { email, password: neu })) });
  });
  it("Sitzung laeuft absolut nach 12 h ab (expiresIn ohne Verlaengerung)", async () => {
    const c = cookie(await post("/api/auth/sign-in/email", { email, password: pw }));
    const s = (await db.pool.query("select expires_at, created_at from session order by created_at desc limit 1")).rows[0];
    expect(Math.round((s.expires_at - s.created_at) / 1000)).toBe(43200);
    await db.pool.query("update session set expires_at = now() - interval '1 second'");
    expect((await app.inject({ url: "/api/ich", headers: { cookie: c } })).statusCode).toBe(401);
  });
  it("Rate-Limit wirkt auch unter NODE_ENV=test: 10 Login-Versuche / 15 min je IP, dann 429 (Speicher DB)", async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < 10; i++) expect((await post("/api/auth/sign-in/email", { email, password: "falsch" + i }, {}, ip)).statusCode).toBe(401);
    const r = await post("/api/auth/sign-in/email", { email, password: pw }, {}, ip);
    expect(r.statusCode).toBe(429);
    expect(Number(r.headers["x-retry-after"])).toBeGreaterThan(14 * 60);
    expect((await db.pool.query("select count(*)::int n from rate_limit")).rows[0].n).toBeGreaterThan(0);
    // andere IP ist nicht betroffen
    expect((await post("/api/auth/sign-in/email", { email, password: pw }, {}, "203.0.113.8")).statusCode).toBe(200);
  });
  it("PP7-5: Client-IP kommt aus dem Socket; wechselnder X-Forwarded-For umgeht das IP-Limit nicht", async () => {
    const r: number[] = [];
    for (let i = 0; i < 12; i++) r.push((await post("/api/auth/sign-in/email", { email: `spoof${i}@planora.invalid`, password: "falsch" }, { "x-forwarded-for": `203.0.113.${100 + i}`, "x-real-ip": `203.0.113.${100 + i}`, "x-planora-client-ip": `203.0.113.${100 + i}` }, "192.0.2.50")).statusCode);
    expect(r.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(r.slice(10)).toEqual([429, 429]);
    // andere Socket-Adresse ist nicht betroffen
    expect((await post("/api/auth/sign-in/email", { email, password: pw }, {}, "192.0.2.51")).statusCode).toBe(200);
  });
  it("Reset-Anfragen: 3 / h je IP, dann 429", async () => {
    const ip = "203.0.113.9";
    for (let i = 0; i < 3; i++) expect((await post("/api/auth/request-password-reset", { email: "niemand@planora.invalid" }, {}, ip)).statusCode).not.toBe(429);
    expect((await post("/api/auth/request-password-reset", { email: "niemand@planora.invalid" }, {}, ip)).statusCode).toBe(429);
  });
});
