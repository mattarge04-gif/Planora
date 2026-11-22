/** Zusammenspiel Ansicht (Übersicht/Technik) und Schalter Erneuerung, als reine Funktion.
 *
 * Regeln (PO-Entscheid 22.11.2026, ersetzt Ruling 5 vom 20.11.):
 * - Erneuerung ist eine Ebene über beiden Ansichten: Übersicht zeigt das Geschossband ("wo"),
 *   Technik die Manschetten am Bauteil ("welches").
 * - Ein-/Ausschalten ändert die Ansicht nicht; ein Ansichtswechsel ändert die Erneuerung nicht.
 * - Taste E und Pill verwenden dieselbe Aktion.
 */
export type Ansicht = "uebersicht" | "technik";
export interface AnsichtStand { ansicht: Ansicht; erneuerung: boolean }
export type AnsichtAktion = { art: "erneuerung"; an: boolean } | { art: "ansicht"; ansicht: Ansicht };
export interface AnsichtSchritt { stand: AnsichtStand; meldung: string | null }

export function naechsteAnsicht(s: AnsichtStand, a: AnsichtAktion): AnsichtSchritt {
  if (a.art === "erneuerung") {
    if (a.an === s.erneuerung) return { stand: s, meldung: null };
    return { stand: { ...s, erneuerung: a.an }, meldung: a.an ? "Erneuerungsansicht an" : "Erneuerungsansicht aus" };
  }
  return { stand: { ...s, ansicht: a.ansicht }, meldung: null };
}
