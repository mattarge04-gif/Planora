import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { pruefHinweise, zusammenfassung } from "../hinweise";
import { SCHRITTE, type SchrittNr } from "../zustand";
import { Abschnitt } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

export function Schritt7Pruefen({ z, dispatch, katalog, welt, vorschauFehler, positionen }: SchrittInhaltProps) {
  const hinweise = pruefHinweise(z, welt, positionen, katalog);
  const zeilen: { titel: string; text: string; schritt: SchrittNr }[] = [
    { titel: "Geschosse", text: z.gebaeude.geschosse.map((g) => g.code).join(", "), schritt: 1 },
    ...zusammenfassung(z, katalog),
  ];
  return <>
    <Abschnitt titel="Zusammenfassung">
      <dl className="as-zusammenfassung">
        {zeilen.map(({ titel, text, schritt }) => (
          <div key={titel} className="as-zusammenfassung-zeile">
            <dt>{titel}</dt>
            <dd>{text}</dd>
            <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "schritt", nr: schritt })} aria-label={`${titel} bearbeiten (Schritt ${schritt})`}>Ändern</button>
          </div>
        ))}
      </dl>
    </Abschnitt>
    <Abschnitt titel="Hinweise" zusatz={hinweise.length ? `${hinweise.length}, blockieren nicht` : undefined}>
      {vorschauFehler && <p className="as-hinweis as-hinweis-warnung">Die Vorschau meldet: {vorschauFehler.join(" ")} Übernehmen ist so nicht möglich.</p>}
      {hinweise.length === 0 && !vorschauFehler && <p className="as-ok"><CircleCheck size={16} strokeWidth={1.75} aria-hidden />Keine Hinweise. Die Beschreibung ist vollständig.</p>}
      {hinweise.length > 0 && <ul className="as-liste-roh as-hinweise">
        {hinweise.map((x, i) => (
          <li key={`${x.code}-${x.schluessel ?? i}`} className="as-hinweis-zeile">
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
            <span>{x.text}</span>
            <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "schritt", nr: x.schritt })}>
              {SCHRITTE[x.schritt - 1].titel}<ArrowRight size={14} strokeWidth={1.75} aria-hidden /></button>
          </li>
        ))}
      </ul>}
    </Abschnitt>
    <p className="as-leer">Mit «Übernehmen» wird die Beschreibung gespeichert, der Digital Twin neu aufgebaut und der Entwurf gelöscht.</p>
  </>;
}
