import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import type { BauteilVerweis, BeschreibungEingabe, EinheitVerweis, GruppeVerweis } from "../typen";
import { ausBeschreibung, zuBeschreibungMitPositionen } from "./beschreibung";
import { vorlagenEinlesen, vorlagenZurEingabe } from "./vorlagen";
import { FELDER_EINHEITEN, FELDER_HEIZUNG, abweichungen, leererZustand, reduziere, unterverteiler, vorlageVonGeschoss, type Aktion, type AssistentZustand } from "./zustand";
import { heizungWahlAktionen } from "./schritte/Schritt3Heizung";

function haus(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 5 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
const v1 = (z: AssistentZustand) => z.vorlagen[0].schluessel;
const im = (z: AssistentZustand, code: string) => z.einheiten.filter((e) => e.geschoss === code);
/** Regelgeschoss mit 4 Büros, OG1–OG5 zugewiesen. */
function regelhaus(): AssistentZustand {
  let z = haus({ typ: "vorlageNeu", name: "Regel-OG" });
  z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "buero", anzahl: 4 });
  for (const g of ["OG1", "OG2", "OG3", "OG4", "OG5"]) z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: g, an: true });
  return z;
}

describe("Regelgeschoss", () => {
  it("rollt Plätze in allen zugewiesenen Geschossen aus und nummeriert", () => {
    const z = regelhaus();
    expect(z.einheiten).toHaveLength(20);
    expect(im(z, "OG3").map((e) => e.bezeichnung)).toEqual(["Büro 3.01", "Büro 3.02", "Büro 3.03", "Büro 3.04"]);
    expect(im(z, "OG3").every((e) => e.vorlage?.schluessel === v1(z))).toBe(true);
    expect(vorlageVonGeschoss(z, "OG3")?.name).toBe("Regel-OG");
    expect(z.bauteile.filter((t) => t.katalogId === K.hk)).toHaveLength(20);
  });
  it("Vorlage ändern wirkt in allen Geschossen", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "kern", anzahl: 1 });
    expect(im(z, "OG5").map((e) => e.bezeichnung)).toContain("Kern 5.05");
    const p = z.vorlagen[0].plaetze[0].schluessel;
    z = reduziere(z, { typ: "platzMenge", vorlage: v1(z), platz: p, art: "hk", menge: 6 });
    const hkVon = (code: string) => z.bauteile.find((t) => t.katalogId === K.hk && "einheit" in t.standort && t.standort.einheit === im(z, code)[0].schluessel)!;
    expect(hkVon("OG1").menge).toBe(6);
    expect(hkVon("OG5").menge).toBe(6);
  });
  it("direkte Änderung markiert Abweichung; Vorlage überschreibt sie nicht; Zurücksetzen hebt sie auf", () => {
    let z = regelhaus();
    const e = im(z, "OG2")[0];
    z = reduziere(z, { typ: "einheitAendern", schluessel: e.schluessel, bezeichnung: "Empfang" });
    expect(z.einheiten.find((x) => x.schluessel === e.schluessel)!.abweichend).toEqual(["bezeichnung"]);
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "kern", anzahl: 1 });
    expect(z.einheiten.find((x) => x.schluessel === e.schluessel)!.bezeichnung).toBe("Empfang");
    expect(abweichungen(z, v1(z))).toBe(1);
    z = reduziere(z, { typ: "einheitZuruecksetzen", einheit: e.schluessel });
    expect(z.einheiten.find((x) => x.schluessel === e.schluessel)!.bezeichnung).toBe("Büro 2.01");
    expect(abweichungen(z, v1(z))).toBe(0);
  });
  it("Einheit in einem Geschoss löschen bleibt gelöscht (OG5 mit 3 Büros)", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "einheitLoeschen", schluessel: im(z, "OG5")[3].schluessel });
    z = reduziere(z, { typ: "platzMenge", vorlage: v1(z), platz: z.vorlagen[0].plaetze[0].schluessel, art: "hk", menge: 2 });
    expect(im(z, "OG5")).toHaveLength(3);
    expect(abweichungen(z, v1(z))).toBe(1);
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG5" });
    expect(im(z, "OG5")).toHaveLength(4);
  });
  it("Ausnahme am Platz gilt für alle Geschosse; Ausnahme je Geschoss nur dort", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG4", art: "fbh", wert: "ja" });
    expect(im(z, "OG4").every((e) => e.ausnahme.fbh === "ja" && e.abweichend?.includes("ausnahme"))).toBe(true);
    expect(im(z, "OG3").every((e) => e.ausnahme.fbh === undefined)).toBe(true);
    z = reduziere(z, { typ: "platzAusnahme", vorlage: v1(z), platz: z.vorlagen[0].plaetze[0].schluessel, art: "tabs", wert: "ja" });
    expect(im(z, "OG1")[0].ausnahme.tabs).toBe("ja");
    expect(im(z, "OG4")[0].ausnahme.tabs).toBeUndefined();
  });
  it("Vorlage aus bestehendem Geschoss übernimmt dessen Einheiten (IDs bleiben)", () => {
    let z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 2 });
    const vorher = im(z, "OG1").map((e) => e.schluessel);
    z = reduziere(z, { typ: "vorlageNeu", ausGeschoss: "OG1" });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: "OG2", an: true });
    expect(im(z, "OG1").map((e) => e.schluessel)).toEqual(vorher);
    expect(im(z, "OG2").map((e) => e.bezeichnung)).toEqual(["Büro 2.01", "Büro 2.02"]);
  });
  it("Zuweisen nutzt freie Einheiten gleicher Art; überzählige bleiben eigenständig", () => {
    let z = haus({ typ: "einheitAnzahl", geschoss: "OG2", art: "buero", anzahl: 5 }, { typ: "vorlageNeu" });
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "buero", anzahl: 4 });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: "OG2", an: true });
    expect(im(z, "OG2")).toHaveLength(5);
    expect(im(z, "OG2").filter((e) => e.vorlage)).toHaveLength(4);
  });
  it("Geschoss lösen und Vorlage löschen lassen Einheiten stehen", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: "OG1", an: false });
    expect(im(z, "OG1")).toHaveLength(4);
    expect(im(z, "OG1").some((e) => e.vorlage)).toBe(false);
    z = reduziere(z, { typ: "vorlageLoeschen", vorlage: v1(z) });
    expect(z.vorlagen).toEqual([]);
    expect(z.einheiten).toHaveLength(20);
    expect(z.einheiten.some((e) => e.vorlage)).toBe(false);
  });
  it("ein Geschoss gehört höchstens einer Vorlage", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "vorlageNeu", name: "Attika" });
    const v2 = z.vorlagen[1].schluessel;
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v2, art: "wohnung", anzahl: 1 });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v2, geschoss: "OG5", an: true });
    expect(z.vorlagen[0].geschosse).not.toContain("OG5");
    expect(vorlageVonGeschoss(z, "OG5")?.name).toBe("Attika");
  });
});

