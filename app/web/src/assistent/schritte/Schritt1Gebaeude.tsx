import type { Grundform } from "../../typen";
import { geschossAnzahl } from "../zustand";
import { Abschnitt, Hinweis, Zaehler } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

export const FORMEN: readonly { form: Grundform; name: string; text: string }[] = [
  { form: "quader", name: "Rechteck", text: "Langgestreckt" },
  { form: "quadrat", name: "Quadrat", text: "Gleich lange Seiten" },
  { form: "l_form", name: "L-Form", text: "Zwei Flügel" },
  { form: "u_form", name: "U-Form", text: "Drei Flügel" },
];

/** Mini-Grundriss als Fläche (keine Linienzeichnung): Hauptfläche plus leichte Kante unten rechts für Tiefe. */
export function MiniGrundriss({ form }: { form: Grundform }) {
  const pfad: Record<Grundform, string> = {
    quader: "M6 12h44v20H6z",
    quadrat: "M16 8h24v24H16z",
    l_form: "M10 6h14v18h22v12H10z",
    u_form: "M8 8h12v14h16V8h12v28H8z",
  };
  return (
    <svg className="as-grundriss" viewBox="0 0 56 44" aria-hidden="true">
      <path d={pfad[form]} className="as-grundriss-schatten" transform="translate(1.5 2)" />
      <path d={pfad[form]} className="as-grundriss-flaeche" />
    </svg>
  );
}

export function Schritt1Gebaeude({ z, dispatch, neu, liegenschaften }: SchrittInhaltProps) {
  const lesend = !z.huelleBearbeitbar;
  const { ug, og } = geschossAnzahl(z.gebaeude.geschosse);
  const codes = z.gebaeude.geschosse.map((g) => g.code);
  return <>
    {lesend && <Hinweis>{z.gebaeude.id
      ? "Name, Form und Geschosse legt Planora fest. Für Änderungen wende dich bitte an Planora."
      : "Neue Gebäude legt Planora an. Dir fehlt dafür das Recht «Hülle verwalten»."}</Hinweis>}
    {neu && !z.gebaeude.id && liegenschaften.length > 1 && (
      <label className="as-feld">
        <span className="as-label">Liegenschaft</span>
        <select value={z.gebaeude.liegenschaftId ?? ""} disabled={lesend} onChange={(e) => dispatch({ typ: "gebaeude", liegenschaftId: e.target.value })}>
          {liegenschaften.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
    )}
    {neu && !z.gebaeude.id && liegenschaften.length === 0 && <Hinweis art="warnung">Keine Liegenschaft verfügbar. Planora muss zuerst eine Liegenschaft für dich einrichten.</Hinweis>}
    <label className="as-feld">
      <span className="as-label">Name des Gebäudes</span>
      <input type="text" value={z.gebaeude.name} maxLength={200} disabled={lesend} placeholder="z. B. Bürohaus Seefeld"
        autoComplete="off" onChange={(e) => dispatch({ typ: "gebaeude", name: e.target.value })} />
    </label>
    <Abschnitt titel="Form" zusatz="Die Grösse ergibt sich aus dem Inhalt.">
      <div className="as-formen" role="radiogroup" aria-label="Form">
        {FORMEN.map((f) => (
          <label key={f.form} className="as-kachel">
            <input type="radio" name="as-form" value={f.form} checked={z.gebaeude.grundform === f.form} disabled={lesend}
              onChange={() => dispatch({ typ: "gebaeude", grundform: f.form })} />
            <span className="as-kachel-inhalt">
              <MiniGrundriss form={f.form} />
              <span className="as-kachel-name">{f.name}</span>
              <span className="as-kachel-text">{f.text}</span>
            </span>
          </label>
        ))}
      </div>
    </Abschnitt>
    <Abschnitt titel="Geschosse" zusatz="Bezeichnungen entstehen automatisch.">
      <div className="as-reihe">
        <Zaehler label="Untergeschosse" wert={ug} min={0} max={3} deaktiviert={lesend} onWert={(n) => dispatch({ typ: "geschosse", ug: n, og })} />
        <Zaehler label="Obergeschosse" wert={og} min={0} max={40} deaktiviert={lesend} onWert={(n) => dispatch({ typ: "geschosse", ug, og: n })} />
      </div>
      <div className="as-stapel" aria-label={`Geschosse: ${codes.join(", ")}`}>
        {[...codes].reverse().map((c) => <span key={c} className={`as-stapel-platte${c === "EG" ? " as-stapel-eg" : c.startsWith("UG") ? " as-stapel-ug" : ""}`}>{c}</span>)}
      </div>
    </Abschnitt>
  </>;
}
