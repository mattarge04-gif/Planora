import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Box, CircleGauge, Paperclip, Cylinder, Droplet, Fan, Flame, Gauge, Heater, SlidersHorizontal, Spline, Split, Waves, Waypoints, X, type LucideIcon } from "lucide-react";
import type { IconSchluessel, ObjektKarte } from "../dashboard";
import { useSpeicher, type Speicher } from "../ui/speicher";
import type { BildschirmPunkt } from "../szene3/Interaktion";
import type { GruppenKarte } from "./gruppenKarte";
import type { LdStand } from "../lebensdauer/typen";
import { TwinLebensdauer } from "./TwinLebensdauer";
import { TwinUnterlagen, type AblageMeldung } from "./TwinUnterlagen";
import { TwinDatenblatt } from "./TwinDatenblatt";
import { zeigeInKarte } from "./kartenScroll";
import type { AblageZeile } from "../dokumente/typen";
import type { KatalogEintrag } from "../typen";

export const ANLAGEN_ICON: Record<IconSchluessel, LucideIcon> = {
  waermepumpe: Fan, kessel: Flame, fernwaerme: Waypoints, speicher: Cylinder, pumpe: CircleGauge,
  verteiler: Split, heizkoerper: Heater, flaechenheizung: Waves, ventil: SlidersHorizontal, zaehler: Gauge, ausdehnung: Droplet, anlage: Box,
};
const STATUS = { bestaetigt: "Bestätigt", vorgeschlagen: "Vorgeschlagen" } as const;

/** Kurzform der Bauteil-ID(s) einer Anlage (erste 8 Zeichen der UUID, «+n» bei Gruppen); volle IDs im Tooltip. */
export function kurzId(ids: string[]): string {
  if (!ids.length) return "–";
  const erste = /^[0-9a-f]{8}-/i.test(ids[0]) ? ids[0].slice(0, 8) : ids[0];
  return ids.length > 1 ? `${erste} +${ids.length - 1}` : erste;
}

interface Props { karte: ObjektKarte; onSchliessen: () => void; lebensdauer?: LdStand | null; darfAendern?: boolean; onLebensdauer?: (s: LdStand) => void;
  /** Seite Dokumente, gefiltert auf ein Bauteil ("Preis fehlt" -> aus Dokument). */
  onDokument?: (bauteilId: string) => void;
  /** Gruppe des Zubehörs (Pumpe, Ventil), unterscheidet gleichnamige Anlagen wie in der Trefferliste (Kritik r5). */
  bezug?: string | null;
  /** Öffnet den Viewer an der Fundstelle eines Dokumentpreises. */
  onFundstelle?: (dokumentId: string, seite: number | null) => void;
  /** Mit den Bauteilen der Karte verknüpfte Unterlagen (Ablage des Gebäudes); ohne Prop kein Abschnitt. */
  unterlagen?: AblageZeile[]; darfAblegen?: boolean;
  onOeffnen?: (d: AblageZeile, seite?: number) => void;
  onAblegen?: (dateien: File[]) => Promise<AblageMeldung[]>;
  onNeuLaden?: () => void;
  katalog?: KatalogEintrag[]; onAbgelaufen?: () => void }

/** Bewegt nur den Scrollbereich der Karte zu Datenblatt/Unterlagen und setzt den Fokus auf die Überschrift der Unterlagen. */
function zuUnterlagen(karte: HTMLElement | null) {
  zeigeInKarte(karte?.querySelector<HTMLElement>(".tw-datenblatt") ?? karte?.querySelector<HTMLElement>(".tw-unterlagen"));
  const kopf = karte?.querySelector<HTMLElement>(".tw-unterlagen h3");
  if (kopf) { kopf.tabIndex = -1; kopf.focus({ preventScroll: true }); }
}

