import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { KatalogEintrag } from "../../typen";
import { GRUPPEN_ARTEN, GRUPPEN_ART_TEXT, K, teilName } from "../bestueckung";
import {
  HEIZ_ARTEN, HEIZ_NAME, bestueckungVon, einheitVon, geschossRang, geschossVon, gruppeVonVerbraucher, hauptverteiler, unterverteiler,
  verbraucherDerArt, zubehoerVon, type AssistentZustand, type ZBauteil, type ZGruppe,
} from "../zustand";
import { Abschnitt, Hinweis, ICON, Schalter } from "./gemeinsam";
import { FbhVerteiler } from "./FbhVerteiler";
import type { SchrittInhaltProps } from "./index";

const teileVon = (z: AssistentZustand, g: ZGruppe): ZBauteil[] =>
  g.verbraucher.map((s) => z.bauteile.find((t) => t.schluessel === s)).filter((t): t is ZBauteil => !!t);
const geschosseVon = (z: AssistentZustand, teile: readonly ZBauteil[]): string[] =>
  [...new Set(teile.map((t) => geschossVon(z, t)).filter((c): c is string => !!c))].sort((a, b) => geschossRang(b) - geschossRang(a));

/** «12 Heizkörper in OG3, OG2» – Verbraucher je Bauteilart, Geschosse von oben. */
export function verbraucherSatz(z: AssistentZustand, g: ZGruppe, katalog?: readonly KatalogEintrag[] | null): string {
  const uv = new Set(unterverteiler(z).map((t) => t.schluessel));
  const teile = teileVon(z, g);
  if (teile.length === 0) return "Keine Verbraucher";
  const arten = new Map<string, number>();
  for (const t of teile) { const n = uv.has(t.schluessel) ? "FBH-Verteiler" : teilName(t.katalogId, katalog); arten.set(n, (arten.get(n) ?? 0) + 1); }
  return `${[...arten].map(([n, k]) => `${k} ${n}`).join(", ")} in ${geschosseVon(z, teile).join(", ")}`;
}

