import { useEffect, useRef, useState } from "react";
import type { GeschossZeile } from "../dashboard";

interface Props {
  name: string; geschosse: GeschossZeile[]; fokusId: string | null;
  onFokus: (id: string | null) => void; onTechnik: () => void;
  separiert: boolean; onSeparieren: (s: boolean) => void;
}

/** Eigene Kürzel des Dashboards auf dem Szenen-Canvas (Szene3 `tastatur`: Pfeile drehen/neigen, +/− zoomen).
 * Ein einziger Tab-Stopp: der Canvas. Hier kommen Geschoss (Bild auf/ab), Technik, Separieren und Übersicht dazu. */
export const EIGENE_KUERZEL = "PageUp PageDown Home 0 T S Escape";

export function TwinSzenenTasten({ name, geschosse, fokusId, onFokus, onTechnik, separiert, onSeparieren }: Props) {
  const [sichtbar, setSichtbar] = useState(false);
  const leiste = useRef<HTMLParagraphElement>(null);
  const stand = useRef({ geschosse, fokusId, onFokus, onTechnik, separiert, onSeparieren });
  stand.current = { geschosse, fokusId, onFokus, onTechnik, separiert, onSeparieren };

  useEffect(() => {
    const canvas = leiste.current?.closest(".twin")?.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) return;
    const ergaenzen = () => {
      const k = canvas.getAttribute("aria-keyshortcuts") ?? "";
      if (!k.includes("PageUp")) canvas.setAttribute("aria-keyshortcuts", `${k} ${EIGENE_KUERZEL}`.trim());
      canvas.setAttribute("aria-describedby", "tw-szene-kuerzel");
      canvas.setAttribute("aria-roledescription", "3D-Modell");
    };
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
      else ok = false;
      if (ok) e.preventDefault();
    };
    const an = () => { ergaenzen(); setSichtbar(canvas.matches(":focus-visible")); };
    const aus = () => setSichtbar(false);
    ergaenzen();
    canvas.addEventListener("keydown", taste);
    canvas.addEventListener("focus", an);
    canvas.addEventListener("blur", aus);
    return () => {
      canvas.removeEventListener("keydown", taste); canvas.removeEventListener("focus", an); canvas.removeEventListener("blur", aus);
    };
  }, []);

  return (
    <div className={sichtbar ? "tw-szene-hinweis tw-sichtbar" : "tw-szene-hinweis"} aria-hidden={!sichtbar}>
      <p id="tw-szene-kuerzel" ref={leiste} className="tw-kuerzel">
        <span className="ui-sr">3D-Modell {name}. Tastenkürzel: </span>
        <span><kbd>←</kbd><kbd>→</kbd> Drehen</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> Neigen</span>
        <span><kbd>+</kbd><kbd>−</kbd> Zoom</span>
        <span><kbd>Bild ↑</kbd><kbd>Bild ↓</kbd> Geschoss</span>
        <span><kbd>T</kbd> Technik</span>
        <span><kbd>S</kbd> Separieren</span>
        <span><kbd>Esc</kbd> Zurück</span>
      </p>
    </div>
  );
}
