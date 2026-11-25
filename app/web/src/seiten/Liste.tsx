import { useEffect, useState, type CSSProperties } from "react";
import { Building2, ChevronRight, LogOut, Pencil, Plus } from "lucide-react";
import { ApiFehler, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import type { GebaeudeEintrag } from "../typen";
import { Marke } from "../ui/Kopfzeile";
import "./Erneuerungsplan.css";
import "./Liste.css";

const F = TOKENS.farbe;
// Gleiche Flächen und Knöpfe wie Erneuerungsplan und Dokumente (--ep-*), Marke nutzt die Twin-Variablen.
const stil = {
  "--ep-grund": F.grund, "--ep-flaeche": F.flaeche, "--ep-grau-1": F.grau1, "--ep-grau-2": F.grau2, "--ep-text": F.text, "--ep-sekundaer": F.textSekundaer,
  "--ep-link-hover": F.linkHover, "--ep-akzent": F.eisAkzent, "--ep-schrift": TOKENS.typografie.familie, "--ep-schatten": TOKENS.schatten.panel,
  "--ep-radius": `${TOKENS.radius.panelPx}px`, "--ep-radius-kachel": `${TOKENS.radius.kachelPx}px`, "--ep-hover-ms": `${TOKENS.bewegung.hoverMs}ms`,
  "--ep-panel-ms": `${TOKENS.bewegung.panelMs}ms`, "--ep-kurve": TOKENS.bewegung.kurve, "--tw-text": F.text, "--tw-eis": F.eis,
} as CSSProperties;

interface Props {
  onWahl: (g: GebaeudeEintrag) => void;
  onBearbeiten?: (g: GebaeudeEintrag) => void;
  onNeu?: () => void;
  onAbmelden?: () => void;
  /** Wird bei 401 (Sitzung abgelaufen) statt einer Fehlermeldung aufgerufen. */
  onAbgelaufen?: () => void;
}

/** Startseite: Gebäude je Liegenschaft, Klick öffnet den Digital Twin. */
export function Liste({ onWahl, onBearbeiten, onNeu, onAbmelden, onAbgelaufen }: Props) {
  const [liste, setListe] = useState<GebaeudeEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    holeJson<GebaeudeEintrag[]>("/api/struktur/gebaeude").then(setListe, (e: Error) => {
      if (e instanceof ApiFehler && e.status === 401 && onAbgelaufen) onAbgelaufen();
      else setFehler(e.message);
    });
  }, [onAbgelaufen]);
  const liegenschaften = [...new Set((liste ?? []).map((g) => g.liegenschaftName))];
  return (
    <main className="ep gl" style={stil} aria-label="Gebäude">
      <header className="ep-kopf">
        <div className="ep-titel"><Marke /><h1>Planora<span>Gebäude</span></h1></div>
        <span />
        <div className="gl-aktionen">
          {onNeu && <button type="button" className="ep-knopf ep-knopf-haupt" onClick={onNeu}><Plus size={15} strokeWidth={2} aria-hidden="true" />Neues Gebäude</button>}
          {onAbmelden && <button type="button" className="ep-knopf" onClick={onAbmelden}><LogOut size={14} strokeWidth={1.75} aria-hidden="true" />Abmelden</button>}
        </div>
      </header>
      {fehler && <p className="ep-meldung" role="alert">{fehler}</p>}
      {!liste && !fehler && <p className="ep-meldung ep-laden" role="status">Gebäude werden geladen …</p>}
      {liste && <div className="gl-inhalt">
        {liste.length === 0 && <section className="ep-karte gl-leer"><Building2 size={22} strokeWidth={1.6} aria-hidden="true" />
          <p>Noch keine Gebäude erfasst.{onNeu ? " Mit «Neues Gebäude» beginnen." : ""}</p></section>}
        {liegenschaften.map((l) => <section key={l} className="ep-karte gl-karte" aria-label={l}>
          <h2>{l}</h2>
          <ul className="gl-liste">{liste.filter((g) => g.liegenschaftName === l).map((g) => <li key={g.id} className="gl-zeile">
            <button type="button" className="gl-wahl" onClick={() => onWahl(g)}>
              <span className="gl-icon" aria-hidden="true"><Building2 size={16} strokeWidth={1.75} /></span>
              <span className="gl-text"><span className="gl-name">{g.name}</span>
                <span className="gl-meta">{g.geschosse === 1 ? "1 Geschoss" : `${g.geschosse} Geschosse`}</span></span>
              <ChevronRight className="gl-pfeil" size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {onBearbeiten && <button type="button" className="gl-bearbeiten" onClick={() => onBearbeiten(g)} aria-label={`${g.name} bearbeiten`} title="Gebäude bearbeiten">
              <Pencil size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
          </li>)}</ul>
        </section>)}
      </div>}
    </main>
  );
}
