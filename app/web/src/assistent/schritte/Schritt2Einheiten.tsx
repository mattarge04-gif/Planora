import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EINHEIT_ARTEN, abweichungen, geschossRang, vorlageVonGeschoss, type AssistentZustand, type ZEinheit, type ZVorlage } from "../zustand";
import { Abschnitt, Hinweis, ICON, Zaehler } from "./gemeinsam";
import type { SchrittInhaltProps } from "./index";

export const ZAEHLBAR: readonly string[] = ["buero", "wohnung", "gastro", "allgemein", "kern", "technik"];
const MEHRZAHL = (art: string) => EINHEIT_ARTEN.find((a) => a.art === art)?.mehrzahl ?? art;
export const anzahlJeArt = (liste: readonly { art: string }[], art: string) => liste.filter((x) => x.art === art).length;
/** Geschosse von oben nach unten (wie ein Gebäudeschnitt). */
export const geschosseAbsteigend = (z: AssistentZustand) => [...z.gebaeude.geschosse].sort((a, b) => geschossRang(b.code) - geschossRang(a.code));

/** Zähler nur für vorhandene oder in dieser Sitzung geöffnete Nutzungen; der Rest wird als «+ Nutzung» angeboten. */
export function zaehlerAufteilen(liste: readonly { art: string }[], offen: ReadonlySet<string>): { zaehler: string[]; angebote: string[] } {
  const zaehler = ZAEHLBAR.filter((art) => offen.has(art) || anzahlJeArt(liste, art) > 0);
  return { zaehler, angebote: ZAEHLBAR.filter((art) => !zaehler.includes(art)) };
}

/** Nutzungszähler: nur gesetzte Nutzungen als −/+, weitere mit einem Klick über «+ Büros» usw. */
function Nutzungen({ liste, ort, label, angebot, onAnzahl }: {
  liste: readonly { art: string }[]; ort: string; label: (art: string) => string; angebot: string; onAnzahl: (art: string, n: number) => void;
}) {
  const [offen, setOffen] = useState<ReadonlySet<string>>(() => new Set());
  const [fokus, setFokus] = useState<string | null>(null);
  const rahmen = useRef<HTMLDivElement>(null);
  const { zaehler, angebote } = zaehlerAufteilen(liste, offen);
  useEffect(() => {
    if (!fokus) return;
    rahmen.current?.querySelector<HTMLInputElement>(`[data-art="${fokus}"] input`)?.focus();
    setFokus(null);
  }, [fokus]);
  const oeffnen = (art: string) => {
    setOffen((o) => new Set(o).add(art));
    if (anzahlJeArt(liste, art) === 0) onAnzahl(art, 1);
    setFokus(art);
  };
  return (
    <div className="as-nutzung-block" ref={rahmen}>
      {zaehler.length > 0 && <div className="as-nutzungen">
        {zaehler.map((art) => <div key={art} data-art={art}>
          <Zaehler label={label(art)} name={`${ort}: ${label(art)}`} wert={anzahlJeArt(liste, art)} min={0} max={50} onWert={(n) => onAnzahl(art, n)} />
        </div>)}
      </div>}
      {angebote.length > 0 && <div className="as-angebote" role="group" aria-label={`${angebot}, ${ort}`}>
        <span className="as-angebote-titel" aria-hidden="true"><Plus size={14} strokeWidth={1.75} aria-hidden />{angebot}</span>
        {angebote.map((art) => (
          <button key={art} type="button" className="as-textknopf" aria-label={`${label(art)} hinzufügen`} onClick={() => oeffnen(art)}>{MEHRZAHL(art)}</button>
        ))}
      </div>}
    </div>
  );
}

