import type pg from "pg";
import { FachFehler } from "../welt/speicher.js";
import { rechne, type Ergebnis, type PreisHerkunft, type RechenTyp, type Zustand } from "./rechnung.js";
import { ERSATZ_LEBENSDAUER, STANDARD_LEBENSDAUER, lebensdauerBereich } from "./standard.js";

export interface PreisQuelle { dokumentId: string | null; dateiname: string | null; seite: number | null }
export interface LebensdauerBauteil { id: string; katalogId: string; menge: number | null; baujahr: number | null;
  hersteller: string | null; typ: string | null; ort: string;
  akte: { zustand: Zustand | null; lebensdauerJahre: number | null; stueckpreis: number | null; quellePreis: PreisHerkunft | null; notiz: string | null; preisQuelle: PreisQuelle | null } | null }
export interface LebensdauerStand { gebaeudeId: string; stand: number; heizungBaujahr: number | null;
  typen: (RechenTyp & { standard: number; bereich: { min: number; max: number }; preisQuelle: PreisQuelle | null })[];
  bauteile: LebensdauerBauteil[]; ergebnis: Ergebnis }
export interface LebensdauerEingabe { stand: number; heizungBaujahr?: number | null;
  bauteile?: { id: string; baujahr?: number | null; zustand?: Zustand | null; lebensdauerJahre?: number | null; stueckpreis?: number | null; notiz?: string | null }[];
  typen?: { katalogId: string; lMittel?: number | null; stueckpreis?: number | null; gelbJahre?: number | null }[] }

const quelleVon = (r: any): PreisQuelle | null => r.quelle_preis === "dokument" ? { dokumentId: r.pv_dok ?? null, dateiname: r.pv_datei ?? null, seite: r.pv_seite ?? null } : null;
const zahl = (v: string | number | null) => (v === null ? null : Number(v));

export async function ladeLebensdauer(c: pg.ClientBase, gebaeudeId: string, stichtag: number): Promise<LebensdauerStand | null> {
  const g = (await c.query("select liegenschaft_id, stand from gebaeude where id=$1", [gebaeudeId])).rows[0];
  if (!g) return null;
  const heizungBaujahr = (await c.query("select heizung_baujahr from gebaeude_erneuerung where gebaeude_id=$1", [gebaeudeId])).rows[0]?.heizung_baujahr ?? null;
  const zeilen = (await c.query(
    `select b.id, b.katalog_id, b.menge, b.baujahr, b.hersteller, b.typ,
            coalesce(gs.code, ge.code) geschoss, e.bezeichnung einheit,
            a.bauteil_id akte, a.zustand, a.lebensdauer_jahre, a.stueckpreis, a.quelle_preis, a.notiz,
            pv.seite pv_seite, d.id pv_dok, d.dateiname pv_datei
       from bauteil b
       left join einheit e on e.id = b.einheit_id
       left join geschoss ge on ge.id = e.geschoss_id
       left join geschoss gs on gs.id = b.geschoss_id
       left join bauteil_akte a on a.bauteil_id = b.id
       left join preis_vorschlag pv on pv.id = a.preis_vorschlag_id
       left join dokument d on d.id = pv.dokument_id
      where b.gebaeude_id=$1 order by b.reihenfolge`, [gebaeudeId])).rows;
  const typZeilen = new Map((await c.query(`select t.katalog_id, t.l_mittel, t.stueckpreis, t.quelle_preis, t.gelb_jahre, pv.seite pv_seite, d.id pv_dok, d.dateiname pv_datei
       from lebensdauer_typ t left join preis_vorschlag pv on pv.id = t.preis_vorschlag_id left join dokument d on d.id = pv.dokument_id where t.liegenschaft_id=$1`, [g.liegenschaft_id]))
    .rows.map((r) => [r.katalog_id as string, r]));
  const bauteile: LebensdauerBauteil[] = zeilen.map((r) => ({
    id: r.id, katalogId: r.katalog_id, menge: r.menge, baujahr: r.baujahr, hersteller: r.hersteller, typ: r.typ,
    ort: r.einheit ? `${r.geschoss} · ${r.einheit}` : r.geschoss,
    akte: r.akte ? { zustand: r.zustand, lebensdauerJahre: r.lebensdauer_jahre, stueckpreis: zahl(r.stueckpreis), quellePreis: r.quelle_preis, notiz: r.notiz, preisQuelle: quelleVon(r) } : null,
  }));
  const typen = [...new Set(bauteile.map((b) => b.katalogId))].map((katalogId) => {
    const t = typZeilen.get(katalogId), standard = STANDARD_LEBENSDAUER[katalogId] ?? ERSATZ_LEBENSDAUER;
    return { katalogId, lMittel: t?.l_mittel ?? null, stueckpreis: zahl(t?.stueckpreis ?? null), quellePreis: t?.quelle_preis ?? null,
      gelbJahre: t?.gelb_jahre ?? null, preisQuelle: t ? quelleVon(t) : null, standard, bereich: lebensdauerBereich(standard) };
  });
  const ergebnis = rechne({ stichtag, heizungBaujahr, typen, bauteile: bauteile.map((b) => ({ id: b.id, katalogId: b.katalogId, menge: b.menge, baujahr: b.baujahr, akte: b.akte })) });
  return { gebaeudeId, stand: g.stand, heizungBaujahr, typen, bauteile, ergebnis };
}

