import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { erzeugeRelease, kanonisch, migrationsPruefsummen, pruefeForm, pruefeKompatibilitaet, pruefeRelease, rueckwegMitAltemImage, signiereRelease, ReleaseFehler, type Release } from "../src/betrieb/release.js";
import { MANIFEST, MANIFEST_VERSION } from "../src/module/manifest.js";

const MIGRATIONEN = fileURLToPath(new URL("../src/db/migrationen", import.meta.url));
// Wegwerf-Schluessel pro Testlauf; echte Release-Schluessel liegen ausserhalb des Repos.
const paar = () => {
  const k = generateKeyPairSync("ed25519");
  return { privat: k.privateKey.export({ type: "pkcs8", format: "pem" }) as string, oeffentlich: k.publicKey.export({ type: "spki", format: "pem" }) as string };
};
const ID = (z: string) => `sha256:${z.repeat(64)}`;
const neuesRelease = (ueber: Partial<Parameters<typeof erzeugeRelease>[0]> = {}) => erzeugeRelease({
  version: "1.1.0", architektur: "amd64", migrationsVerzeichnis: MIGRATIONEN, modulmanifestVersion: MANIFEST_VERSION,
  images: [
    { dienst: "app", referenz: "planora-app:1.1.0", digest: null, imageId: ID("a"), architektur: "amd64", archiv: "images/app.tar" },
    { dienst: "db", referenz: `postgres:18.6-bookworm@${ID("b")}`, digest: ID("b"), imageId: ID("c"), architektur: "amd64" },
  ],
  jobTypen: MANIFEST.flatMap((m) => m.jobs), vonVersionen: ["1.0.0"], schemaVorher: ["007_ablage.sql"], rueckwegAltesImage: ["1.0.0"], ...ueber,
});

describe("Release-Manifest", () => {
  it("enthaelt die Angaben aus Spec §3 und die Matrix aus §8.1", () => {
    const r = neuesRelease();
    expect(r.version).toBe("1.1.0");
    expect(r.images.map((i) => i.dienst)).toEqual(["app", "db"]);
    expect(r.migrationen.map((m) => m.name)).toEqual(migrationsPruefsummen(MIGRATIONEN).map((m) => m.name));
    expect(r.schemaVersion).toBe(r.migrationen.at(-1)!.name);
    expect(r.modulmanifestVersion).toBe(MANIFEST_VERSION);
    expect(r.jobPayloadVersionen["erfassung.excel-import"]).toBe(1);
    expect(r.mindestvorgaenger).toBe("1.0.0");
    expect(r.matrix).toMatchObject({ vonVersionen: ["1.0.0"], schemaVorher: ["007_ablage.sql"], schemaNachher: r.schemaVersion, rueckwegAltesImage: ["1.0.0"], nichttransaktionaleSchritte: [] });
  });
  it("Pruefsummen stimmen mit dem Migrator ueberein (sha256 ueber den Dateiinhalt)", () => {
    const m = migrationsPruefsummen(MIGRATIONEN);
    expect(m[0].name).toBe("001_basis.sql");
    expect(m.every((x) => /^[0-9a-f]{64}$/.test(x.sha256))).toBe(true);
  });
  it("kanonische Form ist unabhaengig von der Schluesselreihenfolge", () => {
    expect(kanonisch({ b: 1, a: [{ d: null, c: "x" }] })).toBe('{"a":[{"c":"x","d":null}],"b":1}');
    expect(kanonisch({ a: 1, b: 2 })).toBe(kanonisch({ b: 2, a: 1 }));
  });
  it("lehnt latest, fehlende Tags, fremde Archivpfade und falsche Image-IDs ab", () => {
    const basis = neuesRelease();
    const mit = (aend: (r: any) => void) => { const k = structuredClone(basis) as any; aend(k); return () => pruefeForm(k); };
    expect(mit((r) => { r.images[0].referenz = "planora-app:latest"; })).toThrow(/latest/);
    expect(mit((r) => { r.images[0].referenz = "planora-app"; })).toThrow(/Tag/);
    expect(mit((r) => { r.images[0].archiv = "../../etc/passwd"; })).toThrow(/archiv/);
    expect(mit((r) => { r.images[0].archiv = "/tmp/app.tar"; })).toThrow(/archiv/);
    expect(mit((r) => { r.images[0].imageId = "abc"; })).toThrow(/imageId/);
    expect(mit((r) => { r.images = r.images.slice(1); })).toThrow(/app-Image/);
    expect(mit((r) => { r.images[1].architektur = "arm64"; })).toThrow(/Architektur/);
    expect(mit((r) => { r.matrix.rueckwegAltesImage = ["0.9.0"]; })).toThrow(/rueckwegAltesImage/);
    expect(mit((r) => { r.schemaVersion = "001_basis.sql"; })).toThrow(/schemaVersion/);
  });
});

