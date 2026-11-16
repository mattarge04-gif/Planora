import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState, type Dispatch, type ReactNode } from "react";
import type { KatalogEintrag } from "../../typen";
import type { Aktion, AssistentZustand } from "../zustand";

export interface SchrittProps {
  z: AssistentZustand;
  dispatch: Dispatch<Aktion>;
  katalog: KatalogEintrag[] | null;
}

export const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Eingetippten Zählerwert übernehmen: gerundet und geklemmt; null = nichts tun (leer, ungültig oder unverändert). */
export function zaehlerUebernehmen(text: string, aktuell: number, min: number, max: number): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  const r = Math.max(min, Math.min(max, Math.round(n)));
  return r === aktuell ? null : r;
}

/**
 * Zahl mit −/+ (Tastatur: Pfeile im Eingabefeld, Tab auf die Knöpfe). Getippte Werte gelten erst bei Blur oder Enter,
 * sonst löschte ein geleertes Feld sofort alle Einheiten. `name`: eindeutiger zugänglicher Name, wenn das Label sich wiederholt.
 */
export function Zaehler({ label, name, wert, min, max, onWert, deaktiviert, beschreibung }: {
  label: string; name?: string; wert: number; min: number; max: number; onWert: (n: number) => void; deaktiviert?: boolean; beschreibung?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(wert));
  useEffect(() => { setText(String(wert)); }, [wert]);
  const zugang = name ?? label;
  const setze = (n: number) => { if (Number.isFinite(n)) onWert(Math.max(min, Math.min(max, Math.round(n)))); };
  const uebernehmen = () => {
    const n = zaehlerUebernehmen(text, wert, min, max);
    if (n === null) setText(String(wert)); else onWert(n);
  };
  return (
    <div className="as-zaehler">
      <label htmlFor={id} className="as-label">{label}</label>
      {beschreibung && <span className="as-hilfe">{beschreibung}</span>}
      <div className="as-zaehler-feld">
        <button type="button" className="as-rundknopf" aria-label={`${zugang} verringern`} disabled={deaktiviert || wert <= min} onClick={() => setze(wert - 1)}><Minus {...ICON} /></button>
        <input id={id} type="number" inputMode="numeric" min={min} max={max} value={text} disabled={deaktiviert} aria-label={name}
          onChange={(e) => setText(e.target.value)} onBlur={uebernehmen}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); uebernehmen(); } }} />
        <button type="button" className="as-rundknopf" aria-label={`${zugang} erhöhen`} disabled={deaktiviert || wert >= max} onClick={() => setze(wert + 1)}><Plus {...ICON} /></button>
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

/** `name`: eindeutiger Name für Screenreader, wenn das sichtbare Label sich wiederholt (z. B. «Wärmezähler» je Karte). */
export function Schalter({ label, an, onAn, deaktiviert, name }: { label: string; an: boolean; onAn: (an: boolean) => void; deaktiviert?: boolean; name?: string }) {
  return (
    <label className="as-schalter">
      <input type="checkbox" role="switch" checked={an} disabled={deaktiviert} aria-label={name} onChange={(e) => onAn(e.target.checked)} />
      <span className="as-schalter-bahn" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