describe("Vorlagen ⇄ API", () => {
  it("Eingabe: Geschoss-IDs, Einheit per Index (neu) oder ID (gespeichert)", () => {
    let z = regelhaus();
    z = { ...z, einheiten: z.einheiten.map((e, i) => (i === 0 ? { ...e, id: "00000000-0000-4000-8000-000000000777" } : e)) };
    const { positionen } = zuBeschreibungMitPositionen(z);
    const v = vorlagenZurEingabe(z, positionen)!;
    const og1 = z.gebaeude.geschosse.find((g) => g.code === "OG1")!.id;
    expect(v.vorlagen[0].geschosse[0]).toBe(og1);
    expect(v.zuordnung[0].einheit).toEqual({ einheitId: "00000000-0000-4000-8000-000000000777" });
    expect(v.zuordnung[1].einheit).toEqual({ einheitIndex: positionen.einheiten.indexOf(z.einheiten[1].schluessel) });
    expect(v.zuordnung).toHaveLength(20);
  });
  it("ohne Vorlagen und ohne Automatik null; mit Automatik nur Merker", () => {
    const aus = { ...haus(), automatik: false };
    expect(vorlagenZurEingabe(aus, zuBeschreibungMitPositionen(aus).positionen)).toBeNull();
    const v = vorlagenZurEingabe(haus(), zuBeschreibungMitPositionen(haus()).positionen)!;
    expect(v.vorlagen).toEqual([]);
    expect(v.automatik).toMatchObject({ fbhVerteilerAus: [], autoVerteiler: [], gruppen: [] });
  });
  it("Einlesen: gespeicherte IDs → Schlüssel; Veraltetes wird abgelöst", () => {
    let z = regelhaus();
    z = { ...z, einheiten: z.einheiten.map((e, i) => ({ ...e, id: `00000000-0000-4000-8000-${String(500 + i).padStart(12, "0")}`, schluessel: `00000000-0000-4000-8000-${String(500 + i).padStart(12, "0")}` })) };
    const gespeichert = {
      version: 1,
      vorlagen: [{ ...z.vorlagen[0], geschosse: [...z.vorlagen[0].geschosse.map((c) => z.gebaeude.geschosse.find((g) => g.code === c)!.id), "00000000-0000-4000-8000-000000000999"], ausgelassen: [] }],
      zuordnung: { [z.einheiten[0].id!]: { vorlage: z.vorlagen[0].schluessel, platz: z.vorlagen[0].plaetze[0].schluessel, abweichend: ["bezeichnung"] },
        "00000000-0000-4000-8000-000000000888": { vorlage: z.vorlagen[0].schluessel, platz: z.vorlagen[0].plaetze[0].schluessel, abweichend: [] } },
    };
    const ohne = { ...z, vorlagen: [], einheiten: z.einheiten.map(({ vorlage: _v, abweichend: _a, ...e }) => e) };
    const r = vorlagenEinlesen(ohne, gespeichert);
    expect(r.abgeloest).toBe(true);
    expect(r.zustand.vorlagen[0].geschosse).toEqual(["OG1", "OG2", "OG3", "OG4", "OG5"]);
    expect(r.zustand.einheiten[0].vorlage?.schluessel).toBe(z.vorlagen[0].schluessel);
    expect(r.zustand.einheiten[0].abweichend).toEqual(["bezeichnung"]);
  });
  it("Einlesen: unbekannte Version oder Unsinn → unverändert, nicht abgelöst bei null", () => {
    const z = haus();
    expect(vorlagenEinlesen(z, null)).toEqual({ zustand: z, abgeloest: false });
    expect(vorlagenEinlesen(z, { version: 7 }).abgeloest).toBe(true);
  });
});

