import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { ApiFehler, fehlerCode, holeJson } from "../api";
import type { LdStand } from "../lebensdauer/typen";
import { TOKENS } from "../design/tokens";
import { Szene3 } from "../szene3/Szene3";
import type { Freiraum } from "../szene3/kamera";
import type { Beschreibung, GebaeudeEintrag, Katalog, Welt } from "../typen";
import type { Befund } from "../szene3/router/typen";
import { Kopfzeile, type Modus } from "../ui/Kopfzeile";
import { TwinGebaeude } from "../karten/TwinGebaeude";
import { TwinHinweise } from "../karten/TwinHinweise";
import { TwinGeschosse } from "../karten/TwinGeschosse";
import { TwinAnlagen } from "../karten/TwinAnlagen";
import { TwinGruppe, TwinObjekt, TwinVerbindung } from "../karten/TwinObjekt";
import { anlagenBezug, gruppenKarte, gruppenVon } from "../karten/gruppenKarte";
import { TwinTooltip } from "../karten/TwinTooltip";
import { TwinSzenenTasten } from "../karten/TwinSzenenTasten";
import { TwinErneuerung } from "../karten/TwinErneuerung";
import { naechsteAnsicht, type AnsichtAktion } from "./ansichtModus";
import { ampelFarben } from "../szene3/ampelFaerbung";
import { ampelJeSymbol } from "../lebensdauer/ansicht";
import { speicher } from "../ui/speicher";
import type { BildschirmPunkt } from "../szene3/Interaktion";
import { anlagenZeilen, anzeigeName, symbolName, geschossListe, hinweisListe, kennzahlen, objektKarte, zentraleGeschoss, type AnlagenZeile, type Zielort } from "../dashboard";
import { leitungsHinweise } from "../szene3/router/hinweise";
import { pegelJeGeschoss } from "../szene3/pegelband";
import type { FilterStufe } from "../szene3/ampelFilter";
import { erneuerungFilter, POSTEN_TEXT, umschalten } from "../karten/erneuerungFilter";
import { anzeigeWelt } from "../szene3/gruppenNetz";
import { usePreiseVerfuegbar } from "./dokumenteVerfuegbar";
import { ladeAblage, legeAlleAb } from "../dokumente/api";
import { unterlagenFuer } from "../dokumente/ansicht";
import type { AblageAntwort } from "../dokumente/typen";
import { useViewer } from "../viewer/useViewer";
import "./Twin.css";

function webglVorhanden(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch { return false; }
}

const F = TOKENS.farbe;
const stil = {
  "--tw-grund": F.grund,
  "--tw-flaeche": F.flaeche,
  "--tw-flaeche-2": F.flaecheSekundaer,
  "--tw-grau-1": F.grau1,
  "--tw-grau-2": F.grau2,
  "--tw-grau-3": F.grau3,
  "--tw-text": F.text,
  "--tw-sekundaer": F.textSekundaer,
  "--tw-eis": F.eis,
  "--tw-eis-akzent": F.eisAkzent,
  "--tw-heizung": F.kooHeizung,
  "--tw-heizung-grund": F.kooHeizungGrund,
  "--tw-link": F.link,
  "--tw-link-hover": F.linkHover,
  "--tw-sekundaer-kachel": F.textSekundaerKachel,
  "--tw-sekundaer-eis": F.textSekundaerEis,
  "--tw-ok": F.statusOk,
  "--tw-warnung": F.statusWarnung,
  "--tw-stoerung": F.statusStoerung,
  "--tw-ok-text": F.statusOkText,
  "--tw-warnung-text": F.statusWarnungText,
  "--tw-stoerung-text": F.statusStoerungText,
  "--tw-panel-alpha": String(TOKENS.flaeche.panelDeckkraft),
  "--tw-panel-rahmen": TOKENS.flaeche.rahmen,
  "--tw-schatten": TOKENS.schatten.panel,
  "--tw-schatten-objekt": TOKENS.schatten.objekt,
  "--tw-radius": `${TOKENS.radius.panelPx}px`,
  "--tw-radius-kachel": `${TOKENS.radius.kachelPx}px`,
  "--tw-blur": `${TOKENS.flaeche.weichzeichnerPx}px`,
  "--tw-schrift": TOKENS.typografie.familie,
  "--tw-rand": `${TOKENS.abstand.seitenrandPx}px`,
  "--tw-hover-ms": `${TOKENS.bewegung.hoverMs}ms`,
  "--tw-panel-ms": `${TOKENS.bewegung.panelMs}ms`,
  "--tw-kurve": TOKENS.bewegung.kurve,
} as CSSProperties;

