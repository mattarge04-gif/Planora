import type { FastifyReply } from "fastify";
import type pg from "pg";
import { pruefe } from "./rechte.js";

/** Gemeinsame Helfer der Fach-Routen (Zugriff ueber das Gebaeude, Transaktionen). */
export async function mitClient<T>(pool: pg.Pool, f: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { return await f(c); } finally { c.release(); }
}

/** `art` ist das Beginn-Statement, z. B. "begin" oder "begin isolation level repeatable read read only". */
export const inTx = <T>(pool: pg.Pool, art: string, f: (c: pg.PoolClient) => Promise<T>): Promise<T> => mitClient(pool, async (c) => {
  await c.query(art);
  try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
});

/** Lesen: fach.lesen auf der Liegenschaft des Gebaeudes (sonst 404); Schreiben zusaetzlich fach.aendern (sonst 403). */
export async function zugriff(c: pg.ClientBase, benutzerId: string, gebaeudeId: string, schreiben: boolean): Promise<200 | 403 | 404> {
  const r = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
  if (!r || !(await pruefe(c, benutzerId, "fach.lesen", r.liegenschaft_id))) return 404;
  if (schreiben && !(await pruefe(c, benutzerId, "fach.aendern", r.liegenschaft_id))) return 403;
  return 200;
}

/** Zugriff ueber das Gebaeude des Dokuments; gebaeudeId ist leer, wenn das Dokument fehlt. */
export async function zugriffDokument(c: pg.ClientBase, benutzerId: string, dokumentId: string, schreiben: boolean): Promise<{ code: 200 | 403 | 404; gebaeudeId: string }> {
  const r = (await c.query("select gebaeude_id from dokument where id=$1", [dokumentId])).rows[0];
  if (!r) return { code: 404, gebaeudeId: "" };
  return { code: await zugriff(c, benutzerId, r.gebaeude_id, schreiben), gebaeudeId: r.gebaeude_id as string };
}

export const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });
