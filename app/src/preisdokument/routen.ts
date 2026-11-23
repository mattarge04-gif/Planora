import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { speichereUndReferenziere } from "../ablage/ablage.js";
import { pruefePdf, MAX_BYTES } from "./pdf.js";
import { ladeDokumente, loescheDokument, gibReferenzFrei } from "./speicher.js";
import { ID_PARAMS } from "../welt/schema.js";
import { auditEreignis } from "../audit/audit.js";
import { pruefe } from "../rechte/rechte.js";

import type { Laeufer } from "./laeufer.js";

export function registrierePreisdokumentRouten(app: FastifyInstance, pool: pg.Pool, laeufer?: Laeufer) {
  const mitClient = async <T>(f: (c: pg.PoolClient) => Promise<T>) => { const c = await pool.connect(); try { return await f(c); } finally { c.release(); } };
  const inTx = <T>(art: string, f: (c: pg.PoolClient) => Promise<T>) => mitClient(async (c) => {
    await c.query(art);
    try { const r = await f(c); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; }
  });
  async function zugriff(c: pg.ClientBase, benutzerId: string, gebaeudeId: string, schreiben: boolean): Promise<200 | 403 | 404> {
    const r = (await c.query("select liegenschaft_id from gebaeude where id=$1", [gebaeudeId])).rows[0];
    if (!r || !(await pruefe(c, benutzerId, "fach.lesen", r.liegenschaft_id))) return 404;
    if (schreiben && !(await pruefe(c, benutzerId, "fach.aendern", r.liegenschaft_id))) return 403;
    return 200;
  }
  /** Zugriff ueber das Gebaeude des Dokuments; gebaeudeId ist leer, wenn das Dokument fehlt. */
  async function zugriffDokument(c: pg.ClientBase, benutzerId: string, dokumentId: string, schreiben: boolean): Promise<{ code: 200 | 403 | 404; gebaeudeId: string }> {
    const r = (await c.query("select gebaeude_id from dokument where id=$1", [dokumentId])).rows[0];
    if (!r) return { code: 404, gebaeudeId: "" };
    return { code: await zugriff(c, benutzerId, r.gebaeude_id, schreiben), gebaeudeId: r.gebaeude_id as string };
  }
  const verweigert = (reply: FastifyReply, code: 403 | 404) => reply.code(code).send({ fehler: code === 404 ? "nicht gefunden" : "keine Berechtigung" });

  app.register(async (scope) => {
    scope.addContentTypeParser("application/pdf", { parseAs: "buffer", bodyLimit: MAX_BYTES + 1024 }, (_req, body, done) => done(null, body));

    scope.post<{ Params: { id: string } }>("/api/preisdokument/gebaeude/:id/dokumente", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      const g = (await pool.query("select liegenschaft_id from gebaeude where id=$1", [req.params.id])).rows[0];
      const daten = req.body as Buffer;
      const p = pruefePdf(daten);
      if (!p.ok) return reply.code(400).send({ fehler: p.grund });
      let name = "Dokument.pdf";
      try { name = decodeURIComponent(String(req.headers["x-dateiname"] ?? "")).slice(0, 255) || name; } catch { /* Standardname */ }
      const sha = createHash("sha256").update(daten).digest("hex");
      const zeileVon = async (id: string) => (await mitClient((c) => ladeDokumente(c, req.params.id))).find((d) => d.id === id);
      const vorhanden = (await pool.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [req.params.id, sha])).rows[0];
      if (vorhanden) return reply.code(200).send(await zeileVon(vorhanden.id));
      const status = laeufer?.zustand().auslesen === "an" ? "neu" : "aus";
      const id = randomUUID();
      const objekt = `dokument:${id}`;
      // Datei und Referenz werden in eigener Transaktion committet, das Dokument danach.
      // Scheitert das Einfuegen (z. B. paralleler Upload derselben Datei), wird die Referenz
      // wieder freigegeben, damit weder Referenz noch Datei verwaisen.
      const d = await speichereUndReferenziere(pool, app.ablage, Readable.from(daten), objekt);
      try {
        await inTx("begin", async (c) => {
          await c.query(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, req.params.id, g.liegenschaft_id, name, d.schluessel, d.sha256, d.groesse, p.seiten, k.benutzerId, status]);
          await auditEreignis(c, k.auditId, "preisdokument.hochgeladen", { gebaeudeId: req.params.id, dokumentId: id, groesse: d.groesse });
        });
      } catch (e) {
        await mitClient((c) => gibReferenzFrei(c, d.schluessel, objekt)).catch(() => {});
        const dup = (await pool.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [req.params.id, sha])).rows[0];
        if (dup) return reply.code(200).send(await zeileVon(dup.id));
        throw e;
      }
      if (status === "neu") laeufer!.starte(id);
      return reply.code(201).send(await zeileVon(id));
    });

    scope.get<{ Params: { id: string } }>("/api/preisdokument/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) =>
      inTx("begin isolation level repeatable read read only", async (c) => {
        const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
        if (z !== 200) return verweigert(reply, z);
        const darfAendern = (await zugriff(c, req.kontext!.benutzerId, req.params.id, true)) === 200;
        const zs = laeufer?.zustand();
        return {
          dokumente: await ladeDokumente(c, req.params.id), darfAendern,
          auslesen: zs?.auslesen ?? "kein_schluessel",
          budget: { verbrauchtUsd: zs ? await zs.verbrauchtUsd() : 0, limitUsd: zs?.limitUsd ?? 0 },
        };
      }));

    scope.get<{ Params: { id: string } }>("/api/preisdokument/dokumente/:id/datei", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const z = await mitClient((c) => zugriffDokument(c, req.kontext!.benutzerId, req.params.id, false));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      const r = (await pool.query("select dateiname, schluessel from dokument where id=$1", [req.params.id])).rows[0];
      if (!r) return verweigert(reply, 404);
      return reply.type("application/pdf")
        .header("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(r.dateiname)}`)
        .send(app.ablage.lese(r.schluessel));
    });

    scope.post<{ Params: { id: string } }>("/api/preisdokument/dokumente/:id/neu-lesen", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const r = await mitClient((c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (r.code !== 200) return verweigert(reply, r.code as 403 | 404);
      if (laeufer?.zustand().auslesen !== "an") return reply.code(409).send({ fehler: "auslesen_aus" });
      // Offene und verworfene Vorschlaege entfallen, uebernommene bleiben; ein laufender Lesevorgang wird nicht doppelt gestartet.
      const gestartet = await inTx("begin", async (c) => {
        const l = await c.query("update dokument set auslesen_status='neu', auslesen_fehler=null where id=$1 and auslesen_status <> 'liest' returning id", [req.params.id]);
        if (!l.rowCount) return false;
        await c.query("delete from preis_vorschlag where dokument_id=$1 and status <> 'uebernommen'", [req.params.id]);
        await auditEreignis(c, k.auditId, "preisdokument.neu_lesen", { gebaeudeId: r.gebaeudeId, dokumentId: req.params.id });
        return true;
      });
      if (!gestartet) return reply.code(409).send({ fehler: "liest_bereits" });
      laeufer.starte(req.params.id);
      return reply.code(202).send((await mitClient((c) => ladeDokumente(c, r.gebaeudeId))).find((d) => d.id === req.params.id));
    });

    scope.delete<{ Params: { id: string } }>("/api/preisdokument/dokumente/:id", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient((c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      await inTx("begin", async (c) => {
        await loescheDokument(c, req.params.id);
        await auditEreignis(c, k.auditId, "preisdokument.geloescht", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id });
      });
      return reply.code(204).send();
    });
  });
}
