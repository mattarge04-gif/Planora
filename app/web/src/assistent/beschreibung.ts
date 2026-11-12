import type { BauteilEingabe, BauteilVerweis, BeschreibungEingabe, EinheitEingabe, EinheitVerweis, Grundform, GruppeEingabe, Heizung, Welt } from "../typen";
import { ERZEUGER, K } from "./bestueckung";
import type { AssistentZustand, ZBauteil, ZEinheit, ZGruppe, ZOrt, ZStandort } from "./zustand";

/** Kopf aus anderen Quellen (Gebäudeliste, Welt), weil die Beschreibung Name und Form nicht enthält. */
export interface GebaeudeKopf { liegenschaftId?: string | null; name?: string; grundform?: Grundform }

const ohneLeere = (h: Partial<Heizung> | undefined): Partial<Heizung> => {
  const r: Partial<Heizung> = {};
  for (const [k, v] of Object.entries(h ?? {})) if (v !== undefined) r[k as keyof Heizung] = v;
  return r;
};

/** Grundform aus dem Grundriss der Welt (Lesemodus, wenn die Hülle nicht abrufbar ist). */
export function grundformAusWelt(w: Pick<Welt, "grundriss">): Grundform {
  if (w.grundriss.length >= 3) return "u_form";
  if (w.grundriss.length === 2) return "l_form";
  const r = w.grundriss[0];
  return r && Math.abs(r.breite - r.tiefe) < 1e-6 ? "quadrat" : "quader";
}

/**
 * Beschreibung (API) → Assistent-Zustand. Elemente mit ID behalten sie als Schlüssel, Elemente ohne ID erhalten
 * `e<i>`, `b<i>`, `g<i>` (Position). `b.geschosse` muss gesetzt sein (GET liefert sie immer).
 */
export function ausBeschreibung(b: BeschreibungEingabe, kopf: GebaeudeKopf = {}): AssistentZustand {
  const geschosse = b.geschosse ?? [];
  const codeVon = new Map(geschosse.map((g) => [g.id, g.code]));
  const eKey = b.einheiten.map((e, i) => e.id ?? `e${i}`);
  const tKey = b.bauteile.map((t, i) => t.id ?? `b${i}`);
  const gruppen = b.gruppen ?? [];
  const gKey = gruppen.map((g, i) => g.id ?? `g${i}`);
  const einheit = (v: EinheitVerweis): string => (v.einheitId !== undefined ? v.einheitId : eKey[v.einheitIndex!]);
  const bauteil = (v: BauteilVerweis): string => (v.bauteilId !== undefined ? v.bauteilId : tKey[v.bauteilIndex!]);

  const einheiten: ZEinheit[] = b.einheiten.map((e, i) => ({
    schluessel: eKey[i], ...(e.id !== undefined && { id: e.id }), geschoss: codeVon.get(e.geschossId) ?? e.geschossId,
    bezeichnung: e.bezeichnung, art: e.art, flaecheM2: e.flaecheM2 ?? null,
    ...(e.layoutManuell != null && { layoutManuell: e.layoutManuell }), ausnahme: ohneLeere(e.heizungAusnahme),
  }));
  const bauteile: ZBauteil[] = b.bauteile.map((t, j) => {
    const standort: ZStandort = t.standort.geschossId !== undefined
      ? { geschoss: codeVon.get(t.standort.geschossId) ?? t.standort.geschossId } : { einheit: einheit(t.standort) };
    const ort: ZOrt = !t.ort ? null : "gruppe" in t.ort
      ? { gruppe: t.ort.gruppe.gruppeId ?? gKey[t.ort.gruppe.gruppeIndex!] } : { vorBauteil: bauteil(t.ort.vorBauteil) };
    return {
      schluessel: tKey[j], ...(t.id !== undefined && { id: t.id }), katalogId: t.katalogId, standort,
      menge: t.menge, status: t.status, hersteller: t.hersteller ?? null, typ: t.typ ?? null, baujahr: t.baujahr ?? null,
      positionManuell: t.positionManuell ?? null, versorgt: t.versorgt.map(einheit), ort,
    };
  });
  const zGruppen: ZGruppe[] = gruppen.map((g, i) => ({
    schluessel: gKey[i], ...(g.id !== undefined && { id: g.id }), verteiler: bauteil(g.verteiler), nummer: g.nummer, art: g.art,
    bezeichnung: g.bezeichnung, verbraucher: g.verbraucher.map(bauteil),
  }));
  const ersterErzeuger = bauteile.find((t) => ERZEUGER.includes(t.katalogId) && "einheit" in t.standort)
    ?? bauteile.find((t) => t.katalogId === K.speicher && "einheit" in t.standort);
  const zentraleRaum = ersterErzeuger && "einheit" in ersterErzeuger.standort
    ? ersterErzeuger.standort.einheit : einheiten.find((e) => e.art === "technik")?.schluessel ?? null;
  return {
    version: 1, schritt: 1, huelleBearbeitbar: false,
    gebaeude: { id: b.gebaeudeId ?? null, liegenschaftId: kopf.liegenschaftId ?? null, name: kopf.name ?? "", grundform: kopf.grundform ?? "quader",
      stand: b.stand, geschosse: geschosse.map((g) => ({ id: g.id, code: g.code })) },
    heizungStandard: { ...b.heizungStandard },
    einheiten, bauteile, gruppen: zGruppen, zentraleRaum, zaehler: 0,
  };
}

