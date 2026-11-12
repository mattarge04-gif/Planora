interface Props { geschosse: { id: string; code: string; yUnten: number }[]; fokusId: string | null; onFokus: (id: string | null) => void }

export function GeschossLeiste({ geschosse, fokusId, onFokus }: Props) {
  if (geschosse.length === 0) return null;
  const sortiert = [...geschosse].sort((a, b) => a.yUnten - b.yUnten);
  return (
    <nav className="glas geschossleiste" aria-label="Geschosse">
      <button aria-pressed={fokusId === null} onClick={() => onFokus(null)}>Alle</button>
      {sortiert.map((g) => <button key={g.id} aria-pressed={fokusId === g.id} onClick={() => onFokus(g.id)}>{g.code}</button>)}
    </nav>
  );
}
