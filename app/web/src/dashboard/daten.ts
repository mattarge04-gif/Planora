import { mengeText, panelDaten, uebersicht, type PanelDaten } from "../panel/daten";
import type { BauteilStatus, Beschreibung, Hinweis, KatalogEintrag, Welt, WeltSymbol } from "../typen";

const NAMEN: Record<string, string> = {
  "heizung.waermepumpe": "Wärmepumpe", "heizung.gaskessel": "Gaskessel", "heizung.oelkessel": "Ölkessel",
  "heizung.fernwaerme_uebergabe": "Fernwärme-Übergabe", "heizung.speicher": "Speicher",
  "heizung.umwaelzpumpe": "Umwälzpumpe", "heizung.verteiler": "Heizungsverteiler", "heizung.heizkoerper": "Heizkörper",
  "heizung.fbh_kreis": "FBH-Kreis", "heizung.tabs_feld": "TABS-Feld",
};
export type IconSchluessel = "waermepumpe" | "kessel" | "fernwaerme" | "speicher" | "pumpe" | "verteiler" | "heizkoerper" | "flaechenheizung" | "anlage";
const ICONS: Record<string, IconSchluessel> = {
  "heizung.waermepumpe": "waermepumpe", "heizung.gaskessel": "kessel", "heizung.oelkessel": "kessel",
  "heizung.fernwaerme_uebergabe": "fernwaerme", "heizung.speicher": "speicher", "heizung.umwaelzpumpe": "pumpe",
  "heizung.verteiler": "verteiler", "heizung.heizkoerper": "heizkoerper", "heizung.fbh_kreis": "flaechenheizung", "heizung.tabs_feld": "flaechenheizung",
};
const ERZEUGER = new Set(["heizung.waermepumpe", "heizung.gaskessel", "heizung.oelkessel", "heizung.fernwaerme_uebergabe"]);

export function anzeigeName(katalogId: string, katalog: KatalogEintrag[] = []): string {
  return Object.hasOwn(NAMEN, katalogId) ? NAMEN[katalogId] : katalog.find((k) => k.id === katalogId)?.name ?? katalogId;
}

export interface Kennzahlen {
  geschosse: number; einheiten: number; symbole: number; bauteile: number;
  bestaetigteBauteile: number; anteilBestaetigtProzent: number | null;
}
/** [A] Bestätigungsquote = bestätigte erfasste Bauteilzeilen / alle Bauteilzeilen, unabhängig von Gruppierung und Stückmenge.
 * Kein Bauteil bedeutet keine Quote (null); Rundung ist Aufgabe der Anzeige.
 */
export function kennzahlen(welt: Welt, beschreibung: Beschreibung): Kennzahlen {
  const u = uebersicht(welt, beschreibung);
  const bauteile = beschreibung.bauteile.length;
  const bestaetigteBauteile = beschreibung.bauteile.filter((b) => b.status === "bestaetigt").length;
  return { geschosse: u.geschosse, einheiten: u.einheiten, symbole: u.symbole, bauteile, bestaetigteBauteile,
    anteilBestaetigtProzent: bauteile ? bestaetigteBauteile / bauteile * 100 : null };
}

export interface GeschossZeile { id: string; code: string; yUnten: number; einheiten: number }
export function geschossListe(welt: Welt): GeschossZeile[] {
  return [...welt.geschosse].sort((a, b) => b.yUnten - a.yUnten || vergleichen(a.id, b.id)).map((g) => ({
    id: g.id, code: g.code, yUnten: g.yUnten, einheiten: welt.einheiten.filter((e) => e.geschossId === g.id).length,
  }));
}
const vergleichen = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function geschossBeiPosition(welt: Welt, y: number): string | null {
  const g = [...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten || vergleichen(a.id, b.id));
  return (g.filter((g) => g.yUnten <= y + 1e-6).at(-1) ?? g[0])?.id ?? null;
}

export interface Zielort { geschossId: string | null; position: WeltSymbol["position"] | null; schluessel: string | null }
function standortVon(welt: Welt, beschreibung: Beschreibung, s: WeltSymbol): { geschossId: string | null; einheitId: string | null } {
  const b = beschreibung.bauteile.find((b) => b.id !== undefined && s.bauteilIds.includes(b.id));
  const einheitId = b?.standort.einheitId ?? null;
  // [A] Fehlt die Standortzeile, ist nur das Geschoss aus der Symbolhöhe ableitbar; keine Einheit raten.
  return { einheitId, geschossId: welt.einheiten.find((e) => e.id === einheitId)?.geschossId ?? b?.standort.geschossId ?? geschossBeiPosition(welt, s.position.y) };
}

export interface AnlagenZeile extends Zielort {
  katalogId: string; name: string; hersteller: string | null; typ: string | null; herstellerTyp: string | null;
  schluessel: string; bauteilIds: string[]; einheitId: string | null; standort: string; menge: string; status: BauteilStatus;
}
function anlagenZeile(welt: Welt, beschreibung: Beschreibung, katalog: KatalogEintrag[], s: WeltSymbol, panel: PanelDaten): AnlagenZeile {
  const ort = standortVon(welt, beschreibung, s);
  return { schluessel: s.schluessel, bauteilIds: [...s.bauteilIds], katalogId: s.katalogId, name: anzeigeName(s.katalogId, katalog),
    hersteller: s.hersteller, typ: s.typ, herstellerTyp: panel.herstellerTyp, ...ort, position: { ...s.position },
    standort: panel.standort, menge: mengeText(s.mengeSumme, s.mengeUnbekannt), status: s.status };
}
/** Eine Tabellenzeile je WeltSymbol; dessen echter Schlüssel ist der Auswahlweg. */
export function anlagenZeilen(welt: Welt, beschreibung: Beschreibung, katalog: KatalogEintrag[]): AnlagenZeile[] {
  return welt.symbole.map((s) => anlagenZeile(welt, beschreibung, katalog, s, panelDaten(welt, beschreibung, katalog, s.schluessel)!));
}

