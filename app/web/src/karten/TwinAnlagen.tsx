import type { AnlagenZeile } from "../dashboard";

interface Props { anlagen: AnlagenZeile[]; fokusId: string | null; onZiel: (geschossId: string) => void }

const STATUS = { bestaetigt: "Bestätigt", vorgeschlagen: "Vorgeschlagen" } as const;

/** Anlagen-Tabelle. Bis zur Objektauswahl (Teilaufgabe 6/7) öffnet eine Zeile das Geschoss der Anlage. */
export function TwinAnlagen({ anlagen, fokusId, onZiel }: Props) {
  return (
    <section className="ui-glas ui-karte tw-anlagen" aria-labelledby="karte-anlagen">
      <header className="ui-karte-kopf">
        <h2 id="karte-anlagen">Anlagen<span className="ui-anzahl">{anlagen.length}</span></h2>
      </header>
      {anlagen.length === 0 ? <p className="tw-leer">Noch keine Anlagen erfasst.</p> :
        <div className={fokusId ? "tw-tabelle tw-gefiltert" : "tw-tabelle"} tabIndex={0} role="region" aria-label="Anlagenliste, scrollbar">
          <table>
            <thead><tr><th scope="col">Typ</th><th scope="col">Hersteller / Typ</th><th scope="col">Standort</th>
              <th scope="col" className="tw-zahl">Menge</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {anlagen.map((a) => (
                <tr key={a.schluessel} className={a.geschossId && a.geschossId === fokusId ? "tw-im-fokus" : undefined}
                  onClick={a.geschossId ? () => onZiel(a.geschossId!) : undefined}>
                  <th scope="row">
                    {a.geschossId
                      ? <button type="button" onClick={(e) => { e.stopPropagation(); onZiel(a.geschossId!); }} aria-label={`${a.name}, Geschoss öffnen`}>{a.name}</button>
                      : a.name}
                  </th>
                  <td className={a.herstellerTyp ? undefined : "tw-fehlt"}>{a.herstellerTyp ?? "Nicht erfasst"}</td>
                  <td>{a.standort}</td>
                  <td className="tw-zahl">{a.menge}</td>
                  <td><span className={`tw-status tw-status-${a.status}`}>{STATUS[a.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </section>
  );
}
