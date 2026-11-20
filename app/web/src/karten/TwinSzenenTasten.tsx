import { useEffect, useRef, useState } from "react";
import type { GeschossZeile } from "../dashboard";

interface Props {
  name: string; geschosse: GeschossZeile[]; fokusId: string | null;
  onFokus: (id: string | null) => void; onTechnik: () => void;
  separiert: boolean; onSeparieren: (s: boolean) => void;
  /** Kurze sichtbare Rückmeldung zu einer Taste ohne sichtbare Wirkung (z. B. T im Technikmodus). */
  meldung?: string | null;
  /** Erneuerungsansicht (Taste E); ohne `onErneuerung` (Modul aus) gibt es keine Taste. */
  erneuerung?: boolean; onErneuerung?: (an: boolean) => void;
}

/** Eigene Kürzel des Dashboards auf dem Szenen-Canvas (Szene3 `tastatur`: Pfeile drehen/neigen, +/− zoomen).
 * Ein einziger Tab-Stopp: der Canvas. Hier kommen Geschoss (Bild auf/ab), Technik, Separieren und Übersicht dazu. */
export const EIGENE_KUERZEL = "PageUp PageDown Home 0 T S Escape";

export function TwinSzenenTasten({ name, geschosse, fokusId, onFokus, onTechnik, separiert, onSeparieren, meldung = null, erneuerung = false, onErneuerung }: Props) {
  const [sichtbar, setSichtbar] = useState(false);
  const leiste = useRef<HTMLParagraphElement>(null);
  const stand = useRef({ geschosse, fokusId, onFokus, onTechnik, separiert, onSeparieren, erneuerung, onErneuerung });
  stand.current = { geschosse, fokusId, onFokus, onTechnik, separiert, onSeparieren, erneuerung, onErneuerung };

  useEffect(() => {
    const canvas = leiste.current?.closest(".twin")?.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) return;
    const ergaenzen = () => {
      const k = canvas.getAttribute("aria-keyshortcuts") ?? "";
      if (!k.includes("PageUp")) canvas.setAttribute("aria-keyshortcuts", `${k} ${EIGENE_KUERZEL}${stand.current.onErneuerung ? " E" : ""}`.trim());
      canvas.setAttribute("aria-describedby", "tw-szene-kuerzel");
      canvas.setAttribute("aria-roledescription", "3D-Modell");
    };
    let halten = 0;
    const taste = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const s = stand.current;
      const i = s.fokusId ? s.geschosse.findIndex((g) => g.id === s.fokusId) : -1; // geschosse: oben -> unten
      let ok = true;
      if (e.key === "PageDown") s.onFokus(s.geschosse[Math.min(i + 1, s.geschosse.length - 1)]?.id ?? null);
      else if (e.key === "PageUp") s.onFokus(i <= 0 ? null : s.geschosse[i - 1].id);
      else if (e.key === "Home" || e.key === "0") s.onFokus(null);
      else if (e.key === "t" || e.key === "T") s.onTechnik();
      else if (e.key === "s" || e.key === "S") s.onSeparieren(!s.separiert);
      else if ((e.key === "e" || e.key === "E") && s.onErneuerung) {
        s.onErneuerung(!s.erneuerung);
        // Der Moduswechsel ändert die Kartenränder; Szene3 setzt dabei den tabindex des Canvas neu, was ihn kurz blurt.
        // In dieser Zeit den Fokus halten, damit ein zweites E wieder ausschaltet.
        halten = performance.now() + 5000;
      }
      else ok = false;
      if (ok) e.preventDefault();
    };
    const loslassen = () => { halten = 0; };
    const an = () => { ergaenzen(); setSichtbar(canvas.matches(":focus-visible")); };
    const aus = (e: FocusEvent) => {
      if (!e.relatedTarget && performance.now() < halten) { setTimeout(() => { if (canvas.isConnected && !document.activeElement?.closest("input, select, textarea, button, a, [tabindex]:not(canvas)")) canvas.focus({ preventScroll: true }); }, 0); return; }
      setSichtbar(false);
    };
    ergaenzen();
    canvas.addEventListener("keydown", taste);
    canvas.addEventListener("focus", an);
    canvas.addEventListener("blur", aus);
    document.addEventListener("pointerdown", loslassen, true);
    return () => {
      canvas.removeEventListener("keydown", taste); canvas.removeEventListener("focus", an); canvas.removeEventListener("blur", aus); document.removeEventListener("pointerdown", loslassen, true);
    };
  }, []);

  return (
    <div className={sichtbar ? "tw-szene-hinweis tw-sichtbar" : "tw-szene-hinweis"}>
      {meldung && <p className="tw-tastenmeldung" aria-hidden="true">{meldung}</p>}
      <p id="tw-szene-kuerzel" ref={leiste} className="tw-kuerzel" aria-hidden={!sichtbar}>
        <span className="ui-sr">3D-Modell {name}. Tastenkürzel: </span>
        <span><kbd>←</kbd><kbd>→</kbd> Drehen</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> Neigen</span>
        <span><kbd>Shift</kbd>+<kbd>Pfeile</kbd> Verschieben</span>
        <span><kbd>+</kbd><kbd>−</kbd> Zoom</span>
        <span><kbd>Bild ↑</kbd><kbd>Bild ↓</kbd> Geschoss</span>
        <span><kbd>T</kbd> Technik</span>
        <span><kbd>S</kbd> Separieren</span>
        {onErneuerung && <span><kbd>E</kbd> Erneuerung</span>}
        <span><kbd>Esc</kbd> Zurück</span>
      </p>
    </div>
  );
}
