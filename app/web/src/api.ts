/** Fehler einer API-Antwort mit Status und lesbaren Meldungen. */
export class ApiFehler extends Error {
  readonly status: number;
  readonly meldungen: string[];
  constructor(status: number, meldungen: string[]) {
    super(meldungen.join(" ") || `Fehler ${status}`);
    this.status = status;
    this.meldungen = meldungen;
  }
}

/** Meldungen aus Planora-Fehlern ({ fehler: [...] } oder { fehler: "..." }) und Better-Auth ({ message }). */
export function fehlerMeldungen(j: unknown): string[] {
  if (j === null || typeof j !== "object") return [];
  const o = j as { fehler?: unknown; message?: unknown };
  if (Array.isArray(o.fehler)) return o.fehler.map((f) => (f && typeof f === "object" && typeof (f as { meldung?: unknown }).meldung === "string" ? (f as { meldung: string }).meldung : "")).filter(Boolean);
  if (typeof o.fehler === "string") return [o.fehler];
  if (typeof o.message === "string") return [o.message];
  return [];
}

export function loginFehlertext(status: number): string {
  if (status === 401) return "E-Mail oder Passwort falsch.";
  if (status === 403) return "Konto gesperrt oder noch nicht freigegeben.";
  if (status === 429) return "Zu viele Versuche. Bitte spaeter erneut versuchen.";
  return `Anmeldung fehlgeschlagen (Status ${status}).`;
}

async function anfrage<T>(methode: "GET" | "POST", pfad: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (methode !== "GET") headers["x-planora-request"] = "1";
  const r = await fetch(pfad, { method: methode, credentials: "same-origin", headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    let j: unknown = null;
    try { j = await r.json(); } catch { /* kein JSON */ }
    throw new ApiFehler(r.status, fehlerMeldungen(j));
  }
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const holeJson = <T,>(pfad: string) => anfrage<T>("GET", pfad);
export const sendeJson = <T,>(pfad: string, body: unknown) => anfrage<T>("POST", pfad, body);
