import { panelDaten, uebersicht } from "./daten";
import type { Beschreibung, KatalogEintrag, Welt } from "../typen";

interface Props { welt: Welt; beschreibung: Beschreibung; katalog: KatalogEintrag[]; auswahl: string | null }

export function Panel({ welt, beschreibung, katalog, auswahl }: Props) {
  const d = auswahl ? panelDaten(welt, beschreibung, katalog, auswahl) : null;
  if (!d) {
    const u = uebersicht(welt, beschreibung);
    return (
      <aside className="panel">
        <h2>Uebersicht</h2>
        <p>{u.geschosse} Geschosse · {u.einheiten} Einheiten · {u.symbole} Symbole</p>
        {u.hinweise.length > 0 && <><h3>Hinweise</h3><ul>{u.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
        <p className="leise">Klick auf einen Punkt zeigt das Bauteil.</p>
      </aside>
    );
  }
  return (
    <aside className="panel">
      <h2>{d.titel}</h2>
      {d.herstellerTyp && <p>{d.herstellerTyp}</p>}
      <p><span className={d.status === "vorgeschlagen" ? "marke vorschlag" : "marke"}>{d.status === "vorgeschlagen" ? "vorgeschlagen" : "bestaetigt"}</span> Menge: {d.menge}</p>
      <table>
        <thead><tr><th>Menge</th><th>Baujahr</th></tr></thead>
        <tbody>{d.zeilen.map((z, i) => <tr key={i}><td>{z.menge}</td><td>{z.baujahr}</td></tr>)}</tbody>
      </table>
      <h3>Standort</h3>
      <p>{d.standort}</p>
      <h3>Versorgt</h3>
      {d.versorgt.length ? <ul>{d.versorgt.map((v) => <li key={v}>{v}</li>)}</ul> : <p>–</p>}
      <p className="leise">Position schematisch</p>
    </aside>
  );
}
