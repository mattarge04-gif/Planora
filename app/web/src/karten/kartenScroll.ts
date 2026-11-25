/**
 * Scrollt nur den eigenen Scrollbereich der Anlagenkarte (.tw-objekt-inhalt), bis `ziel` oben steht. Kein scrollIntoView:
 * das bewegt auch Vorfahren mit overflow: hidden (Overlay-Spalte), Kartenkopf und Geschossleiste verschwänden (Kritik r2 P1).
 */
export function zeigeInKarte(ziel: HTMLElement | null | undefined, abstand = 24): void { // abstand: unter der Ausblendung oben (Twin.css .tw-gescrollt)
  const scroller = ziel?.closest<HTMLElement>(".tw-objekt-inhalt");
  if (!ziel || !scroller) return;
  const top = ziel.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - abstand;
  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({ top: Math.max(0, top), behavior: ruhig ? "auto" : "smooth" });
}
