import { Plus } from "lucide-react";
import { useState } from "react";
import { ERZEUGER, K, teilName } from "../bestueckung";
import { artName, erzeuger, geschossRang, zentraleRaumHinweis } from "../zustand";
import { Abschnitt, Hinweis, Schalter } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

const ERZEUGER_TEXT: Record<string, string> = {
  [K.waermepumpe]: "Luft, Erdsonde oder Grundwasser",
  [K.gaskessel]: "Gas-Heizkessel",
  [K.oelkessel]: "Öl-Heizkessel",
  [K.fernwaerme]: "Anschluss an ein Wärmenetz",
};

export function Schritt4Zentrale({ z, dispatch, katalog }: SchrittInhaltProps) {
  const alle = erzeuger(z);
  const erster = alle[0];
  const speicher = z.bauteile.some((t) => t.katalogId === K.speicher);
  const hinweis = zentraleRaumHinweis(z);
  const unten = [...z.gebaeude.geschosse].sort((a, b) => geschossRang(a.code) - geschossRang(b.code));
  const [neuGeschoss, setNeuGeschoss] = useState(unten[0]?.code ?? "EG");
  return <>
    <Abschnitt titel="Erzeuger" zusatz="Was erzeugt die Wärme?">
      <div className="as-erzeuger" role="radiogroup" aria-label="Erzeuger">
        {ERZEUGER.map((id) => (
          <label key={id} className="as-kachel as-kachel-zeile">
            <input type="radio" name="as-erzeuger" value={id} checked={erster?.katalogId === id} onChange={() => dispatch({ typ: "erzeuger", katalogId: id })} />
            <span className="as-kachel-inhalt">
              <span className="as-kachel-name">{teilName(id, katalog)}</span>
              <span className="as-kachel-text">{ERZEUGER_TEXT[id]}</span>
            </span>
          </label>
        ))}
      </div>
      {erster && <div className="as-reihe">
        <label className="as-feld"><span className="as-label">Hersteller (optional)</span>
          <input type="text" value={erster.hersteller ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: erster.schluessel, hersteller: e.target.value })} /></label>
        <label className="as-feld"><span className="as-label">Typ (optional)</span>
          <input type="text" value={erster.typ ?? ""} maxLength={200} onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: erster.schluessel, geraetTyp: e.target.value })} /></label>
      </div>}
      {alle.length > 1 && <Hinweis>Weitere Erzeuger: {alle.slice(1).map((t) => teilName(t.katalogId, katalog)).join(", ")}. Sie bleiben unverändert.</Hinweis>}
    </Abschnitt>
    <Abschnitt titel="Speicher">
      <Schalter label="Pufferspeicher vorhanden" an={speicher} onAn={(an) => dispatch({ typ: "speicher", an })} />
    </Abschnitt>
    <Abschnitt titel="Raum der Zentrale" zusatz="Erzeuger, Speicher und Hauptverteiler stehen hier.">
      <label className="as-feld">
        <span className="ui-sr">Raum der Zentrale</span>
        <select value={z.zentraleRaum ?? ""} onChange={(e) => e.target.value && dispatch({ typ: "zentraleRaum", einheit: e.target.value })}>
          {!z.zentraleRaum && <option value="">Bitte wählen</option>}
          {unten.map((g) => {
            const es = z.einheiten.filter((e) => e.geschoss === g.code);
            return es.length ? <optgroup key={g.code} label={g.code}>
              {es.map((e) => <option key={e.schluessel} value={e.schluessel}>{e.bezeichnung} · {artName(e.art)}</option>)}
            </optgroup> : null;
          })}
        </select>
      </label>
      {hinweis && <Hinweis art="warnung">{hinweis}</Hinweis>}
      <div className="as-reihe as-reihe-unten">
        <label className="as-feld as-feld-schmal">
          <span className="as-label">Technikraum anlegen in</span>
          <select value={neuGeschoss} onChange={(e) => setNeuGeschoss(e.target.value)}>
            {unten.map((g) => <option key={g.code} value={g.code}>{g.code}</option>)}
          </select>
        </label>
        <button type="button" className="as-knopf as-knopf-klein" onClick={() => dispatch({ typ: "technikraumNeu", geschoss: neuGeschoss })}>
          <Plus size={14} strokeWidth={1.75} aria-hidden />Technikraum anlegen</button>
      </div>
    </Abschnitt>
  </>;
}
