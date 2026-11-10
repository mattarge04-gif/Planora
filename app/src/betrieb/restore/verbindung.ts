import { readFileSync } from "node:fs";
import type pg from "pg";

/** Dieselbe explizite TLS-Policy fuer node-postgres und libpq; kein require -> prefer. */
export function restoreVerbindung(url: URL): { zielDb: pg.ClientConfig; pgEnv: NodeJS.ProcessEnv } {
  for (const name of url.searchParams.keys()) if (name.startsWith("ssl") && !["sslmode", "sslrootcert", "sslcert", "sslkey"].includes(name)) throw new Error("Nicht unterstuetzter Restore-TLS-Parameter");
  const modus = url.searchParams.get("sslmode") ?? "disable";
  if (!["disable", "prefer", "require", "verify-ca", "verify-full"].includes(modus) || url.searchParams.has("ssl") || url.searchParams.has("uselibpqcompat")) throw new Error("Nicht unterstuetzte oder widerspruechliche Restore-TLS-Policy");
  const ca = url.searchParams.get("sslrootcert"), cert = url.searchParams.get("sslcert"), key = url.searchParams.get("sslkey");
  if ((cert && !key) || (key && !cert) || (modus === "verify-ca" && !ca)) throw new Error("Restore-TLS-Zertifikate unvollstaendig");
  const ssl = modus === "disable" ? false : {
    rejectUnauthorized: modus === "verify-full" || modus === "verify-ca" || !!ca,
    ...(ca ? { ca: readFileSync(ca, "utf8") } : {}),
    ...(cert ? { cert: readFileSync(cert, "utf8"), key: readFileSync(key!, "utf8") } : {}),
    ...(modus === "verify-ca" || (modus === "require" && ca) ? { checkServerIdentity: () => undefined } : {}),
  };
  return { zielDb: { host: url.hostname, port: Number(url.port || 5432), database: decodeURIComponent(url.pathname.slice(1)), ssl, options: url.searchParams.get("options") ?? undefined },
    pgEnv: { PGSSLMODE: modus, PGSSLROOTCERT: ca ?? undefined, PGSSLCERT: cert ?? undefined, PGSSLKEY: key ?? undefined } };
}
