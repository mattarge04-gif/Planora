import { ArrowUpRight, TriangleAlert } from "lucide-react";
import { forwardRef } from "react";
import type { HinweisZeile } from "../dashboard";

interface Props { hinweise: HinweisZeile[]; geschossCode: (id: string) => string; onZiel: (geschossId: string) => void }

/** Text «Einheit: Aussage» wird für die Darstellung in Titel und Aussage geteilt. */
function teile(text: string): [string | null, string] {
  const i = text.indexOf(": ");
  return i > 0 && i < 40 ? [text.slice(0, i), text.slice(i + 2)] : [null, text];
}

/** Hinweiskarte: echte Hinweise; «… öffnen» fährt zum Geschoss des Zielorts. */
export const TwinHinweise = forwardRef<HTMLElement, Props>(function TwinHinweise({ hinweise, geschossCode, onZiel }, ref) {
  return (
    <section ref={ref} tabIndex={-1} className="ui-glas ui-karte tw-hinweise" aria-labelledby="karte-hinweise">
      <header className="ui-karte-kopf">
        <h2 id="karte-hinweise">Hinweise<span className="ui-anzahl">{hinweise.length}</span></h2>
      </header>
      {hinweise.length === 0
        ? <p className="tw-leer">Keine Hinweise.</p>
        : <ul className="tw-hinweisliste">
          {hinweise.map((h) => {
            const [titel, aussage] = teile(h.text);
            const g = h.ziel?.geschossId ?? null;
            return (
              <li key={h.id}>
                <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" className="tw-warnicon" />
                <div>
                  {titel && <strong>{titel}</strong>}
                  <span>{aussage}</span>
                  {g && <button type="button" className="tw-ziel" onClick={() => onZiel(g)}>
                    {geschossCode(g)} öffnen<ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>}
                </div>
              </li>
            );
          })}
        </ul>}
    </section>
  );
});
