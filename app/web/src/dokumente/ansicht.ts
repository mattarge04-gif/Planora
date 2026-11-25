import type { AblageBauteil, AblageZeile, Kategorie } from "./typen";
export const MAX_BYTES = 100 * 1024 * 1024;
/** Lesegrenzen "Preise lesen" (Spiegel von app/src/preisdokument/pdf.ts). */
export const LESEN_MAX_BYTES = 32 * 1024 * 1024, LESEN_MAX_SEITEN = 100;
/** Erlaubte Dateien fuer die Dateiauswahl (Typ entscheidet der Server aus den Magic Bytes). */
export const DATEI_ACCEPT = "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/heic,.heic,.docx,.xlsx,.pptx,.doc,.xls,.ppt";
/** Sauberes PDF innerhalb der Lesegrenzen (sonst kein Knopf "Preise lesen"). */
export const lesbarFuerPreise = (d: Pick<AblageZeile, "art" | "scanStatus" | "groesse" | "seiten">) =>
  d.art === "pdf" && d.scanStatus === "sauber" && d.groesse <= LESEN_MAX_BYTES && (d.seiten ?? 0) <= LESEN_MAX_SEITEN;
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
  return d.scanGrund ? { text: "Prüfung fehlgeschlagen", art: "fehler", detail: d.scanGrund } : { text: "Prüfung fehlgeschlagen", art: "fehler" };
}
const zahl = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });
/** Einheitlich in allen Ansichten (D3): mindestens "1 kB", ab 1 MB mit einer Nachkommastelle. */
export function groesseText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${zahl.format(Math.max(1, Math.round(bytes / 1024)))} kB`;
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
  auslesen_aus: "Automatisches Auslesen ist nicht eingerichtet.",
  bauteil_gemischt: "Die Bauteile müssen vom gleichen Typ und im gleichen Gebäude sein.",
  feld_unbekannt: "Unbekanntes Datenblatt-Feld.", feld_typ: "Ungültiger Wert im Datenblatt.",
  liest_bereits: "Das Dokument wird bereits gelesen.", kein_pdf: "Nur PDF-Dateien lassen sich auslesen.",
  zu_viele_seiten: "Das Dokument hat zu viele Seiten zum Auslesen.",
  zu_gross_lesen: "Das Dokument ist zu gross zum Auslesen (über 32 MB).",
};
export const ABLEGEN_FEHLT = "Ablegen fehlgeschlagen.";
/** `fallback` je Aktion, z. B. "Ablegen fehlgeschlagen." beim Upload. */
export function ablageFehlerText(code: string | null, status?: number, fallback = "Aktion fehlgeschlagen."): string {
  if (code && Object.hasOwn(FEHLER, code)) return FEHLER[code];
  if (status === 413) return FEHLER.zu_gross;
  if (status === 403) return fallback === ABLEGEN_FEHLT ? "Keine Berechtigung zum Ablegen." : "Keine Berechtigung für diese Aktion.";
  if (status === 404) return "Das Dokument ist nicht mehr abgelegt.";
  return fallback;
}
const ERLAUBTE_ENDUNG = /\.(pdf|jpe?g|png|heic|docx|xlsx|pptx|doc|xls|ppt)$/i;
/** Ablegen fehlgeschlagen: bei erlaubter Endung und unbekanntem Typ passt der Inhalt nicht zur Endung (z. B. Programm als .pdf). */
export function ablegenFehlerText(code: string | null, status: number | undefined, dateiname: string): string {
  const endung = dateiname.match(ERLAUBTE_ENDUNG)?.[0].toLowerCase();
  if (code === "typ_unbekannt" && endung) return `Inhalt passt nicht zur Endung ${endung}.`;
  return ablageFehlerText(code, status, ABLEGEN_FEHLT);
}
/** Gleicher Inhalt schon abgelegt (Antwort 200): Text je Zustand des bestehenden Dokuments. */
export function duplikatText(z: Pick<AblageZeile, "dateiname" | "scanStatus">, name: string): string {
  if (z.scanStatus === "abgelehnt") return "Wurde bei der Virenprüfung abgelehnt.";
  const als = z.dateiname === name ? "" : ` als ${z.dateiname}`;
  return z.scanStatus === "quarantaene" ? `Ist schon abgelegt${als}, wird geprüft.` : `Ist schon abgelegt${als}.`;
}
const typSchluessel = (b: AblageBauteil) => (b.hersteller?.trim() && b.typ?.trim() ? `${b.katalogId}|${b.hersteller.trim().toLowerCase()}|${b.typ.trim().toLowerCase()}` : null);
/** Unterlagen der Karte: direkt verknüpfte Dateien; ein Datenblatt gilt für alle Bauteile gleichen Typs (E48, Katalog-ID + Hersteller + Typ). */
export function unterlagenFuer(d: AblageZeile[], bauteilIds: string[], bauteile: AblageBauteil[] = []): AblageZeile[] {
  const typen = new Set(bauteile.filter((b) => bauteilIds.includes(b.id)).map(typSchluessel).filter((x): x is string => !!x));
  const gleicherTyp = new Set(bauteile.filter((b) => typen.has(typSchluessel(b) ?? "")).map((b) => b.id));
  return d.filter((x) => x.bauteilIds.some((id) => bauteilIds.includes(id)) || (x.kategorie === "datenblatt" && x.bauteilIds.some((id) => gleicherTyp.has(id))));
}
export function vorpruefen<T extends { size: number }>(dateien: T[]) {
  return { ok: dateien.filter((f) => f.size <= MAX_BYTES), zuGross: dateien.filter((f) => f.size > MAX_BYTES) };
}