describe("Fixes aus Gesamtreview", () => {
  it("I1: kaputte gespeicherte Vorlagen werfen nicht, sondern werden abgelöst", () => {
    const z = haus();
    const r = vorlagenEinlesen(z, { version: 1, vorlagen: [{}], zuordnung: { x: {} } });
    expect(r.abgeloest).toBe(true);
    expect(r.zustand).toBe(z);
  });
  it("I2: Zuweisen übernimmt freie Einheit, behält deren Daten und markiert die Abweichungen", () => {
    let z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 1 });
    const e = im(z, "OG1")[0];
    z = reduziere(z, { typ: "einheitAendern", schluessel: e.schluessel, bezeichnung: "Empfang" });
    const hk = z.bauteile.find((t) => t.katalogId === K.hk && "einheit" in t.standort && t.standort.einheit === e.schluessel)!;
    z = reduziere(z, { typ: "abgabeAendern", schluessel: hk.schluessel, menge: 7 });
    z = reduziere(z, { typ: "vorlageNeu", name: "Regel-OG" });
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "buero", anzahl: 1 });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v1(z), geschoss: "OG1", an: true });
    const x = z.einheiten.find((y) => y.schluessel === e.schluessel)!;
    expect(x.vorlage?.schluessel).toBe(v1(z));
    expect(x.bezeichnung).toBe("Empfang");
    expect(z.bauteile.find((t) => t.schluessel === hk.schluessel)!.menge).toBe(7);
    expect(x.abweichend).toContain("bezeichnung");
    expect(x.abweichend).toContain("mengen");
    expect(x.abweichend).not.toContain("ausnahme");
    expect(im(z, "OG1")).toHaveLength(1);
  });
  it("I2: neu angelegte Einheiten bleiben ohne Abweichung", () => {
    const z = regelhaus();
    expect(z.einheiten.every((e) => (e.abweichend ?? []).length === 0)).toBe(true);
  });
  it("M3: Ausnahme je Geschoss markiert nur Einheiten, die sich ändern und die Heizart haben", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "kern", anzahl: 1 });
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG4", art: "fbh", wert: "ja" });
    const kern = im(z, "OG4").find((e) => e.art === "kern")!;
    expect(kern.ausnahme.fbh).toBeUndefined();
    expect(kern.abweichend ?? []).not.toContain("ausnahme");
    expect(im(z, "OG4").filter((e) => e.art === "buero").every((e) => e.ausnahme.fbh === "ja" && e.abweichend?.includes("ausnahme"))).toBe(true);
    // Gleicher Wert wie Standard (nein) in einem unberührten Geschoss: nichts ändert sich, nichts wird markiert
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG3", art: "fbh", wert: "nein" });
    expect(im(z, "OG3").every((e) => (e.abweichend ?? []).length === 0)).toBe(true);
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG3", art: "fbh", wert: null });
    expect(abweichungen(z, v1(z))).toBe(4);
  });
});

