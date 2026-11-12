import { ApiFehler, ersetzeJson, holeJson, loescheJson, sendeJson } from "../api";
import type { BeschreibungEingabe, Huelle, Katalog, Welt } from "../typen";
import { ausBeschreibung, type GebaeudeKopf } from "./beschreibung";
import type { AssistentZustand } from "./zustand";

/** Server-Schnittstelle des Assistenten (für Tests austauschbar). */
export interface AssistentApi {
  ladeEntwurf(id: string): Promise<{ stand: number; daten: unknown } | null>;
  speichereEntwurf(id: string, stand: number, daten: unknown): Promise<number>;
  loescheEntwurf(id: string): Promise<void>;
  ladeBeschreibung(id: string): Promise<BeschreibungEingabe>;
  ladeWelt(id: string): Promise<Welt>;
  vorschau(id: string, b: BeschreibungEingabe): Promise<Welt>;
  uebernehmen(id: string, b: BeschreibungEingabe): Promise<BeschreibungEingabe>;
  legeAn(liegenschaftId: string, h: Huelle): Promise<string>;
  katalog(): Promise<Katalog>;
}

export const httpApi: AssistentApi = {
  async ladeEntwurf(id) {
    try { return await holeJson<{ stand: number; daten: unknown }>(`/api/struktur/gebaeude/${id}/entwurf`); }
    catch (e) { if (e instanceof ApiFehler && e.status === 404) return null; throw e; }
  },
  async speichereEntwurf(id, stand, daten) {
    return (await ersetzeJson<{ stand: number }>(`/api/struktur/gebaeude/${id}/entwurf`, { stand, daten })).stand;
  },
  loescheEntwurf: (id) => loescheJson(`/api/struktur/gebaeude/${id}/entwurf`),
  ladeBeschreibung: (id) => holeJson<BeschreibungEingabe>(`/api/struktur/gebaeude/${id}/beschreibung`),
  ladeWelt: (id) => holeJson<Welt>(`/api/szene/gebaeude/${id}/welt`),
  vorschau: (id, b) => sendeJson<Welt>(`/api/szene/gebaeude/${id}/vorschau`, b),
  uebernehmen: (id, b) => ersetzeJson<BeschreibungEingabe>(`/api/struktur/gebaeude/${id}/beschreibung`, b),
  async legeAn(lid, h) { return (await sendeJson<{ id: string }>(`/api/struktur/liegenschaften/${lid}/gebaeude`, h)).id; },
  katalog: () => holeJson<Katalog>("/api/katalog/v2"),
};

/** Entwurfsinhalt prüfen: nur Zustände dieser Version und dieses Gebäudes übernehmen. */
export function entwurfLesen(daten: unknown, gebaeudeId: string): AssistentZustand | null {
  if (!daten || typeof daten !== "object") return null;
  const z = daten as Partial<AssistentZustand>;
  if (z.version !== 1 || !z.gebaeude || z.gebaeude.id !== gebaeudeId || !Array.isArray(z.einheiten) || !Array.isArray(z.bauteile)) return null;
  return { ...(z as AssistentZustand), huelleBearbeitbar: false };
}

/**
 * Inhalt des Entwurfs: der Zustand ohne Kopfangaben eines angelegten Gebäudes (Name, Form, Liegenschaft kommen
 * beim Öffnen aus Gebäudeliste und Welt), damit blosses Öffnen keinen Entwurf erzeugt.
 */
export function entwurfDaten(z: AssistentZustand): AssistentZustand {
  if (!z.gebaeude.id) return z;
  return { ...z, gebaeude: { ...z.gebaeude, name: "", grundform: "quader", liegenschaftId: null } };
}

export interface Geladen { zustand: AssistentZustand; entwurfStand: number; ausEntwurf: boolean }

