import { Plus, Trash2 } from "lucide-react";
import type { Dreiwertig } from "../../typen";
import { ABGABE_VON, ERLAUBT, HEIZ_ARTEN, HEIZ_NAME, abgabenVon, artName, wirksam, type ZBauteil } from "../zustand";
import { teilName } from "../bestueckung";
import { Abschnitt, Hinweis, ICON, Segment } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";
import { geschosseAbsteigend } from "./Schritt2Einheiten";

const DREI: readonly { wert: Dreiwertig; text: string }[] = [
  { wert: "ja", text: "Ja" }, { wert: "nein", text: "Nein" }, { wert: "unbekannt", text: "Weiss nicht" },
];
const DREI_TEXT: Record<Dreiwertig, string> = { ja: "Ja", nein: "Nein", unbekannt: "Weiss nicht" };

function AbgabeZeile({ t, dispatch, katalog }: { t: ZBauteil } & Pick<SchrittInhaltProps, "dispatch" | "katalog">) {
  const name = teilName(t.katalogId, katalog);
  const weissNicht = t.menge === null;
  return (
    <li className="as-zeile as-zeile-abgabe">
      <span className="as-badge as-badge-heizung">{name}</span>
      <input type="text" aria-label={`${name}: Hersteller`} placeholder="Hersteller" value={t.hersteller ?? ""} maxLength={200}
        onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, hersteller: e.target.value })} />
      <input type="text" aria-label={`${name}: Typ`} placeholder="Typ" value={t.typ ?? ""} maxLength={200}
        onChange={(e) => dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, geraetTyp: e.target.value })} />
      <input type="number" aria-label={`${name}: Menge`} placeholder="Menge" min={0} value={t.menge ?? ""}
        onChange={(e) => e.target.value === "" ? dispatch({ typ: "abgabeWeissNicht", schluessel: t.schluessel })
          : dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, menge: Number(e.target.value) })} />
      <label className="as-check">
        <input type="checkbox" checked={weissNicht} onChange={(e) => e.target.checked
          ? dispatch({ typ: "abgabeWeissNicht", schluessel: t.schluessel })
          : dispatch({ typ: "abgabeAendern", schluessel: t.schluessel, menge: 1 })} />
        <span>Weiss nicht</span>
      </label>
      <button type="button" className="as-rundknopf" aria-label={`${name} entfernen`} onClick={() => dispatch({ typ: "bauteilLoeschen", schluessel: t.schluessel })}><Trash2 {...ICON} /></button>
    </li>
  );
}

export function Schritt3Abgaben({ z, dispatch, katalog }: SchrittInhaltProps) {
  return <>
    <Abschnitt titel="Gebäudestandard" zusatz="Gilt für alle Einheiten, ausser bei Ausnahmen.">
      <div className="as-raster-standard">
        {HEIZ_ARTEN.map((art) => (
          <div key={art} className="as-standard-zeile">
            <span className="as-label">{HEIZ_NAME[art]}</span>
            <Segment name={`as-standard-${art}`} label={HEIZ_NAME[art]} wert={z.heizungStandard[art]} optionen={DREI}
              onWert={(wert) => dispatch({ typ: "standard", art, wert })} />
          </div>
        ))}
      </div>
    </Abschnitt>
    {z.einheiten.length === 0 && <Hinweis art="warnung">Noch keine Einheiten erfasst. Lege sie in Schritt 2 an.</Hinweis>}
    {geschosseAbsteigend(z).map((g) => {
      const einheiten = z.einheiten.filter((e) => e.geschoss === g.code);
      if (einheiten.length === 0) return null;
      return (
        <Abschnitt key={g.code} titel={`Geschoss ${g.code}`}>
          {einheiten.map((e) => {
            const w = wirksam(z, e);
            const abgaben = abgabenVon(z, e.schluessel);
            const erlaubt = ERLAUBT[e.art] ?? [];
            return (
              <section key={e.schluessel} className="as-karte" aria-label={e.bezeichnung}>
                <header className="as-karte-kopf">
                  <h3>{e.bezeichnung}</h3>
                  <span className="as-zahl">{artName(e.art)}</span>
                </header>
                <div className="as-ausnahmen">
                  {HEIZ_ARTEN.filter((art) => erlaubt.includes(ABGABE_VON[art])).map((art) => (
                    <label key={art} className="as-ausnahme">
                      <span>{HEIZ_NAME[art]}</span>
                      <select value={e.ausnahme[art] ?? ""} onChange={(ev) => dispatch({ typ: "ausnahme", einheit: e.schluessel, art, wert: (ev.target.value || null) as Dreiwertig | null })}>
                        <option value="">Standard ({DREI_TEXT[z.heizungStandard[art]]})</option>
                        {DREI.map((d) => <option key={d.wert} value={d.wert}>{d.text}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {abgaben.length > 0 && <ul className="as-zeilen as-liste-roh">
                  {abgaben.map((t) => <AbgabeZeile key={t.schluessel} t={t} dispatch={dispatch} katalog={katalog} />)}
                </ul>}
                {e.art !== "technik" && abgaben.length === 0 && HEIZ_ARTEN.every((art) => w[art] !== "ja") &&
                  <p className="as-leer">Keine Abgaben vorgesehen.</p>}
                <div className="as-chips">
                  {HEIZ_ARTEN.filter((art) => w[art] !== "nein" && erlaubt.includes(ABGABE_VON[art])).map((art) => (
                    <button key={art} type="button" className="as-textknopf" onClick={() => dispatch({ typ: "abgabeNeu", einheit: e.schluessel, katalogId: ABGABE_VON[art] })}>
                      <Plus size={14} strokeWidth={1.75} aria-hidden />{teilName(ABGABE_VON[art], katalog)}</button>
                  ))}
                </div>
              </section>
            );
          })}
        </Abschnitt>
      );
    })}
  </>;
}
