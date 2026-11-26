import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { ID_PARAMS } from "../welt/schema.js";
import { mitClient, verweigert, zugriff } from "../rechte/zugriff.js";

/** Optionsmodul suche (Routen /api/suche/, Spec Suche und Ablage 2026-11-26). Der Modul-Guard liefert 404, solange es aus ist. */
export function registriereSucheRouten(app: FastifyInstance, pool: pg.Pool) {
  app.register(async (scope) => {
    scope.get<{ Params: { id: string } }>("/api/suche/gebaeude/:id/status", { schema: { params: ID_PARAMS } }, async (req, reply) => {
      const z = await mitClient(pool, (c) => zugriff(c, req.kontext!.benutzerId, req.params.id, false));
      if (z !== 200) return verweigert(reply, z);
      return { ki: "aus" as const };
    });
  });
}
