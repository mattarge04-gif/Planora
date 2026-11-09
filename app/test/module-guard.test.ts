import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import Fastify from "fastify";
import { frischeDb } from "./hilfe.js";
import { registriereModulGuard, schalteEin, schalteAus, modulAktiv } from "../src/module/schalter.js";
import { randomUUID } from "node:crypto";

let db: Awaited<ReturnType<typeof frischeDb>>;
const apps: ReturnType<typeof Fastify>[] = [];
beforeAll(async () => { db = await frischeDb(); });
afterAll(async () => { await db.ende(); });
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

function server(stufe: 1|2|3) {
  const app = Fastify();
  apps.push(app);
  registriereModulGuard(app, db.pool, stufe);
  app.get("/api/hinweise/liste", async () => ({ ok: true }));
  app.get("/api/szene/x", async () => ({ ok: true }));
  app.get("/api/suche/x", async () => ({ ok: true }));
  app.get("/api/export/x", async () => ({ ok: true }));
  app.get("/api/hinweise", async () => ({ ok: true }));
  return app;
}

describe("Modul-Guard", () => {
  it("Option aus → 404 auch bei direktem Aufruf; Kern immer erreichbar", async () => {
    const app = server(2);
    expect((await app.inject("/api/hinweise/liste")).statusCode).toBe(404);
    expect((await app.inject("/api/szene/x")).statusCode).toBe(200);
  });
  it("Einschalten mit Abhaengigkeit, Abschalten mit Kaskade in einer Transaktion, auditiert", async () => {
    const a = randomUUID();
    await expect(schalteEin(db.pool, "hinweise", 2, a)).rejects.toThrow(/braucht lebensdauer/);
    await schalteEin(db.pool, "lebensdauer", 2, a); await schalteEin(db.pool, "hinweise", 2, a);
    const app = server(2);
    expect((await app.inject("/api/hinweise/liste")).statusCode).toBe(200);
    const aus = await schalteAus(db.pool, "lebensdauer", a);
    expect(aus.sort()).toEqual(["hinweise", "lebensdauer"]);
    expect((await app.inject("/api/hinweise/liste")).statusCode).toBe(404);
    const n = (await db.pool.query("select count(*)::int n from audit_eintrag where art like 'modul.%'")).rows[0].n;
    expect(n).toBe(4); // 2x ein, 2x aus
  });
  it("nicht geliefertes Modul → 404 und nicht einschaltbar", async () => {
    expect((await server(2).inject("/api/suche/x")).statusCode).toBe(404);
    expect((await server(1).inject("/api/export/x")).statusCode).toBe(404);
    await expect(schalteEin(db.pool, "suche", 2, randomUUID())).rejects.toThrow(/nicht geliefert/);
  });
  it("Kernmodule sind auch ueber den Abschaltpfad nicht schaltbar", async () => {
    await expect(schalteAus(db.pool, "szene", randomUUID())).rejects.toThrow(/kern nicht schaltbar/);
  });
  it("rollt die ganze Kaskade samt Audit bei einem Audit-Fehler zurueck", async () => {
    const a = randomUUID();
    await schalteEin(db.pool, "lebensdauer", 2, a);
    await schalteEin(db.pool, "hinweise", 2, a);
    const vorher = (await db.pool.query("select count(*)::int n from audit_eintrag")).rows[0].n;
    await db.pool.query(`create function audit_ablehnen() returns trigger language plpgsql as $$
      begin if new.art='modul.aus' and new.daten->>'id'='hinweise' then raise exception 'Audit unmoeglich'; end if; return new; end $$;
      create trigger audit_ablehnen before insert on audit_eintrag for each row execute function audit_ablehnen()`);
    try {
      await expect(schalteAus(db.pool, "lebensdauer", a)).rejects.toThrow(/Audit unmoeglich/);
      expect((await db.pool.query("select modul_id from modul_schalter where aktiv order by modul_id")).rows.map((r) => r.modul_id)).toEqual(["hinweise", "lebensdauer"]);
      expect((await db.pool.query("select count(*)::int n from audit_eintrag")).rows[0].n).toBe(vorher);
    } finally {
      await db.pool.query("drop trigger audit_ablehnen on audit_eintrag; drop function audit_ablehnen()");
      await schalteAus(db.pool, "lebensdauer", a);
    }
  });
  it("DB-Fehler im Guard → 503", async () => {
    const app = Fastify();
    apps.push(app);
    const kaputt = { connect: async () => { throw new Error("db weg"); } } as any;
    registriereModulGuard(app, kaputt, 2);
    app.get("/api/hinweise/liste", async () => ({ ok: true }));
    expect((await app.inject("/api/hinweise/liste")).statusCode).toBe(503);
  });
  it("prueft auch einen SQL-Fehler und Modulwurzeln geschlossen", async () => {
    const app = server(2);
    await db.pool.query("alter table modul_schalter rename to modul_schalter_weg");
    try { expect((await app.inject("/api/hinweise?seite=1")).statusCode).toBe(503); }
    finally { await db.pool.query("alter table modul_schalter_weg rename to modul_schalter"); }
  });
  it("kein Cache: Aenderung direkt in der DB wirkt bei naechster Anfrage", async () => {
    const app = server(2);
    await db.pool.query("insert into modul_schalter(modul_id, aktiv) values ('lebensdauer', true) on conflict (modul_id) do update set aktiv=true");
    await db.pool.query("insert into modul_schalter(modul_id, aktiv) values ('hinweise', true) on conflict (modul_id) do update set aktiv=true");
    expect((await app.inject("/api/hinweise/liste")).statusCode).toBe(200);
    await db.pool.query("update modul_schalter set aktiv=false where modul_id='hinweise'");
    expect((await app.inject("/api/hinweise/liste")).statusCode).toBe(404);
    const c = await db.pool.connect(); try { expect(await modulAktiv(c, "hinweise", 2)).toBe(false); } finally { c.release(); }
  });
});
