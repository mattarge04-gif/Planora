import { expect, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frischeDb } from "./hilfe.js";
import { anfrageMit, legeKontoAn } from "./hilfe-api.js";
import { baueServer, type ServerOptionen } from "../src/server.js";
import { fakeScanner } from "../src/dokumente/scanner.js";
import { schalteEin } from "../src/module/schalter.js";

/**
 * Aufbau fuer Ablage-Zuordnung und Suche: Gebaeude G (EG, OG1, OG2; Einheiten "Technik"/EG und "Büro B"/OG1;
 * Wärmepumpe Viessmann Vitocal 250-A und Umwälzpumpe Grundfos Magna3 32-80 in der Technik), fremdes Gebaeude G2 (Liegenschaft L2).
 * Modul suche ist eingeschaltet; extra z. B. { sucheKi } (ab Task 3).
 */
export async function starteTestServer(port: number, extra: Partial<ServerOptionen> = {}) {
  vi.stubEnv("OPENAI_API_KEY", "");
  const origin = `http://localhost:${port}`, pw = randomBytes(12).toString("base64url");
  const db = await frischeDb();
  const app: FastifyInstance = await baueServer({ pool: db.pool, stufe: 4, baseURL: origin, secret: randomBytes(32).toString("hex"),
    ablageWurzel: mkdtempSync(join(tmpdir(), "ablage-")), virenScanner: fakeScanner(), ...extra });
  await schalteEin(db.pool, "suche", 4, randomUUID());
  const anfrage = anfrageMit(app, origin);
  const konto = (email: string, rolle: string, scopes: string[]) => legeKontoAn(app, db.pool, origin, pw, email, rolle, scopes);
  const liegenschaft = async (n: string) => (await db.pool.query("insert into liegenschaft(name) values ($1) returning id", [n])).rows[0].id as string;
  const L1 = await liegenschaft("L1"), L2 = await liegenschaft("L2");
  const kBetr = await konto("betrieb@planora.invalid", "betreiber", []);
  const kBearb = await konto("bearb@planora.invalid", "bearbeiter", [L1]);
  const kLeser = await konto("leser@planora.invalid", "leser", [L1]);
  const kFremd = await konto("fremd@planora.invalid", "bearbeiter", [L2]);
  async function gebaeude(l: string, cookie: string, geschosse: string[], einheiten: { geschoss: string; bezeichnung: string; art: string }[], bauteile: object[]) {
    const id = (await anfrage("POST", `/api/struktur/liegenschaften/${l}/gebaeude`, kBetr,
      { name: "Haus", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: geschosse.map((code) => ({ code })) })).json().id as string;
    const leer = (await anfrage("GET", `/api/struktur/gebaeude/${id}/beschreibung`, cookie)).json();
    const gid = (code: string) => leer.geschosse.find((g: { code: string }) => g.code === code).id as string;
    const put = await anfrage("PUT", `/api/struktur/gebaeude/${id}/beschreibung`, cookie, { ...leer, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
      einheiten: einheiten.map((e) => ({ geschossId: gid(e.geschoss), bezeichnung: e.bezeichnung, art: e.art, flaecheM2: null })), bauteile });
    expect(put.statusCode).toBe(200);
    return { id, gid };
  }
  // Lehnt das Regelwerk Zentrale-Bauteile in "technik" ab, Standort { geschossId } des EG verwenden (STANDORT_GESCHOSS).
  const g = await gebaeude(L1, kBearb, ["EG", "OG1", "OG2"], [{ geschoss: "EG", bezeichnung: "Technik", art: "technik" }, { geschoss: "OG1", bezeichnung: "Büro B", art: "buero" }], [
    { katalogId: "heizung.waermepumpe", standort: { einheitIndex: 0 }, menge: 1, status: "bestaetigt", hersteller: "Viessmann", typ: "Vitocal 250-A", versorgt: [] },
    { katalogId: "heizung.umwaelzpumpe", standort: { einheitIndex: 0 }, menge: 1, status: "bestaetigt", hersteller: "Grundfos", typ: "Magna3 32-80", versorgt: [] }]);
  const g2 = await gebaeude(L2, kFremd, ["EG"], [{ geschoss: "EG", bezeichnung: "Lager", art: "buero" }], []);
  const eins = async (sql: string, p: unknown[]) => (await db.pool.query(sql, p)).rows[0].id as string;
  const einheit = (gebaeudeId: string, name: string) => eins("select e.id from einheit e join geschoss s on s.id=e.geschoss_id where s.gebaeude_id=$1 and e.bezeichnung=$2", [gebaeudeId, name]);
  const ids = {
    G: g.id, EG: g.gid("EG"), OG1: g.gid("OG1"), OG2: g.gid("OG2"), TECHNIK: await einheit(g.id, "Technik"),
    WP: await eins("select id from bauteil where gebaeude_id=$1 and katalog_id='heizung.waermepumpe'", [g.id]),
    PUMPE: await eins("select id from bauteil where gebaeude_id=$1 and katalog_id='heizung.umwaelzpumpe'", [g.id]),
    G2: g2.id, EG2: g2.gid("EG"), LAGER2: await einheit(g2.id, "Lager"),
  };
  const ablegen = (daten: Buffer, name: string, query = "", cookie = kBearb, gebaeudeId = ids.G) => app.inject({
    method: "POST", url: `/api/dokumente/gebaeude/${gebaeudeId}${query}`, payload: daten,
    headers: { cookie, origin, "x-planora-request": "1", "content-type": "application/octet-stream", "x-dateiname": encodeURIComponent(name) },
  });
  /** Wartet, bis `bis` fuer die Ablage-Zeile gilt (Pruefung und Auslesen laufen im Hintergrund). */
  async function warte(id: string, bis: (z: any) => boolean, gebaeudeId = ids.G, cookie = gebaeudeId === ids.G ? kBearb : kFremd) {
    for (let i = 0; i < 600; i++) {
      const z = (await anfrage("GET", `/api/dokumente/gebaeude/${gebaeudeId}`, cookie)).json().dokumente.find((x: { id: string }) => x.id === id);
      if (z && bis(z)) return z;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Zeitueberschreitung: " + id);
  }
  return { app, db, anfrage, kBearb, kLeser, kFremd, ids, ablegen, warte,
    async ende() { vi.unstubAllEnvs(); await app.close(); await db.ende(); } };
}
