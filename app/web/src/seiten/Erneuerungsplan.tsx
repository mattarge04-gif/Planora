import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Download, TriangleAlert, X } from "lucide-react";
import { ApiFehler, ersetzeJson, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import { anzeigeName } from "../dashboard";
import { AMPEL_FARBE, AMPEL_TEXT, balken, chf, jahre, planZeilen } from "../lebensdauer/ansicht";
import { baujahrKoerper, typKoerper, type TypAenderungen } from "../lebensdauer/typwerte";
import type { Ampel, LdStand } from "../lebensdauer/typen";
import type { Katalog } from "../typen";
import { AmpelZeichen } from "../ui/Ampel";
import { Marke } from "../ui/Kopfzeile";
import "./Erneuerungsplan.css";

const F = TOKENS.farbe;
const stil = {
  "--ep-grund": F.grund, "--ep-flaeche": F.flaeche, "--ep-flaeche-2": F.flaecheSekundaer, "--ep-grau-1": F.grau1, "--ep-grau-2": F.grau2, "--ep-grau-3": F.grau3,
  "--ep-text": F.text, "--ep-sekundaer": F.textSekundaer, "--ep-sekundaer-kachel": F.textSekundaerKachel, "--ep-sekundaer-eis": F.textSekundaerEis,
  "--ep-link": F.link, "--ep-link-hover": F.linkHover, "--ep-eis": F.eis, "--ep-akzent": F.eisAkzent,
  "--ep-warnung": F.statusWarnung, "--ep-stoerung": F.statusStoerung, "--ep-warnung-text": F.statusWarnungText, "--ep-stoerung-text": F.statusStoerungText,
  "--ep-schrift": TOKENS.typografie.familie, "--ep-schatten": TOKENS.schatten.panel, "--ep-radius": `${TOKENS.radius.panelPx}px`, "--ep-radius-kachel": `${TOKENS.radius.kachelPx}px`,
  "--ep-hover-ms": `${TOKENS.bewegung.hoverMs}ms`, "--ep-panel-ms": `${TOKENS.bewegung.panelMs}ms`, "--ep-kurve": TOKENS.bewegung.kurve,
  // Marke aus der Kopfzeile nutzt die Twin-Variablen
  "--tw-text": F.text, "--tw-eis": F.eis,
} as CSSProperties;

const REIHENFOLGE: Ampel[] = ["rot", "gelb", "gruen", "grau"];
const MELDUNG_409 = "Die Daten wurden inzwischen geändert. Neu laden, um mit dem aktuellen Stand weiterzuarbeiten.";
const MELDUNG_404 = "Lebensdauer ist für diese Instanz nicht eingeschaltet.";
const bauteile = (n: number) => (n === 1 ? "1 Bauteil" : `${n} Bauteile`);
const typFehlerId = (katalogId: string) => `ep-typ-${katalogId.replace(/[^a-z0-9]+/gi, "-")}`;

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
    try { uebernehme(await ersetzeJson<LdStand>("/api/lebensdauer/gebaeude/" + gebaeudeId, body)); setKonflikt(false); }
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
    if ("fehler" in k) { setBaujahrFehler(k.fehler); document.getElementById("ep-baujahr")?.focus(); return; }
    setBaujahrFehler(null); void speichere(k.body, setBaujahrFehler);
  };
  const speichereTypen = () => {
    if (!stand) return;
    const k = typKoerper(stand, typFeld);
    if ("fehler" in k) {
      setTypFehler(k.fehler);
      const erster = stand.typen.find((t) => k.fehler[t.katalogId]);
      if (erster) document.getElementById(typFehlerId(erster.katalogId) + "-l")?.focus();
      return;
    }
    setTypFehler({});
    if (k.body.typen.length === 0) return;
    void speichere(k.body, (m) => setTypFehler({ "": m }));
  };

  const l = stand?.ergebnis;
  const gesamt = l ? REIHENFOLGE.reduce((n, a) => n + l.zaehler[a], 0) : 0;
  const ueberfaellig = l ? l.bauteile.some((b) => b.ersatzjahr !== null && b.ersatzjahr < l.stichtag) : false;
  const gefiltert = filter === null ? null : bal.find((b) => b.jahr === filter);
  return (
    <main className="ep" style={stil} aria-label="Erneuerungsplan">
      <header className="ep-kopf">
        <button type="button" className="ep-zurueck" onClick={onTwin}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Digital Twin</button>
        <div className="ep-titel">
          <Marke />
          <h1>Erneuerungsplan<span>{name}</span></h1>
        </div>
        {stand ? <a className="ep-knopf ep-knopf-haupt" href={"/api/lebensdauer/gebaeude/" + gebaeudeId + "/export.csv"} download>
          <Download size={15} strokeWidth={1.75} aria-hidden="true" />CSV exportieren</a> : <span />}
      </header>

      {fehler && <p className="ep-meldung" role="alert">{fehler}</p>}
      {konflikt && <p className="ep-meldung ep-meldung-konflikt" role="alert"><TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />{MELDUNG_409}
        <button type="button" className="ep-knopf" onClick={laden}>Neu laden</button></p>}
      {!stand && !fehler && <p className="ep-meldung ep-laden" role="status">Erneuerungsplan wird geladen …</p>}

      {stand && l && <div className="ep-inhalt">
        <section className="ep-karte ep-ueberblick" aria-labelledby="ep-ueberblick-titel">
          <div className="ep-summe">
            <h2 id="ep-ueberblick-titel">Kosten nächste 5 Jahre</h2>
            <p className="ep-summe-zahl">{chf(l.summe5.betrag)}</p>
            {l.summe5.ohnePreis > 0
              ? <p className="ep-warn"><TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />Summe unvollständig, {bauteile(l.summe5.ohnePreis)} ohne Preis</p>
              : <p className="ep-nebentext">Alle fälligen Bauteile haben einen Preis.</p>}
          </div>
          <div className="ep-ampel-block">
            {gesamt > 0 && <div className="ep-band" aria-hidden="true">
              {REIHENFOLGE.filter((a) => l.zaehler[a] > 0).map((a) => <span key={a} style={{ flexGrow: l.zaehler[a], background: AMPEL_FARBE[a] }} />)}
            </div>}
            <ul className="ep-ampeln" aria-label="Bauteile je Ampel">
              {REIHENFOLGE.map((a) => (
                <li key={a} className={l.zaehler[a] === 0 ? "ep-null" : undefined}>
                  <AmpelZeichen ampel={a} groesse={15} /><span>{AMPEL_TEXT[a]}</span><strong>{l.zaehler[a]}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ep-karte ep-baujahr" aria-labelledby="ep-baujahr-titel">
          <h2 id="ep-baujahr-titel">Baujahr Heizung</h2>
          {darf ? <div className="ep-zeile">
            <input id="ep-baujahr" aria-labelledby="ep-baujahr-titel" inputMode="numeric" value={baujahr} placeholder="z. B. 2008" onChange={(e) => setBaujahr(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") speichereBaujahr(); }}
              aria-invalid={baujahrFehler ? true : undefined} aria-describedby={"ep-baujahr-hinweis" + (baujahrFehler ? " ep-baujahr-fehler" : "")} />
            <button type="button" className="ep-knopf" disabled={laeuft} onClick={speichereBaujahr}>Speichern</button>
          </div> : <p className="ep-wert">{stand.heizungBaujahr ?? "nicht erfasst"}</p>}
          {baujahrFehler && <small id="ep-baujahr-fehler" className="ep-fehler">{baujahrFehler}</small>}
          <small id="ep-baujahr-hinweis" className="ep-nebentext">Gebäudestandard für alle Bauteile ohne eigenes Baujahr.</small>
        </section>

        <section className="ep-karte ep-jahre" aria-labelledby="ep-jahre-titel">
          <div className="ep-karte-kopf">
            <h2 id="ep-jahre-titel">Kosten je Jahr</h2>
            <p className="ep-nebentext">Jahr wählen, um die Liste zu filtern.{ueberfaellig ? ` Überfällige Bauteile zählen im Jahr ${l.stichtag}.` : ""}{bal.some((b) => b.ohnePreis > 0) ? " Gestrichelt: Betrag unvollständig, Preise fehlen." : ""}</p>
          </div>
          <div className={`ep-balken${filter !== null ? " ep-balken-gefiltert" : ""}`}>
            {bal.map((b) => (
              <button key={b.jahr} type="button" className="ep-balken-spalte" aria-pressed={filter === b.jahr}
                aria-label={b.jahr + ": " + b.text + (b.ohnePreis > 0 ? ", " + bauteile(b.ohnePreis) + " ohne Preis" : "")}
                onClick={() => setFilter(filter === b.jahr ? null : b.jahr)}>
                <span className="ep-balken-flaeche">
                  {b.betrag > 0 && <span className="ep-balken-text">{b.text}</span>}
                  {/* Gestrichelte Kappe: Kosten dieses Jahres sind höher als der Balken, weil Preise fehlen */}
                  {b.ohnePreis > 0 && <span className={`ep-balken-kappe${b.betrag > 0 ? "" : " ep-balken-kappe-allein"}`} />}
                  {b.betrag > 0 && <span className={`ep-balken-stab${b.ohnePreis > 0 ? " ep-balken-stab-gekappt" : ""}`} style={{ height: Math.max(2, Math.round(b.anteil * 100)) + "%" }} />}
                </span>
                <span className="ep-balken-jahr">{b.jahr}</span>
                <span className="ep-balken-ohne">{b.ohnePreis > 0 && <><TriangleAlert size={11} strokeWidth={2.2} aria-hidden="true" />{b.ohnePreis} ohne Preis</>}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="ep-karte ep-liste" aria-labelledby="ep-liste-titel">
          <div className="ep-karte-kopf">
            <h2 id="ep-liste-titel">Bauteile <span className="ep-anzahl">{zeilen.length}</span></h2>
            {filter !== null && <button type="button" className="ep-filter" onClick={() => setFilter(null)} aria-label={`Filter ${filter} aufheben`}>
              Fällig {filter}{gefiltert && gefiltert.betrag > 0 ? `, ${gefiltert.text}` : ""}<X size={14} strokeWidth={2} aria-hidden="true" /></button>}
          </div>
          {zeilen.length === 0 ? <p className="ep-leer">{filter !== null ? `Im Jahr ${filter} ist kein Bauteil fällig.` : "Keine Heizungsbauteile in diesem Gebäude."}</p> :
            <div className="ep-tabelle-rahmen"><table className="ep-tabelle">
              <thead><tr><th>Ampel</th><th>Bauteil</th><th>Ort</th><th className="ep-zahl">Menge</th><th className="ep-zahl">Baujahr</th><th className="ep-zahl">Lebensdauer</th><th className="ep-zahl">Ersatzjahr</th><th className="ep-zahl">Kosten</th></tr></thead>
              <tbody>{zeilen.map((z) => (
                <tr key={z.id}>
                  <td><span className="ep-ampel"><AmpelZeichen ampel={z.ampel} />{AMPEL_TEXT[z.ampel]}</span></td>
                  <td className="ep-name">{z.name}</td><td className="ep-ort">{z.ort}</td>
                  <td className="ep-zahl">{z.menge}</td>
                  <td className="ep-zahl">{z.baujahr.wert}{z.baujahr.quelle === "Eigene Angabe" && <small className="ep-marke" title="Eigene Angabe">eigen</small>}</td>
                  <td className="ep-zahl">{z.lebensdauer.wert}</td>
                  <td className="ep-zahl ep-betont">{z.ersatzjahr}</td>
                  <td className="ep-zahl">{z.preis.fehlt ? <span className="ep-preis-fehlt">Preis fehlt</span> : z.kosten}</td>
                </tr>))}</tbody>
            </table></div>}
        </section>

        <details className="ep-karte ep-typen">
          <summary><span>Typwerte</span><small>Lebensdauer und Stückpreis je Bauteiltyp</small></summary>
          {stand.typen.length === 0 ? <p className="ep-leer">Keine Bauteiltypen in diesem Gebäude.</p> : <>
            <div className="ep-typ-liste" role="table" aria-label="Typwerte">
              <div className="ep-typ ep-typ-kopf" role="row"><span role="columnheader">Bauteiltyp</span><span role="columnheader">Lebensdauer (Jahre)</span><span role="columnheader">Stückpreis (CHF)</span></div>
              {stand.typen.map((t) => {
                const f = typFeld[t.katalogId] ?? { lMittel: "", preis: "" };
                const set = (teil: Partial<typeof f>) => setTypFeld({ ...typFeld, [t.katalogId]: { ...f, ...teil } });
                const fe = typFehler[t.katalogId], fid = typFehlerId(t.katalogId);
                const tname = nameVon(t.katalogId);
                return <div key={t.katalogId} className="ep-typ" role="row">
                  <span role="rowheader" className="ep-typ-name">{tname}<small>Richtwert {jahre(t.standard)} ({t.bereich.min}–{t.bereich.max})</small></span>
                  {darf ? <>
                    <span role="cell"><input id={fid + "-l"} inputMode="numeric" value={f.lMittel} onChange={(e) => set({ lMittel: e.target.value })}
                      placeholder={String(t.standard)} aria-label={`Lebensdauer ${tname} in Jahren`} aria-invalid={fe ? true : undefined} aria-describedby={fe ? fid + "-f" : undefined} /></span>
                    <span role="cell"><input inputMode="decimal" value={f.preis} onChange={(e) => set({ preis: e.target.value })}
                      placeholder="kein Preis" aria-label={`Stückpreis ${tname} in CHF`} aria-invalid={fe ? true : undefined} aria-describedby={fe ? fid + "-f" : undefined} /></span>
                  </> : <>
                    <span role="cell" className="ep-wert-klein">{t.lMittel === null ? `${t.standard} (Richtwert)` : t.lMittel}</span>
                    <span role="cell" className={t.stueckpreis === null ? "ep-preis-fehlt" : "ep-wert-klein"}>{t.stueckpreis === null ? "Preis fehlt" : chf(t.stueckpreis)}</span>
                  </>}
                  {fe && <small id={fid + "-f"} className="ep-fehler ep-typ-fehler">{fe}</small>}
                </div>;
              })}
            </div>
            {typFehler[""] && <small className="ep-fehler" role="alert">{typFehler[""]}</small>}
            {darf && <div className="ep-typ-aktion"><button type="button" className="ep-knopf" disabled={laeuft} onClick={speichereTypen}>Typwerte speichern</button>
              <small className="ep-nebentext">Leeres Feld: Richtwert bzw. kein Preis.</small></div>}
          </>}
        </details>
      </div>}
    </main>
  );
}
