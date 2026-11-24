import { useEffect, useRef, useState, type DragEvent } from "react";
import { Download, Info, Plus, TriangleAlert, X } from "lucide-react";
import type { AblageZeile } from "../dokumente/typen";
import { dateiUrl } from "../dokumente/api";
import { KATEGORIEN, kategorieName, oeffnenArt, pruefungLaeuft, scanAnzeige } from "../dokumente/ansicht";
import { DokumentSymbol, endung } from "../ui/dokumentSymbol";

export interface AblageMeldung { datei: string; text: string; art: "fehler" | "hinweis" }

interface Props {
  unterlagen: AblageZeile[];
  darfAblegen: boolean;
  onOeffnen: (d: AblageZeile, seite?: number) => void;
  /** Legt Dateien ab und verknüpft sie mit den Bauteilen der Karte; liefert Meldungen je Datei. */
  onAblegen: (dateien: File[]) => Promise<AblageMeldung[]>;
  /** Ablage neu laden (Polling, solange eine Prüfung läuft). */
  onNeuLaden: () => void;
}

const POLL_MS = 2000;
const RANG = new Map(KATEGORIEN.map((k, i) => [k.id, i]));
/** Datenblatt zuerst (Reihenfolge der Kategorien), innerhalb nach Name. */
const geordnet = (d: AblageZeile[]) => [...d].sort((a, b) => (RANG.get(a.kategorie) ?? 9) - (RANG.get(b.kategorie) ?? 9) || a.dateiname.localeCompare(b.dateiname, "de-CH"));

/** Abschnitt "Unterlagen (n)" der Anlagenkarte: verknüpfte Dateien, Klick öffnet den Viewer, "+ Ablegen" verknüpft direkt. */
export function TwinUnterlagen({ unterlagen, darfAblegen, onOeffnen, onAblegen, onNeuLaden }: Props) {
  const feld = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState<string[]>([]);
  const [meldungen, setMeldungen] = useState<AblageMeldung[]>([]);
  const [ziehen, setZiehen] = useState(false);
  const tiefe = useRef(0);
  const pruefen = pruefungLaeuft(unterlagen);
  useEffect(() => {
    if (!pruefen) return;
    const t = window.setInterval(onNeuLaden, POLL_MS);
    return () => window.clearInterval(t);
  }, [pruefen, onNeuLaden]);

  async function ablegen(dateien: File[]) {
    if (!dateien.length) return;
    setMeldungen([]); setLaeuft(dateien.map((f) => f.name));
    try { setMeldungen(await onAblegen(dateien)); } finally { setLaeuft([]); }
  }
  const ziel = darfAblegen ? {
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
    onDragEnter: (e: DragEvent) => { if (e.dataTransfer.types.includes("Files")) { tiefe.current++; setZiehen(true); } },
    onDragLeave: () => { tiefe.current = Math.max(0, tiefe.current - 1); if (!tiefe.current) setZiehen(false); },
    onDrop: (e: DragEvent) => { e.preventDefault(); tiefe.current = 0; setZiehen(false); void ablegen([...e.dataTransfer.files]); },
  } : {};

  return (
    <div className={`tw-objekt-block tw-unterlagen${ziehen ? " tw-unterlagen-ziehen" : ""}`} {...ziel}>
      <div className="tw-ul-kopf">
        <h3>Unterlagen{unterlagen.length > 0 && <span className="tw-ul-anzahl">{unterlagen.length}</span>}</h3>
        {darfAblegen && <>
          <input ref={feld} type="file" multiple className="ui-sr" tabIndex={-1} aria-hidden="true"
            accept="application/pdf,.pdf,image/jpeg,image/png,image/heic,.heic,.docx,.xlsx,.pptx,.doc,.xls,.ppt"
            onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; void ablegen(f); }} />
          <button type="button" className="tw-ul-ablegen" disabled={laeuft.length > 0} onClick={() => feld.current?.click()}
            aria-label="Datei ablegen und mit dieser Anlage verknüpfen"><Plus size={13} strokeWidth={2} aria-hidden="true" />Ablegen</button>
        </>}
      </div>
      {unterlagen.length === 0 && laeuft.length === 0
        ? <p className="tw-ul-leer">{darfAblegen ? "Noch keine Unterlagen. Datenblatt, Foto oder Protokoll hierher ziehen." : "Noch keine Unterlagen verknüpft."}</p>
        : <ul className="tw-ul-liste">
          {geordnet(unterlagen).map((d) => <Eintrag key={d.id} d={d} onOeffnen={onOeffnen} />)}
          {laeuft.map((n) => <li key={"ab-" + n} className="tw-ul-eintrag tw-ul-laeuft">
            <span className="tw-ul-icon" aria-hidden="true"><DokumentSymbol kategorie="sonstiges" groesse={14} /></span>
            <span className="tw-ul-text"><span className="tw-ul-name">{n}</span><span className="tw-ul-meta tw-ul-pruefen"><i aria-hidden="true" />wird abgelegt …</span></span>
          </li>)}
        </ul>}
      {meldungen.length > 0 && <div className="tw-ul-meldungen" role="alert">
        <ul>{meldungen.map((m, i) => <li key={i} className={m.art === "hinweis" ? "tw-ul-hinweis" : undefined}>
          {m.art === "hinweis" ? <Info size={13} strokeWidth={2} aria-hidden="true" /> : <TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />}
          <span><strong>{m.datei}</strong> {m.text}</span></li>)}</ul>
        <button type="button" className="tw-ul-zu" onClick={() => setMeldungen([])} aria-label="Meldungen ausblenden"><X size={13} strokeWidth={2} aria-hidden="true" /></button>
      </div>}
    </div>
  );
}

function Eintrag({ d, onOeffnen }: { d: AblageZeile; onOeffnen: (d: AblageZeile) => void }) {
  const art = oeffnenArt(d);
  const scan = scanAnzeige(d);
  const meta = <>{kategorieName(d.kategorie)}<span aria-hidden="true"> · </span>{endung(d)}{d.seiten ? `, ${d.seiten === 1 ? "1 Seite" : `${d.seiten} S.`}` : ""}</>;
  const inhalt = <>
    <span className="tw-ul-icon" aria-hidden="true"><DokumentSymbol kategorie={d.kategorie} groesse={14} /></span>
    <span className="tw-ul-text">
      <span className="tw-ul-name">{d.dateiname}</span>
      {art === "gesperrt"
        ? <span className={`tw-ul-meta tw-ul-scan-${scan.art}`} title={scan.detail}>{scan.art === "laeuft" && <i aria-hidden="true" />}{scan.art !== "laeuft" && <TriangleAlert size={11} strokeWidth={2.2} aria-hidden="true" />}{scan.text}</span>
        : <span className="tw-ul-meta">{meta}</span>}
    </span>
  </>;
  if (art === "pdf" || art === "bild") return <li className="tw-ul-eintrag">
    <button type="button" className="tw-ul-wahl" onClick={() => onOeffnen(d)} title={d.dateiname} aria-label={`${d.dateiname} öffnen`}>{inhalt}</button></li>;
  if (art === "herunterladen") return <li className="tw-ul-eintrag">
    <a className="tw-ul-wahl" href={dateiUrl(d.id, true)} download={d.dateiname} title={d.dateiname} aria-label={`${d.dateiname} herunterladen`}>{inhalt}
      <Download className="tw-ul-laden" size={13} strokeWidth={1.75} aria-hidden="true" /></a></li>;
  return <li className="tw-ul-eintrag tw-ul-gesperrt" title={d.dateiname}><span className="tw-ul-wahl">{inhalt}</span></li>;
}
