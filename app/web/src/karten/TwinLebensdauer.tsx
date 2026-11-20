import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { ApiFehler, ersetzeJson, holeJson } from "../api";
import { AMPEL_RANG, AMPEL_TEXT, ZUSTAND_TEXT, akteZeilen, preisEingabe, preisText, type AkteZeile } from "../lebensdauer/ansicht";
import { formularAus, koerperAus, type Formular } from "../lebensdauer/bearbeiten";
import type { LdStand, Zustand } from "../lebensdauer/typen";
import { AmpelZeichen } from "../ui/Ampel";

const ZUSTAENDE = Object.keys(ZUSTAND_TEXT) as Zustand[];
const FELDER: (keyof Formular)[] = ["baujahr", "zustand", "lebensdauer", "preis", "notiz"];
interface Props { stand: LdStand; bauteilIds: string[]; darfAendern: boolean; onGespeichert: (s: LdStand) => void }
interface Offen { id: string; start: keyof Formular }

/** Block "Lebensdauer" der Anlagenkarte: Ampel, Ersatzjahr, Kosten mit Quellen; Bearbeiten nur mit Recht. */
export function TwinLebensdauer({ stand, bauteilIds, darfAendern, onGespeichert }: Props) {
  const zeilen = akteZeilen(stand, bauteilIds);
  const [offen, setOffen] = useState<Offen | null>(null);
  // Nach Schliessen des Formulars (Esc, Abbrechen, Speichern) zurück auf "Bearbeiten" derselben Zeile.
  const knoepfe = useRef(new Map<string, HTMLButtonElement>());
  const [zurueck, setZurueck] = useState<string | null>(null);
  useEffect(() => {
    if (offen || !zurueck) return;
    knoepfe.current.get(zurueck)?.focus();
    setZurueck(null);
  }, [offen, zurueck]);
  if (!zeilen.length) return <></>;
  const schlecht = zeilen.reduce((x, z) => (AMPEL_RANG[z.ampel] > AMPEL_RANG[x] ? z.ampel : x), zeilen[0].ampel);
  const schliessen = (id: string) => { setOffen(null); setZurueck(id); };
  return (
    <div className="tw-objekt-block tw-lebensdauer">
      <div className="tw-ld-kopf">
        <h3>Lebensdauer</h3>
        <span className={`tw-ld-chip tw-ld-chip-${schlecht}`}><AmpelZeichen ampel={schlecht} groesse={13} />{AMPEL_TEXT[schlecht]}</span>
      </div>
      <ul className="tw-ld-liste">
        {zeilen.map((z) => (
          <li key={z.id} className="tw-ld-eintrag">
            <ZeileAnsicht z={z} mehrere={zeilen.length > 1} />
            {offen?.id === z.id
              ? <FormularBlock stand={stand} id={z.id} start={offen.start} onZu={() => schliessen(z.id)}
                  onGespeichert={(s) => { schliessen(z.id); onGespeichert(s); }} />
              : darfAendern && <div className="tw-ld-aktionen">
                  <button type="button" className="tw-ld-knopf" ref={(el) => { if (el) knoepfe.current.set(z.id, el); else knoepfe.current.delete(z.id); }}
                    onClick={() => setOffen({ id: z.id, start: "baujahr" })}>Bearbeiten</button>
                  {z.preis.fehlt && <button type="button" className="tw-ld-knopf tw-ld-knopf-leise" onClick={() => setOffen({ id: z.id, start: "preis" })}>Preis erfassen</button>}
                </div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ZeileAnsicht({ z, mehrere }: { z: AkteZeile; mehrere: boolean }) {
  const rest = z.restjahre === "–" ? null : z.restjahre === "fällig" ? "fällig" : `noch ${z.restjahre}`;
  return (
    <>
      <p className="tw-ld-ort">
        {mehrere && <AmpelZeichen ampel={z.ampel} groesse={12} alleine />}
        <span>{z.ort}</span><span className="tw-ld-menge">Menge {z.menge}</span>
      </p>
      <div className="tw-ld-werte">
        <div>
          <span className="tw-ld-wert">{z.ersatzjahr === "–" ? "–" : z.ersatzjahr}</span>
          <span className={`tw-ld-unter${rest === "fällig" ? " tw-ld-faellig" : ""}`}>{rest ?? "Ersatzjahr offen"}</span>
        </div>
        <div>
          <span className={`tw-ld-wert${z.preis.fehlt ? " tw-ld-wert-leer" : ""}`}>{z.preis.fehlt ? "–" : z.kosten}</span>
          <span className={`tw-ld-unter${z.preis.fehlt ? " tw-ld-fehlt" : ""}`}>{z.preis.fehlt ? "Preis fehlt" : "Kosten Ersatz"}</span>
        </div>
      </div>
      <dl className="tw-ld-quellen">
        <dt>Baujahr</dt><dd>{z.baujahr.wert}<span className="tw-ld-quelle">{z.baujahr.quelle}</span></dd>
        <dt>Lebensdauer</dt><dd>{z.lebensdauer.wert}<span className="tw-ld-quelle">{z.lebensdauer.quelle}</span></dd>
        {z.zustand && <><dt>Zustand</dt><dd>{z.zustand.text}{z.zustand.wirkung && <span className="tw-ld-quelle">{z.zustand.wirkung}</span>}</dd></>}
        <dt>Stückpreis</dt><dd>{z.preis.fehlt ? "–" : z.preis.wert}<span className={`tw-ld-quelle${z.preis.fehlt ? " tw-ld-fehlt" : ""}`}>{z.preis.quelle}</span></dd>
      </dl>
    </>
  );
}

function FormularBlock({ stand, id, start, onZu, onGespeichert }: { stand: LdStand; id: string; start: keyof Formular; onZu: () => void; onGespeichert: (s: LdStand) => void }) {
  const uid = useId();
  const [f, setF] = useState<Formular>(() => formularAus(stand, id));
  const [fehler, setFehler] = useState<Partial<Record<keyof Formular, string>>>({});
  const [meldung, setMeldung] = useState<string | null>(null);
  const [veraltet, setVeraltet] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const bz = stand.typen.find((t) => t.katalogId === stand.bauteile.find((b) => b.id === id)?.katalogId);
  const setze = (k: keyof Formular, v: string) => setF((alt) => ({ ...alt, [k]: v }));
  const url = `/api/lebensdauer/gebaeude/${stand.gebaeudeId}`;
  const feldId = (k: keyof Formular) => `${uid}-${k}`;
  useEffect(() => { document.getElementById(feldId(start))?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function speichern() {
    const r = koerperAus(stand, id, f);
    if ("fehler" in r) {
      setFehler(r.fehler);
      const erstes = FELDER.find((k) => r.fehler[k]);
      if (erstes) requestAnimationFrame(() => document.getElementById(feldId(erstes))?.focus());
      return;
    }
    setFehler({}); setMeldung(null); setLaeuft(true);
    try {
      onGespeichert(await ersetzeJson<LdStand>(url, r.body));
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 409) { setVeraltet(true); setMeldung("Daten wurden inzwischen geändert."); }
      else if (e instanceof ApiFehler && e.status === 403) setMeldung("Keine Berechtigung zum Ändern.");
      else setMeldung(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      setLaeuft(false);
    }
  }
  async function neuLaden() {
    try { onGespeichert(await holeJson<LdStand>(url)); } catch (e) { setMeldung(e instanceof Error ? e.message : "Laden fehlgeschlagen"); }
  }
  const taste = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onZu(); } };
  const feld = (k: keyof Formular, label: string, el: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactElement, breit = false) => (
    <div className={`tw-ld-feld${breit ? " tw-ld-feld-breit" : ""}`}>
      <label htmlFor={feldId(k)}>{label}</label>
      {el({ id: feldId(k), "aria-describedby": fehler[k] ? `${feldId(k)}-f` : undefined, "aria-invalid": fehler[k] ? true : undefined })}
      {fehler[k] && <span id={`${feldId(k)}-f`} className="tw-ld-fehler">{fehler[k]}</span>}
    </div>
  );
  return (
    <form className="tw-ld-form" onKeyDown={taste} onSubmit={(e) => { e.preventDefault(); void speichern(); }} noValidate aria-label="Lebensdauer bearbeiten">
      {feld("baujahr", "Baujahr", (p) =>
        <input {...p} inputMode="numeric" placeholder={stand.heizungBaujahr === null ? "Gebäudestandard fehlt" : `Standard ${stand.heizungBaujahr}`} value={f.baujahr} onChange={(e) => setze("baujahr", e.target.value)} />)}
      {feld("zustand", "Zustand", (p) =>
        <select {...p} value={f.zustand} onChange={(e) => setze("zustand", e.target.value)}>
          <option value="">Unbekannt</option>
          {ZUSTAENDE.map((z) => <option key={z} value={z}>{ZUSTAND_TEXT[z]}</option>)}
        </select>)}
      {feld("lebensdauer", "Lebensdauer", (p) =>
        <input {...p} inputMode="numeric" placeholder={bz ? `Richtwert ${bz.lMittel ?? bz.standard} J.` : undefined} aria-label="Lebensdauer in Jahren" value={f.lebensdauer} onChange={(e) => setze("lebensdauer", e.target.value)} />)}
      {feld("preis", "Stückpreis (CHF)", (p) =>
        <input {...p} inputMode="decimal" placeholder={bz?.stueckpreis != null ? `Typwert ${preisText(bz.stueckpreis)}` : "z. B. 1'200"} value={f.preis} onChange={(e) => setze("preis", e.target.value)} onBlur={(e) => setze("preis", preisEingabe(e.target.value))} />)}
      {feld("notiz", "Notiz", (p) =>
        <textarea {...p} rows={2} value={f.notiz} onChange={(e) => setze("notiz", e.target.value)} />, true)}
      <p className="tw-ld-hinweis">Leer lassen übernimmt Gebäudestandard und Typwerte.</p>
      {meldung && <p className="tw-ld-meldung" role="alert">{meldung}{veraltet && <> <button type="button" className="tw-ld-knopf tw-ld-knopf-leise" onClick={() => void neuLaden()}>Neu laden</button></>}</p>}
      <div className="tw-ld-aktionen">
        <button type="submit" className="tw-ld-knopf tw-ld-knopf-haupt" disabled={laeuft}>{laeuft ? "Speichert …" : "Speichern"}</button>
        <button type="button" className="tw-ld-knopf tw-ld-knopf-leise" onClick={onZu}>Abbrechen</button>
      </div>
    </form>
  );
}
