import { Minus, Plus } from "lucide-react";
import { useId, type Dispatch, type ReactNode } from "react";
import type { KatalogEintrag } from "../../typen";
import type { Aktion, AssistentZustand } from "../zustand";

export interface SchrittProps {
  z: AssistentZustand;
  dispatch: Dispatch<Aktion>;
  katalog: KatalogEintrag[] | null;
}

export const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Zahl mit −/+ (Tastatur: Pfeile im Eingabefeld, Tab auf die Knöpfe). */
export function Zaehler({ label, wert, min, max, onWert, deaktiviert, beschreibung }: {
  label: string; wert: number; min: number; max: number; onWert: (n: number) => void; deaktiviert?: boolean; beschreibung?: string;
}) {
  const id = useId();
  const setze = (n: number) => { if (Number.isFinite(n)) onWert(Math.max(min, Math.min(max, Math.round(n)))); };
  return (
    <div className="as-zaehler">
      <label htmlFor={id} className="as-label">{label}</label>
      {beschreibung && <span className="as-hilfe">{beschreibung}</span>}
      <div className="as-zaehler-feld">
        <button type="button" className="as-rundknopf" aria-label={`${label} verringern`} disabled={deaktiviert || wert <= min} onClick={() => setze(wert - 1)}><Minus {...ICON} /></button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} value={wert} disabled={deaktiviert}
          onChange={(e) => setze(Number(e.target.value))} />
        <button type="button" className="as-rundknopf" aria-label={`${label} erhöhen`} disabled={deaktiviert || wert >= max} onClick={() => setze(wert + 1)}><Plus {...ICON} /></button>
      </div>
    </div>
  );
}

/** Segmentierte Auswahl als echte Radiogruppe (Pfeiltasten wechseln). */
export function Segment<T extends string>({ name, label, wert, optionen, onWert, deaktiviert, klein }: {
  name: string; label: string; wert: T | null; optionen: readonly { wert: T; text: string }[]; onWert: (w: T) => void; deaktiviert?: boolean; klein?: boolean;
}) {
  return (
    <fieldset className={`as-segment${klein ? " as-segment-klein" : ""}`} disabled={deaktiviert}>
      <legend className="ui-sr">{label}</legend>
      {optionen.map((o) => (
        <label key={o.wert} className="as-segment-option">
          <input type="radio" name={name} value={o.wert} checked={wert === o.wert} onChange={() => onWert(o.wert)} />
          <span>{o.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Abschnitt({ titel, zusatz, children, aktion }: { titel: string; zusatz?: ReactNode; children: ReactNode; aktion?: ReactNode }) {
  return (
    <section className="as-abschnitt">
      <header className="as-abschnitt-kopf">
        <h2>{titel}</h2>
        {zusatz && <span className="as-abschnitt-zusatz">{zusatz}</span>}
        {aktion && <span className="as-abschnitt-aktion">{aktion}</span>}
      </header>
      {children}
    </section>
  );
}

export function Hinweis({ children, art = "info" }: { children: ReactNode; art?: "info" | "warnung" }) {
  return <p className={`as-hinweis as-hinweis-${art}`} role={art === "warnung" ? "alert" : undefined}>{children}</p>;
}

export function Schalter({ label, an, onAn, deaktiviert }: { label: string; an: boolean; onAn: (an: boolean) => void; deaktiviert?: boolean }) {
  return (
    <label className="as-schalter">
      <input type="checkbox" role="switch" checked={an} disabled={deaktiviert} onChange={(e) => onAn(e.target.checked)} />
      <span className="as-schalter-bahn" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
