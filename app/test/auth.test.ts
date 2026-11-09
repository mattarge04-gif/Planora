import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { frischeDb } from "./hilfe.js";
import { baueAuth, registriereAuth } from "../src/auth/fastify.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3999";
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance;
const pw = randomBytes(12).toString("base64url"); const email = "admin@planora.invalid";
const post = (url: string, body: object, h: Record<string, string> = {}, remoteAddress = "127.0.0.1") => app.inject({ method: "POST", url, remoteAddress, headers: { "content-type": "application/json", origin: ORIGIN, ...h }, payload: JSON.stringify(body) });
const postausgang: { an: string; url: string }[] = [];
const cookie = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");

beforeAll(async () => {
  db = await frischeDb();
  const auth = baueAuth(db.pool, { baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), sendeReset: async (an, url) => { postausgang.push({ an, url }); } });
  app = Fastify(); registriereAuth(app, auth, ORIGIN);
  app.get("/api/ich", async (req, reply) => { const s = await auth.api.getSession({ headers: new Headers(req.headers as any) }); return s ? { id: s.user.id } : reply.code(401).send(); });
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Login", () => {
  it("Selbstregistrierung ist gesperrt", async () => {
    const r = await post("/api/auth/sign-up/email", { email: "x@y.invalid", password: pw, name: "x" });
    expect(r.statusCode).toBe(400);
    expect(r.json().code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
    expect((await db.pool.query(`select count(*)::int n from "user" where email='x@y.invalid'`)).rows[0].n).toBe(0);
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
  it("PP7-1: Passwortwechsel ohne oder mit revokeOtherSessions=false wird abgelehnt, nichts aendert sich", async () => {
    const a = cookie(await post("/api/auth/sign-in/email", { email, password: pw }));
    const b = cookie(await post("/api/auth/sign-in/email", { email, password: pw }));
    const neu = randomBytes(12).toString("base64url");
    for (const body of [{ currentPassword: pw, newPassword: neu }, { currentPassword: pw, newPassword: neu, revokeOtherSessions: false }]) {
      const r = await post("/api/auth/change-password", body, { cookie: a }, "192.0.2.11");
      expect(r.statusCode).toBe(400);
      expect(r.json().code).toBe("REVOKE_OTHER_SESSIONS_REQUIRED");
    }
    expect((await app.inject({ url: "/api/ich", headers: { cookie: b } })).statusCode).toBe(200);
    expect((await post("/api/auth/sign-in/email", { email, password: neu })).statusCode).toBe(401);
  });
  it("Sitzung laeuft absolut nach 12 h ab (expiresIn ohne Verlaengerung)", async () => {
    const c = cookie(await post("/api/auth/sign-in/email", { email, password: pw }));
    const s = (await db.pool.query("select expires_at, created_at from session order by created_at desc limit 1")).rows[0];
    expect(Math.round((s.expires_at - s.created_at) / 1000)).toBe(43200);
    await db.pool.query("update session set expires_at = now() - interval '1 second'");
    expect((await app.inject({ url: "/api/ich", headers: { cookie: c } })).statusCode).toBe(401);
  });
  it("Rate-Limit wirkt auch unter NODE_ENV=test: 10 Login-Fehlversuche / 15 min je IP, dann 429 (Speicher DB)", async () => {
    const ip = "203.0.113.7";
    // verschiedene Konten, damit die IP-Sperre geprueft wird und nicht die Kontosperre (PP7-5)
    for (let i = 0; i < 10; i++) expect((await post("/api/auth/sign-in/email", { email: `ip${i}@planora.invalid`, password: "falsch" }, {}, ip)).statusCode).toBe(401);
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
    for (let i = 0; i < 3; i++) expect((await post("/api/auth/request-password-reset", { email: "niemand@planora.invalid" }, {}, ip)).statusCode).toBe(200);
    expect((await post("/api/auth/request-password-reset", { email: "niemand@planora.invalid" }, {}, ip)).statusCode).toBe(429);
  });

  it("PP7-5: Konto-Fehlversuchssperre 10 / 15 min, unabhaengig von der IP; danach 15 min gesperrt", async () => {
    const m = "sperre@planora.invalid"; const p = randomBytes(12).toString("base64url");
    await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), m, "Sperre", p);
    for (let i = 0; i < 10; i++) expect((await post("/api/auth/sign-in/email", { email: m, password: "falsch" + i }, {}, `198.18.0.${i + 1}`)).statusCode).toBe(401);
    const r = await post("/api/auth/sign-in/email", { email: m, password: p }, {}, "198.18.0.200");
    expect(r.statusCode).toBe(429);
    expect(Number(r.headers["x-retry-after"])).toBeGreaterThan(14 * 60);
    expect(cookie(r)).not.toMatch(/session_token=[^;]+/);
    // anderes Konto von derselben IP nicht betroffen
    expect((await post("/api/auth/sign-in/email", { email, password: pw }, {}, "198.18.0.200")).statusCode).toBe(200);
    // Sperre laeuft ab
    await db.pool.query("update anmelde_fehlversuch set gesperrt_bis = now() - interval '1 second', fenster_start = now() - interval '16 minutes' where schluessel = $1", ["konto:" + m]);
    expect((await post("/api/auth/sign-in/email", { email: m, password: p }, {}, "198.18.0.201")).statusCode).toBe(200);
  });
  it("PP7-5: unbekannte E-Mail wird gleich behandelt (keine Konto-Aufzaehlung)", async () => {
    const m = "unbekannt@planora.invalid";
    for (let i = 0; i < 10; i++) expect((await post("/api/auth/sign-in/email", { email: m, password: "falsch" }, {}, `198.18.1.${i + 1}`)).statusCode).toBe(401);
    expect((await post("/api/auth/sign-in/email", { email: m.toUpperCase(), password: "falsch" }, {}, "198.18.1.200")).statusCode).toBe(429);
  });
  it("PP7-5: Zaehlung ist atomar: 20 parallele Fehlversuche → hoechstens 10 erreichen die Passwortpruefung", async () => {
    const m = "parallel@planora.invalid"; const p = randomBytes(12).toString("base64url");
    await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), m, "Parallel", p);
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) => post("/api/auth/sign-in/email", { email: m, password: "falsch" + i }, {}, `198.18.2.${i + 1}`)));
    const codes = r.map((x) => x.statusCode).sort();
    expect(codes.filter((c) => c === 401).length).toBe(10);
    expect(codes.filter((c) => c === 429).length).toBe(10);
  });

  it("PP7-6: Recovery per Reset-Link: Token nur gehasht, 30 min gueltig, einmalig, entzieht Sitzungen", async () => {
    const m = "reset@planora.invalid"; const p = randomBytes(12).toString("base64url"); const ip = "198.18.3.1";
    await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), m, "Reset", p);
    const alt = cookie(await post("/api/auth/sign-in/email", { email: m, password: p }, {}, ip));
    expect((await app.inject({ url: "/api/ich", headers: { cookie: alt } })).statusCode).toBe(200);
    expect((await post("/api/auth/request-password-reset", { email: m }, {}, ip)).statusCode).toBe(200);
    await vi.waitFor(() => expect(postausgang.some((x) => x.an === m)).toBe(true));
    const token = new URL(postausgang.filter((x) => x.an === m).at(-1)!.url).pathname.split("/").at(-1)!;
    expect(token.length).toBeGreaterThan(10);
    const v = (await db.pool.query("select identifier, value, extract(epoch from expires_at - now())::int s from verification")).rows;
    expect(v.length).toBe(1);
    expect(JSON.stringify(v)).not.toContain(token);
    expect(v[0].s).toBeGreaterThan(1790); expect(v[0].s).toBeLessThanOrEqual(1800);
    const neu = randomBytes(12).toString("base64url");
    expect((await post("/api/auth/reset-password", { newPassword: neu, token }, {}, ip)).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/ich", headers: { cookie: alt } })).statusCode).toBe(401);
    const nochmal = await post("/api/auth/reset-password", { newPassword: p, token }, {}, ip);
    expect(nochmal.statusCode).toBe(400); expect(nochmal.json().code).toBe("INVALID_TOKEN");
    expect((await post("/api/auth/sign-in/email", { email: m, password: neu }, {}, ip)).statusCode).toBe(200);
  });
  it("PP7-6: abgelaufener Reset-Token wird abgelehnt", async () => {
    const m = "reset@planora.invalid"; const ip = "198.18.3.2";
    expect((await post("/api/auth/request-password-reset", { email: m }, {}, ip)).statusCode).toBe(200);
    await vi.waitFor(() => expect(postausgang.filter((x) => x.an === m).length).toBe(2));
    const token = new URL(postausgang.filter((x) => x.an === m).at(-1)!.url).pathname.split("/").at(-1)!;
    await db.pool.query("update verification set expires_at = now() - interval '1 second'");
    const r = await post("/api/auth/reset-password", { newPassword: randomBytes(12).toString("base64url"), token }, {}, ip);
    expect(r.statusCode).toBe(400); expect(r.json().code).toBe("INVALID_TOKEN");
  });

  it("PP7-9: Passwort-Reset hebt zu_bestaetigen und gesperrt nicht auf (Spec §15.2)", async () => {
    const m = "restore@planora.invalid"; const ip = "198.18.4.1";
    const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), m, "Restore", randomBytes(12).toString("base64url"));
    for (const status of ["zu_bestaetigen", "gesperrt"]) {
      await db.pool.query("update konto_status set status=$2 where benutzer_id=$1", [benutzerId, status]);
      const vorher = postausgang.filter((x) => x.an === m).length;
      expect((await post("/api/auth/request-password-reset", { email: m }, {}, ip)).statusCode).toBe(200);
      await vi.waitFor(() => expect(postausgang.filter((x) => x.an === m).length).toBe(vorher + 1));
      const token = new URL(postausgang.filter((x) => x.an === m).at(-1)!.url).pathname.split("/").at(-1)!;
      const neu = randomBytes(12).toString("base64url");
      expect((await post("/api/auth/reset-password", { newPassword: neu, token }, {}, ip)).statusCode).toBe(200);
      expect((await db.pool.query("select status from konto_status where benutzer_id=$1", [benutzerId])).rows[0].status).toBe(status);
      const r = await post("/api/auth/sign-in/email", { email: m, password: neu }, {}, ip);
      expect(r.statusCode).toBe(401); expect(r.json().code).toBe("INVALID_EMAIL_OR_PASSWORD");
      expect((await db.pool.query("select count(*)::int n from session where user_id=$1", [benutzerId])).rows[0].n).toBe(0);
    }
  });

  it("PP7-8: Setup normalisiert die E-Mail; Login mit beliebiger Gross-/Kleinschreibung", async () => {
    const p = randomBytes(12).toString("base64url"); const ip = "198.18.5.1";
    const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), "  Mixed@Planora.Invalid ", "Mixed", p);
    expect((await db.pool.query(`select email from "user" where id=$1`, [benutzerId])).rows[0].email).toBe("mixed@planora.invalid");
    expect((await post("/api/auth/sign-in/email", { email: "Mixed@Planora.Invalid", password: p }, {}, ip)).statusCode).toBe(200);
    expect((await post("/api/auth/sign-in/email", { email: "mixed@planora.invalid", password: p }, {}, ip)).statusCode).toBe(200);
  });
  it("PP7-8: Setup mit ungueltiger E-Mail scheitert, Token bleibt einloesbar", async () => {
    const t = await erzeugeSetupToken(db.pool);
    await expect(loeseSetupTokenEin(db.pool, t, "kein-at-zeichen", "X", pw)).rejects.toThrow(/E-Mail/);
    await expect(loeseSetupTokenEin(db.pool, t, "a b@planora.invalid", "X", pw)).rejects.toThrow(/E-Mail/);
    await loeseSetupTokenEin(db.pool, t, "gueltig@planora.invalid", "X", pw);
  });
});
