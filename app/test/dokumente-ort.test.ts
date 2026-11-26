import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { starteTestServer } from "./hilfe-suche.js";
import { pdf } from "./hilfe-dateien.js";
import { EICAR } from "../src/dokumente/scanner.js";
import { schalteAus, schalteEin } from "../src/module/schalter.js";

let t: Awaited<ReturnType<typeof starteTestServer>>;
let n = 0;
const neu = () => pdf(1, `% ort ${++n}`);
const ort = (id: string, body: unknown, cookie = t.kBearb) => t.anfrage("PUT", `/api/dokumente/${id}/ort`, cookie, body);
const codes = (r: { json(): any }) => r.json().fehler.map((f: { code: string }) => f.code);

beforeAll(async () => { t = await starteTestServer(3991); });
afterAll(async () => { await t.ende(); });

describe("Ablage-Zuordnung", () => {
  it("Liste liefert Geschosse und Einheiten; neue Zeile ohne Ort, Text offen", async () => {
    const r = await t.ablegen(neu(), "a.pdf");
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ geschossId: null, einheitId: null, allgemein: false, textStatus: "offen" });
    const l = (await t.anfrage("GET", `/api/dokumente/gebaeude/${t.ids.G}`, t.kLeser)).json();
    expect(l.geschosse.map((g: { code: string }) => g.code)).toEqual(["EG", "OG1", "OG2"]);
    expect(l.einheiten).toEqual(expect.arrayContaining([{ id: t.ids.TECHNIK, geschossId: t.ids.EG, bezeichnung: "Technik" }]));
  });
  it("Ablegen mit Geschoss, Einheit oder allgemein", async () => {
    expect((await t.ablegen(neu(), "g.pdf", `?geschoss=${t.ids.OG1}`)).json().geschossId).toBe(t.ids.OG1);
    expect((await t.ablegen(neu(), "e.pdf", `?einheit=${t.ids.TECHNIK}`)).json().einheitId).toBe(t.ids.TECHNIK);
    expect((await t.ablegen(neu(), "x.pdf", "?allgemein=1")).json().allgemein).toBe(true);
    const b = (await t.ablegen(neu(), "b.pdf", `?bauteile=${t.ids.WP}&einheit=${t.ids.TECHNIK}`)).json();
    expect([b.bauteilIds, b.einheitId]).toEqual([[t.ids.WP], t.ids.TECHNIK]);
  });
  it("fremde oder mehrfache Zuordnung -> 400, nichts abgelegt", async () => {
    const vorher = (await t.anfrage("GET", `/api/dokumente/gebaeude/${t.ids.G}`, t.kBearb)).json().dokumente.length;
    const r1 = await t.ablegen(neu(), "f.pdf", `?geschoss=${t.ids.EG2}`);
    const r2 = await t.ablegen(neu(), "f.pdf", `?einheit=${t.ids.LAGER2}`);
    const r3 = await t.ablegen(neu(), "f.pdf", `?geschoss=${t.ids.EG}&allgemein=1`);
    expect([r1.statusCode, r2.statusCode, r3.statusCode]).toEqual([400, 400, 400]);
    expect([codes(r1), codes(r2), codes(r3)]).toEqual([["ort_unbekannt"], ["ort_unbekannt"], ["ort_mehrfach"]]);
    expect((await t.ablegen(neu(), "f.pdf", "?allgemein=ja")).statusCode).toBe(400);
    expect((await t.anfrage("GET", `/api/dokumente/gebaeude/${t.ids.G}`, t.kBearb)).json().dokumente.length).toBe(vorher);
  });
  it("Duplikat ergaenzt den Ort nur, wenn noch keiner gesetzt ist", async () => {
    const d = neu();
    const a = (await t.ablegen(d, "d.pdf")).json();
    const b = await t.ablegen(d, "d.pdf", `?geschoss=${t.ids.EG}`);
    expect([b.statusCode, b.json().id, b.json().geschossId]).toEqual([200, a.id, t.ids.EG]);
    const c = await t.ablegen(d, "d.pdf", "?allgemein=1");
    expect([c.json().geschossId, c.json().allgemein]).toEqual([t.ids.EG, false]);
  });
  it("PUT ort: setzen, leeren, Rechte, fremde IDs", async () => {
    const id = (await t.ablegen(neu(), "p.pdf")).json().id;
    const r = await ort(id, { geschossId: t.ids.OG2, einheitId: null, allgemein: false });
    expect([r.statusCode, r.json().geschossId]).toEqual([200, t.ids.OG2]);
    expect((await ort(id, { geschossId: null, einheitId: null, allgemein: true })).json()).toMatchObject({ geschossId: null, allgemein: true });
    expect((await ort(id, { geschossId: null, einheitId: null, allgemein: false })).json()).toMatchObject({ geschossId: null, einheitId: null, allgemein: false });
    expect((await ort(id, { geschossId: null, einheitId: null, allgemein: false }, t.kLeser)).statusCode).toBe(403);
    expect((await ort(id, { geschossId: null, einheitId: null, allgemein: false }, t.kFremd)).statusCode).toBe(404);
    const f = await ort(id, { geschossId: t.ids.EG2, einheitId: null, allgemein: false });
    expect([f.statusCode, codes(f)]).toEqual([400, ["ort_unbekannt"]]);
    expect((await ort(id, { geschossId: t.ids.EG, einheitId: t.ids.TECHNIK, allgemein: false })).statusCode).toBe(400);
    expect((await ort(id, { geschossId: t.ids.EG })).statusCode).toBe(400); // Schema: alle drei Felder Pflicht
    expect((await ort(randomUUID(), { geschossId: null, einheitId: null, allgemein: false })).statusCode).toBe(404);
  });
  it("Befund: Ort entfernt, danach 409", async () => {
    const r = await t.ablegen(Buffer.from(`%PDF-1.7\n${EICAR}`), "v.pdf", "?allgemein=1");
    const z = await t.warte(r.json().id, (x) => x.scanStatus === "abgelehnt");
    expect(z.allgemein).toBe(false);
    expect((await ort(z.id, { geschossId: null, einheitId: null, allgemein: true })).statusCode).toBe(409);
  });
});

describe("Modul suche: Status", () => {
  it("Leser 200, fremd 404, Modul aus 404", async () => {
    expect((await t.anfrage("GET", `/api/suche/gebaeude/${t.ids.G}/status`, t.kLeser)).json()).toEqual({ ki: "aus" });
    expect((await t.anfrage("GET", `/api/suche/gebaeude/${t.ids.G}/status`, t.kFremd)).statusCode).toBe(404);
    await schalteAus(t.db.pool, "suche", randomUUID());
    expect((await t.anfrage("GET", `/api/suche/gebaeude/${t.ids.G}/status`, t.kLeser)).statusCode).toBe(404);
    await schalteEin(t.db.pool, "suche", 4, randomUUID());
  });
});
