import { useEffect, useMemo, useState } from "react";
import { ApiFehler, holeJson } from "../api";
import { Szene } from "../szene/Szene";
import { szeneDaten } from "../szene/daten";
import { Panel } from "../panel/Panel";
import type { Beschreibung, Katalog, Welt } from "../typen";

interface Daten { welt: Welt; beschreibung: Beschreibung; katalog: Katalog }

/** onAbgelaufen: wird bei 401 (Sitzung abgelaufen) statt einer Fehlermeldung aufgerufen. */
export function Ansicht({ gebaeudeId, onAbgelaufen }: { gebaeudeId: string; onAbgelaufen?: () => void }) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  useEffect(() => {
    setDaten(null); setFehler(null); setAuswahl(null);
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
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setAuswahl(null); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  const szene = useMemo(() => (daten ? szeneDaten(daten.welt, daten.katalog.eintraege) : null), [daten]);
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!daten || !szene) return <p className="status">Laden …</p>;
  return (
    <main className="ansicht">
      <Szene daten={szene} auswahl={auswahl} onAuswahl={setAuswahl} />
      <Panel welt={daten.welt} beschreibung={daten.beschreibung} katalog={daten.katalog.eintraege} auswahl={auswahl} />
    </main>
  );
}
