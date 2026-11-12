/** Tastaturbedienung des Assistenten (reine Logik, ohne DOM-Abhängigkeit testbar). */

export interface TastenEreignis {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}

/** Minimale Sicht auf ein Eingabeelement (HTMLInputElement erfüllt sie). */
export interface Bedienelement {
  tagName: string;
  type?: string;
  disabled?: boolean;
  click(): void;
}

export type TastenWirkung = "umschalten" | "weiter" | null;

function istUmschalter(z: unknown): z is Bedienelement {
  if (!z || typeof z !== "object") return false;
  const e = z as Partial<Bedienelement>;
  return typeof e.tagName === "string" && e.tagName.toUpperCase() === "INPUT" && (e.type === "checkbox" || e.type === "radio") && typeof e.click === "function";
}

/**
 * Wirkung einer Taste im Formular:
 * - Enter auf Schalter, Checkbox oder Kachel (Radio) schaltet wie die Leertaste (Browser tun das nativ nicht).
 * - Ctrl/Cmd+Enter geht einen Schritt weiter, unabhängig vom Fokus (lange Listen in Schritt 5).
 */
export function tastenWirkung(e: TastenEreignis, ziel: unknown): TastenWirkung {
  if (e.key !== "Enter" || e.isComposing || e.altKey || e.shiftKey) return null;
  if (e.ctrlKey || e.metaKey) return "weiter";
  if (istUmschalter(ziel) && !ziel.disabled) return "umschalten";
  return null;
}

/** Führt die Wirkung aus; gibt true zurück, wenn das Ereignis behandelt wurde (dann preventDefault). */
export function tasteBehandeln(e: TastenEreignis, ziel: unknown, weiter: () => void): boolean {
  const w = tastenWirkung(e, ziel);
  if (w === "umschalten") { (ziel as Bedienelement).click(); return true; }
  if (w === "weiter") { weiter(); return true; }
  return false;
}
