import { expect } from "vitest";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { erzeugeSetupToken, loeseSetupTokenEin } from "../src/auth/setup.js";

/** Gemeinsame API-Test-Helfer (JSON-Anfrage mit Schutz-Headern, Konto mit Rolle und Anmeldung). */
export const anfrageMit = (app: FastifyInstance, origin: string) => (method: "GET" | "POST" | "PUT" | "DELETE", url: string, cookie: string, body?: unknown) => app.inject({
  method, url,
  headers: { cookie, origin, "x-planora-request": "1", ...(body !== undefined ? { "content-type": "application/json" } : {}) },
  payload: body !== undefined ? JSON.stringify(body) : undefined,
});
export const cookieVon = (r: any) => ([] as string[]).concat(r.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
export async function legeKontoAn(app: FastifyInstance, pool: pg.Pool, origin: string, pw: string, email: string, rolle: string, scopes: string[]) {
  const { benutzerId } = await loeseSetupTokenEin(pool, await erzeugeSetupToken(pool), email, email, pw);
  await pool.query("update rolle_zuordnung set rolle=$2 where benutzer_id=$1", [benutzerId, rolle]);
  for (const l of scopes) await pool.query("insert into rolle_liegenschaft(benutzer_id, liegenschaft_id) values ($1,$2)", [benutzerId, l]);
  const r = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { "content-type": "application/json", origin }, payload: JSON.stringify({ email, password: pw }) });
  expect(r.statusCode).toBe(200);
  return cookieVon(r);
}
