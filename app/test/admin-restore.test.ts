import { expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";
import { baueServer } from "../src/server.js";
import { freigabe, loeseFreigabeTokenEin } from "../src/betrieb/freigabe.js";

it("Admin sieht Rollen/Scopes/Journal und bestaetigt restaurierte Nicht-Admins erst nach Host-Freigabe", async () => {
  const db = await frischeDb(), ablage = mkdtempSync(join(tmpdir(), "admin-restore-")), pw = randomBytes(18).toString("hex");
  const baseURL = "http://localhost:3912";
  const app = await baueServer({ pool: db.pool, stufe: 1, baseURL, secret: randomBytes(32).toString("hex"), ablageWurzel: ablage });
  try {
    const admin = (await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), "admin@restore.test", "Admin", pw)).benutzerId;
    const leser = (await loeseSetupTokenEin(db.pool, await erzeugeSetupToken(db.pool), "leser@restore.test", "Leser", pw)).benutzerId;
    await db.pool.query("update rolle_zuordnung set rolle='leser' where benutzer_id=$1", [leser]);
    const login = async (email: string) => {
      const r = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: pw }, headers: { origin: baseURL } });
      expect(r.statusCode).toBe(200);
      return ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
    };
    expect((await app.inject({ url: "/api/admin/benutzer" })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/admin/benutzer", headers: { cookie: await login("leser@restore.test") } })).statusCode).toBe(403);
    const cookie = await login("admin@restore.test");
    expect((await app.inject({ url: "/api/admin/benutzer", headers: { cookie } })).json().konten).toHaveLength(2);
    const id = (await db.pool.query("select wert from instanz_einstellung where schluessel='instanz_id'")).rows[0].wert;
    const seq = (await db.pool.query("select seq from journal_zaehler")).rows[0].seq;
    await db.pool.query("select restore_sperren($1,$2,$3)", [id, randomUUID(), seq]);
    await db.pool.query("select restore_bereit($1,now())", [seq]);
    const [t] = await freigabe(db.pool, { zeige: () => {}, bestaetige: async (k) => k.benutzerId === admin });
    await loeseFreigabeTokenEin(db.pool, t.token, pw);
    const h = { cookie: await login("admin@restore.test"), origin: baseURL, "x-planora-request": "1" };
    expect((await app.inject({ method: "POST", url: `/api/admin/benutzer/${admin}/bestaetigen`, headers: h })).statusCode).toBe(409);
    expect((await app.inject({ method: "POST", url: `/api/admin/benutzer/${leser}/bestaetigen`, headers: h })).statusCode).toBe(200);
    expect((await db.pool.query("select status from konto_status where benutzer_id=$1", [leser])).rows[0].status).toBe("aktiv");
  } finally { await app.close(); await db.ende(); rmSync(ablage, { recursive: true, force: true }); }
});
