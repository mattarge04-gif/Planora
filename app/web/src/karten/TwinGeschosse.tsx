import { Layers } from "lucide-react";
import { Karte } from "../ui/Karte";
import type { GeschossZeile } from "../dashboard";

interface Props { geschosse: GeschossZeile[]; fokusId: string | null; onFokus: (id: string | null) => void }

/** Geschossliste von oben nach unten; Wahl öffnet den Geschossschnitt, erneute Wahl schliesst ihn. */
export function TwinGeschosse({ geschosse, fokusId, onFokus }: Props) {
  return (
    <Karte titel="Geschosse" klasse="tw-geschosse" aktion={<Layers size={16} strokeWidth={1.75} aria-hidden="true" className="ui-karte-icon" />}>
      <ul className="tw-geschossliste">
        {geschosse.map((g) => (
          <li key={g.id}>
            <button type="button" aria-pressed={g.id === fokusId} onClick={() => onFokus(g.id === fokusId ? null : g.id)}>
              <span className="tw-code">{g.code}</span>
              <span className="tw-einheiten">{g.einheiten === 1 ? "1 Einheit" : `${g.einheiten} Einheiten`}</span>
            </button>
          </li>
        ))}
      </ul>
    </Karte>
  );
}
