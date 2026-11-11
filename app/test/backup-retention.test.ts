// M1-Abnahme Punkt 3: Retention-Auswahl und Konsistenz von Inventar/Journal/DB (ohne Docker, restic als Fake).
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { STANDARD_POLITIK, aufbewahren, kalender, politikAusUmgebung, waehleBehalten, type Kandidat, type RetentionDb, type Zustand } from "../src/betrieb/backup/retention.js";
import type { Aufruf } from "../src/betrieb/backup/prozess.js";
import type { Ziel } from "../src/betrieb/backup/ziel.js";

const TZ = "Europe/Zurich";
const hex = (n: number) => n.toString(16).padStart(64, "0");
const k = (n: number, iso: string, zustand?: Zustand): Kandidat => ({ snapshotId: hex(n), backupId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, zeit: new Date(iso), zustand });

describe("Politik", () => {
  it("Standard ist der Vorschlag 14/8/12 [A]; Umgebung ueberschreibt einzeln", () => {
    expect(politikAusUmgebung({})).toEqual({ taeglich: 14, woechentlich: 8, monatlich: 12 });
    expect(STANDARD_POLITIK).toEqual({ taeglich: 14, woechentlich: 8, monatlich: 12 });
    expect(politikAusUmgebung({ PLANORA_RETENTION_TAEGLICH: "7", PLANORA_RETENTION_MONATLICH: "0" })).toEqual({ taeglich: 7, woechentlich: 8, monatlich: 0 });
  });
  it("lehnt ungueltige Werte und taeglich 0 ab", () => {
    for (const v of ["-1", "1.5", "x", "99999"]) expect(() => politikAusUmgebung({ PLANORA_RETENTION_WOECHENTLICH: v }), v).toThrow(/ganze Zahl/);
    expect(() => politikAusUmgebung({ PLANORA_RETENTION_TAEGLICH: "0" })).toThrow(/mindestens 1/);
  });
});

describe("Kalender", () => {
  it("rechnet in der Instanz-Zeitzone und mit ISO-Wochen", () => {
    expect(kalender(new Date("2026-11-09T23:30:00Z"), TZ)).toEqual({ tag: "2026-11-10", woche: "2026-W46", monat: "2026-11" });
    expect(kalender(new Date("2026-01-01T12:00:00Z"), TZ).woche).toBe("2026-W01");
    expect(kalender(new Date("2027-01-01T12:00:00Z"), TZ).woche).toBe("2026-W53");
    expect(kalender(new Date("2025-12-29T12:00:00Z"), TZ).woche).toBe("2026-W01");
  });
});

describe("Auswahl", () => {
  it("Standardpolitik ueber 400 Naechte: 14 Tage + 8 Wochen + 12 Monate, ueberlappend gezaehlt", () => {
    const start = Date.parse("2026-11-11T01:00:00Z");
    const alle = Array.from({ length: 400 }, (_, i) => k(i + 1, new Date(start - i * 86_400_000).toISOString(), "geprueft"));
    const { behalten, entfernen } = waehleBehalten(alle, STANDARD_POLITIK, TZ);
    expect(behalten.length + entfernen.length).toBe(400);
    // 14 Tage; Wochen 3..8 und Monate 2..12 kommen hinzu (die juengsten fallen mit bereits behaltenen zusammen)
    expect(behalten.length).toBeGreaterThanOrEqual(14 + 8 - 2 + 12 - 2 - 3);
    expect(behalten.length).toBeLessThanOrEqual(14 + 8 + 12);
    expect(behalten.map((b) => b.snapshotId)).toContain(hex(1));
    const tage = new Set(behalten.map((b) => kalender(b.zeit, TZ).tag));
    expect(tage.size).toBe(behalten.length);
    // aeltester behaltener Satz liegt im 12. Monat
    expect(new Set(behalten.map((b) => kalender(b.zeit, TZ).monat)).size).toBe(12);
  });
  it("je Bereich den juengsten Satz; mehrere Saetze am selben Tag werden ausgeduennt", () => {
    const s = [k(1, "2026-11-10T03:00:00Z", "geprueft"), k(2, "2026-11-10T01:00:00Z", "geprueft"), k(3, "2026-11-09T01:00:00Z", "geprueft"), k(4, "2026-10-05T01:00:00Z", "geprueft"), k(5, "2026-08-01T01:00:00Z", "geprueft")];
    const r = waehleBehalten(s, { taeglich: 2, woechentlich: 1, monatlich: 2 }, TZ);
    expect(r.behalten.map((x) => x.snapshotId)).toEqual([hex(1), hex(3), hex(4)]);
    expect(r.entfernen.map((x) => x.snapshotId)).toEqual([hex(2), hex(5)]);
  });
  it("bevorzugt gepruefte Saetze; fehlgeschlagene nur als einziger Vertreter eines Bereichs", () => {
    const s = [k(1, "2026-11-10T03:00:00Z", "fehlgeschlagen"), k(2, "2026-11-10T01:00:00Z", "geprueft"), k(3, "2026-11-09T01:00:00Z", "fehlgeschlagen")];
    const r = waehleBehalten(s, { taeglich: 2, woechentlich: 0, monatlich: 0 }, TZ);
    expect(r.behalten.map((x) => x.snapshotId)).toEqual([hex(2), hex(3)]);
  });
  it("laufende, gesicherte und unbekannte Saetze werden nie entfernt", () => {
    const s = [k(1, "2026-11-10T03:00:00Z", "geprueft"), k(2, "2025-01-01T01:00:00Z", "laufend"), k(3, "2025-01-02T01:00:00Z", "gesichert"), k(4, "2025-01-03T01:00:00Z")];
    expect(waehleBehalten(s, { taeglich: 1, woechentlich: 0, monatlich: 0 }, TZ).entfernen).toEqual([]);
  });
});

