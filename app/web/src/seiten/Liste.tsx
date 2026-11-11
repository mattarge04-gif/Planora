import { useEffect, useState } from "react";
import { holeJson } from "../api";
import type { GebaeudeEintrag } from "../typen";

export function Liste({ onWahl }: { onWahl: (g: GebaeudeEintrag) => void }) {
  const [liste, setListe] = useState<GebaeudeEintrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  useEffect(() => { holeJson<GebaeudeEintrag[]>("/api/struktur/gebaeude").then(setListe, (e: Error) => setFehler(e.message)); }, []);
  if (fehler) return <p className="fehler" role="alert">{fehler}</p>;
  if (!liste) return <p className="status">Laden …</p>;
  if (liste.length === 0) return <p className="status">Noch keine Gebaeude erfasst.</p>;
  return (
    <main className="liste">
      <h2>Gebaeude</h2>
      <table>
        <thead><tr><th>Liegenschaft</th><th>Gebaeude</th><th>Geschosse</th></tr></thead>
        <tbody>
          {liste.map((g) => (
            <tr key={g.id}>
              <td>{g.liegenschaftName}</td>
              <td><button className="link" onClick={() => onWahl(g)}>{g.name}</button></td>
              <td>{g.geschosse}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
