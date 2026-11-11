import { useEffect, useState } from "react";
import { holeJson, sendeJson } from "./api";
import { Login } from "./seiten/Login";
import { Liste } from "./seiten/Liste";
import { Ansicht } from "./seiten/Ansicht";

type Zustand = { art: "laden" } | { art: "login" } | { art: "liste" } | { art: "ansicht"; gebaeudeId: string; name: string };

export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: "laden" });
  useEffect(() => {
    holeJson("/api/ich").then(() => setZustand({ art: "liste" }), () => setZustand({ art: "login" }));
  }, []);
  const abmelden = async () => {
    try { await sendeJson("/api/auth/sign-out", {}); } finally { setZustand({ art: "login" }); }
  };
  if (zustand.art === "laden") return <p className="status">Laden …</p>;
  if (zustand.art === "login") return <Login onAngemeldet={() => setZustand({ art: "liste" })} />;
  return (
    <div className="rahmen">
      <header className="kopf">
        <strong>Planora</strong>
        {zustand.art === "ansicht" && <><button className="link" onClick={() => setZustand({ art: "liste" })}>← Gebaeude</button><span>{zustand.name}</span></>}
        <span className="abstand" />
        <button className="link" onClick={abmelden}>Abmelden</button>
      </header>
      {zustand.art === "liste"
        ? <Liste onWahl={(g) => setZustand({ art: "ansicht", gebaeudeId: g.id, name: g.name })} />
        : <Ansicht gebaeudeId={zustand.gebaeudeId} />}
    </div>
  );
}
