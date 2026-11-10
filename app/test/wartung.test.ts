import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { baueServer } from "../src/server.js";
import { neuerPool } from "../src/db/pool.js";
import { wartungAktiv } from "../src/betrieb/wartung.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

const ORIGIN = "http://localhost:3997";
const VERBOTEN = /permission denied|keine Berechtigung/i;
let db: Awaited<ReturnType<typeof frischeDb>>; let app: FastifyInstance; let cookie = "";
const pw = randomBytes(12).toString("base64url");
const optionen = (pool: pg.Pool) => ({ pool, stufe: 2 as const, baseURL: ORIGIN, secret: randomBytes(32).toString("hex"), ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")), release: "test-1" });
const post = (url: string, body: object, h: Record<string, string> = {}) => app.inject({ method: "POST", url, headers: { "content-type": "application/json", origin: ORIGIN, ...h }, payload: JSON.stringify(body) });
const alsBetrieb = async (sql: string) => {
  const c = await db.pool.connect();
  try { await c.query("set role planora_betrieb"); return await c.query(sql); } finally { await c.query("reset role"); c.release(); }
};
const anmelden = async () => {
  const r = await post("/api/auth/sign-in/email", { email: "betrieb@planora.invalid", password: pw });
  expect(r.statusCode).toBe(200);
  return ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
};

beforeAll(async () => {
  db = await frischeDb();
  app = await baueServer(optionen(db.pool));
  const { benutzerId } = await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), "betrieb@planora.invalid", "Betrieb", pw);
  await db.pool.query("update rolle_zuordnung set rolle='betreiber' where benutzer_id=$1", [benutzerId]);
  cookie = await anmelden();
});
afterAll(async () => { await app.close(); await db.ende(); });

