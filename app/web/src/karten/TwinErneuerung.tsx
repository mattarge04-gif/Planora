import { Karte } from "../ui/Karte";
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
  return (
    <Karte titel="Erneuerung" klasse="tw-erneuerung">
      <ul className="tw-ampel-liste">
        {REIHENFOLGE.map((a) => (
          <li key={a}>
            <span className="tw-ampel-punkt" style={{ background: AMPEL_FARBE[a] }} aria-hidden="true" />
            <span>{AMPEL_TEXT[a]}</span>
            <span className="tw-ampel-zahl">{l.zaehler[a]}</span>
          </li>
        ))}
      </ul>
      <p className="tw-ampel-summe">Nächste 5 Jahre: <strong>{l.summe5}</strong>
        {l.ohnePreis > 0 && <><br />ohne Preis: {l.ohnePreis}</>}</p>
      {onPlan && <button type="button" className="tw-ampel-plan" onClick={onPlan}>Erneuerungsplan öffnen</button>}
    </Karte>
  );
}
