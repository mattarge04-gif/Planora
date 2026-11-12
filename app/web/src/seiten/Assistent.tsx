import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, CloudCheck, LoaderCircle, X } from "lucide-react";
import { ApiFehler, holeJson } from "../api";
import { TOKENS } from "../design/tokens";
import { Szene3 } from "../szene3/Szene3";
import type { Freiraum } from "../szene3/kamera";
import type { GebaeudeEintrag, Huelle, KatalogEintrag, Welt } from "../typen";
import { Marke } from "../ui/Kopfzeile";
import { grundformAusWelt, zuBeschreibung, zuBeschreibungMitPositionen } from "../assistent/beschreibung";
import { Autosave, entwurfDaten, httpApi, konfliktLaden, ladeAssistent, type AssistentApi, type SpeicherStatus } from "../assistent/sitzung";
import { SCHRITTE, leererZustand, reduziere, schrittErreichbar, type AssistentZustand, type SchrittNr } from "../assistent/zustand";
import type { AssistentRoute } from "../assistent/route";
import { SCHRITT_INHALT } from "../assistent/schritte";
import "../ui/ui.css";
import "./Assistent.css";

const F = TOKENS.farbe;
const STIL = {
  "--tw-grund": F.grund, "--tw-flaeche": F.flaeche, "--tw-flaeche-2": F.flaecheSekundaer, "--tw-grau-1": F.grau1, "--tw-grau-2": F.grau2,
  "--tw-grau-3": F.grau3, "--tw-text": F.text, "--tw-sekundaer": F.textSekundaer, "--tw-sekundaer-kachel": F.textSekundaerKachel,
  "--tw-sekundaer-eis": F.textSekundaerEis, "--tw-eis": F.eis, "--tw-eis-akzent": F.eisAkzent, "--tw-heizung": F.kooHeizung,
  "--tw-heizung-grund": F.kooHeizungGrund, "--tw-link": F.link, "--tw-link-hover": F.linkHover, "--tw-warnung": F.statusWarnung,
  "--tw-panel-alpha": String(TOKENS.flaeche.panelDeckkraft), "--tw-panel-rahmen": TOKENS.flaeche.rahmen,
  "--tw-schatten": TOKENS.schatten.panel, "--tw-schatten-objekt": TOKENS.schatten.objekt,
  "--tw-radius": `${TOKENS.radius.panelPx}px`, "--tw-radius-kachel": `${TOKENS.radius.kachelPx}px`, "--tw-blur": `${TOKENS.flaeche.weichzeichnerPx}px`,
  "--tw-schrift": TOKENS.typografie.familie, "--tw-rand": `${TOKENS.abstand.seitenrandPx}px`,
  "--tw-hover-ms": `${TOKENS.bewegung.hoverMs}ms`, "--tw-panel-ms": `${TOKENS.bewegung.panelMs}ms`, "--tw-kurve": TOKENS.bewegung.kurve,
} as CSSProperties;

function webglVorhanden(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch { return false; }
}

export interface LiegenschaftWahl { id: string; name: string }

interface Props {
  route: AssistentRoute;
  api?: AssistentApi;
  onAngelegt: (gebaeudeId: string, name: string) => void;
  onFertig: (gebaeudeId: string, name: string) => void;
  onSchliessen: () => void;
  onAbgelaufen: () => void;
}

const SPEICHER_TEXT: Record<SpeicherStatus, string> = {
  bereit: "Entwurf", ungespeichert: "Änderungen …", speichert: "Speichert …", gespeichert: "Entwurf gespeichert",
  fehler: "Speichern fehlgeschlagen", konflikt: "Neu geladen",
};

/** Layoutmasse (CSS-Pixel) – identisch mit Assistent.css; daraus der freie Bereich der Vorschau. */
const LAYOUT = { rand: 20, kopf: 64, schritte: 232, formular: 560, abstand: 16 };

