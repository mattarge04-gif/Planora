import { describe, expect, it } from "vitest";
import { dokumentQuelle } from "./preisQuelle";
import type { LdStand, PreisQuelle } from "../lebensdauer/typen";

const quelle = (dokumentId: string | null, seite: number | null = 2): PreisQuelle => ({ dokumentId, dateiname: dokumentId ? "o1-pumpen.pdf" : null, seite });
const stand = (preis: "bauteil" | "typ" | null, herkunft: "kunde" | "dokument" | null, akteQ: PreisQuelle | null, typQ: PreisQuelle | null = null) => ({
  gebaeudeId: "g", stand: 1, heizungBaujahr: null,
  typen: [{ katalogId: "heizung.umwaelzpumpe", lMittel: null, stueckpreis: 1296, quellePreis: "dokument", preisQuelle: typQ, gelbJahre: null, standard: 12, bereich: { min: 8, max: 15 } }],
  bauteile: [{ id: "p1", katalogId: "heizung.umwaelzpumpe", menge: 1, baujahr: null, hersteller: null, typ: null, ort: "UG1",
    akte: { zustand: null, lebensdauerJahre: null, stueckpreis: 1296, quellePreis: herkunft, notiz: null, preisQuelle: akteQ } }],
  ergebnis: { stichtag: 2026, jahre: [], summe5: { betrag: 0, ohnePreis: 0 }, zaehler: { gruen: 1, gelb: 0, rot: 0, grau: 0 },
    bauteile: [{ id: "p1", ampel: "gruen", baujahr: 2008, ersatzjahr: 2030, restjahre: 4, lebensdauer: 12, stueckpreis: 1296, kosten: 1296, mengeAngenommen: false,
      quellen: { baujahr: "bauteil", lebensdauer: "planora", preis, preisHerkunft: herkunft } }] },
}) as LdStand;

describe("dokumentQuelle", () => {
  it("zeigt Datei und Seite mit Ziel fuer den Viewer", () => {
    expect(dokumentQuelle(stand("bauteil", "dokument", quelle("d1")), "p1")).toEqual({
      text: "aus o1-pumpen.pdf, S. 2", kurz: "o1-pumpen, S. 2", kurzName: "o1-pumpen", stelle: ", S. 2", dokumentId: "d1", seite: 2, typpreis: false, dateiname: "o1-pumpen.pdf" });
  });
  it("nimmt beim Typpreis die Quelle des Typs", () => {
    const q = dokumentQuelle(stand("typ", "dokument", null, quelle("d2", 3)), "p1");
    expect(q).toMatchObject({ typpreis: true, text: "aus o1-pumpen.pdf, S. 3", dokumentId: "d2", seite: 3 });
  });
  it("meldet geloeschte Dokumente ohne Link", () => {
    expect(dokumentQuelle(stand("bauteil", "dokument", quelle(null)), "p1")).toMatchObject({ text: "aus Dokument (gelöscht)", dokumentId: null, seite: null });
  });
  it("ist null fuer Handeingaben und fehlende Preise", () => {
    expect(dokumentQuelle(stand("bauteil", "kunde", null), "p1")).toBeNull();
    expect(dokumentQuelle(stand(null, null, null), "p1")).toBeNull();
    expect(dokumentQuelle(stand("bauteil", "dokument", quelle("d1")), "fehlt")).toBeNull();
  });
});
