// Seite Dokumente, Zustand "Alle Dokumente": Ablage-Liste links, Detail rechts (Vorschau, Kategorie, Verknüpfungen, Aktionen).
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Download, Eye, FilePlus2, Info, Link2, Lock, Plus, RotateCw, ScanSearch, Search, ShieldX, Trash2, TriangleAlert, X } from "lucide-react";
import type { AblageBauteil, AblageMeldung as AblageHinweis, AblageZeile, Kategorie } from "../dokumente/typen";
import { dateiUrl, ladeBytes } from "../dokumente/api";
import { DATEI_ACCEPT, KATEGORIEN, bauteilKandidaten, datenblattVorschlag, filtere, groesseText, kategorieName, oeffnenArt, scanAnzeige } from "../dokumente/ansicht";
import { anzeigeName, iconFuer } from "../dashboard";
import type { KatalogEintrag } from "../typen";
import { ANLAGEN_ICON } from "../karten/TwinObjekt";
import { DokumentSymbol, endung } from "../ui/dokumentSymbol";
import { datum } from "./dokumenteAnsicht";

export type { AblageMeldung as AblageHinweis } from "../dokumente/typen";

/** Ablegeflaeche: Ziehen auf die ganze Liste, Knopf öffnet die Dateiauswahl. */
export function useAblegen(darf: boolean, onDateien: (f: File[]) => void) {
  const [ziehen, setZiehen] = useState(false);
  const tiefe = useRef(0);
  const ziel = darf ? {
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
    onDragEnter: (e: DragEvent) => { if (e.dataTransfer.types.includes("Files")) { tiefe.current++; setZiehen(true); } },
    onDragLeave: () => { tiefe.current = Math.max(0, tiefe.current - 1); if (!tiefe.current) setZiehen(false); },
    onDrop: (e: DragEvent) => { e.preventDefault(); tiefe.current = 0; setZiehen(false); onDateien([...e.dataTransfer.files]); },
  } : {};
  return { ziehen, ziel };
}

export function AblageHinweise({ hinweise, onAus }: { hinweise: AblageHinweis[]; onAus: () => void }) {
  if (!hinweise.length) return null;
  return (
    <ul className="dk-ablage-fehler" role="alert">
      {hinweise.map((f, i) => <li key={i} className={f.art === "hinweis" ? "dk-ablage-hinweis" : undefined}>{f.art === "hinweis"
        ? <Info size={13} strokeWidth={2} aria-hidden="true" /> : <TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />}<span><strong>{f.datei}</strong>{f.text}</span></li>)}
      <li><button type="button" className="dk-leise" onClick={onAus}>Ausblenden</button></li>
    </ul>
  );
}

/** Scan-Zustand in der Liste: geprüft als stiller Punkt, sonst Text (abgelehnt rot, Signatur nur im Tooltip). */
export function ScanZustand({ d, kurz = false }: { d: AblageZeile; kurz?: boolean }) {
  const s = scanAnzeige(d);
  if (s.art === "ok") return <span className="dk-scan dk-scan-ok" title="Virenprüfung bestanden"><i aria-hidden="true" /><span className={kurz ? "ui-sr" : undefined}>geprüft</span></span>;
  return <span className={`dk-scan dk-scan-${s.art}`} title={s.detail}>
    {s.art === "laeuft" ? <i aria-hidden="true" /> : s.art === "abgelehnt" ? <ShieldX size={12} strokeWidth={2.2} aria-hidden="true" /> : <TriangleAlert size={12} strokeWidth={2.2} aria-hidden="true" />}
    {s.art === "abgelehnt" && kurz ? "abgelehnt" : s.text}
  </span>;
}

/** Ort eines Bauteils; gleicher Typ am gleichen Ort mehrfach (z. B. zwei Pumpen in der Zentrale): nummeriert wie in den Preis-Kandidaten. */
function ortText(b: AblageBauteil, alle: AblageBauteil[]): string {
  const gleich = alle.filter((x) => x.katalogId === b.katalogId && x.ort === b.ort);
  return gleich.length > 1 ? `${b.ort}, Nr. ${gleich.indexOf(b) + 1}` : b.ort;
}

const verknuepftText = (n: number) => (n === 0 ? "nicht verknüpft" : n === 1 ? "1 Bauteil" : `${n} Bauteile`);

