// M1-Abnahme Punkt 2: positiver externer TLS-Nachweis mit Kunden-CA statt `tls internal`.
// Test-CA, fremde CA und Serverzertifikate entstehen zur Laufzeit (openssl) in Temp-Verzeichnissen, nie im Repo.
// Eigenes Compose-Projekt pa-tls, Ports 18400/18401 (PLANORA_TEST_TLS_PROJEKT / ..._HTTPS_PORT / ..._HTTP_PORT).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request } from "node:https";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOCKER_TESTS, baueImage, docker, testInstanz, type TestInstanz } from "./paket-hilfe.js";
import { KUNDENZERTIFIKAT_TLS, ausgeliefertesZertifikat, fingerprint, legeKundenzertifikatAb, rotiereKundenzertifikat } from "../src/betrieb/install/zertifikat.js";
import { findeOpenssl, testCa, type TestCa } from "../test/hilfe/test-ca.js";

const DOMAIN = "planora.kunde.test";
const projekt = process.env.PLANORA_TEST_TLS_PROJEKT ?? "pa-tls";
const httpsPort = Number(process.env.PLANORA_TEST_TLS_HTTPS_PORT ?? 18401), httpPort = Number(process.env.PLANORA_TEST_TLS_HTTP_PORT ?? 18400);

/** HTTPS mit echter Zertifikatspruefung: vertraut ausschliesslich `ca` (kein System-Truststore, wenn ca gesetzt). */
function holeMitCa(pfad: string, ca?: string): Promise<{ status: number; text: string; fingerprint: string }> {
  return new Promise((ok, fehler) => {
    const req = request({ host: "127.0.0.1", port: httpsPort, path: pfad, servername: DOMAIN, ca, rejectUnauthorized: true, timeout: 20_000, headers: { host: `${DOMAIN}:${httpsPort}` }, agent: false }, (res) => {
      const fp = (res.socket as import("node:tls").TLSSocket).getPeerCertificate().fingerprint256;
      let text = ""; res.setEncoding("utf8"); res.on("data", (d) => { text += d; });
      res.on("end", () => ok({ status: res.statusCode ?? 0, text, fingerprint: fp }));
    });
    req.on("timeout", () => req.destroy(new Error("Zeitueberschreitung")));
    req.on("error", fehler); req.end();
  });
}

describe.skipIf(!DOCKER_TESTS)("Kunden-CA statt tls internal (Docker)", () => {
  let inst: TestInstanz | undefined, ca: TestCa, fremd: TestCa, tls: string;
  let gut: ReturnType<TestCa["ausstellen"]>, zweit: ReturnType<TestCa["ausstellen"]>;
  beforeAll(async () => {
    const openssl = findeOpenssl();
    if (!openssl) throw new Error("openssl fehlt (PLANORA_OPENSSL setzen)");
    ca = testCa(openssl); fremd = testCa(openssl, "Fremde CA");
    gut = ca.ausstellen("gut", { dns: [DOMAIN] }); zweit = ca.ausstellen("zweit", { dns: [DOMAIN] });
    tls = mkdtempSync(join(tmpdir(), `${projekt}-tls-`));
    // Gleicher Ablageweg wie `planora install --tls kundenzertifikat`.
    legeKundenzertifikatAb(join(tls, "tls"), gut.certDatei, gut.keyDatei, DOMAIN);
    const image = await baueImage(`planora-app:${projekt}-1`, `${projekt}-1`);
    inst = testInstanz({ image: image.referenz, projekt, httpsPort, httpPort, domain: DOMAIN, tls: KUNDENZERTIFIKAT_TLS, zusatzEnv: { PLANORA_TLS_VERZEICHNIS: join(tls, "tls").replace(/\\/g, "/") } });
    await inst.starte();
  });
  afterAll(async () => {
    await inst?.aufraeumen();
    await docker(["image", "rm", `planora-app:${projekt}-1`], { erlaubeFehler: true });
    ca?.aufraeumen(); fremd?.aufraeumen(); if (tls) rmSync(tls, { recursive: true, force: true });
  });

  it("Client, der nur der Test-Kunden-CA vertraut, erreicht die App (Health 200, erwartetes Zertifikat)", async () => {
    const r = await holeMitCa("/api/health", ca.caPem);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toMatchObject({ ok: true, db: true });
    expect(r.fingerprint).toBe(fingerprint(gut.certPem));
  });
  it("Client mit fremder CA oder nur System-Truststore wird abgelehnt", async () => {
    await expect(holeMitCa("/api/health", fremd.caPem)).rejects.toMatchObject({ code: expect.stringMatching(/UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY|SELF_SIGNED/) });
    await expect(holeMitCa("/api/health")).rejects.toMatchObject({ code: expect.stringMatching(/UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY|SELF_SIGNED/) });
  });
  it("Zertifikat liegt nur lesend im Proxy; keine Caddy-eigene CA fuer die Domain", async () => {
    const r = await inst!.compose(["exec", "-T", "proxy", "sh", "-c", "touch /zertifikat/x 2>/dev/null && echo schreibbar || echo nur-lesend; ls /data/caddy/certificates 2>/dev/null | grep -c local || true"]);
    const [schreiben, lokal] = r.stdout.trim().split(/\r?\n/);
    expect(schreiben).toBe("nur-lesend");
    expect(lokal ?? "0").toBe("0");
  });
  it("Rotation: neues Paar derselben Kunden-CA wird nach Proxy-Neustart ausgeliefert und vertraut", async () => {
    const r = await rotiereKundenzertifikat({ verzeichnis: join(tls, "tls"), domain: DOMAIN, zertifikatDatei: zweit.certDatei, schluesselDatei: zweit.keyDatei,
      neustart: async () => { await inst!.compose(["restart", "proxy"], { timeoutMs: 120_000 }); },
      pruefe: async (fp) => (await ausgeliefertesZertifikat(httpsPort, DOMAIN)) === fp });
    expect(r.zurueckgerollt).toBe(false);
    const h = await holeMitCa("/api/health", ca.caPem);
    expect([h.status, h.fingerprint]).toEqual([200, fingerprint(zweit.certPem)]);
  });
});
