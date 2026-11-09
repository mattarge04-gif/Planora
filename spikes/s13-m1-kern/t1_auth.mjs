// T1: Better Auth + Fastify + Drizzle-Adapter (PostgreSQL), DB-Sessions ohne Cookie-Cache, Argon2id.
// Aufruf: node t1_auth.mjs
import Fastify from "fastify";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { hash as a2hash, verify as a2verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import http from "node:http";
import { startePg, speichereErgebnis } from "./db.mjs";

// --- Better-Auth-Kerntabellen (Felder nach Better-Auth-1.7-Kernschema) ---
const user = pgTable("user", { id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(), emailVerified: boolean("email_verified").notNull(), image: text("image"), createdAt: timestamp("created_at").notNull(), updatedAt: timestamp("updated_at").notNull() });
const session = pgTable("session", { id: text("id").primaryKey(), expiresAt: timestamp("expires_at").notNull(), token: text("token").notNull().unique(), createdAt: timestamp("created_at").notNull(), updatedAt: timestamp("updated_at").notNull(), ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull() });
const account = pgTable("account", { id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), userId: text("user_id").notNull(), accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: timestamp("access_token_expires_at"), refreshTokenExpiresAt: timestamp("refresh_token_expires_at"), scope: text("scope"), password: text("password"), createdAt: timestamp("created_at").notNull(), updatedAt: timestamp("updated_at").notNull() });
const verification = pgTable("verification", { id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at").notNull(), createdAt: timestamp("created_at"), updatedAt: timestamp("updated_at") });
const DDL = `
create table "user" (id text primary key, name text not null, email text not null unique, email_verified boolean not null, image text, created_at timestamp not null, updated_at timestamp not null);
create table session (id text primary key, expires_at timestamp not null, token text not null unique, created_at timestamp not null, updated_at timestamp not null, ip_address text, user_agent text, user_id text not null references "user"(id) on delete cascade);
create index on session(user_id);
create table account (id text primary key, account_id text not null, provider_id text not null, user_id text not null references "user"(id) on delete cascade, access_token text, refresh_token text, id_token text, access_token_expires_at timestamp, refresh_token_expires_at timestamp, scope text, password text, created_at timestamp not null, updated_at timestamp not null);
create table verification (id text primary key, identifier text not null, value text not null, expires_at timestamp not null, created_at timestamp, updated_at timestamp);`;

// Argon2id nach OWASP-Minimum: 19 MiB, 2 Iterationen, p=1 (Algorithm.Argon2id = 2)
const ARGON = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const hashZeiten = [];

const ORIGIN = "http://localhost:3013";
const tests = [];
const ok = (name, bestanden, detail) => { tests.push({ name, bestanden, detail }); console.log(bestanden ? "BESTANDEN" : "NICHT BESTANDEN", "-", name, JSON.stringify(detail ?? {})); };

const pgi = await startePg("t1", 54331);
const pool = new pgi.pg.Pool(pgi.cfg);
let app;
try {
  await pool.query(DDL);
  const schema = { user, session, account, verification };
  const db = drizzle(pool, { schema });
  const auth = betterAuth({
    baseURL: ORIGIN,
    secret: randomBytes(32).toString("hex"),
    trustedOrigins: [ORIGIN],
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    session: { cookieCache: { enabled: false } },
    // explizit: in NODE_ENV=test waere die Origin-Pruefung sonst per Default aus (create-context.mjs)
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: async (pw) => { const t = performance.now(); const h = await a2hash(pw, ARGON); hashZeiten.push(performance.now() - t); return h; },
        verify: async ({ hash, password }) => a2verify(hash, password),
      },
    },
  });

  app = Fastify();
  const alsHeaders = (req) => { const h = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v) h.append(k, String(v)); return h; };
  // Fastify-Anbindung nach https://better-auth.com/docs/integrations/fastify : Fastify-Request -> Fetch-Request -> auth.handler
  app.route({ method: ["GET", "POST"], url: "/api/auth/*", async handler(req, reply) {
    const res = await auth.handler(new Request(new URL(req.url, ORIGIN), { method: req.method, headers: alsHeaders(req), body: req.body ? JSON.stringify(req.body) : undefined }));
    reply.status(res.status);
    res.headers.forEach((v, k) => { if (k !== "set-cookie") reply.header(k, v); });
    const sc = res.headers.getSetCookie(); if (sc.length) reply.header("set-cookie", sc);
    return reply.send(res.body ? await res.text() : null);
  } });
  // geschuetzte Planora-Route: jede Anfrage prueft die DB-Session
  app.get("/api/ich", async (req, reply) => {
    const s = await auth.api.getSession({ headers: alsHeaders(req) });
    if (!s) return reply.code(401).send({ fehler: "nicht angemeldet" });
    return { id: s.user.id };
  });
  await app.listen({ port: 3013, host: "127.0.0.1" });

  const post = (pfad, body, extra = {}) => fetch(`${ORIGIN}${pfad}`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...extra }, body: JSON.stringify(body) });
  const cookieAus = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const ich = (cookie) => fetch(`${ORIGIN}/api/ich`, { headers: { cookie } }).then((r) => r.status);
  const pw1 = randomBytes(12).toString("base64url"), pw2 = randomBytes(12).toString("base64url");
  const email = "test@planora.invalid";

  // 1) Registrierung + Login
  const reg = await post("/api/auth/sign-up/email", { email, password: pw1, name: "Test" });
  const hashDb = (await pool.query("select password from account where provider_id='credential'")).rows[0]?.password ?? "";
  const login1 = await post("/api/auth/sign-in/email", { email, password: pw1 }); const c1 = cookieAus(login1);
  const login2 = await post("/api/auth/sign-in/email", { email, password: pw1 }); const c2 = cookieAus(login2);
  const falsch = await post("/api/auth/sign-in/email", { email, password: "falsch-" + pw1 });
  const ich1 = await ich(c1);
  ok("T1.1 Registrierung + Login, Hash ist Argon2id (19 MiB, t=2, p=1)",
    reg.status === 200 && login1.status === 200 && ich1 === 200 && falsch.status === 401 && hashDb.startsWith("$argon2id$v=19$m=19456,t=2,p=1$"),
    { registrierung: reg.status, login: login1.status, ich: ich1, falschesPasswort: falsch.status, hashPrefix: hashDb.slice(0, 31), hashMs: hashZeiten.map((x) => Math.round(x)) });

  // 2a) Widerruf: alle Sessions des Users direkt per SQL in einer Transaktion loeschen (wie Planora beim Rollenwechsel)
  const vor = [await ich(c1), await ich(c2)];
  const cl = await pool.connect();
  try { await cl.query("begin"); await cl.query(`delete from session where user_id=(select id from "user" where email=$1)`, [email]); await cl.query("commit"); } finally { cl.release(); }
  const nach = [await ich(c1), await ich(c2)];
  ok("T1.2a Widerruf per DB-DELETE wirkt bei naechster Anfrage (401)", vor.every((s) => s === 200) && nach.every((s) => s === 401), { vor, nach });

  // 2b) Widerruf ueber Better-Auth-Endpunkt /revoke-sessions (alle eigenen Sessions)
  const l3 = cookieAus(await post("/api/auth/sign-in/email", { email, password: pw1 }));
  const l4 = cookieAus(await post("/api/auth/sign-in/email", { email, password: pw1 }));
  const vor2 = [await ich(l3), await ich(l4)];
  const rv = await post("/api/auth/revoke-sessions", {}, { cookie: l3 });
  const nach2 = [await ich(l3), await ich(l4)];
  ok("T1.2b Widerruf per /revoke-sessions wirkt sofort (401 fuer alle)", rv.status === 200 && vor2.every((s) => s === 200) && nach2.every((s) => s === 401), { revoke: rv.status, vor: vor2, nach: nach2 });

  // 3) Passwortwechsel: Default (ohne revokeOtherSessions) vs. mit Flag
  const a = cookieAus(await post("/api/auth/sign-in/email", { email, password: pw1 }));
  const b = cookieAus(await post("/api/auth/sign-in/email", { email, password: pw1 }));
  const cpDefault = await post("/api/auth/change-password", { currentPassword: pw1, newPassword: pw2 }, { cookie: a });
  const bNachDefault = await ich(b), aNachDefault = await ich(a);
  const cpMit = await post("/api/auth/change-password", { currentPassword: pw2, newPassword: pw1, revokeOtherSessions: true }, { cookie: a });
  const aNeu = cookieAus(cpMit);
  const d3 = { ohneFlag_status: cpDefault.status, ohneFlag_eigeneSession: aNachDefault, ohneFlag_andereSession: bNachDefault, mitFlag_status: cpMit.status, alteSessionA: await ich(a), alteSessionB: await ich(b), neueSession: aNeu ? await ich(aNeu) : "kein Cookie" };
  ok("T1.3 Passwortwechsel mit revokeOtherSessions:true widerruft alle alten Sessions (401)", cpMit.status === 200 && d3.alteSessionA === 401 && d3.alteSessionB === 401 && d3.neueSession === 200, d3);
  ok("T1.3b Befund: Passwortwechsel OHNE Flag laesst andere Sessions gueltig (Default false)", bNachDefault === 200, { andereSession: bNachDefault });

  // 4) CSRF/Origin
  const c = cookieAus(await post("/api/auth/sign-in/email", { email, password: pw1 }));
  const fremdMitCookie = await post("/api/auth/revoke-sessions", {}, { cookie: c, origin: "https://boese.example" });
  const fremdLogin = await post("/api/auth/sign-in/email", { email, password: pw1 }, { origin: "https://boese.example" });
  const navLogin = await fetch(`${ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }, body: JSON.stringify({ email, password: pw1 }) });
  const ohneOriginMitCookie = await fetch(`${ORIGIN}/api/auth/revoke-sessions`, { method: "POST", headers: { "content-type": "application/json", cookie: c }, body: "{}" });
  // Hinweis: Node-fetch (undici) setzt selbst "sec-fetch-mode: cors" -> Better Auth erzwingt dann Origin.
  const ohneOriginOhneCookie = await fetch(`${ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: pw1 }) });
  // Nicht-Browser-Client (wie curl): kein Origin, kein Referer, kein Cookie, keine Fetch-Metadaten
  const rohLogin = await new Promise((res, rej) => { const body = JSON.stringify({ email, password: pw1 }); const r = http.request(`${ORIGIN}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } }, (x) => { x.resume(); res(x.statusCode); }); r.on("error", rej); r.end(body); });
  const d4 = { fremdOrigin_mitCookie: fremdMitCookie.status, fremdOrigin_login: fremdLogin.status, crossSiteNavigation_login: navLogin.status, ohneOrigin_mitCookie: ohneOriginMitCookie.status, ohneOrigin_fetchMitSecFetchMode_login: ohneOriginOhneCookie.status, ohneOrigin_ohneMetadaten_login_wieCurl: rohLogin, sessionNochGueltig: await ich(c) };
  ok("T1.4 CSRF/Origin: fremder Origin abgelehnt (mit Cookie, beim Login, Cross-Site-Navigation)",
    d4.fremdOrigin_mitCookie === 403 && d4.fremdOrigin_login === 403 && d4.crossSiteNavigation_login === 403 && d4.ohneOrigin_mitCookie === 403 && d4.sessionNochGueltig === 200, d4);

  speichereErgebnis("t1", { pg: pgi.version, tests, argon_ms: hashZeiten.map((x) => Math.round(x)) });
} finally {
  await app?.close(); await pool.end(); await pgi.stop();
}