interface ListeProps {
  dokumente: AblageZeile[]; darf: boolean; aktivId: string | null; ablegen: string[]; hinweise: AblageHinweis[];
  onWahl: (id: string) => void; onDateien: (f: File[]) => void; onHinweiseAus: () => void; onErneut: (d: AblageZeile) => void;
}

export function AkteListe({ dokumente, darf, aktivId, ablegen, hinweise, onWahl, onDateien, onHinweiseAus, onErneut }: ListeProps) {
  const [kategorie, setKategorie] = useState<Kategorie | null>(null);
  const [nurUnverknuepft, setNurUnverknuepft] = useState(false);
  const feld = useRef<HTMLInputElement>(null);
  const { ziehen, ziel } = useAblegen(darf, onDateien);
  // Server liefert neueste zuerst (hochgeladen_am desc): neu Abgelegtes steht oben.
  const sichtbar = useMemo(() => filtere(dokumente, { kategorie, nurUnverknuepft }), [dokumente, kategorie, nurUnverknuepft]);
  const vorhanden = KATEGORIEN.filter((k) => dokumente.some((d) => d.kategorie === k.id));
  const unverknuepft = dokumente.filter((d) => d.bauteilIds.length === 0).length;
  const leer = dokumente.length === 0 && ablegen.length === 0;
  const waehle = () => feld.current?.click();

  return (
    <section className={`ep-karte dk-akte-liste${ziehen ? " dk-ziehen" : ""}${leer ? " dk-akte-leer" : ""}`} aria-labelledby="dk-akte-titel" {...ziel}>
      {darf && <input ref={feld} type="file" accept={DATEI_ACCEPT} multiple className="ui-sr" tabIndex={-1} aria-hidden="true"
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; onDateien(f); }} />}
      <div className="dk-akte-kopf">
        <h2 id="dk-akte-titel">Abgelegt <span className="ep-anzahl">{dokumente.length}</span></h2>
        {dokumente.length > 0 && <div className="dk-filter" role="group" aria-label="Filter">
          <label className="dk-auswahl">
            <span className="ui-sr">Kategorie</span>
            <select value={kategorie ?? ""} onChange={(e) => setKategorie((e.target.value || null) as Kategorie | null)}>
              <option value="">Alle Kategorien</option>
              {(vorhanden.length ? vorhanden : KATEGORIEN).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
          <button type="button" className={`dk-chip-knopf${nurUnverknuepft ? " dk-chip-an" : ""}`} aria-pressed={nurUnverknuepft} onClick={() => setNurUnverknuepft(!nurUnverknuepft)}>
            Nicht verknüpft <span>{unverknuepft}</span></button>
        </div>}
      </div>
      {darf && (leer
        ? <div className="dk-ablage dk-ablage-gross">
          <span className="dk-ablage-symbol" aria-hidden="true"><FilePlus2 size={22} strokeWidth={1.5} /></span>
          <p><strong>Unterlagen hierher ziehen</strong>Datenblätter, Pläne, Offerten, Fotos und Protokolle als PDF, JPG, PNG, HEIC oder Office-Datei, bis 100 MB. Jede Datei wird auf Viren geprüft.</p>
          <button type="button" className="ep-knopf ep-knopf-haupt" onClick={waehle}><Plus size={15} strokeWidth={2} aria-hidden="true" />Dateien wählen</button>
        </div>
        : <div className="dk-ablage">
          <FilePlus2 size={18} strokeWidth={1.6} aria-hidden="true" />
          <p><strong>Dateien hierher ziehen</strong>PDF, Bilder und Office bis 100 MB</p>
          <button type="button" className="ep-knopf" onClick={waehle}>Dateien wählen</button>
        </div>)}
      <AblageHinweise hinweise={hinweise} onAus={onHinweiseAus} />
      {leer && !darf && <p className="ep-leer dk-liste-leer">Noch keine Dokumente abgelegt.</p>}
      {!leer && <div className="dk-tabelle" role="list" aria-label="Abgelegte Dokumente">
        <div className="dk-z dk-z-kopf" aria-hidden="true"><span>Name</span><span>Kategorie</span><span>Abgelegt</span><span className="dk-z-zahl">Grösse</span><span>Prüfung</span></div>
        {ablegen.map((n) => <div key={"ab-" + n} role="listitem" className="dk-z dk-z-ablegen">
          <span className="dk-z-name"><span className="dk-z-icon" aria-hidden="true"><DokumentSymbol kategorie="sonstiges" /></span><span className="dk-z-titel"><span>{n}</span></span></span>
          <span /><span /><span /><span className="dk-scan dk-scan-laeuft"><i aria-hidden="true" />wird abgelegt …</span>
        </div>)}
        {sichtbar.map((d) => {
          const aktiv = d.id === aktivId;
          return <div key={d.id} id={`dk-z-${d.id}`} role="listitem" className={`dk-z${aktiv ? " dk-z-aktiv" : ""}${d.scanStatus === "abgelehnt" ? " dk-z-abgelehnt" : ""}`}>
            <span className="dk-z-name">
              <span className="dk-z-icon" aria-hidden="true"><DokumentSymbol kategorie={d.kategorie} /></span>
              <button type="button" className="dk-z-wahl" aria-current={aktiv ? "true" : undefined} onClick={() => onWahl(d.id)} title={d.dateiname}>
                <span className="dk-z-titel"><span>{d.dateiname}</span></span>
                <span className={`dk-z-unter${d.bauteilIds.length === 0 ? " dk-z-frei" : ""}`}>{endung(d)}<span aria-hidden="true"> · </span>{verknuepftText(d.bauteilIds.length)}</span>
              </button>
            </span>
            <span className="dk-z-text">{kategorieName(d.kategorie)}</span>
            <span className="dk-z-text dk-z-zahl-links">{datum(d.hochgeladenAm)}</span>
            <span className="dk-z-text dk-z-zahl">{groesseText(d.groesse)}</span>
            <span className="dk-z-status"><ScanZustand d={d} kurz />
              {d.scanStatus === "scan_fehler" && darf && <button type="button" className="dk-leise dk-z-erneut" onClick={() => onErneut(d)}>
                <RotateCw size={12} strokeWidth={2} aria-hidden="true" />Erneut prüfen</button>}</span>
          </div>;
        })}
        {sichtbar.length === 0 && ablegen.length === 0 && <p className="dk-tabelle-leer">Kein Dokument in diesem Filter.
          <button type="button" className="dk-leise" onClick={() => { setKategorie(null); setNurUnverknuepft(false); }}>Filter aufheben</button></p>}
      </div>}
    </section>
  );
}

