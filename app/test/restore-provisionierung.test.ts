import { expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { frischeDb } from "./hilfe.js";

it("entfernt temporaere Recovery-Grants, ohne Daten der Eigentuemerrolle zu entfernen", async () => {
  const db = await frischeDb(), id = randomBytes(8).toString("hex");
  const recovery = `r_${id}`, owner = `o_${id}`, migrator = `m_${id}`;
  const c = await db.pool.connect();
  try {
    await c.query(`create role ${recovery} nologin createrole;create role ${owner};create role ${migrator};
      grant ${migrator} to ${recovery} with admin true, inherit false, set false;
      grant pg_read_all_data to ${recovery} with admin true;
      alter database ${db.cfg.database} owner to ${recovery};
      grant usage,create on schema public to ${owner};
      set role ${recovery};grant usage,create on schema public to ${migrator};grant pg_read_all_data to ${migrator};reset role;
      set role ${owner};create table recovery_probe(wert text);insert into recovery_probe values('bleibt');reset role;
      alter database ${db.cfg.database} owner to postgres;`);
    await c.query(`drop owned by ${recovery};drop role ${recovery}`);
    expect((await c.query("select wert from recovery_probe")).rows[0].wert).toBe("bleibt");
  } finally {
    await c.query("reset role");
    await c.query(`alter database ${db.cfg.database} owner to postgres`);
    const rollen = (await c.query("select rolname from pg_roles where rolname=any($1)", [[owner, migrator, recovery]])).rows;
    for (const { rolname } of rollen) await c.query(`drop owned by ${rolname}`);
    for (const { rolname } of rollen) await c.query(`drop role ${rolname}`);
    c.release(); await db.ende();
  }
});
