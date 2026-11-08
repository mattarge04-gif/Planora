"""Unabhaengiges Orakel fuer die Testtabelle FA-22: rechnet die Formeln aus 03 Kap. 8.3-8.6 direkt
mit Python Decimal (40 Stellen), ohne Code aus kern.ts. Schreibt erwartet.json.
Aufruf: python s10-rechenkern/orakel.py"""
import json, pathlib
from decimal import Decimal as D, getcontext, ROUND_HALF_UP
getcontext().prec = 40
HIER = pathlib.Path(__file__).parent
K, G, S, N, H = D("0.75"), D("0.25"), 2026, 3, 20

def rund(x): return int(x.quantize(D(1), rounding=ROUND_HALF_UP))

def aeq(z, L):
    ak = K * L
    if z >= D("0.4"): return ak * (1 - z) / D("0.6")
    if z > G: return ak + (L - ak) * ((D("0.4") - z) / (D("0.4") - G)).sqrt()
    return L

out = {}
for f in json.loads((HIER / "faelle.json").read_text(encoding="utf-8"))["faelle"]:
    L = D(f["L"]); b = f["bewertung"]
    if b:
        rl = L - aeq(D(b["z"]), L); J1 = b["jahr"] + rund(max(rl, D(0)))
    else:
        J1 = f["E"] + rund(L)
    ampel = "rot" if J1 <= S else ("gelb" if J1 <= S + N else "gruen")
    jahre, Jn = [], J1
    while Jn <= S + H - 1:
        jahre.append(max(Jn, S)); Jn += rund(L)
    kosten = None
    if f.get("preis"):
        i = D(f.get("teuerung", "0.01")); P = D(f["preis"]["rappen"]); p = f["preis"]["preisjahr"]
        kosten = [str(rund(f.get("menge", 1) * P * (1 + i) ** (j - p))) for j in jahre]
    out[f["id"]] = {"J1": J1, "RL": max(0, J1 - S), "ampel": ampel, "ereignis_jahre": jahre, "kosten_rappen": kosten}
(HIER / "erwartet.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
for k, v in out.items(): print(k, v)
