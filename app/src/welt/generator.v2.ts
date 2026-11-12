import { KATALOG_V2 } from "./katalog.v2.js";
import { mm, mitHash, pflichtId, weltKern } from "./generator.kern.js";
import type { RegelwerkV2 } from "./regelwerk.js";
import type { Beschreibung, BauteilEingabe, HuelleGespeichert, Welt, WeltGruppe, WeltOrt } from "./typen.js";

/** Ersatzmasse (Breite, Tiefe), solange das Layout aus dem Inhalt (Track A) fehlt. */
const STUB_MASSE: [number, number] = [30, 15];

const ortId = (t: BauteilEingabe): string | null => {
  if (!t.ort) return null;
  if ("gruppe" in t.ort) return "g:" + t.ort.gruppe.gruppeId;
  return "b:" + t.ort.vorBauteil.bauteilId;
};

/**
 * STUB (V4): Regelwerk v2 mit der v1-Layoutlogik auf festen Massen. Track A ersetzt das Layout (Modulmatrix);
 * Gruppen, Ort und Steigzone sind bereits endgueltig im Vertrag.
 */
export function weltErzeugenV2(h: HuelleGespeichert, b: Beschreibung, rw: RegelwerkV2): Welt {
  const kern = weltKern(h, b, rw, { standardMasse: STUB_MASSE, ortSchluessel: ortId });
  const symbolVon = new Map<string, string>(); // Bauteil-ID -> Symbolschluessel
  for (const s of kern.symbole) for (const id of s.bauteilIds) symbolVon.set(id, s.schluessel);
  const bauteil = new Map(b.bauteile.map((t) => [pflichtId(t), t]));
  const schluesselVon = (v: { bauteilId?: string }) => {
    if (!v.bauteilId) throw new Error("Generator braucht gespeicherte IDs in Verweisen");
    return symbolVon.get(v.bauteilId)!;
  };
  const symbole = kern.symbole.map((s) => {
    const ort = bauteil.get(s.bauteilIds[0])!.ort;
    if (!ort) return s;
    const welt: WeltOrt = "gruppe" in ort
      ? { gruppe: ort.gruppe.gruppeId ?? (() => { throw new Error("Generator braucht gespeicherte IDs in Verweisen"); })() }
      : { vorBauteil: schluesselVon(ort.vorBauteil) };
    return { ...s, ort: welt };
  });
  const gruppen: WeltGruppe[] = (b.gruppen ?? []).map((g) => {
    const id = pflichtId(g);
    return {
      id, verteiler: schluesselVon(g.verteiler), nummer: g.nummer, art: g.art, bezeichnung: g.bezeichnung,
      verbraucher: [...new Set(g.verbraucher.map(schluesselVon))],
      zubehoer: symbole.filter((s) => s.ort && "gruppe" in s.ort && s.ort.gruppe === id).map((s) => s.schluessel),
    };
  });

  // Steigzone: Mitte des Kerns, sonst der Einheit mit dem ersten Erzeuger (Katalogbereich "zentrale")
  const mitte = (einheitId: string | undefined) => {
    const e = kern.einheiten.find((x) => x.id === einheitId);
    return e ? { x: mm(e.rechteck.x + e.rechteck.breite / 2), z: mm(e.rechteck.z + e.rechteck.tiefe / 2) } : null;
  };
  const zentralen = new Set(KATALOG_V2.eintraege.filter((k) => k.bereich === "zentrale").map((k) => k.id));
  const kernEinheit = kern.einheiten.find((e) => e.art === "kern");
  const erzeuger = b.bauteile.find((t) => zentralen.has(t.katalogId) && t.standort.einheitId);
  const steigzone = kernEinheit ? mitte(kernEinheit.id) : erzeuger ? mitte(erzeuger.standort.einheitId) : null;

  return mitHash({ ...kern, symbole, gruppen, steigzone });
}
