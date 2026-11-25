import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { zeigeInKarte } from "./kartenScroll";
import { ApiFehler, fehlerCode } from "../api";
import { geaendert, geltungText, ladeDatenblatt, speichereDatenblatt, werteAusEingabe, wertText, type DatenblattAntwort } from "../bestand/datenblatt";
import { ablageFehlerText } from "../dokumente/ansicht";
import type { KatalogEintrag } from "../typen";

interface Props { bauteilIds: string[]; katalog: KatalogEintrag[]; onAbgelaufen?: () => void }

// Abweichende Felder starten leer (Platzhalter "unterschiedlich") und bleiben unverändert, solange niemand etwas einträgt.
const eingabeAus = (d: DatenblattAntwort) => Object.fromEntries(d.felder.map((f) => [f.schluessel,
  d.abweichend.includes(f.schluessel) || d.werte[f.schluessel] === undefined ? "" : String(d.werte[f.schluessel])]));

/** Abschnitt "Datenblatt" der Anlagenkarte: Felder des Typs (Katalog), Handeingabe mit Schreibrecht, Quelle des Lebensdauer-Richtwerts. */
export function TwinDatenblatt({ bauteilIds, katalog, onAbgelaufen }: Props) {
  const uid = useId();
  const [d, setD] = useState<DatenblattAntwort | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);
  const [eingabe, setEingabe] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState<Record<string, string>>({});
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const erstes = bauteilIds[0];
  const gruppe = bauteilIds.join(",");
  const block = useRef<HTMLDivElement>(null);
  // Bearbeiten: Abschnitt oben im Scrollbereich der Karte, erstes Feld fokussieren ohne den Browser scrollen zu lassen.
  useEffect(() => {
    if (!offen) return;
    zeigeInKarte(block.current);
    block.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [offen]);
  useEffect(() => {
    if (!erstes) return;
    let aktiv = true;
    setD(null); setLadeFehler(null); setOffen(false);
    ladeDatenblatt(erstes, gruppe.split(",")).then((x) => { if (aktiv) setD(x); }, (e: unknown) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen?.();
      else setLadeFehler(ablageFehlerText(fehlerCode(e), e instanceof ApiFehler ? e.status : undefined, "Datenblatt konnte nicht geladen werden."));
    });
    return () => { aktiv = false; };
  }, [erstes, gruppe, onAbgelaufen]);

  const eintrag = katalog.find((k) => k.id === (d?.katalogId ?? ""));
  const quelle = eintrag?.lebensdauerQuelle;
  if (!d && !ladeFehler) return null;
  if (d && d.felder.length === 0 && !quelle) return null;

  const oeffnen = () => { if (!d) return; setEingabe(eingabeAus(d)); setFehler({}); setMeldung(null); setOffen(true); };
  async function speichern() {
    if (!d) return;
    const r = werteAusEingabe(d.felder, geaendert(eingabe, eingabeAus(d)));
    setFehler(r.fehler);
    if (Object.keys(r.fehler).length) {
      const k = d.felder.find((f) => r.fehler[f.schluessel]);
      if (k) document.getElementById(`${uid}-${k.schluessel}`)?.focus();
      return;
    }
    if (!Object.keys(r.werte).length) { setOffen(false); return; }
    setLaeuft(true); setMeldung(null);
    try { setD(await speichereDatenblatt(bauteilIds, r.werte)); setOffen(false); }
    catch (e) {
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen?.();
      else setMeldung(ablageFehlerText(fehlerCode(e), e instanceof ApiFehler ? e.status : undefined, "Speichern fehlgeschlagen."));
    } finally { setLaeuft(false); }
  }
  const taste = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOffen(false); } };
  const geltung = d ? geltungText(d) : null;

  return (
    <div ref={block} className="tw-objekt-block tw-datenblatt">
      <div className="tw-db-kopf">
        <h3>Datenblatt</h3>
        {d?.darfAendern && !offen && d.felder.length > 0 && <button type="button" className="tw-ld-knopf tw-db-bearbeiten" onClick={oeffnen}>Bearbeiten</button>}
      </div>
      {ladeFehler && <p className="tw-db-meldung" role="alert">{ladeFehler}</p>}
      {d && d.felder.length > 0 && (offen
        ? <form className="tw-db-form" onKeyDown={taste} onSubmit={(e) => { e.preventDefault(); void speichern(); }} noValidate aria-label="Datenblatt bearbeiten">
          {d.felder.map((f) => {
            const id = `${uid}-${f.schluessel}`;
            return <div key={f.schluessel} className="tw-db-feld">
              <label htmlFor={id}>{f.bezeichnung}</label>
              <span className={`tw-db-eingabe${f.einheit === "DN" ? " tw-db-vorne" : ""}`}>
                <input id={id} inputMode={f.art === "zahl" ? "decimal" : undefined} value={eingabe[f.schluessel] ?? ""}
                  placeholder={d.abweichend.includes(f.schluessel) ? "unterschiedlich" : undefined}
                  aria-invalid={fehler[f.schluessel] ? true : undefined} aria-describedby={fehler[f.schluessel] ? `${id}-f` : undefined}
                  onChange={(e) => setEingabe((a) => ({ ...a, [f.schluessel]: e.target.value }))} />
                {f.einheit && <span className="tw-db-einheit" aria-hidden="true">{f.einheit}</span>}
              </span>
              {fehler[f.schluessel] && <span id={`${id}-f`} className="tw-ld-fehler">{fehler[f.schluessel]}</span>}
            </div>;
          })}
          {geltung && <p className="tw-db-hinweis">{geltung}</p>}
          {meldung && <p className="tw-db-meldung" role="alert">{meldung}</p>}
          <div className="tw-ld-aktionen">
            <button type="submit" className="tw-ld-knopf tw-ld-knopf-haupt" disabled={laeuft}>{laeuft ? "Speichert …" : "Speichern"}</button>
            <button type="button" className="tw-ld-knopf tw-ld-knopf-leise" onClick={() => setOffen(false)}>Abbrechen</button>
          </div>
        </form>
        : <>
          <dl className="tw-zeilen tw-db-werte">{d.felder.map((f) => {
            const w = d.werte[f.schluessel];
            if (d.abweichend.includes(f.schluessel)) return <div key={f.schluessel}><dt>{f.bezeichnung}</dt><dd className="tw-db-leer">unterschiedlich</dd></div>;
            return <div key={f.schluessel}><dt>{f.bezeichnung}</dt><dd className={w === undefined ? "tw-db-leer" : undefined}>{w === undefined
              ? <span title="Nicht erfasst" aria-label="Nicht erfasst">–</span> : wertText(f, w)}</dd></div>;
          })}</dl>
          {geltung && <p className="tw-db-hinweis">{geltung}</p>}
        </>)}
      {quelle && <p className="tw-db-quelle">Lebensdauer-Richtwert in Anlehnung an {quelle.text} ({quelle.jahr})</p>}
    </div>
  );
}
