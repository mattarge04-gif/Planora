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
import { TwinLegende } from "../karten/TwinLegende";
import { anlagenZeilen, geschossListe, hinweisListe, kennzahlen, zentraleGeschoss } from "../dashboard";
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
  const frei = useRef<HTMLDivElement>(null);
  const hinweisKarte = useRef<HTMLElement>(null);

  useEffect(() => {
    let aktiv = true;
    setWelt(null); setBeschreibung(null); setKatalog(null); setFehler(null); setFokusId(null);
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
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setFokusId(null); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  // Freiraum der Kamera = gemessene freie Mittelfläche zwischen den Karten.
  const bereit = !!(welt && beschreibung && katalog && webgl);
  useLayoutEffect(() => {
    const el = frei.current;
    if (!el) return;
    const messen = () => {
      const r = el.getBoundingClientRect();
      const neu = { links: Math.round(r.left), oben: Math.round(r.top),
        rechts: Math.round(window.innerWidth - r.right), unten: Math.round(window.innerHeight - r.bottom) };
      setFreiraum((alt) => alt.links === neu.links && alt.oben === neu.oben && alt.rechts === neu.rechts && alt.unten === neu.unten ? alt : neu);
    };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    window.addEventListener("resize", messen);
    return () => { ro.disconnect(); window.removeEventListener("resize", messen); };
  }, [bereit]);

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
  const waehleModus = (m: Modus) => setFokusId(m === "uebersicht" ? null : fokusId ?? daten?.technikId ?? null);
  const geschossCode = useCallback((id: string) => welt?.geschosse.find((g) => g.id === id)?.code ?? "Geschoss", [welt]);
  const zeigeHinweise = () => {
    const k = hinweisKarte.current;
    if (!k) return;
    k.focus({ preventScroll: true });
    k.classList.remove("tw-hervor"); void k.offsetWidth; k.classList.add("tw-hervor");
  };
  const liegenschaft = liste?.find((g) => g.id === gebaeudeId)?.liegenschaftName ?? null;

  return (
    <main className="twin" style={stil} aria-label="Digital Twin">
      {bereit && <Szene3 welt={welt!} katalog={katalog!.eintraege} fokusId={fokusId} reduziert={reduziert} freiraum={freiraum} />}
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
          <div className="tw-links">
            <TwinGebaeude name={name} liegenschaft={liegenschaft} welt={welt} zahlen={daten.zahlen} />
            <TwinHinweise ref={hinweisKarte} hinweise={daten.hinweise} geschossCode={geschossCode} onZiel={setFokusId} />
          </div>
          <div className="tw-rechts">
            <TwinGeschosse geschosse={daten.geschosse} fokusId={fokusId} onFokus={setFokusId} />
            <TwinLegende fokus={fokusId !== null} />
          </div>
          <div className="tw-unten">
            <TwinAnlagen anlagen={daten.anlagen} fokusId={fokusId} onZiel={setFokusId} />
          </div>
        </>}
        <div className="tw-frei" ref={frei} aria-hidden="true" />
      </div>
    </main>
  );
}
