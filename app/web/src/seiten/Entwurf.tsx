import { useEffect, useRef, useState } from "react";
import { ApiFehler, holeJson } from "../api";
import { Welt3D } from "../szene2/Welt3D";
import { GebaeudeKarte } from "../karten/GebaeudeKarte";
import { GeschossLeiste } from "../karten/GeschossLeiste";
import { Legende } from "../karten/Legende";
import { BauteilKarte } from "../karten/BauteilKarte";
import type { Beschreibung, Katalog, Welt } from "../typen";

interface Daten { welt: Welt; beschreibung: Beschreibung; katalog: Katalog }

function webglVorhanden(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch { return false; }
}

interface Props { gebaeudeId: string; name: string; onAbgelaufen?: () => void; onZurAnsicht: () => void }

export function Entwurf({ gebaeudeId, name, onAbgelaufen, onZurAnsicht }: Props) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fokusId, setFokusId] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [reduziert, setReduziert] = useState(false);
  const [webgl] = useState(webglVorhanden);
  const karteRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setDaten(null); setFehler(null); setFokusId(null); setAuswahl(null);
    Promise.all([
      holeJson<Welt>(`/api/szene/gebaeude/${gebaeudeId}/welt`),
      holeJson<Beschreibung>(`/api/struktur/gebaeude/${gebaeudeId}/beschreibung`),
      holeJson<Katalog>("/api/katalog/v1"),
    ]).then(([welt, beschreibung, katalog]) => setDaten({ welt, beschreibung, katalog }), (e: Error) => {
      if (e instanceof ApiFehler && e.status === 401 && onAbgelaufen) onAbgelaufen();
      else setFehler(e.message);
    });
  }, [gebaeudeId, onAbgelaufen]);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAuswahl((a) => { if (a === null) setFokusId(null); return null; });
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  const fokussiere = (id: string | null) => { setAuswahl(null); setFokusId(id); };
  if (!webgl) {
    return <p className="fehler" role="alert">3D-Darstellung nicht verfuegbar (WebGL fehlt). <button className="link" onClick={onZurAnsicht}>Bisherige Ansicht</button></p>;
  }
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!daten) return <p className="status">Laden …</p>;
  return (
    <main className={fokusId ? "entwurf fokus" : "entwurf"}>
      <Welt3D welt={daten.welt} katalog={daten.katalog.eintraege} fokusId={fokusId} auswahl={auswahl}
        onAuswahl={setAuswahl} reduziert={reduziert} karteRef={karteRef} />
      <GebaeudeKarte name={name} welt={daten.welt} beschreibung={daten.beschreibung} reduziert={reduziert} onReduziert={setReduziert} />
      <GeschossLeiste geschosse={daten.welt.geschosse} fokusId={fokusId} onFokus={fokussiere} />
      {fokusId && <Legende />}
      <BauteilKarte karteRef={karteRef} welt={daten.welt} beschreibung={daten.beschreibung} katalog={daten.katalog.eintraege}
        auswahl={auswahl} onSchliessen={() => setAuswahl(null)} />
    </main>
  );
}