function EinheitZeilen({ einheiten, code, dispatch }: { einheiten: ZEinheit[]; code: string } & Pick<SchrittInhaltProps, "dispatch">) {
  return (
    <ul className="as-zeilen as-liste-roh">
      {einheiten.map((e, i) => (
        <li key={e.schluessel} className="as-zeile as-zeile-einheit">
          <input type="text" aria-label={`Bezeichnung Einheit ${i + 1}, ${code}`} value={e.bezeichnung} maxLength={200}
            onChange={(ev) => dispatch({ typ: "einheitAendern", schluessel: e.schluessel, bezeichnung: ev.target.value })} />
          <select aria-label={`Nutzung Einheit ${i + 1}, ${code}`} value={e.art} onChange={(ev) => dispatch({ typ: "einheitAendern", schluessel: e.schluessel, art: ev.target.value })}>
            {EINHEIT_ARTEN.map((a) => <option key={a.art} value={a.art}>{a.name}</option>)}
          </select>
          {(e.abweichend?.length ?? 0) > 0
            ? <button type="button" className="as-rundknopf" aria-label={`${e.bezeichnung} auf Regelgeschoss zurücksetzen`} title="Auf Regelgeschoss zurücksetzen"
                onClick={() => dispatch({ typ: "einheitZuruecksetzen", einheit: e.schluessel })}><RotateCcw {...ICON} /></button>
            : <span aria-hidden="true" />}
          <button type="button" className="as-rundknopf" aria-label={`${e.bezeichnung} entfernen`} onClick={() => dispatch({ typ: "einheitLoeschen", schluessel: e.schluessel })}><Trash2 {...ICON} /></button>
        </li>
      ))}
    </ul>
  );
}

function VorlageKarte({ v, z, dispatch }: { v: ZVorlage } & Pick<SchrittInhaltProps, "z" | "dispatch">) {
  const [loeschen, setLoeschen] = useState(false);
  const ab = abweichungen(z, v.schluessel);
  const anzahl = z.einheiten.filter((e) => e.vorlage?.schluessel === v.schluessel).length;
  return (
    <section className="as-karte as-vorlage" aria-label={`Regelgeschoss ${v.name}`}>
      <header className="as-karte-kopf">
        <input type="text" className="as-gruppe-name" aria-label="Name des Regelgeschosses" value={v.name} maxLength={200}
          onChange={(e) => dispatch({ typ: "vorlageName", vorlage: v.schluessel, name: e.target.value })} />
        {!loeschen && <button type="button" className="as-rundknopf" aria-label={`Regelgeschoss ${v.name} löschen`} onClick={() => setLoeschen(true)}><Trash2 {...ICON} /></button>}
      </header>
      {loeschen && <Hinweis art="warnung">
        Regelgeschoss löschen? Die Einheiten bleiben und werden eigenständig.{" "}
        <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "vorlageLoeschen", vorlage: v.schluessel })}>Löschen</button>{" "}
        <button type="button" className="as-textknopf" onClick={() => setLoeschen(false)}>Abbrechen</button>
      </Hinweis>}
      <div className="as-vorlage-teil">
        <span className="as-label">Einheiten je Geschoss</span>
        <Nutzungen liste={v.plaetze} ort={v.name} label={MEHRZAHL} angebot="Nutzung" onAnzahl={(art, n) => dispatch({ typ: "platzAnzahl", vorlage: v.schluessel, art, anzahl: n })} />
      </div>
      <div className="as-vorlage-teil">
        <span className="as-label" id={`gilt-${v.schluessel}`}>Gilt für</span>
        <div className="as-geschoss-chips" role="group" aria-labelledby={`gilt-${v.schluessel}`}>
          {geschosseAbsteigend(z).map((g) => {
            const an = v.geschosse.includes(g.code);
            return <button key={g.code} type="button" className="as-chip" aria-pressed={an}
              onClick={() => dispatch({ typ: "vorlageZuweisen", vorlage: v.schluessel, geschoss: g.code, an: !an })}>{g.code}</button>;
          })}
        </div>
      </div>
      {(anzahl > 0 || ab > 0) && <p className="as-leer">
        {anzahl > 0 && `${anzahl === 1 ? "1 Einheit" : `${anzahl} Einheiten`} in ${v.geschosse.length === 1 ? "1 Geschoss" : `${v.geschosse.length} Geschossen`}`}
        {anzahl > 0 && ab > 0 && " · "}
        {ab > 0 && `${ab === 1 ? "1 Abweichung" : `${ab} Abweichungen`} in einzelnen Geschossen`}
      </p>}
    </section>
  );
}

