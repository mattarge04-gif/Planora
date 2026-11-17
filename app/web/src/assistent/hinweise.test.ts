import { describe, expect, it } from "vitest";
import { K } from "./bestueckung";
import { pruefHinweise, zusammenfassung } from "./hinweise";
import { leererZustand, reduziere, type Aktion, type AssistentZustand } from "./zustand";
import { zuBeschreibungMitPositionen } from "./beschreibung";

function haus(...aktionen: Aktion[]): AssistentZustand {
  let z = reduziere(leererZustand("l"), { typ: "geschosse", ug: 1, og: 2 });
  z = reduziere(z, { typ: "gebaeudeAngelegt", id: "00000000-0000-4000-8000-000000000900", stand: 0,
    geschosse: z.gebaeude.geschosse.map((g, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, code: g.code })) });
  for (const a of aktionen) z = reduziere(z, a);
  return z;
}
const hinweise = (z: AssistentZustand) => pruefHinweise(z, null, zuBeschreibungMitPositionen(z).positionen).map((h) => h.text);

describe("Prüfen in Klartext (H7)", () => {
  it("fehlende Mengen gebündelt", () => {
    const z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 }, { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe });
    expect(hinweise(z)).toContain("Für 3 Einheiten fehlt die Anzahl Heizkörper.");
  });
  it("Verbraucher ohne Gruppe gebündelt, eine Zeile je Bauteilart", () => {
    const z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 4 }, { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe });
    expect(hinweise(z)).toContain("4 Heizkörper gehören zu keiner Gruppe.");
  });
  it("Heizart ohne Gruppe", () => {
    let z = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 1 }, { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 }, { typ: "erzeuger", katalogId: K.waermepumpe });
    z = reduziere(z, { typ: "schritt", nr: 5 });
    z = reduziere(z, { typ: "geschossAusnahme", geschoss: "OG1", art: "fbh", wert: "ja" });
    expect(hinweise(z)).toContain("Für Fussbodenheizung gibt es noch keine Gruppe.");
  });
  it("Zusammenfassung in Sätzen", () => {
    let z = haus({ typ: "vorlageNeu", name: "Regel-OG" });
    const v = z.vorlagen[0].schluessel;
    z = reduziere(z, { typ: "platzAnzahl", vorlage: v, art: "buero", anzahl: 4 });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v, geschoss: "OG1", an: true });
    z = reduziere(z, { typ: "vorlageZuweisen", vorlage: v, geschoss: "OG2", an: true });
    const s = zusammenfassung(z);
    expect(s.find((x) => x.titel === "Einheiten")!.text).toBe("8 Einheiten in 2 Geschossen, 2 Geschosse wie «Regel-OG».");
    expect(s.find((x) => x.titel === "Heizung")!.text).toBe("Heizkörper: ja · Fussbodenheizung: nein · TABS: nein");
  });
});

describe("Zusammenfassung vollständig (B13/B14)", () => {
  function voll(): AssistentZustand {
    let z = haus(
      { typ: "einheitAnzahl", geschoss: "UG1", art: "technik", anzahl: 1 },
      { typ: "einheitAnzahl", geschoss: "EG", art: "gastro", anzahl: 1 },
      { typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 3 },
      { typ: "geschossAusnahme", geschoss: "OG1", art: "fbh", wert: "ja" },
      { typ: "geschossAusnahme", geschoss: "EG", art: "fbh", wert: "ja" },
      { typ: "standardGeraet", art: "hk", hersteller: "Zehnder" },
      { typ: "erzeuger", katalogId: K.waermepumpe },
      { typ: "schritt", nr: 5 },
    );
    const gastro = z.einheiten.find((e) => e.art === "gastro")!;
    z = reduziere(z, { typ: "sondergruppe", einheit: gastro.schluessel, heizart: "fbh" });
    return z;
  }
  const zeile = (z: AssistentZustand, titel: string) => zusammenfassung(z).find((x) => x.titel === titel)?.text;
  it("FBH-Verteiler mit Aufteilung je Gruppe und FBH-Kreisen ohne Verteiler", () => {
    let z = voll();
    expect(zeile(z, "FBH-Verteiler")).toBe("4: 3 an «Fussbodenheizung», 1 an «Fussbodenheizung Gastro 0.01»");
    const b3 = z.einheiten.find((e) => e.bezeichnung === "Büro 1.03")!;
    z = reduziere(z, { typ: "unterverteiler", einheit: b3.schluessel, an: false });
    expect(zeile(z, "FBH-Verteiler")).toBe("3: 2 an «Fussbodenheizung», 1 an «Fussbodenheizung Gastro 0.01» · 1 FBH-Kreis ohne Verteiler (Büro 1.03)");
  });
  it("Wärmezähler an Gruppen und FBH-Verteilern, sonst «keine»", () => {
    let z = voll();
    expect(zeile(z, "Wärmezähler")).toBe("keine");
    z = reduziere(z, { typ: "fbhWmzAlle", an: true });
    expect(zeile(z, "Wärmezähler")).toBe("an allen 4 FBH-Verteilern");
    const hk = z.gruppen.find((g) => g.regel?.heizart === "hk")!;
    z = reduziere(z, { typ: "gruppeWmz", gruppe: hk.schluessel, an: true });
    const uv = z.bauteile.find((t) => t.fbh)!;
    z = reduziere(z, { typ: "unterverteilerWmz", verteiler: uv.schluessel, an: false });
    expect(zeile(z, "Wärmezähler")).toBe("an Gruppe «Heizkörper» · an 3 von 4 FBH-Verteilern");
  });
  it("Hersteller am Standard und «keine» statt 0", () => {
    const z = voll();
    expect(zeile(z, "Hersteller")).toBe("Heizkörper: Zehnder");
    expect(zeile(z, "Weitere Teile")).toBe("keine");
    const leer = haus({ typ: "einheitAnzahl", geschoss: "OG1", art: "buero", anzahl: 1 });
    expect(zeile(leer, "Hersteller")).toBe("keine Angabe");
  });
});
