import { anzeigeName } from "../dashboard";
import { geschossBeiY } from "../szene2/leitungen";
import { gruppenVerbindungen, type GruppenStrang } from "../szene3/gruppenNetz";
import { einheitVon } from "../szene3/netz";
import type { GruppenArt, KatalogEintrag, Welt } from "../typen";

export const GRUPPEN_ART: Record<GruppenArt, string> = {
  ungeregelt: "Ungeregelt", beimisch: "Beimischschaltung", drossel: "Drosselschaltung",
  einspritz: "Einspritzschaltung", umlenk: "Umlenkschaltung",
};
/** Namen mit Umlauten für Zubehör aus Katalog v2 (Katalognamen sind ohne Umlaute gespeichert). */
const ZUBEHOER: Record<string, string> = {
  "heizung.ventil_3weg": "3-Weg-Ventil", "heizung.ventil_2weg": "Durchgangsventil", "heizung.wmz": "Wärmezähler",
};
export const teilName = (katalogId: string, katalog: KatalogEintrag[]) =>
  Object.hasOwn(ZUBEHOER, katalogId) ? ZUBEHOER[katalogId] : anzeigeName(katalogId, katalog);

export interface GruppenKarte {
  id: string; titel: string; art: string; verteiler: string;
  bestueckung: { name: string; menge: number }[];
  verbraucher: { schluessel: string; name: string; ort: string }[];
  /** Hervorgehobene Anlagen in der Szene: Zubehör und Verbraucher. */
  betont: string[];
}

/** Gruppen der Welt (v2: aus `welt.gruppen`, v1: Ersatzgruppen je bisheriger Verteilerverbindung). */
export const gruppenVon = (welt: Welt, katalog: KatalogEintrag[]): GruppenStrang[] => gruppenVerbindungen(welt, katalog);

export function gruppenKarte(welt: Welt, katalog: KatalogEintrag[], gruppeId: string, straenge = gruppenVon(welt, katalog)): GruppenKarte | null {
  const st = straenge.find((s) => s.gruppeId === gruppeId);
  if (!st) return null;
  const symbol = new Map(welt.symbole.map((s) => [s.schluessel, s]));
  const code = (id: string | null | undefined) => welt.geschosse.find((g) => g.id === id)?.code;
  const v = symbol.get(st.verteiler);
  const bestueckung = new Map<string, number>();
  for (const k of st.zubehoer) {
    const s = symbol.get(k);
    if (s) bestueckung.set(s.katalogId, (bestueckung.get(s.katalogId) ?? 0) + Math.max(1, s.mengeSumme));
  }
  const verbraucher = st.verbraucher.flatMap((k) => {
    const s = symbol.get(k);
    if (s) {
      const e = einheitVon(welt, s), g = code(e?.geschossId ?? geschossBeiY(welt, s.position.y));
      return [{ schluessel: k, name: s.mengeSumme > 1 ? `${s.mengeSumme} × ${teilName(s.katalogId, katalog)}` : teilName(s.katalogId, katalog),
        ort: [g, e?.bezeichnung].filter(Boolean).join(" · ") }];
    }
    const e = welt.einheiten.find((e) => e.id === k);
    return e ? [{ schluessel: k, name: e.bezeichnung, ort: code(e.geschossId) ?? "" }] : [];
  });
  return {
    id: st.gruppeId,
    titel: st.ersatz ? "Ungeregelte Leitung" : st.bezeichnung.trim() || `Gruppe ${st.nummer}`,
    art: GRUPPEN_ART[st.art],
    verteiler: `${v ? teilName(v.katalogId, katalog) : "Verteiler"}, Abgang ${st.abgangIndex + 1}`,
    bestueckung: [...bestueckung].map(([id, menge]) => ({ name: teilName(id, katalog), menge }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    verbraucher,
    betont: [...st.zubehoer, ...st.verbraucher],
  };
}
