import { Minus, Plus } from "lucide-react";
import { GRUPPEN_ARTEN, GRUPPEN_ART_TEXT, K, teilName } from "../bestueckung";
import { bestueckungVon, einheitVon, gruppeVonVerbraucher, hauptverteiler, unterverteiler, verbraucherKandidaten, zubehoerVon, type ZGruppe } from "../zustand";
import { ueberUnterverteiler } from "../hinweise";
import { Abschnitt, Hinweis, Schalter, Zaehler } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

function GruppenKarte({ g, z, dispatch, katalog }: { g: ZGruppe } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const titel = g.bezeichnung || `Gruppe ${g.nummer}`;
  const wmz = zubehoerVon(z, g.schluessel).some((t) => t.katalogId === K.wmz);
  const unter = new Set(unterverteiler(z).map((t) => t.schluessel));
  const uv = ueberUnterverteiler(z);
  const kandidaten = verbraucherKandidaten(z);
  const id = `as-gruppe-${g.schluessel}`;
  return (
    <section className="as-karte as-gruppe" aria-labelledby={`${id}-titel`}>
      <header className="as-karte-kopf">
        <span className="as-code" aria-hidden="true">{g.nummer}</span>
        <h3 id={`${id}-titel`} className="ui-sr">Gruppe {g.nummer}: {titel}</h3>
        <input type="text" className="as-gruppe-name" aria-label={`Bezeichnung Gruppe ${g.nummer}`} value={g.bezeichnung} maxLength={200}
          placeholder={`Gruppe ${g.nummer}, z. B. HK Restaurant`} onChange={(e) => dispatch({ typ: "gruppeName", schluessel: g.schluessel, bezeichnung: e.target.value })} />
      </header>

      <fieldset className="as-arten">
        <legend className="as-label">Art</legend>
        {GRUPPEN_ARTEN.map((art) => (
          <label key={art} className="as-kachel as-kachel-zeile">
            <input type="radio" name={`${id}-art`} value={art} checked={g.art === art} onChange={() => dispatch({ typ: "gruppeArt", schluessel: g.schluessel, art })} />
            <span className="as-kachel-inhalt">
              <span className="as-kachel-name">{GRUPPEN_ART_TEXT[art].name}</span>
              <span className="as-kachel-text">{GRUPPEN_ART_TEXT[art].text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="as-bestueckung" role="group" aria-label={`Bestückung ${titel}`}>
        <span className="as-label">Bestückung</span>
        {bestueckungVon(z, g.schluessel).map((b) => {
          const name = teilName(b.katalogId, katalog);
          return (
            <div key={b.katalogId} className="as-bestueckung-zeile">
              <span className={b.menge ? "" : "as-gedimmt"}>{name}</span>
              {b.vorgeschlagen && <span className="as-badge">Vorschlag</span>}
              <span className="as-bestueckung-zahl">
                <button type="button" className="as-rundknopf" aria-label={`${name} weniger`} disabled={b.menge === 0}
                  onClick={() => dispatch({ typ: "bestueckung", gruppe: g.schluessel, katalogId: b.katalogId, delta: -1 })}><Minus size={14} strokeWidth={1.75} aria-hidden /></button>
                <output aria-label={`${name} Anzahl`}>{b.menge}</output>
                <button type="button" className="as-rundknopf" aria-label={`${name} mehr`}
                  onClick={() => dispatch({ typ: "bestueckung", gruppe: g.schluessel, katalogId: b.katalogId, delta: 1 })}><Plus size={14} strokeWidth={1.75} aria-hidden /></button>
              </span>
            </div>
          );
        })}
        <Schalter label="Wärmezähler in der Gruppe" an={wmz} onAn={(an) => dispatch({ typ: "gruppeWmz", gruppe: g.schluessel, an })} />
      </div>

      <fieldset className="as-verbraucher">
        <legend className="as-label">Verbraucher <span className="as-zahl">{g.verbraucher.length} gewählt</span></legend>
        {kandidaten.length === 0 && <p className="as-leer">Noch keine Abgaben erfasst (Schritt 3).</p>}
        {kandidaten.map((k) => (
          <div key={k.geschoss} className="as-verbraucher-geschoss">
            <span className="as-code">{k.geschoss}</span>
            <ul className="as-liste-roh as-verbraucher-liste">
              {k.einheiten.flatMap(({ einheit, teile }) => teile.map((t) => {
                const andere = gruppeVonVerbraucher(z, t.schluessel);
                const fremd = andere && andere.schluessel !== g.schluessel ? andere : null;
                const name = unter.has(t.schluessel) ? "Unterverteiler" : teilName(t.katalogId, katalog);
                return (
                  <li key={t.schluessel}>
                    <label className="as-check as-verbraucher-eintrag">
                      <input type="checkbox" checked={g.verbraucher.includes(t.schluessel)}
                        onChange={(e) => dispatch({ typ: "verbraucher", gruppe: g.schluessel, bauteil: t.schluessel, an: e.target.checked })} />
                      <span className="as-verbraucher-text">
                        <span>{einheit.bezeichnung}</span>
                        <span className="as-zahl">{name}{t.hersteller ? ` · ${t.hersteller}` : ""}{t.menge !== null ? ` · ${t.menge}` : ""}</span>
                      </span>
                      {fremd && <span className="as-badge as-badge-leise">in «{fremd.bezeichnung || `Gruppe ${fremd.nummer}`}»</span>}
                      {!fremd && !unter.has(t.schluessel) && uv.has(einheit.schluessel) && !g.verbraucher.includes(t.schluessel) && <span className="as-badge as-badge-leise">über Unterverteiler</span>}
                    </label>
                  </li>
                );
              }))}
            </ul>
          </div>
        ))}
      </fieldset>
    </section>
  );
}

export function Schritt5Gruppen({ z, dispatch, katalog }: SchrittInhaltProps) {
  const h = hauptverteiler(z);
  const gruppen = h ? z.gruppen.filter((g) => g.verteiler === h.schluessel).sort((a, b) => a.nummer - b.nummer) : [];
  const ort = h ? einheitVon(z, h)?.bezeichnung : null;
  return <>
    <Abschnitt titel="Heizgruppen" zusatz={ort ? `Hauptverteiler in ${ort}` : "Der Hauptverteiler entsteht im Raum der Zentrale."}>
      <Zaehler label="Anzahl Gruppen" wert={gruppen.length} min={0} max={30} onWert={(n) => dispatch({ typ: "gruppenAnzahl", anzahl: n })}
        beschreibung="Eine Gruppe ist ein eigener Abgang am Verteiler, z. B. «HK Büro» oder «FBH Wohnungen»." />
    </Abschnitt>
    {gruppen.length === 0 && <Hinweis>Lege mindestens eine Gruppe an und teile ihr die Verbraucher zu.</Hinweis>}
    {gruppen.map((g) => <GruppenKarte key={g.schluessel} g={g} z={z} dispatch={dispatch} katalog={katalog} />)}
  </>;
}
