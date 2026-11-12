import { describe, expect, it } from "vitest";
import m5 from "./__fixtures__/m5-fbh-ueber-geschosse.json";
import { K } from "./bestueckung";
import { ausBeschreibung, zuBeschreibung, zuBeschreibungMitPositionen } from "./beschreibung";
import { pruefHinweise } from "./hinweise";
import {
  abgabenVon, bestueckungVon, gruppeVonVerbraucher, hauptverteiler, leererZustand, reduziere, unterverteiler, verbraucherKandidaten,
  vorKandidaten, weitereTeile, zubehoerVon, type Aktion, type AssistentZustand,
} from "./zustand";
import type { BeschreibungEingabe, Welt } from "../typen";

function angelegt(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 0, og: 1 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: [{ id: "00000000-0000-4000-8000-000000000001", code: "EG" }, { id: "00000000-0000-4000-8000-000000000002", code: "OG1" }] });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
const basis = () => angelegt(
  { typ: "einheitNeu", geschoss: "EG", art: "buero", anzahl: 2 },
  { typ: "erzeuger", katalogId: K.waermepumpe },
  { typ: "gruppenAnzahl", anzahl: 2 },
);

describe("Schritt 5 – Gruppen", () => {
  it("Anzahl erzeugt Gruppen am Hauptverteiler mit Nummern und Vorschlag «ungeregelt»", () => {
    const z = basis();
    const h = hauptverteiler(z)!;
    expect(h.standort).toEqual({ einheit: z.zentraleRaum });
    expect(z.gruppen.map((g) => [g.nummer, g.art, g.bezeichnung, g.verteiler])).toEqual([[1, "ungeregelt", "Gruppe 1", h.schluessel], [2, "ungeregelt", "Gruppe 2", h.schluessel]]);
    expect(bestueckungVon(z, z.gruppen[0].schluessel).filter((b) => b.menge)).toEqual([{ katalogId: K.pumpe, menge: 1, vorgeschlagen: true }]);
    const weniger = reduziere(z, { typ: "gruppenAnzahl", anzahl: 1 });
    expect(weniger.gruppen.length).toBe(1);
    expect(zubehoerVon(weniger, z.gruppen[1].schluessel)).toEqual([]);
  });

  it("Verbraucher kann nur in einer Gruppe sein: Umhängen entfernt ihn aus der alten", () => {
    let z = basis();
    const [g1, g2] = z.gruppen;
    const hk = abgabenVon(z, z.einheiten[0].schluessel)[0].schluessel;
    z = reduziere(z, { typ: "verbraucher", gruppe: g1.schluessel, bauteil: hk, an: true });
    expect(gruppeVonVerbraucher(z, hk)?.schluessel).toBe(g1.schluessel);
    z = reduziere(z, { typ: "verbraucher", gruppe: g2.schluessel, bauteil: hk, an: true });
    expect(z.gruppen[0].verbraucher).toEqual([]);
    expect(z.gruppen[1].verbraucher).toEqual([hk]);
    z = reduziere(z, { typ: "verbraucher", gruppe: g2.schluessel, bauteil: hk, an: false });
    expect(z.gruppen.flatMap((g) => g.verbraucher)).toEqual([]);
    expect(zuBeschreibung(reduziere(z, { typ: "verbraucher", gruppe: g1.schluessel, bauteil: hk, an: true })).gruppen!.flatMap((g) => g.verbraucher).length).toBe(1);
  });

  it("Änderung der Art ersetzt nur vorgeschlagene Bestückung, bestätigte bleibt", () => {
    let z = basis();
    const g = z.gruppen[0].schluessel;
    z = reduziere(z, { typ: "bestueckung", gruppe: g, katalogId: K.ventil2, delta: 1 }); // bestätigt
    z = reduziere(z, { typ: "gruppeArt", schluessel: g, art: "beimisch" });
    const teile = () => zubehoerVon(z, g).map((t) => [t.katalogId, t.menge, t.status]);
    expect(teile()).toEqual([[K.ventil2, 1, "bestaetigt"], [K.pumpe, 1, "vorgeschlagen"], [K.ventil3, 1, "vorgeschlagen"]]);
    // Bestätigte Pumpe deckt den Vorschlag der neuen Art ab
    z = reduziere(z, { typ: "bestueckung", gruppe: g, katalogId: K.pumpe, delta: 1 });
    z = reduziere(z, { typ: "gruppeArt", schluessel: g, art: "einspritz" });
    expect(teile()).toEqual([[K.ventil2, 1, "bestaetigt"], [K.pumpe, 2, "bestaetigt"]]);
    z = reduziere(z, { typ: "gruppeArt", schluessel: g, art: "umlenk" });
    expect(teile()).toEqual([[K.ventil2, 1, "bestaetigt"], [K.pumpe, 2, "bestaetigt"], [K.ventil3, 1, "vorgeschlagen"]]);
  });

  it("Minus entfernt das letzte Teil; WMZ ja/nein", () => {
    let z = basis();
    const g = z.gruppen[0].schluessel;
    z = reduziere(z, { typ: "bestueckung", gruppe: g, katalogId: K.pumpe, delta: -1 });
    expect(zubehoerVon(z, g)).toEqual([]);
    z = reduziere(z, { typ: "gruppeWmz", gruppe: g, an: true });
    expect(zubehoerVon(z, g).map((t) => t.katalogId)).toEqual([K.wmz]);
    z = reduziere(z, { typ: "gruppeWmz", gruppe: g, an: false });
    expect(zubehoerVon(z, g)).toEqual([]);
  });

  it("Checkliste nach Geschoss und Einheit, inkl. Unterverteiler", () => {
    const f = m5 as unknown as { huelle: { geschosse: { id: string; code: string }[] }; beschreibung: BeschreibungEingabe };
    const z = ausBeschreibung({ ...f.beschreibung, geschosse: f.huelle.geschosse });
    const k = verbraucherKandidaten(z);
    expect(k.map((x) => x.geschoss)).toEqual(["OG2", "OG1"]);
    expect(k[1].einheiten.map((e) => e.einheit.bezeichnung)).toEqual(["Technik OG1", "Wohnung 1", "Wohnung 2"]);
    expect(k[1].einheiten[0].teile.map((t) => t.katalogId)).toEqual([K.verteiler]);
    expect(unterverteiler(z).length).toBe(1);
  });
});

