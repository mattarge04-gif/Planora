import { groesseText } from "../dokumente/ansicht";
// Reine Anzeigefunktionen der Seite Dokumente (ohne React), ergaenzt preisdokument/ansicht.ts um Bauteil-Kandidaten und Filter.
import { chf } from "../lebensdauer/ansicht";
import type { LdStand } from "../lebensdauer/typen";
import type { DokumentZeile, Uebersicht, VorschlagZeile } from "../preisdokument/typen";

export interface Kandidat {
  id: string;
  name: string;
  ort: string;
  /** Hersteller / Typ, falls erfasst. */
  detail: string | null;
  /** Bisheriger Preis: "Preis fehlt", "CHF 650, von Hand", "CHF 800, Typwert", "CHF 1'296, aus Dokument". */
  bisher: string;
  /** Eigener, von Hand erfasster Preis (Uebernehmen fragt nach). */
  hand: boolean;
}

/** Bauteile des Gebaeudes mit dem Typ des Vorschlags, sortiert nach Ort. */
export function kandidaten(stand: LdStand | null, katalogId: string | null, name: (katalogId: string) => string): Kandidat[] {
  if (!stand || !katalogId) return [];
  const erg = new Map(stand.ergebnis.bauteile.map((e) => [e.id, e]));
  return stand.bauteile.filter((b) => b.katalogId === katalogId).map((b) => {
    const e = erg.get(b.id);
    const hand = b.akte?.quellePreis === "kunde" && b.akte.stueckpreis !== null;
    let bisher = "Preis fehlt";
    if (e && e.stueckpreis !== null) {
      const herkunft = e.quellen.preisHerkunft === "dokument" ? "aus Dokument" : e.quellen.preis === "typ" ? "Typwert" : "von Hand";
      bisher = `${chf(e.stueckpreis)}, ${herkunft}`;
    }
    const detail = [b.hersteller, b.typ].filter(Boolean).join(" ") || null;
    return { id: b.id, name: name(b.katalogId), ort: b.ort, detail, bisher, hand };
  }).sort((a, b) => a.ort.localeCompare(b.ort, "de-CH", { numeric: true })).map((k, _, alle) => {
    // Gleicher Ort mehrfach (z. B. zwei Pumpen in der Zentrale): nummerieren, sonst sind die Zeilen nicht unterscheidbar.
    const gleich = alle.filter((x) => x.ort === k.ort);
    return gleich.length > 1 ? { ...k, ort: `${k.ort}, Nr. ${gleich.indexOf(k) + 1}` } : k;
  });
}

const RANG = { offen: 0, uebernommen: 1, verworfen: 2 } as const;
/** Offene zuerst, Entschiedenes danach (Reihenfolge des Dokuments bleibt innerhalb). */
export const sortiert = (v: VorschlagZeile[]) => v.map((x, i) => ({ x, i })).sort((a, b) => RANG[a.x.status] - RANG[b.x.status] || a.i - b.i).map((a) => a.x);

/**
 * Vorschlaege fuer ein Bauteil (Einstieg "aus Dokument …" in der Anlagenkarte): zugeordnete und offene Vorschlaege
 * desselben Typs, die das Bauteil noch nicht enthalten (der FM kann es dazu waehlen).
 */
export function fuerBauteil(u: Uebersicht, bauteilId: string, katalogId: string | null): { dokument: DokumentZeile; vorschlaege: VorschlagZeile[] }[] {
  return u.dokumente.map((dokument) => ({ dokument, vorschlaege: sortiert(dokument.vorschlaege.filter((v) =>
    v.bauteilIds.includes(bauteilId) || (v.status === "offen" && katalogId !== null && v.katalogId === katalogId))) }))
    .filter((g) => g.vorschlaege.length > 0);
}

/** Startauswahl einer Vorschlagskarte: Vorschlag der KI, im Bauteilfilter zusaetzlich das gesuchte Bauteil (gleicher Typ). */
export function startAuswahl(v: VorschlagZeile, filter: { bauteilId: string; katalogId: string | null } | null): string[] {
  const ids = v.bauteilIds.filter((id) => !v.fehlendeBauteile.includes(id));
  if (filter && v.status === "offen" && v.katalogId !== null && v.katalogId === filter.katalogId && !ids.includes(filter.bauteilId)) ids.push(filter.bauteilId);
  return ids;
}

/** Rueckmeldung nach "Alle sicheren übernehmen": vorher/nachher offene sichere Vorschlaege. */
export function alleSicherenText(vorher: number, nachher: number): string {
  const ueber = Math.max(0, vorher - nachher);
  const teil = ueber === 1 ? "1 Preis übernommen" : `${ueber} Preise übernommen`;
  if (nachher === 0) return `${teil}.`;
  return `${teil}, ${nachher} übersprungen (von Hand erfasster Preis). Einzeln prüfen und übernehmen.`;
}

/**
 * Reihenfolge paralleler Anfragen: jede Anfrage zieht eine Nummer; nur die zuletzt begonnene darf ihr Ergebnis setzen.
 * Verhindert, dass eine aeltere Poll-Antwort die Antwort einer Aktion (mit neuerem stand) ueberschreibt.
 */
export function antwortFolge() {
  let zuletzt = 0;
  return { neu: () => ++zuletzt, aktuell: (nr: number) => nr === zuletzt };
}

/** "22.11.2026" in Schweizer Zeit. */
export function datum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Zurich" }).format(d);
}

/** "1 Seite" / "12 Seiten", Groesse in kB/MB. */
export function umfang(d: Pick<DokumentZeile, "seiten" | "groesse">): string {
  const s = d.seiten === 1 ? "1 Seite" : `${d.seiten} Seiten`;
  return `${s}, ${groesseText(d.groesse)}`;
}

