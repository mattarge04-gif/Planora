import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { K, teilName } from "../bestueckung";
import { pruefHinweise } from "../hinweise";
import { SCHRITTE, erzeuger, type SchrittNr, hauptverteiler, istAbgabe, unterverteiler, weitereTeile } from "../zustand";
import { Abschnitt } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

export function Schritt8Pruefen({ z, dispatch, katalog, welt, vorschauFehler, positionen }: SchrittInhaltProps) {
  const hinweise = pruefHinweise(z, welt, positionen, katalog);
  const abgaben = z.bauteile.filter(istAbgabe);
  const bekannt = abgaben.filter((t) => t.menge !== null).reduce((s, t) => s + (t.menge ?? 0), 0);
  const offen = abgaben.filter((t) => t.menge === null).length;
  const h = hauptverteiler(z);
  const gruppen = z.gruppen.filter((g) => g.verteiler === h?.schluessel).sort((a, b) => a.nummer - b.nummer);
  const zeilen: [string, string, SchrittNr][] = [
    ["Geschosse", z.gebaeude.geschosse.map((g) => g.code).join(", "), 1],
    ["Einheiten", String(z.einheiten.length), 2],
    ["Abgaben", `${abgaben.length} Positionen · ${bekannt} Stück${offen ? ` · ${offen} ohne Menge` : ""}`, 3],
    ["Zentrale", [...erzeuger(z).map((t) => teilName(t.katalogId, katalog)), ...(z.bauteile.some((t) => t.katalogId === K.speicher) ? ["Speicher"] : [])].join(", ") || "–", 4],
    ["Gruppen", gruppen.length ? gruppen.map((g) => g.bezeichnung || `Gruppe ${g.nummer}`).join(", ") : "–", 5],
    ["Unterverteiler", String(unterverteiler(z).length), 6],
    ["Weitere Teile", String(weitereTeile(z).length), 7],
  ];
  return <>
    <Abschnitt titel="Zusammenfassung">
      <dl className="as-zusammenfassung">
        {zeilen.map(([titel, wert, nr]) => (
          <div key={titel} className="as-zusammenfassung-zeile">
            <dt>{titel}</dt>
            <dd>{wert}</dd>
            <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "schritt", nr })} aria-label={`${titel} bearbeiten (Schritt ${nr})`}>Ändern</button>
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
