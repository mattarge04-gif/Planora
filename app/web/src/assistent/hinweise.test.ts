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
