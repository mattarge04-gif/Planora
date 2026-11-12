import type { ReactNode } from "react";
import "./ui.css";

interface Props {
  titel: string;
  /** Kleine Zahl neben dem Titel (z. B. Anzahl Einträge). */
  anzahl?: number;
  aktion?: ReactNode;
  klasse?: string;
  children: ReactNode;
}

/** Schwebende Glaskarte (Weiss 85 %, Weichzeichner, Radius 12). */
export function Karte({ titel, anzahl, aktion, klasse = "", children }: Props) {
  const id = `karte-${titel.toLowerCase().replace(/[^a-zäöü0-9]+/g, "-")}`;
  return (
    <section className={`ui-glas ui-karte ${klasse}`} aria-labelledby={id}>
      <header className="ui-karte-kopf">
        <h2 id={id}>{titel}{anzahl !== undefined && <span className="ui-anzahl">{anzahl}</span>}</h2>
        {aktion}
      </header>
      {children}
    </section>
  );
}