const FREIRAUM_START: Freiraum = { links: 368, rechts: 336, oben: 72, unten: 260 };

interface OrtZiel { geschossId: string; position?: { x: number; y: number; z: number } }

interface Props {
  gebaeudeId: string; name: string;
  onGebaeude: (g: GebaeudeEintrag) => void;
  onListe: () => void;
  onBearbeiten?: () => void;
  /** Öffnet die Seite Erneuerungsplan (nur sichtbar, wenn Lebensdauer geladen ist). */
  onPlan?: () => void;
  /** Öffnet die Seite Dokumente: "alle" (Ablage) oder "preise" (Preise prüfen, optional auf ein Bauteil gefiltert). */
  onDokumente?: (ansicht: "alle" | "preise", bauteilId?: string) => void;
  onAbmelden: () => void; onAbgelaufen: () => void;
}

export function Twin({ gebaeudeId, name, onGebaeude, onListe, onBearbeiten, onPlan, onDokumente, onAbmelden, onAbgelaufen }: Props) {
  const preiseAn = usePreiseVerfuegbar(gebaeudeId);
  // Preis-Einstiege nur, wenn "Preis aus Dokument" lesbar ist; die Ablage selbst ist immer erreichbar (Kernmodul).
  const zuPreisen = preiseAn && onDokumente ? (bauteilId?: string) => onDokumente("preise", bauteilId) : undefined;
  const [ablage, setAblage] = useState<AblageAntwort | null>(null);
  const ladeAblageNeu = useCallback(() => {
    ladeAblage(gebaeudeId).then(setAblage, (e: unknown) => { if (e instanceof ApiFehler && e.status === 401) onAbgelaufen(); /* sonst ohne Unterlagen */ });
  }, [gebaeudeId, onAbgelaufen]);
  useEffect(() => { setAblage(null); ladeAblageNeu(); }, [ladeAblageNeu]);
  const [viewerFehler, setViewerFehler] = useState<string | null>(null);
  const viewer = useViewer(gebaeudeId, { onAbgelaufen, onFehlt: setViewerFehler });
  const viewerOffen = useRef(false);
  viewerOffen.current = viewer.ziel !== null;
  const [welt, setWelt] = useState<Welt | null>(null);
  const [beschreibung, setBeschreibung] = useState<Beschreibung | null>(null);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [liste, setListe] = useState<GebaeudeEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [lebensdauer, setLebensdauer] = useState<LdStand | null>(null);
  const [fokusId, setFokusId] = useState<string | null>(null);
  const [reduziert, setReduziert] = useState(false);
  const [webgl] = useState(webglVorhanden);
  const [freiraum, setFreiraum] = useState<Freiraum>(FREIRAUM_START);
  const [ausgeblendet, setAusgeblendet] = useState<string[]>([]);
  const [separiert, setSepariert] = useState(false);
  const [erneuerung, setErneuerung] = useState(false);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  // «Zum Ort» ohne Anlage: Zielpunkt für die Kamera (Szene3-Prop `ziel`, von Codex vorgesehen).
  const [ortZiel, setOrtZiel] = useState<OrtZiel | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [punkt] = useState(() => speicher<BildschirmPunkt | null>(null));
  const links = useRef<HTMLElement>(null);
  const rechts = useRef<HTMLElement>(null);
  const unten = useRef<HTMLDivElement>(null);
  const objektRef = useRef<HTMLElement>(null);
  const hinweisKarte = useRef<HTMLElement>(null);
  const auswahlRef = useRef(auswahl);
  auswahlRef.current = auswahl;
  // Legende als Filter (Stufe 3): gewählte Posten, ODER-verknüpft; leer = kein Filter.
  const [posten, setPosten] = useState<ReadonlySet<FilterStufe>>(() => new Set());
  const postenRef = useRef(posten);
  postenRef.current = posten;

  useEffect(() => {
    let aktiv = true;
    setWelt(null); setBeschreibung(null); setKatalog(null); setFehler(null); setFokusId(null);
    setAuswahl(null); setAusgeblendet([]); setSepariert(false); setOrtZiel(null); setErneuerung(false);
    Promise.all([
      holeJson<Welt>(`/api/szene/gebaeude/${gebaeudeId}/welt`),
      holeJson<Beschreibung>(`/api/struktur/gebaeude/${gebaeudeId}/beschreibung`),
      holeJson<Katalog>("/api/katalog/v2"),
    ]).then(([w, b, k]) => {
      if (aktiv) { setWelt(w); setBeschreibung(b); setKatalog(k); }
    }, (e: Error) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else setFehler(e.message);
    });
    return () => { aktiv = false; };
  }, [gebaeudeId, onAbgelaufen]);

  // Lebensdauer getrennt laden: 404 = Modul aus, der Twin laeuft ohne weiter.
  useEffect(() => {
    let aktiv = true; setLebensdauer(null);
    holeJson<LdStand>(`/api/lebensdauer/gebaeude/${gebaeudeId}`).then((s) => { if (aktiv) setLebensdauer(s); }, (e: Error) => {
      if (aktiv && e instanceof ApiFehler && e.status === 401) onAbgelaufen();
    });
    return () => { aktiv = false; };
  }, [gebaeudeId, onAbgelaufen]);

  useEffect(() => {
    let aktiv = true;
    holeJson<GebaeudeEintrag[]>("/api/struktur/gebaeude").then((l) => { if (aktiv) setListe(l); }, (e: Error) => {
      if (aktiv && e instanceof ApiFehler && e.status === 401) onAbgelaufen();
    });
    return () => { aktiv = false; };
  }, [onAbgelaufen]);

  useEffect(() => {
    // Esc schliesst zuerst die Anlagenkarte, danach den Geschossschnitt.
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || viewerOffen.current) return; // offener Viewer schliesst zuerst (eigener Esc)
      setOrtZiel(null);
      // Reihenfolge: Anlagenkarte, dann Filter, dann Geschossschnitt.
      if (auswahlRef.current) setAuswahl(null);
      else if (postenRef.current.size) setPosten(new Set());
      else setFokusId(null);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  // Freiraum der Kamera aus den gerenderten Kartenrechtecken (Kopf, linke/rechte Spalte, Tabellenoberkante).
  const bereit = !!(welt && beschreibung && katalog && webgl);
  useLayoutEffect(() => {
    const els = [links.current, rechts.current, unten.current];
    if (els.some((e) => !e)) return;
    const messen = () => {
      const [l, r, u] = els.map((e) => e!.getBoundingClientRect());
      const neu = { oben: Math.round(Math.min(l.top, r.top)), links: Math.round(l.right),
        rechts: Math.round(window.innerWidth - r.left), unten: Math.round(window.innerHeight - u.top) };
      setFreiraum((alt) => alt.links === neu.links && alt.oben === neu.oben && alt.rechts === neu.rechts && alt.unten === neu.unten ? alt : neu);
    };
    messen();
    const ro = new ResizeObserver(messen);
    els.forEach((e) => ro.observe(e!));
    window.addEventListener("resize", messen);
    return () => { ro.disconnect(); window.removeEventListener("resize", messen); };
  }, [bereit, !!(welt && beschreibung && katalog)]);

  // Hinweis aus den Befunden der gezeichneten Leitungsführung (Technik3 meldet sie; keine zweite Berechnung).
  // An den Welt-Hash gebunden: Befunde einer vorherigen Welt gelten nicht (Kind-Effekte laufen vor Eltern-Effekten).
  const [leitungsBefunde, setLeitungsBefunde] = useState<{ hash: string; befunde: Befund[] } | null>(null);
  const befundeMelden = useCallback((befunde: Befund[], hash: string) => setLeitungsBefunde({ hash, befunde }), []);
  const leitungsHinweis = useMemo(() => (welt && leitungsBefunde?.hash === welt.hash ? leitungsHinweise(welt, leitungsBefunde.befunde) : []),
    [welt, leitungsBefunde]);
  const daten = useMemo(() => {
    if (!welt || !beschreibung || !katalog) return null;
    const geschosse = geschossListe(welt);
    const hoehe = new Map(geschosse.map((g) => [g.id, g.yUnten]));
    // Tabelle von unten nach oben (Zentrale zuerst), sonst Reihenfolge der Welt.
    const anlagen = anlagenZeilen(welt, beschreibung, katalog.eintraege).map((a, i) => ({ a, i }))
      .sort((x, y) => (hoehe.get(x.a.geschossId ?? "") ?? 0) - (hoehe.get(y.a.geschossId ?? "") ?? 0) || x.i - y.i).map((x) => x.a);
    return {
      zahlen: kennzahlen(welt, beschreibung), geschosse, anlagen,
      hinweise: [...hinweisListe(welt, beschreibung), ...leitungsHinweis],
      technikId: zentraleGeschoss(welt),
    };
  }, [welt, beschreibung, katalog, leitungsHinweis]);

  const modus: Modus = fokusId === null ? "uebersicht" : "technik";
  const waehleModus = (m: Modus) => { setOrtZiel(null); setFokusId(m === "uebersicht" ? null : fokusId ?? daten?.technikId ?? null); };
  const geschossCode = useCallback((id: string) => welt?.geschosse.find((g) => g.id === id)?.code ?? "Geschoss", [welt]);
  const zeigeHinweise = () => {
    const k = hinweisKarte.current;
    if (!k) return;
    k.focus({ preventScroll: true });
    k.classList.remove("tw-hervor"); void k.offsetWidth; k.classList.add("tw-hervor");
  };
  const karte = useMemo(() => welt && beschreibung && katalog && auswahl
    ? objektKarte(welt, beschreibung, katalog.eintraege, auswahl) : null, [welt, beschreibung, katalog, auswahl]);
  const straenge = useMemo(() => welt && katalog ? gruppenVon(welt, katalog.eintraege) : [], [welt, katalog]);
  const ampel = useMemo(() => erneuerung && lebensdauer && welt ? ampelFarben(lebensdauer, welt.symbole) : undefined,
    [erneuerung, lebensdauer, welt]);
  const ampelStufe = useMemo(() => erneuerung && lebensdauer && welt ? ampelJeSymbol(lebensdauer, welt.symbole) : undefined,
    [erneuerung, lebensdauer, welt]);
  // Mini-Pegel der Geschoss-Karte: gleiche Quelle wie das Pegelband im 3D (Kritik r3 Top 1).
  // Symbole wie in der Szene (anzeigeWelt: Inline-Bauteile auf der Leitung), damit Zähler und Band übereinstimmen.
  const pegel = useMemo(() => ampelStufe && welt && katalog
    ? pegelJeGeschoss(welt, anzeigeWelt(welt, katalog.eintraege).symbole, ampelStufe) : undefined, [ampelStufe, welt, katalog]);
  // Gegenseitiges Hervorheben Geschosszeile <-> Band, nur im Modus Erneuerung.
  const [geschossHover, setGeschossHover] = useState<string | null>(null);
  useEffect(() => { if (!erneuerung) { setGeschossHover(null); setPosten(new Set()); } }, [erneuerung]);
  const filterErgebnis = useMemo(() => erneuerung && lebensdauer && daten
    ? erneuerungFilter(lebensdauer.ergebnis, daten.anlagen, posten) : null, [erneuerung, lebensdauer, daten, posten]);
  // Ein Treffer hervorgehoben (Liste: Hover/Fokus/Pfeiltasten; sonst 3D-Hover auf einen Treffer), Kritik r5 Top 2.
  const [trefferFokus, setTrefferFokus] = useState<string | null>(null);
  const [trefferFahrt, setTrefferFahrt] = useState(false);
  const fokussiereTreffer = (k: string | null, fahrt = false) => { setTrefferFokus(k); setTrefferFahrt(fahrt && k !== null); };
  const hoverTreffer = hover && filterErgebnis?.filter.treffer.has(hover) ? hover : null;
  const filterAn = !!filterErgebnis;
  useEffect(() => {
    setTrefferFokus(null);
    // Spalte nach oben: der Kopf der Erneuerungskarte bleibt sichtbar (Kritik r5).
    if (links.current) links.current.scrollTop = 0;
  }, [posten]);
  useEffect(() => { if (!filterAn && links.current) links.current.scrollTop = 0; }, [filterAn]);
  const bezug = useCallback((a: AnlagenZeile) => anlagenBezug(a.schluessel, a.standort, straenge), [straenge]);
  /** Posten umschalten; bei Treffern das Geschoss mit den meisten öffnen (Szene fährt auf die Treffer). */
  const umPosten = (p: FilterStufe) => {
    const neu = umschalten(posten, p);
    setPosten(neu);
    setOrtZiel(null); setAuswahl(null);
    const e = lebensdauer && daten ? erneuerungFilter(lebensdauer.ergebnis, daten.anlagen, neu) : null;
    if (e?.bestes) { setAusgeblendet((a) => a.filter((x) => x !== e.bestes)); setFokusId(e.bestes); }
    if (e) sage(`Filter ${[...neu].map((x) => POSTEN_TEXT[x]).join(" oder ")}: ${e.treffer.length === 1 ? "1 Anlage" : `${e.treffer.length} Anlagen`}`);
    else sage("Filter aufgehoben");
  };
  const gruppe = useMemo(() => welt && katalog && auswahl && !karte
    ? gruppenKarte(welt, katalog.eintraege, auswahl, straenge) : null, [welt, katalog, auswahl, karte, straenge]);
  const hoverName = useMemo(() => {
    const s = hover && welt?.symbole.find((x) => x.schluessel === hover);
    if (s) return symbolName(welt!, s, katalog?.eintraege);
    const g = hover && welt && katalog ? gruppenKarte(welt, katalog.eintraege, hover, straenge) : null;
    return g ? `${g.titel} · ${g.art}` : null;
  }, [hover, welt, katalog, straenge]);
  /** Ort öffnen: Geschoss einblenden und schneiden, dann Anlage wählen (falls bekannt). */
  const zumOrt = (ziel: Pick<Zielort, "geschossId" | "schluessel"> & { position?: Zielort["position"] }) => {
    setOrtZiel(!ziel.schluessel && ziel.geschossId
      ? { geschossId: ziel.geschossId, ...(ziel.position ? { position: ziel.position } : {}) } : null);
    if (ziel.geschossId) {
      const g = ziel.geschossId;
      setAusgeblendet((a) => a.filter((x) => x !== g));
      setFokusId(g);
    }
    setAuswahl(ziel.schluessel);
  };
  const waehle3d = useCallback((s: string | null) => { setOrtZiel(null); setAuswahl(s); }, []);
  const waehleZeile = (a: AnlagenZeile) => zumOrt({ geschossId: a.geschossId, schluessel: a.schluessel });
  const ausblenden = (id: string) => setAusgeblendet((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  const punktSetzen = useCallback((p: BildschirmPunkt | null) => punkt.setzen(p), [punkt]);
  const schliesseKarte = () => {
    const s = auswahl;
    setAuswahl(null);
    // Fokus nicht verlieren: zurück auf die Tabellenzeile der Anlage.
    requestAnimationFrame(() => {
      if (s) document.querySelector<HTMLElement>(`tr[data-schluessel="${CSS.escape(s)}"]`)?.focus({ preventScroll: true });
    });
  };

  // Ansagen für Screenreader (aria-live): Auswahl, Geschoss, Separieren.
  const [ansage, setAnsage] = useState("");
  const vorher = useRef({ auswahl, fokusId, separiert, erst: true });
  useEffect(() => {
    const v = vorher.current;
    vorher.current = { auswahl, fokusId, separiert, erst: false };
    if (v.erst || !welt) return;
    if (v.auswahl !== auswahl) setAnsage(karte ? `${karte.name} gewählt, ${karte.standort}`
      : gruppe ? `Heizgruppe ${gruppe.titel} gewählt, ${gruppe.verbraucher.length} Verbraucher` : "Auswahl aufgehoben");
    else if (v.fokusId !== fokusId) setAnsage(fokusId ? `${geschossCode(fokusId)} geöffnet` : "Übersicht, Gebäude geschlossen");
    else if (v.separiert !== separiert) setAnsage(separiert ? "Geschosse separiert" : "Geschosse zusammengeführt");
  }, [auswahl, fokusId, separiert, karte, gruppe, welt, geschossCode]);

  /** Ansage auch bei gleichem Text erneut auslösen. */
  const sage = (text: string) => { setAnsage(""); requestAnimationFrame(() => setAnsage(text)); };
  const [tastenMeldung, setTastenMeldung] = useState<string | null>(null);
  useEffect(() => {
    if (!tastenMeldung) return;
    const t = window.setTimeout(() => setTastenMeldung(null), 2400);
    return () => window.clearTimeout(t);
  }, [tastenMeldung]);
  // Ansicht und Erneuerung nach einer Regel (ansichtModus.ts): Erneuerung gilt in Übersicht und Technik.
  const ansichtAnwenden = (a: AnsichtAktion) => {
    const r = naechsteAnsicht({ ansicht: modus, erneuerung }, a);
    setErneuerung(r.stand.erneuerung);
    if (r.stand.ansicht !== modus) waehleModus(r.stand.ansicht);
    if (r.meldung) sage(r.meldung);
  };
  const umErneuerung = (an: boolean) => ansichtAnwenden({ art: "erneuerung", an });
  const technikTaste = () => {
    if (fokusId) {
      const text = `Bereits im Technikmodus, ${geschossCode(fokusId)}`;
      setTastenMeldung(text); sage(text);
    } else waehleModus("technik");
  };

  /** "+ Ablegen" in der Anlagenkarte: Dateien ablegen und gleich mit den Bauteilen verknüpfen (auch beim Duplikat, Ruling 5). */
  const ablegenFuer = async (dateien: File[], bauteilIds: string[]) => {
    const r = await legeAlleAb(gebaeudeId, dateien, { bauteilIds });
    if (r.abgelaufen) onAbgelaufen(); else ladeAblageNeu();
    return r;
  };

  const liegenschaft = liste?.find((g) => g.id === gebaeudeId)?.liegenschaftName ?? null;

  return (
    <main className="twin" style={stil} aria-label="Digital Twin">
      {(karte || gruppe) && <TwinVerbindung punkt={punkt} kartenRef={objektRef} />}
      {bereit && <TwinTooltip text={hoverName} />}
      <div className="tw-flaeche">
        <Kopfzeile modus={modus} modusAktiv={!!daten} onModus={(m) => ansichtAnwenden({ art: "ansicht", ansicht: m })}
          gebaeudeId={gebaeudeId} gebaeudeName={name} gebaeude={liste} onGebaeude={onGebaeude}
          hinweise={daten ? daten.hinweise.length : null} onHinweise={zeigeHinweise}
          reduziert={reduziert} onReduziert={setReduziert}
          erneuerung={lebensdauer ? { an: erneuerung, onUm: umErneuerung } : undefined}
          onListe={onListe} onBearbeiten={onBearbeiten} onPlan={lebensdauer ? onPlan : undefined} onDokumente={onDokumente ? () => onDokumente("alle") : undefined} onAbmelden={onAbmelden} />

        {(!webgl || fehler || !daten) && <div className="tw-meldung-platz">
          {!webgl && <p className="ui-glas tw-meldung" role="alert">3D-Darstellung nicht verfügbar. Dein Browser unterstützt WebGL 2 nicht.</p>}
          {webgl && fehler && <p className="ui-glas tw-meldung" role="alert">{fehler}</p>}
          {webgl && !fehler && !daten && <p className="tw-meldung tw-laden" role="status">Gebäudemodell wird geladen …</p>}
        </div>}

        {welt && daten && <>
          <aside className="tw-links" ref={links} aria-label="Gebäude und Hinweise">
            <TwinGebaeude name={name} liegenschaft={liegenschaft} welt={welt} zahlen={daten.zahlen} />
            {/* Legende links: rechts bleibt der Platz für Geschosse und Anlagenkarte */}
            {erneuerung && lebensdauer && <TwinErneuerung stand={lebensdauer} onPlan={onPlan} onDokumente={zuPreisen ? () => zuPreisen() : undefined} filter={{
              posten, onPosten: umPosten, onAufheben: () => { setPosten(new Set()); sage("Filter aufgehoben"); },
              treffer: filterErgebnis?.treffer ?? [], geschossCode, auswahl, onTreffer: waehleZeile,
              bezug, fokus: trefferFokus, onFokus: fokussiereTreffer, hover3d: hoverTreffer,
            }} />}
            <TwinHinweise ref={hinweisKarte} hinweise={daten.hinweise} geschossCode={geschossCode} onZiel={zumOrt} />
          </aside>
          {/* Szene im DOM zwischen linken und rechten Karten: ein Tab-Stopp (Canvas) an der richtigen Stelle. */}
          {bereit && <Szene3 welt={welt!} katalog={katalog!.eintraege} fokusId={fokusId} reduziert={reduziert} freiraum={freiraum}
            ausgeblendet={ausgeblendet} separiert={separiert} auswahl={auswahl}
            onAuswahl={waehle3d} onHover={setHover} onAuswahlPunkt={punktSetzen} ziel={ortZiel} tastatur onLeitungsBefunde={befundeMelden} ampel={ampel}
            onGeschoss={(id) => { setOrtZiel(null); setFokusId(id); }}
            geschossHover={erneuerung ? geschossHover : null} onGeschossHover={erneuerung ? setGeschossHover : undefined}
            filter={filterErgebnis?.filter ?? null} filterFokus={filterErgebnis ? trefferFokus ?? hoverTreffer : null}
            filterFokusFahrt={!!filterErgebnis && trefferFokus !== null && trefferFahrt} />}
          {bereit && <TwinSzenenTasten name={name} geschosse={daten.geschosse} fokusId={fokusId}
            onFokus={(id) => { setOrtZiel(null); setFokusId(id); }}
            onTechnik={technikTaste} meldung={tastenMeldung} separiert={separiert} onSeparieren={setSepariert}
            erneuerung={erneuerung} onErneuerung={lebensdauer ? umErneuerung : undefined} />}
          <aside className="tw-rechts" ref={rechts} aria-label="Geschosse und Anlage">
            <TwinGeschosse geschosse={daten.geschosse} fokusId={fokusId} onFokus={(id) => { setOrtZiel(null); setFokusId(id); }}
              ausgeblendet={ausgeblendet} onAusblenden={ausblenden} separiert={separiert} onSeparieren={setSepariert} kompakt={!!(karte || gruppe)}
              pegel={pegel} hoverId={geschossHover} onHover={setGeschossHover} treffer={filterErgebnis?.jeGeschoss} />
            {karte
              ? <TwinObjekt key={karte.id} karte={karte} bezug={straenge.find((st) => st.zubehoer.includes(karte.schluessel)) ? bezug(karte) : null} kartenRef={objektRef} onSchliessen={schliesseKarte}
                lebensdauer={lebensdauer} darfAendern={lebensdauer?.darfAendern === true} onLebensdauer={setLebensdauer} onDokument={zuPreisen}
                onFundstelle={(id, seite) => { setViewerFehler(null); void viewer.oeffneId(id, seite); }} katalog={katalog?.eintraege} onAbgelaufen={onAbgelaufen}
                {...(ablage ? { unterlagen: unterlagenFuer(ablage.dokumente, karte.bauteilIds, ablage.bauteile), darfAblegen: ablage.darfAendern,
                  onOeffnen: viewer.oeffne, onNeuLaden: ladeAblageNeu, alleUnterlagen: ablage.dokumente, onAblegen: (dateien: File[]) => ablegenFuer(dateien, karte.bauteilIds) } : {})} />
              : gruppe ? <TwinGruppe key={gruppe.id} karte={gruppe} kartenRef={objektRef} onSchliessen={schliesseKarte} />
              : <p className="tw-objekt-leer">Anlage oder Leitung im Modell wählen, um Details zu sehen.</p>}
          </aside>
          <div className="tw-unten" ref={unten}>
            <TwinAnlagen anlagen={daten.anlagen} auswahl={auswahl} fokusId={fokusId} onWahl={waehleZeile} ampel={ampelStufe}
              filter={filterErgebnis ? { treffer: filterErgebnis.filter.treffer, onAufheben: () => { setPosten(new Set()); sage("Filter aufgehoben"); } } : null} />
          </div>
        </>}
      </div>
      <p className="ui-sr" role="status" aria-live="polite" aria-atomic="true">{ansage}</p>
      {viewerFehler && <p className="ui-glas tw-viewer-fehler" role="alert">{viewerFehler}
        <button type="button" className="tw-viewer-fehler-zu" onClick={() => setViewerFehler(null)} aria-label="Meldung schliessen"><X size={14} strokeWidth={2} aria-hidden="true" /></button></p>}
      {viewer.element}
    </main>
  );
}