/** Zuordnung Beschreibungsposition → Schlüssel (für Hinweise der Vorschau mit Platzhalter-IDs `neu-b-<i>`). */
export interface Positionen { einheiten: string[]; bauteile: string[]; gruppen: string[] }

/**
 * Assistent-Zustand → Beschreibung (API). Verweise auf gespeicherte Elemente per ID, sonst per Index.
 * Verweise auf nicht mehr vorhandene Elemente werden weggelassen. Einheiten auf Geschossen ohne ID entfallen.
 */
export function zuBeschreibung(z: AssistentZustand): BeschreibungEingabe {
  return zuBeschreibungMitPositionen(z).beschreibung;
}

export function zuBeschreibungMitPositionen(z: AssistentZustand): { beschreibung: BeschreibungEingabe; positionen: Positionen } {
  const geschossId = new Map(z.gebaeude.geschosse.filter((g) => g.id).map((g) => [g.code, g.id!]));
  const zEinheiten = z.einheiten.filter((e) => geschossId.has(e.geschoss));
  const eIndex = new Map(zEinheiten.map((e, i) => [e.schluessel, i]));
  const zBauteile = z.bauteile.filter((t) => ("einheit" in t.standort ? eIndex.has(t.standort.einheit) : geschossId.has(t.standort.geschoss)));
  const tIndex = new Map(zBauteile.map((t, i) => [t.schluessel, i]));
  const zGruppen = z.gruppen.filter((g) => tIndex.has(g.verteiler));
  const gIndex = new Map(zGruppen.map((g, i) => [g.schluessel, i]));

  const eVerweis = (s: string): EinheitVerweis => {
    const e = zEinheiten[eIndex.get(s)!];
    return e.id !== undefined ? { einheitId: e.id } : { einheitIndex: eIndex.get(s)! };
  };
  const tVerweis = (s: string): BauteilVerweis => {
    const t = zBauteile[tIndex.get(s)!];
    return t.id !== undefined ? { bauteilId: t.id } : { bauteilIndex: tIndex.get(s)! };
  };

  const einheiten: EinheitEingabe[] = zEinheiten.map((e) => ({
    ...(e.id !== undefined && { id: e.id }), geschossId: geschossId.get(e.geschoss)!,
    bezeichnung: e.bezeichnung.trim() || "Ohne Bezeichnung", art: e.art, flaecheM2: e.flaecheM2,
    ...(e.layoutManuell != null && { layoutManuell: e.layoutManuell }),
    ...(Object.keys(e.ausnahme).length > 0 && { heizungAusnahme: { ...e.ausnahme } }),
  }));
  const bauteile: BauteilEingabe[] = zBauteile.map((t) => {
    let ort: BauteilEingabe["ort"] = null;
    if (t.ort && "gruppe" in t.ort && gIndex.has(t.ort.gruppe)) {
      const g = zGruppen[gIndex.get(t.ort.gruppe)!];
      ort = { gruppe: g.id !== undefined ? { gruppeId: g.id } : { gruppeIndex: gIndex.get(t.ort.gruppe)! } };
    } else if (t.ort && "vorBauteil" in t.ort && tIndex.has(t.ort.vorBauteil)) ort = { vorBauteil: tVerweis(t.ort.vorBauteil) };
    return {
      ...(t.id !== undefined && { id: t.id }), katalogId: t.katalogId,
      standort: "einheit" in t.standort ? eVerweis(t.standort.einheit) : { geschossId: geschossId.get(t.standort.geschoss)! },
      menge: t.menge, status: t.status, hersteller: t.hersteller, typ: t.typ, baujahr: t.baujahr, positionManuell: t.positionManuell,
      versorgt: t.versorgt.filter((s) => eIndex.has(s)).map(eVerweis), ort,
    };
  });
  const gruppen: GruppeEingabe[] = zGruppen.map((g) => ({
    ...(g.id !== undefined && { id: g.id }), verteiler: tVerweis(g.verteiler), nummer: g.nummer, art: g.art,
    bezeichnung: g.bezeichnung.trim() || `Gruppe ${g.nummer}`,
    verbraucher: g.verbraucher.filter((s) => tIndex.has(s)).map(tVerweis),
  }));
  return {
    beschreibung: {
      gebaeudeId: z.gebaeude.id ?? "", stand: z.gebaeude.stand,
      geschosse: z.gebaeude.geschosse.filter((g) => g.id).map((g) => ({ id: g.id!, code: g.code })),
      heizungStandard: { ...z.heizungStandard }, einheiten, bauteile, gruppen,
    },
    positionen: { einheiten: zEinheiten.map((e) => e.schluessel), bauteile: zBauteile.map((t) => t.schluessel), gruppen: zGruppen.map((g) => g.schluessel) },
  };
}
