import { describe, it, expect } from "vitest";
import { MANIFEST, geliefert, PROFILE, pruefeEinschalten, kaskadeAbschalten, modulFuerRoute, istAktiv } from "../src/module/manifest.js";

describe("Modulmanifest", () => {
  it("enthaelt keine KI-Module und kein externes Ziel", () => {
    for (const id of ["ki", "interview_agent", "extraktion"]) expect(MANIFEST.map((m) => m.id)).not.toContain(id);
    expect(MANIFEST.every((m) => !("extern" in m))).toBe(true);
  });
  it("liefert Stufe 1 vollstaendig und export erst ab Stufe 2", () => {
    expect(geliefert(1).map((m) => m.id)).toEqual(["plattform", "identitaet", "instanz", "katalog", "struktur", "dokumente", "bestand", "erfassung", "szene"]);
    expect(geliefert(2).map((m) => m.id)).toContain("export");
    expect(geliefert(2).map((m) => m.id)).not.toContain("suche");
    expect(geliefert(3).map((m) => m.id)).toContain("suche");
  });
  it("Profile enthalten nur Optionen und lassen zustand aus", () => {
    expect(PROFILE.P1).toEqual([]);
    expect([...PROFILE.P2].sort()).toEqual(["hinweise", "lebensdauer"]);
    expect([...PROFILE.P3].sort()).toEqual(["hinweise", "lebensdauer", "suche"]);
    for (const ids of Object.values(PROFILE)) for (const id of ids) expect(MANIFEST.find((m) => m.id === id)?.art).toBe("option");
  });
  it("Einschalten verlangt Abhaengigkeiten und Lieferung", () => {
    expect(pruefeEinschalten(new Set(), "hinweise", 2)).toEqual({ ok: false, grund: "braucht lebensdauer" });
    expect(pruefeEinschalten(new Set(["lebensdauer"]), "hinweise", 2)).toEqual({ ok: true });
    expect(pruefeEinschalten(new Set(), "suche", 2)).toEqual({ ok: false, grund: "nicht geliefert" });
    expect(pruefeEinschalten(new Set(), "szene", 1)).toEqual({ ok: false, grund: "kern nicht schaltbar" });
    expect(istAktiv("szene", new Set(), 1)).toBe(true);
    expect(istAktiv("suche", new Set(["suche"]), 2)).toBe(false);
  });
  it("Kaskade folgt nur harten Abhaengigkeiten aktiver Optionen", () => {
    const aktiv = new Set<"lebensdauer" | "hinweise" | "zustand">(["lebensdauer", "hinweise", "zustand"]);
    expect(kaskadeAbschalten(aktiv, "lebensdauer").sort()).toEqual(["hinweise", "lebensdauer"]);
    expect(kaskadeAbschalten(aktiv, "zustand")).toEqual(["zustand"]);
    expect([...aktiv]).toEqual(["lebensdauer", "hinweise", "zustand"]);
  });
  it("ordnet auch Modulwurzeln mit Query zu, aber keine aehnlichen Pfade", () => {
    expect(modulFuerRoute("/api/hinweise/x")?.id).toBe("hinweise");
    expect(modulFuerRoute("/api/hinweise?seite=1")?.id).toBe("hinweise");
    expect(modulFuerRoute("/api/admin/module?x=1")?.id).toBe("plattform");
    expect(modulFuerRoute("/api/admin/modulefremd")).toBeUndefined();
    expect(modulFuerRoute("/api/unbekannt")).toBeUndefined();
  });
});
