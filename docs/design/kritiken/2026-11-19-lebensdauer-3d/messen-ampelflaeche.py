"""Ampelflaeche je Stufe im Szenenausschnitt (ohne Panels) und Farbtreue gegen Tokens (+-5 je Kanal)."""
import sys, glob, os, colorsys, json
from PIL import Image

TOK = {"rot": (0xd6, 0x45, 0x41), "gelb": (0xe0, 0x8a, 0x1e), "gruen": (0x2f, 0x9e, 0x6b), "grau": (0x8a, 0x92, 0x9e)}
# Szenenausschnitt je Fenster: zwischen linker Spalte und rechter Spalte, unter der Kopfzeile, ueber der Tabelle.
AUS = {(1440, 900): (356, 64, 1116, 604), (1920, 1080): (356, 64, 1596, 676), (1280, 720): (340, 60, 976, 516)}

def messen(pfad):
    im = Image.open(pfad).convert("RGB")
    box = AUS[im.size]
    c = im.crop(box); px = c.load(); w, h = c.size; n = w * h
    exakt = {k: 0 for k in TOK}; hsv = {"rot": 0, "gelb": 0, "gruen": 0}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            for k, t in TOK.items():
                if max(abs(p[i] - t[i]) for i in range(3)) <= 5: exakt[k] += 1
            hh, s, v = colorsys.rgb_to_hsv(*(q / 255 for q in p)); g = hh * 360
            if s >= 0.45:
                if g < 12 or g > 345: hsv["rot"] += 1
                elif 25 <= g <= 45: hsv["gelb"] += 1
                elif 140 <= g <= 170: hsv["gruen"] += 1
    return {"datei": os.path.basename(pfad), "flaeche_px": n,
            "exakt_pm5_prozent": {k: round(100 * v / n, 3) for k, v in exakt.items()},
            "hsv_prozent": {k: round(100 * v / n, 3) for k, v in hsv.items()},
            "hsv_anteil_exakt": {k: (round(exakt[k] / hsv[k], 2) if hsv[k] else None) for k in hsv}}

ordner = sys.argv[1]
res = [messen(f) for f in sorted(glob.glob(os.path.join(ordner, "modus-e-*.png")))]
json.dump(res, open(os.path.join(ordner, "messung-ampelflaeche.json"), "w"), indent=1)
for r in res:
    print(r["datei"], "HSV%", r["hsv_prozent"], "exakt%", r["exakt_pm5_prozent"], "Anteil exakt", r["hsv_anteil_exakt"])