export function Schritt2Einheiten({ z, dispatch }: SchrittInhaltProps) {
  return <>
    <Hinweis>Gleiche Geschosse einmal als Regelgeschoss erfassen und zuweisen. Danach nur noch die Abweichungen ändern.</Hinweis>
    <Abschnitt titel="Regelgeschosse" aktion={
      <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "vorlageNeu" })}><Plus size={14} strokeWidth={1.75} aria-hidden />Regelgeschoss</button>}>
      {z.vorlagen.length === 0 && <p className="as-leer">Noch kein Regelgeschoss. Für Bürohäuser mit gleichen Obergeschossen spart es viele Eingaben.</p>}
      {z.vorlagen.map((v) => <VorlageKarte key={v.schluessel} v={v} z={z} dispatch={dispatch} />)}
    </Abschnitt>
    <Abschnitt titel="Geschosse">
      {geschosseAbsteigend(z).map((g) => {
        const einheiten = z.einheiten.filter((e) => e.geschoss === g.code);
        const v = vorlageVonGeschoss(z, g.code);
        const eigene = einheiten.filter((e) => !e.vorlage);
        const abweichend = v && (einheiten.some((e) => (e.abweichend?.length ?? 0) > 0) || v.ausgelassen.some((o) => o.geschoss === g.code));
        const anzahl = (art: string, n: number) => dispatch({ typ: "einheitAnzahl", geschoss: g.code, art, anzahl: n });
        return (
          <section key={g.code} className={`as-karte${v ? " as-karte-vorlage" : ""}`} aria-label={`Geschoss ${g.code}`}>
            <header className="as-karte-kopf">
              <span className="as-code">{g.code}</span>
              <span className="as-zahl">{einheiten.length === 1 ? "1 Einheit" : `${einheiten.length} Einheiten`}</span>
              {v && <span className="as-badge">wie {v.name}</span>}
              {abweichend && <span className="as-badge as-badge-leise">Abweichung</span>}
              <span className="as-abschnitt-aktion">
                {abweichend && <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "geschossZuruecksetzen", geschoss: g.code })}>Zurücksetzen</button>}
                {!v && einheiten.length > 0 && <button type="button" className="as-textknopf" onClick={() => dispatch({ typ: "vorlageNeu", ausGeschoss: g.code })}>Als Regelgeschoss</button>}
              </span>
            </header>
            {v ? (
              <details className="as-aufklapp">
                <summary>Einheiten anzeigen und abweichend ändern</summary>
                <div className="as-aufklapp-inhalt">
                  <EinheitZeilen einheiten={einheiten} code={g.code} dispatch={dispatch} />
                  <Nutzungen liste={eigene} ort={g.code} label={(art) => `Zusätzlich ${MEHRZAHL(art)}`} angebot="Zusätzlich" onAnzahl={anzahl} />
                </div>
              </details>
            ) : <>
              <Nutzungen liste={eigene} ort={g.code} label={MEHRZAHL} angebot="Nutzung" onAnzahl={anzahl} />
              {einheiten.length > 0 && <details className="as-aufklapp" open={einheiten.length <= 3}>
                <summary>Bezeichnungen ändern</summary>
                <EinheitZeilen einheiten={einheiten} code={g.code} dispatch={dispatch} />
              </details>}
            </>}
          </section>
        );
      })}
    </Abschnitt>
  </>;
}
