// M1-Abnahme Punkt 3: Aufbewahrung der Sicherungssaetze (restic forget/prune) mit konsistentem Inventar und Journal.
// Standardpolitik 14 taeglich / 8 woechentlich / 12 monatlich: PO-Entscheid 2026-11-11 (vorher Vorschlag M1-Abnahme).
// Konfigurierbar ueber PLANORA_RETENTION_TAEGLICH / _WOECHENTLICH / _MONATLICH (backup.env).
import { istUuid } from "./inventar.js";
import { erfolgreich, prozess, type Prozess } from "./prozess.js";
import type { Ziel } from "./ziel.js";

export type Politik = { taeglich: number; woechentlich: number; monatlich: number };
/** PO-Entscheid 2026-11-11. */
export const STANDARD_POLITIK: Politik = { taeglich: 14, woechentlich: 8, monatlich: 12 };

export function politikAusUmgebung(env: NodeJS.ProcessEnv = process.env): Politik {
  const wert = (name: string, standard: number) => {
    const roh = env[name];
    if (roh === undefined || roh === "") return standard;
    if (!/^\d{1,4}$/.test(roh)) throw new Error(`${name}: ganze Zahl 0 bis 9999 erwartet`);
    return Number(roh);
  };
  const p = { taeglich: wert("PLANORA_RETENTION_TAEGLICH", STANDARD_POLITIK.taeglich), woechentlich: wert("PLANORA_RETENTION_WOECHENTLICH", STANDARD_POLITIK.woechentlich), monatlich: wert("PLANORA_RETENTION_MONATLICH", STANDARD_POLITIK.monatlich) };
  // Mindestens der juengste gepruefte Satz bleibt immer erhalten.
  if (p.taeglich < 1) throw new Error("PLANORA_RETENTION_TAEGLICH muss mindestens 1 sein");
  return p;
}

export type Zustand = "laufend" | "gesichert" | "geprueft" | "fehlgeschlagen" | "entfernt";
export type Kandidat = { snapshotId: string; backupId?: string; zeit: Date; zustand?: Zustand };

/** Kalenderschluessel in der Instanz-Zeitzone: Tag, ISO-Woche, Monat. */
export function kalender(zeit: Date, zeitzone: string) {
  const t = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zeitzone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(zeit).map((p) => [p.type, p.value]));
  const jahr = Number(t.year), monat = Number(t.month), tag = Number(t.day);
  // ISO-Woche aus dem lokalen Kalenderdatum (Donnerstag bestimmt das Wochenjahr).
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  const wochentag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wochentag);
  const wochenjahr = d.getUTCFullYear();
  const woche = Math.ceil(((d.getTime() - Date.UTC(wochenjahr, 0, 1)) / 86_400_000 + 1) / 7);
  return { tag: `${t.year}-${t.month}-${t.day}`, woche: `${wochenjahr}-W${String(woche).padStart(2, "0")}`, monat: `${t.year}-${t.month}` };
}

/**
 * Waehlt die zu behaltenden Saetze. Regeln:
 * - Je Regel (Tag/Woche/Monat) werden die juengsten N Kalenderbereiche mit mindestens einem Satz belegt (restic-Semantik).
 * - Vertreter eines Bereichs ist der juengste 'geprueft'-Satz; nur ohne solchen der juengste 'fehlgeschlagen'-Satz [A]
 *   (z.B. der eigene Satz nach einem Restore, den restore_sperren als fehlgeschlagen markiert).
 * - Laufende, gesicherte (noch ungepruefte) und in der DB unbekannte Saetze werden nie entfernt (konservativ).
 * - Der juengste gepruefte Satz bleibt immer erhalten, unabhaengig von der Politik (PP11a-2).
 * - Reservierte Saetze (offene Update-/Restore-Vorgaenge) werden nie entfernt (PP11a-3).
 */
export function waehleBehalten(kandidaten: Kandidat[], p: Politik, zeitzone: string, reserviert: ReadonlySet<string> = new Set()) {
  const geschuetzt = kandidaten.filter((k) => !k.zustand || !["geprueft", "fehlgeschlagen", "entfernt"].includes(k.zustand) || (k.backupId && reserviert.has(k.backupId)));
  const waehlbar = kandidaten.filter((k) => k.zustand === "geprueft" || k.zustand === "fehlgeschlagen" || k.zustand === "entfernt")
    .sort((a, b) => b.zeit.getTime() - a.zeit.getTime() || a.snapshotId.localeCompare(b.snapshotId));
  const behalten = new Set(geschuetzt.map((k) => k.snapshotId));
  const juengsterGeprueft = waehlbar.find((k) => k.zustand === "geprueft");
  if (juengsterGeprueft) behalten.add(juengsterGeprueft.snapshotId);
  const regeln: [keyof ReturnType<typeof kalender>, number][] = [["tag", p.taeglich], ["woche", p.woechentlich], ["monat", p.monatlich]];
  for (const [art, anzahl] of regeln) {
    const bereiche = new Map<string, Kandidat[]>();
    // 'entfernt' (DB sagt geloescht, Snapshot noch da: Abbruch nach forget-Fehler) belegt keinen Bereich.
    for (const k of waehlbar) if (k.zustand !== "entfernt") {
      const s = kalender(k.zeit, zeitzone)[art];
      if (!bereiche.has(s)) { if (bereiche.size >= anzahl) break; bereiche.set(s, []); }
      bereiche.get(s)!.push(k);
    }
    for (const mitglieder of bereiche.values()) behalten.add((mitglieder.find((k) => k.zustand === "geprueft") ?? mitglieder[0]).snapshotId);
  }
  return { behalten: kandidaten.filter((k) => behalten.has(k.snapshotId)), entfernen: kandidaten.filter((k) => !behalten.has(k.snapshotId)) };
}