/** Feld weggelassen = unveraendert, null = loeschen. Baujahr-Aenderung erhoeht gebaeude.stand (Assistent mit altem Stand -> 409). */
export async function schreibeLebensdauer(c: pg.ClientBase, gebaeudeId: string, e: LebensdauerEingabe) {
  const g = (await c.query("select liegenschaft_id, stand from gebaeude where id=$1 for update", [gebaeudeId])).rows[0];
  if (!g) throw new FachFehler([{ pfad: "gebaeude", code: "nicht_gefunden", meldung: "Gebaeude nicht gefunden" }], 404);
  if (e.stand !== g.stand) throw new FachFehler([{ pfad: "stand", code: "stand_veraltet", meldung: "Daten wurden inzwischen geaendert; bitte neu laden" }], 409);
  const L = g.liegenschaft_id as string;
  let baujahrGeaendert = false;
  if (e.heizungBaujahr !== undefined) {
    const alt = (await c.query("select heizung_baujahr from gebaeude_erneuerung where gebaeude_id=$1", [gebaeudeId])).rows[0]?.heizung_baujahr ?? null;
    if (alt !== e.heizungBaujahr) baujahrGeaendert = true;
    await c.query(`insert into gebaeude_erneuerung(gebaeude_id, liegenschaft_id, heizung_baujahr) values ($1,$2,$3)
      on conflict (gebaeude_id) do update set heizung_baujahr=excluded.heizung_baujahr`, [gebaeudeId, L, e.heizungBaujahr]);
  }
  const eigene = new Map((await c.query("select id, baujahr from bauteil where gebaeude_id=$1", [gebaeudeId])).rows.map((r) => [r.id as string, r.baujahr as number | null]));
  for (const [i, b] of (e.bauteile ?? []).entries()) {
    const id = b.id.toLowerCase();
    if (!eigene.has(id)) throw new FachFehler([{ pfad: `bauteile/${i}/id`, code: "bauteil_unbekannt", meldung: "Bauteil gehoert nicht zu diesem Gebaeude" }], 400);
    if (b.baujahr !== undefined && b.baujahr !== eigene.get(id)) {
      baujahrGeaendert = true;
      await c.query("update bauteil set baujahr=$2 where id=$1", [id, b.baujahr]);
    }
    const alt = (await c.query("select zustand, lebensdauer_jahre, stueckpreis, quelle_preis, notiz from bauteil_akte where bauteil_id=$1", [id])).rows[0] ?? {};
    const neu = {
      zustand: b.zustand !== undefined ? b.zustand : alt.zustand ?? null,
      lebensdauer: b.lebensdauerJahre !== undefined ? b.lebensdauerJahre : alt.lebensdauer_jahre ?? null,
      preis: b.stueckpreis !== undefined ? b.stueckpreis : zahl(alt.stueckpreis ?? null),
      notiz: b.notiz !== undefined ? b.notiz : alt.notiz ?? null,
    };
    const quelle = neu.preis === null ? null : b.stueckpreis !== undefined && b.stueckpreis !== zahl(alt.stueckpreis ?? null) ? "kunde" : alt.quelle_preis ?? "kunde";
    if (Object.values(neu).every((v) => v === null)) {
      // Datenblatt (Bestand) bleibt: Zeile nur loeschen, wenn auch kein Datenblatt erfasst ist.
      await c.query("delete from bauteil_akte where bauteil_id=$1 and datenblatt is null", [id]);
      await c.query("update bauteil_akte set zustand=null, lebensdauer_jahre=null, stueckpreis=null, quelle_preis=null, notiz=null, preis_vorschlag_id=null where bauteil_id=$1", [id]);
    }
    else await c.query(`insert into bauteil_akte(bauteil_id, liegenschaft_id, zustand, lebensdauer_jahre, stueckpreis, quelle_preis, notiz)
      values ($1,$2,$3,$4,$5,$6,$7) on conflict (bauteil_id) do update set zustand=excluded.zustand, lebensdauer_jahre=excluded.lebensdauer_jahre,
      stueckpreis=excluded.stueckpreis, quelle_preis=excluded.quelle_preis, notiz=excluded.notiz,
      preis_vorschlag_id = case when excluded.quelle_preis = 'dokument' then bauteil_akte.preis_vorschlag_id else null end`,
      [id, L, neu.zustand, neu.lebensdauer, neu.preis, quelle, neu.notiz]);
  }
  for (const t of e.typen ?? []) {
    const alt = (await c.query("select l_mittel, stueckpreis, quelle_preis, gelb_jahre from lebensdauer_typ where liegenschaft_id=$1 and katalog_id=$2", [L, t.katalogId])).rows[0] ?? {};
    const neu = { l: t.lMittel !== undefined ? t.lMittel : alt.l_mittel ?? null, preis: t.stueckpreis !== undefined ? t.stueckpreis : zahl(alt.stueckpreis ?? null),
      gelb: t.gelbJahre !== undefined ? t.gelbJahre : alt.gelb_jahre ?? null };
    const quelle = neu.preis === null ? null : t.stueckpreis !== undefined && t.stueckpreis !== zahl(alt.stueckpreis ?? null) ? "kunde" : alt.quelle_preis ?? "kunde";
    if (Object.values(neu).every((v) => v === null)) await c.query("delete from lebensdauer_typ where liegenschaft_id=$1 and katalog_id=$2", [L, t.katalogId]);
    else await c.query(`insert into lebensdauer_typ(liegenschaft_id, katalog_id, l_mittel, stueckpreis, quelle_preis, gelb_jahre) values ($1,$2,$3,$4,$5,$6)
      on conflict (liegenschaft_id, katalog_id) do update set l_mittel=excluded.l_mittel, stueckpreis=excluded.stueckpreis, quelle_preis=excluded.quelle_preis, gelb_jahre=excluded.gelb_jahre,
      preis_vorschlag_id = case when excluded.quelle_preis = 'dokument' then lebensdauer_typ.preis_vorschlag_id else null end`,
      [L, t.katalogId, neu.l, neu.preis, quelle, neu.gelb]);
  }
  if (baujahrGeaendert) await c.query("update gebaeude set stand=stand+1 where id=$1", [gebaeudeId]);
  return { bauteile: e.bauteile?.length ?? 0, typen: e.typen?.length ?? 0, baujahrGeaendert };
}