/** Laden: zuerst der Entwurf, sonst die gespeicherte Beschreibung (Spec §7). */
export async function ladeAssistent(api: AssistentApi, gebaeudeId: string, kopf: GebaeudeKopf): Promise<Geladen> {
  const entwurf = await api.ladeEntwurf(gebaeudeId);
  const ausEntwurf = entwurf ? entwurfLesen(entwurf.daten, gebaeudeId) : null;
  if (entwurf && ausEntwurf) {
    return { zustand: { ...ausEntwurf, gebaeude: { ...ausEntwurf.gebaeude, name: kopf.name || ausEntwurf.gebaeude.name } }, entwurfStand: entwurf.stand, ausEntwurf: true };
  }
  const b = await api.ladeBeschreibung(gebaeudeId);
  return { zustand: ausBeschreibung(b, kopf), entwurfStand: entwurf?.stand ?? 0, ausEntwurf: false };
}

export const KONFLIKT_MELDUNG = "Der Entwurf wurde inzwischen an anderer Stelle geändert. Der neueste Stand ist geladen.";

/** 409 beim Entwurf: Meldung zeigen und den gespeicherten Stand neu laden. */
export async function konfliktLaden(api: AssistentApi, gebaeudeId: string, kopf: GebaeudeKopf, schritt: AssistentZustand["schritt"]): Promise<Geladen & { meldung: string }> {
  const g = await ladeAssistent(api, gebaeudeId, kopf);
  return { ...g, zustand: g.ausEntwurf ? g.zustand : { ...g.zustand, schritt }, meldung: KONFLIKT_MELDUNG };
}

export type SpeicherStatus = "bereit" | "ungespeichert" | "speichert" | "gespeichert" | "fehler" | "konflikt";

/**
 * Autosave des Entwurfs: `eingabe` speichert 1.5 s nach der letzten Änderung, `sofort` (Schrittwechsel) sofort.
 * Speichervorgänge laufen nacheinander (optimistische Sperre über `stand`); bei 409 ruht der Autosave, bis `neuStart`.
 */
export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private laeuft: Promise<void> | null = null;
  private offen: unknown = undefined;
  private zuletzt = "";
  private gesperrt = false;
  private wartend: unknown = undefined;

  constructor(
    private readonly speichern: (stand: number, daten: unknown) => Promise<number>,
    public stand: number,
    private readonly melde: (s: SpeicherStatus) => void,
    private readonly onKonflikt: () => void,
    private readonly verzoegerungMs = 1500,
  ) {}

  /** Ausgangsstand (geladen), damit unveränderte Daten nicht erneut gespeichert werden. */
  basis(daten: unknown): void { this.zuletzt = JSON.stringify(daten); }

  eingabe(daten: unknown): void {
    if (this.gesperrt || JSON.stringify(daten) === this.zuletzt) return;
    this.melde("ungespeichert");
    this.wartend = daten;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.sofort(daten); }, this.verzoegerungMs);
  }

  async sofort(daten: unknown): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.gesperrt) return;
    this.offen = daten;
    if (this.laeuft) return this.laeuft;
    this.laeuft = this.abarbeiten();
    try { await this.laeuft; } finally { this.laeuft = null; }
  }

  private async abarbeiten(): Promise<void> {
    while (this.offen !== undefined && !this.gesperrt) {
      const daten = this.offen;
      this.offen = undefined;
      const text = JSON.stringify(daten);
      if (text === this.zuletzt) continue;
      this.melde("speichert");
      try {
        this.stand = await this.speichern(this.stand, daten);
        this.zuletzt = text;
        this.melde("gespeichert");
      } catch (e) {
        if (e instanceof ApiFehler && e.status === 409) { this.gesperrt = true; this.melde("konflikt"); this.onKonflikt(); return; }
        this.melde("fehler");
        return;
      }
    }
  }

  /** Nach dem Neuladen (Konflikt) mit neuem Stand weiterarbeiten. */
  neuStart(stand: number, daten: unknown): void {
    this.stand = stand; this.gesperrt = false; this.offen = undefined; this.basis(daten);
  }

  /** Nach Übernehmen oder Verlassen: nichts mehr speichern. */
  beenden(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.offen = undefined; this.gesperrt = true;
  }

  /** Ausstehende Eingabe sofort speichern (z. B. beim Verlassen). */
  async flush(): Promise<void> {
    if (this.timer) return this.sofort(this.wartend);
    if (this.laeuft) await this.laeuft;
  }
}
