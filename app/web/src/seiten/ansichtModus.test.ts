import { describe, expect, it } from "vitest";
import { naechsteAnsicht, type AnsichtStand } from "./ansichtModus";

const uebersicht: AnsichtStand = { ansicht: "uebersicht", erneuerung: false, vorher: null };
const technik: AnsichtStand = { ansicht: "technik", erneuerung: false, vorher: null };

describe("Ansicht und Erneuerung", () => {
  it("Einschalten aus der Übersicht wechselt in Technik, Ausschalten kehrt zurück", () => {
    const an = naechsteAnsicht(uebersicht, { art: "erneuerung", an: true });
    expect(an.stand).toEqual({ ansicht: "technik", erneuerung: true, vorher: "uebersicht" });
    const aus = naechsteAnsicht(an.stand, { art: "erneuerung", an: false });
    expect(aus.stand).toEqual(uebersicht);
    expect(aus.meldung).toBe("Erneuerungsansicht aus");
  });
  it("aus Technik bleibt Technik", () => {
    const an = naechsteAnsicht(technik, { art: "erneuerung", an: true }).stand;
    expect(naechsteAnsicht(an, { art: "erneuerung", an: false }).stand).toEqual(technik);
  });
  it("E zweimal schaltet ein und wieder aus (Umschalten mit !an)", () => {
    let s = uebersicht;
    for (let i = 0; i < 2; i++) s = naechsteAnsicht(s, { art: "erneuerung", an: !s.erneuerung }).stand;
    expect(s).toEqual(uebersicht);
  });
  it("Übersicht wählen beendet Erneuerung mit Meldung", () => {
    const an = naechsteAnsicht(technik, { art: "erneuerung", an: true }).stand;
    const r = naechsteAnsicht(an, { art: "ansicht", ansicht: "uebersicht" });
    expect(r.stand).toEqual(uebersicht);
    expect(r.meldung).toMatch(/Erneuerung beendet/);
  });
  it("bewusst Technik gewählt: Ausschalten bleibt in Technik", () => {
    let s = naechsteAnsicht(uebersicht, { art: "erneuerung", an: true }).stand;
    s = naechsteAnsicht(s, { art: "ansicht", ansicht: "technik" }).stand;
    expect(naechsteAnsicht(s, { art: "erneuerung", an: false }).stand.ansicht).toBe("technik");
  });
  it("ohne Erneuerung ändert Ansichtswahl nur die Ansicht", () => {
    expect(naechsteAnsicht(uebersicht, { art: "ansicht", ansicht: "technik" })).toEqual({ stand: technik, meldung: null });
  });
});
