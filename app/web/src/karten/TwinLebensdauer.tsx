import { useId, useState, type KeyboardEvent, type ReactElement } from "react";
import { ApiFehler, ersetzeJson, holeJson } from "../api";
import { AMPEL_FARBE, AMPEL_TEXT, ZUSTAND_TEXT, akteZeilen, type AkteZeile } from "../lebensdauer/ansicht";
import { formularAus, koerperAus, type Formular } from "../lebensdauer/bearbeiten";
import type { Ampel, LdStand, Zustand } from "../lebensdauer/typen";

const RANG: Record<Ampel, number> = { rot: 3, gelb: 2, grau: 1, gruen: 0 };
const ZUSTAENDE = Object.keys(ZUSTAND_TEXT) as Zustand[];
interface Props { stand: LdStand; bauteilIds: string[]; darfAendern: boolean; onGespeichert: (s: LdStand) => void }

/** Block "Lebensdauer" der Anlagenkarte: Ampel, Ersatzjahr, Kosten mit Quellen; Bearbeiten nur mit Recht. */
export function TwinLebensdauer({ stand, bauteilIds, darfAendern, onGespeichert }: Props) {
  const zeilen = akteZeilen(stand, bauteilIds);
  const [offen, setOffen] = useState<string | null>(null);
  if (!zeilen.length) return <></>;
  const schlecht = zeilen.reduce((x, z) => (RANG[z.ampel] > RANG[x] ? z.ampel : x), zeilen[0].ampel);
  return (
    <div className="tw-objekt-block tw-lebensdauer">
      <h3 className="tw-ld-kopf">
        <span className="tw-ld-punkt" style={{ background: AMPEL_FARBE[schlecht] }} aria-hidden="true" />
        Lebensdauer <span className="tw-ld-status">{AMPEL_TEXT[schlecht]}</span>
      </h3>
      <ul className="tw-ld-liste">
        {zeilen.map((z) => (
          <li key={z.id}>
            <ZeileAnsicht z={z} />
            {darfAendern && offen !== z.id && <button type="button" className="tw-ld-knopf" onClick={() => setOffen(z.id)}>Bearbeiten</button>}
            {offen === z.id && <FormularBlock stand={stand} id={z.id} onZu={() => setOffen(null)}
              onGespeichert={(s) => { setOffen(null); onGespeichert(s); }} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ZeileAnsicht({ z }: { z: AkteZeile }) {
  return (
    <>
      <p className="tw-ld-zeile">
        <span className="tw-ld-punkt" style={{ background: AMPEL_FARBE[z.ampel] }} role="img" aria-label={AMPEL_TEXT[z.ampel]} />
        <strong>{z.ort}</strong> · Menge {z.menge}
      </p>
      <dl className="tw-zeilen">
        <div><dt>Ersatz</dt><dd>{z.ersatzjahr} ({z.restjahre})</dd></div>
        <div><dt>Kosten</dt><dd>{z.preis.fehlt ? <span className="tw-ld-fehlt">Preis fehlt</span> : z.kosten}</dd></div>
        <div><dt>Baujahr</dt><dd>{z.baujahr.wert} <small className="tw-ld-quelle">{z.baujahr.quelle}</small></dd></div>
        <div><dt>Lebensdauer</dt><dd>{z.lebensdauer.wert} <small className="tw-ld-quelle">{z.lebensdauer.quelle}</small></dd></div>
        <div><dt>Stückpreis</dt><dd>{z.preis.fehlt ? "–" : z.preis.wert} <small className="tw-ld-quelle">{z.preis.quelle}</small></dd></div>
      </dl>
    </>
  );
}

function FormularBlock({ stand, id, onZu, onGespeichert }: { stand: LdStand; id: string; onZu: () => void; onGespeichert: (s: LdStand) => void }) {
  const uid = useId();
  const [f, setF] = useState<Formular>(() => formularAus(stand, id));
  const [fehler, setFehler] = useState<Partial<Record<keyof Formular, string>>>({});
  const [meldung, setMeldung] = useState<string | null>(null);
  const [veraltet, setVeraltet] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const bz = stand.typen.find((t) => t.katalogId === stand.bauteile.find((b) => b.id === id)?.katalogId);
  const setze = (k: keyof Formular, v: string) => setF((alt) => ({ ...alt, [k]: v }));
  const url = `/api/lebensdauer/gebaeude/${stand.gebaeudeId}`;

  async function speichern() {
    const r = koerperAus(stand, id, f);
    if ("fehler" in r) { setFehler(r.fehler); return; }
    setFehler({}); setMeldung(null); setLaeuft(true);
    try {
      onGespeichert(await ersetzeJson<LdStand>(url, r.body));
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 409) { setVeraltet(true); setMeldung("Daten wurden inzwischen geändert. Neu laden."); }
      else if (e instanceof ApiFehler && e.status === 403) setMeldung("Keine Berechtigung");
      else setMeldung(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      setLaeuft(false);
    }
  }
  async function neuLaden() {
    try { onGespeichert(await holeJson<LdStand>(url)); } catch (e) { setMeldung(e instanceof Error ? e.message : "Laden fehlgeschlagen"); }
  }
  const taste = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onZu(); } };
  const feld = (k: keyof Formular, label: string, el: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactElement) => (
    <div className="tw-ld-feld">
      <label htmlFor={`${uid}-${k}`}>{label}</label>
      {el({ id: `${uid}-${k}`, "aria-describedby": fehler[k] ? `${uid}-${k}-f` : undefined, "aria-invalid": fehler[k] ? true : undefined })}
      {fehler[k] && <span id={`${uid}-${k}-f`} className="tw-ld-fehler" role="alert">{fehler[k]}</span>}
    </div>
  );
  return (
    <form className="tw-ld-form" onKeyDown={taste} onSubmit={(e) => { e.preventDefault(); void speichern(); }} noValidate>
      {feld("baujahr", "Baujahr (leer = Gebäudestandard)", (p) =>
        <input {...p} inputMode="numeric" value={f.baujahr} onChange={(e) => setze("baujahr", e.target.value)} autoFocus />)}
      {feld("zustand", "Zustand", (p) =>
        <select {...p} value={f.zustand} onChange={(e) => setze("zustand", e.target.value)}>
          <option value="">Unbekannt</option>
          {ZUSTAENDE.map((z) => <option key={z} value={z}>{ZUSTAND_TEXT[z]}</option>)}
        </select>)}
      {feld("lebensdauer", "Lebensdauer in Jahren", (p) =>
        <input {...p} inputMode="numeric" placeholder={bz ? `Richtwert ${bz.lMittel ?? bz.standard}` : undefined} value={f.lebensdauer} onChange={(e) => setze("lebensdauer", e.target.value)} />)}
      {feld("preis", "Stückpreis in CHF", (p) =>
        <input {...p} inputMode="decimal" value={f.preis} onChange={(e) => setze("preis", e.target.value)} />)}
      {feld("notiz", "Notiz", (p) =>
        <textarea {...p} rows={2} value={f.notiz} onChange={(e) => setze("notiz", e.target.value)} />)}
      {meldung && <p className="tw-ld-fehler" role="alert">{meldung}{veraltet && <> <button type="button" className="tw-ld-knopf" onClick={() => void neuLaden()}>Neu laden</button></>}</p>}
      <div className="tw-ld-aktionen">
        <button type="submit" className="tw-ld-knopf" disabled={laeuft}>Speichern</button>
        <button type="button" className="tw-ld-knopf" onClick={onZu}>Abbrechen</button>
      </div>
    </form>
  );
}
