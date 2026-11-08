"""S1 Auswertung: vergleicht laeufe/*.json automatisch mit raeume.csv.

Aufruf (aus spikes/):  _werkzeuge/venv/Scripts/python s01-grundriss/auswerten.py
Schreibt s01-grundriss/ergebnis.json und druckt eine Markdown-Tabelle.

Umrechnung Seite -> Meter, zwei Verfahren:
  M1 "Referenzpunkt gesetzt": Massstab 1:100 aus Plankopf/Massstabsleiste, Referenzpunkt
     (Gebaeudeecke Suedwest) einmal pro Geschoss vom Benutzer gesetzt (03 Kap. 6). Hier: aus der
     Vektor-PDF bekannter Rahmen -> entspricht einem exakten Benutzerklick.
  M2 "vollautomatisch": Massstab = Median(Stempelflaeche / Rechteckflaeche) (03 Kap. 6),
     Ursprung = linke untere Ecke der Huelle aller erkannten Rechtecke.
Zusaetzlich: Vektor-Baseline ohne KI (gefuellte Rechtecke aus der PDF, Zuordnung per Stempel).
"""
import csv, json, math, pathlib, statistics as st
import pymupdf

HIER = pathlib.Path(__file__).parent
DATEN = HIER.parent / "beispiele" / "lindenhof"
PT_PRO_M = 72 / 25.4 * 10  # 1:100 -> 1 m = 10 mm Papier = 28.3465 pt

def soll_laden():
    with open(DATEN / "raeume.csv", encoding="utf-8-sig") as f:
        return {r["room_id"]: r for r in csv.DictReader(f, delimiter=";")}

def seite(gs):
    p = pymupdf.open(DATEN / f"01_Grundriss_{gs}.pdf")[0]
    rects = [it[1] for d in p.get_drawings() for it in d["items"] if it[0] == "re" and d.get("fill") and it[1].width > 60 and it[1].height > 60]
    x0 = min(r.x0 for r in rects); y1 = max(r.y1 for r in rects)
    return p, p.rect.width, p.rect.height, x0, y1, rects

def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    i = ix * iy; u = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - i
    return i / u if u > 0 else 0

def soll_rect(r):
    x, y, w, d = (float(r[k]) for k in ("x_m", "y_m", "width_m", "depth_m"))
    return (x, y, x + w, y + d)

def m1(rn, W, H, ox, oy, dx=0.0, dy=0.0):
    """normiert (oben links) -> Meter (Suedwest-Ursprung), bekannter Massstab + Referenzpunkt.
    dx/dy: Lage des Bildausschnitts auf der Seite (Variante C)."""
    xa = (dx + rn["x0"]*W - ox) / PT_PRO_M; xb = (dx + rn["x1"]*W - ox) / PT_PRO_M
    ya = (oy - dy - rn["y1"]*H) / PT_PRO_M; yb = (oy - dy - rn["y0"]*H) / PT_PRO_M
    return (xa, ya, xb, yb)

def m2_alle(raeume, W, H):
    # Massstab aus Stempeln: m2 pro pt2 -> m pro pt
    ratios = []
    for r in raeume:
        q = r["rechteck"]; a = (q["x1"]-q["x0"])*W*(q["y1"]-q["y0"])*H
        if r.get("stempel_flaeche_m2") and a > 0: ratios.append(r["stempel_flaeche_m2"] / a)
    if not ratios: return {}, None
    m_pro_pt = math.sqrt(st.median(ratios))
    ox = min(r["rechteck"]["x0"] for r in raeume) * W; oy = max(r["rechteck"]["y1"] for r in raeume) * H
    out = {}
    for r in raeume:
        q = r["rechteck"]
        out[r["nummer"]] = ((q["x0"]*W-ox)*m_pro_pt, (oy-q["y1"]*H)*m_pro_pt, (q["x1"]*W-ox)*m_pro_pt, (oy-q["y0"]*H)*m_pro_pt)
    return out, 1 / m_pro_pt

def bewerten(ist, soll_ids, soll):
    zeilen = {}
    for rid in soll_ids:
        s = soll_rect(soll[rid]); i = ist.get(rid)
        if i is None: zeilen[rid] = None; continue
        dev = max(abs(i[k]-s[k]) for k in range(4))
        zeilen[rid] = {"iou": round(iou(i, s), 4), "max_eckabweichung_m": round(dev, 3)}
    return zeilen

def zusammenfassen(zeilen, n_soll, n_ist, falsch_pos):
    ok = [z for z in zeilen.values() if z and z["iou"] >= 0.5]
    ious = [z["iou"] if z else 0.0 for z in zeilen.values()]
    devs = [z["max_eckabweichung_m"] for z in zeilen.values() if z]
    return {"recall_iou50": round(len(ok)/n_soll, 3), "median_iou": round(st.median(ious), 4), "min_iou": round(min(ious), 4),
            "median_eckabw_m": round(st.median(devs), 3) if devs else None, "max_eckabw_m": round(max(devs), 3) if devs else None,
            "erkannt": n_ist, "falsch_positiv": falsch_pos}

