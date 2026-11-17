import { K } from "../bestueckung";
import {
  einheitVon, fbhSpeisung, geschossRang, gruppeVonVerbraucher, hauptverteiler, unterverteiler, unterverteilerVorschlaege,
  type AssistentZustand, type ZBauteil, type ZEinheit, type ZGruppe,
} from "../zustand";
import { Abschnitt, Schalter } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

const wmzVor = (z: SchrittInhaltProps["z"], t: ZBauteil) =>
  z.bauteile.some((x) => x.katalogId === K.wmz && x.ort && "vorBauteil" in x.ort && x.ort.vorBauteil === t.schluessel);
const gruppenName = (g: ZGruppe) => g.bezeichnung || `Gruppe ${g.nummer}`;

/** «8 FBH-Verteiler, automatisch: 7 an «A», 1 an «B».» – mit Aufteilung, sobald mehr als eine Gruppe speist (B14). */
export function fbhSatz(z: AssistentZustand): string {
  const uv = unterverteiler(z);
  if (uv.length === 0) return "Keine Einheit mit Fussbodenheizung erfasst.";
  const teile = fbhSpeisung(z).sort((a, b) => b.anzahl - a.anzahl);
  const auto = uv.some((t) => t.auto) ? ", automatisch" : "";
  const ziel = (s: (typeof teile)[number]) => (s.gruppe ? `an «${gruppenName(s.gruppe)}»` : "ohne Gruppe");
  if (teile.length === 1) return `${uv.length} FBH-Verteiler${auto} ${ziel(teile[0])}.`;
  return `${uv.length} FBH-Verteiler${auto}: ${teile.map((s) => `${s.anzahl} ${ziel(s)}`).join(", ")}.`;
}

function Speisung({ t, z, dispatch, name }: { t: ZBauteil; name: string } & Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const h = hauptverteiler(z);
  const gruppen = h ? z.gruppen.filter((g) => g.verteiler === h.schluessel).sort((a, b) => a.nummer - b.nummer) : [];
  const aktuell = gruppeVonVerbraucher(z, t.schluessel);
  return (
    <select className="as-uv-speisung" value={aktuell?.schluessel ?? ""} aria-label={`${name}: gespeist von Gruppe`} onChange={(e) => {
      if (e.target.value) dispatch({ typ: "verbraucher", gruppe: e.target.value, bauteil: t.schluessel, an: true });
      else if (aktuell) dispatch({ typ: "verbraucher", gruppe: aktuell.schluessel, bauteil: t.schluessel, an: false });
    }}>
      <option value="">Keine Gruppe</option>
      {gruppen.map((g) => <option key={g.schluessel} value={g.schluessel}>{g.nummer} · {gruppenName(g)}</option>)}
    </select>
  );
}

export function FbhVerteiler({ z, dispatch }: Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const uv = unterverteiler(z);
  const vorschlaege = unterverteilerVorschlaege(z);
  const alleWmz = uv.length > 0 && uv.every((t) => wmzVor(z, t));
  const imVorschlag = new Set(vorschlaege.map((e) => e.schluessel));
  const weitere = uv.filter((t) => !("einheit" in t.standort && imVorschlag.has(t.standort.einheit)));
  const eintraege: { e: ZEinheit; t: ZBauteil | undefined }[] = [
    ...vorschlaege.map((e) => ({ e, t: uv.find((x) => "einheit" in x.standort && x.standort.einheit === e.schluessel) })),
    ...weitere.flatMap((t) => { const e = einheitVon(z, t); return e ? [{ e, t }] : []; }),
  ];
  // Häufigste Speisung gilt als Regel; abweichend ist, was davon, vom Wärmezähler-Standard oder vom Vorschlag abweicht.
  const haeufig = fbhSpeisung(z).sort((a, b) => b.anzahl - a.anzahl)[0]?.gruppe?.schluessel ?? null;
  const abweichend = ({ t }: (typeof eintraege)[number]) =>
    !t || wmzVor(z, t) !== z.fbhWmz || (gruppeVonVerbraucher(z, t.schluessel)?.schluessel ?? null) !== haeufig;
  const geschosse = [...new Set(eintraege.map(({ e }) => e.geschoss))].sort((a, b) => geschossRang(b) - geschossRang(a));
  return (
    <Abschnitt titel="FBH-Verteiler" zusatz="Je Einheit mit Fussbodenheizung, per Leitung an ihrer Gruppe in der Zentrale.">
      <div className="as-fbh-kopf">
        <p className="as-satz">{fbhSatz(z)}</p>
        {uv.length > 0 && <Schalter label="Wärmezähler an allen FBH-Verteilern" an={alleWmz} onAn={(an) => dispatch({ typ: "fbhWmzAlle", an })} />}
      </div>
      {eintraege.length > 0 && <details className="as-aufklapp">
        <summary>Ausnahmen je Einheit ({eintraege.length})</summary>
        <div className="as-verbraucher-geschosse">
          {geschosse.map((code) => {
            const hier = eintraege.filter(({ e }) => e.geschoss === code);
            const anders = hier.filter(abweichend).length;
            return (
              <details key={code} className="as-aufklapp as-verbraucher-geschoss" open={anders > 0}>
                <summary>
                  <span className="as-code">{code}</span>
                  <span className="as-zahl">{hier.length === 1 ? "1 FBH-Verteiler" : `${hier.length} FBH-Verteiler`}</span>
                  {anders > 0 && <span className="as-badge as-badge-leise">{anders} abweichend</span>}
                </summary>
                <div className="as-uv-tabelle" role="table" aria-label={`FBH-Verteiler in ${code}`}>
                  <div className="as-uv-zeile as-uv-kopfzeile" role="row">
                    <span role="columnheader">Einheit</span><span role="columnheader">Gespeist von</span><span role="columnheader">Wärmezähler</span>
                  </div>
                  {hier.map((x) => {
                    const { e, t } = x;
                    return (
                      <div key={e.schluessel} role="row" className={`as-uv-zeile${abweichend(x) ? " as-uv-abweichend" : ""}`}>
                        <span role="cell"><Schalter label={e.bezeichnung} name={`FBH-Verteiler in ${e.bezeichnung}`} an={!!t}
                          onAn={(an) => dispatch({ typ: "unterverteiler", einheit: e.schluessel, an })} /></span>
                        <span role="cell">{t ? <Speisung t={t} z={z} dispatch={dispatch} name={e.bezeichnung} /> : <span className="as-zahl">Kein Verteiler</span>}</span>
                        <span role="cell">{t && <Schalter label="" name={`${e.bezeichnung}: Wärmezähler am FBH-Verteiler`} an={wmzVor(z, t)}
                          onAn={(an) => dispatch({ typ: "unterverteilerWmz", verteiler: t.schluessel, an })} />}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </details>}
    </Abschnitt>
  );
}
