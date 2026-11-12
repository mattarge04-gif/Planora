import { useCallback, useEffect, useState } from "react";
import { holeJson, sendeJson } from "./api";
import { Login } from "./seiten/Login";
import { Liste } from "./seiten/Liste";
import { Ansicht } from "./seiten/Ansicht";
import { Entwurf } from "./seiten/Entwurf";

type Zustand =
  | { art: "laden" } | { art: "login" } | { art: "liste" }
  | { art: "ansicht"; gebaeudeId: string; name: string }
  | { art: "entwurf"; gebaeudeId: string; name: string };

export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: "laden" });
  useEffect(() => {
    holeJson("/api/ich").then(() => setZustand({ art: "liste" }), () => setZustand({ art: "login" }));
  }, []);
  const abgelaufen = useCallback(() => setZustand({ art: "login" }), []);
  const abmelden = async () => {
    try { await sendeJson("/api/auth/sign-out", {}); } finally { setZustand({ art: "login" }); }
  };
  if (zustand.art === "laden") return <p className="status">Laden …</p>;
  if (zustand.art === "login") return <Login onAngemeldet={() => setZustand({ art: "liste" })} />;
  const gebaeude = zustand.art === "ansicht" || zustand.art === "entwurf" ? zustand : null;
  return (
    <div className="rahmen">
      <header className="kopf">
        <strong>Planora</strong>
        {gebaeude && <><button className="link" onClick={() => setZustand({ art: "liste" })}>← Gebaeude</button><span>{gebaeude.name}</span></>}
        {zustand.art === "ansicht" && <button className="link" onClick={() => setZustand({ ...zustand, art: "entwurf" })}>Entwurf</button>}
        {zustand.art === "entwurf" && <button className="link" onClick={() => setZustand({ ...zustand, art: "ansicht" })}>Bisherige Ansicht</button>}
        <span className="abstand" />
        <button className="link" onClick={abmelden}>Abmelden</button>
      </header>
      {zustand.art === "liste" && <Liste onWahl={(g) => setZustand({ art: "ansicht", gebaeudeId: g.id, name: g.name })} onAbgelaufen={abgelaufen} />}
      {zustand.art === "ansicht" && <Ansicht gebaeudeId={zustand.gebaeudeId} onAbgelaufen={abgelaufen} />}
      {zustand.art === "entwurf" && (
        <Entwurf gebaeudeId={zustand.gebaeudeId} name={zustand.name} onAbgelaufen={abgelaufen}
          onZurAnsicht={() => setZustand({ ...zustand, art: "ansicht" })} />
      )}
    </div>
  );
}
