import type { AmpelFilter, FilterStufe } from "../szene3/ampelFilter";
import type { LdErgebnis, LdErgebnisBauteil } from "../lebensdauer/typen";
import { AMPEL_TEXT } from "../lebensdauer/ansicht";

export const POSTEN_TEXT: Record<FilterStufe, string> = { ...AMPEL_TEXT, ohnePreis: "Ohne Preis" };

/**
 * Legende als Filter (Entscheid 22.11.2026, Ansatz C Stufe 3). PO: mehrere Posten kombinierbar, ODER-verknüpft.
 * Bauteil-Ebene auf Symbole (Anlagen) abbilden: eine Anlage ist Treffer, wenn mindestens eines ihrer Bauteile passt.
 * Reine, deterministische Ableitungen.
 */

/** Reihenfolge der Posten in Legende und Trefferliste: Dringendstes zuerst, «ohne Preis» zuletzt. */
export const POSTEN_FOLGE: FilterStufe[] = ["rot", "gelb", "gruen", "grau", "ohnePreis"];
/** «Angaben fehlen»: diese Posten tragen am Bauteil den neutralen Anhänger. */
const ANHAENGER: ReadonlySet<FilterStufe> = new Set(["grau", "ohnePreis"]);
const JAHRE_SUMME = 5;

/**
 * «Ohne Preis» genau wie der Legendenhinweis (Backend rechnung.ts, summe5.ohnePreis): Ersatz fällig in den nächsten
 * fünf Jahren (überfällige zählen im Stichjahr) und keine Kosten bekannt.
 */
export function ohnePreis(b: Pick<LdErgebnisBauteil, "kosten" | "ersatzjahr">, stichtag: number): boolean {
  return b.kosten === null && b.ersatzjahr !== null && Math.max(b.ersatzjahr, stichtag) < stichtag + JAHRE_SUMME;
}

/** Posten, zu denen ein Bauteil gehört (Ampelstufe und ggf. «ohne Preis»). */
export function postenVon(b: LdErgebnisBauteil, stichtag: number): FilterStufe[] {
  return ohnePreis(b, stichtag) ? [b.ampel, "ohnePreis"] : [b.ampel];
}

export interface FilterAnlage { schluessel: string; bauteilIds: readonly string[]; geschossId: string | null }

export interface Treffer<A extends FilterAnlage = FilterAnlage> {
  anlage: A;
  /** Gewählte Posten, die auf mindestens ein Bauteil der Anlage zutreffen (Reihenfolge POSTEN_FOLGE). */
  gruende: FilterStufe[];
  /** Anzahl passender Bauteile der Anlage. */
  bauteile: number;
}

export interface FilterErgebnis<A extends FilterAnlage = FilterAnlage> {
  filter: AmpelFilter;
  /** Treffer, dringendster Grund zuerst, sonst Reihenfolge der Anlagen. */
  treffer: Treffer<A>[];
  /** Anzahl Treffer (Anlagen) je Geschoss. */
  jeGeschoss: Map<string, number>;
  /** Geschoss mit den meisten Treffern (bei Gleichstand das zuerst in den Anlagen vorkommende); null ohne Treffer. */
  bestes: string | null;
}

/** Filter aus Lebensdauer-Ergebnis, Anlagen (Symbole) und gewählten Posten; null, wenn nichts gewählt ist. */
export function erneuerungFilter<A extends FilterAnlage>(ergebnis: Pick<LdErgebnis, "bauteile" | "stichtag">, anlagen: A[],
  posten: ReadonlySet<FilterStufe>): FilterErgebnis<A> | null {
  if (!posten.size) return null;
  const je = new Map(ergebnis.bauteile.map((b) => [b.id, postenVon(b, ergebnis.stichtag)]));
  const treffer: (Treffer<A> & { index: number })[] = [];
  anlagen.forEach((anlage, index) => {
    const gruende = new Set<FilterStufe>();
    let bauteile = 0;
    for (const id of anlage.bauteilIds) {
      const passend = (je.get(id) ?? []).filter((p) => posten.has(p));
      if (passend.length) bauteile++;
      passend.forEach((p) => gruende.add(p));
    }
    if (gruende.size) treffer.push({ anlage, gruende: POSTEN_FOLGE.filter((p) => gruende.has(p)), bauteile, index });
  });
  const rang = (t: Treffer<A>) => POSTEN_FOLGE.indexOf(t.gruende[0]);
  treffer.sort((a, b) => rang(a) - rang(b) || a.index - b.index);

  const jeGeschoss = new Map<string, number>();
  let bestes: string | null = null;
  for (const t of [...treffer].sort((a, b) => a.index - b.index)) {
    const g = t.anlage.geschossId;
    if (!g) continue;
    jeGeschoss.set(g, (jeGeschoss.get(g) ?? 0) + 1);
    if (bestes === null || jeGeschoss.get(g)! > jeGeschoss.get(bestes)!) bestes = g;
  }
  return {
    filter: {
      treffer: new Set(treffer.map((t) => t.anlage.schluessel)),
      anhaenger: new Set(treffer.filter((t) => t.gruende.some((p) => ANHAENGER.has(p))).map((t) => t.anlage.schluessel)),
      stufen: new Set(posten),
    },
    treffer: treffer.map(({ index: _index, ...t }) => t),
    jeGeschoss, bestes,
  };
}

/** Posten umschalten (Mehrfachauswahl). */
export function umschalten(posten: ReadonlySet<FilterStufe>, p: FilterStufe): Set<FilterStufe> {
  const neu = new Set(posten);
  if (neu.has(p)) neu.delete(p); else neu.add(p);
  return neu;
}
