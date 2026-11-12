import { Building2 } from "lucide-react";
import { Karte } from "../ui/Karte";
import type { Kennzahlen } from "../dashboard";
import type { Welt } from "../typen";

interface Props { name: string; liegenschaft: string | null; welt: Welt; zahlen: Kennzahlen }

function grundflaeche(welt: Welt): string | null {
  if (welt.grundriss.length !== 1) return null;
  const f = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });
  return `${f.format(welt.grundriss[0].breite)} × ${f.format(welt.grundriss[0].tiefe)} m`;
}

/** Gebäudekarte: Name, Liegenschaft, Kennzahlen und Bestätigungsquote der Bauteile (Datenschicht dashboard/). */
export function TwinGebaeude({ name, liegenschaft, welt, zahlen }: Props) {
  const flaeche = grundflaeche(welt);
  const anteil = zahlen.anteilBestaetigtProzent === null ? null : Math.round(zahlen.anteilBestaetigtProzent);
  return (
    <Karte titel="Gebäude" klasse="tw-gebaeude" aktion={<Building2 size={16} strokeWidth={1.75} aria-hidden="true" className="ui-karte-icon" />}>
      <div className="tw-name">
        <strong>{name}</strong>
        {liegenschaft && <span>{liegenschaft}</span>}
      </div>
      <dl className="tw-kennzahlen">
        <div><dt>Geschosse</dt><dd>{zahlen.geschosse}</dd></div>
        <div><dt>Einheiten</dt><dd>{zahlen.einheiten}</dd></div>
        <div><dt>Anlagen</dt><dd>{zahlen.symbole}</dd></div>
      </dl>
      <dl className="tw-zeilen">
        {flaeche && <div><dt>Grundfläche</dt><dd>{flaeche}</dd></div>}
        {zahlen.bauteile > 0 && <div><dt>Bestätigte Bauteile</dt><dd>{zahlen.bestaetigteBauteile} von {zahlen.bauteile}</dd></div>}
      </dl>
      {anteil !== null && <div className="tw-balken" role="meter" aria-label="Anteil bestätigter Bauteile"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={anteil} aria-valuetext={`${anteil} %`}>
        <span style={{ width: `${anteil}%` }} />
      </div>}
    </Karte>
  );
}
