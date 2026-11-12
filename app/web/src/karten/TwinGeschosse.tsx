import { Eye, EyeOff, Layers } from "lucide-react";
import { Karte } from "../ui/Karte";
import type { GeschossZeile } from "../dashboard";

interface Props {
  geschosse: GeschossZeile[]; fokusId: string | null; onFokus: (id: string | null) => void;
  ausgeblendet: string[]; onAusblenden: (id: string) => void;
  separiert: boolean; onSeparieren: (s: boolean) => void;
}

/** Geschossliste von oben nach unten: Wahl öffnet den Schnitt, Auge blendet aus, «Separieren» zieht die Geschosse auseinander. */
export function TwinGeschosse({ geschosse, fokusId, onFokus, ausgeblendet, onAusblenden, separiert, onSeparieren }: Props) {
  return (
    <Karte titel="Geschosse" klasse="tw-geschosse" aktion={<Layers size={16} strokeWidth={1.75} aria-hidden="true" className="ui-karte-icon" />}>
      <ul className="tw-geschossliste">
        {geschosse.map((g) => {
          const weg = ausgeblendet.includes(g.id);
          return (
            <li key={g.id} className={weg ? "tw-weg" : undefined}>
              <button type="button" className="tw-geschoss" aria-pressed={g.id === fokusId} onClick={() => onFokus(g.id === fokusId ? null : g.id)}>
                <span className="tw-code">{g.code}</span>
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