describe("B1: Zurücksetzen je Schritt (nur eigene Felder)", () => {
  /** OG4: FBH statt HK im ganzen Geschoss (Schritt 3) und eine umbenannte Einheit (Schritt 2). */
  function og4(): AssistentZustand {
    let z = regelhaus();
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG4", art: "fbh", wert: "ja" });
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG4", art: "hk", wert: "nein" });
    z = reduziere(z, { typ: "einheitAendern", schluessel: im(z, "OG4")[0].schluessel, bezeichnung: "Empfang" });
    return z;
  }
  it("abweichungen zählt je Feldgruppe", () => {
    const z = og4();
    expect(abweichungen(z, v1(z), FELDER_EINHEITEN)).toBe(1);
    expect(abweichungen(z, v1(z), FELDER_HEIZUNG)).toBe(4);
    expect(abweichungen(z, v1(z))).toBe(4);
  });
  it("Schritt 2: Geschoss zurücksetzen stellt den Namen her und behält FBH", () => {
    let z = og4();
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG4", felder: FELDER_EINHEITEN });
    expect(im(z, "OG4")[0].bezeichnung).toBe("Büro 4.01");
    expect(im(z, "OG4").every((e) => e.ausnahme.fbh === "ja" && e.ausnahme.hk === "nein")).toBe(true);
    expect(im(z, "OG4").every((e) => e.abweichend?.includes("ausnahme"))).toBe(true);
    expect(abweichungen(z, v1(z), FELDER_EINHEITEN)).toBe(0);
    expect(abweichungen(z, v1(z), FELDER_HEIZUNG)).toBe(4);
  });
  it("Schritt 3: Geschoss zurücksetzen hebt FBH auf und behält den Namen", () => {
    let z = og4();
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG4", felder: FELDER_HEIZUNG });
    expect(im(z, "OG4")[0].bezeichnung).toBe("Empfang");
    expect(im(z, "OG4").every((e) => e.ausnahme.fbh === undefined && e.ausnahme.hk === undefined)).toBe(true);
    expect(abweichungen(z, v1(z), FELDER_HEIZUNG)).toBe(0);
    expect(abweichungen(z, v1(z), FELDER_EINHEITEN)).toBe(1);
  });
  it("Einheit zurücksetzen je Feldgruppe", () => {
    let z = og4();
    const e = im(z, "OG4")[0].schluessel;
    z = reduziere(z, { typ: "einheitZuruecksetzen", einheit: e, felder: FELDER_EINHEITEN });
    const x = z.einheiten.find((y) => y.schluessel === e)!;
    expect([x.bezeichnung, x.ausnahme.fbh]).toEqual(["Büro 4.01", "ja"]);
    z = reduziere(z, { typ: "einheitZuruecksetzen", einheit: e, felder: FELDER_HEIZUNG });
    expect(z.einheiten.find((y) => y.schluessel === e)!.ausnahme.fbh).toBeUndefined();
    expect(im(z, "OG4").filter((y) => y.ausnahme.fbh === "ja")).toHaveLength(3);
  });
  it("ausgelassene Plätze gehören zu Schritt 2", () => {
    let z = og4();
    z = reduziere(z, { typ: "einheitLoeschen", schluessel: im(z, "OG4")[3].schluessel });
    expect(abweichungen(z, v1(z), FELDER_EINHEITEN)).toBe(2);
    expect(abweichungen(z, v1(z), FELDER_HEIZUNG)).toBe(3);
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG4", felder: FELDER_HEIZUNG });
    expect(im(z, "OG4")).toHaveLength(3);
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG4", felder: FELDER_EINHEITEN });
    expect(im(z, "OG4")).toHaveLength(4);
  });
});

