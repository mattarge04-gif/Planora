export type ModulId = "plattform"|"identitaet"|"instanz"|"katalog"|"struktur"|"dokumente"|"bestand"|"erfassung"|"szene"|"export"|"lebensdauer"|"zustand"|"hinweise"|"suche";
export type Stufe = 1|2|3|4;
export type Modul = { id: ModulId; art: "kern"|"option"; lieferstufe: Stufe; braucht: ModulId[]; nutztWennAktiv: ModulId[]; routen: string[]; jobs: string[] };
const k = (id: ModulId, lieferstufe: Stufe, routen: string[], braucht: ModulId[] = [], nutztWennAktiv: ModulId[] = [], jobs: string[] = []): Modul => ({ id, art: "kern", lieferstufe, braucht, nutztWennAktiv, routen, jobs });
const o = (id: ModulId, lieferstufe: Stufe, routen: string[], braucht: ModulId[], nutztWennAktiv: ModulId[] = [], jobs: string[] = []): Modul => ({ id, art: "option", lieferstufe, braucht, nutztWennAktiv, routen, jobs });
export const MANIFEST_VERSION = "m1-2026-11-09";
export const MANIFEST: readonly Modul[] = [
  k("plattform", 1, ["/api/admin/module"]), k("identitaet", 1, ["/api/auth/", "/api/admin/benutzer"]), k("instanz", 1, ["/api/admin/instanz"]),
  k("katalog", 1, ["/api/katalog/"]), k("struktur", 1, ["/api/struktur/"]), k("dokumente", 1, ["/api/dokumente/"]), k("bestand", 1, ["/api/bestand/"]),
  k("erfassung", 1, ["/api/erfassung/"], ["struktur", "bestand", "katalog"], [], ["erfassung.excel-import"]),
  k("szene", 1, ["/api/szene/"], ["struktur", "bestand"], ["lebensdauer"]),
  k("export", 2, ["/api/export/"], ["bestand"], ["lebensdauer"], ["export.excel"]),
  o("lebensdauer", 2, ["/api/lebensdauer/"], ["bestand", "katalog"], ["zustand"], ["lebensdauer.neuberechnen"]),
  o("zustand", 2, ["/api/zustand/"], ["bestand"]),
  o("hinweise", 2, ["/api/hinweise/"], ["lebensdauer"], [], ["hinweise.taeglich"]),
  o("suche", 3, ["/api/suche/"], ["dokumente"], [], ["suche.indexieren"]),
];
const byId = new Map(MANIFEST.map((m) => [m.id, m]));
export const modul = (id: ModulId) => byId.get(id)!;
export const geliefert = (stufe: Stufe) => MANIFEST.filter((m) => m.lieferstufe <= stufe);
export const PROFILE: Record<"P1"|"P2"|"P3", ModulId[]> = { P1: [], P2: ["lebensdauer", "hinweise"], P3: ["lebensdauer", "hinweise", "suche"] };
export function istAktiv(id: ModulId, aktiveOptionen: Set<ModulId>, stufe: Stufe) { const m = byId.get(id); if (!m || m.lieferstufe > stufe) return false; return m.art === "kern" || aktiveOptionen.has(id); }
export function pruefeEinschalten(aktiv: Set<ModulId>, id: ModulId, stufe: Stufe): { ok: true } | { ok: false; grund: string } {
  const m = byId.get(id); if (!m || m.lieferstufe > stufe) return { ok: false, grund: "nicht geliefert" };
  if (m.art === "kern") return { ok: false, grund: "kern nicht schaltbar" };
  const fehlt = m.braucht.filter((b) => !istAktiv(b, aktiv, stufe)); if (fehlt.length) return { ok: false, grund: `braucht ${fehlt.join(", ")}` };
  return { ok: true };
}
export function kaskadeAbschalten(aktiv: Set<ModulId>, id: ModulId): ModulId[] {
  const raus = new Set<ModulId>([id]); let neu = true;
  while (neu) { neu = false; for (const a of aktiv) if (!raus.has(a) && byId.get(a)!.braucht.some((b) => raus.has(b))) { raus.add(a); neu = true; } }
  return [...raus];
}
export function modulFuerRoute(url: string): Modul | undefined {
  const pfad = url.split("?", 1)[0];
  return MANIFEST.find((m) => m.routen.some((r) => {
    const wurzel = r.replace(/\/$/, "");
    return pfad === wurzel || pfad.startsWith(wurzel + "/");
  }));
}
