import type { Beschreibung, Heizung, Hinweis } from "./typen.js";

/** Wirksamer Wert je Art: Ausnahme der Einheit, sonst Standard des Gebaeudes. */
export function wirksameHeizung(standard: Heizung, ausnahme?: Partial<Heizung>): Heizung {
  return { hk: ausnahme?.hk ?? standard.hk, fbh: ausnahme?.fbh ?? standard.fbh, tabs: ausnahme?.tabs ?? standard.tabs };
}

/** Einheiten mit wirksamer FBH, die kein Verteiler versorgt: Vorschlag, keine Behauptung (ADR 0032 Punkt 5). */
export function verteilerHinweise(b: Beschreibung): Hinweis[] {
  const versorgt = new Set<string>();
  for (const t of b.bauteile) if (t.katalogId === "heizung.verteiler") for (const v of t.versorgt) if (v.einheitId) versorgt.add(v.einheitId);
  const hinweise: Hinweis[] = [];
  for (const e of b.einheiten)
    if (e.id && wirksameHeizung(b.heizungStandard, e.heizungAusnahme).fbh === "ja" && !versorgt.has(e.id))
      hinweise.push({ code: "verteiler_vorschlag", bezug: e.id });
  return hinweise;
}
