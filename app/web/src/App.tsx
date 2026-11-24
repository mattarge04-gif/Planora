import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { holeJson, sendeJson } from "./api";
import { Login } from "./seiten/Login";
import { Liste } from "./seiten/Liste";
import { TOKENS } from "./design/tokens";
import { pfadFuer, routeAusPfad, type AssistentRoute } from "./assistent/route";

const Twin = lazy(() => import("./seiten/Twin").then((modul) => ({ default: modul.Twin })));
const Erneuerungsplan = lazy(() => import("./seiten/Erneuerungsplan").then((modul) => ({ default: modul.Erneuerungsplan })));
const Dokumente = lazy(() => import("./seiten/Dokumente").then((modul) => ({ default: modul.Dokumente })));
const Assistent = lazy(() => import("./seiten/Assistent").then((modul) => ({ default: modul.Assistent })));

type Zustand =
  | { art: "laden" } | { art: "login" } | { art: "liste" }
  | { art: "twin"; gebaeudeId: string; name: string }
  | { art: "plan"; gebaeudeId: string; name: string }
  | { art: "dokumente"; gebaeudeId: string; name: string; bauteilId?: string; herkunft: "twin" | "plan"; ansicht?: "alle" | "preise" }
  | { art: "assistent"; route: AssistentRoute };

/** Adresszeile nachführen (nur der Assistent hat eigene Pfade; übrige Ansichten bleiben auf "/"). */
function adresse(pfad: string, ersetzen = false) {
  if (window.location.pathname === pfad) return;
  if (ersetzen) window.history.replaceState(null, "", pfad); else window.history.pushState(null, "", pfad);
}
const ausAdresse = (): Zustand => {
  const r = routeAusPfad(window.location.pathname);
  return r ? { art: "assistent", route: r } : { art: "liste" };
};

const ladeStil = { position: "fixed", inset: 0, display: "grid", placeItems: "center", background: TOKENS.farbe.grund,
  color: TOKENS.farbe.textSekundaer, fontFamily: TOKENS.typografie.familie, fontSize: TOKENS.typografie.groessePx.text } as const;

export function App() {
  const [zustand, setZustandRoh] = useState<Zustand>({ art: "laden" });
  const setZustand = useCallback((z: Zustand) => {
    if (z.art !== "login") adresse(z.art === "assistent" ? pfadFuer(z.route) : "/");
    setZustandRoh(z);
  }, []);
  useEffect(() => {
    holeJson("/api/ich").then(() => setZustandRoh(ausAdresse()), () => setZustandRoh({ art: "login" }));
    const zurueck = () => setZustandRoh((z) => (z.art === "login" || z.art === "laden" ? z : ausAdresse()));
    window.addEventListener("popstate", zurueck);
    return () => window.removeEventListener("popstate", zurueck);
  }, []);
  const abgelaufen = useCallback(() => setZustandRoh({ art: "login" }), []);
  const abmelden = async () => {
    try { await sendeJson("/api/auth/sign-out", {}); } finally { setZustand({ art: "login" }); }
  };
  if (zustand.art === "laden") return <p className="status">Laden …</p>;
  if (zustand.art === "login") return <Login onAngemeldet={() => setZustandRoh(ausAdresse())} />;
  if (zustand.art === "twin") return <Suspense fallback={<div role="status" style={ladeStil}>Digital Twin wird geladen …</div>}>
    <Twin gebaeudeId={zustand.gebaeudeId} name={zustand.name}
    onGebaeude={(g) => setZustand({ art: "twin", gebaeudeId: g.id, name: g.name })}
    onListe={() => setZustand({ art: "liste" })}
    onBearbeiten={() => setZustand({ art: "assistent", route: { art: "bearbeiten", gebaeudeId: zustand.gebaeudeId } })}
    onPlan={() => setZustand({ art: "plan", gebaeudeId: zustand.gebaeudeId, name: zustand.name })}
    onDokumente={(ansicht, bauteilId) => setZustand({ art: "dokumente", gebaeudeId: zustand.gebaeudeId, name: zustand.name, herkunft: "twin", ansicht, ...(bauteilId ? { bauteilId } : {}) })}
    onAbmelden={abmelden} onAbgelaufen={abgelaufen} /></Suspense>;
  if (zustand.art === "plan") return <Suspense fallback={<div role="status" style={ladeStil}>Erneuerungsplan wird geladen …</div>}>
    <Erneuerungsplan gebaeudeId={zustand.gebaeudeId} name={zustand.name}
      onTwin={() => setZustand({ art: "twin", gebaeudeId: zustand.gebaeudeId, name: zustand.name })}
      onDokumente={() => setZustand({ art: "dokumente", gebaeudeId: zustand.gebaeudeId, name: zustand.name, herkunft: "plan", ansicht: "preise" })} onAbgelaufen={abgelaufen} /></Suspense>;
  if (zustand.art === "dokumente") return <Suspense fallback={<div role="status" style={ladeStil}>Dokumente werden geladen …</div>}>
    <Dokumente key={zustand.gebaeudeId + (zustand.bauteilId ?? "") + (zustand.ansicht ?? "")} gebaeudeId={zustand.gebaeudeId} name={zustand.name} bauteilId={zustand.bauteilId}
      ansicht={zustand.ansicht ?? "alle"}
      zurueckText={zustand.herkunft === "plan" ? "Erneuerungsplan" : "Digital Twin"}
      onZurueck={() => setZustand({ art: zustand.herkunft, gebaeudeId: zustand.gebaeudeId, name: zustand.name })} onAbgelaufen={abgelaufen} /></Suspense>;
  if (zustand.art === "assistent") return <Suspense fallback={<div role="status" style={ladeStil}>Assistent wird geladen …</div>}>
    <Assistent key={zustand.route.art === "bearbeiten" ? zustand.route.gebaeudeId : "neu"} route={zustand.route}
      onAngelegt={(id) => adresse(pfadFuer({ art: "bearbeiten", gebaeudeId: id }), true)}
      onFertig={(id, name) => setZustand({ art: "twin", gebaeudeId: id, name })}
      onSchliessen={() => setZustand({ art: "liste" })} onAbgelaufen={abgelaufen} /></Suspense>;
  return (
    <div className="rahmen">
      <header className="kopf">
        <strong>Planora</strong>
        <span className="abstand" />
        <button className="link" onClick={abmelden}>Abmelden</button>
      </header>
      <Liste onWahl={(g) => setZustand({ art: "twin", gebaeudeId: g.id, name: g.name })}
        onBearbeiten={(g) => setZustand({ art: "assistent", route: { art: "bearbeiten", gebaeudeId: g.id } })}
        onNeu={() => setZustand({ art: "assistent", route: { art: "neu" } })} onAbgelaufen={abgelaufen} />
    </div>
  );
}