/** Fake-Umgebung: restic-Repository als Liste, Ziel als Map, DB als Map. */
function umgebung(saetze: { n: number; zeit: string; zustand: Zustand; journalSeq: number }[], o: { forgetFehler?: boolean; manifestFehlt?: number; pruneFehler?: number; zaehler?: bigint; ohneSnapshot?: [string, Zustand][] } = {}) {
  const instanzId = randomUUID();
  const repo = saetze.map((s) => ({ ...s, id: hex(s.n), backupId: k(s.n, s.zeit).backupId! }));
  const objekte = new Map<string, Buffer>();
  for (const s of repo) objekte.set(`inventar/${instanzId}/${s.backupId}.age`, Buffer.from("x"));
  for (let seq = 1; seq <= 10; seq++) objekte.set(`journal/${instanzId}/${seq}.age`, Buffer.from("j"));
  objekte.set(`journal/${instanzId}/stand.age`, Buffer.from("s"));
  const zustaende = new Map<string, Zustand>([...repo.map((s) => [s.backupId, s.zustand] as [string, Zustand]), ...(o.ohneSnapshot ?? [])]);
  let pruneFehler = o.pruneFehler ?? 0;
  const aufrufe: string[] = [], protokolle: object[] = [];
  const lauf = async (a: Aufruf) => {
    aufrufe.push(a.args[0]);
    expect(a.env?.RESTIC_PASSWORD).toBe("pw");
    if (a.args[0] === "snapshots") return { code: 0, stdout: JSON.stringify(repo.map((s) => ({ id: s.id, time: s.zeit, tags: [s.backupId], paths: [`/staging/${s.backupId}`] }))) };
    if (a.args[0] === "forget") {
      if (o.forgetFehler) return { code: 1, stdout: "" };
      for (const id of a.args.slice(1)) repo.splice(repo.findIndex((s) => s.id === id), 1);
      return { code: 0, stdout: "" };
    }
    if (a.args[0] === "dump") {
      const s = repo.find((x) => x.id === a.args[1])!;
      if (s.n === o.manifestFehlt) return { code: 1, stdout: "" };
      expect(a.args[2]).toBe(`/staging/${s.backupId}/manifest.json`);
      return { code: 0, stdout: JSON.stringify({ backupId: s.backupId, journalSeq: String(s.journalSeq) }) };
    }
    if (a.args[0] === "prune") return { code: pruneFehler-- > 0 ? 1 : 0, stdout: "" };
    throw new Error(`unerwartet: ${a.args.join(" ")}`);
  };
  const ziel: Ziel = {
    lese: async (s) => objekte.get(s)!, schreibe: async (s, d) => { objekte.set(s, d); return d; },
    liste: async (p) => [...objekte.keys()].filter((x) => x.startsWith(p + "/")).sort(),
    loesche: async (s) => { objekte.delete(s); },
  };
  const db: RetentionDb = {
    journalZaehler: async () => o.zaehler ?? 100n, zustaende: async () => new Map(zustaende), entfernt: async (id) => { zustaende.set(id, "entfernt"); },
    protokoll: async (d) => { protokolle.push(d); }, exklusiv: (arbeit) => arbeit(),
  };
  return { instanzId, repo, objekte, zustaende, aufrufe, protokolle, ausfuehren: (politik = { taeglich: 2, woechentlich: 0, monatlich: 0 }, reserviert: string[] = []) => aufbewahren({ db, ziel, instanzId, resticEnv: { RESTIC_PASSWORD: "pw" }, politik, zeitzone: TZ, lauf, reserviert }) };
}

