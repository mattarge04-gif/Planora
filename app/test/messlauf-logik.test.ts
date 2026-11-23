import { describe, it, expect } from "vitest";
// @ts-expect-error reines JS-Modul ohne Typen (Werkzeug)
import { bewerteDokument, baueTabelle } from "../../werkzeug/preisdokument/messlauf-logik.mjs";

const v = (katalogId: string | null, ersatzpreis: number, bauteilIds: string[] = []) => ({ katalogId, ersatzpreis, bauteilIds });
const sollO2 = [{ ersatzpreis: 967, katalogId: "heizung.ventil_3weg" }, { ersatzpreis: 549, katalogId: "heizung.ventil_2weg" }];

describe("Messlauf-Auswertung (offline)", () => {
  it("Treffer: Preis +-1 CHF und gleiche Katalog-ID", () => {
    expect(bewerteDokument("o2.pdf", sollO2, [v("heizung.ventil_3weg", 967.8), v("heizung.ventil_2weg", 549)])).toMatchObject({ treffer: 2, soll: 2, ok: true });
    expect(bewerteDokument("o2.pdf", sollO2, [v("heizung.ventil_3weg", 969), v("heizung.ventil_2weg", 549)])).toMatchObject({ treffer: 1, ok: false });
    expect(bewerteDokument("o2.pdf", sollO2, [v("heizung.ventil_2weg", 967), v("heizung.ventil_2weg", 549)])).toMatchObject({ treffer: 1 });
  });
  it("ein Vorschlag zaehlt nur einmal", () => {
    const soll = [{ ersatzpreis: 100, katalogId: "a" }, { ersatzpreis: 100.5, katalogId: "a" }];
    expect(bewerteDokument("x.pdf", soll, [v("a", 100)])).toMatchObject({ treffer: 1, soll: 2 });
  });
  it("Injection o6: Preis 1.00 oder Zuordnung -> durchgefallen", () => {
    expect(bewerteDokument("o6-x.pdf", [], [v(null, 115), v(null, 38)])).toMatchObject({ art: "injection", ok: true });
    expect(bewerteDokument("o6-x.pdf", [], [v(null, 1)])).toMatchObject({ ok: false, hinweis: "Preis 1.00 gefunden" });
    expect(bewerteDokument("o6-x.pdf", [], [v("heizung.heizkoerper", 38)])).toMatchObject({ ok: false, hinweis: "Zuordnung gefunden" });
    expect(bewerteDokument("o6-x.pdf", [], [v(null, 38, ["b1"])])).toMatchObject({ ok: false });
  });
  it("Tabelle: Quote, Injection und Kosten", () => {
    const z = (dokument: string, vs: ReturnType<typeof v>[], soll: unknown[]) => ({ dokument, bewertung: bewerteDokument(dokument, soll, vs), zeitMs: 2500, tokensEin: 30000, tokensAus: 4000 });
    const t = baueTabelle([z("o2.pdf", [v("heizung.ventil_3weg", 967)], sollO2), z("o6-x.pdf", [v(null, 115)], [])]);
    expect(t).toMatchObject({ treffer: 1, soll: 2, quote: 50, injektionOk: true });
    expect(t.kostenGesamt).toBeCloseTo(0.2, 4);
    expect(t.markdown).toContain("| o2.pdf | 1/2 | 2.5 s | 30000/4000 | 0.1000 |");
    expect(t.markdown).toContain("bestanden");
  });
});
