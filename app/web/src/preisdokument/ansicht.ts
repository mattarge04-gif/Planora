import type { DokumentZeile, Uebersicht, VorschlagZeile } from "./typen";

/** "CHF 1'296.00" (immer zwei Nachkommastellen, Apostroph als Tausendertrenner). */
export function franken(n: number): string {
  const [ganz, rest] = (Math.round(n * 100) / 100).toFixed(2).split(".");
  return `CHF ${ganz.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${rest}`;
}

export function statusText(d: Pick<DokumentZeile, "status" | "fehler" | "vorschlaege">): string {
  switch (d.status) {
    case "neu":
    case "liest": return "liest …";
    case "fertig": {
      const n = d.vorschlaege.length;
      return n === 0 ? "Keine Vorschläge" : n === 1 ? "1 Vorschlag" : `${n} Vorschläge`;
    }
    case "fehler": return d.fehler ?? "Auslesen fehlgeschlagen";
    case "abgebrochen": return "Auslesen abgebrochen";
    case "aus": return "Auslesen ausgeschaltet";
  }
}

/** Offene, sichere Vorschlaege mit Typ und mindestens einem Bauteil (was "Alle sicheren" uebernimmt). */
export function offeneSichere(u: Uebersicht): number {
  return u.dokumente.reduce((s, d) => s + d.vorschlaege.filter((v) => v.status === "offen" && v.sicherheit === "hoch" && v.katalogId !== null && v.bauteilIds.length > 0).length, 0);
}

/** Je Dokument die Vorschlaege mit Bauteil-Zuordnung und ohne; mit `nurBauteil` nur Vorschlaege, die dieses Bauteil betreffen. */
export function gruppiere(u: Uebersicht, nurBauteil?: string): { dokument: DokumentZeile; zugeordnet: VorschlagZeile[]; ohne: VorschlagZeile[] }[] {
  return u.dokumente.map((dokument) => {
    const alle = nurBauteil === undefined ? dokument.vorschlaege : dokument.vorschlaege.filter((v) => v.bauteilIds.includes(nurBauteil));
    return { dokument, zugeordnet: alle.filter((v) => v.bauteilIds.length > 0), ohne: alle.filter((v) => v.bauteilIds.length === 0) };
  });
}

/** Solange ein Dokument noch gelesen wird, soll die Seite pollen. */
export function laeuftNoch(u: Uebersicht): boolean {
  return u.dokumente.some((d) => d.status === "neu" || d.status === "liest");
}

/** "Umwälzpumpe · UG1 · HK Büro A (2 von 4)"; bauteile = Kandidaten gleichen Typs im Gebaeude. */
export function zuordnungText(v: VorschlagZeile, bauteile: { id: string; name: string; ort: string }[]): string {
  const erstes = v.bauteilIds.map((id) => bauteile.find((b) => b.id === id)).find((b) => b !== undefined);
  if (!erstes) return "Keinem Bauteil zugeordnet";
  const basis = `${erstes.name} · ${erstes.ort}`;
  return bauteile.length > 1 ? `${basis} (${v.bauteilIds.length} von ${bauteile.length})` : basis;
}
