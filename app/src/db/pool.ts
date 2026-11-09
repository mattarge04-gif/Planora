import pg from "pg";
export function neuerPool(cfg: pg.PoolConfig, rolle?: "planora_app") {
  const pool = new pg.Pool(cfg);
  if (rolle) pool.on("connect", (c) => { c.query(`set role ${rolle}`).catch(() => {}); });
  return pool;
}
