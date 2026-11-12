import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, Layers3 } from "lucide-react";
import { ApiFehler, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import { Szene3 } from "../szene3/Szene3";
import type { Katalog, Welt } from "../typen";
import "./Twin.css";

function webglVorhanden(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch { return false; }
}

const stil = {
  "--twin-grund": TOKENS.farbe.grund,
  "--twin-text": TOKENS.farbe.text,
  "--twin-sekundaer": TOKENS.farbe.textSekundaer,
  "--twin-auswahl": TOKENS.farbe.eis,
  "--twin-fokus": TOKENS.farbe.eisAkzent,
  "--twin-schatten": TOKENS.schatten.panel,
  "--twin-radius": `${TOKENS.radius.panelPx}px`,
  "--twin-blur": `${TOKENS.flaeche.weichzeichnerPx}px`,
  "--twin-schrift": TOKENS.typografie.familie,
} as CSSProperties;

interface Props { gebaeudeId: string; name: string; onZurueck: () => void; onAbgelaufen: () => void }

export function Twin({ gebaeudeId, name, onZurueck, onAbgelaufen }: Props) {
  const [welt, setWelt] = useState<Welt | null>(null);
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<string | null>(null);
  const [reduziert, setReduziert] = useState(false);
  const [webgl] = useState(webglVorhanden);

  useEffect(() => {
    let aktiv = true;
    setWelt(null); setKatalog(null); setFehler(null); setFokusId(null);
    Promise.all([
      holeJson<Welt>(`/api/szene/gebaeude/${gebaeudeId}/welt`),
      holeJson<Katalog>("/api/katalog/v1"),
    ]).then(([w, k]) => {
      if (aktiv) { setWelt(w); setKatalog(k); }
    }, (e: Error) => {
      if (!aktiv) return;
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
      else setFehler(e.message);
    });
    return () => { aktiv = false; };
  }, [gebaeudeId, onAbgelaufen]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setFokusId(null); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  const geschosse = welt ? [...welt.geschosse].sort((a, b) => b.yUnten - a.yUnten) : [];
  const fokus = geschosse.find((g) => g.id === fokusId);

  return (
    <main className="twin" style={stil} aria-label="Digital Twin">
      {webgl && welt && katalog && <Szene3 welt={welt} katalog={katalog.eintraege} fokusId={fokusId} reduziert={reduziert}
        freiraum={{ links: 32, rechts: 32, oben: 100, unten: 100 }} />}
      <header className="twin-kopf">
        <button className="twin-zurueck" onClick={onZurueck}><ArrowLeft size={16} />Gebäude</button>
        <div><p>Digital Twin</p><h1>{name}</h1></div>
        <label className="twin-reduziert"><input type="checkbox" checked={reduziert}
          onChange={(e) => setReduziert(e.target.checked)} />Reduzierte Darstellung</label>
      </header>
      {!webgl && <p className="twin-meldung" role="alert">3D-Darstellung nicht verfügbar. Dein Browser unterstützt WebGL 2 nicht.</p>}
      {fehler && <p className="twin-meldung" role="alert">{fehler}</p>}
      {webgl && !welt && !fehler && <p className="twin-meldung" role="status">Gebäudemodell wird geladen …</p>}
      {welt && webgl && <>
        <nav className="twin-geschosse" aria-label="Geschoss auswählen">
          <Layers3 size={18} aria-hidden="true" />
          <button aria-pressed={fokusId === null} onClick={() => setFokusId(null)}>Übersicht</button>
          {geschosse.map((g) => <button key={g.id} aria-pressed={g.id === fokusId}
            onClick={() => setFokusId(g.id)}>{g.code}</button>)}
        </nav>
        <p className="twin-hilfe">{fokus ? `${fokus.code}: nach oben offen · untere Geschosse bleiben sichtbar` : "Drehen: ziehen · Vergrössern: scrollen"} · Leitungen: schematischer Verlauf</p>
      </>}
    </main>
  );
}
