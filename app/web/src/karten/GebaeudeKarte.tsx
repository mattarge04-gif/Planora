import { uebersicht } from "../panel/daten";
import type { Beschreibung, Welt } from "../typen";

interface Props { name: string; welt: Welt; beschreibung: Beschreibung; reduziert: boolean; onReduziert: (r: boolean) => void }

export function GebaeudeKarte({ name, welt, beschreibung, reduziert, onReduziert }: Props) {
  const u = uebersicht(welt, beschreibung);
  return (
    <section className="glas gebaeudekarte" aria-label="Gebaeude">
      <p className="ueberzeile">Gebaeude</p>
      <h2>{name}</h2>
      {u.geschosse === 0 ? <p>Noch keine Huelle erfasst</p> : (
        <div className="kennzahlen">
          <div><b>{u.geschosse}</b>Geschosse</div>
          <div><b>{u.einheiten}</b>Einheiten</div>
          <div><b>{u.symbole}</b>Bauteile</div>
        </div>
      )}
      {u.hinweise.length > 0 && (
        <>
          <h3>Hinweise</h3>
          <ul>{u.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </>
      )}
      <label className="schalter">
        <input type="checkbox" checked={reduziert} onChange={(e) => onReduziert(e.target.checked)} />
        Reduzierte Darstellung
      </label>
    </section>
  );
}
