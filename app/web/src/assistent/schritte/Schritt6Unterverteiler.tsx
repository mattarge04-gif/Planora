import { K } from "../bestueckung";
import { einheitVon, gruppeVonVerbraucher, hauptverteiler, unterverteiler, unterverteilerVorschlaege, type ZBauteil } from "../zustand";
import { Abschnitt, Hinweis, Schalter } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

function Speisung({ t, z, dispatch }: { t: ZBauteil } & Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const h = hauptverteiler(z);
  const gruppen = h ? z.gruppen.filter((g) => g.verteiler === h.schluessel).sort((a, b) => a.nummer - b.nummer) : [];
  const aktuell = gruppeVonVerbraucher(z, t.schluessel);
  const name = einheitVon(z, t)?.bezeichnung ?? "Unterverteiler";
  return (
    <label className="as-ausnahme as-speisung">
      <span>Gespeist von</span>
      <select value={aktuell?.schluessel ?? ""} aria-label={`${name}: gespeist von Gruppe`} onChange={(e) => {
        if (e.target.value) dispatch({ typ: "verbraucher", gruppe: e.target.value, bauteil: t.schluessel, an: true });
        else if (aktuell) dispatch({ typ: "verbraucher", gruppe: aktuell.schluessel, bauteil: t.schluessel, an: false });
      }}>
        <option value="">Keine Gruppe</option>
        {gruppen.map((g) => <option key={g.schluessel} value={g.schluessel}>{g.nummer} · {g.bezeichnung || `Gruppe ${g.nummer}`}</option>)}
      </select>
    </label>
  );
}

function wmzVor(z: SchrittInhaltProps["z"], t: ZBauteil) {
  return z.bauteile.some((x) => x.katalogId === K.wmz && x.ort && "vorBauteil" in x.ort && x.ort.vorBauteil === t.schluessel);
}

export function Schritt6Unterverteiler({ z, dispatch }: SchrittInhaltProps) {
  const vorschlaege = unterverteilerVorschlaege(z);
  const uv = unterverteiler(z);
  const inVorschlag = new Set(vorschlaege.map((e) => e.schluessel));
  const weitere = uv.filter((t) => !("einheit" in t.standort && inVorschlag.has(t.standort.einheit)));
  return <>
    <Hinweis>Einheiten mit Fussbodenheizung haben oft einen eigenen FBH-Verteiler. Er versorgt die Kreise der Einheit und wird von einer Gruppe gespeist.</Hinweis>
    <Abschnitt titel="FBH-Verteiler je Einheit" zusatz={vorschlaege.length ? `${vorschlaege.length} Vorschläge` : undefined}>
      {vorschlaege.length === 0 && <p className="as-leer">Keine Einheit mit Fussbodenheizung erfasst.</p>}
      {vorschlaege.map((e) => {
        const t = uv.find((x) => "einheit" in x.standort && x.standort.einheit === e.schluessel);
        return (
          <div key={e.schluessel} className="as-karte as-uv">
            <div className="as-uv-kopf">
              <span className="as-code">{e.geschoss}</span>
              <Schalter label={`FBH-Verteiler in ${e.bezeichnung}`} an={!!t} onAn={(an) => dispatch({ typ: "unterverteiler", einheit: e.schluessel, an })} />
            </div>
            {t && <div className="as-uv-details">
              <Speisung t={t} z={z} dispatch={dispatch} />
              <Schalter label="Wärmezähler" an={wmzVor(z, t)} onAn={(an) => dispatch({ typ: "unterverteilerWmz", verteiler: t.schluessel, an })} />
            </div>}
          </div>
        );
      })}
    </Abschnitt>
    {weitere.length > 0 && <Abschnitt titel="Weitere Unterverteiler">
      {weitere.map((t) => {
        const e = einheitVon(z, t);
        const versorgt = t.versorgt.map((s) => z.einheiten.find((x) => x.schluessel === s)?.bezeichnung).filter(Boolean);
        return (
          <div key={t.schluessel} className="as-karte as-uv as-uv-weitere">
            <div className="as-uv-kopf">
              <span className="as-code">{e?.geschoss ?? "–"}</span>
              <strong className="as-uv-name">Verteiler in {e?.bezeichnung ?? "Geschoss"}</strong>
              {versorgt.length > 0 && <span className="as-zahl">versorgt {versorgt.join(", ")}</span>}
            </div>
            <div className="as-uv-details">
              <Speisung t={t} z={z} dispatch={dispatch} />
              <Schalter label="Wärmezähler" an={wmzVor(z, t)} onAn={(an) => dispatch({ typ: "unterverteilerWmz", verteiler: t.schluessel, an })} />
            </div>
          </div>
        );
      })}
    </Abschnitt>}
  </>;
}
