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
