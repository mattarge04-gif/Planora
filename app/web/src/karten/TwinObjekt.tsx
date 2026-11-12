import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Box, CircleGauge, Cylinder, Fan, FileText, Flame, Heater, Split, Upload, Waves, Waypoints, X, type LucideIcon } from "lucide-react";
import type { IconSchluessel, ObjektKarte } from "../dashboard";
import { useSpeicher, type Speicher } from "../ui/speicher";
import type { BildschirmPunkt } from "../szene3/Interaktion";

export const ANLAGEN_ICON: Record<IconSchluessel, LucideIcon> = {
  waermepumpe: Fan, kessel: Flame, fernwaerme: Waypoints, speicher: Cylinder, pumpe: CircleGauge,
  verteiler: Split, heizkoerper: Heater, flaechenheizung: Waves, anlage: Box,
};
const STATUS = { bestaetigt: "Bestätigt", vorgeschlagen: "Vorgeschlagen" } as const;

/** Kurzform der Bauteil-ID(s) einer Anlage (erste 8 Zeichen der UUID, «+n» bei Gruppen); volle IDs im Tooltip. */
export function kurzId(ids: string[]): string {
  if (!ids.length) return "–";
  const erste = /^[0-9a-f]{8}-/i.test(ids[0]) ? ids[0].slice(0, 8) : ids[0];
  return ids.length > 1 ? `${erste} +${ids.length - 1}` : erste;
}

interface Props { karte: ObjektKarte; onSchliessen: () => void }

/** Anlagenkarte rechts, Inhalt aus objektKarte(). Dokumente sind noch nicht angebunden. */
export function TwinObjekt({ karte, onSchliessen, kartenRef }: Props & { kartenRef: RefObject<HTMLElement | null> }) {
  const Icon = ANLAGEN_ICON[karte.icon];
  return (
    <section ref={kartenRef} className="ui-glas ui-karte tw-objekt" aria-labelledby="karte-objekt" aria-live="polite">
      <header className="tw-objekt-kopf">
        <span className="tw-objekt-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
        <div className="tw-objekt-titel">
          <h2 id="karte-objekt">{karte.name}</h2>
          <span className={`tw-badge tw-badge-${karte.status}`}>{STATUS[karte.status]}</span>
        </div>
        <button type="button" className="tw-schliessen" onClick={onSchliessen} aria-label="Anlagenkarte schliessen (Esc)">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <dl className="tw-zeilen tw-objekt-daten">
        <div><dt>Hersteller / Typ</dt><dd>{karte.herstellerTyp ?? <span className="tw-fehlt" title="Nicht erfasst" aria-label="Nicht erfasst">–</span>}</dd></div>
        <div><dt>Standort</dt><dd>{karte.standort}</dd></div>
        <div><dt>Menge</dt><dd>{karte.menge}</dd></div>
        <div><dt>{karte.bauteilIds.length > 1 ? "Bauteil-IDs" : "Bauteil-ID"}</dt><dd className="tw-id" title={karte.bauteilIds.join(", ")}>{kurzId(karte.bauteilIds)}</dd></div>
      </dl>
      {karte.versorgt.length > 0 && <div className="tw-objekt-block">
        <h3>Versorgt</h3>
        <ul className="tw-versorgt">{karte.versorgt.map((v) => <li key={v}>{v}</li>)}</ul>
      </div>}
      <div className="tw-objekt-block tw-dokumente">
        <h3>Dokumente</h3>
        <button type="button" disabled aria-label="Hochladen, folgt"><Upload size={14} strokeWidth={1.75} aria-hidden="true" />Hochladen<span className="tw-folgt">folgt</span></button>
        <p><FileText size={16} strokeWidth={1.75} aria-hidden="true" />Noch keine Dokumente</p>
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
