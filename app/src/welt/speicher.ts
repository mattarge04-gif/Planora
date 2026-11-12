import type pg from "pg";
import { geschossRang, type Katalog, type Regelwerk } from "./regelwerk.js";
import { REGELWERK_V2 } from "./regelwerk.v2.js";
import { pruefeBeschreibung, type Bestand } from "./pruefung.js";
import { verteilerHinweise, wirksameHeizung } from "./heizung.js";
import { HEIZ_ARTEN, type BauteilEingabe, type Beschreibung, type EinheitEingabe, type Fehler, type HeizArt, type Heizung, type Huelle, type HuelleGespeichert } from "./typen.js";

export class FachFehler extends Error {
  readonly fehler: Fehler[];
  readonly status: 409 | 422;
  constructor(fehler: Fehler[], status: 409 | 422 = 422) {
    super(fehler.map((f) => f.code).join(", "));
    this.fehler = fehler;
    this.status = status;
  }
}

export function pruefeHuelle(h: Huelle, rw: Regelwerk): Fehler[] {
  const f: Fehler[] = [];
  if (rw.version === 1) {
    for (const [pfad, v] of [["breiteM", h.breiteM], ["tiefeM", h.tiefeM]] as const)
      if (v === undefined || v < rw.masse.min || v > rw.masse.max) f.push({ pfad, code: "mass_ungueltig", meldung: `${rw.masse.min}–${rw.masse.max} m erwartet` });
    if (h.grundform === "quadrat") f.push({ pfad: "grundform", code: "grundform_nicht_erlaubt", meldung: "Quadrat gibt es erst ab Regelwerk v2" });
  }
  if (h.geschosse.length === 0) f.push({ pfad: "geschosse", code: "geschoss_fehlt", meldung: "Mindestens ein Geschoss angeben" });
  const codes = new Set<string>();
  h.geschosse.forEach((g, i) => {
    if (geschossRang(g.code) === null) f.push({ pfad: `geschosse[${i}].code`, code: "geschoss_code_ungueltig", meldung: `Code ${g.code} ungueltig (UG3..UG1, EG, OG1..OG40, DG, DACH)` });
    else if (codes.has(g.code)) f.push({ pfad: `geschosse[${i}].code`, code: "geschoss_doppelt", meldung: `Code ${g.code} mehrfach` });
    codes.add(g.code);
    const hoehe = g.hoeheM ?? rw.geschoss.hoeheDefault;
    if (hoehe < rw.geschoss.hoeheMin || hoehe > rw.geschoss.hoeheMax)
      f.push({ pfad: `geschosse[${i}].hoeheM`, code: "hoehe_ungueltig", meldung: `${rw.geschoss.hoeheMin}–${rw.geschoss.hoeheMax} m erwartet` });
  });
  return f;
}

export async function legeGebaeudeAn(c: pg.ClientBase, liegenschaftId: string, h: Huelle, rwVorgabe: Regelwerk): Promise<string> {
  // Ohne Masse ergibt sich die Groesse aus dem Inhalt: Regelwerk v2.
  const rw = h.breiteM === undefined && h.tiefeM === undefined && rwVorgabe.version === 1 ? REGELWERK_V2 : rwVorgabe;
  const f = pruefeHuelle(h, rw);
  if (f.length) throw new FachFehler(f);
  const id: string = (await c.query(
    "insert into gebaeude(liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version) values ($1,$2,$3,$4,$5,$6) returning id",
    [liegenschaftId, h.name, h.grundform, h.breiteM, h.tiefeM, rw.version])).rows[0].id;
  for (const g of h.geschosse)
    await c.query("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,$3,$4,$5)",
      [liegenschaftId, id, g.code, geschossRang(g.code), g.hoeheM ?? rw.geschoss.hoeheDefault]);
  return id;
}