/** Erste PDF-Seite klein (gleicher Renderer wie der Viewer); bei Fehler bleibt das Symbol. */
function PdfVorschau({ id, onFehler }: { id: string; onFehler: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bereit, setBereit] = useState(false);
  useEffect(() => {
    let aktiv = true; let zu: (() => void) | null = null;
    setBereit(false);
    void (async () => {
      try {
        const b = await ladeBytes(id);
        const { oeffnePdf, seitenBreite, zeichneSeite, schliessePdf } = await import("../viewer/pdf");
        const doc = await oeffnePdf(b);
        zu = () => schliessePdf(doc);
        if (!aktiv) { zu(); return; }
        if (!aktiv || !canvas.current) return;
        const s = Math.min(1, 168 / Math.max(1, await seitenBreite(doc, 1)));
        await zeichneSeite(doc, 1, canvas.current, s).fertig;
        if (aktiv) setBereit(true);
      } catch { if (aktiv) onFehler(); }
    })();
    return () => { aktiv = false; zu?.(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvas} className={`dk-vorschau-pdf${bereit ? " dk-vorschau-bereit" : ""}`} aria-hidden="true" />;
}

function Vorschau({ d, onOeffnen }: { d: AblageZeile; onOeffnen: () => void }) {
  const art = oeffnenArt(d);
  const [kaputt, setKaputt] = useState(false);
  useEffect(() => setKaputt(false), [d.id]);
  let inhalt: ReactNode;
  if (art === "gesperrt") {
    const s = scanAnzeige(d);
    inhalt = <span className={`dk-vorschau-symbol dk-vorschau-${s.art}`}>{d.scanStatus === "abgelehnt" ? <ShieldX size={24} strokeWidth={1.5} aria-hidden="true" /> : <Lock size={22} strokeWidth={1.5} aria-hidden="true" />}
      <small>{d.scanStatus === "quarantaene" ? "Vorschau nach der Virenprüfung" : "Gesperrt"}</small></span>;
  } else if (art === "pdf" && !kaputt) inhalt = <PdfVorschau key={d.id} id={d.id} onFehler={() => setKaputt(true)} />;
  else if (art === "bild" && !kaputt) inhalt = <img src={dateiUrl(d.id)} alt="" onError={() => setKaputt(true)} />;
  else inhalt = <span className="dk-vorschau-symbol"><DokumentSymbol kategorie={d.kategorie} groesse={26} /><small>{endung(d)}</small></span>;
  const oeffenbar = art === "pdf" || art === "bild";
  return oeffenbar
    ? <button type="button" className="dk-vorschau dk-vorschau-knopf" onClick={onOeffnen} aria-label={`${d.dateiname} im Viewer öffnen`}>{inhalt}<span className="dk-vorschau-hover" aria-hidden="true"><Eye size={14} strokeWidth={1.75} />Öffnen</span></button>
    : <div className="dk-vorschau">{inhalt}</div>;
}

interface DetailProps {
  d: AblageZeile; bauteile: AblageBauteil[]; katalog: KatalogEintrag[]; darf: boolean; laeuft: boolean;
  /** "Preise lesen" möglich (Modul an, KI an, sauberes PDF, liest nicht schon). */
  lesen: { text: string; onLesen: () => void } | null;
  onOeffnen: () => void; onKategorie: (k: Kategorie) => void; onVerknuepfe: (ids: string[]) => void; onLoeschen: () => void; onErneut: () => void;
  children?: ReactNode;
}

export function AkteDetail({ d, bauteile, katalog, darf, laeuft, lesen, onOeffnen, onKategorie, onVerknuepfe, onLoeschen, onErneut, children }: DetailProps) {
  const [frage, setFrage] = useState(false);
  const [wahl, setWahl] = useState(false);
  useEffect(() => { setFrage(false); setWahl(false); }, [d.id]);
  const art = oeffnenArt(d);
  const sauber = d.scanStatus === "sauber";
  const nurLoeschen = !sauber && !(d.scanStatus === "scan_fehler" && darf);
  const name = (k: string) => anzeigeName(k, katalog);
  const verknuepft = d.bauteilIds.map((id) => bauteile.find((b) => b.id === id)).filter((b): b is AblageBauteil => !!b);
  const meta = [endung(d), groesseText(d.groesse), d.seiten ? (d.seiten === 1 ? "1 Seite" : `${d.seiten} Seiten`) : null, `abgelegt ${datum(d.hochgeladenAm)}`].filter(Boolean);
  return (
    <section className="ep-karte dk-detail" aria-labelledby="dk-detail-titel">
      <Vorschau d={d} onOeffnen={onOeffnen} />
      <div className="dk-detail-kopf">
        <h2 id="dk-detail-titel">{d.dateiname}</h2>
        <p className="dk-detail-meta">{meta.join(", ")}</p>
        {!sauber && <p className="dk-detail-scan"><ScanZustand d={d} />{d.scanStatus === "abgelehnt" && <span className="dk-detail-scan-text">Die Datei bleibt gesperrt und wird nach 7 Tagen gelöscht.</span>}
          {d.scanStatus === "scan_fehler" && d.scanGrund && <span className="dk-detail-scan-text">{d.scanGrund}</span>}</p>}
      </div>
      <div className="dk-detail-aktionen">
        {(art === "pdf" || art === "bild") && <button type="button" className="ep-knopf ep-knopf-haupt" onClick={onOeffnen}><Eye size={15} strokeWidth={1.75} aria-hidden="true" />Öffnen</button>}
        {sauber && <a className={`ep-knopf${art === "herunterladen" ? " ep-knopf-haupt" : ""}`} href={dateiUrl(d.id, true)} download={d.dateiname}><Download size={15} strokeWidth={1.75} aria-hidden="true" />Herunterladen</a>}
        {lesen && <button type="button" className="ep-knopf" disabled={laeuft} onClick={lesen.onLesen}><ScanSearch size={15} strokeWidth={1.75} aria-hidden="true" />{lesen.text}</button>}
        {d.scanStatus === "scan_fehler" && darf && <button type="button" className="ep-knopf" disabled={laeuft} onClick={onErneut}><RotateCw size={14} strokeWidth={1.75} aria-hidden="true" />Erneut prüfen</button>}
        {darf && (nurLoeschen
          // Gesperrte Datei ohne weitere Aktion: Löschen als lesbarer Knopf statt einsamem Symbol am Zeilenende.
          ? <button type="button" className="ep-knopf" onClick={() => setFrage(true)} aria-expanded={frage}><Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />Löschen</button>
          : <button type="button" className="dk-symbol dk-symbol-loeschen dk-detail-loeschen" onClick={() => setFrage(true)} aria-label={`${d.dateiname} löschen`} title="Löschen" aria-expanded={frage}>
            <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" /></button>)}
      </div>
      {frage && <div className="dk-frage dk-detail-frage" role="group" aria-label="Löschen bestätigen" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setFrage(false); } }}>
        <p>{d.art === "pdf" ? "Dokument löschen? Verknüpfungen und offene Preisvorschläge entfallen, übernommene Preise bleiben." : "Dokument löschen? Die Verknüpfungen mit Bauteilen entfallen."}</p>
        <div><button type="button" className="ep-knopf dk-knopf-gefahr" autoFocus onClick={() => { setFrage(false); onLoeschen(); }}>Löschen</button>
          <button type="button" className="dk-leise" onClick={() => setFrage(false)}>Abbrechen</button></div>
      </div>}

      <div className="dk-detail-block">
        <label className="dk-detail-zeile" htmlFor="dk-kategorie"><span>Kategorie</span>
          {darf && d.scanStatus !== "abgelehnt"
            ? <span className="dk-auswahl dk-auswahl-breit"><select id="dk-kategorie" value={d.kategorie} disabled={laeuft} onChange={(e) => onKategorie(e.target.value as Kategorie)}>
              {KATEGORIEN.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></span>
            : <span className="dk-detail-wert">{kategorieName(d.kategorie)}</span>}
        </label>
      </div>

      <div className="dk-detail-block">
        <div className="dk-detail-block-kopf">
          <h3>Verknüpfte Bauteile <span className="ep-anzahl">{verknuepft.length}</span></h3>
          {darf && sauber && !wahl && <button type="button" className="dk-leise" onClick={() => setWahl(true)}><Plus size={13} strokeWidth={2} aria-hidden="true" />Hinzufügen</button>}
        </div>
        {verknuepft.length === 0 && !wahl && <p className="dk-detail-leer">{sauber ? "Noch mit keinem Bauteil verknüpft. Verknüpfte Unterlagen erscheinen in der Anlagenkarte." : "Verknüpfen ist nach bestandener Virenprüfung möglich."}</p>}
        {verknuepft.length > 0 && <ul className="dk-bauteile">{verknuepft.map((b) => {
          const Icon = ANLAGEN_ICON[iconFuer(b.katalogId, katalog)];
          const detail = [b.hersteller, b.typ].filter(Boolean).join(" ");
          return <li key={b.id}>
            <span className="dk-bauteil-icon" aria-hidden="true"><Icon size={14} strokeWidth={1.75} /></span>
            <span className="dk-bauteil-text"><span>{name(b.katalogId)}</span><small>{ortText(b, bauteile)}{detail ? `, ${detail}` : ""}</small></span>
            {darf && <button type="button" className="dk-symbol" disabled={laeuft} onClick={() => onVerknuepfe(d.bauteilIds.filter((x) => x !== b.id))}
              aria-label={`Verknüpfung mit ${name(b.katalogId)}, ${ortText(b, bauteile)} entfernen`} title="Verknüpfung entfernen"><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
          </li>;
        })}</ul>}
        {wahl && <BauteilWahl d={d} bauteile={bauteile} katalog={katalog} laeuft={laeuft} onAbbrechen={() => setWahl(false)}
          onHinzu={(ids) => { onVerknuepfe([...d.bauteilIds, ...ids]); setWahl(false); }} />}
      </div>
      {children}
    </section>
  );
}

/** Mehrfachauswahl der Bauteile, gefiltert nach Typ, Geschoss und Name; bei Datenblatt Bauteile gleichen Typs als "Vorgeschlagen". */
function BauteilWahl({ d, bauteile, katalog, laeuft, onHinzu, onAbbrechen }: {
  d: AblageZeile; bauteile: AblageBauteil[]; katalog: KatalogEintrag[]; laeuft: boolean; onHinzu: (ids: string[]) => void; onAbbrechen: () => void;
}) {
  const [suche, setSuche] = useState("");
  const [typ, setTyp] = useState<string | null>(null);
  const [geschoss, setGeschoss] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const name = (k: string) => anzeigeName(k, katalog);
  const frei = bauteile.filter((b) => !d.bauteilIds.includes(b.id));
  const vorschlag = new Set(datenblattVorschlag(d, bauteile));
  const liste = bauteilKandidaten(frei, { katalogId: typ, geschoss, suche }, name)
    .sort((a, b) => Number(vorschlag.has(b.id)) - Number(vorschlag.has(a.id)) || name(a.katalogId).localeCompare(name(b.katalogId), "de-CH") || a.ort.localeCompare(b.ort, "de-CH", { numeric: true }));
  const typen = [...new Set(frei.map((b) => b.katalogId))].sort((a, b) => name(a).localeCompare(name(b), "de-CH"));
  const geschosse = [...new Set(frei.map((b) => b.geschoss))];
  const um = (id: string) => setIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  return (
    <div className="dk-wahl" role="group" aria-label="Bauteile hinzufügen" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onAbbrechen(); } }}>
      <div className="dk-wahl-filter">
        <label className="dk-suche"><Search size={13} strokeWidth={1.75} aria-hidden="true" /><span className="ui-sr">Name</span>
          <input type="search" autoFocus value={suche} placeholder="Name, Ort, Hersteller" onChange={(e) => setSuche(e.target.value)} /></label>
        <label className="dk-auswahl"><span className="ui-sr">Typ</span><select value={typ ?? ""} onChange={(e) => setTyp(e.target.value || null)}>
          <option value="">Alle Typen</option>{typen.map((t) => <option key={t} value={t}>{name(t)}</option>)}</select></label>
        <label className="dk-auswahl"><span className="ui-sr">Geschoss</span><select value={geschoss ?? ""} onChange={(e) => setGeschoss(e.target.value || null)}>
          <option value="">Alle Geschosse</option>{geschosse.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
      </div>
      {liste.length === 0
        ? <p className="dk-detail-leer">{frei.length === 0 ? "Alle Bauteile sind schon verknüpft." : "Kein Bauteil passt zum Filter."}</p>
        : <ul className="dk-kandidaten dk-wahl-liste">{liste.map((b) => {
          const detail = [b.hersteller, b.typ].filter(Boolean).join(" ");
          return <li key={b.id}><label>
            <input type="checkbox" checked={ids.includes(b.id)} onChange={() => um(b.id)} />
            <span className="dk-kandidat-text"><span>{name(b.katalogId)}</span><small>{ortText(b, bauteile)}{detail ? `, ${detail}` : ""}</small></span>
            {vorschlag.has(b.id) ? <span className="dk-chip">Vorgeschlagen</span> : <span />}
          </label></li>;
        })}</ul>}
      <div className="dk-aktionen">
        <button type="button" className="ep-knopf ep-knopf-haupt" disabled={laeuft || ids.length === 0} onClick={() => onHinzu(ids)}>
          <Link2 size={14} strokeWidth={1.75} aria-hidden="true" />{ids.length === 0 ? "Verknüpfen" : ids.length === 1 ? "1 Bauteil verknüpfen" : `${ids.length} Bauteile verknüpfen`}</button>
        {vorschlag.size > 0 && <button type="button" className="dk-leise" onClick={() => setIds((a) => [...new Set([...a, ...vorschlag])])}>Alle Vorgeschlagenen wählen</button>}
        <button type="button" className="dk-leise" onClick={onAbbrechen}>Abbrechen</button>
      </div>
    </div>
  );
}

export function DetailLeer({ darf }: { darf: boolean }) {
  return <section className="ep-karte dk-detail dk-detail-leer-karte">
    <span className="dk-vorschau-symbol" aria-hidden="true"><DokumentSymbol kategorie="sonstiges" groesse={24} /></span>
    <p>{darf ? "Abgelegte Dokumente erscheinen links. Ein Dokument wählen, um Vorschau, Kategorie und verknüpfte Bauteile zu sehen." : "Ein Dokument wählen, um Vorschau und verknüpfte Bauteile zu sehen."}</p>
  </section>;
}
