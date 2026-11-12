"""Prueft die Anlagen-GLB gegen den Modellvertrag (Teilaufgabe 4). Nur Python-Standardbibliothek.

Aufruf (Repo-Wurzel):  python docs/design/modelle/pruefen.py
Exit-Code 0 = alle Pruefungen bestanden. Ausgabe als Markdown-Tabelle (fuer README).
"""

import json
import math
import os
import struct
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HIER, "..", "..", ".."))
ORDNER = os.path.join(REPO, "app", "web", "public", "modelle")

# Zielmasse B x H x T in m (glTF: X = Breite, Y = Hoehe, Z = Tiefe)
ZIELE = {
    "heizung.waermepumpe": (1.0, 1.2, 0.6),
    "heizung.gaskessel": (0.6, 1.6, 0.6),
    "heizung.oelkessel": (0.7, 1.4, 0.8),
    "heizung.fernwaerme_uebergabe": (1.0, 1.4, 0.35),
    "heizung.speicher": (0.9, 1.8, 0.9),
    "heizung.umwaelzpumpe": (0.35, 0.45, 0.3),
    "heizung.verteiler": (1.2, 1.0, 0.3),
    "heizung.heizkoerper": (1.0, 0.65, 0.12),
    "heizung.fbh_kreis": (0.6, 0.8, 0.15),
    "heizung.ventil_3weg": (0.2, 0.25, 0.2),
    "heizung.ventil_2weg": (0.15, 0.25, 0.15),
    "heizung.wmz": (0.25, 0.2, 0.15),
}
# Verteiler mit Gruppen (Modellreihe, Laenge wie verteilerLaenge() in szene3/technik.ts)
for _k in range(1, 9):
    ZIELE[f"heizung.verteiler.n{_k}"] = (max(0.9, (_k - 1) * 0.34 + 0.6), 1.0, 0.3)
# Teile in der Leitung: Rohrachse statt Grundflaechenmitte im Ursprung (anschluss = unteres Rohrende bei 0, 0, 0)
INLINE = {"heizung.ventil_3weg", "heizung.ventil_2weg", "heizung.wmz"}


def max_dreiecke(katalog_id):
    """Verteiler-Reihe: Budget waechst mit der Anzahl Abgaenge (je Abgang zwei Kugelhaehne)."""
    if katalog_id.startswith("heizung.verteiler.n"):
        return MAX_DREIECKE + 1400 * max(0, int(katalog_id.rsplit("n", 1)[1]) - 4)
    return MAX_DREIECKE


def max_bytes(katalog_id):
    if katalog_id.startswith("heizung.verteiler.n"):
        return MAX_BYTES + 30 * 1000 * max(0, int(katalog_id.rsplit("n", 1)[1]) - 4)
    return MAX_BYTES
TOLERANZ = 0.05
MATERIALIEN = {"gehaeuse", "detail", "dunkel", "koo"}
MAX_DREIECKE = 8000
MAX_BYTES = 200 * 1000


def lese_glb(pfad):
    with open(pfad, "rb") as f:
        daten = f.read()
    magic, version, laenge = struct.unpack_from("<4sII", daten, 0)
    assert magic == b"glTF" and version == 2 and laenge == len(daten), "kein gueltiges GLB 2.0"
    lj, tj = struct.unpack_from("<I4s", daten, 12)
    assert tj == b"JSON"
    return json.loads(daten[20 : 20 + lj].decode("utf-8")), len(daten)


def _mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def _knoten_matrix(n):
    if "matrix" in n:
        m = n["matrix"]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    t = n.get("translation", [0, 0, 0])
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    s = n.get("scale", [1, 1, 1])
    r = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    return [
        [r[0][0] * s[0], r[0][1] * s[1], r[0][2] * s[2], t[0]],
        [r[1][0] * s[0], r[1][1] * s[1], r[1][2] * s[2], t[1]],
        [r[2][0] * s[0], r[2][1] * s[1], r[2][2] * s[2], t[2]],
        [0, 0, 0, 1],
    ]


def _anwenden(m, p):
    return [sum(m[i][k] * p[k] for k in range(3)) + m[i][3] for i in range(3)]


