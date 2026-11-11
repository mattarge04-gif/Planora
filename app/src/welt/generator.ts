import { createHash } from "node:crypto";
import { geschossRang, type Regelwerk } from "./regelwerk.js";
import type { BauteilEingabe, Beschreibung, EinheitEingabe, Grundform, Hinweis, HuelleGespeichert, Punkt, Rechteck, Welt, WeltSymbol } from "./typen.js";

const mm = (v: number) => Math.round(v * 1000) / 1000;
const rundeRechteck = (r: Rechteck): Rechteck => ({ x: mm(r.x), z: mm(r.z), breite: mm(r.breite), tiefe: mm(r.tiefe) });
function pflichtId(x: { id?: string }): string {
  if (!x.id) throw new Error("Generator braucht gespeicherte IDs");
  return x.id;
}
function verweisId(v: { einheitId?: string }): string {
  if (!v.einheitId) throw new Error("Generator braucht gespeicherte IDs in Verweisen");
  return v.einheitId;
}

/** Teilrechtecke der Grundform; x entlang Breite, z entlang Tiefe. */
export function grundriss(form: Grundform, breite: number, tiefe: number, anteil: number): Rechteck[] {
  if (form === "quader") return [{ x: 0, z: 0, breite, tiefe }];
  const riegel = { x: 0, z: 0, breite, tiefe: anteil * tiefe };
  const sb = anteil * breite, st = (1 - anteil) * tiefe;
  const links = { x: 0, z: anteil * tiefe, breite: sb, tiefe: st };
  if (form === "l_form") return [riegel, links];
  return [riegel, links, { x: breite - sb, z: anteil * tiefe, breite: sb, tiefe: st }];
}

/** Teilt ein Rechteck entlang seiner Laengsachse proportional zu den Gewichten. */
export function streifen(r: Rechteck, gewichte: number[]): Rechteck[] {
  const summe = gewichte.reduce((s, g) => s + g, 0);
  const entlangX = r.breite >= r.tiefe;
  const laenge = entlangX ? r.breite : r.tiefe;
  let pos = 0;
  return gewichte.map((g) => {
    const l = (laenge * g) / summe;
    const t = entlangX ? { x: r.x + pos, z: r.z, breite: l, tiefe: r.tiefe } : { x: r.x, z: r.z + pos, breite: r.breite, tiefe: l };
    pos += l;
    return t;
  });
}

/** Verteilt Elemente der Reihe nach auf Teilrechtecke; jedes Teil nimmt Gewicht im Verhaeltnis seiner Flaeche auf. */
export function verteile<T>(teile: Rechteck[], elemente: T[], gewicht: (e: T) => number): T[][] {
  const flaechen = teile.map((r) => r.breite * r.tiefe);
  const total = flaechen.reduce((s, f) => s + f, 0);
  const w = elemente.reduce((s, e) => s + gewicht(e), 0);
  const gruppen: T[][] = teile.map(() => []);
  let i = 0, acc = 0;
  for (const e of elemente) {
    if (i < teile.length - 1 && gruppen[i].length > 0 && acc >= (flaechen[i] / total) * w - 1e-9) { i++; acc = 0; }
    gruppen[i].push(e);
    acc += gewicht(e);
  }
  return gruppen;
}

/** n Punkte als Zellmitten eines moeglichst quadratischen Rasters. */
export function raster(r: Rechteck, n: number): Punkt[] {
  const spalten = Math.ceil(Math.sqrt(n)), zeilen = Math.ceil(n / spalten);
  return Array.from({ length: n }, (_, k) => ({
    x: r.x + (r.breite * ((k % spalten) + 0.5)) / spalten,
    z: r.z + (r.tiefe * (Math.floor(k / spalten) + 0.5)) / zeilen,
  }));
}

const ueberlappt = (a: Rechteck, b: Rechteck) =>
  Math.min(a.x + a.breite, b.x + b.breite) - Math.max(a.x, b.x) > 1e-6 &&
  Math.min(a.z + a.tiefe, b.z + b.tiefe) - Math.max(a.z, b.z) > 1e-6;