export type RetentionDb = {
  /** Alle Zeilen aus backup_lauf. */
  zustaende(): Promise<Map<string, Zustand>>;
  /** Aktueller Journal-Zaehler (journal_zaehler.seq); wird VOR zustaende() gelesen (PP11a-1). */
  journalZaehler(): Promise<bigint>;
  entfernt(backupId: string): Promise<void>;
  protokoll(daten: object): Promise<void>;
  /** Exklusiv gegen parallele Retention (Advisory Lock). */
  exklusiv<T>(arbeit: () => Promise<T>): Promise<T>;
};
export type RetentionOptionen = {
  db: RetentionDb; ziel: Ziel; instanzId: string; resticEnv: NodeJS.ProcessEnv; politik: Politik; zeitzone: string; lauf?: Prozess;
  /** Satz-IDs offener Update-/Restore-Vorgaenge (vom Host uebergeben); werden nie entfernt. */
  reserviert?: string[];
};

type Snapshot = { id: string; time: string; tags?: string[]; paths?: string[] };

export async function aufbewahren(o: RetentionOptionen) {
  if (!istUuid(o.instanzId)) throw new Error("Ungueltige Instanz-ID");
  const lauf = o.lauf ?? prozess;
  const restic = (args: string[]) => erfolgreich(lauf, { programm: "restic", args, env: o.resticEnv });
  const reserviert = new Set(o.reserviert ?? []);
  for (const id of reserviert) if (!istUuid(id)) throw new Error("Ungueltige reservierte Satz-ID");
  const markierung = `retention/${o.instanzId}/prune-offen`;
  return o.db.exklusiv(async () => {
    // Reihenfolge wichtig (PP11a-1): Zaehler vor den Zustaenden lesen. Jede danach begonnene Sicherung hat eine
    // Journal-Sequenz >= diesem Zaehler; jede vorher begonnene ist unten als laufend/gesichert sichtbar.
    const zaehler = await o.db.journalZaehler();
    const zustaende = await o.db.zustaende();
    const offeneSaetze = [...zustaende.values()].filter((z) => z === "laufend" || z === "gesichert").length;
    // Ein abgebrochenes prune wird nachgeholt, auch wenn dieser Lauf nichts vergisst (PP11a-7).
    const pruneOffen = (await o.ziel.liste(`retention/${o.instanzId}`)).includes(markierung);
    const snapshots = JSON.parse(await restic(["snapshots", "--json"])) as Snapshot[];
    if (!Array.isArray(snapshots)) throw new Error("Unerwartete restic-Ausgabe");
    const kandidaten: Kandidat[] = snapshots.map((s) => {
      if (!/^[0-9a-f]{64}$/.test(s.id) || !Number.isFinite(Date.parse(s.time))) throw new Error("Unerwartete restic-Ausgabe");
      const ids = (s.tags ?? []).filter(istUuid);
      // Mehrdeutige oder fehlende Satz-ID: geschuetzt, nie automatisch entfernen.
      const backupId = ids.length === 1 ? ids[0] : undefined;
      return { snapshotId: s.id, backupId, zeit: new Date(s.time), zustand: backupId ? zustaende.get(backupId) : undefined };
    });
    // Mehrere Snapshots mit derselben Satz-ID sind kein regulaerer Stand: alle schuetzen.
    const doppelt = new Set(kandidaten.map((k) => k.backupId).filter((id, i, a) => id && a.indexOf(id) !== i));
    for (const k of kandidaten) if (k.backupId && doppelt.has(k.backupId)) k.zustand = undefined;
    const plan = waehleBehalten(kandidaten, o.politik, o.zeitzone, reserviert);
    if (plan.entfernen.length) await o.ziel.schreibe(markierung, Buffer.from(new Date().toISOString()), false);
    // 1. Snapshots vergessen. Erst danach Inventar und DB nachfuehren: ein Abbruch hinterlaesst hoechstens ein
    //    Inventar ohne Snapshot, das der Abgleich in Schritt 2 beim naechsten Lauf entfernt.
    if (plan.entfernen.length) await restic(["forget", ...plan.entfernen.map((k) => k.snapshotId)]);
    // 2. Abgleich: jeder abgeschlossene Satz ohne Snapshot ist entfernt (auch Fehlschlaege vor dem restic-Schritt).
    const mitSnapshot = new Set(plan.behalten.map((k) => k.backupId).filter(Boolean));
    const entfernteIds = [...zustaende].filter(([id, z]) => !mitSnapshot.has(id) && (z === "geprueft" || z === "fehlgeschlagen" || z === "entfernt")).map(([id]) => id);
    let inventarGeloescht = 0;
    const inventare = new Set(await o.ziel.liste(`inventar/${o.instanzId}`));
    for (const id of entfernteIds) {
      const schluessel = `inventar/${o.instanzId}/${id}.age`;
      if (inventare.has(schluessel)) { await o.ziel.loesche(schluessel); inventarGeloescht++; }
      if (zustaende.get(id) !== "entfernt") await o.db.entfernt(id);
    }
    // 3. Journal: Objekte bis zur kleinsten Journal-Sequenz aller behaltenen Saetze braucht kein Restore mehr.
    let journalBis: string | undefined, journalGeloescht = 0;
    // Laufende oder ungepruefte Saetze haben ihre Journal-Untergrenze noch nicht im Repository: nicht kuerzen.
    if (plan.behalten.length && !offeneSaetze) {
      const seqs: bigint[] = [];
      for (const k of plan.behalten) {
        const pfad = (snapshots.find((s) => s.id === k.snapshotId)?.paths ?? [])[0];
        if (!pfad || !k.backupId || !pfad.endsWith(`/${k.backupId}`)) { seqs.length = 0; break; }
        const manifest = await restic(["dump", k.snapshotId, `${pfad}/manifest.json`]).then((t) => JSON.parse(t), () => undefined);
        if (!/^\d+$/.test(manifest?.journalSeq ?? "") || manifest.backupId !== k.backupId) { seqs.length = 0; break; }
        seqs.push(BigInt(manifest.journalSeq));
      }
      // Ein Satz ohne lesbares Manifest (z.B. fremder Snapshot) verhindert die Journal-Kuerzung (konservativ).
      if (seqs.length === plan.behalten.length) {
        const grenze = seqs.reduce((a, b) => (b < a ? b : a), zaehler);
        journalBis = grenze.toString();
        const prefix = `journal/${o.instanzId}`;
        for (const schluessel of await o.ziel.liste(prefix)) {
          const m = /^([1-9]\d*)\.age$/.exec(schluessel.slice(prefix.length + 1));
          if (m && BigInt(m[1]) <= grenze) { await o.ziel.loesche(schluessel); journalGeloescht++; }
        }
      }
    }
    // 4. Speicher freigeben; die Markierung bleibt bis zum erfolgreichen prune bestehen.
    const prune = plan.entfernen.length > 0 || pruneOffen;
    if (prune) { await restic(["prune"]); await o.ziel.loesche(markierung); }
    const ergebnis = {
      politik: o.politik, behalten: plan.behalten.map((k) => k.backupId ?? k.snapshotId), entfernt: plan.entfernen.map((k) => k.backupId ?? k.snapshotId),
      inventarGeloescht, journalBis: journalBis ?? null, journalGeloescht, prune, offeneSaetze, reserviert: [...reserviert],
    };
    await o.db.protokoll(ergebnis);
    return ergebnis;
  });
}

/** Produktive DB-Anbindung ueber die Betriebsrolle (nur SECURITY-DEFINER-Funktionen aus 012). */
export function pgRetentionDb(pool: import("pg").Pool): RetentionDb {
  const LOCK = 7_310_004;
  return {
    async journalZaehler() { return BigInt((await pool.query("select seq::text from journal_zaehler where id=1")).rows[0].seq); },
    async zustaende() { return new Map((await pool.query("select id::text,zustand from backup_lauf")).rows.map((r) => [r.id as string, r.zustand as Zustand])); },
    async entfernt(id) { await pool.query("select backup_lauf_entfernt($1)", [id]); },
    async protokoll(d) { await pool.query("select backup_retention_protokoll($1::jsonb)", [JSON.stringify(d)]); },
    async exklusiv(arbeit) {
      const c = await pool.connect();
      try {
        if (!(await c.query("select pg_try_advisory_lock($1) ok", [LOCK])).rows[0].ok) throw new Error("Retention laeuft bereits");
        try { return await arbeit(); } finally { await c.query("select pg_advisory_unlock($1)", [LOCK]); }
      } finally { c.release(); }
    },
  };
}
