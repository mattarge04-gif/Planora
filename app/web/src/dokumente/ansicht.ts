import type { AblageBauteil, AblageZeile, Kategorie } from "./typen";
export const MAX_BYTES = 100 * 1024 * 1024;
export const KATEGORIEN: { id: Kategorie; name: string }[] = [
  { id: "datenblatt", name: "Datenblatt" }, { id: "plan", name: "Plan" }, { id: "offerte", name: "Offerte" },
  { id: "foto", name: "Foto" }, { id: "protokoll", name: "Protokoll" }, { id: "sonstiges", name: "Sonstiges" },
];
export const kategorieName = (k: Kategorie) => KATEGORIEN.find((x) => x.id === k)?.name ?? k;
/** Kundentext zum Scan-Zustand; der Signaturname des Befunds nur als Detail (Tooltip), nie als Haupttext. */
export function scanAnzeige(d: Pick<AblageZeile, "scanStatus" | "scanGrund">): { text: string; art: "laeuft" | "ok" | "fehler" | "abgelehnt"; detail?: string } {
  if (d.scanStatus === "quarantaene") return { text: "wird geprüft …", art: "laeuft" };
  if (d.scanStatus === "sauber") return { text: "geprüft", art: "ok" };
  if (d.scanStatus === "abgelehnt") return d.scanGrund ? { text: "Datei abgelehnt (Virenprüfung)", art: "abgelehnt", detail: `Befund: ${d.scanGrund}` } : { text: "Datei abgelehnt (Virenprüfung)", art: "abgelehnt" };
  return { text: "Prüfung fehlgeschlagen", art: "fehler" };
}
const zahl = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });
export function groesseText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${zahl.format(Math.round(bytes / 1024))} KB`;
  return `${zahl.format(bytes / (1024 * 1024))} MB`;
}
export const filtere = (d: AblageZeile[], f: { kategorie: Kategorie | null; nurUnverknuepft: boolean }) =>
  d.filter((x) => (!f.kategorie || x.kategorie === f.kategorie) && (!f.nurUnverknuepft || x.bauteilIds.length === 0));
export const pruefungLaeuft = (d: AblageZeile[]) => d.some((x) => x.scanStatus === "quarantaene");
export function oeffnenArt(d: Pick<AblageZeile, "scanStatus" | "art" | "mime">): "pdf" | "bild" | "herunterladen" | "gesperrt" {
  if (d.scanStatus !== "sauber") return "gesperrt";
  if (d.art === "pdf") return "pdf";
  if (d.art === "bild" && d.mime !== "image/heic") return "bild";
  return "herunterladen";
}
export function bauteilKandidaten(b: AblageBauteil[], f: { katalogId: string | null; geschoss: string | null; suche: string }, name: (katalogId: string) => string) {
  const s = f.suche.trim().toLocaleLowerCase("de-CH");
  return b.filter((x) => (!f.katalogId || x.katalogId === f.katalogId) && (!f.geschoss || x.geschoss === f.geschoss)
    && (!s || [name(x.katalogId), x.ort, x.hersteller ?? "", x.typ ?? ""].join(" ").toLocaleLowerCase("de-CH").includes(s)));
}
/** Datenblatt: weitere, noch nicht verknuepfte Bauteile desselben Katalogtyps wie die bereits verknuepften. */
export function datenblattVorschlag(d: AblageZeile, b: AblageBauteil[]): string[] {
  if (d.kategorie !== "datenblatt") return [];
  const typen = new Set(b.filter((x) => d.bauteilIds.includes(x.id)).map((x) => x.katalogId));
  return b.filter((x) => typen.has(x.katalogId) && !d.bauteilIds.includes(x.id)).map((x) => x.id);
}
const FEHLER: Record<string, string> = {
  typ_unbekannt: "Dateityp nicht erlaubt. Erlaubt sind PDF, JPG, PNG, HEIC, Word, Excel und PowerPoint.",
  makro: "Dateien mit Makros werden nicht abgelegt.", zu_gross: "Datei grösser als 100 MB.", leer: "Datei ist leer.",
  nicht_sauber: "Datei ist noch nicht freigegeben.", bauteil_unbekannt: "Bauteil gehört nicht zu diesem Gebäude.",
  abgelehnt: "Abgelehnte Dateien lassen sich nicht ändern.", nicht_scan_fehler: "Nur fehlgeschlagene Prüfungen lassen sich wiederholen.",
  auslesen_aus: "Auslesen ist ausgeschaltet. Der Admin kann es einschalten.",
  bauteil_gemischt: "Die Bauteile müssen vom gleichen Typ und im gleichen Gebäude sein.",
  feld_unbekannt: "Unbekanntes Datenblatt-Feld.", feld_typ: "Ungültiger Wert im Datenblatt.",
  liest_bereits: "Das Dokument wird bereits gelesen.", kein_pdf: "Nur PDF-Dateien lassen sich auslesen.",
  zu_viele_seiten: "Das Dokument hat zu viele Seiten zum Auslesen.",
};
/** `fallback` je Aktion, z. B. "Ablegen fehlgeschlagen." beim Upload. */
export function ablageFehlerText(code: string | null, status?: number, fallback = "Aktion fehlgeschlagen."): string {
  if (code && Object.hasOwn(FEHLER, code)) return FEHLER[code];
  if (status === 413) return FEHLER.zu_gross;
  if (status === 403) return "Keine Berechtigung zum Ablegen.";
  return fallback;
}
export const unterlagenFuer = (d: AblageZeile[], bauteilIds: string[]) => d.filter((x) => x.bauteilIds.some((id) => bauteilIds.includes(id)));
export function vorpruefen<T extends { size: number }>(dateien: T[]) {
  return { ok: dateien.filter((f) => f.size <= MAX_BYTES), zuGross: dateien.filter((f) => f.size > MAX_BYTES) };
}
