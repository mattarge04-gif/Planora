import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { holeJson, sendeJson } from "./api";
import { Login } from "./seiten/Login";
import { Liste } from "./seiten/Liste";
import { TOKENS } from "./design/tokens";

const Twin = lazy(() => import("./seiten/Twin").then((modul) => ({ default: modul.Twin })));

type Zustand =
  | { art: "laden" } | { art: "login" } | { art: "liste" }
  | { art: "twin"; gebaeudeId: string; name: string };

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
  if (zustand.art === "twin") return <Suspense fallback={<div role="status" style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center",
    background: TOKENS.farbe.grund, color: TOKENS.farbe.textSekundaer, fontFamily: TOKENS.typografie.familie, fontSize: TOKENS.typografie.groessePx.text }}>Digital Twin wird geladen …</div>}>
    <Twin gebaeudeId={zustand.gebaeudeId} name={zustand.name}
    onGebaeude={(g) => setZustand({ art: "twin", gebaeudeId: g.id, name: g.name })}
    onListe={() => setZustand({ art: "liste" })}
    onAbmelden={abmelden} onAbgelaufen={abgelaufen} /></Suspense>;
  return (
    <div className="rahmen">
      <header className="kopf">
        <strong>Planora</strong>
        <span className="abstand" />
        <button className="link" onClick={abmelden}>Abmelden</button>
      </header>
      <Liste onWahl={(g) => setZustand({ art: "twin", gebaeudeId: g.id, name: g.name })} onAbgelaufen={abgelaufen} />
    </div>
  );
}
