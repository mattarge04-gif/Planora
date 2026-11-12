interface Props { fokus: boolean }

/** Legende: Gewerkefarbe Heizung, Hinweis auf schematischen Verlauf und Bedienung. */
export function TwinLegende({ fokus }: Props) {
  return (
    <aside className="tw-legende" aria-label="Legende">
      <p><span className="tw-strich" aria-hidden="true" />Heizung<span className="tw-punkt" aria-hidden="true" />Schematischer Verlauf</p>
      <p className="tw-bedienung">{fokus ? "Esc: zurück zur Übersicht" : "Ziehen: drehen · Scrollen: vergrössern"}</p>
    </aside>
  );
}
