import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ApiFehler, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import { Szene3 } from "../szene3/Szene3";
import type { Freiraum } from "../szene3/kamera";
import type { Beschreibung, GebaeudeEintrag, Katalog, Welt } from "../typen";
import { Kopfzeile, type Modus } from "../ui/Kopfzeile";
import { TwinGebaeude } from "../karten/TwinGebaeude";
import { TwinHinweise } from "../karten/TwinHinweise";
import { TwinGeschosse } from "../karten/TwinGeschosse";
import { TwinAnlagen } from "../karten/TwinAnlagen";
import { TwinObjekt, TwinVerbindung } from "../karten/TwinObjekt";
import { TwinTooltip } from "../karten/TwinTooltip";
import { TwinSzenenTasten } from "../karten/TwinSzenenTasten";
import { speicher } from "../ui/speicher";
import type { BildschirmPunkt } from "../szene3/Interaktion";
import { anlagenZeilen, anzeigeName, geschossListe, hinweisListe, kennzahlen, objektKarte, zentraleGeschoss, type AnlagenZeile, type Zielort } from "../dashboard";
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
  onListe: () => void; onAnsicht: () => void; onEntwurf: () => void;
  onAbmelden: () => void; onAbgelaufen: () => void;
}

export function Twin({ gebaeudeId, name, onGebaeude, onListe, onAnsicht, onEntwurf, onAbmelden, onAbgelaufen }: Props) {
  const [welt, setWelt] = useState<Welt | null>(null);
  const [beschreibung, setBeschreibung] = useState<Beschreibung | null>(null);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [liste, setListe] = useState<GebaeudeEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<string | null>(null);
  const [reduziert, setReduziert] = useState(false);
  const [webgl] = useState(webglVorhanden);
  const [freiraum, setFreiraum] = useState<Freiraum>(FREIRAUM_START);
  const [ausgeblendet, setAusgeblendet] = useState<string[]>([]);
  const [separiert, setSepariert] = useState(false);
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

  useEffect(() => {
    let aktiv = true;
    setWelt(null); setBeschreibung(null); setKatalog(null); setFehler(null); setFokusId(null);
    setAuswahl(null); setAusgeblendet([]); setSepariert(false); setOrtZiel(null);
    Promise.all([
      holeJson<Welt>(`/api/szene/gebaeude/${gebaeudeId}/welt`),
      holeJson<Beschreibung>(`/api/struktur/gebaeude/${gebaeudeId}/beschreibung`),
      holeJson<Katalog>("/api/katalog/v1"),
    ]).then(([w, b, k]) => {
      if (aktiv) { setWelt(w); setBeschreibung(b); setKatalog(k); }
    }, (e: Error) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else setFehler(e.message);
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
      if (e.key !== "Escape") return;
      setOrtZiel(null);
      if (auswahlRef.current) setAuswahl(null); else setFokusId(null);
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

  const daten = useMemo(() => {
    if (!welt || !beschreibung || !katalog) return null;
    const geschosse = geschossListe(welt);
    const hoehe = new Map(geschosse.map((g) => [g.id, g.yUnten]));
    // Tabelle von unten nach oben (Zentrale zuerst), sonst Reihenfolge der Welt.
    const anlagen = anlagenZeilen(welt, beschreibung, katalog.eintraege).map((a, i) => ({ a, i }))
      .sort((x, y) => (hoehe.get(x.a.geschossId ?? "") ?? 0) - (hoehe.get(y.a.geschossId ?? "") ?? 0) || x.i - y.i).map((x) => x.a);
    return {
      zahlen: kennzahlen(welt, beschreibung), geschosse, anlagen,
      hinweise: hinweisListe(welt, beschreibung),
      technikId: zentraleGeschoss(welt),
    };
  }, [welt, beschreibung, katalog]);

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
  const hoverName = useMemo(() => {
    const s = hover && welt?.symbole.find((x) => x.schluessel === hover);
    return s ? anzeigeName(s.katalogId, katalog?.eintraege) : null;
  }, [hover, welt, katalog]);
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
    if (v.auswahl !== auswahl) setAnsage(karte ? `${karte.name} gewählt, ${karte.standort}` : "Auswahl aufgehoben");
    else if (v.fokusId !== fokusId) setAnsage(fokusId ? `${geschossCode(fokusId)} geöffnet` : "Übersicht, Gebäude geschlossen");
    else if (v.separiert !== separiert) setAnsage(separiert ? "Geschosse separiert" : "Geschosse zusammengeführt");
  }, [auswahl, fokusId, separiert, karte, welt, geschossCode]);

  const liegenschaft = liste?.find((g) => g.id === gebaeudeId)?.liegenschaftName ?? null;

  return (
    <main className="twin" style={stil} aria-label="Digital Twin">
      {karte && <TwinVerbindung punkt={punkt} kartenRef={objektRef} />}
      {bereit && <TwinTooltip text={hoverName} />}
      <div className="tw-flaeche">
        <Kopfzeile modus={modus} modusAktiv={!!daten} onModus={waehleModus}
          gebaeudeId={gebaeudeId} gebaeudeName={name} gebaeude={liste} onGebaeude={onGebaeude}
          hinweise={daten ? daten.hinweise.length : null} onHinweise={zeigeHinweise}
          reduziert={reduziert} onReduziert={setReduziert}
          onListe={onListe} onAnsicht={onAnsicht} onEntwurf={onEntwurf} onAbmelden={onAbmelden} />

        {(!webgl || fehler || !daten) && <div className="tw-meldung-platz">
          {!webgl && <p className="ui-glas tw-meldung" role="alert">3D-Darstellung nicht verfügbar. Dein Browser unterstützt WebGL 2 nicht.</p>}
          {webgl && fehler && <p className="ui-glas tw-meldung" role="alert">{fehler}</p>}
          {webgl && !fehler && !daten && <p className="tw-meldung tw-laden" role="status">Gebäudemodell wird geladen …</p>}
        </div>}

        {welt && daten && <>
          <aside className="tw-links" ref={links} aria-label="Gebäude und Hinweise">
            <TwinGebaeude name={name} liegenschaft={liegenschaft} welt={welt} zahlen={daten.zahlen} />
            <TwinHinweise ref={hinweisKarte} hinweise={daten.hinweise} geschossCode={geschossCode} onZiel={zumOrt} />
          </aside>
          {/* Szene im DOM zwischen linken und rechten Karten: ein Tab-Stopp (Canvas) an der richtigen Stelle. */}
          {bereit && <Szene3 welt={welt!} katalog={katalog!.eintraege} fokusId={fokusId} reduziert={reduziert} freiraum={freiraum}
            ausgeblendet={ausgeblendet} separiert={separiert} auswahl={auswahl}
            onAuswahl={waehle3d} onHover={setHover} onAuswahlPunkt={punktSetzen} ziel={ortZiel} tastatur />}
          {bereit && <TwinSzenenTasten name={name} geschosse={daten.geschosse} fokusId={fokusId}
            onFokus={(id) => { setOrtZiel(null); setFokusId(id); }}
            onTechnik={() => waehleModus("technik")} separiert={separiert} onSeparieren={setSepariert} />}
          <aside className="tw-rechts" ref={rechts} aria-label="Geschosse und Anlage">
            <TwinGeschosse geschosse={daten.geschosse} fokusId={fokusId} onFokus={(id) => { setOrtZiel(null); setFokusId(id); }}
              ausgeblendet={ausgeblendet} onAusblenden={ausblenden} separiert={separiert} onSeparieren={setSepariert} />
            {karte
              ? <TwinObjekt key={karte.id} karte={karte} kartenRef={objektRef} onSchliessen={schliesseKarte} />
              : <p className="tw-objekt-leer">Anlage im Modell oder in der Liste wählen, um Details zu sehen.</p>}
          </aside>
          <div className="tw-unten" ref={unten}>
            <TwinAnlagen anlagen={daten.anlagen} auswahl={auswahl} fokusId={fokusId} onWahl={waehleZeile} />
          </div>
        </>}
      </div>
      <p className="ui-sr" role="status" aria-live="polite" aria-atomic="true">{ansage}</p>
    </main>
  );
}
