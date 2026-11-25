import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Lock, Minus, Plus, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { AblageZeile } from "../dokumente/typen";
import { dateiUrl, ladeBytes } from "../dokumente/api";
import { ablageFehlerText, kategorieName, oeffnenArt, scanAnzeige } from "../dokumente/ansicht";
import { ApiFehler, fehlerCode } from "../api";
import { TOKENS } from "../design/tokens";
import { DokumentSymbol, endung } from "../ui/dokumentSymbol";
import {
  blaettereTreffer, jeSeite, klemmeSeite, klemmeVersatz, naechsterZoom, startTreffer, teileText, trefferListe, versatzUmPunkt, zoomEinpassen, ZOOM_STUFEN,
} from "./seiten";
import "./Viewer.css";

interface Props {
  dokument: AblageZeile;
  /** Startseite (Fundstelle "S. n"). */
  seite?: number;
  /** Suchbegriff, der beim Öffnen markiert wird (z. B. aus einer späteren Dokumentsuche). */
  markiere?: string;
  onSchliessen: () => void;
}

const F = TOKENS.farbe;
const stil = {
  "--vw-grund": F.grund, "--vw-flaeche": F.flaeche, "--vw-flaeche-2": F.flaecheSekundaer, "--vw-grau-1": F.grau1, "--vw-grau-2": F.grau2, "--vw-grau-3": F.grau3,
  "--vw-text": F.text, "--vw-sekundaer": F.textSekundaer, "--vw-sekundaer-kachel": F.textSekundaerKachel, "--vw-sekundaer-eis": F.textSekundaerEis,
  "--vw-link": F.link, "--vw-eis": F.eis, "--vw-akzent": F.eisAkzent, "--vw-stoerung-text": F.statusStoerungText, "--vw-warnung-text": F.statusWarnungText,
  "--vw-schrift": TOKENS.typografie.familie, "--vw-schatten": TOKENS.schatten.objekt, "--vw-radius": `${TOKENS.radius.panelPx}px`, "--vw-radius-kachel": `${TOKENS.radius.kachelPx}px`,
  "--vw-hover-ms": `${TOKENS.bewegung.hoverMs}ms`, "--vw-panel-ms": `${TOKENS.bewegung.panelMs}ms`, "--vw-kurve": TOKENS.bewegung.kurve,
} as CSSProperties;

const istEingabe = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
/** Innenabstand der Fläche (CSS .vw-flaeche): links/rechts 32, oben 28, unten 40. */
const RAND_B = 64, RAND_H = 68;
const BILD_MIN = 1, BILD_MAX = 8;
const fehlerVon = (e: unknown, fallback: string) => ablageFehlerText(fehlerCode(e), e instanceof ApiFehler ? e.status : undefined, fallback);

