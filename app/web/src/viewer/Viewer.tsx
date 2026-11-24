import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Lock, Minus, Plus, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { AblageZeile } from "../dokumente/typen";
import { dateiUrl, ladeBytes } from "../dokumente/api";
import { kategorieName, oeffnenArt, scanAnzeige } from "../dokumente/ansicht";
import { TOKENS } from "../design/tokens";
import { DokumentSymbol, endung } from "../ui/dokumentSymbol";
import { klemmeSeite, naechsterTreffer, naechsterZoom, trefferSeiten, zoomFuerBreite, ZOOM_STUFEN } from "./seiten";
import "./Viewer.css";

interface Props { dokument: AblageZeile; seite?: number; onSchliessen: () => void }

const F = TOKENS.farbe;
const stil = {
  "--vw-grund": F.grund, "--vw-flaeche": F.flaeche, "--vw-flaeche-2": F.flaecheSekundaer, "--vw-grau-1": F.grau1, "--vw-grau-2": F.grau2, "--vw-grau-3": F.grau3,
  "--vw-text": F.text, "--vw-sekundaer": F.textSekundaer, "--vw-sekundaer-kachel": F.textSekundaerKachel, "--vw-sekundaer-eis": F.textSekundaerEis,
  "--vw-link": F.link, "--vw-eis": F.eis, "--vw-akzent": F.eisAkzent, "--vw-stoerung-text": F.statusStoerungText, "--vw-warnung-text": F.statusWarnungText,
  "--vw-schrift": TOKENS.typografie.familie, "--vw-schatten": TOKENS.schatten.objekt, "--vw-radius": `${TOKENS.radius.panelPx}px`, "--vw-radius-kachel": `${TOKENS.radius.kachelPx}px`,
  "--vw-hover-ms": `${TOKENS.bewegung.hoverMs}ms`, "--vw-panel-ms": `${TOKENS.bewegung.panelMs}ms`, "--vw-kurve": TOKENS.bewegung.kurve,
} as CSSProperties;

const istEingabe = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;

