import type { GruppenArt, KatalogEintrag } from "../typen";

/** Katalog-IDs, die der Assistent fest kennt (Spiegel von app/src/welt/katalog.v2.ts; IDs werden nie umbenannt). */
export const K = {
  waermepumpe: "heizung.waermepumpe",
  gaskessel: "heizung.gaskessel",
  oelkessel: "heizung.oelkessel",
  fernwaerme: "heizung.fernwaerme_uebergabe",
  speicher: "heizung.speicher",
  pumpe: "heizung.umwaelzpumpe",
  verteiler: "heizung.verteiler",
  hk: "heizung.heizkoerper",
  fbh: "heizung.fbh_kreis",
  tabs: "heizung.tabs_feld",
  ventil3: "heizung.ventil_3weg",
  ventil2: "heizung.ventil_2weg",
  wmz: "heizung.wmz",
} as const;

export const ERZEUGER: readonly string[] = [K.waermepumpe, K.gaskessel, K.oelkessel, K.fernwaerme];
/** Teiltypen der Gruppen-Bestückung (WMZ ist ein eigener Schalter). */
export const BESTUECKUNG_TEILE: readonly string[] = [K.pumpe, K.ventil3, K.ventil2];
export const ZUBEHOER: readonly string[] = [K.pumpe, K.ventil3, K.ventil2, K.wmz];

export interface BestueckungsTeil { katalogId: string; menge: number }

/**
 * Standardbestückung je Gruppenart (Spec Stufe 1 §4.3, PO-bestätigt). Spiegel von
 * `REGELWERK_V2.bestueckung` in app/src/welt/regelwerk.v2.ts; Gleichheit prüft bestueckung.test.ts.
 */
export const BESTUECKUNG: Readonly<Record<GruppenArt, readonly BestueckungsTeil[]>> = {
  ungeregelt: [{ katalogId: K.pumpe, menge: 1 }],
  beimisch: [{ katalogId: K.pumpe, menge: 1 }, { katalogId: K.ventil3, menge: 1 }],
  drossel: [{ katalogId: K.ventil2, menge: 1 }],
  einspritz: [{ katalogId: K.pumpe, menge: 1 }, { katalogId: K.ventil2, menge: 1 }],
  umlenk: [{ katalogId: K.ventil3, menge: 1 }],
};

/** Vorschlag für eine Gruppenart; nur Teile, die der geladene Katalog kennt (ohne Katalog: alle). */
export function bestueckungVorschlag(art: GruppenArt, katalog?: readonly KatalogEintrag[] | null): BestueckungsTeil[] {
  const bekannt = katalog ? new Set(katalog.map((k) => k.id)) : null;
  return BESTUECKUNG[art].filter((t) => !bekannt || bekannt.has(t.katalogId)).map((t) => ({ ...t }));
}

export const GRUPPEN_ARTEN: readonly GruppenArt[] = ["ungeregelt", "beimisch", "drossel", "einspritz", "umlenk"];

/** Kurzbeschreibungen für die Artkarten (Schritt 5). */
export const GRUPPEN_ART_TEXT: Readonly<Record<GruppenArt, { name: string; text: string }>> = {
  ungeregelt: { name: "Ungeregelt", text: "Pumpe fördert direkt mit Kesseltemperatur, z. B. Heizkörper." },
  beimisch: { name: "Beimischung", text: "Pumpe und 3-Weg-Ventil mischen Rücklauf bei, z. B. Fussbodenheizung." },
  drossel: { name: "Drosselschaltung", text: "Durchgangsventil drosselt die Menge, keine eigene Pumpe." },
  einspritz: { name: "Einspritzschaltung", text: "Pumpe und Durchgangsventil, für grosse Netze und TABS." },
  umlenk: { name: "Umlenkschaltung", text: "3-Weg-Ventil lenkt um, keine eigene Pumpe." },
};

/** Anzeigenamen mit echten Umlauten (Katalognamen im Backend sind ohne Umlaute). */
const NAMEN: Record<string, string> = {
  [K.waermepumpe]: "Wärmepumpe", [K.gaskessel]: "Gaskessel", [K.oelkessel]: "Ölkessel",
  [K.fernwaerme]: "Fernwärme-Übergabe", [K.speicher]: "Speicher", [K.pumpe]: "Umwälzpumpe",
  [K.verteiler]: "Heizungsverteiler", [K.hk]: "Heizkörper", [K.fbh]: "FBH-Kreis", [K.tabs]: "TABS-Feld",
  [K.ventil3]: "3-Weg-Ventil", [K.ventil2]: "Durchgangsventil", [K.wmz]: "Wärmezähler",
};
export function teilName(katalogId: string, katalog?: readonly KatalogEintrag[] | null): string {
  return NAMEN[katalogId] ?? katalog?.find((k) => k.id === katalogId)?.name ?? katalogId;
}
