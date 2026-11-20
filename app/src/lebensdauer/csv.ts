import type { LebensdauerStand } from "./speicher.js";

/** Eine CSV-Zelle: Formel-Anfaenge entschaerfen (CSV-Injection), Semikolon/Anfuehrungszeichen/Zeilenumbruch quoten. */
export function zelle(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Anzeigenamen mit echten Umlauten fuer die CSV; Katalog-IDs und Katalognamen bleiben unveraendert. */
export const ANZEIGENAMEN: Record<string, string> = {
  "heizung.waermepumpe": "Wärmepumpe", "heizung.gaskessel": "Gaskessel", "heizung.oelkessel": "Ölkessel",
  "heizung.fernwaerme_uebergabe": "Fernwärme-Übergabe", "heizung.speicher": "Speicher", "heizung.umwaelzpumpe": "Umwälzpumpe",
  "heizung.verteiler": "Heizungsverteiler", "heizung.heizkoerper": "Heizkörper", "heizung.fbh_kreis": "FBH-Kreis",
  "heizung.tabs_feld": "TABS-Feld", "heizung.ventil_3weg": "3-Weg-Ventil", "heizung.ventil_2weg": "Durchgangsventil", "heizung.wmz": "Wärmezähler",
};
const AMPEL = { gruen: "In Ordnung", gelb: "Bald ersetzen", rot: "Ersetzen", grau: "Baujahr fehlt" } as const;
const ZUSTAND = { gut: "Gut", mittel: "Mittel", schlecht: "Schlecht", kritisch: "Kritisch" } as const;
const HERKUNFT = { kunde: "Eigene Angabe", dokument: "Aus Dokument" } as const;
const zeile = (werte: (string | number | null | undefined)[]) => werte.map(zelle).join(";");

/** Semikolon, UTF-8 mit BOM (Excel de-CH oeffnet direkt). Zahlen mit Punkt. */
export function erneuerungCsv(s: LebensdauerStand, namen: Record<string, string>): string {
  const erg = new Map(s.ergebnis.bauteile.map((b) => [b.id, b]));
  const z = [zeile(["Ort", "Bauteil", "Hersteller", "Typ", "Menge", "Baujahr", "Zustand", "Lebensdauer", "Ersatzjahr", "Ampel", "Stückpreis", "Kosten", "Quelle Preis"])];
  const sortiert = [...s.bauteile].sort((a, b) => (erg.get(a.id)!.ersatzjahr ?? 9999) - (erg.get(b.id)!.ersatzjahr ?? 9999));
  for (const b of sortiert) {
    const e = erg.get(b.id)!;
    z.push(zeile([b.ort, ANZEIGENAMEN[b.katalogId] ?? namen[b.katalogId] ?? b.katalogId, b.hersteller, b.typ, b.menge ?? "unbekannt", e.baujahr, b.akte?.zustand ? ZUSTAND[b.akte.zustand] : null,
      e.lebensdauer, e.ersatzjahr, AMPEL[e.ampel], e.stueckpreis, e.kosten, e.quellen.preisHerkunft ? HERKUNFT[e.quellen.preisHerkunft] : null]));
  }
  z.push("", zeile(["Jahr", "Betrag", "ohne Preis"]));
  for (const j of s.ergebnis.jahre) z.push(zeile([j.jahr, j.betrag, j.ohnePreis]));
  return "﻿" + z.join("\r\n") + "\r\n";
}