export function Assistent({ route, api = httpApi, onAngelegt, onFertig, onSchliessen, onAbgelaufen }: Props) {
  const neu = route.art === "neu";
  const [z, dispatch] = useReducer(reduziere, null, () => leererZustand(null));
  const [liste, setListe] = useState<GebaeudeEintrag[] | null>(null);
  const [bereit, setBereit] = useState(neu);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [katalog, setKatalog] = useState<KatalogEintrag[] | null>(null);
  const [status, setStatus] = useState<SpeicherStatus>("bereit");
  const [welt, setWelt] = useState<Welt | null>(null);
  const [vorschauFehler, setVorschauFehler] = useState<string[] | null>(null);
  const [vorschauLaeuft, setVorschauLaeuft] = useState(false);
  const [arbeitet, setArbeitet] = useState(false);
  const [webgl] = useState(webglVorhanden);
  const [breite, setBreite] = useState(() => window.innerWidth);
  const autosave = useRef<Autosave | null>(null);
  const zRef = useRef(z);
  zRef.current = z;
  const titelRef = useRef<HTMLHeadingElement>(null);
  const gebaeudeId = route.art === "bearbeiten" ? route.gebaeudeId : null;
  const gebaeudeName = liste?.find((g) => g.id === gebaeudeId)?.name;
  const liegenschaften: LiegenschaftWahl[] = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of liste ?? []) m.set(g.liegenschaftId, g.liegenschaftName);
    return [...m].map(([id, name]) => ({ id, name }));
  }, [liste]);
  const kopf = useMemo(() => ({}), []);

  const fehlerBehandeln = useCallback((e: unknown, fallback: string) => {
    if (e instanceof ApiFehler && e.status === 401) { onAbgelaufen(); return; }
    setFehler(e instanceof ApiFehler && e.meldungen.length ? e.meldungen.join(" ") : e instanceof Error ? e.message || fallback : fallback);
  }, [onAbgelaufen]);

  useEffect(() => {
    const f = () => setBreite(window.innerWidth);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  useEffect(() => {
    api.katalog().then((k) => setKatalog(k.eintraege), () => setKatalog(null));
    holeJson<GebaeudeEintrag[]>("/api/struktur/gebaeude").then(setListe, (e) => {
      if (e instanceof ApiFehler && e.status === 401) onAbgelaufen(); else setListe([]);
    });
  }, [api, onAbgelaufen]);

  // Name und Liegenschaft aus der Gebäudeliste (die Beschreibung enthält sie nicht)
  useEffect(() => {
    if (!liste || !bereit) return;
    if (gebaeudeId && gebaeudeName && !zRef.current.gebaeude.name) dispatch({ typ: "kopf", name: gebaeudeName });
    if (!gebaeudeId && !zRef.current.gebaeude.liegenschaftId && liegenschaften[0]) dispatch({ typ: "kopf", liegenschaftId: liegenschaften[0].id });
  }, [liste, bereit, gebaeudeId, gebaeudeName, liegenschaften]);

  // Laden (bestehendes Gebäude): Entwurf, sonst Beschreibung; Grundform und erste Ansicht aus der Welt
  useEffect(() => {
    if (!gebaeudeId) return;
    let aktiv = true;
    setBereit(false); setFehler(null);
    ladeAssistent(api, gebaeudeId, kopf).then((g) => {
      if (!aktiv) return;
      dispatch({ typ: "laden", zustand: g.zustand });
      if (g.ausEntwurf) setMeldung("Dein Entwurf ist wieder geöffnet.");
      autosaveStarten(g.entwurfStand, g.zustand);
      setBereit(true);
      api.ladeWelt(gebaeudeId).then((w) => {
        if (!aktiv) return;
        setWelt((alt) => alt ?? w);
        dispatch({ typ: "kopf", grundform: grundformAusWelt(w) });
      }, () => { /* Vorschau folgt */ });
    }, (e) => { if (aktiv) fehlerBehandeln(e, "Gebäude konnte nicht geladen werden."); });
    return () => { aktiv = false; autosave.current?.beenden(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gebaeudeId, api]);

  function autosaveStarten(stand: number, basis: AssistentZustand) {
    autosave.current?.beenden();
    const id = basis.gebaeude.id!;
    const a = new Autosave((s, d) => api.speichereEntwurf(id, s, d), stand, setStatus, () => {
      void konfliktLaden(api, id, kopf, zRef.current.schritt).then((g) => {
        dispatch({ typ: "laden", zustand: g.zustand });
        a.neuStart(g.entwurfStand, entwurfDaten(g.zustand));
        setMeldung(g.meldung);
      }, (e) => fehlerBehandeln(e, "Entwurf konnte nicht neu geladen werden."));
    });
    a.basis(entwurfDaten(basis));
    autosave.current = a;
  }

  // Autosave: Schrittwechsel sofort, Eingaben 1.5 s nach der letzten Änderung
  const letzterSchritt = useRef(z.schritt);
  useEffect(() => {
    const a = autosave.current;
    if (!a || !bereit || !z.gebaeude.id) return;
    const daten = entwurfDaten(z);
    if (letzterSchritt.current !== z.schritt) { letzterSchritt.current = z.schritt; void a.sofort(daten); }
    else a.eingabe(daten);
  }, [z, bereit]);

  // Vorschau: entprellt, ohne Speichern. Schrittwechsel allein löst keine neue Vorschau aus.
  const datenSchluessel = useMemo(() => JSON.stringify({ ...z, schritt: 0 }), [z]);
  useEffect(() => {
    if (!bereit || !z.gebaeude.id) return;
    let aktiv = true;
    const id = z.gebaeude.id;
    const t = setTimeout(() => {
      setVorschauLaeuft(true);
      api.vorschau(id, zuBeschreibung(zRef.current)).then((w) => {
        if (!aktiv) return;
        setWelt(w); setVorschauFehler(null);
      }, (e) => {
        if (!aktiv) return;
        if (e instanceof ApiFehler && e.status === 401) onAbgelaufen();
        else setVorschauFehler(e instanceof ApiFehler && e.meldungen.length ? e.meldungen : ["Vorschau nicht verfügbar."]);
      }).finally(() => { if (aktiv) setVorschauLaeuft(false); });
    }, 600);
    return () => { aktiv = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datenSchluessel, bereit]);

  // Fokus auf den Schritttitel nach Schrittwechsel (Tastatur, Screenreader)
  const ersterRender = useRef(true);
  useEffect(() => {
    if (ersterRender.current) { ersterRender.current = false; return; }
    titelRef.current?.focus();
  }, [z.schritt]);

  async function gebaeudeAnlegen(): Promise<boolean> {
    const g = zRef.current.gebaeude;
    if (!g.name.trim()) { setFehler("Bitte einen Gebäudenamen eingeben."); return false; }
    if (!g.liegenschaftId) { setFehler("Keine Liegenschaft verfügbar."); return false; }
    setArbeitet(true); setFehler(null);
    try {
      const huelle: Huelle = { name: g.name.trim(), grundform: g.grundform, geschosse: g.geschosse.map((x) => ({ code: x.code })) };
      const id = await api.legeAn(g.liegenschaftId, huelle);
      const b = await api.ladeBeschreibung(id);
      dispatch({ typ: "gebaeudeAngelegt", id, stand: b.stand, geschosse: b.geschosse ?? [] });
      const angelegt = reduziere(zRef.current, { typ: "gebaeudeAngelegt", id, stand: b.stand, geschosse: b.geschosse ?? [] });
      autosaveStarten(0, angelegt);
      onAngelegt(id, huelle.name);
      return true;
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 403) setFehler("Neue Gebäude legt Planora für dich an (Recht «Hülle verwalten»). Bitte wende dich an Planora.");
      else fehlerBehandeln(e, "Gebäude konnte nicht angelegt werden.");
      return false;
    } finally { setArbeitet(false); }
  }

  async function weiter() {
    if (z.schritt === 1 && !z.gebaeude.id) {
      if (!(await gebaeudeAnlegen())) return;
    }
    setFehler(null);
    dispatch({ typ: "weiter" });
  }

  async function uebernehmen() {
    const id = z.gebaeude.id;
    if (!id) return;
    setArbeitet(true); setFehler(null);
    try {
      autosave.current?.beenden();
      await api.uebernehmen(id, zuBeschreibung(z));
      try { await api.loescheEntwurf(id); } catch { /* Entwurf bleibt liegen; beim nächsten Öffnen überschreibbar */ }
      onFertig(id, z.gebaeude.name || gebaeudeName || "Gebäude");
    } catch (e) {
      if (e instanceof ApiFehler && e.status === 409) setFehler("Die Beschreibung wurde inzwischen geändert. Bitte den Assistenten schliessen und neu öffnen.");
      else fehlerBehandeln(e, "Übernehmen fehlgeschlagen.");
      autosaveStarten(autosave.current?.stand ?? 0, z);
    } finally { setArbeitet(false); }
  }

  async function schliessen() {
    try { await autosave.current?.flush(); } catch { /* Status zeigt Fehler */ }
    autosave.current?.beenden();
    onSchliessen();
  }

  const positionen = useMemo(() => zuBeschreibungMitPositionen(z).positionen, [z]);
  const freiraum: Freiraum = useMemo(() => {
    const links = LAYOUT.rand + LAYOUT.schritte + LAYOUT.abstand + Math.min(LAYOUT.formular, breite * 0.42) + LAYOUT.abstand;
    return { links, rechts: LAYOUT.rand, oben: LAYOUT.kopf + 40, unten: LAYOUT.rand + 8 };
  }, [breite]);

  const Inhalt = SCHRITT_INHALT[z.schritt];
  const info = SCHRITTE[z.schritt - 1];
  const name = z.gebaeude.name || gebaeudeName || (neu ? "Neues Gebäude" : "Gebäude");

  return (
    <main className="as" style={STIL} aria-label="Gebäude-Assistent">
      {webgl && welt && katalog && <Szene3 welt={welt} katalog={katalog} fokusId={null} reduziert={false} freiraum={freiraum} />}
      <div className="as-flaeche">
        <header className="as-kopf">
          <div className="as-kopf-links">
            <Marke />
            <span className="as-wortmarke">Planora</span>
            <span className="as-trenner" aria-hidden="true" />
            <span className="as-gebaeude" title={name}>{name}</span>
            <span className="as-modus">Assistent</span>
          </div>
          <div className="as-kopf-rechts">
            {z.gebaeude.id && <span className={`as-status as-status-${status}`} role="status" aria-live="polite">
              {status === "speichert" || status === "ungespeichert" ? <LoaderCircle className="as-drehen" size={14} strokeWidth={1.75} aria-hidden /> :
                status === "fehler" || status === "konflikt" ? <CircleAlert size={14} strokeWidth={1.75} aria-hidden /> : <CloudCheck size={14} strokeWidth={1.75} aria-hidden />}
              {SPEICHER_TEXT[status]}
            </span>}
            <button type="button" className="as-knopf as-knopf-leise" onClick={schliessen}><X size={16} strokeWidth={1.75} aria-hidden />Schliessen</button>
          </div>
        </header>

        <nav className="as-schritte ui-glas" aria-label="Schritte">
          <ol>
            {SCHRITTE.map((s) => {
              const aktiv = s.nr === z.schritt;
              const erledigt = s.nr < z.schritt;
              const erreichbar = bereit && schrittErreichbar(z, s.nr);
              return (
                <li key={s.nr}>
                  <button type="button" className="as-schritt" aria-current={aktiv ? "step" : undefined} disabled={!erreichbar}
                    data-erledigt={erledigt || undefined} onClick={() => dispatch({ typ: "schritt", nr: s.nr as SchrittNr })}>
                    <span className="as-schritt-nr" aria-hidden="true">{erledigt ? <Check size={13} strokeWidth={2.25} /> : s.nr}</span>
                    <span className="as-schritt-text"><span className="as-schritt-titel">{s.titel}</span><span className="as-schritt-kurz">{s.kurz}</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="as-formular ui-glas" aria-labelledby="as-titel">
          <header className="as-formular-kopf">
            <span className="as-schritt-zaehler">Schritt {z.schritt} von {SCHRITTE.length}</span>
            <h1 id="as-titel" ref={titelRef} tabIndex={-1}>{info.titel}</h1>
          </header>
          <div className="as-formular-inhalt">
            {meldung && <p className="as-meldung" role="status"><span>{meldung}</span>
              <button type="button" className="as-rundknopf" aria-label="Meldung schliessen" onClick={() => setMeldung(null)}><X size={14} strokeWidth={1.75} aria-hidden /></button></p>}
            {!bereit && !fehler && <p className="as-laden" role="status">Gebäude wird geladen …</p>}
            {bereit && <Inhalt z={z} dispatch={dispatch} katalog={katalog} neu={neu} liegenschaften={liegenschaften}
              welt={welt} vorschauFehler={vorschauFehler} positionen={positionen} onUebernehmen={uebernehmen} arbeitet={arbeitet} />}
          </div>
          <footer className="as-formular-fuss">
            {fehler && <p className="as-fehler" role="alert"><CircleAlert size={16} strokeWidth={1.75} aria-hidden />{fehler}</p>}
            <div className="as-fuss-knoepfe">
              <button type="button" className="as-knopf" onClick={() => dispatch({ typ: "zurueck" })} disabled={z.schritt === 1 || arbeitet}>
                <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />Zurück</button>
              {z.schritt < 8
                ? <button type="button" className="as-knopf as-knopf-primaer" onClick={weiter} disabled={!bereit || arbeitet}>
                  {z.schritt === 1 && !z.gebaeude.id ? "Gebäude anlegen" : "Weiter"}<ArrowRight size={16} strokeWidth={1.75} aria-hidden /></button>
                : <button type="button" className="as-knopf as-knopf-primaer" onClick={uebernehmen} disabled={!bereit || arbeitet || !z.gebaeude.id}>
                  <Check size={16} strokeWidth={1.75} aria-hidden />Übernehmen</button>}
            </div>
          </footer>
        </section>

        <aside className="as-vorschau" aria-label="Live-Vorschau">
          <span className="as-vorschau-chip">
            <span className={`as-punkt${vorschauLaeuft ? " as-punkt-aktiv" : ""}`} aria-hidden="true" />
            Live-Vorschau{vorschauLaeuft ? " wird berechnet …" : ""}
          </span>
          {!webgl && <p className="as-vorschau-notiz ui-glas">3D-Vorschau nicht verfügbar. Dein Browser unterstützt WebGL 2 nicht.</p>}
          {webgl && !welt && bereit && z.gebaeude.id && !vorschauFehler && <p className="as-vorschau-notiz">Vorschau wird erstellt …</p>}
          {webgl && !z.gebaeude.id && <p className="as-vorschau-notiz">Die Vorschau erscheint, sobald das Gebäude angelegt ist.</p>}
          {vorschauFehler && <div className="as-vorschau-notiz as-vorschau-fehler ui-glas" role="status">
            <strong>Vorschau nicht aktuell</strong>
            <ul>{vorschauFehler.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>}
        </aside>
      </div>
    </main>
  );
}
