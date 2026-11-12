export function Legende() {
  return (
    <aside className="glas legende" aria-label="Legende">
      <p className="ueberzeile">Heizung</p>
      <div><span className="strich haupt" />Hauptleitung</div>
      <div><span className="strich verteil" />Verteilung</div>
      <div><span className="punkt" />Geraet / Apparat</div>
      <p className="leise">Schematischer Verlauf, keine Leitungsplanung.</p>
    </aside>
  );
}