describe("Health", () => {
  it("antwortet ohne Anmeldung mit ok, db, wartung und release", async () => {
    const r = await app.inject({ url: "/api/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, db: true, wartung: false, release: "test-1" });
  });
  it("bleibt waehrend der Wartung 200 und meldet wartung: true", async () => {
    await alsBetrieb("select setze_wartung(true)");
    try {
      const r = await app.inject({ url: "/api/health" });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toMatchObject({ ok: true, wartung: true });
    } finally { await alsBetrieb("select setze_wartung(false)"); }
  });
  it("die uebrigen Routen bleiben hinter Modul-Guard und Sitzungsregeln", async () => {
    expect((await app.inject({ url: "/api/ich" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/suche/x", headers: { cookie } })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/health/x" })).statusCode).toBe(404);
  });
});

describe("Wartungsflag", () => {
  it("Migration 008 legt das Flag mit false an", async () => {
    expect((await db.pool.query("select wert from instanz_einstellung where schluessel='wartung'")).rows[0].wert).toBe(false);
    expect(await wartungAktiv(db.pool)).toBe(false);
  });
  it("planora_app liest das Flag, darf es aber weder per Funktion noch per DML setzen", async () => {
    const appPool = neuerPool(db.cfg, "planora_app");
    const c = await appPool.connect();
    try {
      expect((await c.query("select current_user u")).rows[0].u).toBe("planora_app");
      expect(await wartungAktiv(c)).toBe(false);
      await expect(c.query("select setze_wartung(true)")).rejects.toThrow(VERBOTEN);
      await expect(c.query("update instanz_einstellung set wert='true' where schluessel='wartung'")).rejects.toThrow(VERBOTEN);
      await expect(c.query("select betrieb_ereignis('x', '{}')")).rejects.toThrow(VERBOTEN);
    } finally { c.release(); await appPool.end(); }
  });
  it("planora_betrieb setzt das Flag nur ueber setze_wartung; jeder Wechsel steht im Audit", async () => {
    await expect(alsBetrieb("update instanz_einstellung set wert='true' where schluessel='wartung'")).rejects.toThrow(VERBOTEN);
    await alsBetrieb("select setze_wartung(true)");
    expect(await wartungAktiv(db.pool)).toBe(true);
    await alsBetrieb("select setze_wartung(false)");
    expect(await wartungAktiv(db.pool)).toBe(false);
    const arten = (await db.pool.query("select art from audit_eintrag where art like 'betrieb.wartung.%' order by id desc limit 2")).rows.map((r) => r.art);
    expect(arten).toEqual(["betrieb.wartung.aus", "betrieb.wartung.ein"]);
  });
  it("fehlende Zeile oder fremder Wert gilt als Wartung (geschlossen)", async () => {
    const fake = (rows: unknown[]) => ({ query: async () => ({ rows }) }) as unknown as pg.Pool;
    expect(await wartungAktiv(fake([]))).toBe(true);
    expect(await wartungAktiv(fake([{ wert: "false" }]))).toBe(true);
    expect(await wartungAktiv(fake([{ wert: true }]))).toBe(true);
    expect(await wartungAktiv(fake([{ wert: false }]))).toBe(false);
  });
  it("blockt waehrend der Wartung alle mutierenden Methoden mit 503; GET und Abmelden bleiben", async () => {
    const kopf = { cookie, "x-planora-request": "1" };
    expect((await post("/api/admin/module/lebensdauer/ein", {}, kopf)).statusCode).toBe(200);
    await alsBetrieb("select setze_wartung(true)");
    try {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
        const r = await app.inject({ method, url: "/api/admin/module/lebensdauer/aus", headers: { ...kopf, origin: ORIGIN } });
        expect(r.statusCode, method).toBe(503);
        expect(r.json()).toEqual({ fehler: "wartung" });
      }
      // auch Anmelden ist eine Mutation (neue Sitzung) und bleibt gesperrt
      expect((await post("/api/auth/sign-in/email", { email: "betrieb@planora.invalid", password: pw })).statusCode).toBe(503);
      // nichts wurde veraendert, Lesen geht weiter
      const liste = await app.inject({ url: "/api/admin/module", headers: { cookie } });
      expect(liste.statusCode).toBe(200);
      expect(liste.json().find((m: any) => m.id === "lebensdauer").aktiv).toBe(true);
      expect((await app.inject({ url: "/api/ich", headers: { cookie } })).statusCode).toBe(200);
      // Abmelden bleibt erlaubt
      expect((await post("/api/auth/sign-out", {}, { cookie })).statusCode).toBe(200);
      expect((await app.inject({ url: "/api/ich", headers: { cookie } })).statusCode).toBe(401);
    } finally { await alsBetrieb("select setze_wartung(false)"); }
    cookie = await anmelden();
  });
  it("nur exakt sign-out ist frei; kodierte oder verlaengerte Pfade bleiben gesperrt", async () => {
    await alsBetrieb("select setze_wartung(true)");
    try {
      expect((await post("/api/auth/sign-out/x", {})).statusCode).toBe(503);
      expect((await post("/api/auth/%73ign-in/email", { email: "betrieb@planora.invalid", password: pw })).statusCode).toBe(503);
    } finally { await alsBetrieb("select setze_wartung(false)"); }
  });
});

describe("DB-Fehler", () => {
  it("DB nicht erreichbar → Mutation 503 (geschlossen), Health 503 mit db: false", async () => {
    const tot = new pg.Pool({ host: "127.0.0.1", port: 1, user: "x", password: "x", database: "x", connectionTimeoutMillis: 1000 });
    tot.on("error", () => {});
    const kaputt = await baueServer(optionen(tot));
    try {
      expect(await wartungAktiv(tot)).toBe(true);
      const m = await kaputt.inject({ method: "POST", url: "/api/admin/module/lebensdauer/ein", headers: { origin: ORIGIN, "x-planora-request": "1" } });
      expect(m.statusCode).toBe(503);
      expect(m.json()).toEqual({ fehler: "wartung" });
      const h = await kaputt.inject({ url: "/api/health" });
      expect(h.statusCode).toBe(503);
      expect(h.json()).toMatchObject({ ok: false, db: false, wartung: true });
    } finally { await kaputt.close(); await tot.end(); }
  });
});