describe("N1: Geschoss-Wahl wirkt nur, wo die Heizart erlaubt ist", () => {
  /** Regelgeschoss mit 4 Büros und 1 Kern (OG1–OG5). */
  function mitKern(): AssistentZustand {
    let z = regelhaus();
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v1(z), art: "kern", anzahl: 1 });
    return z;
  }
  const wahl = (z: AssistentZustand, w: "standard" | "hk" | "fbh" | "beide", code = "OG4") => heizungWahlAktionen(code, w).reduce(reduziere, z);
  const hkIn = (z: AssistentZustand, einheit: string) => z.bauteile.filter((t) => t.katalogId === K.hk && "einheit" in t.standort && t.standort.einheit === einheit);
  it("«Fussbodenheizung»: Büros FBH statt HK, Kern behält Heizkörper und bleibt unmarkiert", () => {
    const z = wahl(mitKern(), "fbh");
    const kern = im(z, "OG4").find((e) => e.art === "kern")!;
    expect(kern.ausnahme).toEqual({});
    expect(kern.abweichend ?? []).toEqual([]);
    expect(hkIn(z, kern.schluessel)).toHaveLength(1);
    for (const e of im(z, "OG4").filter((x) => x.art === "buero")) {
      expect(e.ausnahme).toEqual({ fbh: "ja", hk: "nein" });
      expect(hkIn(z, e.schluessel)).toHaveLength(0);
    }
    expect(abweichungen(z, v1(z), FELDER_HEIZUNG, "OG4")).toBe(4);
  });
  it("auch eine freie Kern-Einheit ohne Regelgeschoss behält Heizkörper", () => {
    let z = regelhaus();
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "OG4", art: "kern", anzahl: 1 });
    z = wahl(z, "fbh");
    const kern = im(z, "OG4").find((e) => e.art === "kern")!;
    expect(kern.ausnahme).toEqual({});
    expect(hkIn(z, kern.schluessel)).toHaveLength(1);
  });
  it("«Wie Standard» setzt Heizkörper und FBH zurück, TABS-Ausnahme bleibt", () => {
    let z = wahl(mitKern(), "fbh");
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG4", art: "tabs", wert: "ja" });
    z = wahl(z, "standard");
    for (const e of im(z, "OG4").filter((x) => x.art === "buero")) expect(e.ausnahme).toEqual({ tabs: "ja" });
  });
});

