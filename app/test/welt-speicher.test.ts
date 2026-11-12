import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type pg from "pg";
import { frischeDb } from "./hilfe.js";
import { REGELWERK_V2 } from "../src/welt/regelwerk.v2.js";
import { FachFehler, aendereHuelle, ladeBeschreibung, ladeHuelle, legeGebaeudeAn, pruefeHuelle, schreibeBeschreibung } from "../src/welt/speicher.js";
import { REGELWERK_V1 } from "../src/welt/regelwerk.v1.js";
import { KATALOG_V1 } from "../src/welt/katalog.v1.js";
import type { Beschreibung, Huelle, HuelleGespeichert } from "../src/welt/typen.js";

let db: Awaited<ReturnType<typeof frischeDb>>; let L1: string;
const HUELLE: Huelle = { name: "Test", grundform: "quader", breiteM: 30, tiefeM: 15, geschosse: [{ code: "EG" }, { code: "OG1" }] };

async function tx<T>(f: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.pool.connect();
  try { await c.query("begin"); const r = await f(c); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
const schreibe = (g: string, b: Beschreibung) => tx((c) => schreibeBeschreibung(c, g, b, REGELWERK_V1, KATALOG_V1));
const lade = async (g: string) => (await tx((c) => ladeBeschreibung(c, g)))!;
async function neuesGebaeude() {
  const g = await tx((c) => legeGebaeudeAn(c, L1, HUELLE, REGELWERK_V1));
  return { g, h: (await tx((c) => ladeHuelle(c, g)))! };
}
function basis(h: HuelleGespeichert): Beschreibung {
  const [eg, og1] = h.geschosse;
  return {
    gebaeudeId: h.gebaeudeId, stand: h.stand, heizungStandard: { hk: "ja", fbh: "nein", tabs: "nein" },
    einheiten: [
      { geschossId: eg.id, bezeichnung: "Restaurant", art: "gastro", flaecheM2: 150, heizungAusnahme: { hk: "nein", fbh: "ja" } },
      { geschossId: eg.id, bezeichnung: "Technik", art: "technik", flaecheM2: null },
      { geschossId: og1.id, bezeichnung: "Buero C", art: "buero", flaecheM2: null },
    ],
    bauteile: [
      { katalogId: "heizung.verteiler", standort: { einheitIndex: 1 }, menge: 1, status: "bestaetigt", versorgt: [{ einheitIndex: 2 }, { einheitIndex: 0 }] },
      { katalogId: "heizung.fbh_kreis", standort: { einheitIndex: 0 }, menge: 6, status: "bestaetigt", versorgt: [] },
    ],
  };
}
const fehlerVon = (p: Promise<unknown>) => p.then(() => { throw new Error("FachFehler erwartet"); }, (e) => e as FachFehler);

beforeAll(async () => {
  db = await frischeDb();
  L1 = (await db.pool.query("insert into liegenschaft(name) values ('L1') returning id")).rows[0].id;
});
afterAll(async () => { await db.ende(); });

describe("Huelle v2", () => {
  const H2 = { name: "V2", grundform: "quadrat" as const, geschosse: [{ code: "EG" }] };
  it("v1 verlangt Masse und erlaubt kein quadrat; v2 braucht keine Masse", () => {
    expect(pruefeHuelle(H2, REGELWERK_V1).map((f) => f.code)).toEqual(["mass_ungueltig", "mass_ungueltig", "grundform_nicht_erlaubt"]);
    expect(pruefeHuelle(H2, REGELWERK_V2)).toEqual([]);
  });
  it("legeGebaeudeAn ohne Masse waehlt Regelwerk v2", async () => {
    const g = await tx((c) => legeGebaeudeAn(c, L1, H2, REGELWERK_V1));
    const r = (await db.pool.query("select regelwerk_version v, breite_m b from gebaeude where id=$1", [g])).rows[0];
    expect(r).toEqual({ v: 2, b: null });
  });
});

describe("Huelle", () => {
  it("pruefeHuelle meldet Masse, Codes, Doppel und Hoehen", () => {
    expect(pruefeHuelle({ ...HUELLE, breiteM: 4, geschosse: [{ code: "XX" }, { code: "EG" }, { code: "EG", hoeheM: 7 }] }, REGELWERK_V1).map((f) => f.code))
      .toEqual(["mass_ungueltig", "geschoss_code_ungueltig", "geschoss_doppelt", "hoehe_ungueltig"]);
    expect(pruefeHuelle({ ...HUELLE, geschosse: [] }, REGELWERK_V1).map((f) => f.code)).toEqual(["geschoss_fehlt"]);
  });
  it("legeGebaeudeAn speichert Geschosse nach Rang mit Default-Hoehe", async () => {
    const g = await tx((c) => legeGebaeudeAn(c, L1, { ...HUELLE, geschosse: [{ code: "OG1" }, { code: "UG1", hoeheM: 2.6 }, { code: "EG" }] }, REGELWERK_V1));
    const h = (await tx((c) => ladeHuelle(c, g)))!;
    expect(h.geschosse.map((x) => [x.code, x.hoeheM])).toEqual([["UG1", 2.6], ["EG", 3.2], ["OG1", 3.2]]);
    expect([h.stand, h.regelwerkVersion, h.liegenschaftId]).toEqual([0, 1, L1]);
  });
  it("aendereHuelle: belegtes Geschoss nicht loeschbar; neues Geschoss und Code-Tausch moeglich", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const [eg, og1] = h.geschosse;
    const e = await fehlerVon(tx((c) => aendereHuelle(c, g, { ...HUELLE, geschosse: [{ id: eg.id, code: "EG" }] }, REGELWERK_V1)));
    expect([e.status, e.fehler.map((f) => f.code)]).toEqual([422, ["geschoss_belegt"]]);
    await tx((c) => aendereHuelle(c, g, { ...HUELLE, geschosse: [{ id: eg.id, code: "EG" }, { id: og1.id, code: "OG2" }, { code: "OG1" }] }, REGELWERK_V1));
    const neu = (await tx((c) => ladeHuelle(c, g)))!;
    expect(neu.geschosse.map((x) => x.code)).toEqual(["EG", "OG1", "OG2"]);
    expect(neu.geschosse[2].id).toBe(og1.id);
    expect(neu.stand).toBe(2);
  });
  it("aendereHuelle: dieselbe Geschoss-ID zweimal → id_doppelt", async () => {
    const { g, h } = await neuesGebaeude();
    const [eg] = h.geschosse;
    const e = await fehlerVon(tx((c) => aendereHuelle(c, g, { ...HUELLE, geschosse: [{ id: eg.id, code: "EG" }, { id: eg.id, code: "OG1" }] }, REGELWERK_V1)));
    expect([e.status, e.fehler.map((f) => [f.pfad, f.code])]).toEqual([422, [["geschosse[1].id", "id_doppelt"]]]);
  });
});

describe("Beschreibung", () => {
  it("schreibt und liest: IDs, Standard, Ausnahme, Versorgung sortiert, keine Hinweise", async () => {
    const { g, h } = await neuesGebaeude();
    const z = await schreibe(g, basis(h));
    expect(z).toEqual({ einheiten: { angelegt: 3, aktualisiert: 0, geloescht: 0 }, bauteile: { angelegt: 2, aktualisiert: 0, geloescht: 0 }, gruppen: { angelegt: 0, aktualisiert: 0, geloescht: 0 } });
    const b = await lade(g);
    expect(b.stand).toBe(1);
    expect(b.einheiten.map((e) => e.bezeichnung)).toEqual(["Restaurant", "Technik", "Buero C"]);
    expect(b.einheiten[0].heizungWirksam).toEqual({ hk: "nein", fbh: "ja", tabs: "nein" });
    expect(b.einheiten[2].heizungWirksam).toEqual({ hk: "ja", fbh: "nein", tabs: "nein" });
    expect(b.bauteile[0].standort).toEqual({ einheitId: b.einheiten[1].id });
    expect(b.bauteile[0].versorgt).toEqual([{ einheitId: b.einheiten[0].id }, { einheitId: b.einheiten[2].id }]);
    expect(b.hinweise).toEqual([]);
  });
  it("unveraendert zurueckschreiben behaelt alle IDs", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b1 = await lade(g);
    const z = await schreibe(g, b1);
    const b2 = await lade(g);
    expect(z.einheiten).toEqual({ angelegt: 0, aktualisiert: 3, geloescht: 0 });
    expect(b2.einheiten.map((e) => e.id)).toEqual(b1.einheiten.map((e) => e.id));
    expect(b2.bauteile.map((t) => t.id)).toEqual(b1.bauteile.map((t) => t.id));
    expect(b2.stand).toBe(b1.stand + 1);
  });
  it("neue Einheit erbt Standard; Standardaenderung wirkt nicht auf Ausnahmen", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    b.einheiten.push({ geschossId: h.geschosse[1].id, bezeichnung: "Neu", art: "buero", flaecheM2: null });
    b.heizungStandard = { hk: "nein", fbh: "unbekannt", tabs: "nein" };
    await schreibe(g, b);
    const n = await lade(g);
    expect(n.einheiten[3].heizungWirksam).toEqual({ hk: "nein", fbh: "unbekannt", tabs: "nein" });
    expect(n.einheiten[0].heizungWirksam).toEqual({ hk: "nein", fbh: "ja", tabs: "nein" });
  });
  it("Kopie ohne ID ergibt eigenes Exemplar", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    const { id: _weg, ...kopie } = b.einheiten[2];
    b.einheiten.push({ ...kopie, bezeichnung: "Buero C Kopie" });
    await schreibe(g, b);
    const n = await lade(g);
    expect(n.einheiten).toHaveLength(4);
    expect(n.einheiten[3].id).not.toBe(n.einheiten[2].id);
    expect(n.einheiten[2].id).toBe(b.einheiten[2].id);
  });
  it("Loeschen entfernt Einheit und Bauteil", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    b.bauteile.splice(1, 1);                       // FBH-Kreis im Restaurant
    b.bauteile[0].versorgt = [{ einheitId: b.einheiten[2].id! }];
    b.einheiten.splice(0, 1);                      // Restaurant
    const z = await schreibe(g, b);
    expect([z.einheiten.geloescht, z.bauteile.geloescht]).toEqual([1, 1]);
    expect((await lade(g)).einheiten.map((e) => e.bezeichnung)).toEqual(["Technik", "Buero C"]);
  });
  it("IDs aus einem anderen Gebaeude derselben Liegenschaft werden abgelehnt", async () => {
    const eins = await neuesGebaeude(), zwei = await neuesGebaeude();
    await schreibe(eins.g, basis(eins.h));
    await schreibe(zwei.g, basis(zwei.h));
    const b1 = await lade(eins.g), b2 = await lade(zwei.g);
    const mitFremderEinheit = { ...b1, einheiten: [{ ...b1.einheiten[0], id: b2.einheiten[0].id }, ...b1.einheiten.slice(1)] };
    const e1 = await fehlerVon(schreibe(eins.g, mitFremderEinheit));
    expect(e1.status).toBe(422);
    expect(e1.fehler.map((f) => f.code)).toContain("id_unbekannt");
    const mitFremdemGeschoss = { ...b1, einheiten: [{ ...b1.einheiten[0], geschossId: zwei.h.geschosse[0].id }, ...b1.einheiten.slice(1)] };
    const e2 = await fehlerVon(schreibe(eins.g, mitFremdemGeschoss));
    expect([e2.status, e2.fehler.map((f) => [f.pfad, f.code])]).toEqual([422, [["einheiten[0].geschossId", "verweis_ungueltig"]]]);
  });
  it("Bauteil wechselt aus einer geloeschten Einheit in eine andere: ID bleibt, Standort neu", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    const fbh = b.bauteile[1];                     // FBH-Kreis im Restaurant
    const ziel = b.einheiten[2];                   // Buero C
    ziel.heizungAusnahme = { fbh: "ja" };
    fbh.standort = { einheitId: ziel.id! };
    b.bauteile[0].versorgt = [{ einheitId: ziel.id! }];
    b.einheiten.splice(0, 1);                      // Restaurant geloescht
    const z = await schreibe(g, b);
    expect([z.einheiten.geloescht, z.bauteile.geloescht]).toEqual([1, 0]);
    const n = await lade(g);
    expect(n.bauteile.find((t) => t.id === fbh.id)!.standort).toEqual({ einheitId: ziel.id });
  });
  it("manuelle Position bleibt erhalten; Loeschen ist dann blockiert", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const b = await lade(g);
    b.bauteile[1].positionManuell = { x: 2, z: 3 };
    await schreibe(g, b);
    const b2 = await lade(g);
    expect(b2.bauteile[1].positionManuell).toEqual({ x: 2, z: 3 });
    b2.bauteile.splice(1, 1);
    const e = await fehlerVon(schreibe(g, b2));
    expect([e.status, e.fehler.map((f) => f.code)]).toEqual([422, ["loeschen_blockiert"]]);
  });
  it("veralteter Stand ergibt 409 und aendert nichts", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, basis(h));
    const e = await fehlerVon(schreibe(g, basis(h)));
    expect([e.status, e.fehler[0].code]).toEqual([409, "stand_veraltet"]);
    expect((await lade(g)).einheiten).toHaveLength(3);
  });
  it("fachlicher Fehler ergibt 422 mit Pfad", async () => {
    const { g, h } = await neuesGebaeude();
    const b = basis(h); b.bauteile[1].katalogId = "heizung.kamin";
    const e = await fehlerVon(schreibe(g, b));
    expect(e.fehler).toEqual([{ pfad: "bauteile[1].katalogId", code: "katalog_unbekannt", meldung: "Katalog-ID heizung.kamin unbekannt" }]);
  });
});

