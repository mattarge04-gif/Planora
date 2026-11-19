import type { LebensdauerStand } from "./speicher.js";

/** Eine CSV-Zelle: Formel-Anfaenge entschaerfen (CSV-Injection), Semikolon/Anfuehrungszeichen/Zeilenumbruch quoten. */
export function zelle(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const zeile = (werte: (string | number | null | undefined)[]) => werte.map(zelle).join(";");

/** Semikolon, UTF-8 mit BOM (Excel de-CH oeffnet direkt). Zahlen mit Punkt. */
export function erneuerungCsv(s: LebensdauerStand, namen: Record<string, string>): string {
  const erg = new Map(s.ergebnis.bauteile.map((b) => [b.id, b]));
  const z = [zeile(["Ort", "Bauteil", "Hersteller", "Typ", "Menge", "Baujahr", "Zustand", "Lebensdauer", "Ersatzjahr", "Ampel", "Stückpreis", "Kosten", "Quelle Preis"])];
  const sortiert = [...s.bauteile].sort((a, b) => (erg.get(a.id)!.ersatzjahr ?? 9999) - (erg.get(b.id)!.ersatzjahr ?? 9999));
  for (const b of sortiert) {
    const e = erg.get(b.id)!;
    z.push(zeile([b.ort, namen[b.katalogId] ?? b.katalogId, b.hersteller, b.typ, b.menge ?? "unbekannt", e.baujahr, b.akte?.zustand ?? null,
      e.lebensdauer, e.ersatzjahr, e.ampel, e.stueckpreis, e.kosten, e.quellen.preisHerkunft]));
  }
  z.push("", zeile(["Jahr", "Betrag", "ohne Preis"]));
  for (const j of s.ergebnis.jahre) z.push(zeile([j.jahr, j.betrag, j.ohnePreis]));
  return "﻿" + z.join("\r\n") + "\r\n";
}
