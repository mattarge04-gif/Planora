import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ApiFehler, ersetzeJson, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import { anzeigeName } from "../dashboard";
import { AMPEL_FARBE, AMPEL_TEXT, balken, chf, planZeilen } from "../lebensdauer/ansicht";
import { baujahrKoerper, typKoerper, type TypAenderungen } from "../lebensdauer/typwerte";
import type { Ampel, LdStand } from "../lebensdauer/typen";
import type { Katalog } from "../typen";
import "./Erneuerungsplan.css";

const F = TOKENS.farbe;
const stil = {
  "--ep-grund": F.grund, "--ep-flaeche": F.flaeche, "--ep-flaeche-2": F.flaecheSekundaer, "--ep-grau-1": F.grau1, "--ep-grau-2": F.grau2,
  "--ep-text": F.text, "--ep-sekundaer": F.textSekundaer, "--ep-link": F.link, "--ep-link-hover": F.linkHover, "--ep-eis": F.eis, "--ep-akzent": F.eisAkzent,
  "--ep-warnung": F.statusWarnung, "--ep-stoerung": F.statusStoerung,
  "--ep-schrift": TOKENS.typografie.familie, "--ep-schatten": TOKENS.schatten.panel, "--ep-radius": `${TOKENS.radius.panelPx}px`,
} as CSSProperties;

const REIHENFOLGE: Ampel[] = ["rot", "gelb", "gruen", "grau"];
const MELDUNG_409 = "Daten wurden inzwischen geändert.";
const MELDUNG_404 = "Lebensdauer ist für diese Instanz nicht eingeschaltet.";

interface Props { gebaeudeId: string; name: string; onTwin: () => void; onAbgelaufen: () => void }

