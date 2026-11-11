// M1-Abnahme Punkt 2: Pruefung, Ablage und Rotation des Kunden-Zertifikats. CA und Schluessel entstehen zur Laufzeit.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KUNDENZERTIFIKAT_TLS, legeKundenzertifikatAb, pruefeKundenzertifikat, rotiereKundenzertifikat, fingerprint } from "../src/betrieb/install/zertifikat.js";
import { planeInstanz } from "../src/betrieb/install/plan.js";
import { findeOpenssl, testCa, type TestCa } from "./hilfe/test-ca.js";

const openssl = findeOpenssl();
const DOMAIN = "planora.kunde.test";

describe.skipIf(!openssl)("Kunden-Zertifikat", () => {
  let ca: TestCa, fremd: TestCa, dir: string;
  let gut: ReturnType<TestCa["ausstellen"]>, zweit: ReturnType<TestCa["ausstellen"]>, falscherName: ReturnType<TestCa["ausstellen"]>, fremdAusgestellt: ReturnType<TestCa["ausstellen"]>;
  beforeAll(() => {
    ca = testCa(openssl!); fremd = testCa(openssl!, "Fremde CA");
    gut = ca.ausstellen("gut"); zweit = ca.ausstellen("zweit"); falscherName = ca.ausstellen("anderer", { dns: ["andere.kunde.test"] });
    fremdAusgestellt = fremd.ausstellen("fremd");
    dir = mkdtempSync(join(tmpdir(), "planora-kundenzert-"));
  });
  afterAll(() => { ca?.aufraeumen(); fremd?.aufraeumen(); if (dir) rmSync(dir, { recursive: true, force: true }); });

  it("akzeptiert passendes Paar, meldet Laufzeit und warnt unter 30 Tagen", () => {
    const i = pruefeKundenzertifikat(gut.certPem, gut.keyPem, DOMAIN);
    expect(i.kette).toBe(1);
    expect(i.restTage).toBeGreaterThanOrEqual(18);
    expect(i.warnungen[0]).toMatch(/laeuft in \d+ Tagen ab/); // Testzertifikat 20 Tage
    expect(i.fingerprint256).toBe(fingerprint(gut.certPem));
    // Grossschreibung der Domain egal
    expect(() => pruefeKundenzertifikat(gut.certPem, gut.keyPem, "PLANORA.kunde.test")).not.toThrow();
  });
  it("Kette mit Zwischenzertifikat: CA nach dem Blatt wird geprueft; falsche Reihenfolge abgelehnt", () => {
    expect(pruefeKundenzertifikat(gut.certPem + ca.caPem, gut.keyPem, DOMAIN).kette).toBe(2);
    expect(() => pruefeKundenzertifikat(ca.caPem + gut.certPem, gut.keyPem, DOMAIN)).toThrow(/CA-Zertifikat/);
    expect(() => pruefeKundenzertifikat(gut.certPem + fremd.caPem, gut.keyPem, DOMAIN)).toThrow(/kette unterbrochen/);
  });
  it("lehnt falschen Schluessel, falschen Namen, Ablauf, Schluessel in der Zertifikatsdatei und Unlesbares ab", () => {
    expect(() => pruefeKundenzertifikat(gut.certPem, zweit.keyPem, DOMAIN)).toThrow(/passt nicht/);
    expect(() => pruefeKundenzertifikat(falscherName.certPem, falscherName.keyPem, DOMAIN)).toThrow(/gilt nicht fuer/);
    expect(() => pruefeKundenzertifikat(gut.certPem, gut.keyPem, DOMAIN, new Date(Date.now() + 40 * 86_400_000))).toThrow(/abgelaufen/);
    expect(() => pruefeKundenzertifikat(gut.certPem, gut.keyPem, DOMAIN, new Date(Date.now() - 2 * 86_400_000))).toThrow(/noch nicht gueltig/);
    expect(() => pruefeKundenzertifikat(gut.certPem + gut.keyPem, gut.keyPem, DOMAIN)).toThrow(/privaten Schluessel/);
    expect(() => pruefeKundenzertifikat("kein pem", gut.keyPem, DOMAIN)).toThrow(/kein PEM/);
    expect(() => pruefeKundenzertifikat(gut.certPem, "kein key", DOMAIN)).toThrow(/nicht lesbar/);
  });
  it("Installationsplan setzt PLANORA_TLS auf die Container-Pfade", () => {
    expect(planeInstanz({ instanz: "kunde-a", domain: DOMAIN, tls: "kundenzertifikat" }).tlsWert).toBe(KUNDENZERTIFIKAT_TLS);
  });
  // Paar = Schluessel + Kette in einer Datei; Kette und Schluessel daraus wieder lesbar und zueinander passend.
  const paar = (v: string) => readFileSync(join(v, "paar.pem"), "utf8");
  const enthaelt = (v: string, z: { certPem: string; keyPem: string }) => paar(v).includes(z.certPem.trim()) && paar(v).includes(z.keyPem.trim());
  it("Ablage: Kette und Schluessel als ein Paar (paar.pem), wieder pruefbar; Fehler laesst nichts zurueck", () => {
    const v = join(dir, "ablage");
    expect(() => legeKundenzertifikatAb(v, gut.certDatei, zweit.keyDatei, DOMAIN)).toThrow(/passt nicht/);
    expect(existsSync(v)).toBe(false);
    legeKundenzertifikatAb(v, gut.certDatei, gut.keyDatei, DOMAIN);
    expect(enthaelt(v, gut)).toBe(true);
    // Wie Caddy: Zertifikat und Schluessel aus derselben Datei laden
    const p = paar(v), schluessel = p.slice(0, p.indexOf("-----BEGIN CERTIFICATE-----"));
    expect(pruefeKundenzertifikat(p.slice(p.indexOf("-----BEGIN CERTIFICATE-----")), schluessel, DOMAIN).fingerprint256).toBe(fingerprint(gut.certPem));
    expect(existsSync(join(v, "cert.pem")) || existsSync(join(v, "key.pem"))).toBe(false);
  });
  it("Rotation: ersetzt, startet neu, prueft Auslieferung; ungueltiges Paar aendert nichts", async () => {
    const v = join(dir, "rotation"); legeKundenzertifikatAb(v, gut.certDatei, gut.keyDatei, DOMAIN);
    let ausgeliefert = fingerprint(gut.certPem), neustarts = 0;
    const basis = { verzeichnis: v, domain: DOMAIN, neustart: async () => { neustarts++; ausgeliefert = fingerprint(paar(v).slice(paar(v).indexOf("-----BEGIN CERTIFICATE-----"))); }, pruefe: async (fp: string) => ausgeliefert === fp };
    await expect(rotiereKundenzertifikat({ ...basis, zertifikatDatei: fremdAusgestellt.certDatei, schluesselDatei: gut.keyDatei })).rejects.toThrow(/passt nicht/);
    expect(neustarts).toBe(0);
    expect(enthaelt(v, gut)).toBe(true);
    const r = await rotiereKundenzertifikat({ ...basis, zertifikatDatei: zweit.certDatei, schluesselDatei: zweit.keyDatei });
    expect(r).toMatchObject({ zurueckgerollt: false, fingerprint256: fingerprint(zweit.certPem) });
    expect(enthaelt(v, zweit)).toBe(true);
    expect(readFileSync(join(v, "paar.pem.vorher"), "utf8")).toContain(gut.certPem.trim());
    expect(existsSync(join(v, "wechsel.lock"))).toBe(false);
    expect(neustarts).toBe(1);
  });
  it("Rotation: liefert der Proxy das neue Zertifikat nicht aus, wird das bisherige zurueckgelegt", async () => {
    const v = join(dir, "zurueck"); legeKundenzertifikatAb(v, gut.certDatei, gut.keyDatei, DOMAIN);
    let neustarts = 0;
    await expect(rotiereKundenzertifikat({ verzeichnis: v, domain: DOMAIN, zertifikatDatei: zweit.certDatei, schluesselDatei: zweit.keyDatei,
      neustart: async () => { neustarts++; }, pruefe: async () => false })).rejects.toThrow(/wiederhergestellt/);
    expect(enthaelt(v, gut)).toBe(true);
    expect(neustarts).toBe(2);
  });
  it("PP11a-5: werfender Neustart nach dem Ersatz rollt das ganze Paar zurueck und startet erneut", async () => {
    const v = join(dir, "neustart-wirft"); legeKundenzertifikatAb(v, gut.certDatei, gut.keyDatei, DOMAIN);
    const aufrufe: string[] = [];
    await expect(rotiereKundenzertifikat({ verzeichnis: v, domain: DOMAIN, zertifikatDatei: zweit.certDatei, schluesselDatei: zweit.keyDatei,
      neustart: async () => { aufrufe.push(paar(v).includes(zweit.certPem.trim()) ? "neu" : "alt"); if (aufrufe.length === 1) throw new Error("docker restart Exit 1"); },
      pruefe: async () => true })).rejects.toThrow(/docker restart Exit 1; bisheriges Zertifikat wiederhergestellt/);
    expect(aufrufe).toEqual(["neu", "alt"]);
    expect(enthaelt(v, gut)).toBe(true);
    expect(paar(v)).not.toContain(zweit.keyPem.trim());
    expect(existsSync(join(v, "wechsel.lock"))).toBe(false);
    // Auch der Rueckroll-Neustart scheitert: Paar ist trotzdem das bisherige, Fehler nennt beides.
    await expect(rotiereKundenzertifikat({ verzeichnis: v, domain: DOMAIN, zertifikatDatei: zweit.certDatei, schluesselDatei: zweit.keyDatei,
      neustart: async () => { throw new Error("Engine weg"); }, pruefe: async () => true })).rejects.toThrow(/Engine weg; bisheriges Zertifikat zurueckgelegt, Proxy-Neustart fehlgeschlagen/);
    expect(enthaelt(v, gut)).toBe(true);
  });
  it("PP11a-5: gleichzeitige Rotation wird durch die Wechselsperre abgewiesen", async () => {
    const v = join(dir, "parallel"); legeKundenzertifikatAb(v, gut.certDatei, gut.keyDatei, DOMAIN);
    let freigeben!: () => void;
    const erste = rotiereKundenzertifikat({ verzeichnis: v, domain: DOMAIN, zertifikatDatei: zweit.certDatei, schluesselDatei: zweit.keyDatei,
      neustart: () => new Promise<void>((ok) => { freigeben = ok; }), pruefe: async () => true });
    await new Promise((r) => setTimeout(r, 20));
    await expect(rotiereKundenzertifikat({ verzeichnis: v, domain: DOMAIN, zertifikatDatei: gut.certDatei, schluesselDatei: gut.keyDatei, neustart: async () => {}, pruefe: async () => true })).rejects.toThrow(/laeuft bereits/);
    freigeben(); await erste;
    expect(enthaelt(v, zweit)).toBe(true);
  });
  it("Rotation ohne installiertes Kunden-Zertifikat wird abgelehnt", async () => {
    const v = join(dir, "leer");
    await expect(rotiereKundenzertifikat({ verzeichnis: v, domain: DOMAIN, zertifikatDatei: gut.certDatei, schluesselDatei: gut.keyDatei, neustart: async () => {}, pruefe: async () => true })).rejects.toThrow(/Kein Kunden-Zertifikat/);
  });
});
