import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, FilePlus2, FileText, RotateCw, ScanSearch, Trash2, TriangleAlert, X } from "lucide-react";
import { ApiFehler, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import { anzeigeName } from "../dashboard";
import type { LdStand } from "../lebensdauer/typen";
import type { Katalog } from "../typen";
import { alleSicheren, dateiUrl, fehlerCode, ladeHoch, ladeUebersicht, liesNeu, loescheDokument, uebernimm, verwirf } from "../preisdokument/api";
import { franken, gruppiere, laeuftNoch, offeneSichere, statusText, zuordnungText } from "../preisdokument/ansicht";
import type { DokumentZeile, Uebersicht, VorschlagZeile } from "../preisdokument/typen";
import { Marke } from "../ui/Kopfzeile";
import { alleSicherenText, datum, fuerBauteil, kandidaten, sortiert, startAuswahl, teileDateien, umfang, type Kandidat } from "./dokumenteAnsicht";
import "./Erneuerungsplan.css";
import "./Dokumente.css";

const F = TOKENS.farbe;
const stil = {
  "--ep-grund": F.grund, "--ep-flaeche": F.flaeche, "--ep-flaeche-2": F.flaecheSekundaer, "--ep-grau-1": F.grau1, "--ep-grau-2": F.grau2, "--ep-grau-3": F.grau3,
  "--ep-text": F.text, "--ep-sekundaer": F.textSekundaer, "--ep-sekundaer-kachel": F.textSekundaerKachel, "--ep-sekundaer-eis": F.textSekundaerEis,
  "--ep-link": F.link, "--ep-link-hover": F.linkHover, "--ep-eis": F.eis, "--ep-akzent": F.eisAkzent,
  "--ep-ok": F.statusOk, "--ep-ok-text": F.statusOkText,
  "--ep-warnung": F.statusWarnung, "--ep-stoerung": F.statusStoerung, "--ep-warnung-text": F.statusWarnungText, "--ep-stoerung-text": F.statusStoerungText,
  "--ep-schrift": TOKENS.typografie.familie, "--ep-schatten": TOKENS.schatten.panel, "--ep-radius": `${TOKENS.radius.panelPx}px`, "--ep-radius-kachel": `${TOKENS.radius.kachelPx}px`,
  "--ep-hover-ms": `${TOKENS.bewegung.hoverMs}ms`, "--ep-panel-ms": `${TOKENS.bewegung.panelMs}ms`, "--ep-kurve": TOKENS.bewegung.kurve,
  "--tw-text": F.text, "--tw-eis": F.eis,
} as CSSProperties;

const MELDUNG_409 = "Die Daten wurden inzwischen geändert. Neu laden, um mit dem aktuellen Stand weiterzuarbeiten.";
const MELDUNG_404 = "Preis aus Dokument ist für diese Instanz nicht eingeschaltet.";
const MELDUNG_HAND = "Von Hand erfasster Preis wird ersetzt. Übernehmen?";
const POLL_MS = 2000;

interface Props {
  gebaeudeId: string; name: string;
  /** Einstieg aus der Anlagenkarte: nur Vorschläge für dieses Bauteil. */
  bauteilId?: string;
  zurueckText: string;
  onZurueck: () => void;
  onAbgelaufen: () => void;
}

type Aktion = (e: unknown) => void;

export function Dokumente({ gebaeudeId, name, bauteilId, zurueckText, onZurueck, onAbgelaufen }: Props) {
  const [u, setU] = useState<Uebersicht | null>(null);
  const [ld, setLd] = useState<LdStand | null>(null);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; art: "ok" | "fehler" } | null>(null);
  const [filterId, setFilterId] = useState<string | null>(bauteilId ?? null);
  const [ablegen, setAblegen] = useState<string[]>([]);
  const [ablageFehler, setAblageFehler] = useState<{ datei: string; text: string }[]>([]);
  const [ziehen, setZiehen] = useState(false);
  const [aktivDok, setAktivDok] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);
  const ziehTiefe = useRef(0);

  const fehlerBehandeln = useCallback<Aktion>((e) => {
    if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
    else if (fehlerCode(e) === "stand_veraltet") setKonflikt(true);
    else if (e instanceof ApiFehler && e.status === 403) setMeldung({ text: "Keine Berechtigung zum Ändern.", art: "fehler" });
    else setMeldung({ text: e instanceof Error ? e.message : "Aktion fehlgeschlagen", art: "fehler" });
  }, [onAbgelaufen]);

  const ladeLd = useCallback(() => holeJson<LdStand>("/api/lebensdauer/gebaeude/" + gebaeudeId).then(setLd, () => { /* Kandidaten bleiben leer */ }), [gebaeudeId]);
  const laden = useCallback(() => {
    let aktiv = true;
    setFehler(null); setKonflikt(false);
    ladeUebersicht(gebaeudeId).then((x) => { if (aktiv) setU(x); }, (e: Error) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else if (e instanceof ApiFehler && e.status === 404) setFehler(MELDUNG_404);
      else setFehler(e.message);
    });
    void ladeLd();
    holeJson<Katalog>("/api/katalog/v2").then((k) => { if (aktiv) setKatalog(k); }, () => { /* Namen fallen auf Katalog-ID zurueck */ });
    return () => { aktiv = false; };
  }, [gebaeudeId, onAbgelaufen, ladeLd]);
  useEffect(() => laden(), [laden]);

  // Solange ein Dokument gelesen wird: alle 2 s neu laden.
  const pollen = !!u && laeuftNoch(u);
  useEffect(() => {
    if (!pollen) return;
    const t = window.setTimeout(() => { ladeUebersicht(gebaeudeId).then(setU, fehlerBehandeln); }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [pollen, u, gebaeudeId, fehlerBehandeln]);

  useEffect(() => {
    if (!meldung || meldung.art !== "ok") return;
    const t = window.setTimeout(() => setMeldung(null), 6000);
    return () => window.clearTimeout(t);
  }, [meldung]);

  const nameVon = useCallback((id: string) => anzeigeName(id, katalog?.eintraege ?? []), [katalog]);
  const darf = u?.darfAendern === true;
  const an = u?.auslesen === "an";
  const filterBauteil = filterId ? ld?.bauteile.find((b) => b.id === filterId) ?? null : null;
  const filter = filterId ? { bauteilId: filterId, katalogId: filterBauteil?.katalogId ?? null } : null;

  const gruppen = useMemo(() => {
    if (!u) return { je: [], ohne: [] as { dokument: DokumentZeile; v: VorschlagZeile }[] };
    if (filter) return { je: fuerBauteil(u, filter.bauteilId, filter.katalogId), ohne: [] };
    const g = gruppiere(u);
    return {
      je: g.filter((x) => x.zugeordnet.length > 0).map((x) => ({ dokument: x.dokument, vorschlaege: sortiert(x.zugeordnet) })),
      ohne: g.flatMap((x) => sortiert(x.ohne).map((v) => ({ dokument: x.dokument, v }))),
    };
  }, [u, filter?.bauteilId, filter?.katalogId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sichere = u ? offeneSichere(u) : 0;
  const offen = u ? u.dokumente.reduce((n, d) => n + d.vorschlaege.filter((v) => v.status === "offen").length, 0) : 0;
  const vorschlaegeDa = u ? u.dokumente.some((d) => d.vorschlaege.length > 0) : false;

  async function dateienAblegen(liste: File[]) {
    const { pdf, abgelehnt } = teileDateien(liste);
    setAblageFehler(abgelehnt.map((f) => ({ datei: f.name, text: "Nur PDF-Dateien ablegen." })));
    if (!pdf.length) return;
    setAblegen(pdf.map((f) => f.name));
    const neueFehler: { datei: string; text: string }[] = [];
    for (const f of pdf) {
      try { await ladeHoch(gebaeudeId, f); }
      catch (e) {
        if (e instanceof ApiFehler && e.status === 401) { onAbgelaufen(); return; }
        neueFehler.push({ datei: f.name, text: e instanceof Error ? e.message : "Ablegen fehlgeschlagen" });
      }
      setAblegen((a) => a.filter((n) => n !== f.name));
    }
    setAblageFehler((a) => [...a, ...neueFehler]);
    try { setU(await ladeUebersicht(gebaeudeId)); } catch (e) { fehlerBehandeln(e); }
  }

  const zieheUeber = (e: DragEvent) => { if (!darf) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  const zieheRein = (e: DragEvent) => { if (!darf || !e.dataTransfer.types.includes("Files")) return; ziehTiefe.current++; setZiehen(true); };
  const zieheRaus = () => { if (!darf) return; ziehTiefe.current = Math.max(0, ziehTiefe.current - 1); if (ziehTiefe.current === 0) setZiehen(false); };
  const lassFallen = (e: DragEvent) => {
    if (!darf) return;
    e.preventDefault(); ziehTiefe.current = 0; setZiehen(false);
    void dateienAblegen([...e.dataTransfer.files]);
  };

  async function mitStand(f: () => Promise<Uebersicht>, nachher?: (x: Uebersicht) => void) {
    setLaeuft(true); setMeldung(null);
    try { const x = await f(); setU(x); setKonflikt(false); nachher?.(x); void ladeLd(); }
    finally { setLaeuft(false); }
  }

  const uebernehmen = async (v: VorschlagZeile, ids: string[], alsTyppreis: boolean, ueberschreibe: boolean): Promise<"handeingabe" | void> => {
    if (!u) return;
    try { await mitStand(() => uebernimm(v.id, { bauteilIds: ids, alsTyppreis, stand: u.stand, ...(ueberschreibe ? { ueberschreibeHandeingabe: true } : {}) })); }
    catch (e) { if (fehlerCode(e) === "handeingabe") return "handeingabe"; fehlerBehandeln(e); }
  };
  const verwerfen = async (v: VorschlagZeile) => { try { await mitStand(() => verwirf(v.id)); } catch (e) { fehlerBehandeln(e); } };
  const alleUebernehmen = async () => {
    if (!u) return;
    const vorher = offeneSichere(u);
    try { await mitStand(() => alleSicheren(gebaeudeId, u.stand), (x) => setMeldung({ text: alleSicherenText(vorher, offeneSichere(x)), art: "ok" })); }
    catch (e) { fehlerBehandeln(e); }
  };
  const neuLesen = async (d: DokumentZeile) => {
    try { await liesNeu(d.id); setU(await ladeUebersicht(gebaeudeId)); }
    catch (e) {
      if (fehlerCode(e) === "liest_bereits") setMeldung({ text: `${d.dateiname} wird bereits gelesen.`, art: "ok" });
      else if (fehlerCode(e) === "auslesen_aus") setMeldung({ text: "Auslesen ist ausgeschaltet.", art: "fehler" });
      else fehlerBehandeln(e);
    }
  };
  const loeschen = async (d: DokumentZeile) => {
    try { await loescheDokument(d.id); setU(await ladeUebersicht(gebaeudeId)); setMeldung({ text: `${d.dateiname} gelöscht. Übernommene Preise bleiben erhalten.`, art: "ok" }); }
    catch (e) { fehlerBehandeln(e); }
  };
  const zeigeDokument = (id: string) => {
    setAktivDok(id);
    document.getElementById(`dk-gruppe-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const karte = (v: VorschlagZeile, d: DokumentZeile, mitDatei: boolean) => (
    <VorschlagKarte key={v.id} v={v} dokument={d} mitDatei={mitDatei} darf={darf} laeuft={laeuft}
      kandidaten={kandidaten(ld, v.katalogId, nameVon)} typName={v.katalogId ? nameVon(v.katalogId) : null}
      start={startAuswahl(v, filter)} hervor={filter?.bauteilId ?? null}
      onUebernehmen={uebernehmen} onVerwerfen={verwerfen} />
  );

  const filterText = filterBauteil ? `${nameVon(filterBauteil.katalogId)} · ${filterBauteil.ort}` : "gewähltes Bauteil";
  return (
    <main className="ep dk" style={stil} aria-label="Dokumente">
      <header className="ep-kopf">
        <button type="button" className="ep-zurueck" onClick={onZurueck}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{zurueckText}</button>
        <div className="ep-titel">
          <Marke />
          <h1>Dokumente<span>{name}</span></h1>
        </div>
        {u && darf && sichere > 0
          ? <button type="button" className="ep-knopf ep-knopf-haupt" disabled={laeuft} onClick={() => void alleUebernehmen()}>
            <Check size={15} strokeWidth={2} aria-hidden="true" />Alle sicheren übernehmen ({sichere})</button>
          : <span />}
      </header>

      {fehler && <p className="ep-meldung" role="alert">{fehler}</p>}
      {konflikt && <p className="ep-meldung ep-meldung-konflikt" role="alert"><TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />{MELDUNG_409}
        <button type="button" className="ep-knopf" onClick={laden}>Neu laden</button></p>}
      {!u && !fehler && <p className="ep-meldung ep-laden" role="status">Dokumente werden geladen …</p>}
      <p className="ui-sr" role="status" aria-live="polite">{meldung?.art === "ok" ? meldung.text : ""}</p>

      {u && <div className="dk-inhalt">
        <aside className={`ep-karte dk-liste${ziehen ? " dk-ziehen" : ""}`} aria-labelledby="dk-liste-titel"
          onDragOver={zieheUeber} onDragEnter={zieheRein} onDragLeave={zieheRaus} onDrop={lassFallen}>
          <div className="ep-karte-kopf dk-liste-kopf">
            <h2 id="dk-liste-titel">Abgelegt <span className="ep-anzahl">{u.dokumente.length}</span></h2>
          </div>
          {darf && <div className="dk-ablage">
            <input ref={dateiFeld} id="dk-datei" type="file" accept="application/pdf,.pdf" multiple className="ui-sr" tabIndex={-1}
              onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; void dateienAblegen(f); }} />
            <FilePlus2 size={20} strokeWidth={1.6} aria-hidden="true" />
            <p><strong>PDF hierher ziehen</strong>Offerten und Rechnungen</p>
            <button type="button" className="ep-knopf" onClick={() => dateiFeld.current?.click()}>Datei wählen</button>
          </div>}
          {ablageFehler.length > 0 && <ul className="dk-ablage-fehler" role="alert">
            {ablageFehler.map((f, i) => <li key={i}><TriangleAlert size={13} strokeWidth={2} aria-hidden="true" /><span><strong>{f.datei}</strong>{f.text}</span></li>)}
            <li><button type="button" className="dk-leise" onClick={() => setAblageFehler([])}>Ausblenden</button></li>
          </ul>}
          {u.dokumente.length === 0 && ablegen.length === 0
            ? <p className="ep-leer dk-liste-leer">{darf ? "Noch keine Dokumente. Abgelegte PDFs bleiben beim Gebäude." : "Noch keine Dokumente abgelegt."}</p>
            : <ul className="dk-dokumente">
              {u.dokumente.map((d) => <DokumentEintrag key={d.id} d={d} darf={darf} an={an} aktiv={aktivDok === d.id}
                zeigen={!filter && d.vorschlaege.length > 0} onZeigen={() => zeigeDokument(d.id)} onNeuLesen={() => void neuLesen(d)} onLoeschen={() => void loeschen(d)} />)}
              {ablegen.map((n) => <li key={"ab-" + n} className="dk-dok dk-dok-ablegen"><span className="dk-dok-icon" aria-hidden="true"><FileText size={16} strokeWidth={1.75} /></span>
                <span className="dk-dok-text"><span className="dk-dok-name">{n}</span><span className="dk-status dk-status-liest"><i aria-hidden="true" />wird abgelegt …</span></span></li>)}
            </ul>}
          {an && darf && <p className="dk-budget">KI-Budget diesen Monat: {u.budget.verbrauchtUsd.toFixed(2)} von {u.budget.limitUsd.toFixed(0)} USD</p>}
        </aside>

        <section className="dk-vorschlaege" aria-labelledby="dk-vorschlaege-titel">
          <div className="dk-vorschlaege-kopf">
            <h2 id="dk-vorschlaege-titel">Preisvorschläge {offen > 0 && <span className="ep-anzahl">{offen} offen</span>}</h2>
            {filter && <button type="button" className="ep-filter" onClick={() => setFilterId(null)} aria-label={`Filter ${filterText} aufheben`}>
              Nur {filterText}<X size={14} strokeWidth={2} aria-hidden="true" /></button>}
          </div>
          {meldung && <p className={`dk-meldung dk-meldung-${meldung.art}`} role={meldung.art === "fehler" ? "alert" : undefined}>
            {meldung.art === "ok" ? <Check size={15} strokeWidth={2} aria-hidden="true" /> : <TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />}{meldung.text}
            <button type="button" className="dk-meldung-zu" aria-label="Meldung schliessen" onClick={() => setMeldung(null)}><X size={14} strokeWidth={2} aria-hidden="true" /></button></p>}

          {!an && <div className={`dk-aus${vorschlaegeDa ? " dk-aus-klein" : ""}`}>
            <ScanSearch size={vorschlaegeDa ? 16 : 22} strokeWidth={1.6} aria-hidden="true" />
            <p>Auslesen ist ausgeschaltet. Der Admin kann es einschalten.{vorschlaegeDa ? " Bestehende Vorschläge lassen sich weiter prüfen." : darf ? " Abgelegte PDFs bleiben beim Gebäude und lassen sich später lesen." : ""}</p>
          </div>}
          {an && !vorschlaegeDa && <div className="dk-leer">
            <ScanSearch size={22} strokeWidth={1.6} aria-hidden="true" />
            <p>{u.dokumente.length === 0
              ? "PDF ablegen. Planora liest Positionen mit Ersatzpreis, zeigt die Fundstelle und schlägt passende Bauteile vor."
              : pollen ? "Dokumente werden gelesen. Vorschläge erscheinen hier." : "In den abgelegten Dokumenten wurden keine Preise gefunden."}</p>
          </div>}
          {filter && vorschlaegeDa && gruppen.je.length === 0 && <p className="dk-leer dk-leer-klein">Kein Vorschlag passt zu {filterText}. Filter aufheben, um alle zu sehen.</p>}

          {gruppen.je.map(({ dokument: d, vorschlaege }) => (
            <div key={d.id} id={`dk-gruppe-${d.id}`} className={`dk-gruppe${aktivDok === d.id ? " dk-gruppe-aktiv" : ""}`}>
              <h3 className="dk-gruppe-kopf"><FileText size={15} strokeWidth={1.75} aria-hidden="true" /><span>{d.dateiname}</span>
                <a href={dateiUrl(d.id)} target="_blank" rel="noopener" className="dk-link">Öffnen<ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" /></a></h3>
              <div className="dk-karten">{vorschlaege.map((v) => karte(v, d, false))}</div>
            </div>
          ))}

          {gruppen.ohne.length > 0 && <div className="dk-gruppe dk-ohne">
            <h3 className="dk-gruppe-kopf">Nicht zugeordnet <span className="ep-anzahl">{gruppen.ohne.length}</span></h3>
            <p className="ep-nebentext">Positionen ohne passendes Bauteil im Gebäude, etwa Regiestunden oder Kleinmaterial.</p>
            <div className="dk-karten">{gruppen.ohne.map(({ dokument, v }) => karte(v, dokument, true))}</div>
          </div>}
        </section>
      </div>}
    </main>
  );
}

function DokumentEintrag({ d, darf, an, aktiv, zeigen, onZeigen, onNeuLesen, onLoeschen }: {
  d: DokumentZeile; darf: boolean; an: boolean; aktiv: boolean; zeigen: boolean; onZeigen: () => void; onNeuLesen: () => void; onLoeschen: () => void;
}) {
  const [frage, setFrage] = useState(false);
  const liest = d.status === "neu" || d.status === "liest";
  const offen = d.vorschlaege.filter((v) => v.status === "offen").length;
  const statusKlasse = liest ? "liest" : d.status === "fehler" ? "fehler" : d.status === "abgebrochen" ? "fehler" : d.status === "aus" ? "aus" : "fertig";
  const status = d.status === "fertig" && d.vorschlaege.length > 0 && offen < d.vorschlaege.length
    ? `${statusText(d)}, ${offen === 0 ? "alle entschieden" : `${offen} offen`}` : statusText(d);
  return (
    <li className={`dk-dok${aktiv ? " dk-dok-aktiv" : ""}`}>
      <span className="dk-dok-icon" aria-hidden="true"><FileText size={16} strokeWidth={1.75} /></span>
      <span className="dk-dok-text">
        {zeigen
          ? <button type="button" className="dk-dok-name dk-dok-wahl" onClick={onZeigen} title={d.dateiname}>{d.dateiname}</button>
          : <span className="dk-dok-name" title={d.dateiname}>{d.dateiname}</span>}
        <span className="dk-dok-meta">{datum(d.hochgeladenAm)}, {umfang(d)}</span>
        <span className={`dk-status dk-status-${statusKlasse}`}>{liest && <i aria-hidden="true" />}{(d.status === "fehler" || d.status === "abgebrochen") && <TriangleAlert size={12} strokeWidth={2.2} aria-hidden="true" />}{status}</span>
      </span>
      <span className="dk-dok-aktionen">
        <a className="dk-symbol" href={dateiUrl(d.id)} target="_blank" rel="noopener" aria-label={`${d.dateiname} öffnen (neuer Tab)`} title="Öffnen">
          <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" /></a>
        {darf && an && !liest && <button type="button" className="dk-symbol" onClick={onNeuLesen} aria-label={`${d.dateiname} erneut lesen`} title="Erneut lesen">
          <RotateCw size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
        {darf && <button type="button" className="dk-symbol dk-symbol-loeschen" onClick={() => setFrage(true)} aria-label={`${d.dateiname} löschen`} title="Löschen" aria-expanded={frage}>
          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
      </span>
      {frage && <div className="dk-frage" role="group" aria-label="Löschen bestätigen"
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setFrage(false); } }}>
        <p>Dokument und offene Vorschläge löschen? Übernommene Preise bleiben.</p>
        <div><button type="button" className="ep-knopf dk-knopf-gefahr" autoFocus onClick={() => { setFrage(false); onLoeschen(); }}>Löschen</button>
          <button type="button" className="dk-leise" onClick={() => setFrage(false)}>Abbrechen</button></div>
      </div>}
    </li>
  );
}

interface KarteProps {
  v: VorschlagZeile; dokument: DokumentZeile; mitDatei: boolean; darf: boolean; laeuft: boolean;
  kandidaten: Kandidat[]; typName: string | null; start: string[]; hervor: string | null;
  onUebernehmen: (v: VorschlagZeile, ids: string[], alsTyppreis: boolean, ueberschreibe: boolean) => Promise<"handeingabe" | void>;
  onVerwerfen: (v: VorschlagZeile) => Promise<void>;
}

const OFFEN_BIS = 6;

function VorschlagKarte({ v, dokument, mitDatei, darf, laeuft, kandidaten, typName, start, hervor, onUebernehmen, onVerwerfen }: KarteProps) {
  const [ids, setIds] = useState<string[]>(start);
  const [typ, setTyp] = useState(v.alsTyppreis);
  const [rueckfrage, setRueckfrage] = useState(false);
  const [alle, setAlle] = useState(false);
  const kopfId = `dk-v-${v.id}`;
  const offen = v.status === "offen";
  const unsicher = v.sicherheit === "tief";
  const zuordnung = zuordnungText({ ...v, bauteilIds: ids }, kandidaten);

  if (!offen) {
    const anzahl = v.bauteilIds.length;
    return (
      <article className={`dk-vk dk-vk-${v.status}`} aria-labelledby={kopfId}>
        <span className="dk-vk-zeichen" aria-hidden="true">{v.status === "uebernommen" ? <Check size={14} strokeWidth={2.2} /> : <X size={14} strokeWidth={2} />}</span>
        <h4 id={kopfId} className="dk-vk-position">{v.position}</h4>
        <span className="dk-vk-entschieden">{v.status === "uebernommen"
          ? `Übernommen${anzahl ? `, ${anzahl === 1 ? "1 Bauteil" : `${anzahl} Bauteile`}` : ""}${v.alsTyppreis ? ", Typpreis" : ""}` : "Verworfen"}</span>
        <span className="dk-vk-preis-klein">{franken(v.ersatzpreis)}</span>
      </article>
    );
  }

  const sichtbar = alle || kandidaten.length <= OFFEN_BIS ? kandidaten : kandidaten.filter((k) => ids.includes(k.id) || k.id === hervor);
  const umschalten = (id: string) => setIds((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  const kannUebernehmen = !!v.katalogId && (ids.length > 0 || typ);
  const uebernehmen = async (ueberschreibe: boolean) => {
    const r = await onUebernehmen(v, ids, typ, ueberschreibe);
    setRueckfrage(r === "handeingabe");
  };
  const ersetzt = kandidaten.filter((k) => ids.includes(k.id) && k.hand);

  return (
    <article className={`dk-vk${unsicher ? " dk-vk-unsicher" : ""}`} aria-labelledby={kopfId}>
      <div className="dk-vk-kopf">
        <div className="dk-vk-titel">
          <h4 id={kopfId} className="dk-vk-position">{v.position}</h4>
          {unsicher
            ? <span className="dk-chip dk-chip-pruefen"><TriangleAlert size={12} strokeWidth={2.2} aria-hidden="true" />Unsicher, bitte prüfen</span>
            : v.sicherheit === "hoch" ? <span className="dk-chip">Sicher erkannt</span> : <span className="dk-chip dk-chip-leise">Wahrscheinlich</span>}
          {mitDatei && <span className="dk-vk-datei">{dokument.dateiname}</span>}
        </div>
        <div className="dk-vk-preis">
          <strong>{franken(v.ersatzpreis)}</strong>
          <span>Ersatzpreis netto je Stück</span>
          {v.rechenweg && <span className="dk-vk-rechenweg">{v.rechenweg}</span>}
        </div>
      </div>
      <figure className="dk-beleg">
        <blockquote>{v.zitat}</blockquote>
        <figcaption><a href={dateiUrl(dokument.id, v.seite)} target="_blank" rel="noopener" className="dk-link"
          aria-label={`Seite ${v.seite} von ${dokument.dateiname} öffnen (neuer Tab)`}>Seite {v.seite}<ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" /></a></figcaption>
      </figure>

      {v.katalogId === null
        ? <p className="dk-vk-hinweis">Kein passender Bauteiltyp. Falls nötig, den Preis in der Anlagenkarte von Hand erfassen.</p>
        : kandidaten.length === 0
          ? <p className="dk-vk-hinweis">Im Gebäude gibt es kein Bauteil vom Typ «{typName}».</p>
          : <fieldset className="dk-zuordnung" disabled={!darf}>
            <legend><span>Zuordnung</span><span className="dk-zuordnung-text">{zuordnung}</span></legend>
            {darf ? <>
              <ul className="dk-kandidaten">
                {sichtbar.map((k) => (
                  <li key={k.id} className={k.id === hervor ? "dk-kandidat-hervor" : undefined}>
                    <label>
                      <input type="checkbox" checked={ids.includes(k.id)} onChange={() => umschalten(k.id)} />
                      <span className="dk-kandidat-text"><span>{k.ort}</span>{k.detail && <small>{k.detail}</small>}</span>
                      <span className={`dk-kandidat-bisher${k.hand ? " dk-kandidat-hand" : ""}`}>{k.bisher}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {kandidaten.length > OFFEN_BIS && <button type="button" className="dk-leise dk-mehr" onClick={() => setAlle(!alle)} aria-expanded={alle}>
                {alle ? "Nur gewählte zeigen" : `Alle ${kandidaten.length} «${typName}» zeigen`}</button>}
              {v.fehlendeBauteile.length > 0 && <p className="dk-vk-hinweis">{v.fehlendeBauteile.length === 1 ? "1 vorgeschlagenes Bauteil gibt" : `${v.fehlendeBauteile.length} vorgeschlagene Bauteile geben`} es nicht mehr.</p>}
              <label className="dk-typ">
                <input type="checkbox" checked={typ} onChange={(e) => setTyp(e.target.checked)} />
                <span>Auch als Typpreis für alle «{typName}»<small>Gilt für Bauteile dieses Typs ohne eigenen Preis.</small></span>
              </label>
            </> : null}
          </fieldset>}

      {darf && (rueckfrage
        ? <div className="dk-rueckfrage" role="alertdialog" aria-labelledby={`${kopfId}-frage`}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setRueckfrage(false); } }}>
          <p id={`${kopfId}-frage`}><TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />{MELDUNG_HAND}
            {ersetzt.length > 0 && <small>{ersetzt.map((k) => `${k.ort}: ${k.bisher}`).join("; ")}</small>}</p>
          <div className="dk-aktionen">
            <button type="button" className="ep-knopf ep-knopf-haupt" autoFocus disabled={laeuft} onClick={() => void uebernehmen(true)}>Ersetzen und übernehmen</button>
            <button type="button" className="dk-leise" onClick={() => setRueckfrage(false)}>Abbrechen</button>
          </div>
        </div>
        : <div className="dk-aktionen">
          {v.katalogId !== null && kandidaten.length > 0 && <button type="button" className="ep-knopf ep-knopf-haupt" disabled={laeuft || !kannUebernehmen}
            aria-describedby={!kannUebernehmen ? `${kopfId}-leer` : undefined} onClick={() => void uebernehmen(false)}>Übernehmen</button>}
          <button type="button" className="ep-knopf" disabled={laeuft} onClick={() => void onVerwerfen(v)}>Verwerfen</button>
          {!kannUebernehmen && v.katalogId !== null && kandidaten.length > 0 && <small id={`${kopfId}-leer`} className="ep-nebentext">Bauteil oder Typpreis wählen.</small>}
        </div>)}
    </article>
  );
}
