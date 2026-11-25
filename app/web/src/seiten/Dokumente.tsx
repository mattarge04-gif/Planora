import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ArrowLeft, ArrowUpRight, Check, Eye, FilePlus2, FileText, ScanSearch, Trash2, TriangleAlert, X } from "lucide-react";
import { ApiFehler, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import { anzeigeName } from "../dashboard";
import type { LdStand } from "../lebensdauer/typen";
import type { Katalog } from "../typen";
import { alleSicheren, fehlerCode, ladeUebersicht, liesNeu, uebernimm, verwirf } from "../preisdokument/api";
import { franken, gruppiere, laeuftNoch, offeneSichere, statusText, zuordnungText } from "../preisdokument/ansicht";
import type { DokumentZeile, Uebersicht, VorschlagZeile } from "../preisdokument/typen";
import { ladeAblage, legeAb, loesche, pruefeErneut, setzeKategorie, verknuepfe } from "../dokumente/api";
import { ABLEGEN_FEHLT, ablageFehlerText, pruefungLaeuft, scanAnzeige, vorpruefen } from "../dokumente/ansicht";
import type { AblageAntwort, Kategorie } from "../dokumente/typen";
import { Marke } from "../ui/Kopfzeile";
import { useViewer } from "../viewer/useViewer";
import { alleSicherenText, antwortFolge, datum, fuerBauteil, kandidaten, sortiert, startAuswahl, umfang, type Kandidat } from "./dokumenteAnsicht";
import { AblageHinweise, AkteDetail, AkteListe, DetailLeer, useAblegen, type AblageHinweis } from "./DokumenteAkte";
import "./Erneuerungsplan.css";
import "./Dokumente.css";

const F = TOKENS.farbe;
const stil = {
  "--ep-grund": F.grund, "--ep-flaeche": F.flaeche, "--ep-flaeche-2": F.flaecheSekundaer, "--ep-grau-1": F.grau1, "--ep-grau-2": F.grau2, "--ep-grau-3": F.grau3,
  "--ep-text": F.text, "--ep-sekundaer": F.textSekundaer, "--ep-sekundaer-kachel": F.textSekundaerKachel, "--ep-sekundaer-eis": F.textSekundaerEis,
  "--ep-link": F.link, "--ep-link-hover": F.linkHover, "--ep-eis": F.eis, "--ep-akzent": F.eisAkzent,
  "--ep-ok": F.statusOk, "--ep-ok-text": F.statusOkText, "--ep-heizung": F.kooHeizung, "--ep-heizung-grund": F.kooHeizungGrund,
  "--ep-warnung": F.statusWarnung, "--ep-stoerung": F.statusStoerung, "--ep-warnung-text": F.statusWarnungText, "--ep-stoerung-text": F.statusStoerungText,
  "--ep-schrift": TOKENS.typografie.familie, "--ep-schatten": TOKENS.schatten.panel, "--ep-radius": `${TOKENS.radius.panelPx}px`, "--ep-radius-kachel": `${TOKENS.radius.kachelPx}px`,
  "--ep-hover-ms": `${TOKENS.bewegung.hoverMs}ms`, "--ep-panel-ms": `${TOKENS.bewegung.panelMs}ms`, "--ep-kurve": TOKENS.bewegung.kurve,
  "--tw-text": F.text, "--tw-eis": F.eis,
} as CSSProperties;

const MELDUNG_409 = "Die Daten wurden inzwischen geändert. Neu laden, um mit dem aktuellen Stand weiterzuarbeiten.";
const MELDUNG_HAND = "Von Hand erfasster Preis wird ersetzt. Übernehmen?";
const POLL_MS = 2000;

type Ansicht = "alle" | "preise";
interface Props {
  gebaeudeId: string; name: string;
  /** Einstieg aus der Anlagenkarte: nur Vorschläge für dieses Bauteil (Ansicht "preise"). */
  bauteilId?: string;
  /** Startansicht: Kopf-Einstieg "alle", Einstiege "Preise aus Dokumenten" "preise". */
  ansicht?: Ansicht;
  zurueckText: string;
  onZurueck: () => void;
  onAbgelaufen: () => void;
}

type Aktion = (e: unknown) => void;
const fehlerText = (e: unknown, fallback = "Aktion fehlgeschlagen.") => ablageFehlerText(fehlerCode(e), e instanceof ApiFehler ? e.status : undefined, fallback);

export function Dokumente({ gebaeudeId, name, bauteilId, ansicht: startAnsicht = "alle", zurueckText, onZurueck, onAbgelaufen }: Props) {
  const [ansicht, setAnsicht] = useState<Ansicht>(startAnsicht);
  const [ablage, setAblage] = useState<AblageAntwort | null>(null);
  const [u, setU] = useState<Uebersicht | null>(null);
  // "aus": Preis aus Dokument nicht lesbar (404) -> kein Umschalter, nur die Ablage.
  const [preise, setPreise] = useState<"laden" | "an" | "aus">("laden");
  const [ld, setLd] = useState<LdStand | null>(null);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; art: "ok" | "fehler" } | null>(null);
  const [filterId, setFilterId] = useState<string | null>(bauteilId ?? null);
  const [ablegen, setAblegen] = useState<string[]>([]);
  const [hinweise, setHinweise] = useState<AblageHinweis[]>([]);
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [aktivDok, setAktivDok] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);
  // Nur die zuletzt begonnene Anfrage setzt die Übersicht: eine ältere Poll-Antwort überschreibt nie das Ergebnis einer Aktion (inkl. stand).
  const folge = useRef(antwortFolge()).current;
  const [takt, setTakt] = useState(0);
  const viewer = useViewer(gebaeudeId, { onAbgelaufen, onFehlt: (text) => setMeldung({ text, art: "fehler" }) });

  const fehlerBehandeln = useCallback<Aktion>((e) => {
    if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
    else if (fehlerCode(e) === "stand_veraltet") setKonflikt(true);
    else setMeldung({ text: fehlerText(e), art: "fehler" });
  }, [onAbgelaufen]);

  const ladeLd = useCallback(() => holeJson<LdStand>("/api/lebensdauer/gebaeude/" + gebaeudeId).then(setLd, () => { /* Kandidaten bleiben leer */ }), [gebaeudeId]);
  const laden = useCallback(() => {
    let aktiv = true;
    setFehler(null); setKonflikt(false);
    ladeAblage(gebaeudeId).then((a) => { if (aktiv) setAblage(a); }, (e: unknown) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else setFehler(fehlerText(e, "Dokumente konnten nicht geladen werden."));
    });
    const nr = folge.neu();
    ladeUebersicht(gebaeudeId).then((x) => { if (aktiv && folge.aktuell(nr)) { setU(x); setPreise("an"); } }, (e: unknown) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else { setPreise("aus"); setAnsicht("alle"); }
    });
    void ladeLd();
    holeJson<Katalog>("/api/katalog/v2").then((k) => { if (aktiv) setKatalog(k); }, () => { /* Namen fallen auf Katalog-ID zurueck */ });
    return () => { aktiv = false; };
  }, [gebaeudeId, onAbgelaufen, ladeLd, folge]);
  useEffect(() => laden(), [laden]);

  /** Übersicht neu holen; die Antwort zählt nur, wenn seither keine neuere Anfrage begonnen hat. */
  const aktualisiere = useCallback(async () => {
    const nr = folge.neu();
    const x = await ladeUebersicht(gebaeudeId);
    if (folge.aktuell(nr)) setU(x);
    return x;
  }, [folge, gebaeudeId]);
  const ablageNeu = useCallback(async () => {
    const a = await ladeAblage(gebaeudeId);
    setAblage(a);
    if (preise === "an") await aktualisiere().catch(() => { /* Preis-Übersicht beim nächsten Takt */ });
    return a;
  }, [gebaeudeId, preise, aktualisiere]);

  // Solange ein Dokument gelesen wird: alle 2 s neu laden, nicht während einer Aktion. Nach jedem Versuch (auch
  // verworfen oder fehlgeschlagen) neu planen, damit das Pollen nie still stehen bleibt.
  const pollen = !!u && laeuftNoch(u);
  useEffect(() => {
    if (!pollen || laeuft) return;
    let aktiv = true;
    const t = window.setTimeout(() => {
      aktualisiere().catch((e: unknown) => { if (e instanceof ApiFehler && e.status === 401) onAbgelaufen(); /* sonst beim nächsten Takt erneut */ })
        .finally(() => { if (aktiv) setTakt((n) => n + 1); });
    }, POLL_MS);
    return () => { aktiv = false; window.clearTimeout(t); };
  }, [pollen, laeuft, takt, aktualisiere, onAbgelaufen]);
  // Solange eine Virenprüfung läuft: Ablage alle 2 s neu laden (jede Antwort plant den nächsten Takt).
  const pruefen = !!ablage && pruefungLaeuft(ablage.dokumente);
  useEffect(() => {
    if (!pruefen || laeuft) return;
    const t = window.setTimeout(() => {
      ablageNeu().catch((e: unknown) => { if (e instanceof ApiFehler && e.status === 401) onAbgelaufen(); else setAblage((a) => (a ? { ...a } : a)); });
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [pruefen, laeuft, ablage, ablageNeu, onAbgelaufen]);

  useEffect(() => {
    if (!meldung || meldung.art !== "ok") return;
    const t = window.setTimeout(() => setMeldung(null), 6000);
    return () => window.clearTimeout(t);
  }, [meldung]);

  // Erstes Dokument vorwählen (neuestes); gelöschte Auswahl fällt auf das nächste zurück.
  useEffect(() => {
    if (!ablage) return;
    if (aktivId && ablage.dokumente.some((d) => d.id === aktivId)) return;
    setAktivId(ablage.dokumente.length ? ablage.dokumente[0].id : null); // Server: neueste zuerst
  }, [ablage, aktivId]);

  const nameVon = useCallback((id: string) => anzeigeName(id, katalog?.eintraege ?? []), [katalog]);
  const darfAblage = ablage?.darfAendern === true;
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
  const offenGefiltert = gruppen.je.reduce((n, g) => n + g.vorschlaege.filter((v) => v.status === "offen").length, 0);

  /** Dokument im Viewer öffnen (aus der geladenen Ablage, sonst nachladen). */
  const oeffneDok = (id: string, seite?: number) => {
    const d = ablage?.dokumente.find((x) => x.id === id);
    if (d) viewer.oeffne(d, seite); else void viewer.oeffneId(id, seite);
  };

  async function dateienAblegen(liste: File[], o: { kategorie?: Kategorie; nurPdf?: boolean } = {}) {
    const { ok, zuGross } = vorpruefen(liste);
    const neu: AblageHinweis[] = zuGross.map((f) => ({ datei: f.name, text: ablageFehlerText("zu_gross"), art: "fehler" }));
    setHinweise(neu);
    if (!ok.length) return;
    setAblegen(ok.map((f) => f.name));
    let zuletzt: string | null = null;
    for (const f of ok) {
      try {
        const r = await legeAb(gebaeudeId, f, o.kategorie ? { kategorie: o.kategorie } : {});
        // Gleicher Inhalt schon abgelegt: der Server antwortet mit dem bestehenden Dokument (200) -> melden und hinzeigen.
        if (!r.neu) neu.push({ datei: f.name, text: r.zeile.dateiname === f.name ? "Ist schon abgelegt." : `Ist schon abgelegt als ${r.zeile.dateiname}.`, art: "hinweis" });
        zuletzt = r.zeile.id;
      } catch (e) {
        if (e instanceof ApiFehler && e.status === 401) { onAbgelaufen(); return; }
        neu.push({ datei: f.name, text: fehlerText(e, ABLEGEN_FEHLT), art: "fehler" });
      }
      setAblegen((a) => a.filter((n) => n !== f.name));
    }
    setHinweise([...neu]);
    try { await ablageNeu(); } catch (e) { fehlerBehandeln(e); }
    if (zuletzt) {
      const id = zuletzt;
      setAktivId(id); setAktivDok(id);
      requestAnimationFrame(() => document.getElementById(ansicht === "alle" ? `dk-z-${id}` : `dk-dok-${id}`)?.scrollIntoView({ block: "nearest" }));
    }
  }

  async function mitStand(f: () => Promise<Uebersicht>, nachher?: (x: Uebersicht) => void) {
    setLaeuft(true); setMeldung(null);
    const nr = folge.neu();
    try { const x = await f(); if (folge.aktuell(nr)) setU(x); setKonflikt(false); nachher?.(x); void ladeLd(); }
    finally { setLaeuft(false); }
  }
  /** Aktion an der Ablage (Kategorie, Verknüpfen, Erneut prüfen, Löschen), danach Ablage und Übersicht neu. */
  async function ablageAktion(f: () => Promise<unknown>, ok?: string) {
    setLaeuft(true); setMeldung(null);
    try { await f(); await ablageNeu(); if (ok) setMeldung({ text: ok, art: "ok" }); }
    catch (e) { fehlerBehandeln(e); try { await ablageNeu(); } catch { /* Stand bleibt */ } }
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
  const neuLesen = async (id: string, dateiname: string) => {
    try { await liesNeu(id); await aktualisiere(); }
    catch (e) {
      if (fehlerCode(e) === "liest_bereits") setMeldung({ text: ablageFehlerText("liest_bereits"), art: "ok" });
      else fehlerBehandeln(e);
    }
  };
  const loeschen = (id: string, dateiname: string) => ablageAktion(() => loesche(id), `${dateiname} gelöscht. Übernommene Preise bleiben erhalten.`);
  const zeigeDokument = (id: string) => {
    setAktivDok(id);
    document.getElementById(`dk-gruppe-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const karte = (v: VorschlagZeile, d: DokumentZeile, mitDatei: boolean) => (
    <VorschlagKarte key={v.id} v={v} dokument={d} mitDatei={mitDatei} darf={darf} laeuft={laeuft}
      kandidaten={kandidaten(ld, v.katalogId, nameVon)} typName={v.katalogId ? nameVon(v.katalogId) : null}
      start={startAuswahl(v, filter)} hervor={filter?.bauteilId ?? null}
      onUebernehmen={uebernehmen} onVerwerfen={verwerfen} onFundstelle={(seite) => oeffneDok(d.id, seite)} />
  );

  const filterText = filterBauteil ? `${nameVon(filterBauteil.katalogId)} · ${filterBauteil.ort}` : "gewähltes Bauteil";
  const aktiv = ablage?.dokumente.find((d) => d.id === aktivId) ?? null;
  const aktivPreise = aktiv ? u?.dokumente.find((d) => d.id === aktiv.id) ?? null : null;
  const lesbar = !!aktiv && aktiv.art === "pdf" && aktiv.scanStatus === "sauber" && an && darf && !!aktivPreise
    && aktivPreise.status !== "neu" && aktivPreise.status !== "liest";
  const zeigeUmschalter = preise === "an";

  return (
    <main className="ep dk" style={stil} aria-label="Dokumente">
      <header className="ep-kopf">
        <button type="button" className="ep-zurueck" onClick={onZurueck}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{zurueckText}</button>
        <div className="ep-titel">
          <Marke />
          <h1>Dokumente<span>{name}</span></h1>
        </div>
        {ansicht === "preise" && u && darf && sichere > 0
          ? <button type="button" className="ep-knopf ep-knopf-haupt" disabled={laeuft} onClick={() => void alleUebernehmen()}>
            <Check size={15} strokeWidth={2} aria-hidden="true" />Alle sicheren übernehmen ({sichere})</button>
          : <span />}
      </header>

      {zeigeUmschalter && <div className="dk-umschalter-zeile">
        <div className="dk-umschalter" role="tablist" aria-label="Ansicht">
          <button type="button" role="tab" id="dk-tab-alle" aria-selected={ansicht === "alle"} aria-controls="dk-bereich" onClick={() => setAnsicht("alle")}>
            Alle Dokumente{ablage && <span className="dk-umschalter-zahl">{ablage.dokumente.length}</span>}</button>
          <button type="button" role="tab" id="dk-tab-preise" aria-selected={ansicht === "preise"} aria-controls="dk-bereich" onClick={() => setAnsicht("preise")}>
            Preise prüfen<span className={`dk-umschalter-zahl${offen > 0 ? " dk-umschalter-offen" : ""}`}>{offen}</span></button>
        </div>
      </div>}

      {fehler && <p className="ep-meldung" role="alert">{fehler}</p>}
      {konflikt && <p className="ep-meldung ep-meldung-konflikt" role="alert"><TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />{MELDUNG_409}
        <button type="button" className="ep-knopf" onClick={laden}>Neu laden</button></p>}
      {!ablage && !fehler && <p className="ep-meldung ep-laden" role="status">Dokumente werden geladen …</p>}
      <p className="ui-sr" role="status" aria-live="polite">{meldung?.art === "ok" ? meldung.text : ""}</p>
      {ansicht === "alle" && meldung && <Meldung m={meldung} onZu={() => setMeldung(null)} schwebend />}

      {ablage && ansicht === "alle" && <div id="dk-bereich" className="dk-akte" role={zeigeUmschalter ? "tabpanel" : undefined} aria-labelledby={zeigeUmschalter ? "dk-tab-alle" : undefined}>
        <AkteListe dokumente={ablage.dokumente} darf={darfAblage} aktivId={aktivId} ablegen={ablegen} hinweise={hinweise}
          onWahl={setAktivId} onDateien={(f) => void dateienAblegen(f)} onHinweiseAus={() => setHinweise([])}
          onErneut={(d) => void ablageAktion(() => pruefeErneut(d.id))} />
        {aktiv
          ? <AkteDetail d={aktiv} bauteile={ablage.bauteile} katalog={katalog?.eintraege ?? []} darf={darfAblage} laeuft={laeuft}
            lesen={lesbar ? { text: aktivPreise!.status === "aus" ? "Preise lesen" : "Preise neu lesen", onLesen: () => void neuLesen(aktiv.id, aktiv.dateiname) } : null}
            onOeffnen={() => viewer.oeffne(aktiv)} onKategorie={(k) => void ablageAktion(() => setzeKategorie(aktiv.id, k))}
            onVerknuepfe={(ids) => void ablageAktion(() => verknuepfe(aktiv.id, ids))} onLoeschen={() => void loeschen(aktiv.id, aktiv.dateiname)}
            onErneut={() => void ablageAktion(() => pruefeErneut(aktiv.id))}>
            {aktivPreise && (aktivPreise.vorschlaege.length > 0 || aktivPreise.status === "neu" || aktivPreise.status === "liest") && <div className="dk-detail-block dk-detail-preise">
              <div className="dk-detail-block-kopf"><h3>Preisvorschläge <span className="ep-anzahl">{aktivPreise.vorschlaege.filter((v) => v.status === "offen").length} offen</span></h3>
                <span className={`dk-status dk-status-${aktivPreise.status === "neu" || aktivPreise.status === "liest" ? "liest" : "fertig"}`}>
                  {(aktivPreise.status === "neu" || aktivPreise.status === "liest") && <i aria-hidden="true" />}{statusText(aktivPreise)}</span></div>
              <div className="dk-karten">{sortiert(aktivPreise.vorschlaege).map((v) => karte(v, aktivPreise, false))}</div>
            </div>}
          </AkteDetail>
          : <DetailLeer darf={darfAblage} />}
      </div>}

      {ablage && ansicht === "preise" && preisAnsicht()}
      {viewer.element}
    </main>
  );

  // Als Funktion aufgerufen (keine eigene Komponente), sonst verlieren die Vorschlagskarten bei jedem Render ihren Zustand.
  function preisAnsicht() {
    if (!u) return <p className="ep-meldung ep-laden" role="status">Preisvorschläge werden geladen …</p>;
    return <div id="dk-bereich" className="dk-inhalt" role="tabpanel" aria-labelledby="dk-tab-preise">
      <PreisAblage u={u} darf={darf && darfAblage} an={an} aktivDok={aktivDok} filter={!!filter} ablegen={ablegen} hinweise={hinweise} feld={dateiFeld}
        onDateien={(f) => void dateienAblegen(f, { kategorie: "offerte" })} onHinweiseAus={() => setHinweise([])}
        onZeigen={zeigeDokument} onOeffnen={(id) => oeffneDok(id)} onLesen={(d) => void neuLesen(d.id, d.dateiname)} onLoeschen={(d) => void loeschen(d.id, d.dateiname)} />

      <section className="dk-vorschlaege" aria-labelledby="dk-vorschlaege-titel">
        <div className="dk-vorschlaege-kopf">
          <h2 id="dk-vorschlaege-titel">Preisvorschläge {(offen > 0 || filter) && <span className="ep-anzahl">{filter ? `${offenGefiltert} von ${offen} offen` : `${offen} offen`}</span>}</h2>
          {filter && <button type="button" className="ep-filter" onClick={() => setFilterId(null)} aria-label={`Filter ${filterText} aufheben`}>
            Nur {filterText}<X size={14} strokeWidth={2} aria-hidden="true" /></button>}
        </div>
        {meldung && <Meldung m={meldung} onZu={() => setMeldung(null)} />}

        {!an && <div className={`dk-aus${vorschlaegeDa ? " dk-aus-klein" : ""}`}>
          <ScanSearch size={vorschlaegeDa ? 16 : 22} strokeWidth={1.6} aria-hidden="true" />
          <p>Auslesen ist ausgeschaltet. Der Admin kann es einschalten.{vorschlaegeDa ? " Bestehende Vorschläge lassen sich weiter prüfen." : darf ? " Abgelegte PDFs bleiben beim Gebäude und lassen sich später lesen." : ""}</p>
        </div>}
        {an && !vorschlaegeDa && <div className="dk-leer">
          <ScanSearch size={22} strokeWidth={1.6} aria-hidden="true" />
          <p>{u.dokumente.length === 0
            ? "Offerte als PDF ablegen und «Preise lesen» wählen. Planora liest Positionen mit Ersatzpreis, zeigt die Fundstelle und schlägt passende Bauteile vor."
            : pollen ? "Dokumente werden gelesen. Vorschläge erscheinen hier." : "Noch keine Preise gelesen. Bei einer Offerte links «Preise lesen» wählen."}</p>
        </div>}
        {filter && vorschlaegeDa && gruppen.je.length === 0 && <div className="dk-leer">
          <ScanSearch size={22} strokeWidth={1.6} aria-hidden="true" />
          <p><strong>Noch kein Vorschlag für {filterText}.</strong>{darf ? "Offerte oder Rechnung links als PDF ablegen oder alle Vorschläge ansehen." : "Alle Vorschläge ansehen."}</p>
          <button type="button" className="ep-knopf" onClick={() => setFilterId(null)}>Filter aufheben</button>
        </div>}

        {gruppen.je.map(({ dokument: d, vorschlaege }) => (
          <div key={d.id} id={`dk-gruppe-${d.id}`} className={`dk-gruppe${aktivDok === d.id ? " dk-gruppe-aktiv" : ""}`}>
            <h3 className="dk-gruppe-kopf"><FileText size={15} strokeWidth={1.75} aria-hidden="true" /><span>{d.dateiname}</span>
              <button type="button" className="dk-link" onClick={() => oeffneDok(d.id)}>Öffnen<ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" /></button></h3>
            <div className="dk-karten">{vorschlaege.map((v) => karte(v, d, false))}</div>
          </div>
        ))}

        {gruppen.ohne.length > 0 && <div className="dk-gruppe dk-ohne">
          <h3 className="dk-gruppe-kopf">Nicht zugeordnet <span className="ep-anzahl">{gruppen.ohne.length}</span></h3>
          <p className="ep-nebentext">Positionen ohne passendes Bauteil im Gebäude, etwa Regiestunden oder Kleinmaterial.</p>
          <div className="dk-karten">{gruppen.ohne.map(({ dokument, v }) => karte(v, dokument, true))}</div>
        </div>}
      </section>
    </div>;
  }
}

function Meldung({ m, onZu, schwebend = false }: { m: { text: string; art: "ok" | "fehler" }; onZu: () => void; schwebend?: boolean }) {
  return <p className={`dk-meldung dk-meldung-${m.art}${schwebend ? " dk-meldung-schwebend" : ""}`} role={m.art === "fehler" ? "alert" : undefined}>
    {m.art === "ok" ? <Check size={15} strokeWidth={2} aria-hidden="true" /> : <TriangleAlert size={15} strokeWidth={2} aria-hidden="true" />}{m.text}
    <button type="button" className="dk-meldung-zu" aria-label="Meldung schliessen" onClick={onZu}><X size={14} strokeWidth={2} aria-hidden="true" /></button></p>;
}

/** Linke Spalte der Preis-Ansicht: PDFs mit Lesestand; Ablegen legt als Offerte ab (Preise lesen startet von Hand). */
function PreisAblage({ u, darf, an, aktivDok, filter, ablegen, hinweise, feld, onDateien, onHinweiseAus, onZeigen, onOeffnen, onLesen, onLoeschen }: {
  u: Uebersicht; darf: boolean; an: boolean; aktivDok: string | null; filter: boolean; ablegen: string[]; hinweise: AblageHinweis[];
  feld: RefObject<HTMLInputElement | null>;
  onDateien: (f: File[]) => void; onHinweiseAus: () => void; onZeigen: (id: string) => void; onOeffnen: (id: string) => void;
  onLesen: (d: DokumentZeile) => void; onLoeschen: (d: DokumentZeile) => void;
}) {
  const { ziehen, ziel } = useAblegen(darf, onDateien);
  return (
    <aside className={`ep-karte dk-liste${ziehen ? " dk-ziehen" : ""}`} aria-labelledby="dk-liste-titel" {...ziel}>
      <div className="ep-karte-kopf dk-liste-kopf">
        <h2 id="dk-liste-titel">PDF-Dokumente <span className="ep-anzahl">{u.dokumente.length}</span></h2>
      </div>
      {darf && <div className="dk-ablage">
        <input ref={feld} type="file" accept="application/pdf,.pdf" multiple className="ui-sr" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; onDateien(f); }} />
        <FilePlus2 size={20} strokeWidth={1.6} aria-hidden="true" />
        <p><strong>Offerte hierher ziehen</strong>PDF, Kategorie Offerte</p>
        <button type="button" className="ep-knopf" onClick={() => feld.current?.click()}>Datei wählen</button>
      </div>}
      <AblageHinweise hinweise={hinweise} onAus={onHinweiseAus} />
      {u.dokumente.length === 0 && ablegen.length === 0
        ? <p className="ep-leer dk-liste-leer">{darf ? "Noch keine PDF-Dokumente. Offerten und Rechnungen bleiben beim Gebäude." : "Noch keine PDF-Dokumente abgelegt."}</p>
        : <ul className="dk-dokumente">
          {u.dokumente.map((d) => <DokumentEintrag key={d.id} d={d} darf={darf} an={an} aktiv={aktivDok === d.id}
            zeigen={!filter && d.vorschlaege.length > 0} onZeigen={() => onZeigen(d.id)} onOeffnen={() => onOeffnen(d.id)} onNeuLesen={() => onLesen(d)} onLoeschen={() => onLoeschen(d)} />)}
          {ablegen.map((n) => <li key={"ab-" + n} className="dk-dok dk-dok-ablegen"><span className="dk-dok-icon" aria-hidden="true"><FileText size={16} strokeWidth={1.75} /></span>
            <span className="dk-dok-text"><span className="dk-dok-name">{n}</span><span className="dk-status dk-status-liest"><i aria-hidden="true" />wird abgelegt …</span></span></li>)}
        </ul>}
      {an && darf && <p className="dk-budget">KI-Budget diesen Monat: {u.budget.verbrauchtUsd.toFixed(2)} von {u.budget.limitUsd.toFixed(0)} USD</p>}
    </aside>
  );
}

function DokumentEintrag({ d, darf, an, aktiv, zeigen, onZeigen, onOeffnen, onNeuLesen, onLoeschen }: {
  d: DokumentZeile; darf: boolean; an: boolean; aktiv: boolean; zeigen: boolean; onZeigen: () => void; onOeffnen: () => void; onNeuLesen: () => void; onLoeschen: () => void;
}) {
  const [frage, setFrage] = useState(false);
  const sauber = d.scanStatus === "sauber";
  const liest = d.status === "neu" || d.status === "liest";
  const offen = d.vorschlaege.filter((v) => v.status === "offen").length;
  const scan = scanAnzeige({ scanStatus: d.scanStatus, scanGrund: null });
  // "aus" ist der Startwert neuer Dokumente: bei eingeschaltetem Auslesen heisst das "noch nicht gelesen".
  const statusKlasse = !sauber ? (scan.art === "laeuft" ? "liest" : scan.art === "abgelehnt" ? "abgelehnt" : "fehler") : liest ? "liest" : d.status === "fehler" || d.status === "abgebrochen" ? "fehler" : d.status === "aus" ? "aus" : "fertig";
  const status = !sauber ? scan.text : d.status === "aus" && an ? "Noch nicht gelesen"
    : d.status === "fertig" && d.vorschlaege.length > 0 && offen < d.vorschlaege.length ? `${statusText(d)}, ${offen === 0 ? "alle entschieden" : `${offen} offen`}` : statusText(d);
  return (
    <li id={`dk-dok-${d.id}`} className={`dk-dok${aktiv ? " dk-dok-aktiv" : ""}`}>
      <span className="dk-dok-icon" aria-hidden="true"><FileText size={16} strokeWidth={1.75} /></span>
      <span className="dk-dok-text">
        {zeigen
          ? <button type="button" className="dk-dok-name dk-dok-wahl" onClick={onZeigen} title={d.dateiname}>{d.dateiname}</button>
          : <span className="dk-dok-name" title={d.dateiname}>{d.dateiname}</span>}
        <span className="dk-dok-meta">{datum(d.hochgeladenAm)}, {d.seiten ? umfang(d) : `${Math.max(1, Math.round(d.groesse / 1024))} kB`}</span>
        <span className={`dk-status dk-status-${statusKlasse}`}>{(liest || (!sauber && scan.art === "laeuft")) && <i aria-hidden="true" />}{(statusKlasse === "fehler" || statusKlasse === "abgelehnt") && <TriangleAlert size={12} strokeWidth={2.2} aria-hidden="true" />}{status}</span>
        {darf && an && sauber && !liest && d.status === "aus" && <button type="button" className="dk-leise dk-dok-lesen" onClick={onNeuLesen}><ScanSearch size={13} strokeWidth={1.75} aria-hidden="true" />Preise lesen</button>}
      </span>
      <span className="dk-dok-aktionen">
        {sauber && <button type="button" className="dk-symbol" onClick={onOeffnen} aria-label={`${d.dateiname} öffnen`} title="Öffnen">
          <Eye size={15} strokeWidth={1.75} aria-hidden="true" /></button>}
        {darf && an && sauber && !liest && d.status !== "aus" && <button type="button" className="dk-symbol" onClick={onNeuLesen} aria-label={`${d.dateiname} erneut lesen`} title="Erneut lesen">
          <ScanSearch size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
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
  /** Fundstelle "Seite n" im Viewer öffnen. */
  onFundstelle: (seite: number) => void;
}

const OFFEN_BIS = 6;

function VorschlagKarte({ v, dokument, mitDatei, darf, laeuft, kandidaten, typName, start, hervor, onUebernehmen, onVerwerfen, onFundstelle }: KarteProps) {
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
          <span>{v.katalogId ? "Ersatzpreis netto je Stück" : "Betrag netto laut Dokument"}</span>
          {v.rechenweg && <span className="dk-vk-rechenweg">{v.rechenweg}</span>}
        </div>
      </div>
      <figure className="dk-beleg">
        <blockquote>{v.zitat}</blockquote>
        <figcaption><button type="button" className="dk-link" onClick={() => onFundstelle(v.seite)}
          aria-label={`Seite ${v.seite} von ${dokument.dateiname} im Viewer öffnen`}>S. {v.seite}<ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" /></button></figcaption>
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