function GruppenKarte({ g, z, dispatch, katalog }: { g: ZGruppe } & Pick<SchrittInhaltProps, "z" | "dispatch" | "katalog">) {
  const [teilen, setTeilen] = useState<string[] | null>(null);
  const titel = g.bezeichnung || `Gruppe ${g.nummer}`;
  const wmz = zubehoerVon(z, g.schluessel).some((t) => t.katalogId === K.wmz);
  const uv = new Set(unterverteiler(z).map((t) => t.schluessel));
  const teile = teileVon(z, g);
  const codes = geschosseVon(z, teile);
  const einheiten = [...new Map(teile.map((t) => einheitVon(z, t)).filter((e) => !!e).map((e) => [e.schluessel, e])).values()]
    .sort((a, b) => geschossRang(b.geschoss) - geschossRang(a.geschoss) || a.bezeichnung.localeCompare(b.bezeichnung, "de-CH"));
  const kandidaten = g.regel ? verbraucherDerArt(z, g.regel.heizart) : HEIZ_ARTEN.flatMap((a) => verbraucherDerArt(z, a));
  const nachGeschoss = [...new Set(kandidaten.map((t) => geschossVon(z, t) ?? ""))].sort((a, b) => geschossRang(b) - geschossRang(a));
  const bestueckung = bestueckungVon(z, g.schluessel);
  const kurz = [...bestueckung.filter((b) => b.menge).map((b) => `${b.menge}× ${teilName(b.katalogId, katalog)}`), ...(wmz ? ["Wärmezähler"] : [])].join(", ") || "keine";
  return (
    <section className="as-karte as-gruppe" aria-label={`Gruppe ${g.nummer}: ${titel}`}>
      <header className="as-karte-kopf">
        <span className="as-code" aria-hidden="true">{g.nummer}</span>
        <input type="text" className="as-gruppe-name" aria-label={`Bezeichnung Gruppe ${g.nummer}`} value={g.bezeichnung} maxLength={200}
          placeholder={`Gruppe ${g.nummer}, z. B. HK Restaurant`}
          onChange={(e) => dispatch({ typ: "gruppeName", schluessel: g.schluessel, bezeichnung: e.target.value })} />
        {g.regel && !g.angefasst && <span className="as-badge">Vorschlag</span>}
        <button type="button" className="as-rundknopf" aria-label={`Gruppe ${titel} entfernen`} onClick={() => dispatch({ typ: "gruppeEntfernen", gruppe: g.schluessel })}><Trash2 {...ICON} /></button>
      </header>
      <p className="as-satz as-gruppe-satz">{verbraucherSatz(z, g, katalog)}</p>

      <div className="as-gruppe-felder">
        <label className="as-feld">
          <span className="as-label">Art</span>
          <select value={g.art} aria-label={`${titel}: Art der Gruppe`}
            onChange={(e) => dispatch({ typ: "gruppeArt", schluessel: g.schluessel, art: e.target.value as ZGruppe["art"] })}>
            {GRUPPEN_ARTEN.map((a) => <option key={a} value={a}>{GRUPPEN_ART_TEXT[a].name}</option>)}
          </select>
          <span className="as-hilfe">{GRUPPEN_ART_TEXT[g.art].text}</span>
        </label>
        {g.regel && einheiten.length > 1 && <label className="as-feld">
          <span className="as-label">Eigene Gruppe für</span>
          <select value="" aria-label={`${titel}: eigene Gruppe für Einheit`}
            onChange={(e) => e.target.value && dispatch({ typ: "sondergruppe", einheit: e.target.value, heizart: g.regel!.heizart })}>
            <option value="">Einheit wählen …</option>
            {einheiten.map((e) => <option key={e.schluessel} value={e.schluessel}>{e.geschoss} · {e.bezeichnung}</option>)}
          </select>
          <span className="as-hilfe">Zum Beispiel ein Restaurant mit eigenem Abgang.</span>
        </label>}
      </div>

      {g.regel && !g.angefasst && codes.length > 1 && (teilen === null
        ? <div><button type="button" className="as-textknopf as-textknopf-rand" aria-label={`${titel}: nach Geschossen teilen`} onClick={() => setTeilen([])}>Nach Geschossen teilen</button></div>
        : <div className="as-teilen" role="group" aria-label={`${titel}: nach Geschossen teilen`}>
          <span className="as-label">Geschosse für die neue Gruppe</span>
          <div className="as-geschoss-chips">
            {codes.map((c) => <button key={c} type="button" className="as-chip" aria-pressed={teilen.includes(c)}
              onClick={() => setTeilen(teilen.includes(c) ? teilen.filter((x) => x !== c) : [...teilen, c])}>{c}</button>)}
          </div>
          <div className="as-chips">
            <button type="button" className="as-knopf as-knopf-klein" disabled={teilen.length === 0 || teilen.length === codes.length}
              onClick={() => { dispatch({ typ: "gruppeTeilen", gruppe: g.schluessel, geschosse: teilen }); setTeilen(null); }}>Neue Gruppe</button>
            <button type="button" className="as-textknopf" onClick={() => setTeilen(null)}>Abbrechen</button>
          </div>
        </div>)}

      <div className="as-gruppe-aufklapp">
        <details className="as-aufklapp">
          <summary>Bestückung: {kurz}</summary>
          <div className="as-bestueckung" role="group" aria-label={`Bestückung ${titel}`}>
            {bestueckung.map((b) => {
              const name = teilName(b.katalogId, katalog);
              return (
                <div key={b.katalogId} className="as-bestueckung-zeile">
                  <span className={b.menge ? "" : "as-gedimmt"}>{name}</span>
                  {b.vorgeschlagen && <span className="as-badge">Vorschlag</span>}
                  <span className="as-bestueckung-zahl">
                    <button type="button" className="as-rundknopf" aria-label={`${titel}: ${name} weniger`} disabled={b.menge === 0}
                      onClick={() => dispatch({ typ: "bestueckung", gruppe: g.schluessel, katalogId: b.katalogId, delta: -1 })}><Minus size={14} strokeWidth={1.75} aria-hidden /></button>
                    <output aria-label={`${titel}: ${name} Anzahl`}>{b.menge}</output>
                    <button type="button" className="as-rundknopf" aria-label={`${titel}: ${name} mehr`}
                      onClick={() => dispatch({ typ: "bestueckung", gruppe: g.schluessel, katalogId: b.katalogId, delta: 1 })}><Plus size={14} strokeWidth={1.75} aria-hidden /></button>
                  </span>
                </div>
              );
            })}
            <Schalter label="Wärmezähler in der Gruppe" name={`${titel}: Wärmezähler in der Gruppe`} an={wmz}
              onAn={(an) => dispatch({ typ: "gruppeWmz", gruppe: g.schluessel, an })} />
          </div>
        </details>

        <details className="as-aufklapp">
          <summary>Einzelne Verbraucher ({g.verbraucher.length})</summary>
          <div className="as-verbraucher-geschosse">
            {nachGeschoss.map((code) => {
              const hier = kandidaten.filter((t) => (geschossVon(z, t) ?? "") === code);
              const drin = hier.filter((t) => g.verbraucher.includes(t.schluessel)).length;
              return (
                <details key={code} className="as-aufklapp as-verbraucher-geschoss">
                  <summary><span className="as-code">{code || "–"}</span><span className="as-zahl">{drin} von {hier.length}</span></summary>
                  <ul className="as-liste-roh as-verbraucher-liste">
                    {hier.map((t) => {
                      const andere = gruppeVonVerbraucher(z, t.schluessel);
                      const fremd = andere && andere.schluessel !== g.schluessel ? andere : null;
                      const einheit = einheitVon(z, t)?.bezeichnung ?? code;
                      const teil = uv.has(t.schluessel) ? "FBH-Verteiler" : teilName(t.katalogId, katalog);
                      return (
                        <li key={t.schluessel}>
                          <label className="as-check as-verbraucher-eintrag">
                            <input type="checkbox" checked={g.verbraucher.includes(t.schluessel)} aria-label={`${einheit}, ${teil} in ${titel}`}
                              onChange={(e) => dispatch({ typ: "verbraucher", gruppe: g.schluessel, bauteil: t.schluessel, an: e.target.checked })} />
                            <span className="as-verbraucher-text">
                              <span>{einheit}</span>
                              <span className="as-zahl">{teil}{t.menge !== null ? ` · ${t.menge}` : ""}</span>
                            </span>
                            {fremd && <span className="as-badge as-badge-leise">in «{fremd.bezeichnung || `Gruppe ${fremd.nummer}`}»</span>}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              );
            })}
          </div>
        </details>
      </div>
    </section>
  );
}

export function Schritt5Gruppen({ z, dispatch, katalog }: SchrittInhaltProps) {
  const h = hauptverteiler(z);
  const gruppen = h ? z.gruppen.filter((g) => g.verteiler === h.schluessel).sort((a, b) => a.nummer - b.nummer) : [];
  const ort = h ? einheitVon(z, h)?.bezeichnung : null;
  const ohneGruppe = HEIZ_ARTEN.filter((a) => verbraucherDerArt(z, a).length > 0 && !verbraucherDerArt(z, a).some((t) => gruppeVonVerbraucher(z, t.schluessel)));
  return <>
    <Abschnitt titel="Heizgruppen" zusatz={ort ? `Hauptverteiler in ${ort}` : "Der Hauptverteiler entsteht im Raum der Zentrale."}
      aktion={<button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "gruppenAnzahl", anzahl: gruppen.length + 1 })}>
        <Plus size={14} strokeWidth={1.75} aria-hidden />Gruppe</button>}>
      {gruppen.length === 0 && <div className="as-chips">
        <Hinweis>Noch keine Gruppen. Planora schlägt je Heizart eine Gruppe vor.</Hinweis>
        <button type="button" className="as-knopf as-knopf-klein" onClick={() => dispatch({ typ: "gruppenVorschlagen" })}>Gruppen vorschlagen</button>
      </div>}
      {gruppen.length > 0 && ohneGruppe.map((art) => (
        <Hinweis key={art} art="warnung">Für {HEIZ_NAME[art]} gibt es noch keine Gruppe.{" "}
          <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "gruppeFuerArt", heizart: art })}>Gruppe anlegen</button></Hinweis>
      ))}
      {gruppen.map((g) => <GruppenKarte key={g.schluessel} g={g} z={z} dispatch={dispatch} katalog={katalog} />)}
    </Abschnitt>
    <FbhVerteiler z={z} dispatch={dispatch} />
  </>;
}