describe("Signatur (Ed25519)", () => {
  it("signiert und prueft; Ergebnis ist das unveraenderte Manifest", () => {
    const k = paar(); const r = neuesRelease();
    const datei = JSON.stringify(signiereRelease(r, k.privat), null, 2);
    expect(pruefeRelease(datei, k.oeffentlich)).toEqual(r);
    expect(JSON.parse(datei).schluesselId).toMatch(/^[0-9a-f]{16}$/);
  });
  it("manipuliertes Manifest → Fehler (jede einzelne Aenderung)", () => {
    const k = paar(); const s = signiereRelease(neuesRelease(), k.privat);
    const aenderungen: ((r: Release) => void)[] = [
      (r) => { r.version = "9.9.9"; },
      (r) => { r.images[0].imageId = ID("f"); },
      (r) => { r.images[0].referenz = "boese-app:1.1.0"; },
      (r) => { r.migrationen[0].sha256 = "0".repeat(64); },
      (r) => { r.matrix.vonVersionen.push("0.1.0"); },
      (r) => { r.matrix.rueckwegAltesImage = []; },
    ];
    for (const aendere of aenderungen) {
      const kopie = structuredClone(s); aendere(kopie.release);
      expect(() => pruefeRelease(JSON.stringify(kopie), k.oeffentlich)).toThrow(/Signatur/);
    }
  });
  it("fremder Schluessel, fehlende oder kaputte Signatur, kein JSON → Fehler", () => {
    const k = paar(); const fremd = paar(); const s = signiereRelease(neuesRelease(), k.privat);
    expect(() => pruefeRelease(JSON.stringify(s), fremd.oeffentlich)).toThrow(/Signatur/);
    expect(() => pruefeRelease(JSON.stringify({ release: s.release }), k.oeffentlich)).toThrow(/ohne Signatur/);
    expect(() => pruefeRelease(JSON.stringify({ ...s, signatur: "AAAA" }), k.oeffentlich)).toThrow(/Signatur/);
    expect(() => pruefeRelease("kein json", k.oeffentlich)).toThrow(ReleaseFehler);
    expect(() => pruefeRelease(JSON.stringify(s), "kein schluessel")).toThrow(/Schluessel/);
  });
  it("nimmt nur Ed25519-Schluessel an", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(() => signiereRelease(neuesRelease(), rsa.privateKey.export({ type: "pkcs8", format: "pem" }) as string)).toThrow(/Ed25519/);
  });
  it("mit eigenem Schluessel neu signiertes, veraendertes Manifest scheitert am Vertrauensanker", () => {
    const k = paar(); const angreifer = paar();
    const boese = signiereRelease(neuesRelease({ version: "6.6.6", vonVersionen: ["1.0.0"] }), angreifer.privat);
    expect(() => pruefeRelease(JSON.stringify(boese), k.oeffentlich)).toThrow(/Signatur/);
  });
});

describe("Kompatibilitaet (§8 Schritt 0, §8.1, §8.2)", () => {
  const r = neuesRelease();
  const alt = r.migrationen.slice(0, 7);
  const ist = { version: "1.0.0", schemaVersion: "007_ablage.sql", architektur: "amd64", migrationen: alt };
  it("N-1 → N ist erlaubt", () => { expect(pruefeKompatibilitaet(r, ist)).toEqual([]); });
  it("falsche Architektur, nicht unterstuetzter Vorgaenger, fremdes Schema, gleiche Version werden abgelehnt", () => {
    expect(pruefeKompatibilitaet(r, { ...ist, architektur: "arm64" })[0]).toMatch(/Architektur/);
    expect(pruefeKompatibilitaet(r, { ...ist, version: "0.9.0" })[0]).toMatch(/Ausgangs-Release 0.9.0/);
    expect(pruefeKompatibilitaet(r, { ...ist, schemaVersion: "005_sitzung.sql" })[0]).toMatch(/Schema-Version/);
    expect(pruefeKompatibilitaet(r, { ...ist, version: "1.1.0" })[0]).toMatch(/bereits installiert/);
  });
  it("veraenderte oder fehlende bereits angewendete Migration wird vor dem Update erkannt", () => {
    expect(pruefeKompatibilitaet(r, { ...ist, migrationen: [{ ...alt[0], sha256: "1".repeat(64) }, ...alt.slice(1)] })[0]).toMatch(/Pruefsumme der Migration 001_basis.sql/);
    expect(pruefeKompatibilitaet(r, { ...ist, migrationen: [...alt, { name: "007a_hotfix.sql", sha256: "2".repeat(64) }] })[0]).toMatch(/007a_hotfix.sql fehlt/);
  });
  it("Rueckweg mit altem Image nur laut Matrix", () => {
    expect(rueckwegMitAltemImage(r, "1.0.0")).toBe(true);
    expect(rueckwegMitAltemImage(neuesRelease({ rueckwegAltesImage: [] }), "1.0.0")).toBe(false);
  });
});
