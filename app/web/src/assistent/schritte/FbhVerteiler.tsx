import { K } from "../bestueckung";
import { einheitVon, fbhSpeisung, gruppeVonVerbraucher, hauptverteiler, unterverteiler, unterverteilerVorschlaege, type ZBauteil } from "../zustand";
import { Abschnitt, Schalter } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

const wmzVor = (z: SchrittInhaltProps["z"], t: ZBauteil) =>
  z.bauteile.some((x) => x.katalogId === K.wmz && x.ort && "vorBauteil" in x.ort && x.ort.vorBauteil === t.schluessel);

function Speisung({ t, z, dispatch }: { t: ZBauteil } & Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const h = hauptverteiler(z);
  const gruppen = h ? z.gruppen.filter((g) => g.verteiler === h.schluessel).sort((a, b) => a.nummer - b.nummer) : [];
  const aktuell = gruppeVonVerbraucher(z, t.schluessel);
  const name = einheitVon(z, t)?.bezeichnung ?? "FBH-Verteiler";
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

export function FbhVerteiler({ z, dispatch }: Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const uv = unterverteiler(z);
  const vorschlaege = unterverteilerVorschlaege(z);
  const alleWmz = uv.length > 0 && uv.every((t) => wmzVor(z, t));
  const satz = uv.length === 0 ? "Keine Einheit mit Fussbodenheizung erfasst."
    : `${uv.length} FBH-Verteiler${uv.some((t) => t.auto) ? ", automatisch" : ""} ${fbhSpeisung(z).map((s) => s.gruppe ? `an «${s.gruppe.bezeichnung || `Gruppe ${s.gruppe.nummer}`}»` : `${s.anzahl} ohne Gruppe`).join(", ")}.`;
  const imVorschlag = new Set(vorschlaege.map((e) => e.schluessel));
  const weitere = uv.filter((t) => !("einheit" in t.standort && imVorschlag.has(t.standort.einheit)));
  const eintraege = [
    ...vorschlaege.map((e) => ({ e, t: uv.find((x) => "einheit" in x.standort && x.standort.einheit === e.schluessel) })),
    ...weitere.flatMap((t) => { const e = einheitVon(z, t); return e ? [{ e, t }] : []; }),
  ];
  return (
    <Abschnitt titel="FBH-Verteiler" zusatz="Je Einheit mit Fussbodenheizung, per Leitung an ihrer Gruppe in der Zentrale.">
      <div className="as-fbh-kopf">
        <p className="as-satz">{satz}</p>
        {uv.length > 0 && <Schalter label="Wärmezähler an allen FBH-Verteilern" an={alleWmz} onAn={(an) => dispatch({ typ: "fbhWmzAlle", an })} />}
      </div>
      {eintraege.length > 0 && <details className="as-aufklapp">
        <summary>Ausnahmen je Einheit ({eintraege.length})</summary>
        <div className="as-fbh-liste">
          {eintraege.map(({ e, t }) => (
            <div key={e.schluessel} className="as-karte as-uv">
              <div className="as-uv-kopf">
                <span className="as-code">{e.geschoss}</span>
                <Schalter label={`FBH-Verteiler in ${e.bezeichnung}`} an={!!t} onAn={(an) => dispatch({ typ: "unterverteiler", einheit: e.schluessel, an })} />
              </div>
              {t && <div className="as-uv-details">
                <Speisung t={t} z={z} dispatch={dispatch} />
                <Schalter label="Wärmezähler" name={`${e.bezeichnung}: Wärmezähler am FBH-Verteiler`} an={wmzVor(z, t)}
                  onAn={(an) => dispatch({ typ: "unterverteilerWmz", verteiler: t.schluessel, an })} />
              </div>}
            </div>
          ))}
        </div>
      </details>}
    </Abschnitt>
  );
}
