import type pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { Ablage } from "../ablage/ablage.js";
import type { FastifyInstance, FastifyReply } from "fastify";
import { ID_PARAMS } from "../welt/schema.js";
import { FachFehler } from "../welt/speicher.js";
import { auditEreignis } from "../audit/audit.js";
import { inTx, mitClient, verweigert, zugriff, zugriffDokument } from "../rechte/zugriff.js";
import { MAX_BYTES, erkenneTyp, startKategorie, type Kategorie } from "./typ.js";
import { zaehleSeiten } from "./pdf.js";
import { ABLEGEN_QUERY, BAUTEILE_SCHEMA, DATEI_QUERY, KATEGORIE_SCHEMA, ORT_SCHEMA } from "./schema.js";
import { KEIN_ORT, ergaenzeOrt, ergaenzeVerknuepfungen, ladeAblage, ladeAblageBauteile, ladeAblageOrte, loescheDokument, pruefeBauteile, pruefeOrt, setzeOrt, setzeVerknuepfungen, type Ort } from "./speicher.js";
import { raeumeQuarantaeneKopie, type Pruefer } from "./pruefer.js";

/** Entfernt Steuer- und Bidi-Zeichen (Anzeige-Taeuschung, z. B. U+202E) und begrenzt auf 255 Zeichen. */
export function bereinigeDateiname(name: string): string {
  return name.replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim().slice(0, 255);
}

