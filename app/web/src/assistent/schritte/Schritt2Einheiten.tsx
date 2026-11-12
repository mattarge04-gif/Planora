import { Plus, Trash2 } from "lucide-react";
import { EINHEIT_ARTEN, geschossRang, type Aktion, type AssistentZustand } from "../zustand";
import { Hinweis, ICON } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

/** Schnellknöpfe je Geschoss. */
export const SCHNELL: readonly { text: string; art: string; anzahl: number }[] = [
  { text: "3 Büros", art: "buero", anzahl: 3 },
  { text: "2 Wohnungen", art: "wohnung", anzahl: 2 },
  { text: "Gastro", art: "gastro", anzahl: 1 },
  { text: "Technik", art: "technik", anzahl: 1 },
  { text: "Kern", art: "kern", anzahl: 1 },
];
export const schnellAktion = (geschoss: string, s: (typeof SCHNELL)[number]): Aktion => ({ typ: "einheitNeu", geschoss, art: s.art, anzahl: s.anzahl });

/** Geschosse von oben nach unten (wie ein Gebäudeschnitt). */
export const geschosseAbsteigend = (z: AssistentZustand) => [...z.gebaeude.geschosse].sort((a, b) => geschossRang(b.code) - geschossRang(a.code));

export function Schritt2Einheiten({ z, dispatch }: SchrittInhaltProps) {
  return <>
    <Hinweis>Erfasse je Geschoss die Nutzungen, z. B. Büros, Wohnungen oder die Technikzentrale. Flächen braucht es nicht.</Hinweis>
    {geschosseAbsteigend(z).map((g) => {
      const einheiten = z.einheiten.filter((e) => e.geschoss === g.code);
      return (
        <section key={g.code} className="as-karte" aria-label={`Geschoss ${g.code}`}>
          <header className="as-karte-kopf">
            <span className="as-code">{g.code}</span>
            <span className="as-zahl">{einheiten.length === 1 ? "1 Einheit" : `${einheiten.length} Einheiten`}</span>
          </header>
          {einheiten.length > 0 && <ul className="as-zeilen as-liste-roh">
            {einheiten.map((e, i) => (
              <li key={e.schluessel} className="as-zeile as-zeile-einheit">
                <input type="text" aria-label={`Bezeichnung Einheit ${i + 1}, ${g.code}`} value={e.bezeichnung} maxLength={200}
                  onChange={(ev) => dispatch({ typ: "einheitAendern", schluessel: e.schluessel, bezeichnung: ev.target.value })} />
                <select aria-label={`Nutzung Einheit ${i + 1}, ${g.code}`} value={e.art} onChange={(ev) => dispatch({ typ: "einheitAendern", schluessel: e.schluessel, art: ev.target.value })}>
                  {EINHEIT_ARTEN.map((a) => <option key={a.art} value={a.art}>{a.name}</option>)}
                </select>
                <button type="button" className="as-rundknopf" aria-label={`Einheit ${i + 1}, ${g.code}, ${e.bezeichnung} entfernen`} onClick={() => dispatch({ typ: "einheitLoeschen", schluessel: e.schluessel })}><Trash2 {...ICON} /></button>
              </li>
            ))}
          </ul>}
          <div className="as-chips" role="group" aria-label={`Einheiten zu ${g.code} hinzufügen`}>
            {SCHNELL.map((s) => (
              <button key={s.text} type="button" className="as-textknopf as-textknopf-rand" onClick={() => dispatch(schnellAktion(g.code, s))}>
                <Plus size={14} strokeWidth={1.75} aria-hidden />{s.text}</button>
            ))}
          </div>
        </section>
      );
    })}
  </>;
}