def pruefe(katalog_id):
    pfad = os.path.join(ORDNER, katalog_id + ".glb")
    fehler = []
    if not os.path.exists(pfad):
        return {"id": katalog_id, "fehler": ["Datei fehlt"]}
    g, groesse = lese_glb(pfad)

    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    dreiecke = 0
    anschluss = None

    def besuche(idx, eltern):
        nonlocal dreiecke, anschluss
        n = g["nodes"][idx]
        m = _mat_mul(eltern, _knoten_matrix(n))
        if n.get("name") == "anschluss" and "mesh" not in n:
            anschluss = _anwenden(m, [0, 0, 0])
        if "mesh" in n:
            for prim in g["meshes"][n["mesh"]]["primitives"]:
                acc = g["accessors"][prim["attributes"]["POSITION"]]
                a, b = acc["min"], acc["max"]
                for ecke in [(x, y, z) for x in (a[0], b[0]) for y in (a[1], b[1]) for z in (a[2], b[2])]:
                    w = _anwenden(m, ecke)
                    for i in range(3):
                        lo[i] = min(lo[i], w[i])
                        hi[i] = max(hi[i], w[i])
                if prim.get("mode", 4) != 4:
                    fehler.append("Primitive nicht als Dreiecke")
                if "indices" in prim:
                    dreiecke += g["accessors"][prim["indices"]]["count"] // 3
                else:
                    dreiecke += acc["count"] // 3
        for k in n.get("children", []):
            besuche(k, m)

    einheit = [[1 if i == j else 0 for j in range(4)] for i in range(4)]
    for wurzel in g["scenes"][g.get("scene", 0)]["nodes"]:
        besuche(wurzel, einheit)

    masse = [hi[i] - lo[i] for i in range(3)]
    ziel = ZIELE[katalog_id]
    for achse, ist, soll in zip("BHT", masse, ziel):
        if abs(ist - soll) > TOLERANZ:
            fehler.append(f"{achse} {ist:.3f} statt {soll:.2f}")
    if abs(lo[1]) > 0.005:
        fehler.append(f"Unterkante y={lo[1]:.3f}")
    mitte_x, mitte_z = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    if katalog_id in INLINE:
        if anschluss is None or max(abs(anschluss[0]), abs(anschluss[1]), abs(anschluss[2])) > 0.001:
            fehler.append("Rohrachse/anschluss nicht im Ursprung")
        if abs(hi[1] - ziel[1]) > 0.001:
            fehler.append(f"Rohrende oben y={hi[1]:.3f} statt {ziel[1]:.2f}")
    elif abs(mitte_x) > TOLERANZ or abs(mitte_z) > TOLERANZ:
        fehler.append(f"Ursprung nicht mittig ({mitte_x:.3f}, {mitte_z:.3f})")
    namen = {m.get("name") for m in g.get("materials", [])}
    if not MATERIALIEN.issubset(namen):
        fehler.append(f"Materialien fehlen: {sorted(MATERIALIEN - namen)}")
    if namen - MATERIALIEN:
        fehler.append(f"fremde Materialien: {sorted(namen - MATERIALIEN)}")
    benutzt = {g["materials"][p["material"]]["name"] for me in g["meshes"] for p in me["primitives"] if "material" in p}
    if "koo" not in benutzt:
        fehler.append("kein Teil mit Material koo")
    if anschluss is None:
        fehler.append("Empty 'anschluss' fehlt")
    if dreiecke >= max_dreiecke(katalog_id):
        fehler.append(f"{dreiecke} Dreiecke")
    if groesse >= max_bytes(katalog_id):
        fehler.append(f"{groesse} B")
    for schluessel in ("extensionsUsed", "images", "textures"):
        if g.get(schluessel):
            fehler.append(f"{schluessel} vorhanden: {g[schluessel]}")
    return {
        "id": katalog_id,
        "masse": masse,
        "unterkante": lo[1],
        "dreiecke": dreiecke,
        "bytes": groesse,
        "anschluss": anschluss,
        "fehler": fehler,
    }


def main():
    ergebnisse = [pruefe(k) for k in ZIELE]
    print("| Datei | B × H × T ist (m) | Soll | Dreiecke | Grösse | anschluss (x, y, z) | Ergebnis |")
    print("|---|---|---|---|---|---|---|")
    for e in ergebnisse:
        if "masse" not in e:
            print(f"| `{e['id']}.glb` | – | – | – | – | – | {'; '.join(e['fehler'])} |")
            continue
        b, h, t = e["masse"]
        sb, sh, st = ZIELE[e["id"]]
        a = e["anschluss"]
        a_txt = f"{a[0]:.2f}, {a[1]:.2f}, {a[2]:.2f}" if a else "–"
        status = "ok" if not e["fehler"] else "FEHLER: " + "; ".join(e["fehler"])
        print(
            f"| `{e['id']}.glb` | {b:.3f} × {h:.3f} × {t:.3f} | {sb:.2f} × {sh:.2f} × {st:.2f} | "
            f"{e['dreiecke']} | {e['bytes'] / 1000:.1f} kB | {a_txt} | {status} |"
        )
    fehlerhaft = [e for e in ergebnisse if e["fehler"]]
    print()
    print(f"Geprüft: {len(ergebnisse)}, bestanden: {len(ergebnisse) - len(fehlerhaft)}")
    sys.exit(1 if fehlerhaft else 0)


if __name__ == "__main__":
    main()