export function registriereDokumentRouten(app: FastifyInstance, pool: pg.Pool, o: { pruefer: Pruefer; quarantaene: Ablage }) {
  const zeile = async (gebaeudeId: string, id: string) => (await mitClient(pool, (c) => ladeAblage(c, gebaeudeId, id)))[0];
  const bestehendes = async (gebaeudeId: string, sha: string) => {
    const r = (await pool.query("select id from dokument where gebaeude_id=$1 and sha256=$2", [gebaeudeId, sha])).rows[0];
    return r ? zeile(gebaeudeId, r.id) : null;
  };

  // Duplikat: Bauteile werden zusaetzlich verknuepft (Vereinigung), der Ort nur ergaenzt (nie ueberschrieben). Bei abgelehnt nichts Neues.
  const ergaenzeUndLade = async (gebaeudeId: string, z: { id: string }, ids: string[], ort: Ort = KEIN_ORT) => {
    if (!ids.length && !ort.geschossId && !ort.einheitId && !ort.allgemein) return z;
    await inTx(pool, "begin", async (c) => { await ergaenzeVerknuepfungen(c, z.id, ids); await ergaenzeOrt(c, z.id, ort); }); // sperrt die Zeile, prueft abgelehnt atomar
    return zeile(gebaeudeId, z.id);
  };
  const fachlich = async <T>(reply: FastifyReply, f: () => Promise<T>) => {
    try { return await f(); } catch (e) { if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler }); throw e; }
  };

  app.register(async (scope) => {
    // Rohe Bytes in einem Request (ADR 0016 Nachtrag, kein Multipart). Typ kommt aus den Magic Bytes, nie aus Content-Type oder Endung.
    scope.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: MAX_BYTES + 1024 }, (_req, body, done) => done(null, body));

    scope.post<{ Params: { id: string }; Querystring: { kategorie?: Kategorie; bauteile?: string; geschoss?: string; einheit?: string; allgemein?: "1" } }>("/api/dokumente/gebaeude/:id", { schema: { params: ID_PARAMS, querystring: ABLEGEN_QUERY } }, async (req, reply) => {
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
      // Spec 4.1: ?bauteile verknuepft sofort (auch in Quarantaene); bei Befund entfernt der Pruefer die Verknuepfungen.
      let verknuepfen: string[] = []; let ort: Ort = KEIN_ORT;
      try {
        ({ verknuepfen, ort } = await mitClient(pool, async (c) => ({
          verknuepfen: await pruefeBauteile(c, req.params.id, req.query.bauteile ? req.query.bauteile.split(",") : []),
          ort: await pruefeOrt(c, req.params.id, { geschossId: req.query.geschoss ?? null, einheitId: req.query.einheit ?? null, allgemein: req.query.allgemein === "1" }),
        })));
      } catch (e) { if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler }); throw e; }
      const sha = createHash("sha256").update(daten).digest("hex");
      const vorhanden = await bestehendes(req.params.id, sha);
      if (vorhanden) {
        // W3: haengende oder fehlgeschlagene Pruefung (z. B. Kopie nach Restore weg): Kopie aus den neuen Bytes, Pruefung neu.
        if (vorhanden.scanStatus === "scan_fehler" || vorhanden.scanStatus === "quarantaene") {
          const x = await o.quarantaene.schreibeNeu(Readable.from(daten));
          const neu = await pool.query("update dokument set scan_status='quarantaene', scan_grund=null, schluessel=$2 where id=$1 and scan_status in ('scan_fehler','quarantaene') returning id",
            [vorhanden.id, x.schluessel]);
          if (!neu.rowCount) await raeumeQuarantaeneKopie(pool, o.quarantaene, x.schluessel); // inzwischen sauber, abgelehnt oder geloescht
          return fachlich(reply, async () => {
            const antwort = await ergaenzeUndLade(req.params.id, (await zeile(req.params.id, vorhanden.id)) ?? vorhanden, verknuepfen, ort);
            if (neu.rowCount) o.pruefer.starte(vorhanden.id); // erst nach dem Laden: gemeldeter Status unabhaengig vom Timing
            return reply.code(200).send(antwort);
          });
        }
        return fachlich(reply, async () => reply.code(200).send(await ergaenzeUndLade(req.params.id, vorhanden, verknuepfen, ort)));
      }
      const id = randomUUID();
      const seiten = t.typ.art === "pdf" ? zaehleSeiten(daten) : null;
      const kategorie = req.query.kategorie ?? startKategorie(t.typ.art, name);
      // Spec 4.3: Bytes zuerst nur in die Quarantaene; Ablage und Datei-Referenz erst nach sauberem Scan (pruefer.ts).
      const x = await o.quarantaene.schreibeNeu(Readable.from(daten));
      try {
        await inTx(pool, "begin", async (c) => {
          await c.query(`insert into dokument(id, gebaeude_id, liegenschaft_id, dateiname, schluessel, sha256, groesse, seiten, hochgeladen_von, auslesen_status, art, mime, kategorie, scan_status)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'aus',$10,$11,$12,'quarantaene')`,
            [id, req.params.id, g.liegenschaft_id, name, x.schluessel, x.sha256, x.groesse, seiten, k.benutzerId, t.typ.art, t.typ.mime, kategorie]);
          await setzeVerknuepfungen(c, id, verknuepfen);
          await setzeOrt(c, id, ort);
          await auditEreignis(c, k.auditId, "dokument.abgelegt", { gebaeudeId: req.params.id, dokumentId: id, groesse: x.groesse, art: t.typ.art });
        });
      } catch (e) {
        const dup = await bestehendes(req.params.id, sha);
        if (dup) { // paralleler Upload gleichen Inhalts; Kopie nur behalten, solange ein ungeprueftes Dokument sie braucht (G6)
          await raeumeQuarantaeneKopie(pool, o.quarantaene, x.schluessel);
          return fachlich(reply, async () => reply.code(200).send(await ergaenzeUndLade(req.params.id, dup, verknuepfen, ort)));
        }
        await raeumeQuarantaeneKopie(pool, o.quarantaene, x.schluessel);
        if (e instanceof FachFehler) return reply.code(e.status).send({ fehler: e.fehler }); // z. B. Bauteil zwischen Pruefung und Einfuegen geloescht
        throw e;
      }
      // Antwortzeile vor dem Start laden: sonst hinge der gemeldete Status vom Timing der Pruefung ab.
      const antwort = await zeile(req.params.id, id);
      o.pruefer.starte(id);
      return reply.code(201).send(antwort);
    });

    scope.get<{ Params: { id: string } }>("/api/dokumente/gebaeude/:id", { schema: { params: ID_PARAMS } }, async (req, reply) =>
      inTx(pool, "begin isolation level repeatable read read only", async (c) => {
        const z = await zugriff(c, req.kontext!.benutzerId, req.params.id, false);
        if (z !== 200) return verweigert(reply, z);
        return { dokumente: await ladeAblage(c, req.params.id), bauteile: await ladeAblageBauteile(c, req.params.id), ...(await ladeAblageOrte(c, req.params.id)),
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
          // G1: bei direktem Aufruf (Lesezeichen, geteilter Link) laeuft im eingebauten PDF-Viewer kein Skript; fetch/img sind nicht betroffen.
          .header("content-security-policy", "sandbox; default-src 'none'")
          .header("content-disposition", `${anhang ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(r.dateiname)}`)
          .send(app.ablage.lese(r.schluessel));
      });

    scope.delete<{ Params: { id: string } }>("/api/dokumente/:id", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient(pool, (c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      const weg = await inTx(pool, "begin", async (c) => {
        const r = await loescheDokument(c, req.params.id);
        if (r) await auditEreignis(c, k.auditId, "dokument.geloescht", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id }); // paralleles Loeschen war schneller -> kein Audit
        return r;
      });
      if (!weg) return verweigert(reply, 404);
      if (weg.scanStatus !== "sauber") await raeumeQuarantaeneKopie(pool, o.quarantaene, weg.schluessel);
      return reply.code(204).send();
    });

    scope.put<{ Params: { id: string }; Body: { bauteilIds: string[] } }>("/api/dokumente/:id/bauteile",
      { schema: { params: ID_PARAMS, body: BAUTEILE_SCHEMA } }, async (req, reply) => {
        const k = req.kontext!;
        const z = await mitClient(pool, (c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
        if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
        return fachlich(reply, () => inTx(pool, "begin", async (c) => {
          const s = (await c.query("select scan_status from dokument where id=$1 for update", [req.params.id])).rows[0];
          if (!s) throw new FachFehler([{ pfad: "dokument", code: "nicht_gefunden", meldung: "Dokument nicht gefunden" }], 404);
          if (s.scan_status !== "sauber") throw new FachFehler([{ pfad: "dokument", code: "nicht_sauber", meldung: "Erst nach der Virenprüfung verknüpfbar" }], 409);
          const ids = await pruefeBauteile(c, z.gebaeudeId, req.body.bauteilIds);
          await setzeVerknuepfungen(c, req.params.id, ids);
          await auditEreignis(c, k.auditId, "dokument.verknuepft", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id, anzahl: ids.length });
          return (await ladeAblage(c, z.gebaeudeId, req.params.id))[0];
        }));
      });

    scope.put<{ Params: { id: string }; Body: { kategorie: Kategorie } }>("/api/dokumente/:id/kategorie",
      { schema: { params: ID_PARAMS, body: KATEGORIE_SCHEMA } }, async (req, reply) => {
        const k = req.kontext!;
        const z = await mitClient(pool, (c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
        if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
        const r = await inTx(pool, "begin", async (c) => {
          const u = await c.query("update dokument set kategorie=$2 where id=$1 and scan_status <> 'abgelehnt' returning id", [req.params.id, req.body.kategorie]);
          if (u.rowCount) await auditEreignis(c, k.auditId, "dokument.kategorie", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id, kategorie: req.body.kategorie });
          return u.rowCount ? (await ladeAblage(c, z.gebaeudeId, req.params.id))[0] : null;
        });
        return r ?? reply.code(409).send({ fehler: "abgelehnt" });
      });

    scope.put<{ Params: { id: string }; Body: Ort }>("/api/dokumente/:id/ort", { schema: { params: ID_PARAMS, body: ORT_SCHEMA } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient(pool, (c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      return fachlich(reply, () => inTx(pool, "begin", async (c) => {
        const s = (await c.query("select scan_status from dokument where id=$1 for update", [req.params.id])).rows[0];
        if (!s) throw new FachFehler([{ pfad: "dokument", code: "nicht_gefunden", meldung: "Dokument nicht gefunden" }], 404);
        if (s.scan_status === "abgelehnt") throw new FachFehler([{ pfad: "dokument", code: "abgelehnt", meldung: "Abgelehnte Dateien lassen sich nicht ändern" }], 409);
        await setzeOrt(c, req.params.id, await pruefeOrt(c, z.gebaeudeId, req.body));
        await auditEreignis(c, k.auditId, "dokument.ort", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id });
        return (await ladeAblage(c, z.gebaeudeId, req.params.id))[0];
      }));
    });

    scope.post<{ Params: { id: string } }>("/api/dokumente/:id/erneut-pruefen", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const k = req.kontext!;
      const z = await mitClient(pool, (c) => zugriffDokument(c, k.benutzerId, req.params.id, true));
      if (z.code !== 200) return verweigert(reply, z.code as 403 | 404);
      const ok = await inTx(pool, "begin", async (c) => {
        const r = await c.query("update dokument set scan_status='quarantaene', scan_grund=null where id=$1 and scan_status='scan_fehler' returning id", [req.params.id]);
        if (r.rowCount) await auditEreignis(c, k.auditId, "dokument.erneut_pruefen", { gebaeudeId: z.gebaeudeId, dokumentId: req.params.id });
        return !!r.rowCount;
      });
      if (!ok) return reply.code(409).send({ fehler: "nicht_scan_fehler" });
      const antwort = await zeile(z.gebaeudeId, req.params.id);
      o.pruefer.starte(req.params.id);
      return reply.code(202).send(antwort);
    });
  });
}
