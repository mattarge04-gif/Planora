"""S2 Auswertung: vergleicht laeufe/E*.json automatisch mit bauteile.csv, pruefwerte.json und den
Datenblaettern (Sollwerte unten, aus projekt.json abgeleitet) und wendet den deterministischen
Validator aus 03 Kap. 5.6 an (Schema/Katalog, Grounding, Wert im Zitat, Plausibilitaet).

Aufruf (aus spikes/):  _werkzeuge/venv/Scripts/python s02-extraktion/auswerten.py
"""
import csv, json, pathlib, re, difflib, statistics as st
from collections import Counter, defaultdict
import pymupdf

HIER = pathlib.Path(__file__).parent
DATEN = HIER.parent / "beispiele" / "lindenhof"
KATALOG = {e["katalog_id"] for e in json.loads((HIER / "prompt" / "katalog.test.json").read_text(encoding="utf-8"))["eintraege"]}

# Sollwerte je Typ (aus projekt.json "types"; Leistung nach Regel 4 im Prompt)
SOLL_TYP = {
    "LT-01": ("leuchte.panel", "TESTLIGHT P600", [0.036], None, 50000),
    "LT-02": ("leuchte.downlight", "TESTLIGHT D180", [0.014], None, 40000),
    "HK-01": ("heizung.heizkoerper", "TESTHEAT P22-1000", [1.0], None, None),
    "HK-02": ("heizung.heizkoerper", "TESTHEAT P22-600", [0.6], None, None),
    "WP-01": ("heizung.waermepumpe_luft_wasser", "TESTTHERM AW18", [18.0], None, None),
    "MB-01": ("lueftung.monoblock", "TESTAIR M1500", [1.2], None, None),
    "P-01": ("pumpe.umwaelz", "TESTPUMP H25", [0.09], None, None),
    "VAV-01": ("lueftung.vav_regler", "TESTFLOW V160", [None, 0.003], None, None),  # "3 VA": null oder 0.003 beide ok
    "CO2-01": ("automation.raumsensor_co2", "TESTSENSE C2T", [0.002], None, None),
}
SOLL_HERSTELLER = "lindenhof test systems"

def norm(t):
    t = t.replace("×", "x").replace("–", "-").replace("³", "3").replace("²", "2")
    return re.sub(r"\s+", " ", t).strip().lower()

TEXT = {}
def seitentext(dok, seite):
    k = (dok, seite)
    if k not in TEXT:
        try: TEXT[k] = norm(pymupdf.open(DATEN / dok)[seite - 1].get_text())
        except Exception: TEXT[k] = ""
    return TEXT[k]

def grounding(feld):
    """exakt | unscharf (>=0.9) | fehlt  (03 Kap. 5.6 Punkt 2)"""
    txt = seitentext(feld["dokument"], feld["seite"]); z = norm(feld["zitat"])
    if not txt: return "fehlt"
    if z in txt: return "exakt"
    # bestes Fenster gleicher Laenge
    best = 0.0; L = len(z)
    for i in range(0, max(1, len(txt) - L + 1), 3):
        r = difflib.SequenceMatcher(None, z, txt[i:i + L]).ratio()
        if r > best: best = r
    return "unscharf" if best >= 0.9 else "fehlt"

def zahlen(z):
    z = re.sub(r"(?<=\d)[ '  ](?=\d{3}\b)", "", z)
    return [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", z)]

def wert_im_zitat(wert, zitat):
    if not isinstance(wert, (int, float)): return norm(str(wert)) in norm(zitat)
    return any(abs(n - wert) < 1e-9 or abs(n - wert * 1000) < 1e-6 or abs(n / 1000 - wert) < 1e-9 for n in zahlen(zitat))

PLAUS = {"leistung_kw": lambda v: v > 0, "lebensdauer_jahre": lambda v: 1 <= v <= 100, "lebensdauer_stunden": lambda v: 1000 <= v <= 200000}

def soll_elemente():
    with open(DATEN / "bauteile.csv", encoding="utf-8-sig") as f:
        c = Counter((r["type_id"], None if r["room_id"] == "AUSSEN-NORD" else r["room_id"]) for r in csv.DictReader(f, delimiter=";"))
    return c

def main():
    pruef = json.loads((DATEN / "pruefwerte.json").read_text(encoding="utf-8"))
    soll_el = soll_elemente(); res = {}
    for f in sorted((HIER / "laeufe").glob("E*.json")):
        d = json.loads(f.read_text(encoding="utf-8")); r = {"felder": {}, "fehler": []}
        typen = {t["typ_ref"]: t for t in d["elementtypen"]}
        treffer = gesamt = 0; erfunden = 0; validiert = Counter(); falsch_aber_valid = 0; stufe_hoch = [0, 0]
        for tid, (kat, modell, leist, ljahre, lstd) in SOLL_TYP.items():
            t = typen.get(tid)
            if not t: r["fehler"].append(f"Typ {tid} fehlt"); gesamt += 6; continue
            soll = {"katalog_id": kat, "hersteller": SOLL_HERSTELLER, "typbezeichnung": modell, "leistung_kw": leist, "lebensdauer_jahre": ljahre, "lebensdauer_stunden": lstd}
            for m, sw in soll.items():
                feld = t.get(m); gesamt += 1
                ist = None if feld is None else feld.get("wert")
                if m == "leistung_kw": ok = any((ist is None and s is None) or (ist is not None and s is not None and abs(ist - s) < 1e-6) for s in sw)
                elif m == "hersteller": ok = ist is not None and SOLL_HERSTELLER in norm(str(ist))
                elif isinstance(sw, str): ok = ist is not None and norm(str(ist)) == norm(sw)
                else: ok = (ist is None and sw is None) or (ist is not None and sw is not None and abs(ist - sw) < 1e-6)
                treffer += ok
                if not ok: r["fehler"].append(f"{tid}.{m}: ist={ist} soll={sw}")
                if feld is not None and (sw is None or sw == [None]): erfunden += 1
                if feld is not None:
                    # Validator 03 Kap. 5.6
                    v1 = (m != "katalog_id") or (ist in KATALOG)
                    g = grounding(feld) if feld.get("zitat") else "fehlt"
                    v3 = wert_im_zitat(ist, feld["zitat"]) if m not in ("katalog_id",) else True
                    v4 = PLAUS.get(m, lambda v: True)(ist) if isinstance(ist, (int, float)) else True
                    stufe = "tief"
                    if v1 and v3 and v4 and g == "exakt" and feld.get("konfidenz", 0) >= 0.9: stufe = "hoch"
                    elif v1 and v3 and v4 and g != "fehlt" and feld.get("konfidenz", 0) >= 0.6: stufe = "mittel"
                    validiert[stufe] += 1
                    if stufe == "hoch": stufe_hoch[0] += ok; stufe_hoch[1] += 1
                    if stufe != "tief" and not ok: falsch_aber_valid += 1
                    r["felder"][f"{tid}.{m}"] = {"ok": ok, "grounding": g, "wert_im_zitat": v3, "stufe": stufe}
        # Elemente
        ist_el = Counter()
        for e in d["elemente"]: ist_el[(e["typ_ref"], e["raum_nummer"])] += e["menge"]
        zeilen_ok = sum(1 for k, v in soll_el.items() if ist_el.get(k) == v)
        zeilen_fp = sum(1 for k in ist_el if k not in soll_el)
        je_typ = Counter(); [je_typ.update({k[0]: v}) for k, v in ist_el.items()]
        typ_ok = sum(1 for k, v in pruef["counts_by_type"].items() if je_typ.get(k) == v)
        el_ground = Counter(grounding(e) for e in d["elemente"])
        res[d["lauf"]] = {
            "typfelder_treffer": f"{treffer}/{gesamt}", "typfelder_quote": round(treffer / gesamt, 3),
            "erfundene_werte": erfunden,
            "elementzeilen_korrekt": f"{zeilen_ok}/{len(soll_el)}", "elementzeilen_falsch_positiv": zeilen_fp,
            "anzahl_je_typ_korrekt": f"{typ_ok}/{len(pruef['counts_by_type'])}", "summe_instanzen": sum(ist_el.values()),
            "validator_stufen_typfelder": dict(validiert), "praezision_hoch": f"{stufe_hoch[0]}/{stufe_hoch[1]}",
            "falsch_aber_validierung_bestanden": falsch_aber_valid,
            "grounding_elementzeilen": dict(el_ground), "fehler": r["fehler"], "felder": r["felder"],
        }
    (HIER / "ergebnis.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print("| Lauf | Typfelder korrekt | Erfundene Werte | Elementzeilen (Typ+Raum+Menge) | Anzahl je Typ | Summe Instanzen (Soll 113) | Stufen hoch/mittel/tief | Praezision hoch | Falsch, aber Validierung bestanden | Grounding Elementzeilen |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for k, v in res.items():
        s = v["validator_stufen_typfelder"]
        print(f"| {k} | {v['typfelder_treffer']} ({v['typfelder_quote']:.0%}) | {v['erfundene_werte']} | {v['elementzeilen_korrekt']} (+{v['elementzeilen_falsch_positiv']} FP) | {v['anzahl_je_typ_korrekt']} | {v['summe_instanzen']} | {s.get('hoch',0)}/{s.get('mittel',0)}/{s.get('tief',0)} | {v['praezision_hoch']} | {v['falsch_aber_validierung_bestanden']} | {v['grounding_elementzeilen']} |")
    for k, v in res.items():
        if v["fehler"]: print(k, "Fehler:", v["fehler"])
        tief = [f for f, x in v["felder"].items() if x["stufe"] != "hoch"]
        print(k, "nicht 'hoch':", {f: (v['felder'][f]['grounding'], v['felder'][f]['wert_im_zitat']) for f in tief})

if __name__ == "__main__":
    main()