/** Anlagenkarte rechts, Inhalt aus objektKarte(); Lebensdauer, Datenblatt und Unterlagen als Abschnitte. */
export function TwinObjekt({ karte, onSchliessen, kartenRef, lebensdauer, darfAendern, onLebensdauer, onDokument, bezug = null,
  onFundstelle, unterlagen, darfAblegen = false, onOeffnen, onAblegen, onNeuLaden, katalog, onAbgelaufen }: Props & { kartenRef: RefObject<HTMLElement | null> }) {
  const Icon = ANLAGEN_ICON[karte.icon];
  const [gescrollt, setGescrollt] = useState(false);
  return (
    <section ref={kartenRef} className="ui-glas ui-karte tw-objekt" aria-labelledby="karte-objekt">
      <header className="tw-objekt-kopf">
        <span className="tw-objekt-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
        <div className="tw-objekt-titel">
          <h2 id="karte-objekt">{karte.name}</h2>
          <div className="tw-objekt-marken">
            <span className={`tw-badge tw-badge-${karte.status}`}>{STATUS[karte.status]}</span>
            {/* Unterlagen und Datenblatt liegen unten in der Karte: Sprungmarke im Kopf, damit sie ohne Suchen erreichbar sind (Kritik r1). */}
            {unterlagen && (unterlagen.length > 0 || darfAblegen) && <button type="button" className="tw-objekt-sprung" onClick={() => zuUnterlagen(kartenRef.current)}>
              <Paperclip size={12} strokeWidth={2} aria-hidden="true" />{unterlagen.length === 0 ? "Unterlagen" : unterlagen.length === 1 ? "1 Unterlage" : `${unterlagen.length} Unterlagen`}</button>}
          </div>
        </div>
        <button type="button" className="tw-schliessen" onClick={onSchliessen} aria-label="Anlagenkarte schliessen (Esc)">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <div className={`tw-objekt-inhalt${gescrollt ? " tw-gescrollt" : ""}`} onScroll={(e) => setGescrollt(e.currentTarget.scrollTop > 2)}>
      <dl className="tw-zeilen tw-objekt-daten">
        <div><dt>Hersteller / Typ</dt><dd>{karte.herstellerTyp ?? <span className="tw-fehlt" title="Nicht erfasst" aria-label="Nicht erfasst">–</span>}</dd></div>
        <div><dt>Standort</dt><dd>{karte.standort}</dd></div>
        {bezug && <div><dt>Gruppe</dt><dd>{bezug}</dd></div>}
        <div><dt>Menge</dt><dd>{karte.menge}</dd></div>
        <div><dt>{karte.bauteilIds.length > 1 ? "Bauteil-IDs" : "Bauteil-ID"}</dt><dd className="tw-id" title={karte.bauteilIds.join(", ")}>{kurzId(karte.bauteilIds)}</dd></div>
      </dl>
      {karte.versorgt.length > 0 && <div className="tw-objekt-block">
        <h3>Versorgt</h3>
        <ul className="tw-versorgt">{karte.versorgt.map((v) => <li key={v}>{v}</li>)}</ul>
      </div>}
      {lebensdauer && onLebensdauer && <TwinLebensdauer stand={lebensdauer} bauteilIds={karte.bauteilIds} darfAendern={darfAendern === true} onGespeichert={onLebensdauer} onDokument={onDokument} onFundstelle={onFundstelle} />}
      {katalog && karte.bauteilIds.length > 0 && <TwinDatenblatt bauteilIds={karte.bauteilIds} katalog={katalog} onAbgelaufen={onAbgelaufen} />}
      {unterlagen && onOeffnen && onAblegen && onNeuLaden && <TwinUnterlagen unterlagen={unterlagen} darfAblegen={darfAblegen}
        onOeffnen={onOeffnen} onAblegen={onAblegen} onNeuLaden={onNeuLaden} />}
      </div>
    </section>
  );
}

/** Gruppenkarte rechts: Art, Bestückung und Verbraucher der gewählten Heizgruppe. */
export function TwinGruppe({ karte, onSchliessen, kartenRef }: { karte: GruppenKarte; onSchliessen: () => void; kartenRef: RefObject<HTMLElement | null> }) {
  return (
    <section ref={kartenRef} className="ui-glas ui-karte tw-objekt" aria-labelledby="karte-gruppe">
      <header className="tw-objekt-kopf">
        <span className="tw-objekt-icon" aria-hidden="true"><Spline size={18} strokeWidth={1.75} /></span>
        <div className="tw-objekt-titel">
          <h2 id="karte-gruppe">{karte.titel}</h2>
          <span className="tw-gruppe-art">Heizgruppe</span>
        </div>
        <button type="button" className="tw-schliessen" onClick={onSchliessen} aria-label="Gruppenkarte schliessen (Esc)">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <div className="tw-objekt-inhalt">
      <dl className="tw-zeilen tw-objekt-daten">
        <div><dt>Schaltung</dt><dd>{karte.art}</dd></div>
        <div><dt>Verteiler</dt><dd>{karte.verteiler}</dd></div>
      </dl>
      <div className="tw-objekt-block">
        <h3>Bestückung</h3>
        {karte.bestueckung.length
          ? <ul className="tw-versorgt">{karte.bestueckung.map((b) => <li key={b.name}>{b.menge > 1 ? `${b.menge} × ${b.name}` : b.name}</li>)}</ul>
          : <p className="tw-gruppe-leer">Ohne Zubehör, reines Rohrstück</p>}
      </div>
      <div className="tw-objekt-block">
        <h3>Verbraucher</h3>
        {karte.verbraucher.length
          ? <ul className="tw-versorgt tw-gruppe-verbraucher">{karte.verbraucher.map((v) => <li key={v.schluessel}>
            <span>{v.name}</span>{v.ort && <span className="tw-gruppe-ort">{v.ort}</span>}</li>)}</ul>
          : <p className="tw-gruppe-leer">Keine Verbraucher zugeteilt</p>}
      </div>
      </div>
    </section>
  );
}

/** Dünne Verbindungslinie von der Karte zum Objekt (Graphit 55 %, 1 px, weisser Halo). Rendert nur bei Punktänderung. */
export function TwinVerbindung({ punkt, kartenRef }: { punkt: Speicher<BildschirmPunkt | null>; kartenRef: RefObject<HTMLElement | null> }) {
  const p = useSpeicher(punkt);
  const [, neu] = useState(0);
  const pfad = useRef<string | null>(null);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => neu((n) => n + 1));
    if (kartenRef.current) ro.observe(kartenRef.current);
    return () => ro.disconnect();
  }, [kartenRef]);
  const r = kartenRef.current?.getBoundingClientRect();
  pfad.current = null;
  if (p && r && p.x < r.left - 24) {
    const y = r.top + 30;
    const knick = r.left - 28;
    pfad.current = `M ${r.left} ${y} H ${knick} L ${p.x} ${p.y}`;
  }
  if (!pfad.current || !p) return null;
  return (
    <svg className="tw-verbindung" aria-hidden="true">
      <path className="tw-halo" d={pfad.current} />
      <path className="tw-strich-linie" d={pfad.current} />
      <circle cx={p.x} cy={p.y} r={4} />
    </svg>
  );
}