describe("Gruppen und Ort", () => {
  const nullZaehler = { angelegt: 0, aktualisiert: 0, geloescht: 0 };
  /** basis + 2 Heizkoerper; Gruppe 1 am Verteiler (Index 0) mit FBH-Kreis (1) und Heizkoerper (2); Heizkoerper (3) steht vor dem Verteiler. */
  function mitGruppen(h: HuelleGespeichert): Beschreibung {
    const b = basis(h);
    b.bauteile.push(
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 2 }, menge: 4, status: "bestaetigt", versorgt: [], ort: { gruppe: { gruppeIndex: 0 } } },
      { katalogId: "heizung.heizkoerper", standort: { einheitIndex: 2 }, menge: 2, status: "bestaetigt", versorgt: [], ort: { vorBauteil: { bauteilIndex: 0 } } },
    );
    b.gruppen = [{ verteiler: { bauteilIndex: 0 }, nummer: 1, art: "beimisch", bezeichnung: "Ost", verbraucher: [{ bauteilIndex: 1 }, { bauteilIndex: 2 }] }];
    return b;
  }
  const zeilen = async (sql: string, p: unknown[]) => (await db.pool.query(sql, p)).rows;

  it("Rundlauf: schreiben, laden, zurueckschreiben ergibt dasselbe", async () => {
    const { g, h } = await neuesGebaeude();
    const z = await schreibe(g, mitGruppen(h));
    expect(z.gruppen).toEqual({ angelegt: 1, aktualisiert: 0, geloescht: 0 });
    const b = await lade(g);
    const gr = b.gruppen![0];
    expect(gr).toMatchObject({ nummer: 1, art: "beimisch", bezeichnung: "Ost", verteiler: { bauteilId: b.bauteile[0].id } });
    expect(gr.verbraucher).toEqual([{ bauteilId: b.bauteile[1].id }, { bauteilId: b.bauteile[2].id }]);
    expect(b.bauteile[2].ort).toEqual({ gruppe: { gruppeId: gr.id } });
    expect(b.bauteile[3].ort).toEqual({ vorBauteil: { bauteilId: b.bauteile[0].id } });
    expect(b.bauteile[0].ort).toBeUndefined();
    const z2 = await schreibe(g, b);
    expect(z2.gruppen).toEqual({ angelegt: 0, aktualisiert: 1, geloescht: 0 });
    const b2 = await lade(g);
    expect(b2.gruppen).toEqual(b.gruppen);
    expect(b2.bauteile.map((t) => t.ort)).toEqual(b.bauteile.map((t) => t.ort));
  });
  it("Gruppe durch Weglassen loeschen; Ort faellt weg", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, mitGruppen(h));
    const b = await lade(g);
    delete b.gruppen;
    b.bauteile.forEach((t) => { if (t.ort && "gruppe" in t.ort) delete t.ort; });
    const z = await schreibe(g, b);
    expect(z.gruppen).toEqual({ ...nullZaehler, geloescht: 1 });
    const n = await lade(g);
    expect(n.gruppen).toEqual([]);
    expect(n.bauteile[2].ort).toBeUndefined();
    expect(n.bauteile[3].ort).toEqual({ vorBauteil: { bauteilId: n.bauteile[0].id } });
  });
  it("Verbraucher entfernen loescht die Zuordnung", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, mitGruppen(h));
    const b = await lade(g);
    b.gruppen![0].verbraucher = [b.gruppen![0].verbraucher[0]];
    await schreibe(g, b);
    expect((await lade(g)).gruppen![0].verbraucher).toHaveLength(1);
    expect(await zeilen("select 1 from gruppe_verbraucher where bauteil_id=$1", [b.bauteile[2].id])).toHaveLength(0);
  });
  it("Nummern vertauschen; Verteiler loeschen nimmt die Gruppen mit", async () => {
    const { g, h } = await neuesGebaeude();
    const b0 = mitGruppen(h);
    b0.gruppen!.push({ verteiler: { bauteilIndex: 0 }, nummer: 2, art: "drossel", bezeichnung: "West", verbraucher: [] });
    await schreibe(g, b0);
    const b = await lade(g);
    b.gruppen![0].nummer = 2; b.gruppen![1].nummer = 1;
    await schreibe(g, b);
    expect((await lade(g)).gruppen!.map((x) => x.nummer)).toEqual([2, 1]);
    const c = await lade(g);
    const verteilerId = c.bauteile[0].id;
    c.gruppen = [];
    c.bauteile = c.bauteile.filter((t) => t.id !== verteilerId).map((t) => ({ ...t, ort: undefined }));
    const z = await schreibe(g, c);
    expect(z.gruppen.geloescht).toBe(2);
    expect((await lade(g)).gruppen).toEqual([]);
  });
  it("Schreiben loescht den Entwurf", async () => {
    const { g, h } = await neuesGebaeude();
    await db.pool.query("insert into entwurf(gebaeude_id, liegenschaft_id, daten) values ($1,$2,'{}')", [g, h.liegenschaftId]);
    await schreibe(g, basis(h));
    expect(await zeilen("select 1 from entwurf where gebaeude_id=$1", [g])).toHaveLength(0);
  });
  it("Fehlercodes ergeben 422 und aendern nichts", async () => {
    const { g, h } = await neuesGebaeude();
    await schreibe(g, mitGruppen(h));
    const b = await lade(g);
    b.gruppen![0].verteiler = { bauteilId: b.bauteile[1].id! };
    b.bauteile[3].ort = { vorBauteil: { bauteilId: b.bauteile[3].id } };
    const e = await fehlerVon(schreibe(g, b));
    expect([e.status, e.fehler.map((f) => f.code)]).toEqual([422, ["gruppe_verteiler_ungueltig", "ort_selbstbezug"]]);
    expect((await lade(g)).gruppen).toHaveLength(1);
  });
  it("v2-Gebaeude ohne Masse laedt mit null-Massen und leeren Gruppen", async () => {
    const g = await tx((c) => legeGebaeudeAn(c, L1, { name: "V2", grundform: "quadrat", geschosse: [{ code: "EG" }] }, REGELWERK_V1));
    const h = (await tx((c) => ladeHuelle(c, g)))!;
    expect([h.breiteM, h.tiefeM, h.regelwerkVersion]).toEqual([null, null, 2]);
    expect((await lade(g)).gruppen).toEqual([]);
  });
});