describe("N2: wiederhergestellter Platz übernimmt die Geschoss-Heizung", () => {
  function og5Fbh(): AssistentZustand {
    let z = regelhaus();
    for (const a of [
      { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 },
      { typ: "erzeuger", katalogId: K.waermepumpe },
      ...heizungWahlAktionen("OG5", "fbh"),
      { typ: "schritt", nr: 5 },
    ] as Aktion[]) z = reduziere(z, a);
    return z;
  }
  it("Schritt-2-Zurücksetzen: Büro 5.04 kommt mit FBH zurück, markiert, mit FBH-Verteiler in der FBH-Gruppe", () => {
    let z = og5Fbh();
    z = reduziere(z, { typ: "einheitLoeschen", schluessel: im(z, "OG5")[3].schluessel });
    expect(im(z, "OG5")).toHaveLength(3);
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG5", felder: FELDER_EINHEITEN });
    const e = im(z, "OG5").find((x) => x.bezeichnung === "Büro 5.04")!;
    expect(e.ausnahme).toEqual({ fbh: "ja", hk: "nein" });
    expect(e.abweichend).toContain("ausnahme");
    expect(z.bauteile.some((t) => t.katalogId === K.hk && "einheit" in t.standort && t.standort.einheit === e.schluessel)).toBe(false);
    const uv = unterverteiler(z).find((t) => t.versorgt.includes(e.schluessel))!;
    expect(uv).toBeDefined();
    const fbhGruppe = z.gruppen.find((g) => g.regel?.heizart === "fbh")!;
    expect(fbhGruppe.verbraucher).toContain(uv.schluessel);
  });
  it("ohne einheitliche Geschoss-Heizung bleibt der Platz beim Regelgeschoss", () => {
    let z = og5Fbh();
    z = reduziere(z, { typ: "einheitZuruecksetzen", einheit: im(z, "OG5")[0].schluessel, felder: FELDER_HEIZUNG });
    z = reduziere(z, { typ: "einheitLoeschen", schluessel: im(z, "OG5")[3].schluessel });
    z = reduziere(z, { typ: "geschossZuruecksetzen", geschoss: "OG5", felder: FELDER_EINHEITEN });
    const e = im(z, "OG5").find((x) => x.bezeichnung === "Büro 5.04")!;
    expect(e.ausnahme).toEqual({});
  });
});

