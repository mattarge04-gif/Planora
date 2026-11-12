import { describe, expect, it } from "vitest";
import spec from "../../../../docs/superpowers/specs/2026-11-12-stufe1-interview-design.md?raw";
import { BESTUECKUNG, GRUPPEN_ARTEN, bestueckungVorschlag, K } from "./bestueckung";
import type { GruppenArt, KatalogEintrag } from "../typen";

/** Liest die Tabelle "Standardbestueckung je Gruppenart" (Spec §4.3) als { art: [{katalogId, menge}] }. */
function specTabelle(): Record<string, { katalogId: string; menge: number }[]> {
  const ab = spec.indexOf("| Art | Pumpe | Ventil |");
  expect(ab).toBeGreaterThan(0);
  const alle = spec.slice(ab).replace(/\r/g, "").split("\n").slice(2);
  const zeilen = alle.slice(0, alle.findIndex((z) => !z.startsWith("|")));
  const tabelle: Record<string, { katalogId: string; menge: number }[]> = {};
  for (const z of zeilen) {
    const [art, pumpe, ventil] = z.split("|").slice(1, 4).map((s) => s.trim());
    const teile: { katalogId: string; menge: number }[] = [];
    if (pumpe !== "–") teile.push({ katalogId: K.pumpe, menge: Number(pumpe) });
    const v = /^(\d+) × (ventil_\w+)$/.exec(ventil);
    if (v) teile.push({ katalogId: `heizung.${v[2]}`, menge: Number(v[1]) });
    tabelle[art] = teile;
  }
  return tabelle;
}

describe("bestueckungVorschlag", () => {
  it("spiegelt die Spec-Tabelle 4.3 exakt", () => {
    const t = specTabelle();
    expect(Object.keys(t).sort()).toEqual([...GRUPPEN_ARTEN].sort());
    for (const art of GRUPPEN_ARTEN) expect(BESTUECKUNG[art]).toEqual(t[art]);
  });
  it("liefert Kopien und filtert unbekannte Katalogeinträge", () => {
    const v = bestueckungVorschlag("beimisch");
    v[0].menge = 9;
    expect(BESTUECKUNG.beimisch[0].menge).toBe(1);
    const katalog: KatalogEintrag[] = [{ id: K.pumpe, name: "Umwaelzpumpe", bereich: "zubehoer" }];
    expect(bestueckungVorschlag("beimisch", katalog)).toEqual([{ katalogId: K.pumpe, menge: 1 }]);
    expect(bestueckungVorschlag("drossel" as GruppenArt, katalog)).toEqual([]);
  });
});
