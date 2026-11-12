import { useEffect, useState } from "react";
import { ApiFehler, holeJson } from "../api";
import type { GebaeudeEintrag } from "../typen";

interface Props {
  onWahl: (g: GebaeudeEintrag) => void;
  onBearbeiten?: (g: GebaeudeEintrag) => void;
  onNeu?: () => void;
  /** Wird bei 401 (Sitzung abgelaufen) statt einer Fehlermeldung aufgerufen. */
  onAbgelaufen?: () => void;
}

export function Liste({ onWahl, onBearbeiten, onNeu, onAbgelaufen }: Props) {
  const [liste, setListe] = useState<GebaeudeEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => {
    holeJson<GebaeudeEintrag[]>("/api/struktur/gebaeude").then(setListe, (e: Error) => {
      if (e instanceof ApiFehler && e.status === 401 && onAbgelaufen) onAbgelaufen();
      else setFehler(e.message);
    });
  }, [onAbgelaufen]);
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!liste) return <p className="status">Laden …</p>;
  return (
    <main className="liste">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.8rem" }}>
        <h2 style={{ margin: 0 }}>Gebäude</h2>
        {onNeu && <button type="button" onClick={onNeu}>Neues Gebäude</button>}
      </div>
      {liste.length === 0 ? <p className="status">Noch keine Gebäude erfasst.</p> : (
        <table>
          <thead><tr><th>Liegenschaft</th><th>Gebäude</th><th>Geschosse</th>{onBearbeiten && <th>Assistent</th>}</tr></thead>
          <tbody>
            {liste.map((g) => (
              <tr key={g.id}>
                <td>{g.liegenschaftName}</td>
                <td><button className="link" onClick={() => onWahl(g)}>{g.name}</button></td>
                <td>{g.geschosse}</td>
                {onBearbeiten && <td><button className="link" onClick={() => onBearbeiten(g)} aria-label={`${g.name} bearbeiten`}>Bearbeiten</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
