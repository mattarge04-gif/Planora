import { useEffect, useRef } from "react";

/** Kleiner Namens-Tooltip am Cursor, solange eine Anlage in 3D überfahren wird. Position per CSSOM, ohne Re-Render. */
export function TwinTooltip({ text }: { text: string | null }) {
  const el = useRef<HTMLDivElement>(null);
  const letzte = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const setze = (x: number, y: number) => {
      const t = el.current;
      if (!t) return;
      const b = t.offsetWidth;
      const links = x + 14 + b > window.innerWidth - 8 ? x - 14 - b : x + 14;
      t.style.transform = `translate(${Math.round(links)}px, ${Math.round(y + 16)}px)`;
    };
    const bewegt = (e: PointerEvent) => { letzte.current = { x: e.clientX, y: e.clientY }; setze(e.clientX, e.clientY); };
    window.addEventListener("pointermove", bewegt, { passive: true });
    if (letzte.current) setze(letzte.current.x, letzte.current.y);
    return () => window.removeEventListener("pointermove", bewegt);
  }, [text]);
  return <div ref={el} className={text ? "tw-tooltip tw-tooltip-an" : "tw-tooltip"} role="tooltip" aria-hidden={!text}>{text}</div>;
}