/** Overlay-Viewer (Esc schliesst): PDF mit Seitenleiste, Seite n, Zoom, Textsuche; Bilder mit Zoom; Office nur Herunterladen. */
export function Viewer({ dokument, seite: start = 1, onSchliessen }: Props) {
  const art = oeffnenArt(dokument);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [seite, setSeite] = useState(start);
  const [seiteEingabe, setSeiteEingabe] = useState(String(start));
  const [zoom, setZoom] = useState<number | null>(art === "bild" ? 1 : null);
  const [suche, setSuche] = useState("");
  const [texte, setTexte] = useState<string[] | null>(null);
  const [gezeichnet, setGezeichnet] = useState(false);
  const [bildMass, setBildMass] = useState<{ b: number; h: number } | null>(null);
  const [flaecheMass, setFlaecheMass] = useState<{ b: number; h: number }>({ b: 0, h: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const leiste = useRef<HTMLElement>(null);
  const treffer = useMemo(() => (texte ? trefferSeiten(texte, suche) : []), [texte, suche]);
  const anzahl = doc?.numPages ?? 0;
  const zuSeite = useCallback((n: number) => { if (doc) setSeite(klemmeSeite(n, doc.numPages)); }, [doc]);

  // Fokus in den Dialog, beim Schliessen zurück an den Auslöser.
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    dialog.current?.focus({ preventScroll: true });
    return () => { if (vorher && document.contains(vorher)) vorher.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onSchliessen(); return; }
      if (!doc) return;
      if (e.key === "PageDown" || (!istEingabe(e.target) && e.key === "ArrowRight")) { e.preventDefault(); setSeite((s) => klemmeSeite(s + 1, doc.numPages)); }
      else if (e.key === "PageUp" || (!istEingabe(e.target) && e.key === "ArrowLeft")) { e.preventDefault(); setSeite((s) => klemmeSeite(s - 1, doc.numPages)); }
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [doc, onSchliessen]);
  useLayoutEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const messen = () => setFlaecheMass({ b: el.clientWidth, h: el.clientHeight });
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (art !== "pdf") return;
    let aktiv = true; let offen: PDFDocumentProxy | null = null; let zu: (() => void) | null = null;
    ladeBytes(dokument.id).then(async (b) => {
      const { oeffnePdf, seitenBreite, schliessePdf } = await import("./pdf");
      offen = await oeffnePdf(b);
      zu = () => schliessePdf(offen!);
      if (!aktiv) { zu(); return; }
      const breite = await seitenBreite(offen, 1);
      if (!aktiv) return;
      setZoom(zoomFuerBreite(breite, flaeche.current?.clientWidth ?? 800));
      setDoc(offen); setSeite((s) => klemmeSeite(s, offen!.numPages));
    }).catch(() => { if (aktiv) setFehler("Dokument konnte nicht geöffnet werden. Herunterladen und lokal öffnen."); });
    return () => { aktiv = false; zu?.(); };
  }, [art, dokument.id]);
  useEffect(() => {
    if (!doc || !canvas.current || zoom === null) return;
    let z: { abbrechen(): void } | null = null; let aktiv = true;
    void import("./pdf").then(({ zeichneSeite }) => {
      if (!aktiv || !canvas.current) return;
      const r = zeichneSeite(doc, seite, canvas.current, zoom);
      z = r;
      r.fertig.then(() => { if (aktiv) setGezeichnet(true); }, () => { if (aktiv) setFehler("Seite konnte nicht dargestellt werden."); });
    });
    return () => { aktiv = false; z?.abbrechen(); };
  }, [doc, seite, zoom]);
  // Seitenwechsel: Fläche nach oben, Seitenleiste zeigt die aktuelle Seite, Eingabefeld folgt.
  useEffect(() => {
    setSeiteEingabe(String(seite));
    flaeche.current?.scrollTo({ top: 0 });
    leiste.current?.querySelector<HTMLElement>(`[data-seite="${seite}"]`)?.scrollIntoView({ block: "nearest" });
  }, [seite]);
  useEffect(() => {
    if (!doc || suche.trim().length < 2 || texte) return;
    void import("./pdf").then(({ seitenTexte }) => seitenTexte(doc)).then(setTexte, () => setTexte([]));
  }, [doc, suche, texte]);

  /** Tab bleibt im Dialog (aria-modal). */
  const fokusFalle = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !dialog.current) return;
    const ziele = [...dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, select, [tabindex='0']")].filter((x) => x.offsetParent !== null);
    if (!ziele.length) return;
    const erstes = ziele[0], letztes = ziele[ziele.length - 1];
    if (e.shiftKey && (document.activeElement === erstes || document.activeElement === dialog.current)) { e.preventDefault(); letztes.focus(); }
    else if (!e.shiftKey && document.activeElement === letztes) { e.preventDefault(); erstes.focus(); }
  };

  const z = zoom ?? 1;
  const bildStil = useMemo<CSSProperties | undefined>(() => {
    if (!bildMass || !flaecheMass.b) return undefined;
    const passt = Math.min((flaecheMass.b - 64) / bildMass.b, (flaecheMass.h - 64) / bildMass.h, 1);
    return { width: Math.round(bildMass.b * passt * z), height: Math.round(bildMass.h * passt * z) };
  }, [bildMass, flaecheMass, z]);
  const trefferSumme = treffer.reduce((n, t) => n + t.anzahl, 0);
  const sucheAktiv = suche.trim().length >= 2;
  const scan = scanAnzeige(dokument);
  const mitZoom = (art === "pdf" && doc) || art === "bild";

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
              <button type="button" className="vw-symbol" onClick={() => setZoom(naechsterZoom(z, -1))} disabled={z <= ZOOM_STUFEN[0]} aria-label="Verkleinern"><Minus size={15} strokeWidth={1.75} aria-hidden="true" /></button>
              <span className="vw-zoom" aria-live="polite">{Math.round(z * 100)} %</span>
              <button type="button" className="vw-symbol" onClick={() => setZoom(naechsterZoom(z, 1))} disabled={z >= ZOOM_STUFEN[ZOOM_STUFEN.length - 1]} aria-label="Vergrössern"><Plus size={15} strokeWidth={1.75} aria-hidden="true" /></button>
            </div>}
            {art === "pdf" && doc && <label className={`vw-suche${sucheAktiv ? " vw-suche-aktiv" : ""}`}>
              <Search size={14} strokeWidth={1.75} aria-hidden="true" />
              <input type="search" value={suche} placeholder="Im Dokument suchen" aria-describedby="vw-suche-stand" title="Enter: nächster Treffer, Umschalt+Enter: vorheriger"
                onChange={(e) => setSuche(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const n = naechsterTreffer(treffer, seite, e.shiftKey ? -1 : 1); if (n) zuSeite(n); } }} />
              <span id="vw-suche-stand" className="vw-suche-stand" aria-live="polite">{sucheAktiv ? (texte ? (trefferSumme ? `${trefferSumme} Treffer` : "Kein Treffer") : "sucht …") : ""}</span>
            </label>}
          </div>
          <div className="vw-aktionen">
            {art !== "gesperrt" && <a className="vw-knopf" href={dateiUrl(dokument.id, true)} download={dokument.dateiname}><Download size={15} strokeWidth={1.75} aria-hidden="true" />Herunterladen</a>}
            <button type="button" className="vw-zu" onClick={onSchliessen} aria-label="Schliessen (Esc)" title="Schliessen (Esc)"><X size={17} strokeWidth={1.75} aria-hidden="true" /></button>
          </div>
        </header>
        <div className={`vw-inhalt${art === "pdf" && doc && anzahl > 1 ? " vw-mit-leiste" : ""}`}>
          {art === "pdf" && doc && anzahl > 1 && <nav ref={leiste} className="vw-leiste" aria-label="Seiten">
            <ol>{Array.from({ length: anzahl }, (_, i) => i + 1).map((n) => {
              const t = treffer.find((x) => x.seite === n);
              return <li key={n}><button type="button" data-seite={n} aria-current={n === seite ? "page" : undefined}
                className={t ? "vw-blatt vw-blatt-treffer" : "vw-blatt"} onClick={() => zuSeite(n)}
                aria-label={`Seite ${n}${t ? `, ${t.anzahl} Treffer` : ""}`}><span className="vw-blatt-papier" aria-hidden="true" />{n}</button></li>;
            })}</ol>
          </nav>}
          <div ref={flaeche} className="vw-flaeche" tabIndex={art === "pdf" || art === "bild" ? 0 : undefined} aria-label={art === "pdf" ? `Seite ${seite} von ${anzahl || "?"}` : art === "bild" ? dokument.dateiname : undefined}>
            {art === "pdf" && (fehler
              ? <Hinweis titel="Nicht darstellbar" text={fehler} />
              : <div className={`vw-papier${doc && gezeichnet ? " vw-papier-bereit" : ""}`}>
                {!(doc && gezeichnet) && <p className="vw-laden" role="status"><span className="vw-laden-balken" aria-hidden="true" />Dokument wird geladen …</p>}
                {doc && <canvas ref={canvas} />}
              </div>)}
            {art === "bild" && <img className={`vw-bild${bildMass ? " vw-bild-bereit" : ""}`} src={dateiUrl(dokument.id)} alt={dokument.dateiname} style={bildStil}
              onLoad={(e) => setBildMass({ b: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFehler("Bild konnte nicht geladen werden.")} />}
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