export interface ObjektKarte extends AnlagenZeile {
  id: string; icon: IconSchluessel; zeilen: PanelDaten["zeilen"]; versorgt: string[]; dokumente: [];
}
export function objektKarte(welt: Welt, beschreibung: Beschreibung, katalog: KatalogEintrag[], schluessel: string): ObjektKarte | null {
  const s = welt.symbole.find((s) => s.schluessel === schluessel);
  const panel = panelDaten(welt, beschreibung, katalog, schluessel);
  if (!s || !panel) return null;
  return { ...anlagenZeile(welt, beschreibung, katalog, s, panel), id: s.schluessel,
    icon: Object.hasOwn(ICONS, s.katalogId) ? ICONS[s.katalogId] : "anlage", zeilen: panel.zeilen, versorgt: panel.versorgt, dokumente: [] };
}

export interface HinweisZeile { id: string; code: string; bezug: string; text: string; status: "offen" | "erledigt" | null; ziel: Zielort | null }
function hinweisZiel(welt: Welt, beschreibung: Beschreibung, bezug: string): Zielort | null {
  const s = welt.symbole.find((s) => s.schluessel === bezug || s.bauteilIds.includes(bezug));
  if (s) return { geschossId: standortVon(welt, beschreibung, s).geschossId, position: { ...s.position }, schluessel: s.schluessel };
  const b = beschreibung.bauteile.find((b) => b.id === bezug);
  const e = welt.einheiten.find((e) => e.id === (b?.standort.einheitId ?? bezug));
  const g = welt.geschosse.find((g) => g.id === (e?.geschossId ?? b?.standort.geschossId ?? bezug));
  // [A] Ein Hinweis zur gesamten Einheit zielt auf deren geometrische Mitte, nicht auf einen erfundenen Anlagenort.
  if (e) return { geschossId: e.geschossId, position: g ? { x: e.rechteck.x + e.rechteck.breite / 2, y: g.yUnten, z: e.rechteck.z + e.rechteck.tiefe / 2 } : null, schluessel: null };
  if (g) {
    // [A] Ohne konkretes Objekt zielt ein Geschosshinweis auf die Mitte des bekannten Grundrissbereichs.
    const r = welt.grundriss;
    const position = r.length ? { x: (Math.min(...r.map((r) => r.x)) + Math.max(...r.map((r) => r.x + r.breite))) / 2,
      y: g.yUnten, z: (Math.min(...r.map((r) => r.z)) + Math.max(...r.map((r) => r.z + r.tiefe))) / 2 } : null;
    return { geschossId: g.id, position, schluessel: null };
  }
  return null;
}
function hinweisStatus(h: Hinweis): HinweisZeile["status"] {
  // Die aktuelle API enthält keinen Erledigungsstatus; dessen Fehlen ist kein erfundener Status «offen».
  return "status" in h && (h.status === "offen" || h.status === "erledigt") ? h.status : null;
}
/** [A] Identische Hinweise aus Welt und Beschreibung erscheinen einmal; unterschiedliche Statuswerte bleiben erhalten. */
export function hinweisListe(welt: Welt, beschreibung: Beschreibung): HinweisZeile[] {
  const hinweise = [...(beschreibung.hinweise ?? []), ...welt.hinweise];
  const texte = uebersicht(welt, beschreibung).hinweise;
  const gesehen = new Set<string>();
  return hinweise.flatMap((h, i) => {
    const status = hinweisStatus(h), id = JSON.stringify([h.code, h.bezug, status]);
    if (gesehen.has(id)) return [];
    gesehen.add(id);
    const name = welt.einheiten.find((e) => e.id === h.bezug)?.bezeichnung ?? h.bezug;
    const text = h.code === "ueberlappung" ? `${name}: Layout überlappt`
      : h.code === "position_widerspruch" ? "Widersprüchliche manuelle Positionen in einer Bauteilgruppe" : texte[i];
    return [{ id, code: h.code, bezug: h.bezug, text, status, ziel: hinweisZiel(welt, beschreibung, h.bezug) }];
  });
}

/** [A] Bei mehreren Erzeugern beginnt Technik am tiefsten Erzeugergeschoss, bei Gleichstand nach Schlüssel. */
export function zentraleGeschoss(welt: Welt): string | null {
  const s = [...welt.symbole].filter((s) => ERZEUGER.has(s.katalogId)).sort((a, b) => a.position.y - b.position.y || vergleichen(a.schluessel, b.schluessel))[0];
  return s ? geschossBeiPosition(welt, s.position.y) : [...welt.geschosse].sort((a, b) => a.yUnten - b.yUnten || vergleichen(a.id, b.id))[0]?.id ?? null;
}