export function Erneuerungsplan({ gebaeudeId, name, onTwin, onAbgelaufen }: Props) {
  const [stand, setStand] = useState<LdStand | null>(null);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState(false);
  const [filter, setFilter] = useState<number | null>(null);
  const [baujahr, setBaujahr] = useState("");
  const [baujahrFehler, setBaujahrFehler] = useState<string | null>(null);
  const [typFeld, setTypFeld] = useState<TypAenderungen>({});
  const [typFehler, setTypFehler] = useState<Record<string, string>>({});
  const [laeuft, setLaeuft] = useState(false);

  const uebernehme = useCallback((s: LdStand) => {
    setStand(s); setBaujahr(s.heizungBaujahr === null ? "" : String(s.heizungBaujahr));
    setTypFeld(Object.fromEntries(s.typen.map((t) => [t.katalogId, { lMittel: t.lMittel === null ? "" : String(t.lMittel), preis: t.stueckpreis === null ? "" : String(t.stueckpreis) }])));
    setTypFehler({}); setBaujahrFehler(null);
  }, []);

  const laden = useCallback(() => {
    let aktiv = true;
    setFehler(null); setKonflikt(false);
    holeJson<LdStand>("/api/lebensdauer/gebaeude/" + gebaeudeId).then((s) => { if (aktiv) uebernehme(s); }, (e: Error) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else if (e instanceof ApiFehler && e.status === 404) setFehler(MELDUNG_404);
      else setFehler(e.message);
    });
    holeJson<Katalog>("/api/katalog/v2").then((k) => { if (aktiv) setKatalog(k); }, () => { /* Namen fallen auf Katalog-ID zurueck */ });
    return () => { aktiv = false; };
  }, [gebaeudeId, onAbgelaufen, uebernehme]);
  useEffect(() => laden(), [laden]);

  const nameVon = useCallback((id: string) => anzeigeName(id, katalog?.eintraege ?? []), [katalog]);
  const darf = stand?.darfAendern === true;
  const bal = useMemo(() => (stand ? balken(stand) : []), [stand]);
  const zeilen = useMemo(() => (stand ? planZeilen(stand, nameVon, filter) : []), [stand, nameVon, filter]);

  async function speichere(body: unknown, fehlerSetzen: (m: string) => void) {
    setLaeuft(true);
    try { uebernehme(await ersetzeJson<LdStand>("/api/lebensdauer/gebaeude/" + gebaeudeId, body)); }
    catch (e) {
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else if (e instanceof ApiFehler && e.status === 409) setKonflikt(true);
      else if (e instanceof ApiFehler && e.status === 404) setFehler(MELDUNG_404);
      else fehlerSetzen(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally { setLaeuft(false); }
  }
  const speichereBaujahr = () => {
    if (!stand) return;
    const k = baujahrKoerper(stand, baujahr);
    if ("fehler" in k) { setBaujahrFehler(k.fehler); return; }
    setBaujahrFehler(null); void speichere(k.body, setBaujahrFehler);
  };
  const speichereTypen = () => {
    if (!stand) return;
    const k = typKoerper(stand, typFeld);
    if ("fehler" in k) { setTypFehler(k.fehler); return; }
    setTypFehler({});
    if (k.body.typen.length === 0) return;
    void speichere(k.body, (m) => setTypFehler({ "": m }));
  };

  const l = stand?.ergebnis;
  return (
    <main className="ep" style={stil} aria-label="Erneuerungsplan">
      <header className="ep-kopf">
        <button type="button" className="ep-zurueck" onClick={onTwin}>← Zum Digital Twin</button>
        <h1>Erneuerungsplan <span>{name}</span></h1>
        {stand && <a className="ep-knopf" href={"/api/lebensdauer/gebaeude/" + gebaeudeId + "/export.csv"} download>CSV exportieren</a>}
      </header>

      {fehler && <p className="ep-meldung" role="alert">{fehler}</p>}
      {konflikt && <p className="ep-meldung" role="alert">{MELDUNG_409} <button type="button" className="ep-knopf" onClick={laden}>Neu laden</button></p>}
      {!stand && !fehler && <p className="ep-meldung" role="status">Erneuerungsplan wird geladen …</p>}

      {stand && l && <div className="ep-inhalt">
        <section className="ep-karte" aria-label="Baujahr Heizung">
          <label htmlFor="ep-baujahr">Baujahr Heizung (Gebäudestandard)</label>
          <div className="ep-zeile">
            <input id="ep-baujahr" inputMode="numeric" value={baujahr} disabled={!darf} onChange={(e) => setBaujahr(e.target.value)}
              aria-invalid={!!baujahrFehler} aria-describedby="ep-baujahr-hinweis" />
            {darf && <button type="button" className="ep-knopf" disabled={laeuft} onClick={speichereBaujahr}>Speichern</button>}
          </div>
          <small id="ep-baujahr-hinweis">Gilt für alle Bauteile ohne eigenes Baujahr.</small>
          {baujahrFehler && <small className="ep-fehler" role="alert">{baujahrFehler}</small>}
        </section>

        <section className="ep-karte" aria-label="Kennzahlen">
          <ul className="ep-ampeln">
            {REIHENFOLGE.map((a) => (
              <li key={a}><span className="ep-punkt" style={{ background: AMPEL_FARBE[a] }} aria-hidden="true" />{AMPEL_TEXT[a]}<strong>{l.zaehler[a]}</strong></li>
            ))}
          </ul>
          <p className="ep-summe">Nächste 5 Jahre: <strong>{chf(l.summe5.betrag)}</strong></p>
          {l.summe5.ohnePreis > 0 && <p className="ep-warn">{l.summe5.ohnePreis} Bauteile ohne Preis – Summe unvollständig</p>}
        </section>

        <section className="ep-karte" aria-label="Kosten je Jahr">
          <h2>Kosten je Jahr</h2>
          <div className="ep-balken">
            {bal.map((b) => (
              <button key={b.jahr} type="button" className="ep-balken-spalte" aria-pressed={filter === b.jahr}
                aria-label={b.jahr + ": " + b.text + (b.ohnePreis > 0 ? ", " + b.ohnePreis + " ohne Preis" : "")}
                onClick={() => setFilter(filter === b.jahr ? null : b.jahr)}>
                <span className="ep-balken-flaeche"><span className="ep-balken-stab" style={{ height: Math.round(b.anteil * 100) + "%" }} /></span>
                <span className="ep-balken-text">{b.text}</span>
                <span className="ep-balken-jahr">{b.jahr}</span>
                {b.ohnePreis > 0 && <span className="ep-balken-ohne">+ {b.ohnePreis} ohne Preis</span>}
              </button>
            ))}
          </div>
          {filter !== null && <p className="ep-filter">Filter: {filter} <button type="button" className="ep-knopf" onClick={() => setFilter(null)}>Filter aufheben</button></p>}
        </section>

        <section className="ep-karte" aria-label="Bauteile">
          <h2>Bauteile</h2>
          {zeilen.length === 0 ? <p className="ep-leer">Keine Bauteile{filter !== null ? " für " + filter : ""}.</p> :
            <div className="ep-tabelle-rahmen"><table className="ep-tabelle">
              <thead><tr><th>Ampel</th><th>Bauteil</th><th>Ort</th><th className="ep-zahl">Menge</th><th className="ep-zahl">Baujahr</th><th className="ep-zahl">Ersatzjahr</th><th className="ep-zahl">Kosten</th></tr></thead>
              <tbody>{zeilen.map((z) => (
                <tr key={z.id}>
                  <td><span className="ep-punkt" style={{ background: AMPEL_FARBE[z.ampel] }} aria-hidden="true" />{AMPEL_TEXT[z.ampel]}</td>
                  <td>{z.name}</td><td>{z.ort}</td>
                  <td className="ep-zahl">{z.menge}</td><td className="ep-zahl">{z.baujahr.wert}</td><td className="ep-zahl">{z.ersatzjahr}</td>
                  <td className="ep-zahl">{z.preis.fehlt ? <span className="ep-warn">Preis fehlt</span> : z.kosten}</td>
                </tr>))}</tbody>
            </table></div>}
        </section>

        <details className="ep-karte ep-typen">
          <summary>Typwerte (Lebensdauer und Preis je Bauteiltyp)</summary>
          {stand.typen.length === 0 ? <p className="ep-leer">Keine Bauteiltypen in diesem Gebäude.</p> : <>
            <div className="ep-typ-liste">{stand.typen.map((t) => {
              const f = typFeld[t.katalogId] ?? { lMittel: "", preis: "" };
              const set = (teil: Partial<typeof f>) => setTypFeld({ ...typFeld, [t.katalogId]: { ...f, ...teil } });
              const fe = typFehler[t.katalogId];
              return <div key={t.katalogId} className="ep-typ">
                <strong>{nameVon(t.katalogId)}</strong>
                <label>Lebensdauer (Jahre)
                  <input inputMode="numeric" value={f.lMittel} disabled={!darf} onChange={(e) => set({ lMittel: e.target.value })}
                    placeholder={"Richtwert " + t.standard + " Jahre (" + t.bereich.min + "–" + t.bereich.max + ")"} aria-invalid={!!fe} /></label>
                <label>Stückpreis (CHF)
                  <input inputMode="decimal" value={f.preis} disabled={!darf} onChange={(e) => set({ preis: e.target.value })} placeholder="z. B. 1200 oder 1'200.50" aria-invalid={!!fe} /></label>
                {fe && <small className="ep-fehler" role="alert">{fe}</small>}
              </div>;
            })}</div>
            {typFehler[""] && <small className="ep-fehler" role="alert">{typFehler[""]}</small>}
            {darf && <button type="button" className="ep-knopf" disabled={laeuft} onClick={speichereTypen}>Typwerte speichern</button>}
          </>}
        </details>
      </div>}
    </main>
  );
}
