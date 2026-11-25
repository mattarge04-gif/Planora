/** Adressen des Assistenten (SPA; der Server liefert für unbekannte Seitenpfade index.html aus). */
export type AssistentRoute = { art: "neu" } | { art: "bearbeiten"; gebaeudeId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function routeAusPfad(pfad: string): AssistentRoute | null {
  const p = pfad.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  if (p === "/gebaeude/neu") return { art: "neu" };
  const m = /^\/gebaeude\/([^/]+)\/assistent$/.exec(p);
  return m && UUID.test(m[1]) ? { art: "bearbeiten", gebaeudeId: m[1] } : null;
}

export function pfadFuer(r: AssistentRoute): string {
  return r.art === "neu" ? "/gebaeude/neu" : `/gebaeude/${r.gebaeudeId}/assistent`;
}

/** Seiten eines Gebäudes mit eigener Adresse: Neu laden bleibt auf der Seite (D1). */
export type SeitenRoute = { art: "twin" | "plan" | "dokumente"; gebaeudeId: string };
const SEITE: Record<string, SeitenRoute["art"]> = { "": "twin", "/erneuerung": "plan", "/dokumente": "dokumente" };
export function seiteAusPfad(pfad: string): SeitenRoute | null {
  const m = /^\/gebaeude\/([^/]+)(\/[a-z]+)?$/.exec(pfad.split(/[?#]/, 1)[0].replace(/\/+$/, ""));
  const art = m ? SEITE[m[2] ?? ""] : undefined;
  return m && art && UUID.test(m[1]) ? { art, gebaeudeId: m[1] } : null;
}
export function seitenPfad(r: SeitenRoute): string {
  return `/gebaeude/${r.gebaeudeId}${Object.keys(SEITE).find((k) => SEITE[k] === r.art)}`;
}
