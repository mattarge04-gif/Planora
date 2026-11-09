import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import { frischeDb } from "./hilfe.js";
import { pruefe, setzeRolle, MATRIX, type Rolle } from "../src/rechte/rechte.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

let db: Awaited<ReturnType<typeof frischeDb>>; let c: pg.PoolClient;
let L1: string, L2: string, leser: string, bearb: string, betreiber: string, admin: string, ohneRolle: string;

// Benutzer direkt per SQL wie loeseSetupTokenEin, ohne Token
async function benutzer(name: string, rolle?: Rolle, liegenschaften: string[] = []) {
  const id = randomUUID(), audit = randomUUID(), jetzt = new Date();
  await db.pool.query(`insert into "user"(id, name, email, email_verified, created_at, updated_at) values ($1,$2,$3,true,$4,$4)`, [id, name, `${name}@planora.invalid`, jetzt]);
  await db.pool.query("insert into konto_status(benutzer_id, status, audit_id) values ($1,'aktiv',$2)", [id, audit]);
  if (rolle) await db.pool.query("insert into rolle_zuordnung(benutzer_id, rolle) values ($1,$2)", [id, rolle]);
  for (const l of liegenschaften) await db.pool.query("insert into rolle_liegenschaft(benutzer_id, liegenschaft_id) values ($1,$2)", [id, l]);
  return id;
}
async function sitzung(benutzerId: string) {
  await db.pool.query("insert into session(id, expires_at, token, created_at, updated_at, user_id) values ($1, now() + interval '1 hour', $2, now(), now(), $3)", [randomUUID(), randomBytes(16).toString("hex"), benutzerId]);
}
const anzahlSitzungen = async (id: string) => (await db.pool.query("select count(*)::int n from session where user_id=$1", [id])).rows[0].n as number;

beforeAll(async () => {
  db = await frischeDb();
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
  L2 = (await db.pool.query("insert into liegenschaft(name) values ('L2') returning id")).rows[0].id;
  leser = await benutzer("leser", "leser", [L1]);
  bearb = await benutzer("bearb", "bearbeiter", [L1]);
  betreiber = await benutzer("betreiber", "betreiber", [L1]);
  admin = await benutzer("admin", "admin");
  ohneRolle = await benutzer("ohnerolle");
  c = await db.pool.connect();
});
afterAll(async () => { c.release(); await db.ende(); });

describe("Rechtematrix", () => {
  it("Leser: liest im Scope, nicht in fremder Liegenschaft, schreibt nicht", async () => {
    expect(await pruefe(c, leser, "fach.lesen", L1)).toBe(true);
    expect(await pruefe(c, leser, "fach.lesen", L2)).toBe(false);
    expect(await pruefe(c, leser, "fach.aendern", L1)).toBe(false);
    expect(await pruefe(c, leser, "dokument.loeschen", L1)).toBe(false);
    expect(await pruefe(c, leser, "benutzer.verwalten")).toBe(false);
  });
  it("Bearbeiter: aendert im Scope, nicht in fremder Liegenschaft, loescht keine Dokumente", async () => {
    expect(await pruefe(c, bearb, "fach.aendern", L1)).toBe(true);
    expect(await pruefe(c, bearb, "fach.aendern", L2)).toBe(false);
    expect(await pruefe(c, bearb, "dokument.loeschen", L1)).toBe(false);
    expect(await pruefe(c, bearb, "audit.lesen")).toBe(false);
  });
  it("Fachrecht ohne Liegenschaftsangabe wird fuer Rollen mit Scope verweigert", async () => {
    expect(await pruefe(c, leser, "fach.lesen")).toBe(false);
    expect(await pruefe(c, bearb, "fach.aendern")).toBe(false);
  });
  it("Betreiber: keine Fachdaten (auch nicht mit Scope-Zeile), aber Module schalten und Audit lesen", async () => {
    expect(await pruefe(c, betreiber, "fach.lesen", L1)).toBe(false);
    expect(await pruefe(c, betreiber, "fach.aendern", L1)).toBe(false);
    expect(await pruefe(c, betreiber, "module.schalten")).toBe(true);
    expect(await pruefe(c, betreiber, "audit.lesen")).toBe(true);
    expect(await pruefe(c, betreiber, "benutzer.verwalten")).toBe(false);
  });
  it("Admin: alle Liegenschaften, Benutzer verwalten, Dokumente loeschen, aber keine Module schalten", async () => {
    expect(await pruefe(c, admin, "fach.aendern", L2)).toBe(true);
    expect(await pruefe(c, admin, "fach.lesen", L1)).toBe(true);
    expect(await pruefe(c, admin, "dokument.loeschen", L2)).toBe(true);
    expect(await pruefe(c, admin, "benutzer.verwalten")).toBe(true);
    expect(await pruefe(c, admin, "audit.lesen")).toBe(true);
    expect(await pruefe(c, admin, "module.schalten")).toBe(false);
  });
  it("Benutzer ohne Rolle und unbekannte Benutzer haben kein Recht", async () => {
    for (const r of Object.keys(MATRIX) as (keyof typeof MATRIX)[]) {
      expect(await pruefe(c, ohneRolle, r, L1)).toBe(false);
      expect(await pruefe(c, "gibt-es-nicht", r, L1)).toBe(false);
    }
  });
  it("Matrix entspricht Spec §5", () => {
    expect(MATRIX).toEqual({
      "module.schalten": ["betreiber"], "benutzer.verwalten": ["admin"], "fach.lesen": ["admin", "bearbeiter", "leser"],
      "fach.aendern": ["admin", "bearbeiter"], "dokument.loeschen": ["admin"], "audit.lesen": ["admin", "betreiber"],
    });
  });
  it("setzeRolle aendert Rolle und Scope, entzieht Sitzungen in derselben Transaktion, auditiert", async () => {
    const u = await benutzer("wechsel", "leser", [L1]);
    await sitzung(u); await sitzung(u);
    expect(await anzahlSitzungen(u)).toBe(2);
    const ausloeser = randomUUID();
    await setzeRolle(db.pool, u, "bearbeiter", [L2], ausloeser);
    expect(await anzahlSitzungen(u)).toBe(0);
    expect(await pruefe(c, u, "fach.aendern", L2)).toBe(true);
    expect(await pruefe(c, u, "fach.lesen", L1)).toBe(false); // alter Scope entfernt
    const au = (await db.pool.query("select daten from audit_eintrag where art='rolle.gesetzt' and audit_id=$1", [ausloeser])).rows;
    expect(au).toEqual([{ daten: { rolle: "bearbeiter", anzahlLiegenschaften: 1 } }]);
  });
  it("setzeRolle mit ungueltiger Liegenschaft rollt alles zurueck (Rolle, Scope, Sitzungen)", async () => {
    const u = await benutzer("rollback", "leser", [L1]);
    await sitzung(u);
    await expect(setzeRolle(db.pool, u, "bearbeiter", [randomUUID()], randomUUID())).rejects.toThrow();
    expect(await anzahlSitzungen(u)).toBe(1);
    expect(await pruefe(c, u, "fach.lesen", L1)).toBe(true);
    expect(await pruefe(c, u, "fach.aendern", L1)).toBe(false);
  });
  it("Erstadmin aus Setup-Token erhaelt Rolle admin", async () => {
    const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), "erst@planora.invalid", "Erst", randomBytes(12).toString("base64url"));
    expect((await db.pool.query("select rolle from rolle_zuordnung where benutzer_id=$1", [benutzerId])).rows[0]?.rolle).toBe("admin");
    expect(await pruefe(c, benutzerId, "benutzer.verwalten")).toBe(true);
  });
});