/** JSON mit sortierten Schluesseln, Grundlage des Hashes. */
export function kanonisch(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(kanonisch).join(",") + "]";
  if (v !== null && typeof v === "object")
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + kanonisch((v as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(v);
}

type Gruppe = { schluessel: string; geschossId: string; katalogId: string; hersteller: string | null; typ: string | null; zeilen: BauteilEingabe[] };

export function weltErzeugen(h: HuelleGespeichert, b: Beschreibung, rw: Regelwerk): Welt {
  const teile = grundriss(h.grundform, h.breiteM, h.tiefeM, rw.schenkelAnteil);
  const ganz: Rechteck = { x: 0, z: 0, breite: h.breiteM, tiefe: h.tiefeM };
  const rang = (code: string) => {
    const r = geschossRang(code);
    if (r === null) throw new Error(`Geschoss-Code ${code} ungueltig`);
    return r;
  };

  // Geschosse stapeln: EG-Boden auf y = 0, UG darunter
  const geschosse = [...h.geschosse].sort((a, c) => rang(a.code) - rang(c.code));
  const yUnten = new Map<string, number>();
  let oben = 0;
  for (const g of geschosse.filter((g) => rang(g.code) >= 0)) { yUnten.set(g.id, oben); oben += g.hoeheM; }
  let unten = 0;
  for (const g of geschosse.filter((g) => rang(g.code) < 0).reverse()) { unten -= g.hoeheM; yUnten.set(g.id, unten); }

  // Einheiten: manuelle behalten ihr Rechteck, die uebrigen als Streifen ueber die Teilrechtecke
  const hinweise: Hinweis[] = [];
  const rechtecke = new Map<string, Rechteck>();
  const gewicht = (e: EinheitEingabe) => e.flaecheM2 ?? rw.einheitArten[e.art].defaultFlaecheM2;
  for (const g of geschosse) {
    const eigene = b.einheiten.filter((e) => e.geschossId === g.id);
    const auto = eigene.filter((e) => !e.layoutManuell);
    const manuell = eigene.filter((e) => e.layoutManuell);
    verteile(teile, auto, gewicht).forEach((gruppe, i) => {
      if (gruppe.length === 0) return;
      streifen(teile[i], gruppe.map(gewicht)).forEach((r, k) => rechtecke.set(pflichtId(gruppe[k]), r));
    });
    for (const e of manuell) rechtecke.set(pflichtId(e), e.layoutManuell!);
    for (const e of auto)
      if (manuell.some((m) => ueberlappt(rechtecke.get(pflichtId(e))!, m.layoutManuell!))) hinweise.push({ code: "ueberlappung", bezug: pflichtId(e) });
    // Manuell gegen frueher manuell (Reihenfolge im Array): je spaeter Einheit hoechstens ein Hinweis
    manuell.forEach((e, j) => {
      if (manuell.slice(0, j).some((m) => ueberlappt(e.layoutManuell!, m.layoutManuell!))) hinweise.push({ code: "ueberlappung", bezug: pflichtId(e) });
    });
  }

  // Bauteile: ein Symbol je Standort + Katalog-ID + Hersteller + Typ
  const einheitGeschoss = new Map(b.einheiten.map((e) => [pflichtId(e), e.geschossId]));
  const einheitRang = new Map(b.einheiten.map((e, i) => [pflichtId(e), i]));
  const gruppen = new Map<string, Gruppe>();
  const jeStandort = new Map<string, Gruppe[]>();
  for (const t of b.bauteile) {
    const standortId = t.standort.einheitId ?? t.standort.geschossId;
    if (!standortId) throw new Error("Generator braucht gespeicherte IDs im Standort");
    const geschossId = t.standort.einheitId ? einheitGeschoss.get(t.standort.einheitId)! : standortId;
    const hersteller = t.hersteller ?? null, typ = t.typ ?? null;
    const schluessel = [standortId, t.katalogId, hersteller ?? "", typ ?? ""].join("|");
    let gr = gruppen.get(schluessel);
    if (!gr) {
      gr = { schluessel, geschossId, katalogId: t.katalogId, hersteller, typ, zeilen: [] };
      gruppen.set(schluessel, gr);
      jeStandort.set(standortId, [...(jeStandort.get(standortId) ?? []), gr]);
    }
    gr.zeilen.push(t);
  }
  const symbole: WeltSymbol[] = [];
  for (const [standortId, liste] of jeStandort) {
    const punkte = raster(rechtecke.get(standortId) ?? ganz, liste.length);
    liste.forEach((gr, k) => {
      const manuelle = gr.zeilen.flatMap((z) => (z.positionManuell ? [z.positionManuell] : []));
      if (manuelle.some((p) => p.x !== manuelle[0].x || p.z !== manuelle[0].z)) hinweise.push({ code: "position_widerspruch", bezug: gr.schluessel });
      const p = manuelle[0] ?? punkte[k];
      const versorgt = [...new Set(gr.zeilen.flatMap((z) => z.versorgt.map(verweisId)))].sort((a, c) => einheitRang.get(a)! - einheitRang.get(c)!);
      symbole.push({
        schluessel: gr.schluessel, katalogId: gr.katalogId, hersteller: gr.hersteller, typ: gr.typ,
        bauteilIds: gr.zeilen.map(pflichtId),
        mengeSumme: gr.zeilen.reduce((s, z) => s + (z.menge ?? 0), 0),
        mengeUnbekannt: gr.zeilen.some((z) => z.menge === null),
        status: gr.zeilen.some((z) => z.status === "vorgeschlagen") ? "vorgeschlagen" : "bestaetigt",
        position: { x: mm(p.x), y: mm(yUnten.get(gr.geschossId)!), z: mm(p.z) },
        versorgt,
      });
    });
  }

  const ohneHash = {
    regelwerkVersion: rw.version,
    grundriss: teile.map(rundeRechteck),
    geschosse: geschosse.map((g) => ({ id: g.id, code: g.code, yUnten: mm(yUnten.get(g.id)!), hoehe: mm(g.hoeheM) })),
    einheiten: b.einheiten.map((e) => ({
      id: pflichtId(e), geschossId: e.geschossId, bezeichnung: e.bezeichnung, art: e.art,
      rechteck: rundeRechteck(rechtecke.get(pflichtId(e))!),
      quelle: (e.layoutManuell ? "manuell" : "schematisch") as "manuell" | "schematisch",
    })),
    symbole,
    hinweise,
  };
  return { ...ohneHash, hash: createHash("sha256").update(kanonisch(ohneHash)).digest("hex") };
}
