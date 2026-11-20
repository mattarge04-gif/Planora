/** Zusammenspiel Ansicht (Übersicht/Technik) und Schalter Erneuerung, als reine Funktion.
 *
 * Regeln (Kritik r1 P2, 20.11.2026):
 * - Erneuerung ist eine Ebene der Technikansicht. Einschalten aus der Übersicht wechselt in Technik und merkt sich das.
 * - Ausschalten kehrt in die Ansicht zurück, aus der Erneuerung eingeschaltet wurde.
 * - "Übersicht" wählen beendet Erneuerung sichtbar (Meldung), nie stillschweigend.
 * - Taste E und Pill verwenden dieselbe Aktion.
 */
export type Ansicht = "uebersicht" | "technik";
export interface AnsichtStand { ansicht: Ansicht; erneuerung: boolean; /** Ansicht vor dem Einschalten der Erneuerung */ vorher: Ansicht | null }
export type AnsichtAktion = { art: "erneuerung"; an: boolean } | { art: "ansicht"; ansicht: Ansicht };
export interface AnsichtSchritt { stand: AnsichtStand; meldung: string | null }

export function naechsteAnsicht(s: AnsichtStand, a: AnsichtAktion): AnsichtSchritt {
  if (a.art === "erneuerung") {
    if (a.an === s.erneuerung) return { stand: s, meldung: null };
    if (a.an) return { stand: { ansicht: "technik", erneuerung: true, vorher: s.ansicht }, meldung: "Erneuerungsansicht an" };
    return { stand: { ansicht: s.vorher ?? s.ansicht, erneuerung: false, vorher: null }, meldung: "Erneuerungsansicht aus" };
  }
  if (a.ansicht === "uebersicht" && s.erneuerung)
    return { stand: { ansicht: "uebersicht", erneuerung: false, vorher: null }, meldung: "Erneuerung beendet: nur in der Technikansicht verfügbar" };
  // Technik bleibt Technik; wer in Erneuerung bewusst eine Ansicht wählt, kehrt beim Ausschalten nicht mehr in die Übersicht zurück.
  return { stand: { ...s, ansicht: a.ansicht, vorher: s.erneuerung ? a.ansicht : null }, meldung: null };
}
