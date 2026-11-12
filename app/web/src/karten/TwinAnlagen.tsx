import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AnlagenZeile } from "../dashboard";

interface Props {
  anlagen: AnlagenZeile[]; auswahl: string | null; fokusId: string | null;
  onWahl: (a: AnlagenZeile) => void;
}

const STATUS = { bestaetigt: "Bestätigt", vorgeschlagen: "Vorgeschlagen" } as const;

/** Anlagen-Tabelle mit Tabellenweg: ganze Zeile wählbar (Klick, Enter, Leertaste), Pfeile wechseln die Zeile. */
export function TwinAnlagen({ anlagen, auswahl, fokusId, onWahl }: Props) {
  const rolle = useRef<HTMLDivElement>(null);
  const [rand, setRand] = useState({ oben: false, unten: false });

  const pruefen = () => {
    const el = rolle.current;
    if (!el) return;
    const neu = { oben: el.scrollTop > 2, unten: el.scrollTop + el.clientHeight < el.scrollHeight - 2 };
    setRand((alt) => alt.oben === neu.oben && alt.unten === neu.unten ? alt : neu);
  };
  useEffect(() => {
    pruefen();
    const el = rolle.current;
    if (!el) return;
    const ro = new ResizeObserver(pruefen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [anlagen.length]);

  // Auswahl aus 3D: Zeile in Sicht scrollen (nur innerhalb der Tabelle).
  useEffect(() => {
    const el = rolle.current;
    const zeile = auswahl ? el?.querySelector<HTMLElement>(`tr[data-schluessel="${CSS.escape(auswahl)}"]`) : null;
    if (!el || !zeile) return;
    const kopf = el.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    const rand = 28; // Ausblendverlauf am unteren Rand
    const oben = zeile.offsetTop - kopf, unten = zeile.offsetTop + zeile.offsetHeight + rand;
    const weich = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (oben < el.scrollTop) el.scrollTo({ top: oben, behavior: weich ? "smooth" : "auto" });
    else if (unten > el.scrollTop + el.clientHeight) el.scrollTo({ top: unten - el.clientHeight, behavior: weich ? "smooth" : "auto" });
  }, [auswahl]);

  const taste = (e: KeyboardEvent<HTMLTableRowElement>, a: AnlagenZeile) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWahl(a); return; }
    const ziel = e.key === "ArrowDown" ? e.currentTarget.nextElementSibling : e.key === "ArrowUp" ? e.currentTarget.previousElementSibling : null;
    if (ziel instanceof HTMLElement) { e.preventDefault(); ziel.focus(); }
  };

  return (
    <section className="ui-glas ui-karte tw-anlagen" aria-labelledby="karte-anlagen">
      <header className="ui-karte-kopf">
        <h2 id="karte-anlagen">Anlagen<span className="ui-anzahl">{anlagen.length}</span>
          {(rand.unten || rand.oben) && <span className="tw-scrollhinweis">Liste scrollbar</span>}</h2>
        <p className="tw-legende" aria-label="Legende">
          <span className="tw-strich" aria-hidden="true" />Heizung
          <span className="tw-punkt" aria-hidden="true" />Leitungen: schematischer Verlauf
        </p>
      </header>
      {anlagen.length === 0 ? <p className="tw-leer">Noch keine Anlagen erfasst.</p> :
        <div ref={rolle} onScroll={pruefen} role="region" aria-label="Anlagenliste"
          className={`tw-tabelle${rand.oben ? " tw-mehr-oben" : ""}${rand.unten ? " tw-mehr-unten" : ""}${fokusId ? " tw-gefiltert" : ""}`}>
          <table>
            <thead><tr><th scope="col">Typ</th><th scope="col">Hersteller / Typ</th><th scope="col">Standort</th>
              <th scope="col" className="tw-zahl">Menge</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {anlagen.map((a) => (
                <tr key={a.schluessel} data-schluessel={a.schluessel} tabIndex={0} aria-current={a.schluessel === auswahl ? "true" : undefined}
                  className={a.geschossId && a.geschossId === fokusId ? "tw-im-fokus" : undefined}
                  onClick={() => onWahl(a)} onKeyDown={(e) => taste(e, a)}>
                  <th scope="row">{a.name}</th>
                  <td>{a.herstellerTyp ?? <span className="tw-fehlt" title="Nicht erfasst" aria-label="Nicht erfasst">–</span>}</td>
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