describe("Schritt 6 und 7", () => {
  it("Unterverteiler je FBH-Einheit mit WMZ vor dem Verteiler", () => {
    let z = basis();
    const e = z.einheiten[0].schluessel;
    z = reduziere(z, { typ: "ausnahme", einheit: e, art: "fbh", wert: "ja" });
    z = reduziere(z, { typ: "unterverteiler", einheit: e, an: true });
    const uv = unterverteiler(z);
    expect(uv.map((t) => [t.standort, t.versorgt])).toEqual([[{ einheit: e }, [e]]]);
    expect(hauptverteiler(z)!.schluessel).not.toBe(uv[0].schluessel);
    z = reduziere(z, { typ: "unterverteilerWmz", verteiler: uv[0].schluessel, an: true });
    const wmz = z.bauteile.find((t) => t.katalogId === K.wmz)!;
    expect(wmz).toMatchObject({ ort: { vorBauteil: uv[0].schluessel }, standort: { einheit: e } });
    expect(weitereTeile(z)).toEqual([]); // WMZ des Unterverteilers gehört zu Schritt 6
    z = reduziere(z, { typ: "unterverteiler", einheit: e, an: false });
    expect(z.bauteile.some((t) => t.katalogId === K.wmz || t.versorgt.includes(e) && t !== hauptverteiler(z))).toBe(false);
  });

  it("Teil vor Bauteil: Standort des Bezugs, Bezug änderbar, kein Selbstbezug", () => {
    let z = basis();
    const wp = z.bauteile.find((t) => t.katalogId === K.waermepumpe)!;
    expect(vorKandidaten(z).map((t) => t.katalogId)).toEqual([K.waermepumpe, K.verteiler]);
    z = reduziere(z, { typ: "teilNeu", katalogId: K.pumpe, vor: wp.schluessel });
    const teil = weitereTeile(z)[0];
    expect(teil).toMatchObject({ katalogId: K.pumpe, ort: { vorBauteil: wp.schluessel }, standort: wp.standort });
    z = reduziere(z, { typ: "teilAendern", schluessel: teil.schluessel, vor: teil.schluessel });
    expect(weitereTeile(z)[0].ort).toEqual({ vorBauteil: wp.schluessel });
    const b = zuBeschreibung(z);
    expect(b.bauteile.find((t) => t.katalogId === K.pumpe && t.ort && "vorBauteil" in t.ort)!.ort)
      .toEqual({ vorBauteil: { bauteilIndex: b.bauteile.findIndex((t) => t.katalogId === K.waermepumpe) } });
  });
});

describe("Schritt 8 – Hinweise", () => {
  it("ohne_gruppe und gruppe_leer aus dem Zustand; Welt-Hinweise per Platzhalter-ID", () => {
    const z = basis();
    const { positionen } = zuBeschreibungMitPositionen(z);
    const welt = { hinweise: [{ code: "ueberlappung", bezug: "neu-e-1" }, { code: "ohne_gruppe", bezug: "x" }], symbole: [] } as unknown as Welt;
    const h = pruefHinweise(z, welt, positionen);
    expect(h.filter((x) => x.code === "ohne_gruppe").map((x) => x.text)).toEqual(["Heizkörper, Büro 1 gehört zu keiner Gruppe.", "Heizkörper, Büro 2 gehört zu keiner Gruppe."]);
    expect(h.filter((x) => x.code === "gruppe_leer").length).toBe(2);
    expect(h.find((x) => x.code === "ueberlappung")).toMatchObject({ text: "«Büro 2» überlappt mit einer manuell platzierten Einheit.", schritt: 2 });
  });
  it("vollständige Beschreibung ohne Hinweise", () => {
    let z = basis();
    for (const [i, e] of z.einheiten.filter((x) => x.art === "buero").entries())
      z = reduziere(z, { typ: "verbraucher", gruppe: z.gruppen[i].schluessel, bauteil: abgabenVon(z, e.schluessel)[0].schluessel, an: true });
    expect(pruefHinweise(z, null, zuBeschreibungMitPositionen(z).positionen)).toEqual([]);
  });
});
