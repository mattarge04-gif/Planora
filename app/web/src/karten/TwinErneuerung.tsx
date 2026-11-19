import { ArrowUpRight, TriangleAlert } from "lucide-react";
import { Karte } from "../ui/Karte";
import { AmpelZeichen } from "../ui/Ampel";
import { AMPEL_FARBE, AMPEL_TEXT, legende } from "../lebensdauer/ansicht";
import type { Ampel, LdStand } from "../lebensdauer/typen";

const REIHENFOLGE: Ampel[] = ["rot", "gelb", "gruen", "grau"];

interface Props {
  stand: LdStand;
  /** Öffnet den Erneuerungsplan; ohne Prop wird kein Link gezeigt. */
  onPlan?: () => void;
}

/** Legende der Erneuerungsansicht: Ampelzähler und Summe der nächsten fünf Jahre (gleiche Zahlen wie die Anlagenkarte). */
export function TwinErneuerung({ stand, onPlan }: Props) {
  const l = legende(stand);
  const gesamt = REIHENFOLGE.reduce((n, a) => n + l.zaehler[a], 0);
  return (
    <Karte titel="Erneuerung" anzahl={gesamt} klasse="tw-erneuerung">
      {gesamt > 0 && <div className="tw-ampel-band" aria-hidden="true">
        {REIHENFOLGE.filter((a) => l.zaehler[a] > 0).map((a) => (
          <span key={a} style={{ flexGrow: l.zaehler[a], background: AMPEL_FARBE[a] }} />
        ))}
      </div>}
      <ul className="tw-ampel-liste" aria-label="Bauteile je Ampel">
        {REIHENFOLGE.map((a) => (
          <li key={a} className={l.zaehler[a] === 0 ? "tw-ampel-null" : undefined}>
            <AmpelZeichen ampel={a} />
            <span>{AMPEL_TEXT[a]}</span>
            <span className="tw-ampel-zahl">{l.zaehler[a]}</span>
          </li>
        ))}
      </ul>
      <p className="tw-ampel-erklaerung">Gezählt wird je Bauteil. Im Modell zeigt jede Anlage die Farbe ihres dringendsten Bauteils.</p>
      <div className="tw-ampel-summe">
        <span>Kosten nächste 5 Jahre</span>
        <strong>{l.summe5}</strong>
        {l.ohnePreis > 0 && <span className="tw-ampel-ohne"><TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />
          Unvollständig, {l.ohnePreis} {l.ohnePreis === 1 ? "Bauteil" : "Bauteile"} ohne Preis</span>}
      </div>
      {onPlan && <button type="button" className="tw-ziel tw-ampel-plan" onClick={onPlan}>Erneuerungsplan öffnen<ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
    </Karte>
  );
}