describe("aufbewahren", () => {
  const saetze = [
    { n: 1, zeit: "2026-11-07T01:00:00Z", zustand: "geprueft" as const, journalSeq: 2 },
    { n: 2, zeit: "2026-11-08T01:00:00Z", zustand: "geprueft" as const, journalSeq: 4 },
    { n: 3, zeit: "2026-11-09T01:00:00Z", zustand: "geprueft" as const, journalSeq: 6 },
    { n: 4, zeit: "2026-11-10T01:00:00Z", zustand: "geprueft" as const, journalSeq: 8 },
  ];
  it("vergisst, raeumt Inventar und DB nach, kuerzt Journal bis zur kleinsten behaltenen Sequenz, prunt und protokolliert", async () => {
    const u = umgebung(saetze);
    const r = await u.ausfuehren();
    expect(u.aufrufe).toEqual(["snapshots", "forget", "dump", "dump", "prune"]);
    expect(u.repo.map((s) => s.n)).toEqual([3, 4]);
    expect(r).toMatchObject({ inventarGeloescht: 2, journalBis: "6", journalGeloescht: 6 });
    const inventare = [...u.objekte.keys()].filter((x) => x.startsWith("inventar/"));
    expect(inventare.sort()).toEqual(u.repo.map((s) => `inventar/${u.instanzId}/${s.backupId}.age`).sort());
    expect([...u.objekte.keys()].filter((x) => x.startsWith("journal/")).sort()).toEqual(["10", "7", "8", "9", "stand"].map((x) => `journal/${u.instanzId}/${x}.age`).sort());
    expect([...u.zustaende.values()]).toEqual(["entfernt", "entfernt", "geprueft", "geprueft"]);
    expect(u.protokolle).toEqual([r]);
  });
  it("ohne zu entfernende Saetze: kein forget, kein prune; zweiter Lauf ist idempotent", async () => {
    const u = umgebung(saetze);
    await u.ausfuehren(); u.aufrufe.length = 0;
    const r = await u.ausfuehren();
    expect(u.aufrufe).toEqual(["snapshots", "dump", "dump"]);
    expect(r).toMatchObject({ entfernt: [], inventarGeloescht: 0, journalGeloescht: 0 });
  });
  it("forget-Fehler: Inventar, Journal und DB bleiben unveraendert", async () => {
    const u = umgebung(saetze, { forgetFehler: true });
    const vorher = [...u.objekte.keys()].sort();
    await expect(u.ausfuehren()).rejects.toThrow(/restic/);
    expect([...u.objekte.keys()].filter((x) => !x.startsWith("retention/")).sort()).toEqual(vorher);
    expect([...u.zustaende.values()].every((z) => z === "geprueft")).toBe(true);
  });
  it("Abgleich nach Abbruch: Satz ohne Snapshot (DB noch geprueft) wird nachgefuehrt", async () => {
    const u = umgebung(saetze);
    const weg = u.repo.shift()!; // forget erfolgreich, danach Abbruch vor Inventar/DB
    await u.ausfuehren({ taeglich: 5, woechentlich: 0, monatlich: 0 });
    expect(u.zustaende.get(weg.backupId)).toBe("entfernt");
    expect(u.objekte.has(`inventar/${u.instanzId}/${weg.backupId}.age`)).toBe(false);
    expect(u.repo).toHaveLength(3);
  });
  it("nicht lesbares Manifest eines behaltenen Satzes: Journal wird nicht gekuerzt", async () => {
    const u = umgebung(saetze, { manifestFehlt: 4 });
    const r = await u.ausfuehren();
    expect(r).toMatchObject({ journalBis: null, journalGeloescht: 0, inventarGeloescht: 2 });
    expect(u.aufrufe.at(-1)).toBe("prune");
    expect([...u.objekte.keys()].filter((x) => x.startsWith("journal/"))).toHaveLength(11);
  });
  it("PP11a-1: laufender Satz ohne Snapshot (Seq 10) + gepruefter Satz (Seq 20): Journal wird nicht gekuerzt", async () => {
    const u = umgebung([{ n: 1, zeit: "2026-11-10T01:00:00Z", zustand: "geprueft", journalSeq: 8 }], { ohneSnapshot: [[randomUUID(), "laufend"]] });
    const r = await u.ausfuehren();
    expect(r).toMatchObject({ journalBis: null, journalGeloescht: 0, offeneSaetze: 1 });
    expect([...u.objekte.keys()].filter((x) => x.startsWith("journal/"))).toHaveLength(11);
    const g = umgebung([{ n: 1, zeit: "2026-11-10T01:00:00Z", zustand: "geprueft", journalSeq: 8 }], { ohneSnapshot: [[randomUUID(), "gesichert"]] });
    expect(await g.ausfuehren()).toMatchObject({ journalBis: null, journalGeloescht: 0 });
  });
  it("PP11a-1: Grenze nie ueber dem vor den Zustaenden gelesenen Journal-Zaehler", async () => {
    const u = umgebung([{ n: 1, zeit: "2026-11-10T01:00:00Z", zustand: "geprueft", journalSeq: 8 }], { zaehler: 5n });
    expect(await u.ausfuehren()).toMatchObject({ journalBis: "5", journalGeloescht: 5 });
  });
  it("PP11a-2: Politik 1/0/0 mit neuerem fehlgeschlagenem Satz behaelt den einzigen geprueften", async () => {
    const s = [k(1, "2026-11-11T03:00:00Z", "fehlgeschlagen"), k(2, "2026-11-10T01:00:00Z", "geprueft"), k(3, "2026-11-09T01:00:00Z", "geprueft")];
    const r = waehleBehalten(s, { taeglich: 1, woechentlich: 0, monatlich: 0 }, TZ);
    expect(r.behalten.map((x) => x.snapshotId).sort()).toEqual([hex(1), hex(2)].sort());
    expect(r.entfernen.map((x) => x.snapshotId)).toEqual([hex(3)]);
    const nur = waehleBehalten([k(1, "2026-11-11T03:00:00Z", "fehlgeschlagen"), k(2, "2026-11-01T01:00:00Z", "geprueft")], { taeglich: 1, woechentlich: 0, monatlich: 0 }, TZ);
    expect(nur.behalten.map((x) => x.snapshotId)).toContain(hex(2));
  });
  it("PP11a-3: reservierter Satz eines offenen Updates wird nie entfernt", async () => {
    const u = umgebung(saetze);
    const rueckweg = u.repo[0].backupId;
    const r = await u.ausfuehren({ taeglich: 1, woechentlich: 0, monatlich: 0 }, [rueckweg]);
    expect(r.behalten).toContain(rueckweg);
    expect(u.objekte.has(`inventar/${u.instanzId}/${rueckweg}.age`)).toBe(true);
    expect(u.zustaende.get(rueckweg)).toBe("geprueft");
    expect(r.journalBis).toBe("2"); // Journal ab Seq 3 bleibt fuer den reservierten Satz erhalten
    await expect(u.ausfuehren(undefined, ["kein-uuid"])).rejects.toThrow(/reservierte/);
  });
  it("PP11a-7: Abbruch im prune wird beim naechsten Lauf ohne forget nachgeholt", async () => {
    const u = umgebung(saetze, { pruneFehler: 1 });
    await expect(u.ausfuehren()).rejects.toThrow(/restic/);
    expect(u.objekte.has(`retention/${u.instanzId}/prune-offen`)).toBe(true);
    u.aufrufe.length = 0;
    const r = await u.ausfuehren();
    expect(r).toMatchObject({ entfernt: [], prune: true });
    expect(u.aufrufe).toEqual(["snapshots", "dump", "dump", "prune"]);
    expect(u.objekte.has(`retention/${u.instanzId}/prune-offen`)).toBe(false);
    u.aufrufe.length = 0;
    expect(await u.ausfuehren()).toMatchObject({ prune: false });
    expect(u.aufrufe).not.toContain("prune");
  });
});
