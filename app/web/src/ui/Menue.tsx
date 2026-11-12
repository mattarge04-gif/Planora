import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

interface Props {
  /** Zugänglicher Name des Auslöseknopfs. */
  name: string;
  knopf: ReactNode;
  knopfKlasse?: string;
  /** Inhalt; `schliessen` nach einer Wahl aufrufen. */
  children: (schliessen: () => void) => ReactNode;
  breite?: "schmal" | "breit";
}

const EINTRAEGE = '[role^="menuitem"]:not([aria-disabled="true"])';

/** Aufklappmenü mit Tastaturbedienung: Pfeile, Pos1/Ende, Escape (Fokus zurück), Klick ausserhalb schliesst. */
export function Menue({ name, knopf, knopfKlasse = "", children, breite = "schmal" }: Props) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);
  const ausloeser = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!offen) return;
    const weg = (e: PointerEvent) => { if (!huelle.current?.contains(e.target as Node)) setOffen(false); };
    document.addEventListener("pointerdown", weg);
    liste.current?.querySelector<HTMLElement>(EINTRAEGE)?.focus();
    return () => document.removeEventListener("pointerdown", weg);
  }, [offen]);

  const schliessen = () => { setOffen(false); ausloeser.current?.focus(); };

  const taste = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); schliessen(); return; }
    if (e.key === "Tab") { setOffen(false); return; }
    const alle = [...(liste.current?.querySelectorAll<HTMLElement>(EINTRAEGE) ?? [])];
    if (!alle.length) return;
    const i = alle.indexOf(document.activeElement as HTMLElement);
    const ziel = e.key === "ArrowDown" ? alle[(i + 1) % alle.length]
      : e.key === "ArrowUp" ? alle[(i - 1 + alle.length) % alle.length]
      : e.key === "Home" ? alle[0] : e.key === "End" ? alle[alle.length - 1] : null;
    if (ziel) { e.preventDefault(); ziel.focus(); }
  };

  return (
    <div className="ui-menue" ref={huelle} onKeyDown={offen ? taste : undefined}>
      <button ref={ausloeser} type="button" className={knopfKlasse} aria-label={name} aria-haspopup="menu"
        aria-expanded={offen} aria-controls={offen ? id : undefined} onClick={() => setOffen((o) => !o)}>
        {knopf}
      </button>
      {offen && <div id={id} ref={liste} role="menu" aria-label={name} className={`ui-popover ui-popover-${breite}`}>
        {children(schliessen)}
      </div>}
    </div>
  );
}
