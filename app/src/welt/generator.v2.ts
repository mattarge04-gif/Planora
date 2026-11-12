import { KATALOG_V2 } from "./katalog.v2.js";
import { gruppiereBauteile, mitHash, mm, pflichtId, rundeRechteck, stapeleGeschosse, symbolAus, ueberlappt, type SymbolGruppe } from "./generator.kern.js";
import type { RegelwerkV2 } from "./regelwerk.js";
import { raumModule } from "./raum/matrix.js";
import { verteileReihen, layoutGeschoss, type RaumLage } from "./raum/reihen.js";
import { formPfad, gegenueber, grundrissAusFluegeln } from "./raum/form.js";
import { einrichten, ERZEUGER, type SymbolEntwurf } from "./raum/einrichtung.js";
import { steigzone as steigzoneVon } from "./raum/steigzone.js";
import type { BauteilEingabe, Beschreibung, Hinweis, HuelleGespeichert, Punkt, Rechteck, Welt, WeltGruppe, WeltOrt, WeltSymbol } from "./typen.js";

const ortId = (t: BauteilEingabe): string | null => {
  if (!t.ort) return null;
  if ("gruppe" in t.ort) return "g:" + t.ort.gruppe.gruppeId;
  return "b:" + t.ort.vorBauteil.bauteilId;
};
const verweis = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error("Generator braucht gespeicherte IDs in Verweisen");
  return v;
};
const FLUEGEL_ANZAHL = { quader: 1, quadrat: 1, l_form: 2, u_form: 3 } as const;

/**
 * Regelwerk v2 (Spec Stufe 1 §5): Raumgroessen aus der Modulmatrix, zwei Reihen beidseits des Gangs entlang des Fluegelpfads,
 * Gebaeudelaenge = laengste Reihe ueber alle Geschosse; Einrichtung je Raum, Steigzone, Gruppen. Masse der Huelle werden ignoriert.
 */
