import { useSyncExternalStore } from "react";

/** Kleiner Wertspeicher für häufige Updates (z. B. Bildschirmpunkt der Auswahl je Frame),
 * damit nur die abonnierende Komponente neu rendert und nicht die ganze Seite. */
export interface Speicher<T> { lesen: () => T; setzen: (w: T) => void; abo: (f: () => void) => () => void }

export function speicher<T>(start: T): Speicher<T> {
  let wert = start;
  const hoerer = new Set<() => void>();
  return {
    lesen: () => wert,
    setzen: (w) => { if (w === wert) return; wert = w; hoerer.forEach((f) => f()); },
    abo: (f) => { hoerer.add(f); return () => hoerer.delete(f); },
  };
}

export function useSpeicher<T>(s: Speicher<T>): T {
  return useSyncExternalStore(s.abo, s.lesen, s.lesen);
}
