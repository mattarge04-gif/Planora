import { describe, expect, it } from "vitest";
import type { KatalogEintrag, Welt } from "../typen";
import { gruppenKarte, gruppenVon } from "./gruppenKarte";

const dateien = import.meta.glob<Welt>("../fixtures/muster-*.json", { eager: true, import: "default" });
const muster = (name: string): Welt => structuredClone(dateien[Object.keys(dateien).find((p) => p.includes(`muster-${name}`))!]);
const katalog: KatalogEintrag[] = [
  { id: "heizung.verteiler", name: "Verteiler", bereich: "verteilung" },
  { id: "heizung.umwaelzpumpe", name: "Umwaelzpumpe", bereich: "zubehoer" },
  { id: "heizung.wmz", name: "Waermezaehler", bereich: "zubehoer" },
];

describe("gruppenKarte", () => {
  it("Muster 3: Einspritzgruppe mit Bestückung und Verbrauchern, zweite Gruppe ohne Zubehör", () => {
    const w = muster("m3");
    const [hk, fbh] = gruppenVon(w, katalog);
    const k = gruppenKarte(w, katalog, fbh.gruppeId)!;
    expect(k.titel).toBe("FBH");
    expect(k.art).toBe("Einspritzschaltung");
    expect(k.bestueckung.map((b) => b.name)).toEqual(expect.arrayContaining(["Umwälzpumpe", "3-Weg-Ventil", "Durchgangsventil"]));
    expect(k.bestueckung.reduce((n, b) => n + b.menge, 0)).toBe(5);
    expect(k.verbraucher).toHaveLength(3);
    expect(k.verbraucher.map((v) => v.name)).toEqual(["6 × FBH-Kreis", "4 × FBH-Kreis", "FBH-Kreis"]);
    expect(k.verbraucher.map((v) => v.ort)).toEqual(["EG · Restaurant", "OG1 · Buero C", "OG1 · Buero D"]);
    expect(k.betont).toEqual([...fbh.zubehoer, ...fbh.verbraucher]);
    expect(k.verteiler).toBe("Heizungsverteiler, Abgang 2");
    expect(gruppenKarte(w, katalog, hk.gruppeId)!.bestueckung).toEqual([]);
  });
  it("Muster 5: Wärmezähler mit Umlaut", () => {
    const w = muster("m5");
    const namen = gruppenVon(w, katalog).flatMap((g) => gruppenKarte(w, katalog, g.gruppeId)!.bestueckung.map((b) => b.name));
    expect(namen).toContain("Wärmezähler");
  });
  it("v1-Welt ohne Gruppen: Ersatzgruppe als ungeregelte Leitung", () => {
    const w = muster("m2");
    delete w.gruppen;
    w.symbole.forEach((s) => delete s.ort);
    const g = gruppenVon(w, katalog)[0];
    const k = gruppenKarte(w, katalog, g.gruppeId)!;
    expect(k.titel).toBe("Ungeregelte Leitung");
    expect(k.art).toBe("Ungeregelt");
  });
  it("unbekannte ID ergibt keine Karte", () => {
    expect(gruppenKarte(muster("m2"), katalog, "gibt-es-nicht")).toBeNull();
  });
});
