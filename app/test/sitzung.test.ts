import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { frischeDb } from "./hilfe.js";
import { baueAuth, registriereAuth } from "../src/auth/fastify.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { registriereSitzungsregeln, setzeKontoStatus, entzieheSitzungen } from "../src/auth/sitzung.js";

const ORIGIN = "http://localhost:3999";
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance; let benutzerId: string;
const pw = randomBytes(12).toString("base64url"); const email = "admin@planora.invalid";
let ipNr = 0; // eigene Socket-Adresse je Login, damit das Login-Rate-Limit (10 / 15 min je IP) die Faelle nicht koppelt
const post = (url: string, body: object, h: Record<string, string> = {}, remoteAddress = "127.0.0.1") => app.inject({ method: "POST", url, remoteAddress, headers: { "content-type": "application/json", origin: ORIGIN, ...h }, payload: JSON.stringify(body) });
const cookie = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
const anmelden = (passwort = pw) => post("/api/auth/sign-in/email", { email, password: passwort }, {}, `198.51.100.${++ipNr}`);
const login = async () => { const r = await anmelden(); expect(r.statusCode).toBe(200); return cookie(r); };
const ich = (c: string) => app.inject({ url: "/api/ich", headers: { cookie: c } });
/** Wartet, bis eine andere Verbindung dieser DB auf eine Sperre wartet (true) oder `fertig` vorher abschliesst (false). */
async function blockiertBis<T>(fertig: Promise<T>, ms = 5000) {
  let erledigt = false; fertig.then(() => { erledigt = true; }, () => { erledigt = true; });
  const ende = Date.now() + ms;
  while (Date.now() < ende && !erledigt) {
    const n = (await db.pool.query("select count(*)::int n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'")).rows[0].n;
    if (n > 0) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}
const sitzungen = async () => (await db.pool.query("select count(*)::int n from session where user_id=$1", [benutzerId])).rows[0].n as number;

beforeAll(async () => {
  db = await frischeDb();
  const auth = baueAuth(db.pool, { baseURL: ORIGIN, secret: randomBytes(32).toString("hex") });
  app = Fastify();
  registriereAuth(app, auth, ORIGIN);
  registriereSitzungsregeln(app, auth, db.pool, [ORIGIN]);
  app.get("/api/ich", async (req) => ({ id: req.kontext!.benutzerId, auditId: req.kontext!.auditId, sessionId: req.kontext!.sessionId }));
  app.post("/api/struktur/test", async () => ({ ok: true }));
  ({ benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), email, "Admin", pw));
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Sitzungsregeln", () => {
  it("ohne Sitzung → 401; mit Sitzung → Kontext mit Benutzer, Audit-ID und Session", async () => {
    expect((await app.inject({ url: "/api/ich" })).statusCode).toBe(401);
    const c = await login();
    const r = await ich(c);
    expect(r.statusCode).toBe(200);
    const k = r.json();
    const ks = (await db.pool.query("select audit_id from konto_status where benutzer_id=$1", [benutzerId])).rows[0];
    expect(k.id).toBe(benutzerId);
    expect(k.auditId).toBe(ks.audit_id);
    expect((await db.pool.query("select user_id from session where id=$1", [k.sessionId])).rows[0].user_id).toBe(benutzerId);
  });

  it("Leerlauf > 30 min → 401, Sitzung wird geloescht", async () => {
    const c = await login();
    const sid = (await ich(c)).json().sessionId;
    await db.pool.query("update sitzung_aktivitaet set zuletzt_aktiv = now() - interval '31 minutes' where session_id=$1", [sid]);
    expect((await ich(c)).statusCode).toBe(401);
    expect((await db.pool.query("select count(*)::int n from session where id=$1", [sid])).rows[0].n).toBe(0);
    expect((await ich(c)).statusCode).toBe(401);
  });

  it("Leerlauf ohne Folgeanfrage zaehlt ab Anmeldung: Login vor 31 min, erste Anfrage → 401", async () => {
    const r = await anmelden(); expect(r.statusCode).toBe(200); const c = cookie(r);
    const n = await db.pool.query("update session set created_at = now() - interval '31 minutes' where id = (select id from session where user_id=$1 order by created_at desc limit 1) and id not in (select session_id from sitzung_aktivitaet)", [benutzerId]);
    expect(n.rowCount).toBe(1);
    expect((await ich(c)).statusCode).toBe(401);
  });

  it("Leerlauf < 30 min wird bei jeder Anfrage erneuert", async () => {
    const c = await login();
    const sid = (await ich(c)).json().sessionId;
    await db.pool.query("update sitzung_aktivitaet set zuletzt_aktiv = now() - interval '29 minutes' where session_id=$1", [sid]);
    expect((await ich(c)).statusCode).toBe(200);
    const z = (await db.pool.query("select zuletzt_aktiv > now() - interval '5 seconds' as frisch from sitzung_aktivitaet where session_id=$1", [sid])).rows[0];
    expect(z.frisch).toBe(true);
  });

  it("Kontosperre entzieht sofort alle Sitzungen und verhindert Login", async () => {
    const a = await login(); const b = await login();
    expect((await ich(a)).statusCode).toBe(200); expect((await ich(b)).statusCode).toBe(200);
    const ausloeser = randomUUID();
    await setzeKontoStatus(db.pool, benutzerId, "gesperrt", ausloeser);
    expect((await ich(a)).statusCode).toBe(401); expect((await ich(b)).statusCode).toBe(401);
    expect(await sitzungen()).toBe(0);
    // gesperrt: Login mit richtigem Passwort antwortet wie falsches Passwort, legt keine Sitzung an
    const gesperrt = await anmelden();
    const falsch = await anmelden("x" + pw);
    expect(gesperrt.statusCode).toBe(401);
    expect(gesperrt.json()).toEqual(falsch.json());
    expect(cookie(gesperrt)).not.toMatch(/session_token=[^;]+/);
    expect(await sitzungen()).toBe(0);
    expect((await ich(cookie(gesperrt))).statusCode).toBe(401);
    const au = (await db.pool.query("select daten from audit_eintrag where art='konto.status' and audit_id=$1", [ausloeser])).rows;
    expect(au.map((x) => x.daten.status)).toEqual(["gesperrt"]);
    await setzeKontoStatus(db.pool, benutzerId, "aktiv", ausloeser);
    expect((await ich(await login())).statusCode).toBe(200);
  });

  it("zu_bestaetigen verhindert Zugriff und Login (Spec §15.2)", async () => {
    const c = await login();
    await setzeKontoStatus(db.pool, benutzerId, "zu_bestaetigen", randomUUID());
    expect((await ich(c)).statusCode).toBe(401);
    expect(await sitzungen()).toBe(0);
    expect((await anmelden()).statusCode).toBe(401);
    expect(await sitzungen()).toBe(0);
    await setzeKontoStatus(db.pool, benutzerId, "aktiv", randomUUID());
  });

  it("Status ausserhalb von aktiv auch bei bestehender Sitzung ohne Entzug → 401", async () => {
    const c = await login();
    await db.pool.query("update konto_status set status='gesperrt' where benutzer_id=$1", [benutzerId]);
    try { expect((await ich(c)).statusCode).toBe(401); }
    finally { await db.pool.query("update konto_status set status='aktiv' where benutzer_id=$1", [benutzerId]); }
  });

  it("POST ohne X-Planora-Request → 403, mit Header → 200, fremder Origin → 403", async () => {
    const c = await login();
    const schreibe = (h: Record<string, string>) => app.inject({ method: "POST", url: "/api/struktur/test", headers: { "content-type": "application/json", cookie: c, ...h }, payload: "{}" });
    expect((await schreibe({ origin: ORIGIN })).statusCode).toBe(403);
    expect((await schreibe({ origin: ORIGIN, "x-planora-request": "0" })).statusCode).toBe(403);
    expect((await schreibe({ origin: ORIGIN, "x-planora-request": "1" })).statusCode).toBe(200);
    expect((await schreibe({ origin: "https://boese.example", "x-planora-request": "1" })).statusCode).toBe(403);
    expect((await schreibe({ "x-planora-request": "1" })).statusCode).toBe(403); // kein Origin
    // Header und Origin korrekt, aber keine Sitzung → 401
    expect((await app.inject({ method: "POST", url: "/api/struktur/test", headers: { "content-type": "application/json", origin: ORIGIN, "x-planora-request": "1" }, payload: "{}" })).statusCode).toBe(401);
  });

  it("entzieheSitzungen loescht alle Sitzungen des Benutzers und meldet die Anzahl", async () => {
    const a = await login(); await login();
    const vorher = await sitzungen();
    expect(vorher).toBeGreaterThanOrEqual(2);
    const c = await db.pool.connect();
    try { expect(await entzieheSitzungen(c, benutzerId)).toBe(vorher); } finally { c.release(); }
    expect(await sitzungen()).toBe(0);
    expect((await ich(a)).statusCode).toBe(401);
  });

  it("PP7-2: jede Sitzung endet spaetestens 12 h nach Anlage, auch mit rememberMe:false und frischer Aktivitaet", async () => {
    for (const rememberMe of [true, false]) {
      const r = await post("/api/auth/sign-in/email", { email, password: pw, rememberMe }, {}, `198.51.100.${++ipNr}`);
      expect(r.statusCode).toBe(200); const c = cookie(r);
      const k = (await ich(c)).json();
      const s = (await db.pool.query("select extract(epoch from expires_at - created_at)::int d from session where id=$1", [k.sessionId])).rows[0];
      expect(s.d).toBe(43200);
      // Sitzung 13 h alt, Aktivitaet frisch: muss trotzdem abgelaufen sein
      await db.pool.query("update session set created_at = created_at - interval '13 hours' where id=$1", [k.sessionId]);
      await db.pool.query("update sitzung_aktivitaet set zuletzt_aktiv = now() where session_id=$1", [k.sessionId]);
      expect((await ich(c)).statusCode).toBe(401);
    }
  });

  it("PP7-4: Sperre waehrend laufendem Login (nach Status-Lesen, vor Sitzungsanlage) → 401, keine Sitzung", async () => {
    await db.pool.query("delete from session where user_id=$1", [benutzerId]);
    const t = await db.pool.connect();
    try {
      await t.query("begin");
      await t.query("select 1 from konto_status where benutzer_id=$1 for update", [benutzerId]); // wie setzeKontoStatus
      const login = anmelden(); // Status-Pruefung im Hook liest noch 'aktiv'
      expect(await blockiertBis(login)).toBe(true); // Sitzungsanlage wartet auf den Konto-Lock
      await t.query("update konto_status set status='gesperrt' where benutzer_id=$1", [benutzerId]);
      await t.query("commit");
      const r = await login;
      expect(r.statusCode).toBe(401);
      expect(await sitzungen()).toBe(0);
    } finally {
      await t.query("rollback").catch(() => {}); // offene Transaktion nie an den Pool zurueckgeben
      t.release();
      await db.pool.query("update konto_status set status='aktiv' where benutzer_id=$1", [benutzerId]);
    }
  });

  it("PP7-4: setzeKontoStatus wartet auf eine laufende Sitzungsanlage und entzieht sie danach", async () => {
    await db.pool.query("delete from session where user_id=$1", [benutzerId]);
    const t = await db.pool.connect();
    try {
      await t.query("begin");
      await t.query("insert into session(id, expires_at, token, created_at, updated_at, user_id) values ($1, now() + interval '1 hour', $2, now(), now(), $3)", [randomUUID(), randomBytes(16).toString("hex"), benutzerId]);
      const sperre = setzeKontoStatus(db.pool, benutzerId, "gesperrt", randomUUID());
      expect(await blockiertBis(sperre)).toBe(true);
      await t.query("commit");
      await sperre;
      expect(await sitzungen()).toBe(0);
    } finally {
      await t.query("rollback").catch(() => {}); // offene Transaktion nie an den Pool zurueckgeben
      t.release();
      await setzeKontoStatus(db.pool, benutzerId, "aktiv", randomUUID());
    }
  });

  it("PP7-4: Sitzung fuer nicht aktives Konto wird von der DB abgewiesen", async () => {
    await db.pool.query("update konto_status set status='zu_bestaetigen' where benutzer_id=$1", [benutzerId]);
    try {
      await expect(db.pool.query("insert into session(id, expires_at, token, created_at, updated_at, user_id) values ($1, now() + interval '1 hour', $2, now(), now(), $3)", [randomUUID(), randomBytes(16).toString("hex"), benutzerId])).rejects.toThrow(/konto_nicht_aktiv/);
    } finally { await db.pool.query("update konto_status set status='aktiv' where benutzer_id=$1", [benutzerId]); }
  });
});
