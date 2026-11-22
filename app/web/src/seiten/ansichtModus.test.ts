import { describe, expect, it } from "vitest";
import { naechsteAnsicht, type AnsichtStand } from "./ansichtModus";

const uebersicht: AnsichtStand = { ansicht: "uebersicht", erneuerung: false };
const technik: AnsichtStand = { ansicht: "technik", erneuerung: false };

describe("Ansicht und Erneuerung", () => {
  it("Einschalten in der Übersicht bleibt in der Übersicht, Ausschalten ebenso", () => {
    const an = naechsteAnsicht(uebersicht, { art: "erneuerung", an: true });
    expect(an).toEqual({ stand: { ansicht: "uebersicht", erneuerung: true }, meldung: "Erneuerungsansicht an" });
    const aus = naechsteAnsicht(an.stand, { art: "erneuerung", an: false });
    expect(aus).toEqual({ stand: uebersicht, meldung: "Erneuerungsansicht aus" });
  });
  it("in Technik bleibt Technik", () => {
    const an = naechsteAnsicht(technik, { art: "erneuerung", an: true }).stand;
    expect(an).toEqual({ ansicht: "technik", erneuerung: true });
    expect(naechsteAnsicht(an, { art: "erneuerung", an: false }).stand).toEqual(technik);
  });
  it("E zweimal schaltet ein und wieder aus (Umschalten mit !an)", () => {
    let s = uebersicht;
    for (let i = 0; i < 2; i++) s = naechsteAnsicht(s, { art: "erneuerung", an: !s.erneuerung }).stand;
    expect(s).toEqual(uebersicht);
  });
  it("Ansichtswechsel lässt die Erneuerung an", () => {
    const an = naechsteAnsicht(technik, { art: "erneuerung", an: true }).stand;
    const r = naechsteAnsicht(an, { art: "ansicht", ansicht: "uebersicht" });
    expect(r).toEqual({ stand: { ansicht: "uebersicht", erneuerung: true }, meldung: null });
  });
  it("gleicher Schaltzustand erneut gesetzt: keine Meldung", () => {
    expect(naechsteAnsicht(uebersicht, { art: "erneuerung", an: false })).toEqual({ stand: uebersicht, meldung: null });
  });
});
