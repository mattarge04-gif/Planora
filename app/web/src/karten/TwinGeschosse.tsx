import { Eye, EyeOff, Layers } from "lucide-react";
import { Karte } from "../ui/Karte";
import type { GeschossZeile } from "../dashboard";
import type { Zaehler } from "../szene3/pegelband";
import { AMPEL_FARBE } from "../lebensdauer/ansicht";
import { miniPegelText, miniSegmente } from "./miniPegel";

interface Props {
  geschosse: GeschossZeile[]; fokusId: string | null; onFokus: (id: string | null) => void;
  ausgeblendet: string[]; onAusblenden: (id: string) => void;
  separiert: boolean; onSeparieren: (s: boolean) => void;
  /** Bei offener Anlagenkarte: nur eine Zeile mit Geschosswahl, damit die Karte ins Fenster passt (Kritik r1 P2). */
  kompakt?: boolean;
  /** Modus Erneuerung: Zähler je Geschoss für den Mini-Pegel (gleiche Segmente wie das Pegelband im 3D). */
  pegel?: ReadonlyMap<string, { zaehler: Zaehler }>;
  /** Gegenseitiges Hervorheben Zeile <-> Band (nur mit `pegel`). */
  hoverId?: string | null;
  onHover?: (id: string | null) => void;
  /** Legendenfilter aktiv: Anzahl Treffer (Anlagen) je Geschoss. */
  treffer?: ReadonlyMap<string, number>;
}

/** Mini-Pegel 48 × 4 px; Grau gestrichelt wie im Band. */
function MiniPegel({ code, zaehler }: { code: string; zaehler: Zaehler | undefined }) {
  return (
    <span className="tw-minipegel" role="img" aria-label={miniPegelText(code, zaehler)}>
      {miniSegmente(zaehler).map((s) => (
        <span key={s.ampel} className={`tw-minipegel-seg${s.ampel === "grau" ? " tw-minipegel-grau" : ""}`}
          style={{ left: `${s.von * 100}%`, width: `${(s.bis - s.von) * 100}%`, ...(s.ampel === "grau" ? {} : { background: AMPEL_FARBE[s.ampel] }) }} />
      ))}
    </span>
  );
}

/** Geschossliste von oben nach unten: Wahl öffnet den Schnitt, Auge blendet aus, «Separieren» zieht die Geschosse auseinander. */
export function TwinGeschosse({ geschosse, fokusId, onFokus, ausgeblendet, onAusblenden, separiert, onSeparieren, kompakt = false,
  pegel, hoverId = null, onHover, treffer }: Props) {
  const trefferZahl = (id: string) => {
    const n = treffer?.get(id);
    return n ? <span className="tw-geschoss-treffer" aria-label={n === 1 ? "1 Treffer" : `${n} Treffer`}>{n}</span> : null;
  };
  // Hover und Tastaturfokus der Zeile heben das Band im 3D hervor (nur Modus Erneuerung).
  const koppeln = (id: string) => pegel && onHover ? {
    onMouseEnter: () => onHover(id), onMouseLeave: () => onHover(null),
    onFocus: () => onHover(id), onBlur: () => onHover(null),
  } : {};
  const gekoppelt = (id: string) => (pegel && id === hoverId ? " tw-gekoppelt" : "");
  if (kompakt) return (
    <section className="ui-glas ui-karte tw-geschosse tw-geschosse-kompakt" aria-label="Geschosse">
      <Layers size={16} strokeWidth={1.75} aria-hidden="true" className="ui-karte-icon" />
      <ul className="tw-geschoss-chips">
        {geschosse.map((g) => (
          <li key={g.id} {...koppeln(g.id)}>
            <button type="button" className={`tw-geschoss-chip${ausgeblendet.includes(g.id) ? " tw-weg" : ""}${gekoppelt(g.id)}`} aria-pressed={g.id === fokusId}
              aria-label={`${g.code}, ${g.einheiten === 1 ? "1 Einheit" : `${g.einheiten} Einheiten`}`} onClick={() => onFokus(g.id === fokusId ? null : g.id)}>{g.code}{trefferZahl(g.id)}</button>
          </li>
        ))}
      </ul>
      {separiert && <span className="tw-geschoss-separiert">separiert</span>}
    </section>
  );
  return (
    <Karte titel="Geschosse" klasse="tw-geschosse" aktion={<Layers size={16} strokeWidth={1.75} aria-hidden="true" className="ui-karte-icon" />}>
      <ul className={`tw-geschossliste${pegel ? " tw-mit-pegel" : ""}`}>
        {geschosse.map((g) => {
          const weg = ausgeblendet.includes(g.id);
          return (
            <li key={g.id} className={`${weg ? "tw-weg" : ""}${gekoppelt(g.id)}`.trim() || undefined} {...koppeln(g.id)}>
              <button type="button" className="tw-geschoss" aria-pressed={g.id === fokusId} onClick={() => onFokus(g.id === fokusId ? null : g.id)}>
                <span className="tw-code">{g.code}</span>
                {pegel && <MiniPegel code={g.code} zaehler={pegel.get(g.id)?.zaehler} />}
                {trefferZahl(g.id)}
                <span className="tw-einheiten">{g.einheiten === 1 ? "1 Einheit" : `${g.einheiten} Einheiten`}</span>
              </button>
              <button type="button" className="tw-auge" aria-pressed={weg} onClick={() => onAusblenden(g.id)}
                aria-label={`${g.code} ${weg ? "einblenden" : "ausblenden"}`} title={weg ? "Einblenden" : "Ausblenden"}>
                {weg ? <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={16} strokeWidth={1.75} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" role="switch" aria-checked={separiert} className="tw-separieren" onClick={() => onSeparieren(!separiert)}>
        <span>Geschosse separieren</span>
        <span className="ui-schalter" aria-hidden="true" />
      </button>
    </Karte>
  );
}
