import { ArrowUpRight, Tag, TriangleAlert, X } from "lucide-react";
import { Karte } from "../ui/Karte";
import { AmpelZeichen } from "../ui/Ampel";
import { AMPEL_FARBE, AMPEL_TEXT, legende } from "../lebensdauer/ansicht";
import type { Ampel, LdStand } from "../lebensdauer/typen";
import type { FilterStufe } from "../szene3/ampelFilter";
import { POSTEN_TEXT, trefferDetail, type FilterAnlage, type Treffer } from "./erneuerungFilter";
import { useEffect, useRef, type KeyboardEvent } from "react";

const REIHENFOLGE: Ampel[] = ["rot", "gelb", "gruen", "grau"];

/** Filter der Legende (Entscheid 22.11.2026, Ansatz C Stufe 3): Posten mehrfach wählbar (ODER), Treffer je Anlage. */
export interface LegendenFilter<A extends FilterAnlage & { name: string }> {
  posten: ReadonlySet<FilterStufe>;
  onPosten: (p: FilterStufe) => void;
  onAufheben: () => void;
  treffer: Treffer<A>[];
  geschossCode: (id: string) => string;
  auswahl: string | null;
  onTreffer: (a: A) => void;
  /** Gruppe oder Ort zur Unterscheidung gleichnamiger Anlagen. */
  bezug: (a: A) => string | null;
  /** Ein Treffer hervorgehoben (Liste: Hover/Fokus/Pfeiltasten) und Rückweg aus dem 3D-Hover. */
  fokus: string | null;
  onFokus: (schluessel: string | null) => void;
  hover3d: string | null;
}

interface Props<A extends FilterAnlage & { name: string }> {
  stand: LdStand;
  /** Öffnet den Erneuerungsplan; ohne Prop wird kein Link gezeigt. */
  onPlan?: () => void;
  /** Ohne Prop bleibt die Legende reine Anzeige. */
  filter?: LegendenFilter<A>;
}