describe("Automatik nach dem Wiederöffnen (E42)", () => {
  const uuid = (p: number, i: number) => `00000000-0000-4000-8000-${String(p * 1000 + i).padStart(12, "0")}`;
  /** Simuliert PUT Beschreibung + GET Beschreibung/Vorlagen: IDs vergeben, Index-Verweise der Merker auflösen. */
  function speichernUndLaden(z: AssistentZustand, merker = true): AssistentZustand {
    const { beschreibung: b, positionen } = zuBeschreibungMitPositionen(z);
    const ein = vorlagenZurEingabe(z, positionen);
    const eIds = b.einheiten.map((e, i) => e.id ?? uuid(1, i));
    const tIds = b.bauteile.map((t, i) => t.id ?? uuid(2, i));
    const gIds = (b.gruppen ?? []).map((g, i) => g.id ?? uuid(3, i));
    const E = (v: EinheitVerweis) => v.einheitId ?? eIds[v.einheitIndex!];
    const B = (v: BauteilVerweis) => v.bauteilId ?? tIds[v.bauteilIndex!];
    const G = (v: GruppeVerweis) => v.gruppeId ?? gIds[v.gruppeIndex!];
    const geladen: BeschreibungEingabe = {
      ...b, stand: b.stand + 1, geschosse: z.gebaeude.geschosse.map((g) => ({ id: g.id!, code: g.code })),
      einheiten: b.einheiten.map((e, i) => ({ ...e, id: eIds[i] })),
      bauteile: b.bauteile.map((t, i) => ({ ...t, id: tIds[i] })),
      gruppen: (b.gruppen ?? []).map((g, i) => ({ ...g, id: gIds[i] })),
    };
    const a = ein?.automatik;
    const gespeichert = ein && {
      version: 1, vorlagen: ein.vorlagen,
      zuordnung: Object.fromEntries(ein.zuordnung.map((x) => [E(x.einheit), { vorlage: x.vorlage, platz: x.platz, abweichend: x.abweichend }])),
      ...(merker && a && { automatik: {
        fbhWmz: a.fbhWmz, gruppenVorgeschlagen: a.gruppenVorgeschlagen, fbhVerteilerAus: a.fbhVerteilerAus.map(E), autoVerteiler: a.autoVerteiler.map(B),
        gruppen: a.gruppen.map((g) => ({ ...g, gruppe: G(g.gruppe), ...(g.regel && { regel: { ...g.regel, ...(g.regel.einheit && { einheit: E(g.regel.einheit) }) } }) })),
      } }),
    };
    return vorlagenEinlesen(ausBeschreibung(geladen), gespeichert).zustand;
  }
  /** Review-Gebäude im Kleinen: Technik UG1 mit Wärmepumpe, Regel-OG mit 4 Büros, OG5 FBH, Gruppen vorgeschlagen. */
  function uebernommen(): AssistentZustand {
    let z = regelhaus();
    for (const a of [
      { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 },
      { typ: "erzeuger", katalogId: K.waermepumpe },
      ...heizungWahlAktionen("OG5", "fbh"),
      { typ: "schritt", nr: 5 },
    ] as Aktion[]) z = reduziere(z, a);
    return z;
  }
  const fbhGruppe = (z: AssistentZustand) => z.gruppen.find((g) => g.regel?.heizart === "fbh")!;
  const uvIn = (z: AssistentZustand, code: string) => unterverteiler(z).filter((t) => t.versorgt.some((e) => im(z, code).some((x) => x.schluessel === e)));

  it("Merker überstehen Speichern und Laden", () => {
    const vorher = uebernommen();
    expect(uvIn(vorher, "OG5")).toHaveLength(4);
    const z = speichernUndLaden(vorher);
    expect(z.automatik).toBe(true);
    expect(z.gruppenVorgeschlagen).toBe(true);
    expect(uvIn(z, "OG5").every((t) => t.auto && t.fbh)).toBe(true);
    expect(z.gruppen.map((g) => g.regel?.heizart).sort()).toEqual(["fbh", "hk"]);
    expect(z.gruppen.every((g) => g.vorgeschlagen)).toBe(true);
  });
  it("FBH in OG3 ergänzen: FBH-Verteiler entstehen und hängen an der FBH-Gruppe", () => {
    let z = speichernUndLaden(uebernommen());
    z = heizungWahlAktionen("OG3", "fbh").reduce(reduziere, z);
    const neu = uvIn(z, "OG3");
    expect(neu).toHaveLength(4);
    expect(neu.every((t) => t.status === "vorgeschlagen")).toBe(true);
    for (const t of neu) expect(fbhGruppe(z).verbraucher).toContain(t.schluessel);
    expect(fbhGruppe(z).verbraucher).toHaveLength(8);
    // Heizkörper aus OG3 sind nicht mehr in der HK-Gruppe
    const hk = z.gruppen.find((g) => g.regel?.heizart === "hk")!;
    expect(hk.verbraucher).toHaveLength(12);
  });
  it("angefasste Gruppe bleibt nach dem Laden unberührt", () => {
    let vorher = uebernommen();
    const hk = vorher.gruppen.find((g) => g.regel?.heizart === "hk")!;
    vorher = { ...vorher, gruppen: vorher.gruppen.map((g) => (g === hk ? { ...g, angefasst: true } : g)) };
    let z = speichernUndLaden(vorher);
    const hkNeu = z.gruppen.find((g) => g.regel?.heizart === "hk")!;
    expect(hkNeu.angefasst).toBe(true);
    const anzahl = hkNeu.verbraucher.length;
    z = reduziere(z, { typ: "einheitAnzahl", geschoss: "EG", art: "buero", anzahl: 1 });
    expect(z.gruppen.find((g) => g.schluessel === hkNeu.schluessel)!.verbraucher).toHaveLength(anzahl);
  });
  it("ohne gespeicherte Merker (alte Gebäude) bleibt die Automatik aus", () => {
    let z = speichernUndLaden(uebernommen(), false);
    expect(z.automatik).toBe(false);
    z = heizungWahlAktionen("OG3", "fbh").reduce(reduziere, z);
    expect(uvIn(z, "OG3")).toHaveLength(0);
  });
});