/** Overlay-Viewer (Esc schliesst): PDF mit Miniaturen, Seite n, Einpassen/Zoom, Textsuche mit Markierung; Bilder mit Zoom und Ziehen; Office nur Herunterladen. */
export function Viewer({ dokument, seite: start = 1, markiere, onSchliessen }: Props) {
  const art = oeffnenArt(dokument);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [seite, setSeite] = useState(start);
  const [seiteEingabe, setSeiteEingabe] = useState(String(start));
  const [zoom, setZoom] = useState<number | null>(null);
  const [eingepasst, setEingepasst] = useState(true);
  const [seitenMass, setSeitenMass] = useState<{ b: number; h: number } | null>(null);
  const [suche, setSuche] = useState(markiere ?? "");
  const [texte, setTexte] = useState<string[][] | null>(null);
  const [aktiv, setAktiv] = useState(-1);
  const [gezeichnet, setGezeichnet] = useState(false);
  const [textStand, setTextStand] = useState<{ seite: number; elemente: HTMLElement[]; texte: string[] } | null>(null);
  const [flaecheMass, setFlaecheMass] = useState<{ b: number; h: number }>({ b: 0, h: 0 });
  // Bild: Zoom relativ zum Einpassen (1 = ganz sichtbar) und Versatz aus der Mitte.
  const [bildMass, setBildMass] = useState<{ b: number; h: number } | null>(null);
  const [bz, setBz] = useState(1);
  const [versatz, setVersatz] = useState({ x: 0, y: 0 });
  const [zieht, setZieht] = useState(false);
  const ziehStart = useRef<{ x: number; y: number; vx: number; vy: number; id: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textEbene = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const leiste = useRef<HTMLElement>(null);
  const seiteRef = useRef(seite);
  seiteRef.current = seite;

  const treffer = useMemo(() => (texte ? trefferListe(texte, suche) : []), [texte, suche]);
  const trefferJeSeite = useMemo(() => jeSeite(treffer), [treffer]);
  const anzahl = doc?.numPages ?? 0;
  const zuSeite = useCallback((n: number) => { if (doc) setSeite(klemmeSeite(n, doc.numPages)); }, [doc]);
  const sucheAktiv = suche.trim().length >= 2;

  // Bild: Einpass-Massstab (nie über 100 %, kleine Bilder bleiben scharf).
  const bildFit = bildMass && flaecheMass.b ? Math.min(1, zoomEinpassen(bildMass.b, bildMass.h, flaecheMass.b, flaecheMass.h, 64)) : 1;
  const bildGroesse = bildMass ? { b: bildMass.b * bildFit * bz, h: bildMass.h * bildFit * bz } : null;
  const z = art === "bild" ? bildFit * bz : zoom ?? 1;

  const bildZoom = useCallback((neu: number, punkt = { x: 0, y: 0 }) => {
    if (!bildMass) return;
    const ziel = Math.min(BILD_MAX, Math.max(BILD_MIN, neu));
    setVersatz((v) => ziel <= 1.0001 ? { x: 0, y: 0 }
      : klemmeVersatz(versatzUmPunkt(bz, ziel, v, punkt), { b: bildMass.b * bildFit * ziel, h: bildMass.h * bildFit * ziel }, flaecheMass));
    setBz(ziel);
  }, [bildMass, bildFit, flaecheMass, bz]);

  const pdfEinpassen = useCallback(() => {
    if (!seitenMass || !flaecheMass.b) return;
    setZoom(zoomEinpassen(seitenMass.b, seitenMass.h, flaecheMass.b - RAND_B + 48, flaecheMass.h - RAND_H + 48));
    setEingepasst(true);
  }, [seitenMass, flaecheMass]);
  const einpassen = useCallback(() => {
    if (art === "bild") { setBz(1); setVersatz({ x: 0, y: 0 }); } else pdfEinpassen();
  }, [art, pdfEinpassen]);
  const zoomen = useCallback((richtung: 1 | -1) => {
    if (art === "bild") bildZoom(bz * (richtung === 1 ? 1.25 : 0.8));
    else { setZoom((alt) => naechsterZoom(alt ?? 1, richtung)); setEingepasst(false); }
  }, [art, bildZoom, bz]);

  // Fokus in den Dialog, beim Schliessen zurück an den Auslöser.
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    dialog.current?.focus({ preventScroll: true });
    return () => { if (vorher && document.contains(vorher)) vorher.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onSchliessen(); return; }
      if (istEingabe(e.target)) { if (doc && (e.key === "PageDown" || e.key === "PageUp")) { e.preventDefault(); setSeite((s) => klemmeSeite(s + (e.key === "PageDown" ? 1 : -1), doc.numPages)); } return; }
      if (e.key === "0") { e.preventDefault(); einpassen(); return; }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomen(1); return; }
      if (e.key === "-") { e.preventDefault(); zoomen(-1); return; }
      if (!doc) return;
      if (e.key === "PageDown" || e.key === "ArrowRight") { e.preventDefault(); setSeite((s) => klemmeSeite(s + 1, doc.numPages)); }
      else if (e.key === "PageUp" || e.key === "ArrowLeft") { e.preventDefault(); setSeite((s) => klemmeSeite(s - 1, doc.numPages)); }
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [doc, onSchliessen, einpassen, zoomen]);
  useLayoutEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const messen = () => setFlaecheMass({ b: el.clientWidth, h: el.clientHeight });
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // PDF laden.
  useEffect(() => {
    if (art !== "pdf") return;
    let aktivLaden = true; let zu: (() => void) | null = null;
    ladeBytes(dokument.id).then(async (b) => {
      const { oeffnePdf, schliessePdf } = await import("./pdf");
      const offen = await oeffnePdf(b);
      zu = () => schliessePdf(offen);
      if (!aktivLaden) { zu(); return; }
      setDoc(offen); setSeite((s) => klemmeSeite(s, offen.numPages));
    }).catch((e: unknown) => { if (aktivLaden) setFehler(fehlerVon(e, "Dokument konnte nicht geöffnet werden. Herunterladen und lokal öffnen.")); });
    return () => { aktivLaden = false; zu?.(); };
  }, [art, dokument.id]);
  // Seitengrösse der aktuellen Seite (Seiten können verschieden gross sein).
  useEffect(() => {
    if (!doc) return;
    let aktivMass = true;
    void import("./pdf").then(({ seitenMass: mass }) => mass(doc, seite)).then((m) => { if (aktivMass) setSeitenMass((alt) => (alt && alt.b === m.b && alt.h === m.h ? alt : m)); });
    return () => { aktivMass = false; };
  }, [doc, seite]);
  // Eingepasst bleibt eingepasst, auch bei Fenstergrösse oder anderem Seitenformat.
  useEffect(() => { if (eingepasst) pdfEinpassen(); }, [eingepasst, pdfEinpassen]);

  // Seite zeichnen, danach die Textebene (markier- und kopierbar).
  useEffect(() => {
    if (!doc || !canvas.current || zoom === null) return;
    let aktivZeichnen = true;
    const abbruch: (() => void)[] = [];
    setTextStand(null);
    void import("./pdf").then(({ zeichneSeite, zeichneText }) => {
      if (!aktivZeichnen || !canvas.current) return;
      const r = zeichneSeite(doc, seite, canvas.current, zoom);
      abbruch.push(r.abbrechen);
      r.fertig.then(() => {
        if (!aktivZeichnen) return;
        setGezeichnet(true);
        if (!textEbene.current) return;
        const t = zeichneText(doc, seite, textEbene.current, zoom);
        abbruch.push(t.abbrechen);
        void t.fertig.then((x) => { if (aktivZeichnen && x) setTextStand({ seite, ...x }); });
      }, (e: unknown) => { if (aktivZeichnen) setFehler(fehlerVon(e, "Seite konnte nicht dargestellt werden.")); });
    });
    return () => { aktivZeichnen = false; abbruch.forEach((a) => a()); };
  }, [doc, seite, zoom]);
  // Seitenwechsel: Fläche nach oben, Seitenleiste zeigt die aktuelle Seite, Eingabefeld folgt.
  useEffect(() => {
    setSeiteEingabe(String(seite));
    flaeche.current?.scrollTo({ top: 0 });
    leiste.current?.querySelector<HTMLElement>(`[data-seite="${seite}"]`)?.scrollIntoView({ block: "nearest" });
  }, [seite]);

  // Suche: Texte einmal laden; neuer Begriff springt zum ersten Treffer ab der aktuellen Seite.
  useEffect(() => {
    if (!doc || !sucheAktiv || texte) return;
    void import("./pdf").then(({ seitenTexte }) => seitenTexte(doc)).then(setTexte, () => setTexte([]));
  }, [doc, sucheAktiv, texte]);
  useEffect(() => {
    const i = startTreffer(treffer, seiteRef.current);
    setAktiv(i);
    if (i >= 0 && treffer[i].seite !== seiteRef.current) setSeite(treffer[i].seite);
  }, [treffer]);
  const blaettern = (richtung: 1 | -1) => {
    if (!treffer.length) return;
    const n = blaettereTreffer(treffer.length, aktiv, richtung);
    setAktiv(n); zuSeite(treffer[n].seite);
  };
  // Treffer in der Textebene markieren (eisblau), den aktiven kräftiger und in die Mitte holen.
  useEffect(() => {
    if (!textStand) return;
    const { elemente, texte: stuecke, seite: s } = textStand;
    const hier = treffer.map((t, nr) => ({ ...t, nr })).filter((t) => t.seite === s);
    let aktivEl: HTMLElement | null = null;
    elemente.forEach((el, i) => {
      const t = hier.filter((x) => x.stueck === i);
      if (!t.length) { if (el.childElementCount) el.textContent = stuecke[i]; return; }
      el.replaceChildren(...teileText(stuecke[i], t).map((teil) => {
        if (teil.nr === null) return document.createTextNode(teil.text);
        const m = document.createElement("span");
        m.className = teil.nr === aktiv ? "vw-mark vw-mark-aktiv" : "vw-mark";
        m.textContent = teil.text;
        if (teil.nr === aktiv) aktivEl = m;
        return m;
      }));
    });
    (aktivEl as HTMLElement | null)?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [textStand, treffer, aktiv]);

  // Bild: Mausrad zoomt um den Mauszeiger (nicht passiv, damit die Seite nicht scrollt).
  useEffect(() => {
    const el = flaeche.current;
    if (art !== "bild" || !el) return;
    const rad = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      bildZoom(bz * Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 });
    };
    el.addEventListener("wheel", rad, { passive: false });
    return () => el.removeEventListener("wheel", rad);
  }, [art, bildZoom, bz]);
  const kannZiehen = !!bildGroesse && (bildGroesse.b > flaecheMass.b || bildGroesse.h > flaecheMass.h);
  const ziehenStart = (e: ReactPointerEvent) => {
    if (!kannZiehen || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ziehStart.current = { x: e.clientX, y: e.clientY, vx: versatz.x, vy: versatz.y, id: e.pointerId };
    setZieht(true);
  };
  const ziehenBewegen = (e: ReactPointerEvent) => {
    const s = ziehStart.current;
    if (!s || s.id !== e.pointerId || !bildGroesse) return;
    setVersatz(klemmeVersatz({ x: s.vx + e.clientX - s.x, y: s.vy + e.clientY - s.y }, bildGroesse, flaecheMass));
  };
  const ziehenEnde = () => { ziehStart.current = null; setZieht(false); };
  const doppelklick = (e: ReactMouseEvent) => {
    if (art !== "bild" || !flaeche.current) return;
    if (bz > 1.01) { einpassen(); return; }
    const r = flaeche.current.getBoundingClientRect();
    bildZoom(2, { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 });
  };

  /** Tab bleibt im Dialog (aria-modal). */
  const fokusFalle = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !dialog.current) return;
    const ziele = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, select, [tabindex='0']")].filter((x) => x.offsetParent !== null);
    if (!ziele.length) return;
    const erstes = ziele[0], letztes = ziele[ziele.length - 1];
    if (e.shiftKey && (document.activeElement === erstes || document.activeElement === dialog.current)) { e.preventDefault(); letztes.focus(); }
    else if (!e.shiftKey && document.activeElement === letztes) { e.preventDefault(); erstes.focus(); }
  };

  const bildStil = useMemo<CSSProperties | undefined>(() => bildGroesse
    ? { width: Math.round(bildGroesse.b), height: Math.round(bildGroesse.h), transform: `translate(-50%, -50%) translate(${Math.round(versatz.x)}px, ${Math.round(versatz.y)}px)` }
    : undefined, [bildGroesse, versatz]);
  const scan = scanAnzeige(dokument);
  const mitZoom = (art === "pdf" && doc) || (art === "bild" && bildMass);
  const istEingepasst = art === "bild" ? bz <= 1.0001 : eingepasst;
  const zoomMin = art === "bild" ? bz <= BILD_MIN + 1e-4 : z <= ZOOM_STUFEN[0] + 1e-4;
  const zoomMax = art === "bild" ? bz >= BILD_MAX - 1e-4 : z >= ZOOM_STUFEN[ZOOM_STUFEN.length - 1] - 1e-4;
  const sucheStand = sucheAktiv ? (texte ? (treffer.length ? `${aktiv + 1} / ${treffer.length}` : "Kein Treffer") : "sucht …") : "";

  return (
    <div className="vw-grund" style={stil} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onSchliessen(); }}>
      <div ref={dialog} className="vw" role="dialog" aria-modal="true" aria-labelledby="vw-titel" aria-describedby="vw-art" tabIndex={-1} onKeyDown={fokusFalle}>
        <header className="vw-kopf">
          <div className="vw-titel">
            <span className="vw-titel-icon" aria-hidden="true"><DokumentSymbol kategorie={dokument.kategorie} groesse={17} /></span>
            <h2 id="vw-titel" title={dokument.dateiname}>{dokument.dateiname}</h2>
            <span id="vw-art" className="vw-titel-art">{kategorieName(dokument.kategorie)}<span aria-hidden="true"> · </span>{endung(dokument)}{anzahl > 0 && <>, {anzahl === 1 ? "1 Seite" : `${anzahl} Seiten`}</>}</span>
          </div>
          <div className="vw-werkzeuge">
            {art === "pdf" && doc && <div className="vw-gruppe" role="group" aria-label="Seite">
              <button type="button" className="vw-symbol" onClick={() => zuSeite(seite - 1)} disabled={seite <= 1} aria-label="Vorherige Seite (Bild auf)"><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /></button>
              <label className="vw-seite">
                <span className="ui-sr">Seite</span>
                <input inputMode="numeric" value={seiteEingabe} aria-label={`Seite, 1 bis ${anzahl}`}
                  onChange={(e) => setSeiteEingabe(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={() => { const n = Number(seiteEingabe); if (seiteEingabe && Number.isFinite(n)) zuSeite(n); else setSeiteEingabe(String(seite)); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const n = Number(seiteEingabe); if (seiteEingabe) zuSeite(n); } }} />
                <span className="vw-seite-von">von {anzahl}</span>
              </label>
              <button type="button" className="vw-symbol" onClick={() => zuSeite(seite + 1)} disabled={seite >= anzahl} aria-label="Nächste Seite (Bild ab)"><ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></button>
            </div>}
            {mitZoom && <div className="vw-gruppe" role="group" aria-label="Zoom">
              <button type="button" className="vw-symbol" onClick={() => zoomen(-1)} disabled={zoomMin} aria-label="Verkleinern (−)"><Minus size={15} strokeWidth={1.75} aria-hidden="true" /></button>
              <span className="vw-zoom" aria-live="polite">{Math.round(z * 100)} %</span>
              <button type="button" className="vw-symbol" onClick={() => zoomen(1)} disabled={zoomMax} aria-label="Vergrössern (+)"><Plus size={15} strokeWidth={1.75} aria-hidden="true" /></button>
              <button type="button" className="vw-einpassen" onClick={einpassen} disabled={istEingepasst} title="Ganze Seite zeigen (Taste 0)">Einpassen</button>
            </div>}
            {art === "pdf" && doc && <div className={`vw-suche${sucheAktiv ? " vw-suche-aktiv" : ""}`} role="search">
              <Search size={14} strokeWidth={1.75} aria-hidden="true" />
              <input type="search" value={suche} placeholder="Im Dokument suchen" aria-label="Im Dokument suchen" aria-describedby="vw-suche-stand"
                title="Enter: nächster Treffer, Umschalt+Enter: vorheriger"
                onChange={(e) => setSuche(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); blaettern(e.shiftKey ? -1 : 1); } }} />
              <span id="vw-suche-stand" className="vw-suche-stand" aria-live="polite">{sucheStand}</span>
              <button type="button" className="vw-suche-knopf" onClick={() => blaettern(-1)} disabled={!treffer.length} aria-label="Vorheriger Treffer (Umschalt+Enter)"><ChevronUp size={14} strokeWidth={1.9} aria-hidden="true" /></button>
              <button type="button" className="vw-suche-knopf" onClick={() => blaettern(1)} disabled={!treffer.length} aria-label="Nächster Treffer (Enter)"><ChevronDown size={14} strokeWidth={1.9} aria-hidden="true" /></button>
            </div>}
          </div>
          <div className="vw-aktionen">
            {art !== "gesperrt" && <a className="vw-knopf" href={dateiUrl(dokument.id, true)} download={dokument.dateiname}><Download size={15} strokeWidth={1.75} aria-hidden="true" />Herunterladen</a>}
            <button type="button" className="vw-zu" onClick={onSchliessen} aria-label="Schliessen (Esc)" title="Schliessen (Esc)"><X size={17} strokeWidth={1.75} aria-hidden="true" /></button>
          </div>
        </header>
        <div className={`vw-inhalt${art === "pdf" && doc && anzahl > 1 ? " vw-mit-leiste" : ""}`}>
          {art === "pdf" && doc && anzahl > 1 && <nav ref={leiste} className="vw-leiste" aria-label="Seiten">
            <ol>{Array.from({ length: anzahl }, (_, i) => i + 1).map((n) => {
              const t = trefferJeSeite.find((x) => x.seite === n);
              return <li key={n}><button type="button" data-seite={n} aria-current={n === seite ? "page" : undefined}
                className={t ? "vw-blatt vw-blatt-treffer" : "vw-blatt"} onClick={() => zuSeite(n)}
                aria-label={`Seite ${n}${t ? `, ${t.anzahl} Treffer` : ""}`}><Miniatur doc={doc} nr={n} wurzel={leiste} />{n}</button></li>;
            })}</ol>
          </nav>}
          <div ref={flaeche} className={`vw-flaeche${art === "bild" ? " vw-flaeche-bild" : ""}${kannZiehen ? " vw-ziehbar" : ""}${zieht ? " vw-zieht" : ""}`}
            tabIndex={art === "pdf" || art === "bild" ? 0 : undefined}
            aria-label={art === "pdf" ? `Seite ${seite} von ${anzahl || "?"}` : art === "bild" ? dokument.dateiname : undefined}
            onPointerDown={art === "bild" ? ziehenStart : undefined} onPointerMove={art === "bild" ? ziehenBewegen : undefined}
            onPointerUp={art === "bild" ? ziehenEnde : undefined} onPointerCancel={art === "bild" ? ziehenEnde : undefined} onDoubleClick={doppelklick}>
            {art === "pdf" && (fehler
              ? <Hinweis titel="Nicht darstellbar" text={fehler} />
              : <div className={`vw-papier${doc && gezeichnet ? " vw-papier-bereit" : ""}`}>
                {!(doc && gezeichnet) && <p className="vw-laden" role="status"><span className="vw-laden-balken" aria-hidden="true" />Dokument wird geladen …</p>}
                {doc && <canvas ref={canvas} aria-hidden="true" />}
                {doc && <div ref={textEbene} className="vw-text" />}
              </div>)}
            {art === "bild" && !fehler && <img className={`vw-bild${bildMass ? " vw-bild-bereit" : ""}`} src={dateiUrl(dokument.id)} alt={dokument.dateiname} style={bildStil} draggable={false}
              onLoad={(e) => setBildMass({ b: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFehler(ablageFehlerText(null, undefined, "Bild konnte nicht geladen werden."))} />}
            {art === "bild" && fehler && <Hinweis titel="Nicht darstellbar" text={fehler} />}
            {art === "herunterladen" && <Hinweis titel={dokument.mime === "image/heic" ? "Keine Vorschau für HEIC" : "Office-Datei"}
              text={dokument.mime === "image/heic" ? "HEIC-Fotos lassen sich im Browser nicht anzeigen. Herunterladen und lokal öffnen." : "Word-, Excel- und PowerPoint-Dateien zeigt Planora nicht an. Herunterladen und lokal öffnen."}
              aktion={<a className="vw-knopf vw-knopf-haupt" href={dateiUrl(dokument.id, true)} download={dokument.dateiname}><Download size={15} strokeWidth={1.75} aria-hidden="true" />Herunterladen</a>}
              symbol={<DokumentSymbol kategorie={dokument.kategorie} groesse={22} />} />}
            {art === "gesperrt" && <Hinweis titel={scan.text} text={dokument.scanStatus === "quarantaene" ? "Die Datei wird auf Viren geprüft. Danach lässt sie sich öffnen."
              : dokument.scanStatus === "abgelehnt" ? "Die Virenprüfung hat einen Befund gemeldet. Die Datei bleibt gesperrt." : "Die Virenprüfung ist fehlgeschlagen. Die Datei bleibt gesperrt, bis sie erneut geprüft ist."}
              symbol={<Lock size={20} strokeWidth={1.75} aria-hidden="true" />} rolle="alert" />}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Miniatur einer Seite (ca. 44 px breit), erst gezeichnet, wenn sie in der Seitenleiste sichtbar wird. */
function Miniatur({ doc, nr, wurzel }: { doc: PDFDocumentProxy; nr: number; wurzel: RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bereit, setBereit] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let abbrechen: (() => void) | null = null; let aktivMini = true;
    const io = new IntersectionObserver((e) => {
      if (!e.some((x) => x.isIntersecting)) return;
      io.disconnect();
      void import("./pdf").then(async ({ seitenMass, zeichneSeite }) => {
        const m = await seitenMass(doc, nr);
        if (!aktivMini) return;
        const r = zeichneSeite(doc, nr, el, 44 / m.b);
        abbrechen = r.abbrechen;
        await r.fertig;
        if (aktivMini) setBereit(true);
      }).catch(() => { /* bleibt leeres Blatt */ });
    }, { root: wurzel.current, rootMargin: "120px 0px" });
    io.observe(el);
    return () => { aktivMini = false; io.disconnect(); abbrechen?.(); };
  }, [doc, nr, wurzel]);
  return <canvas ref={canvas} className={`vw-blatt-papier${bereit ? " vw-blatt-bereit" : ""}`} aria-hidden="true" />;
}

function Hinweis({ titel, text, aktion, symbol, rolle }: { titel: string; text: string; aktion?: ReactNode; symbol?: ReactNode; rolle?: "alert" }) {
  return (
    <div className="vw-hinweis" role={rolle}>
      {symbol && <span className="vw-hinweis-icon">{symbol}</span>}
      <h3>{titel}</h3>
      <p>{text}</p>
      {aktion}
    </div>
  );
}