/** Legende der Erneuerungsansicht: Ampelzähler (als Filter) und Summe der nächsten fünf Jahre. */
export function TwinErneuerung<A extends FilterAnlage & { name: string }>({ stand, onPlan, filter }: Props<A>) {
  const l = legende(stand);
  const gesamt = REIHENFOLGE.reduce((n, a) => n + l.zaehler[a], 0);
  const aktiv = !!filter && filter.posten.size > 0;
  return (
    <Karte titel="Erneuerung" anzahl={gesamt} klasse={`tw-erneuerung${aktiv ? " tw-gefiltert" : ""}`}>
      {gesamt > 0 && <div className="tw-ampel-band" aria-hidden="true">
        {REIHENFOLGE.filter((a) => l.zaehler[a] > 0).map((a) => (
          <span key={a} className={aktiv && !filter!.posten.has(a) ? "tw-ampel-zurueck" : undefined}
            style={{ flexGrow: l.zaehler[a], background: AMPEL_FARBE[a] }} />
        ))}
      </div>}
      <ul className="tw-ampel-liste" aria-label={filter ? "Bauteile je Ampel, als Filter wählbar" : "Bauteile je Ampel"}>
        {REIHENFOLGE.map((a) => {
          const inhalt = <><AmpelZeichen ampel={a} /><span>{AMPEL_TEXT[a]}</span><span className="tw-ampel-zahl">{l.zaehler[a]}</span></>;
          return (
            <li key={a} className={l.zaehler[a] === 0 ? "tw-ampel-null" : undefined}>
              {filter
                ? <button type="button" className="tw-ampel-posten" aria-pressed={filter.posten.has(a)} disabled={l.zaehler[a] === 0}
                  onClick={() => filter.onPosten(a)}>{inhalt}</button>
                : inhalt}
            </li>
          );
        })}
      </ul>
      {aktiv
        ? <Trefferliste filter={filter!} />
        : <p className="tw-ampel-erklaerung">{filter ? "Posten antippen, um die Bauteile im Modell zu zeigen. " : ""}
          Gezählt wird je Bauteil. Im Modell zeigt jede Anlage die Farbe ihres dringendsten Bauteils.</p>}
      <div className="tw-ampel-summe">
        <span>Kosten nächste 5 Jahre</span>
        <strong>{l.summe5}</strong>
        {l.ohnePreis > 0 && (() => {
          const text = <><TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />
            Unvollständig, {l.ohnePreis} {l.ohnePreis === 1 ? "Bauteil" : "Bauteile"} ohne Preis</>;
          return filter
            ? <button type="button" className="tw-ampel-ohne tw-ampel-ohne-knopf" aria-pressed={filter.posten.has("ohnePreis")}
              onClick={() => filter.onPosten("ohnePreis")}>{text}</button>
            : <span className="tw-ampel-ohne">{text}</span>;
        })()}
      </div>
      {onPlan && <button type="button" className="tw-ziel tw-ampel-plan" onClick={onPlan}>Erneuerungsplan öffnen<ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
    </Karte>
  );
}

/**
 * Treffer des Filters je Anlage: Grund (Form + Farbe), Name, Geschoss, zweite Zeile mit Ersatzjahr und Bezug. Hover,
 * Fokus und Pfeiltasten heben genau einen Treffer im Modell hervor («2 von 5»); 3D-Hover markiert die Zeile (Rückweg).
 * Klick wählt die Anlage wie in der Tabelle.
 */
function Trefferliste<A extends FilterAnlage & { name: string }>({ filter }: { filter: LegendenFilter<A> }) {
  const n = filter.treffer.length;
  const liste = useRef<HTMLUListElement>(null);
  const markiert = filter.fokus ?? filter.hover3d;
  const stelle = markiert ? filter.treffer.findIndex((t) => t.anlage.schluessel === markiert) : -1;
  // 3D-Hover: Zeile innerhalb der Liste in Sicht bringen (nur die Liste scrollt, nicht die Spalte).
  useEffect(() => {
    const el = liste.current, z = filter.hover3d ? el?.querySelector<HTMLElement>(`[data-schluessel="${CSS.escape(filter.hover3d)}"]`) : null;
    if (!el || !z) return;
    if (z.offsetTop < el.scrollTop) el.scrollTop = z.offsetTop;
    else if (z.offsetTop + z.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = z.offsetTop + z.offsetHeight - el.clientHeight;
  }, [filter.hover3d]);
  const taste = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const knoepfe = [...(liste.current?.querySelectorAll<HTMLButtonElement>(".tw-treffer-zeile") ?? [])];
    const ziel = e.key === "ArrowDown" ? knoepfe[i + 1] : e.key === "ArrowUp" ? knoepfe[i - 1]
      : e.key === "Home" ? knoepfe[0] : e.key === "End" ? knoepfe[knoepfe.length - 1] : undefined;
    if (ziel) { e.preventDefault(); ziel.focus(); ziel.scrollIntoView({ block: "nearest" }); }
  };
  return (
    <div className="tw-treffer">
      <div className="tw-treffer-kopf">
        <span role="status" aria-live="polite">{n === 0 ? "Keine Treffer"
          : stelle >= 0 ? `${stelle + 1} von ${n}` : n === 1 ? "1 Anlage" : `${n} Anlagen`}</span>
        <button type="button" className="tw-treffer-aufheben" onClick={filter.onAufheben}>
          <X size={13} strokeWidth={2} aria-hidden="true" />Filter aufheben
        </button>
      </div>
      {n > 0 && <ul ref={liste} className="tw-treffer-liste" aria-label="Treffer, Pfeiltasten wechseln" onMouseLeave={() => filter.onFokus(null)}>
        {filter.treffer.map((t, i) => {
          const ampel = t.gruende.find((g): g is Ampel => g !== "ohnePreis");
          const code = t.anlage.geschossId ? filter.geschossCode(t.anlage.geschossId) : "–";
          const detail = trefferDetail(t, filter.bezug(t.anlage));
          const mehr = t.anlage.bauteilIds.length > 1 ? `, ${t.bauteile} von ${t.anlage.bauteilIds.length} Bauteilen` : "";
          const k = t.anlage.schluessel;
          return (
            <li key={k}>
              <button type="button" data-schluessel={k}
                className={`tw-treffer-zeile${k === markiert ? " tw-treffer-markiert" : ""}`}
                aria-current={filter.auswahl === k || undefined}
                aria-label={`${t.anlage.name}, ${code}, ${t.gruende.map((g) => POSTEN_TEXT[g]).join(", ")}${detail ? `, ${detail}` : ""}${mehr}`}
                onMouseEnter={() => filter.onFokus(k)} onFocus={() => filter.onFokus(k)} onBlur={() => filter.onFokus(null)}
                onKeyDown={(e) => taste(e, i)} onClick={() => filter.onTreffer(t.anlage)}>
                {ampel ? <AmpelZeichen ampel={ampel} /> : <Tag size={14} strokeWidth={2.1} aria-hidden="true" className="tw-ohne-preis" />}
                <span className="tw-treffer-name">{t.anlage.name}
                  {ampel && t.gruende.includes("ohnePreis") && <Tag size={12} strokeWidth={2.1} aria-hidden="true" className="tw-ohne-preis" />}
                </span>
                <span className="tw-treffer-ort">{code}</span>
                {detail && <span className="tw-treffer-detail">{detail}</span>}
              </button>
            </li>
          );
        })}
      </ul>}
    </div>
  );
}