def main():
    soll = soll_laden(); ergebnis = {"laeufe": {}, "vektor_baseline": {}}
    seiten = {gs: seite(gs) for gs in ("EG", "OG")}
    for f in sorted((HIER / "laeufe").glob("*.json")):
        lauf = json.loads(f.read_text(encoding="utf-8")); res = {}
        alle_m1, alle_m2, n_ist, fp, stempel_ok, stempel_n = {}, {}, 0, 0, 0, 0
        for g in lauf["geschosse"]:
            gs = g["geschoss"]; p, W, H, ox, oy, _ = seiten[gs]; dx = dy = 0.0
            if lauf["variante"] == "C":
                c = json.loads((HIER / "eingabe" / "ausschnitt_clip.json").read_text())["clip_pt"]
                dx, dy, W, H = c[0], c[1], c[2] - c[0], c[3] - c[1]
            ids = [k for k in soll if k.startswith(gs)]
            n_ist += len(g["raeume"])
            for r in g["raeume"]:
                if r["nummer"] not in ids: fp += 1; continue
                alle_m1[r["nummer"]] = m1(r["rechteck"], W, H, ox, oy, dx, dy)
                s = soll[r["nummer"]]; stempel_n += 1
                if r.get("bezeichnung") == s["name"] and abs((r.get("stempel_flaeche_m2") or -1) - float(s["nominal_area_m2"])) < 0.05: stempel_ok += 1
            m2, massstab = m2_alle(g["raeume"], W, H)
            alle_m2.update(m2); res[f"massstab_pt_pro_m_{gs}"] = round(massstab, 3) if massstab else None
        z1 = bewerten(alle_m1, list(soll), soll); z2 = bewerten(alle_m2, list(soll), soll)
        res["M1"] = zusammenfassen(z1, len(soll), n_ist, fp); res["M2"] = zusammenfassen(z2, len(soll), n_ist, fp)
        res["stempel_korrekt"] = f"{stempel_ok}/{len(soll)}"; res["je_raum_M1"] = z1; res["rechtecke_m1"] = {k: [round(v, 3) for v in r] for k, r in alle_m1.items()}
        ergebnis["laeufe"][lauf["lauf"]] = res
    # Vektor-Baseline (ohne KI): gefuellte Rechtecke + Stempeltext im Rechteck
    ist = {}
    for gs, (p, W, H, ox, oy, rects) in seiten.items():
        words = p.get_text("words")
        for r in rects:
            for w in words:
                if w[4].startswith(gs + "-") and r.x0 <= w[0] <= r.x1 and r.y0 <= w[1] <= r.y1:
                    ist[w[4]] = ((r.x0-ox)/PT_PRO_M, (oy-r.y1)/PT_PRO_M, (r.x1-ox)/PT_PRO_M, (oy-r.y0)/PT_PRO_M); break
    zb = bewerten(ist, list(soll), soll); ergebnis["vektor_baseline"] = zusammenfassen(zb, len(soll), len(ist), 0)
    # Streuung zwischen Laeufen je Variante (Standardabweichung der Eckkoordinaten, M1)
    for v in ("A", "B", "C"):
        runs = [r for k, r in ergebnis["laeufe"].items() if k.startswith(v)]
        sds = []
        for rid in soll:
            vals = [r["rechtecke_m1"].get(rid) for r in runs]
            vals = [x for x in vals if x]
            if len(vals) >= 2:
                sds.append(max(st.pstdev([x[k] for x in vals]) for k in range(4)))
        ergebnis[f"streuung_{v}"] = {"median_sd_m": round(st.median(sds), 3) if sds else None, "max_sd_m": round(max(sds), 3) if sds else None}
    (HIER / "ergebnis.json").write_text(json.dumps(ergebnis, ensure_ascii=False, indent=1), encoding="utf-8")
    print("| Lauf | Recall (IoU>=0.5) | Median-IoU | Min-IoU | Median Eckabw. m | Max Eckabw. m | Stempel korrekt | M2 Median-IoU | M2 Max Eckabw. m | Massstab EG/OG pt/m (Soll 28.346) |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for k, r in ergebnis["laeufe"].items():
        a, b = r["M1"], r["M2"]
        print(f"| {k} | {a['recall_iou50']:.0%} | {a['median_iou']} | {a['min_iou']} | {a['median_eckabw_m']} | {a['max_eckabw_m']} | {r['stempel_korrekt']} | {b['median_iou']} | {b['max_eckabw_m']} | {r['massstab_pt_pro_m_EG']} / {r['massstab_pt_pro_m_OG']} |")
    vb = ergebnis["vektor_baseline"]
    print(f"| Vektor-Baseline (ohne KI) | {vb['recall_iou50']:.0%} | {vb['median_iou']} | {vb['min_iou']} | {vb['median_eckabw_m']} | {vb['max_eckabw_m']} | – | – | – | – |")
    print("Streuung:", {v: ergebnis[f"streuung_{v}"] for v in "ABC"})

if __name__ == "__main__":
    main()
