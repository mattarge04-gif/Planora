// PP9-3: Host-Konsole arbeitet mit planora_betrieb und nur ueber die SECURITY-DEFINER-Funktionen aus 008.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { konsoleErstadmin, konsoleSetupToken } from "../src/start/konsole.js";

const ORIGIN = "http://localhost:3996";
const VERBOTEN = /permission denied|keine Berechtigung/i;
let db: Awaited<ReturnType<typeof frischeDb>>; let betrieb: pg.Pool; let app: FastifyInstance;
const pw = randomBytes(12).toString("base64url");

beforeAll(async () => {
  db = await frischeDb();
  betrieb = new pg.Pool({ ...db.cfg, max: 2 });
  betrieb.on("connect", (c) => { c.query("set role planora_betrieb").catch(() => {}); });
  app = await baueServer({ pool: db.pool, stufe: 1, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")) });
});
afterAll(async () => { await app.close(); await betrieb.end(); await db.ende(); });

describe("Host-Konsole mit Betriebsrolle", () => {
  it("Setup-Token → Erstadmin → Login; Token nur gehasht gespeichert und nur einmal einloesbar", async () => {
    expect((await betrieb.query("select current_user u")).rows[0].u).toBe("planora_betrieb");
    const token = await konsoleSetupToken(betrieb);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect((await db.pool.query("select count(*)::int n from setup_token where hash = $1", [token])).rows[0].n).toBe(0);
    const { benutzerId } = await konsoleErstadmin(betrieb, { token, email: " Admin@Planora.Invalid ", name: "Admin", passwort: pw });
    const k = (await db.pool.query(`select u.email, ks.status, rz.rolle, a.password from "user" u join konto_status ks on ks.benutzer_id=u.id join rolle_zuordnung rz on rz.benutzer_id=u.id join account a on a.user_id=u.id where u.id=$1`, [benutzerId])).rows[0];
    expect(k).toMatchObject({ email: "admin@planora.invalid", status: "aktiv", rolle: "admin" });
    expect(k.password).toMatch(/^\$argon2id\$/);
    const r = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { "content-type": "application/json", origin: ORIGIN }, payload: JSON.stringify({ email: "admin@planora.invalid", password: pw }) });
    expect(r.statusCode).toBe(200);
    await expect(konsoleErstadmin(betrieb, { token, email: "zwei@planora.invalid", name: "Zwei", passwort: pw })).rejects.toThrow(/Token ungueltig oder abgelaufen/);
    const arten = (await db.pool.query("select art from audit_eintrag where art in ('betrieb.setup.token','konto.erstadmin') order by id")).rows.map((x) => x.art);
    expect(arten).toEqual(["betrieb.setup.token", "konto.erstadmin"]);
  });
  it("abgelaufenes oder falsches Token, schwaches Passwort, ungueltige E-Mail → abgelehnt, nichts angelegt", async () => {
    const vorher = (await db.pool.query(`select count(*)::int n from "user"`)).rows[0].n;
    await expect(konsoleErstadmin(betrieb, { token: "falsch", email: "x@planora.invalid", name: "X", passwort: pw })).rejects.toThrow(/Token ungueltig/);
    const token = await konsoleSetupToken(betrieb);
    await db.pool.query("update setup_token set gueltig_bis = now() - interval '1 second' where not eingeloest");
    await expect(konsoleErstadmin(betrieb, { token, email: "x@planora.invalid", name: "X", passwort: pw })).rejects.toThrow(/Token ungueltig/);
    const t2 = await konsoleSetupToken(betrieb);
    await expect(konsoleErstadmin(betrieb, { token: t2, email: "x@planora.invalid", name: "X", passwort: "kurz" })).rejects.toThrow(/Passwort zu kurz/);
    await expect(konsoleErstadmin(betrieb, { token: t2, email: "keine-mail", name: "X", passwort: pw })).rejects.toThrow(/E-Mail/);
    await expect(konsoleErstadmin(betrieb, { token: t2, email: "x@planora.invalid", passwort: pw })).rejects.toThrow(/Feld fehlt: name/);
    expect((await db.pool.query(`select count(*)::int n from "user"`)).rows[0].n).toBe(vorher);
    // ein fehlgeschlagener Versuch verbraucht das Token nicht (Transaktion der Funktion rollt zurueck)
    expect((await konsoleErstadmin(betrieb, { token: t2, email: "x@planora.invalid", name: "X", passwort: pw })).benutzerId).toBeTruthy();
  });
  it("planora_betrieb hat kein DML auf Auth-Tabellen und kein DDL; planora_app darf die Setup-Funktionen nicht ausfuehren", async () => {
    await expect(betrieb.query("insert into setup_token(hash, gueltig_bis) values ('x', now())")).rejects.toThrow(VERBOTEN);
    await expect(betrieb.query(`select * from "user"`)).rejects.toThrow(VERBOTEN);
    await expect(betrieb.query("update rolle_zuordnung set rolle='admin'")).rejects.toThrow(VERBOTEN);
    await expect(betrieb.query("create table darf_nicht(x int)")).rejects.toThrow(VERBOTEN);
    await expect(betrieb.query("select setup_token_anlegen('kein-hash')")).rejects.toThrow(/Hash ungueltig/);
    const c = await db.pool.connect();
    try {
      await c.query("set role planora_app");
      await expect(c.query("select setup_token_anlegen($1)", ["a".repeat(64)])).rejects.toThrow(VERBOTEN);
      await expect(c.query("select erstadmin_anlegen('x','x','x','x@y.z','$argon2id$x', gen_random_uuid())")).rejects.toThrow(VERBOTEN);
    } finally { await c.query("reset role"); c.release(); }
  });
});
