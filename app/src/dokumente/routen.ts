import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { speichereUndReferenziere } from "../ablage/ablage.js";
import { ID_PARAMS } from "../welt/schema.js";
import { auditEreignis } from "../audit/audit.js";
import { inTx, mitClient, verweigert, zugriff, zugriffDokument } from "../rechte/zugriff.js";
import { MAX_BYTES, erkenneTyp, startKategorie } from "./typ.js";
import { zaehleSeiten } from "./pdf.js";
import { DATEI_QUERY } from "./schema.js";
import { gibReferenzFrei, ladeAblage, ladeAblageBauteile, loescheDokument } from "./speicher.js";

/** Entfernt Steuer- und Bidi-Zeichen (Anzeige-Taeuschung, z. B. U+202E) und begrenzt auf 255 Zeichen. */
export function bereinigeDateiname(name: string): string {
  return name.replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim().slice(0, 255);
}

export function registriereDokumentRouten(app: FastifyInstance, pool: pg.Pool) {
  const zeile = async (gebaeudeId: string, id: string) => (await mitClient(pool, (c) => ladeAblage(c, gebaeudeId, id)))[0];
  const bestehendes = async (gebaeudeId: string, sha: string) => {
    const r = (await pool.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [gebaeudeId, sha])).rows[0];
    return r ? zeile(gebaeudeId, r.id) : null;
  };

  app.register(async (scope) => {
    // Rohe Bytes in einem Request (ADR 0016 Nachtrag, kein Multipart). Typ kommt aus den Magic Bytes, nie aus Content-Type oder Endung.
    scope.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: MAX_BYTES + 1024 }, (_req, body, done) => done(null, body));

    scope.post<{ Params: { id: string } }>("/api/dokumente/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient(pool, (c) => zugriff(c, k.benutzerId, req.params.id, true));
      if (z !== 200) return verweigert(reply, z);
      const g = (await pool.query("select liegenschaft_id from gebaeude where id=$1", [req.params.id])).rows[0];
      if (!g) return verweigert(reply, 404); // zwischen Zugriffspruefung und Einfuegen geloescht
      const daten = req.body;
      if (!Buffer.isBuffer(daten)) return reply.code(400).send({ fehler: daten === undefined || daten === null ? "leer" : "typ_unbekannt" });
      const t = erkenneTyp(daten);
      if (!t.ok) return reply.code(400).send({ fehler: t.grund });
      let name = "Dokument";
      try { name = bereinigeDateiname(decodeURIComponent(String(req.headers["x-dateiname"] ?? ""))) || name; } catch { /* Standardname */ }
      const sha = createHash("sha256").update(daten).digest("hex");
      const vorhanden = await bestehendes(req.params.id, sha);
      if (vorhanden) return reply.code(200).send(vorhanden);
      const id = randomUUID();
      const objekt = `dokument:${id}`;
      const seiten = t.typ.art === "pdf" ? zaehleSeiten(daten) : null;
      const kategorie = startKategorie(t.typ.art);
      // Uebergang bis Task 3: direkt in die Ablage, scan_status 'sauber'. Task 3 ersetzt diesen Block durch die Quarantaene.
      // Datei und Referenz werden in eigener Transaktion committet, das Dokument danach; scheitert das Einfuegen
      // (z. B. paralleler Upload derselben Datei), wird die Referenz wieder freigegeben.
      const d = await speichereUndReferenziere(pool, app.ablage, Readable.from(daten), objekt);
      try {
        await inTx(pool, "begin", async (c) => {
          await c.query(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status, art, mime, kategorie, scan_status, gescannt_am)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'aus',$10,$11,$12,'sauber',now())`,
            [id, req.params.id, g.liegenschaft_id, name, d.schluessel, d.sha256, d.groesse, seiten, k.benutzerId, t.typ.art, t.typ.mime, kategorie]);
          await auditEreignis(c, k.auditId, "dokument.abgelegt", { gebaeudeId: req.params.id, dokumentId: id, groesse: d.groesse, art: t.typ.art });
        });
      } catch (e) {
        await mitClient(pool, (c) => gibReferenzFrei(c, d.schluessel, objekt)).catch(() => {});
        const dup = await bestehendes(req.params.id, sha);
        if (dup) return reply.code(200).send(dup);
        throw e;
      }
      return reply.code(201).send(await zeile(req.params.id, id));
    });

    scope.get<{ Params: { id: string } }>("/api/dokumente/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) =>
      inTx(pool, "begin isolation level repeatable read read only", async (c) => {
        const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
        if (z !== 200) return verweigert(reply, z);
        return { dokumente: await ladeAblage(c, req.params.id), bauteile: await ladeAblageBauteile(c, req.params.id),
          darfAendern: (await zugriff(c, req.kontext!.benutzerId, req.params.id, true)) === 200 };
      }));

    scope.get<{ Params: { id: string }; Querystring: { download?: "1" } }>("/api/dokumente/:id/datei",
      { schema: { params: ID_PARAMS, querystring: DATEI_QUERY } }, async (req, reply) => {
        const z = await mitClient(pool, (c) => zugriffDokument(c, req.kontext!.benutzerId, req.params.id, false));
        if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
        const r = (await pool.query("select dateiname, schluessel, art, mime, scan_status from dokument where id=$1", [req.params.id])).rows[0];
        if (!r) return verweigert(reply, 404);
        // Spec 4.7: nicht sauber liefert nie Bytes, auch nicht an den Admin.
        if (r.scan_status !== "sauber") return reply.code(409).send({ fehler: "nicht_sauber" });
        const anhang = req.query.download === "1" || r.art === "office";
        return reply.type(r.mime)
          .header("x-content-type-options", "nosniff")
          .header("cache-control", "private, no-store")
          .header("content-disposition", `${anhang ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(r.dateiname)}`)
          .send(app.ablage.lese(r.schluessel));
      });

    scope.delete<{ Params: { id: string } }>("/api/dokumente/:id", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient(pool, (c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      await inTx(pool, "begin", async (c) => {
        await loescheDokument(c, req.params.id);
        await auditEreignis(c, k.auditId, "dokument.geloescht", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id });
      });
      return reply.code(204).send();
    });
  });
}
