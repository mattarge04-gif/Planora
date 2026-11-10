import pg from "pg";
import { baueServer } from "../server.js";
import type { Stufe } from "../module/manifest.js";
import { beendeBegrenzt, dbKonfig, env, geheimnis, logge, release, starte } from "./konfig.js";

// Einstieg des Containers `api`: Fastify hinter Caddy, einzige DB-Rolle planora_app.
starte(async () => {
  const stufe = Number(env("PLANORA_STUFE", "1"));
  if (![1, 2, 3, 4].includes(stufe)) throw new Error("PLANORA_STUFE muss 1 bis 4 sein");
  const pool = new pg.Pool({ ...dbKonfig("planora_app"), max: Number(env("PLANORA_DB_POOL", "10")) });
  pool.on("error", (e) => logge("db.fehler", { fehler: e.message }));
  // vertrauteProxies: nur Adressen, von denen der eigene Caddy kommt. api hat keinen veroeffentlichten Port, erreichbar
  // ist es nur aus den Compose-Netzen dieser Instanz (compose.yaml setzt deren private Bereiche).
  const vertrauteProxies = env("PLANORA_VERTRAUTE_PROXIES", "").split(",").map((s) => s.trim()).filter(Boolean);
  const app = await baueServer({
    pool, stufe: stufe as Stufe, baseURL: env("PLANORA_BASE_URL"), secret: geheimnis("auth_secret"),
    ablageWurzel: env("PLANORA_ABLAGE", "/daten/dokumente"), vertrauteProxies, release: release(),
  });
  let endet = false;
  const beende = async (signal: string) => {
    if (endet) return; endet = true;
    logge("stopp", { signal });
    // offene Anfragen und haengende DB-Verbindungen hoechstens 10 s abwarten, dann sauber enden (PP9-5)
    const r = await beendeBegrenzt([() => app.close(), () => pool.end()], 10_000);
    logge("beendet", { aufgeraeumt: r === "fertig" });
    process.exit(0);
  };
  process.on("SIGTERM", () => void beende("SIGTERM"));
  process.on("SIGINT", () => void beende("SIGINT"));
  await app.listen({ host: "0.0.0.0", port: Number(env("PLANORA_PORT", "3000")) });
  logge("bereit", { release: release(), stufe });
});