export async function aendereHuelle(c: pg.ClientBase, gebaeudeId: string, h: Huelle, rw: Regelwerk): Promise<void> {
  const f = pruefeHuelle(h, rw);
  const g = (await c.query("select liegenschaft_id from gebaeude where id=$1 for update", [gebaeudeId])).rows[0];
  if (!g) throw new Error("Gebaeude unbekannt");
  const bestehend: string[] = (await c.query("select id from geschoss where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => r.id);
  const gesehen = new Set<string>();
  h.geschosse.forEach((x, i) => {
    if (!x.id) return;
    if (!bestehend.includes(x.id)) f.push({ pfad: `geschosse[${i}].id`, code: "id_unbekannt", meldung: "Geschoss gehoert nicht zu diesem Gebaeude" });
    else if (gesehen.has(x.id)) f.push({ pfad: `geschosse[${i}].id`, code: "id_doppelt", meldung: "Geschoss mehrfach angegeben" });
    gesehen.add(x.id);
  });
  const behalten = new Set(h.geschosse.flatMap((x) => (x.id ? [x.id] : [])));
  const weg = bestehend.filter((id) => !behalten.has(id));
  for (const id of weg) {
    const belegt = (await c.query("select exists(select 1 from einheit where geschoss_id=$1) or exists(select 1 from bauteil where geschoss_id=$1) b", [id])).rows[0].b;
    if (belegt) f.push({ pfad: "geschosse", code: "geschoss_belegt", meldung: `Geschoss ${id} hat Einheiten oder Bauteile` });
  }
  if (f.length) throw new FachFehler(f);
  await c.query("update gebaeude set name=$2, grundform=$3, breite_m=$4, tiefe_m=$5, stand=stand+1 where id=$1",
    [gebaeudeId, h.name, h.grundform, h.breiteM, h.tiefeM]);
  for (const id of weg) await c.query("delete from geschoss where id=$1", [id]);
  // Zwischencodes, damit ein Tausch von Codes unique(gebaeude_id, code) nicht verletzt
  for (const x of h.geschosse) if (x.id) await c.query("update geschoss set code = 'tmp-' || id where id=$1", [x.id]);
  for (const x of h.geschosse) {
    const werte = [x.code, geschossRang(x.code), x.hoeheM ?? rw.geschoss.hoeheDefault];
    if (x.id) await c.query("update geschoss set code=$2, reihenfolge=$3, hoehe_m=$4 where id=$1", [x.id, ...werte]);
    else await c.query("insert into geschoss(liegenschaft_id, gebaeude_id, code, reihenfolge, hoehe_m) values ($1,$2,$3,$4,$5)", [g.liegenschaft_id, gebaeudeId, ...werte]);
  }
}

export async function ladeHuelle(c: pg.ClientBase, gebaeudeId: string): Promise<HuelleGespeichert | null> {
  const g = (await c.query("select id, liegenschaft_id, name, grundform, breite_m, tiefe_m, regelwerk_version, stand from gebaeude where id=$1", [gebaeudeId])).rows[0];
  if (!g) return null;
  const gs = (await c.query("select id, code, hoehe_m from geschoss where gebaeude_id=$1 order by reihenfolge", [gebaeudeId])).rows;
  return {
    gebaeudeId: g.id, liegenschaftId: g.liegenschaft_id, name: g.name, grundform: g.grundform, breiteM: g.breite_m, tiefeM: g.tiefe_m,
    regelwerkVersion: g.regelwerk_version, stand: g.stand,
    geschosse: gs.map((r) => ({ id: r.id, code: r.code, hoeheM: r.hoehe_m })),
  };
}

export async function ladeBeschreibung(c: pg.ClientBase, gebaeudeId: string): Promise<Beschreibung | null> {
  const h = await ladeHuelle(c, gebaeudeId);
  if (!h) return null;
  const heizungStandard: Heizung = { hk: "unbekannt", fbh: "unbekannt", tabs: "unbekannt" };
  for (const r of (await c.query("select art, vorhanden from gebaeude_heizung_standard where gebaeude_id=$1", [gebaeudeId])).rows)
    heizungStandard[r.art as HeizArt] = r.vorhanden;
  const es = (await c.query(
    `select e.id, e.geschoss_id, e.bezeichnung, e.art, e.flaeche_m2, e.layout_manuell
       from einheit e join geschoss g on g.id = e.geschoss_id where g.gebaeude_id=$1 order by e.reihenfolge`, [gebaeudeId])).rows;
  const ausnahmen = (await c.query(
    `select h.einheit_id, h.art, h.vorhanden from einheit_heizung h
       join einheit e on e.id = h.einheit_id join geschoss g on g.id = e.geschoss_id where g.gebaeude_id=$1`, [gebaeudeId])).rows;
  const einheiten: EinheitEingabe[] = es.map((r) => {
    const ausnahme: Partial<Heizung> = {};
    for (const a of ausnahmen) if (a.einheit_id === r.id) ausnahme[a.art as HeizArt] = a.vorhanden;
    return {
      id: r.id, geschossId: r.geschoss_id, bezeichnung: r.bezeichnung, art: r.art, flaecheM2: r.flaeche_m2,
      layoutManuell: r.layout_manuell, heizungAusnahme: ausnahme, heizungWirksam: wirksameHeizung(heizungStandard, ausnahme),
    };
  });
  const ts = (await c.query(
    "select id, katalog_id, einheit_id, geschoss_id, menge, status, hersteller, typ, baujahr, position_manuell from bauteil where gebaeude_id=$1 order by reihenfolge",
    [gebaeudeId])).rows;
  const vs = (await c.query(
    `select v.bauteil_id, v.einheit_id from versorgung v
       join bauteil t on t.id = v.bauteil_id join einheit e on e.id = v.einheit_id where t.gebaeude_id=$1 order by e.reihenfolge`, [gebaeudeId])).rows;
  const bauteile: BauteilEingabe[] = ts.map((r) => ({
    id: r.id, katalogId: r.katalog_id, standort: r.einheit_id ? { einheitId: r.einheit_id } : { geschossId: r.geschoss_id },
    menge: r.menge, status: r.status, hersteller: r.hersteller, typ: r.typ, baujahr: r.baujahr, positionManuell: r.position_manuell,
    versorgt: vs.filter((v) => v.bauteil_id === r.id).map((v) => ({ einheitId: v.einheit_id })),
  }));
  const b: Beschreibung = { gebaeudeId, stand: h.stand, geschosse: h.geschosse.map((g) => ({ id: g.id, code: g.code })), heizungStandard, einheiten, bauteile };
  b.hinweise = verteilerHinweise(b);
  return b;
}

export type Zaehler = Record<"einheiten" | "bauteile", { angelegt: number; aktualisiert: number; geloescht: number }>;

/** Abgleich Beschreibung → Tabellen (Spec §6). Laeuft in der Transaktion des Aufrufers. */
export async function schreibeBeschreibung(c: pg.ClientBase, gebaeudeId: string, b: Beschreibung, rw: Regelwerk, katalog: Katalog): Promise<Zaehler> {
  const g = (await c.query("select liegenschaft_id, stand from gebaeude where id=$1 for update", [gebaeudeId])).rows[0];
  if (!g) throw new Error("Gebaeude unbekannt");
  if (b.stand !== g.stand) throw new FachFehler([{ pfad: "stand", code: "stand_veraltet", meldung: "Beschreibung wurde inzwischen geaendert; bitte neu laden" }], 409);
  const L: string = g.liegenschaft_id;

  const es = (await c.query("select e.id, e.layout_manuell is not null m from einheit e join geschoss g on g.id=e.geschoss_id where g.gebaeude_id=$1", [gebaeudeId])).rows;
  const ts = (await c.query("select id, position_manuell is not null m from bauteil where gebaeude_id=$1", [gebaeudeId])).rows;
  const bestand: Bestand = {
    geschossIds: new Set((await c.query("select id from geschoss where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => r.id)),
    einheitIds: new Set(es.map((r) => r.id)), bauteilIds: new Set(ts.map((r) => r.id)),
    einheitenManuell: new Set(es.filter((r) => r.m).map((r) => r.id)), bauteileManuell: new Set(ts.filter((r) => r.m).map((r) => r.id)),
  };
  const f = pruefeBeschreibung(b, bestand, rw, katalog);
  if (f.length) throw new FachFehler(f);

  const z: Zaehler = { einheiten: { angelegt: 0, aktualisiert: 0, geloescht: 0 }, bauteile: { angelegt: 0, aktualisiert: 0, geloescht: 0 } };

  // 1. Versorgung komplett neu; entfallende Bauteile loeschen
  await c.query("delete from versorgung where bauteil_id in (select id from bauteil where gebaeude_id=$1)", [gebaeudeId]);
  const bauteilBehalten = b.bauteile.flatMap((t) => (t.id ? [t.id] : []));
  z.bauteile.geloescht = (await c.query("delete from bauteil where gebaeude_id=$1 and not (id = any($2::uuid[]))", [gebaeudeId, bauteilBehalten])).rowCount ?? 0;

  // 2. Heizungsstandard
  await c.query("delete from gebaeude_heizung_standard where gebaeude_id=$1", [gebaeudeId]);
  for (const art of HEIZ_ARTEN)
    await c.query("insert into gebaeude_heizung_standard(gebaeude_id, liegenschaft_id, art, vorhanden) values ($1,$2,$3,$4)", [gebaeudeId, L, art, b.heizungStandard[art]]);

  // 3. Einheiten aktualisieren/anlegen, Ausnahmen neu
  const einheitIds: string[] = [];
  for (const [i, e] of b.einheiten.entries()) {
    const werte = [e.geschossId, e.bezeichnung, e.art, e.flaecheM2, i, e.layoutManuell ? JSON.stringify(e.layoutManuell) : null];
    if (e.id) {
      await c.query("update einheit set geschoss_id=$2, bezeichnung=$3, art=$4, flaeche_m2=$5, reihenfolge=$6, layout_manuell=$7 where id=$1", [e.id, ...werte]);
      einheitIds.push(e.id); z.einheiten.aktualisiert++;
    } else {
      einheitIds.push((await c.query(
        "insert into einheit(liegenschaft_id, geschoss_id, bezeichnung, art, flaeche_m2, reihenfolge, layout_manuell) values ($1,$2,$3,$4,$5,$6,$7) returning id",
        [L, ...werte])).rows[0].id);
      z.einheiten.angelegt++;
    }
  }
  await c.query("delete from einheit_heizung where einheit_id = any($1::uuid[])", [einheitIds]);
  for (const [i, e] of b.einheiten.entries())
    for (const art of HEIZ_ARTEN) {
      const v = e.heizungAusnahme?.[art];
      if (v) await c.query("insert into einheit_heizung(einheit_id, liegenschaft_id, art, vorhanden) values ($1,$2,$3,$4)", [einheitIds[i], L, art, v]);
    }

  // 4. Bauteile aktualisieren/anlegen, Versorgung
  const einheitVon = (v: { einheitId?: string; einheitIndex?: number }) => v.einheitId ?? (v.einheitIndex !== undefined ? einheitIds[v.einheitIndex] : null);
  for (const [j, t] of b.bauteile.entries()) {
    const werte = [t.katalogId, einheitVon(t.standort), t.standort.geschossId ?? null, t.menge, t.status, t.hersteller ?? null, t.typ ?? null,
      t.baujahr ?? null, j, t.positionManuell ? JSON.stringify(t.positionManuell) : null];
    let id: string;
    if (t.id) {
      await c.query(
        "update bauteil set katalog_id=$2, einheit_id=$3, geschoss_id=$4, menge=$5, status=$6, hersteller=$7, typ=$8, baujahr=$9, reihenfolge=$10, position_manuell=$11 where id=$1",
        [t.id, ...werte]);
      id = t.id; z.bauteile.aktualisiert++;
    } else {
      id = (await c.query(
        `insert into bauteil(liegenschaft_id, gebaeude_id, katalog_id, einheit_id, geschoss_id, menge, status, hersteller, typ, baujahr, reihenfolge, position_manuell)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`, [L, gebaeudeId, ...werte])).rows[0].id;
      z.bauteile.angelegt++;
    }
    for (const v of t.versorgt)
      await c.query("insert into versorgung(bauteil_id, einheit_id, liegenschaft_id) values ($1,$2,$3) on conflict do nothing", [id, einheitVon(v), L]);
  }

  // 5. Entfallende Einheiten erst jetzt loeschen (Bauteile zeigen nicht mehr darauf)
  z.einheiten.geloescht = (await c.query(
    "delete from einheit where geschoss_id in (select id from geschoss where gebaeude_id=$1) and not (id = any($2::uuid[]))",
    [gebaeudeId, einheitIds])).rowCount ?? 0;

  await c.query("update gebaeude set stand=stand+1 where id=$1", [gebaeudeId]);
  return z;
}
