import type { KatalogEintrag, Welt } from "../typen";
import { teilName } from "./bestueckung";
import type { Positionen } from "./beschreibung";
import {
  einheitVon, erzeuger, gruppeVonVerbraucher, hauptverteiler, istAbgabe, unterverteiler, zentraleRaumHinweis,
  type AssistentZustand, type SchrittNr, type ZBauteil,
} from "./zustand";

export interface PruefHinweis { code: string; text: string; schritt: SchrittNr; schluessel?: string }

/** Kurzname eines Bauteils mit Ort, z. B. «Heizkörper, Büro 1». */
export function bauteilText(z: AssistentZustand, t: ZBauteil, katalog?: readonly KatalogEintrag[] | null): string {
  const e = einheitVon(z, t);
  const name = teilName(t.katalogId, katalog) + (t.hersteller ? ` ${t.hersteller}` : "");
  return e ? `${name}, ${e.bezeichnung}` : name;
}

/** Einheiten, die ein Unterverteiler versorgt (deren Abgaben hängen am Unterverteiler, nicht direkt an einer Gruppe). */
export function ueberUnterverteiler(z: AssistentZustand): Set<string> {
  return new Set(unterverteiler(z).flatMap((t) => t.versorgt));
}

/**
 * Hinweise für "Prüfen" (nicht blockierend): eigene Prüfungen am Zustand plus Hinweise der Vorschau-Welt,
 * deren Bezug über die Platzhalter-IDs (`neu-<art>-<i>`) bzw. gespeicherte IDs auf Schlüssel abgebildet wird.
 */
export function pruefHinweise(z: AssistentZustand, welt: Welt | null, positionen: Positionen, katalog?: readonly KatalogEintrag[] | null): PruefHinweis[] {
  const h: PruefHinweis[] = [];
  if (z.einheiten.length === 0) h.push({ code: "keine_einheiten", text: "Noch keine Einheiten erfasst.", schritt: 2 });
  if (erzeuger(z).length === 0) h.push({ code: "kein_erzeuger", text: "Noch kein Erzeuger gewählt.", schritt: 4 });
  const raum = zentraleRaumHinweis(z);
  if (raum) h.push({ code: "zentrale_raum", text: raum, schritt: 4 });
  const uv = ueberUnterverteiler(z);
  for (const t of z.bauteile) {
    if (!istAbgabe(t) || gruppeVonVerbraucher(z, t.schluessel)) continue;
    if ("einheit" in t.standort && uv.has(t.standort.einheit)) continue;
    h.push({ code: "ohne_gruppe", text: `${bauteilText(z, t, katalog)} gehört zu keiner Gruppe.`, schritt: 5, schluessel: t.schluessel });
  }
  for (const t of unterverteiler(z)) if (!gruppeVonVerbraucher(z, t.schluessel))
    h.push({ code: "ohne_gruppe", text: `Unterverteiler ${einheitVon(z, t)?.bezeichnung ?? ""} wird von keiner Gruppe gespeist.`.replace("  ", " "), schritt: 6, schluessel: t.schluessel });
  const haupt = hauptverteiler(z);
  for (const g of z.gruppen) if (g.verbraucher.length === 0)
    h.push({ code: "gruppe_leer", text: `Gruppe «${g.bezeichnung || g.nummer}» hat keine Verbraucher.`, schritt: g.verteiler === haupt?.schluessel ? 5 : 6, schluessel: g.schluessel });

  // Hinweise der Vorschau-Welt, die nicht schon oben stehen
  const eigene = new Set(h.map((x) => x.code));
  const schluesselVon = (bezug: string): string | undefined => {
    const m = /^neu-([ebg])-(\d+)$/.exec(bezug);
    if (m) return (m[1] === "e" ? positionen.einheiten : m[1] === "b" ? positionen.bauteile : positionen.gruppen)[Number(m[2])];
    return bezug;
  };
  for (const w of welt?.hinweise ?? []) {
    if (eigene.has(w.code)) continue;
    const s = schluesselVon(w.bezug);
    const symbol = welt?.symbole.find((x) => x.schluessel === w.bezug);
    const e = z.einheiten.find((x) => x.schluessel === s);
    const t = z.bauteile.find((x) => x.schluessel === (symbol ? schluesselVon(symbol.bauteilIds[0]) : s));
    const wo = e ? `«${e.bezeichnung}»` : t ? `«${bauteilText(z, t, katalog)}»` : "";
    const text = w.code === "ueberlappung" ? `${wo || "Eine Einheit"} überlappt mit einer manuell platzierten Einheit.`
      : w.code === "position_widerspruch" ? `${wo || "Ein Bauteil"} hat widersprüchliche manuelle Positionen.`
      : w.code === "ohne_gruppe" ? `${wo || "Eine Abgabe"} gehört zu keiner Gruppe.`
      : w.code === "gruppe_leer" ? "Eine Gruppe hat keine Verbraucher."
      : `Hinweis ${w.code}${wo ? ` zu ${wo}` : ""}.`;
    h.push({ code: w.code, text, schritt: e ? 2 : 5, ...(s && { schluessel: s }) });
  }
  return h;
}