export function weltErzeugenV2(h: HuelleGespeichert, b: Beschreibung, rw: RegelwerkV2): Welt {
  const raum = rw.raum;
  const { geschosse, yUnten } = stapeleGeschosse(h);
  const jeStandort = gruppiereBauteile(b, ortId);
  const alleGruppen = [...jeStandort.values()].flat();
  const symbolVon = new Map<string, string>(); // Bauteil-ID -> Symbolschluessel
  for (const g of alleGruppen) for (const t of g.zeilen) symbolVon.set(pflichtId(t), g.schluessel);
  const schluesselVon = (v: { bauteilId?: string }) => symbolVon.get(verweis(v.bauteilId))!;
  const verteilerVonGruppe = new Map((b.gruppen ?? []).map((g) => [pflichtId(g), schluesselVon(g.verteiler)]));

  // 1. Raumgroessen (Module) aus der Matrix; Gruppenzubehoer zaehlt nicht
  const ohneZubehoer = (g: SymbolGruppe) => !(g.zeilen[0].ort && "gruppe" in g.zeilen[0].ort);
  const groesse = new Map(b.einheiten.map((e) => {
    const n = (jeStandort.get(pflichtId(e)) ?? []).filter(ohneZubehoer).length;
    return [pflichtId(e), raumModule(e.art, n, n, rw)];
  }));
  const auto = (geschossId: string) => b.einheiten.filter((e) => e.geschossId === geschossId && !e.layoutManuell)
    .map((e) => ({ id: pflichtId(e), laenge: groesse.get(pflichtId(e))!.laenge }));
  const reihenTiefe = Math.max((raum.minGebaeude[1] - raum.gangModule) / 2,
    ...b.einheiten.filter((e) => !e.layoutManuell).map((e) => groesse.get(pflichtId(e))!.tiefe));
  const tiefe = 2 * reihenTiefe + raum.gangModule;

  // 2. Huelle: Pfadlaenge aus der laengsten Reihe (innere Reihe bei L/U je Ecke um Tiefe + Gang kuerzer)
  const vorlauf = (FLUEGEL_ANZAHL[h.grundform] - 1) * (tiefe + raum.gangModule);
  const laenge = Math.max(1, ...geschosse.map((g) => {
    const raeume = auto(g.id);
    const [r0, r1] = verteileReihen(raeume, { vorlauf: [0, vorlauf] });
    const summe = (ids: string[]) => ids.reduce((s, id) => s + raeume.find((x) => x.id === id)!.laenge, 0);
    return raeume.length ? Math.max(summe(r0), summe(r1) + vorlauf) : 0;
  }));
  const fluegel = formPfad(h.grundform, laenge, tiefe, raum);
  const grundriss = grundrissAusFluegeln(fluegel, raum);

  // 3. Raeume je Geschoss; manuelle behalten ihr Rechteck (Gang dann an +z)
  const hinweise: Hinweis[] = [];
  const lage = new Map<string, RaumLage>();
  for (const g of geschosse) {
    const l = layoutGeschoss(auto(g.id), h.grundform, fluegel, raum);
    hinweise.push(...l.hinweise);
    for (const [id, x] of l.rechtecke) lage.set(id, x);
    const eigene = b.einheiten.filter((e) => e.geschossId === g.id);
    const manuell = eigene.filter((e) => e.layoutManuell);
    for (const e of manuell) lage.set(pflichtId(e), { rechteck: e.layoutManuell!, gang: "+z" });
    for (const e of eigene.filter((x) => !x.layoutManuell))
      if (manuell.some((m) => ueberlappt(lage.get(pflichtId(e))!.rechteck, m.layoutManuell!))) hinweise.push({ code: "ueberlappung", bezug: pflichtId(e) });
    manuell.forEach((e, j) => {
      if (manuell.slice(0, j).some((m) => ueberlappt(e.layoutManuell!, m.layoutManuell!))) hinweise.push({ code: "ueberlappung", bezug: pflichtId(e) });
    });
  }
  const einheiten = b.einheiten.map((e) => ({
    id: pflichtId(e), geschossId: e.geschossId, bezeichnung: e.bezeichnung, art: e.art,
    rechteck: rundeRechteck(lage.get(pflichtId(e))!.rechteck),
    quelle: (e.layoutManuell ? "manuell" : "schematisch") as "manuell" | "schematisch",
  }));

  // 4. Steigzone: Kern, sonst Ecke der Zentrale (Einheit mit dem ersten Erzeuger)
  const zentrale = b.bauteile.find((t) => ERZEUGER.includes(t.katalogId) && t.standort.einheitId)?.standort.einheitId ?? null;
  const steigzone = steigzoneVon(einheiten, geschosse.map((g) => g.id), zentrale, grundriss);

  // 5. Einrichtung je Raum (Bauteile direkt am Geschoss: im groessten Teilrechteck)
  const geschossFlaeche = grundriss.reduce((m, r) => (r.breite * r.tiefe > m.breite * m.tiefe ? r : m), grundriss[0]);
  const entwurf = (g: SymbolGruppe): SymbolEntwurf => {
    const ort = g.zeilen[0].ort;
    if (!ort) return { schluessel: g.schluessel, katalogId: g.katalogId };
    if ("gruppe" in ort) return { schluessel: g.schluessel, katalogId: g.katalogId, bei: verteilerVonGruppe.get(verweis(ort.gruppe.gruppeId)) };
    return { schluessel: g.schluessel, katalogId: g.katalogId, vor: schluesselVon(ort.vorBauteil) };
  };
  const position = new Map<string, Punkt>();
  const raumVon = new Map<string, Rechteck>();
  for (const [standortId, liste] of jeStandort) {
    const l = lage.get(standortId) ?? { rechteck: geschossFlaeche, gang: "+z" as const };
    for (const [k, p] of einrichten(l.rechteck, l.gang, gegenueber(l.gang), liste.map(entwurf), KATALOG_V2, steigzone)) position.set(k, p);
    for (const g of liste) raumVon.set(g.schluessel, l.rechteck);
  }
  // Gruppenzubehoer mit Verteiler in einem anderen Raum: trotzdem am Verteiler (3D zeichnet es am Stock)
  for (const g of alleGruppen) {
    if (position.has(g.schluessel)) continue;
    const e = entwurf(g);
    const r = raumVon.get(g.schluessel)!;
    position.set(g.schluessel, (e.bei && position.get(e.bei)) || { x: r.x + r.breite / 2, z: r.z + r.tiefe / 2 });
  }

  // 6. Symbole mit Ort, Gruppen
  const symbole: WeltSymbol[] = [];
  for (const g of alleGruppen) {
    const s = symbolAus(b, g, position.get(g.schluessel)!, yUnten, hinweise);
    const ort = g.zeilen[0].ort;
    if (!ort) { symbole.push(s); continue; }
    const welt: WeltOrt = "gruppe" in ort ? { gruppe: verweis(ort.gruppe.gruppeId) } : { vorBauteil: schluesselVon(ort.vorBauteil) };
    symbole.push({ ...s, ort: welt });
  }
  const gruppen: WeltGruppe[] = (b.gruppen ?? []).map((g) => {
    const id = pflichtId(g);
    return {
      id, verteiler: schluesselVon(g.verteiler), nummer: g.nummer, art: g.art, bezeichnung: g.bezeichnung,
      verbraucher: [...new Set(g.verbraucher.map(schluesselVon))],
      zubehoer: symbole.filter((s) => s.ort && "gruppe" in s.ort && s.ort.gruppe === id).map((s) => s.schluessel),
    };
  });

  // 7. Hinweise (Spec 5.5): Abgabe ohne Gruppe (auch nicht ueber einen Unterverteiler, der Verbraucher einer Gruppe ist), leere Gruppe
  const inGruppe = new Set((b.gruppen ?? []).flatMap((g) => g.verbraucher.map((v) => verweis(v.bauteilId))));
  const ueberUnterverteiler = new Set(b.bauteile.filter((t) => inGruppe.has(pflichtId(t))).flatMap((t) => t.versorgt.map((v) => verweis(v.einheitId))));
  const abgabe = new Set(KATALOG_V2.eintraege.filter((k) => k.bereich === "einheit").map((k) => k.id));
  for (const g of alleGruppen) {
    if (!abgabe.has(g.katalogId)) continue;
    if (g.zeilen.some((t) => !inGruppe.has(pflichtId(t)) && !(t.standort.einheitId && ueberUnterverteiler.has(t.standort.einheitId))))
      hinweise.push({ code: "ohne_gruppe", bezug: g.schluessel });
  }
  for (const g of b.gruppen ?? []) if (g.verbraucher.length === 0) hinweise.push({ code: "gruppe_leer", bezug: pflichtId(g) });

  return mitHash({
    regelwerkVersion: rw.version,
    grundriss: grundriss.map(rundeRechteck),
    geschosse: geschosse.map((g) => ({ id: g.id, code: g.code, yUnten: mm(yUnten.get(g.id)!), hoehe: mm(g.hoeheM) })),
    einheiten, symbole, hinweise, gruppen, steigzone,
  });
}

/** Aussenmasse (Meter) einer v2-Welt; Grundlage fuer `gebaeude.breite_m/tiefe_m` (Spec 4.5). */
export function abgeleiteteMasse(w: Welt): { breiteM: number; tiefeM: number } {
  return { breiteM: mm(Math.max(...w.grundriss.map((r) => r.x + r.breite))), tiefeM: mm(Math.max(...w.grundriss.map((r) => r.z + r.tiefe))) };
}
