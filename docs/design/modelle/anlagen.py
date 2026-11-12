"""Planora – Anlagenmodelle Heizung (Teilaufgabe 4, Richtung A).

Erzeugt alle Modelle des Modellvertrags (docs/superpowers/plans/2026-11-12-teilaufgabe-4.md)
reproduzierbar aus Python, exportiert GLB nach app/web/public/modelle/ und rendert Kontrollbilder
nach docs/design/modelle/vorschau/.

Aufruf (Repo-Wurzel):
  blender --background --factory-startup --python docs/design/modelle/anlagen.py
  blender ... --python docs/design/modelle/anlagen.py -- --nur heizung.speicher --ohne-render
  blender ... --python docs/design/modelle/anlagen.py -- --uebersicht   (nur alle.png aus den GLB)

Koordinaten in Blender: Z oben, Vorderseite -Y (glTF-Export mit +Y oben -> Vorderseite +Z),
Ursprung Mitte Grundflaeche, Meter. Materialien: gehaeuse, detail, dunkel, koo.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HIER, "..", "..", ".."))
ZIEL_GLB = os.path.join(REPO, "app", "web", "public", "modelle")
ZIEL_BILD = os.path.join(HIER, "vorschau")

# ---------------------------------------------------------------------------
# Materialien (Werte aus app/web/src/design/tokens.ts, sRGB-Hex -> linear)
# ---------------------------------------------------------------------------

MATERIAL = {
    # name: (hex, roughness, metalness)
    "gehaeuse": ("#eef0f3", 0.55, 0.05),
    "detail": ("#a7aeb8", 0.45, 0.35),
    "dunkel": ("#5e6670", 0.6, 0.1),
    "koo": ("#e5322d", 0.6, 0.0),  # Farbe ersetzt der Code zur Laufzeit (TOKENS.farbe.kooHeizung)
}


def _linear(hex_wert):
    h = hex_wert.lstrip("#")
    werte = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        werte.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*werte, 1.0)


def materialien():
    m = {}
    for name, (farbe, rau, metall) in MATERIAL.items():
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = _linear(farbe)
        bsdf.inputs["Roughness"].default_value = rau
        bsdf.inputs["Metallic"].default_value = metall
        mat.diffuse_color = _linear(farbe)
        m[name] = mat
    return m


# ---------------------------------------------------------------------------
# Grundbausteine
# ---------------------------------------------------------------------------

TEILE = []  # alle Mesh-Objekte des aktuellen Modells


def _objekt(bm, name, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(M[mat])
    TEILE.append(ob)
    return ob


def _bevel(ob, breite, segmente=3, winkel=None):
    if breite <= 0:
        return ob
    mod = ob.modifiers.new("Bevel", "BEVEL")
    mod.width = breite
    mod.segments = segmente
    mod.profile = 0.5
    mod.use_clamp_overlap = True
    if winkel is None:
        mod.limit_method = "NONE"
    else:
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(winkel)
    return ob


def _achse(achse):
    if achse == "X":
        return Matrix.Rotation(math.radians(90), 4, "Y")
    if achse == "Y":
        return Matrix.Rotation(math.radians(90), 4, "X")
    return Matrix.Identity(4)


def kasten(w, d, h, x, y, z0, r, mat, segmente=3, name="kasten"):
    """Abgerundeter Kasten: Breite w (x), Tiefe d (y), Hoehe h (z); Mitte x/y, Unterkante z0.
    Schlanke Teile (kleinstes Mass < 6 cm) erhalten hoechstens 2 Bevel-Segmente (Budget)."""
    if min(w, d, h) < 0.06:
        segmente = min(segmente, 2)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(x, y, z0 + h / 2), verts=bm.verts)
    ob = _objekt(bm, name, mat)
    return _bevel(ob, min(r, 0.45 * min(w, d, h)), segmente)


def zyl(r, h, mitte, mat, achse="Z", n=24, fase=0.0, segmente=2, r2=None, name="zyl"):
    """Zylinder (oder Kegelstumpf mit r2) mit Mitte `mitte`, Laengsachse X/Y/Z.
    Kleine Teile (r < 3.5 cm) erhalten hoechstens 16 Segmente und eine einfache Fase (Budget)."""
    if r < 0.037 and n > 6:
        n = min(n, 16)
        segmente = 1
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=n, radius1=r,
        radius2=r if r2 is None else r2, depth=h,
    )
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(mitte)) @ _achse(achse), verts=bm.verts)
    ob = _objekt(bm, name, mat)
    if fase > 0:
        _bevel(ob, min(fase, 0.45 * min(r, h)), segmente, winkel=40)
    return ob


def ring(R, r, mitte, mat, achse="Z", n=32, m=8, name="ring"):
    """Torus mit Hauptradius R und Rohrradius r."""
    bm = bmesh.new()
    gitter = []
    for i in range(n):
        a = 2 * math.pi * i / n
        zeile = []
        for j in range(m):
            b = 2 * math.pi * j / m
            rr = R + r * math.cos(b)
            zeile.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(b))))
        gitter.append(zeile)
    for i in range(n):
        for j in range(m):
            bm.faces.new((gitter[i][j], gitter[(i + 1) % n][j], gitter[(i + 1) % n][(j + 1) % m], gitter[i][(j + 1) % m]))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(mitte)) @ _achse(achse), verts=bm.verts)
    return _objekt(bm, name, mat)


def rohr(punkte, r, mat, biegung=None, n=16, name="rohr"):
    """Rohr entlang eines rechtwinkligen Polygonzugs mit runden Boegen (Radius ca. 2.5 x r)."""
    biegung = biegung or 2.5 * r
    pts = [Vector(p) for p in punkte]
    pfad = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, p, b = pts[i - 1], pts[i], pts[i + 1]
        d1 = (p - a).normalized()
        d2 = (b - p).normalized()
        t = min(biegung, (p - a).length * 0.45, (b - p).length * 0.45)
        s, e = p - d1 * t, p + d2 * t
        for k in range(7):
            u = k / 6
            pfad.append((1 - u) ** 2 * s + 2 * (1 - u) * u * p + u * u * e)
    pfad.append(pts[-1])

    kurve = bpy.data.curves.new(name, "CURVE")
    kurve.dimensions = "3D"
    kurve.bevel_depth = r
    kurve.bevel_resolution = max(0, (n - 4) // 4)
    kurve.use_fill_caps = True
    sp = kurve.splines.new("POLY")
    sp.points.add(len(pfad) - 1)
    for i, q in enumerate(pfad):
        sp.points[i].co = (q.x, q.y, q.z, 1.0)
    ob = bpy.data.objects.new(name, kurve)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(kurve)
    neu = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(neu)
    me.materials.clear()
    me.materials.append(M[mat])
    TEILE.append(neu)
    return neu


# ---------------------------------------------------------------------------
# Zusammengesetzte Teile
# ---------------------------------------------------------------------------

def stutzen(x, y, z, laenge, r, achse="Z", richtung=1, koo=True, flansch=True):
    """Anschlussstutzen ab Punkt (x,y,z) entlang Achse; Flansch am Gehaeuse, KOO-Manschette."""
    v = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}[achse] * richtung
    p0 = Vector((x, y, z))
    zyl(r, laenge, p0 + v * (laenge / 2), "detail", achse, n=20, fase=r * 0.25)
    if flansch:
        zyl(r * 1.55, 0.014, p0 + v * 0.007, "detail", achse, n=24, fase=0.004)
    if koo:
        zyl(r * 1.14, laenge * 0.42, p0 + v * (laenge * 0.6), "koo", achse, n=20, fase=r * 0.2)
    # Verschraubung am Ende (Sechskant)
    zyl(r * 1.3, 0.022, p0 + v * (laenge - 0.011), "detail", achse, n=6, fase=0.003)


def kugelhahn(mitte, r, achse="Z", hebel="koo", hebel_richtung=(0, -1, 0)):
    """Kugelhahn auf Rohr (Achse), Hebel zeigt in hebel_richtung (senkrecht zur Rohrachse)."""
    c = Vector(mitte)
    zyl(r * 1.55, r * 3.2, c, "detail", achse, n=12, fase=r * 0.5)
    zyl(r * 1.85, 0.012, c + _achsvektor(achse) * r * 1.5, "detail", achse, n=6, fase=0.002)
    zyl(r * 1.85, 0.012, c - _achsvektor(achse) * r * 1.5, "detail", achse, n=6, fase=0.002)
    hr = Vector(hebel_richtung).normalized()
    hebel_achse = "X" if abs(hr.x) > 0.5 else ("Y" if abs(hr.y) > 0.5 else "Z")
    spindel = c + hr * (r * 1.9)
    zyl(r * 0.45, r * 1.2, spindel, "detail", hebel_achse, n=8)
    # flacher Hebel quer zur Rohrachse
    lang = r * 4.5
    p = spindel + hr * (r * 0.6)
    ax = _achsvektor(achse)
    quer = ax * lang * 0.5
    mx = p + quer
    dims = [r * 1.1, r * 1.1, r * 1.1]
    for i, k in enumerate("XYZ"):
        if abs(ax[i]) > 0.5:
            dims[i] = lang
        if abs(hr[i]) > 0.5:
            dims[i] = r * 0.55
    kasten(dims[0], dims[1], dims[2], mx.x, mx.y, mx.z - dims[2] / 2, r * 0.25, hebel, segmente=1)


def _achsvektor(achse):
    return {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}[achse]


def typenschild(x, y_front, z, w, h):
    """Typenschild als leichtes Relief auf einer Vorderseite (y_front = Flaechenposition)."""
    kasten(w, 0.006, h, x, y_front - 0.002, z - h / 2, 0.004, "detail", segmente=2)
    # zwei Textzeilen als feine Erhebungen
    for i, f in enumerate((0.62, 0.42)):
        kasten(w * (0.7 if i == 0 else 0.5), 0.004, h * 0.09, x - w * (0.1 if i == 0 else 0.2),
               y_front - 0.005, z - h / 2 + h * f, 0.001, "gehaeuse", segmente=1)


def anzeige(x, y_front, z, w, h):
    """Display/Bedienfeld: dunkle Scheibe im hellen Rahmen."""
    kasten(w + 0.02, 0.008, h + 0.02, x, y_front - 0.002, z - (h + 0.02) / 2, 0.006, "detail", segmente=2)
    kasten(w, 0.006, h, x, y_front - 0.006, z - h / 2, 0.004, "dunkel", segmente=2)


def fuesse(xs, ys, h, r, mat="detail"):
    for x in xs:
        for y in ys:
            zyl(r, h, (x, y, h / 2), mat, n=16, fase=0.004)


def anschluss(x, y, z):
    ob = bpy.data.objects.new("anschluss", None)
    ob.empty_display_type = "PLAIN_AXES"
    ob.empty_display_size = 0.08
    ob.location = (x, y, z)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------------------
# Modelle (Masse B x H x T gemaess Vertrag; Blender: x = B, y = T, z = H)
# ---------------------------------------------------------------------------

def waermepumpe():
    # 1.0 x 1.2 x 0.6 – Kompaktgeraet, Luefter vorn, Anschluesse oben
    W, D = 1.0, 0.6
    kasten(0.92, 0.52, 0.05, 0, 0, 0, 0.01, "detail")                  # Sockel (Schattenfuge)
    kasten(W, D, 1.06, 0, 0, 0.04, 0.035, "gehaeuse")                 # Korpus
    kasten(W - 0.03, D - 0.03, 0.03, 0, 0, 1.09, 0.012, "gehaeuse")   # Deckel
    yf = -D / 2
    # Luefter: Blende, Gitterhintergrund, konzentrische Gitterringe, Nabe, Streben
    fx, fz, fr = 0.17, 0.56, 0.29
    ring(fr + 0.004, 0.016, (fx, yf - 0.002, fz), "gehaeuse", "Y", n=48, m=8)
    zyl(fr, 0.01, (fx, yf + 0.004, fz), "dunkel", "Y", n=48)
    for rr in (0.075, 0.13, 0.185, 0.24):
        ring(rr, 0.0055, (fx, yf - 0.004, fz), "gehaeuse", "Y", n=32, m=5)
    for a in (0, 90):
        rot = Matrix.Rotation(math.radians(a), 4, "Y")
        ob = kasten(2 * fr - 0.02, 0.008, 0.012, 0, 0, -0.006, 0.003, "gehaeuse", segmente=1)
        ob.data.transform(Matrix.Translation((fx, yf - 0.004, fz)) @ rot)
    zyl(0.05, 0.03, (fx, yf - 0.008, fz), "detail", "Y", n=24, fase=0.012)
    # Bedienfeld und Typenschild links
    anzeige(-0.31, yf, 0.88, 0.16, 0.08)
    typenschild(-0.31, yf, 0.26, 0.16, 0.1)
    # Seitliche Luftschlitze (rechts)
    for i in range(6):
        kasten(0.006, 0.34, 0.014, W / 2 + 0.001, 0.0, 0.62 + i * 0.05, 0.004, "detail", segmente=1)
    # Anschluesse oben (Vor-/Ruecklauf)
    for x in (-0.33, -0.17):
        stutzen(x, 0.08, 1.12, 0.08, 0.026)
    anschluss(-0.25, 0.08, 1.2)


def gaskessel():
    # 0.6 x 1.6 x 0.6 – wandnaher Standkessel, abgerundet
    W, D = 0.6, 0.6
    fuesse((-0.24, 0.24), (-0.24, 0.24), 0.03, 0.025)
    kasten(W, D, 1.47, 0, 0, 0.03, 0.04, "gehaeuse")
    yf = -D / 2
    kasten(W - 0.06, 0.012, 1.0, 0, yf - 0.002, 0.12, 0.012, "gehaeuse", segmente=2)   # Fronttuer
    kasten(W - 0.06, 0.014, 0.2, 0, yf - 0.002, 1.18, 0.012, "detail", segmente=2)     # Bedienleiste
    anzeige(-0.1, yf - 0.012, 1.28, 0.14, 0.06)
    for i, x in enumerate((0.09, 0.15, 0.21)):
        zyl(0.014, 0.012, (x, yf - 0.02, 1.28), "gehaeuse", "Y", n=16, fase=0.004)
    typenschild(0.0, yf - 0.012, 0.32, 0.18, 0.08)
    # Abgas-/Zuluftrohr hinten oben (konzentrisch)
    zyl(0.07, 0.08, (0, 0.12, 1.54), "detail", n=32, fase=0.01)
    zyl(0.085, 0.015, (0, 0.12, 1.5075), "detail", n=32, fase=0.004)
    # Anschluesse oben vorn
    for x in (-0.18, -0.08):
        stutzen(x, -0.12, 1.5, 0.07, 0.022)
    stutzen(0.17, -0.12, 1.5, 0.05, 0.016, koo=False)  # Gasanschluss
    anschluss(-0.13, -0.12, 1.57)


def oelkessel():
    # 0.7 x 1.4 x 0.8 – Standkessel mit Brennerhaube vorn
    W = 0.7
    fuesse((-0.28, 0.28), (-0.16, 0.32), 0.04, 0.03)
    kasten(W, 0.66, 1.26, 0, 0.07, 0.04, 0.04, "gehaeuse")             # Kessel y -0.26..0.40
    yf = -0.26
    kasten(W - 0.06, 0.014, 0.16, 0, yf - 0.002, 1.08, 0.012, "detail", segmente=2)   # Regelung oben
    anzeige(-0.14, yf - 0.012, 1.16, 0.14, 0.06)
    for i, x in enumerate((0.1, 0.17, 0.24)):
        zyl(0.015, 0.012, (x, yf - 0.02, 1.16), "gehaeuse", "Y", n=16, fase=0.004)
    # Brennertuer und Brennerhaube
    kasten(0.5, 0.016, 0.62, 0, yf - 0.004, 0.24, 0.012, "gehaeuse", segmente=2)   # Kesseltuer
    kasten(0.36, 0.03, 0.36, 0, yf - 0.025, 0.37, 0.012, "detail", segmente=2)    # Brennerflansch
    kasten(0.32, 0.016, 0.32, 0, yf - 0.046, 0.39, 0.006, "koo", segmente=2)       # Farbband
    kasten(0.34, 0.1, 0.34, 0, yf - 0.1, 0.38, 0.06, "gehaeuse", segmente=4)       # Brennerhaube
    kasten(0.16, 0.008, 0.03, 0, yf - 0.15, 0.6, 0.006, "detail", segmente=2)     # Griffmulde
    typenschild(0.0, yf - 0.012, 0.13, 0.2, 0.06)
    # Abgasstutzen hinten, Oelleitung seitlich
    zyl(0.08, 0.14, (0, 0.28, 1.37), "detail", n=32, fase=0.01)
    zyl(0.095, 0.016, (0, 0.28, 1.31), "detail", n=32, fase=0.004)
    rohr([(0.17, yf - 0.08, 0.5), (0.3, yf - 0.08, 0.5), (0.3, yf - 0.08, 0.06)], 0.008, "detail")
    for x in (-0.22, -0.1):
        stutzen(x, 0.05, 1.3, 0.07, 0.024)
    anschluss(-0.16, 0.05, 1.37)


def fernwaerme_uebergabe():
    # 1.0 x 1.4 x 0.35 – Wandstation, Gehaeuse oben, Rohrgruppe darunter
    W, D = 1.0, 0.35
    kasten(0.94, 0.03, 0.66, 0, D / 2 - 0.015, 0.0, 0.01, "gehaeuse")            # Montageplatte
    kasten(W, 0.3, 0.72, 0, 0.025, 0.68, 0.035, "gehaeuse")                     # Gehaeuse
    yf = 0.025 - 0.15
    kasten(W - 0.08, 0.012, 0.6, 0, yf - 0.002, 0.74, 0.012, "gehaeuse", segmente=2)  # Tuer
    anzeige(0.27, yf - 0.012, 1.26, 0.18, 0.08)
    typenschild(-0.3, yf - 0.012, 1.26, 0.18, 0.08)
    # Rohrgruppe: vier Rohre vom Gehaeuse zum Boden
    xs = (-0.33, -0.11, 0.11, 0.33)
    yr = 0.03
    for i, x in enumerate(xs):
        warm = i in (0, 2)
        zyl(0.024, 0.68, (x, yr, 0.34), "detail", n=20)
        zyl(0.036, 0.016, (x, yr, 0.008), "detail", n=24, fase=0.004)        # Bodenrosette
        kugelhahn((x, yr, 0.26), 0.024, "Z", hebel="koo" if warm else "gehaeuse")
        if warm:
            zyl(0.0275, 0.14, (x, yr, 0.52), "koo", n=20, fase=0.005)       # Isolation Vorlauf
    # Waermezaehler und Schmutzfaenger
    kasten(0.11, 0.08, 0.13, -0.11, yr - 0.02, 0.4, 0.015, "gehaeuse")
    anzeige(-0.11, yr - 0.06, 0.49, 0.06, 0.03)
    zyl(0.03, 0.09, (0.33, yr - 0.04, 0.44), "detail", "Y", r2=0.026, n=20, fase=0.006)
    zyl(0.032, 0.1, (0.33, yr, 0.44), "detail", n=20, fase=0.008)
    anschluss(0.0, yr, 0.08)


def speicher():
    # D 0.9 x 1.8 – Zylinder mit Isolationsmantel, Kappe, Stutzen vorn
    R = 0.44
    for i in range(3):
        a = math.radians(90 + 120 * i)
        zyl(0.03, 0.06, (0.3 * math.cos(a), 0.3 * math.sin(a), 0.03), "detail", n=16, fase=0.006)
    zyl(R - 0.02, 0.03, (0, 0, 0.075), "detail", n=48, fase=0.008)                # Bodenring
    zyl(R, 1.6, (0, 0, 0.09 + 0.8), "gehaeuse", n=48, fase=0.04, segmente=3)      # Mantel
    zyl(R + 0.004, 0.022, (0, 0, 1.6), "koo", n=48, fase=0.006)                   # Farbband an der Kappenfuge
    zyl(R - 0.01, 0.1, (0, 0, 1.69 + 0.05 - 0.04), "gehaeuse", n=48, fase=0.06, segmente=4)  # Kappe
    zyl(0.035, 0.06, (0, 0, 1.77), "detail", n=20, fase=0.008)                   # Entlueftung
    zyl(R + 0.003, 0.012, (0, 0, 0.12), "detail", n=48, fase=0.004)              # Fuge unten
    # Stutzen vorn (-Y): Vorlauf oben / Ruecklauf unten / Zirkulation
    hoehen = ((1.48, True), (1.05, True), (0.62, False), (0.28, False))
    for z, warm in hoehen:
        stutzen(0.0, -R + 0.01, z, 0.06, 0.028, achse="Y", richtung=-1, koo=warm)
    # Thermometer und Typenschild
    zyl(0.05, 0.014, (0.0, -R - 0.004, 1.265), "detail", "Y", n=32, fase=0.004)
    zyl(0.04, 0.008, (0.0, -R - 0.01, 1.265), "dunkel", "Y", n=32)
    typenschild(-0.0, -R - 0.001, 0.86, 0.16, 0.08)
    anschluss(0.0, -R - 0.05, 1.48)


def umwaelzpumpe():
    # 0.35 x 0.45 x 0.3 – Pumpe mit Motorkopf auf Rohrstueck, kleiner Sockel
    kasten(0.2, 0.26, 0.035, 0, 0.0, 0.0, 0.012, "gehaeuse")                    # Sockel
    kasten(0.05, 0.06, 0.05, 0, 0.0, 0.04, 0.008, "detail")                     # Stuetze
    zp = 0.12
    zyl(0.022, 0.35, (0, 0, zp), "detail", "X", n=20)                            # Rohrstueck
    for s in (-1, 1):
        zyl(0.032, 0.03, (s * 0.155, 0, zp), "detail", "X", n=6, fase=0.003)     # Verschraubung
        zyl(0.0245, 0.05, (s * 0.11, 0, zp), "koo", "X", n=20, fase=0.004)       # KOO-Manschette
    zyl(0.065, 0.11, (0, 0, zp), "detail", "Z", n=32, fase=0.02, segmente=3)     # Pumpengehaeuse
    zyl(0.072, 0.012, (0, 0, zp + 0.06), "detail", n=32, fase=0.003)
    zyl(0.07, 0.17, (0, 0, zp + 0.065 + 0.085), "gehaeuse", n=40, fase=0.015, segmente=3)  # Motor
    for i in range(8):
        a = 2 * math.pi * i / 8
        kasten(0.008, 0.008, 0.13, 0.071 * math.cos(a), 0.071 * math.sin(a), zp + 0.085, 0.003, "gehaeuse", segmente=1)
    kasten(0.14, 0.14, 0.07, 0, 0, 0.38, 0.022, "gehaeuse")                      # Elektronikkopf
    anzeige(0.0, -0.07, 0.418, 0.06, 0.028)
    anschluss(0.175, 0.0, zp)


def verteiler():
    # 1.2 x 1.0 x 0.3 – Verteilerbalken mit Abgaengen, Ventilen, Konsole
    for x in (-0.48, 0.48):
        kasten(0.05, 0.05, 0.98, x, 0.115, 0.0, 0.01, "detail")                  # Konsolenstuetze
        kasten(0.1, 0.3, 0.012, x, 0.0, 0.0, 0.004, "detail", segmente=1)        # Fussplatte (Standkonsole)
        for z in (0.62, 0.36):
            kasten(0.05, 0.13, 0.04, x, 0.04, z - 0.02, 0.008, "detail")          # Ausleger
    xs = (-0.36, -0.12, 0.12, 0.36)
    for z, warm in ((0.62, True), (0.36, False)):
        kasten(1.12, 0.1, 0.1, 0, -0.02, z - 0.05, 0.03, "gehaeuse")             # Balken (isoliert)
        for s in (-1, 1):
            zyl(0.035, 0.03, (s * 0.575, -0.02, z), "detail", "X", n=24, fase=0.008)  # Endkappe
        if warm:  # Thermometer am Vorlauf
            zyl(0.028, 0.012, (-0.48, -0.077, z), "detail", "Y", n=24, fase=0.003)
            zyl(0.022, 0.006, (-0.48, -0.085, z), "dunkel", "Y", n=24)
        for x in xs:
            if warm:
                zyl(0.02, 0.33, (x, -0.02, z + 0.05 + 0.165), "detail", n=20)
                zyl(0.0225, 0.1, (x, -0.02, 0.9), "koo", n=20, fase=0.004)
                kugelhahn((x, -0.02, 0.76), 0.02, "Z", hebel="koo")
            else:
                zyl(0.02, z - 0.05 - 0.02, (x, -0.02, (z - 0.05 + 0.02) / 2), "detail", n=20)
                kugelhahn((x, -0.02, 0.2), 0.02, "Z", hebel="gehaeuse")
                zyl(0.03, 0.012, (x, -0.02, 0.006), "detail", n=20, fase=0.003)
    anschluss(-0.6, -0.02, 0.62)


def heizkoerper():
    # 1.0 x 0.65 x 0.12 – Flachheizkoerper (Typ 22) mit Profilierung, kurze Fuesse
    B, H0, H1 = 0.9, 0.1, 0.63
    xm = -0.04
    for x in (xm - 0.32, xm + 0.32):
        kasten(0.03, 0.05, 0.11, x, 0.02, 0.0, 0.008, "detail")                   # Fuesse
        kasten(0.06, 0.08, 0.008, x, 0.02, 0.0, 0.003, "detail", segmente=1)      # Fussplatte
    _profilplatte(B, H1 - H0 - 0.02, xm, -0.03, H0, -1)                           # vordere Platte
    kasten(B, 0.024, H1 - H0 - 0.02, xm, 0.03, H0, 0.006, "gehaeuse", segmente=2)  # hintere Platte
    kasten(B, 0.1, 0.022, xm, 0, H1 - 0.022, 0.008, "gehaeuse", segmente=2)       # Abdeckgitter
    for i in range(22):
        x = xm - B / 2 + 0.05 + i * (B - 0.1) / 21
        kasten(0.012, 0.05, 0.004, x, 0, H1 - 0.001, 0.0015, "detail", segmente=1)  # Lamellen
    for sx in (-1, 1):
        kasten(0.014, 0.1, H1 - H0 - 0.03, xm + sx * (B / 2 - 0.007), 0, H0 + 0.005, 0.005, "gehaeuse", segmente=2)
    # Thermostatventil oben rechts, Ruecklaufverschraubung unten rechts, Anschlussrohre zum Boden
    xv = xm + B / 2 + 0.035
    zyl(0.012, 0.05, (xm + B / 2 + 0.012, 0, 0.52), "detail", "X", n=16)
    zyl(0.016, 0.06, (xv, 0, 0.52), "detail", "Z", n=20, fase=0.004)
    zyl(0.026, 0.07, (xv, 0, 0.585), "gehaeuse", "Z", n=32, fase=0.01, segmente=3)
    zyl(0.0265, 0.012, (xv, 0, 0.555), "koo", n=32, fase=0.003)
    kasten(0.004, 0.012, 0.03, xv + 0.026, 0, 0.575, 0.001, "dunkel", segmente=1)   # Skalenmarke
    zyl(0.012, 0.05, (xm + B / 2 + 0.012, 0, 0.14), "detail", "X", n=16)
    zyl(0.016, 0.05, (xv, 0, 0.14), "detail", "Z", n=20, fase=0.004)
    zyl(0.011, 0.49, (xv, 0, 0.245), "detail", n=16)
    zyl(0.0125, 0.06, (xv, 0, 0.05), "koo", n=16, fase=0.003)
    zyl(0.022, 0.01, (xv, 0, 0.005), "detail", n=20, fase=0.003)
    anschluss(xv, 0.0, 0.05)


def _profilplatte(breite, hoehe, x0, y0, z0, seite):
    """Heizplatte mit senkrechten Profilrillen – Frontseite zeigt nach `seite`*Y."""
    bm = bmesh.new()
    n_rillen = 24
    proben = n_rillen * 6
    dicke = 0.024
    profil = []
    for i in range(proben + 1):
        u = i / proben
        x = x0 - breite / 2 + u * breite
        t = (0.5 - 0.5 * math.cos(2 * math.pi * n_rillen * u)) ** 3   # schmale Rillen
        rand = min(1.0, min(u, 1 - u) * proben / 2)                   # Rand flach
        profil.append((x, y0 + seite * (dicke / 2 - 0.0045 * t * rand)))
    rueck = [(x0 + breite / 2, y0 - seite * dicke / 2), (x0 - breite / 2, y0 - seite * dicke / 2)]
    umriss = profil + rueck
    unten = [bm.verts.new((x, y, z0)) for x, y in umriss]
    oben = [bm.verts.new((x, y, z0 + hoehe)) for x, y in umriss]
    k = len(umriss)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((unten[i], unten[j], oben[j], oben[i]))
    bm.faces.new(list(reversed(unten)))
    bm.faces.new(oben)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return _objekt(bm, "platte", "gehaeuse")


def fbh_kreis():
    # 0.6 x 0.8 x 0.15 – FBH-Verteilerschrank, offen, Verteilerbalken sichtbar
    W, H, D = 0.6, 0.72, 0.15
    z0 = 0.08
    for x in (-0.24, 0.24):
        kasten(0.03, 0.1, z0, x, 0.0, 0.0, 0.006, "detail")                      # Stellfuesse
    t = 0.014
    kasten(W, t, H, 0, D / 2 - t / 2, z0, 0.006, "gehaeuse", segmente=2)          # Rueckwand
    for sx in (-1, 1):
        kasten(t, D, H, sx * (W / 2 - t / 2), 0, z0, 0.006, "gehaeuse", segmente=2)
    kasten(W, D, t, 0, 0, z0, 0.006, "gehaeuse", segmente=2)
    kasten(W, D, t, 0, 0, z0 + H - t, 0.006, "gehaeuse", segmente=2)
    # Frontrahmen
    yf = -D / 2
    for sx in (-1, 1):
        kasten(0.03, 0.012, H, sx * (W / 2 - 0.015), yf + 0.004, z0, 0.005, "gehaeuse", segmente=2)
    kasten(W, 0.012, 0.03, 0, yf + 0.004, z0 + H - 0.03, 0.005, "gehaeuse", segmente=2)
    kasten(W, 0.012, 0.03, 0, yf + 0.004, z0, 0.005, "gehaeuse", segmente=2)
    # Montageschiene
    kasten(0.5, 0.01, 0.03, 0, D / 2 - t - 0.005, 0.5, 0.004, "detail", segmente=1)
    # Verteilerbalken: Vorlauf oben mit Durchflussmessern, Ruecklauf unten mit Stellantrieben
    xs = (-0.15, -0.05, 0.05, 0.15)
    yb = 0.02
    zv, zr = 0.62, 0.44
    for z in (zv, zr):
        zyl(0.018, 0.46, (0, yb, z), "detail", "X", n=20)
        for sx in (-1, 1):
            zyl(0.022, 0.016, (sx * 0.23, yb, z), "detail", "X", n=6, fase=0.002)
    for x in xs:
        # Vorlauf: Durchflussmesser oben, Abgang nach vorn und unten mit KOO-Manschette
        zyl(0.012, 0.06, (x, yb, zv + 0.045), "detail", n=16, fase=0.003)
        zyl(0.0125, 0.024, (x, yb, zv + 0.082), "koo", n=16, fase=0.004)
        zyl(0.0085, 0.03, (x, yb - 0.006, zv + 0.045), "dunkel", n=12)              # Schauglas
        rohr([(x, yb, zv), (x, yb - 0.04, zv), (x, yb - 0.04, 0.0)], 0.008, "detail", biegung=0.02, n=12)
        zyl(0.0095, 0.05, (x, yb - 0.04, zv - 0.06), "koo", n=12, fase=0.002)
        # Ruecklauf: Stellantrieb oben, Abgang nach unten
        zyl(0.017, 0.055, (x, yb, zr + 0.05), "gehaeuse", n=20, fase=0.006)
        zyl(0.0172, 0.008, (x, yb, zr + 0.028), "detail", n=20)
        zyl(0.008, zr, (x, yb, zr / 2), "detail", n=12)
    # Zuleitungen links (Vorlauf KOO, Ruecklauf grau)
    for z, mat in ((zv, "koo"), (zr, "detail")):
        rohr([(-0.23, yb, z), (-0.262, yb, z), (-0.262, yb, 0.0)], 0.013, mat, biegung=0.03, n=12)
    anschluss(-0.262, yb, 0.06)



# ---------------------------------------------------------------------------
# Gruppenzubehoer (Stufe 1, Track C4): Teile in einer senkrechten Leitung.
# Rohrachse senkrecht durch den Ursprung, Rohrenden bei z = 0 und z = H (glTF y = 0 / y = H),
# Stellantrieb bzw. Rechenwerk nach vorn (-Y = glTF +Z). anschluss = unteres Rohrende.
# Rohrradius 0.02 wie der Gruppenstock (ROHR.stock in app/web/src/szene3/technik.ts).
# ---------------------------------------------------------------------------

R_STOCK = 0.02


def _leitungsstueck(h, manschetten=(0.03,)):
    """Durchgehendes Rohrstueck mit Verschraubungen und KOO-Manschetten an beiden Enden."""
    zyl(R_STOCK, h, (0, 0, h / 2), "detail", n=20)
    for z in (0.011, h - 0.011):
        zyl(R_STOCK * 1.35, 0.022, (0, 0, z), "detail", n=6, fase=0.003)
    for z in manschetten:
        for zz in (z, h - z):
            zyl(R_STOCK * 1.14, 0.03, (0, 0, zz + (0.012 if zz < h / 2 else -0.012)), "koo", n=20, fase=0.004)


def ventil_3weg():
    # 0.2 x 0.25 x 0.2 – Mischventil: Gehaeuse auf der Leitung, dritter Weg nach rechts, Stellantrieb vorn
    h = 0.25
    _leitungsstueck(h)
    kasten(0.085, 0.085, 0.1, 0, 0, h / 2 - 0.05, 0.02, "detail")                       # Ventilgehaeuse
    zyl(0.05, 0.012, (0, 0, h / 2 + 0.05), "detail", n=6, fase=0.002)                   # Mutter oben
    zyl(0.05, 0.012, (0, 0, h / 2 - 0.05), "detail", n=6, fase=0.002)                   # Mutter unten
    stutzen(0.0425, 0, h / 2, 0.055, R_STOCK, "X", 1, koo=True)                         # dritter Weg (Bypass)
    zyl(0.014, 0.03, (0, -0.055, h / 2), "detail", "Y", n=16)                           # Spindelhals
    kasten(0.11, 0.075, 0.1, 0, -0.105, h / 2 - 0.05, 0.018, "gehaeuse")                # Stellantrieb
    kasten(0.11, 0.004, 0.012, 0, -0.143, h / 2 + 0.03, 0.002, "detail", segmente=1)    # Fuge Deckel
    zyl(0.016, 0.006, (0.03, -0.144, h / 2 - 0.015), "dunkel", "Y", n=20)               # Stellungsanzeige
    kasten(0.034, 0.004, 0.008, -0.025, -0.144, h / 2 - 0.02, 0.002, "dunkel", segmente=1)  # Skala
    anschluss(0.0, 0.0, 0.0)


def ventil_2weg():
    # 0.15 x 0.25 x 0.15 – Durchgangsventil mit Stellantrieb vorn
    h = 0.25
    _leitungsstueck(h)
    zyl(0.042, 0.09, (0, 0, h / 2), "detail", n=24, fase=0.012)                         # Ventilkoerper
    for z in (h / 2 - 0.05, h / 2 + 0.05):
        zyl(0.046, 0.012, (0, 0, z), "detail", n=6, fase=0.002)
    zyl(0.013, 0.03, (0, -0.05, h / 2), "detail", "Y", n=16)                            # Spindelhals
    kasten(0.11, 0.06, 0.085, 0, -0.092, h / 2 - 0.0425, 0.016, "gehaeuse")              # Stellantrieb
    zyl(0.014, 0.006, (0, -0.123, h / 2 + 0.008), "dunkel", "Y", n=20)                  # Stellungsanzeige
    kasten(0.06, 0.004, 0.006, 0, -0.123, h / 2 - 0.028, 0.002, "detail", segmente=1)
    anschluss(0.0, 0.0, 0.0)


def wmz():
    # 0.25 x 0.2 x 0.15 – Waermezaehler: Volumenmessteil auf der Leitung, Rechenwerk vorn mit Display
    h = 0.2
    _leitungsstueck(h, manschetten=(0.026,))
    zyl(0.036, 0.1, (0, 0, h / 2), "detail", n=24, fase=0.01)                           # Messteil
    for z in (h / 2 - 0.05, h / 2 + 0.05):
        zyl(0.04, 0.01, (0, 0, z), "detail", n=6, fase=0.002)
    kasten(0.05, 0.04, 0.04, 0, -0.045, h / 2 - 0.02, 0.008, "detail")                  # Konsole
    kasten(0.2, 0.05, 0.13, 0, -0.09, h / 2 - 0.065, 0.016, "gehaeuse")                 # Rechenwerk
    anzeige(-0.035, -0.116, h / 2 + 0.02, 0.08, 0.035)                                  # Display
    for i, x in enumerate((0.045, 0.07)):
        zyl(0.008, 0.004, (x, -0.117, h / 2 + 0.02), "detail", "Y", n=12)               # Tasten
    typenschild(0.0, -0.116, h / 2 - 0.035, 0.12, 0.03)
    # Fuehlerkabel zum Rohr (Ruecklauf-/Vorlauffuehler schematisch)
    rohr([(0.1, -0.09, h / 2 - 0.05), (0.1, -0.09, 0.03), (0.1, -0.02, 0.03), (0.025, -0.02, 0.03)], 0.004, "dunkel", biegung=0.012, n=8)
    anschluss(0.0, 0.0, 0.0)


def verteiler_reihe(k):
    """Verteiler mit k Gruppenabgaengen (Modellreihe heizung.verteiler.n<k>, Stufe 1).
    Abgaenge im Abstand 0.34 m mittig, Laenge = max(0.9, (k-1)*0.34+0.6) – identisch zu verteilerLaenge()
    in app/web/src/szene3/technik.ts. Abgang oben bei z = 1.0, y = -0.02 (glTF 0.02)."""
    laenge = max(0.9, (k - 1) * 0.34 + 0.6)
    halb = laenge / 2
    xs = [(i - (k - 1) / 2) * 0.34 for i in range(k)]
    for x in (-halb + 0.12, halb - 0.12):
        kasten(0.05, 0.05, 0.98, x, 0.115, 0.0, 0.01, "detail")                  # Konsolenstuetze
        kasten(0.1, 0.3, 0.012, x, 0.0, 0.0, 0.004, "detail", segmente=1)        # Fussplatte
        for z in (0.62, 0.36):
            kasten(0.05, 0.13, 0.04, x, 0.04, z - 0.02, 0.008, "detail")          # Ausleger
    for z, warm in ((0.62, True), (0.36, False)):
        kasten(laenge - 0.08, 0.1, 0.1, 0, -0.02, z - 0.05, 0.03, "gehaeuse")    # Balken (isoliert)
        for s in (-1, 1):
            zyl(0.035, 0.03, (s * (halb - 0.025), -0.02, z), "detail", "X", n=24, fase=0.008)
        if warm:
            zyl(0.028, 0.012, (-halb + 0.12, -0.077, z), "detail", "Y", n=24, fase=0.003)
            zyl(0.022, 0.006, (-halb + 0.12, -0.085, z), "dunkel", "Y", n=24)
        for x in xs:
            if warm:
                zyl(0.02, 0.33, (x, -0.02, z + 0.05 + 0.165), "detail", n=16)
                zyl(0.0225, 0.06, (x, -0.02, 0.97), "koo", n=16, fase=0.004)
                kugelhahn((x, -0.02, 0.76), 0.02, "Z", hebel="koo")
            else:
                zyl(0.02, z - 0.05 - 0.02, (x, -0.02, (z - 0.05 + 0.02) / 2), "detail", n=16)
                kugelhahn((x, -0.02, 0.2), 0.02, "Z", hebel="gehaeuse")
                zyl(0.03, 0.012, (x, -0.02, 0.006), "detail", n=16, fase=0.003)
    anschluss(-halb, -0.02, 0.62)

MODELLE = {
    "heizung.waermepumpe": (waermepumpe, (1.0, 1.2, 0.6)),
    "heizung.gaskessel": (gaskessel, (0.6, 1.6, 0.6)),
    "heizung.oelkessel": (oelkessel, (0.7, 1.4, 0.8)),
    "heizung.fernwaerme_uebergabe": (fernwaerme_uebergabe, (1.0, 1.4, 0.35)),
    "heizung.speicher": (speicher, (0.9, 1.8, 0.9)),
    "heizung.umwaelzpumpe": (umwaelzpumpe, (0.35, 0.45, 0.3)),
    "heizung.verteiler": (verteiler, (1.2, 1.0, 0.3)),
    "heizung.heizkoerper": (heizkoerper, (1.0, 0.65, 0.12)),
    "heizung.fbh_kreis": (fbh_kreis, (0.6, 0.8, 0.15)),
    "heizung.ventil_3weg": (ventil_3weg, (0.2, 0.25, 0.2)),
    "heizung.ventil_2weg": (ventil_2weg, (0.15, 0.25, 0.15)),
    "heizung.wmz": (wmz, (0.25, 0.2, 0.15)),
}
# Verteiler mit Gruppen: Modellreihe 1..8 Abgaenge (nicht in der Uebersicht)
for _k in range(1, 9):
    MODELLE[f"heizung.verteiler.n{_k}"] = ((lambda k=_k: verteiler_reihe(k)), (max(0.9, (_k - 1) * 0.34 + 0.6), 1.0, 0.3))


# ---------------------------------------------------------------------------
# Ablauf: Szene leeren, Modell bauen, Modifier anwenden, verbinden, glaetten, exportieren
# ---------------------------------------------------------------------------

def szene_leeren():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    TEILE.clear()


def modifier_anwenden_und_verbinden(name, teile_melden=False):
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in TEILE:
        if ob.modifiers:
            me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
            alt = ob.data
            ob.modifiers.clear()
            ob.data = me
            bpy.data.meshes.remove(alt)
    if teile_melden:
        liste = sorted(((sum(len(p.vertices) - 2 for p in o.data.polygons), o.name) for o in TEILE), reverse=True)
        for t, n in liste[:15]:
            print(f"[teile] {n}: {t}")
    bpy.ops.object.select_all(action="DESELECT")
    for ob in TEILE:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = TEILE[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    # doppelte Punkte (Bevel-Naehte) zusammenfuehren, glaetten, Kanten > 50 Grad hart
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.shade_smooth()
    ob.data.set_sharp_from_angle(angle=math.radians(50))
    # Materialreihenfolge stabil: gehaeuse, detail, dunkel, koo
    return ob


def exportieren(katalog_id):
    os.makedirs(ZIEL_GLB, exist_ok=True)
    pfad = os.path.join(ZIEL_GLB, katalog_id + ".glb")
    op = bpy.ops.export_scene.gltf
    erlaubt = {p.identifier for p in op.get_rna_type().properties}
    wunsch = dict(
        filepath=pfad,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_draco_mesh_compression_enable=False,
        export_attributes=False,
        export_vertex_color="NONE",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=False,
    )
    args = {k: v for k, v in wunsch.items() if k in erlaubt}
    # Enum-Werte zur Laufzeit pruefen
    for k in ("export_image_format", "export_vertex_color"):
        if k in args:
            ids = [i.identifier for i in op.get_rna_type().properties[k].enum_items]
            if args[k] not in ids:
                args.pop(k)
    op(**args)
    return pfad


# ---------------------------------------------------------------------------
# Vorschau-Render
# ---------------------------------------------------------------------------

def _hilfsmaterial(name, hex_wert, rau=0.9):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = _linear(hex_wert)
    bsdf.inputs["Roughness"].default_value = rau
    return mat


def render_einrichten(breite, hoehe):
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x = breite
    sc.render.resolution_y = hoehe
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    try:
        sc.eevee.taa_render_samples = 64
        sc.eevee.use_shadows = True
        sc.eevee.use_raytracing = True
        sc.eevee.fast_gi_method = sc.eevee.fast_gi_method
    except AttributeError:
        pass
    ids = [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items]
    sc.view_settings.view_transform = "Khronos PBR Neutral" if "Khronos PBR Neutral" in ids else "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    # Welt: heller neutraler Grund (#f5f6f8) als Umgebungslicht
    welt = bpy.data.worlds.get("Welt") or bpy.data.worlds.new("Welt")
    welt.use_nodes = True
    bg = next(n for n in welt.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = _linear("#f5f6f8")
    bg.inputs["Strength"].default_value = 0.5
    sc.world = welt
    # Boden
    if "Boden" not in bpy.data.objects:
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
        me = bpy.data.meshes.new("Boden")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(_hilfsmaterial("boden", "#f2f3f5", 1.0))
        ob = bpy.data.objects.new("Boden", me)
        sc.collection.objects.link(ob)
    # Sonne von links oben (Azimut 225, Hoehe 50 wie tokens.licht), weich
    if "Sonne" not in bpy.data.objects:
        ld = bpy.data.lights.new("Sonne", "SUN")
        ld.energy = 3.2
        ld.angle = math.radians(12)
        ob = bpy.data.objects.new("Sonne", ld)
        az, h = math.radians(225), math.radians(50)
        richtung = Vector((math.cos(h) * math.sin(az), -math.cos(h) * math.cos(az), math.sin(h)))
        # Licht kommt von links-vorne-oben (Kamera blickt von rechts-vorne)
        richtung = Vector((-0.75, -0.45, 0.85)).normalized()
        ob.rotation_euler = richtung.to_track_quat("Z", "Y").to_euler()
        sc.collection.objects.link(ob)
        fl = bpy.data.lights.new("Flaeche", "AREA")
        fl.energy = 40
        fl.size = 4
        ob2 = bpy.data.objects.new("Flaeche", fl)
        ob2.location = (3.0, -3.5, 3.0)
        ob2.rotation_euler = (-Vector(ob2.location)).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(ob2)


def kamera(zentrum, groesse, breite, hoehe):
    sc = bpy.context.scene
    cam = bpy.data.objects.get("Kamera")
    if cam is None:
        cd = bpy.data.cameras.new("Kamera")
        cam = bpy.data.objects.new("Kamera", cd)
        sc.collection.objects.link(cam)
    cd = cam.data
    cd.type = "ORTHO"
    blick = Vector((0.62, -1.0, 0.72)).normalized()  # 3/4 von rechts vorn, schraeg oben
    z = Vector(zentrum)
    cam.location = z + blick * 20
    cam.rotation_euler = (-blick).to_track_quat("-Z", "Y").to_euler()
    cd.ortho_scale = groesse
    cd.clip_end = 100
    sc.camera = cam
    sc.render.resolution_x = breite
    sc.render.resolution_y = hoehe


def rendern(pfad):
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    bpy.context.scene.render.filepath = pfad
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def _bbox(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for ob in objs:
        if ob.type != "MESH":
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def modell_rendern(katalog_id, ob):
    lo, hi = _bbox([ob])
    mitte = (lo + hi) / 2
    groesse = max((hi - lo).length * 1.08, 0.5)
    render_einrichten(1000, 1000)
    kamera(mitte, groesse, 1000, 1000)
    rendern(os.path.join(ZIEL_BILD, katalog_id + ".png"))


def uebersicht():
    """Importiert alle GLB (prueft damit auch den Rueckweg) und rendert sie massstabsgetreu nebeneinander."""
    szene_leeren()
    x = 0.0
    objs = []
    for katalog_id, (_, masse) in MODELLE.items():
        if ".n" in katalog_id:
            continue
        pfad = os.path.join(ZIEL_GLB, katalog_id + ".glb")
        vorher = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=pfad)
        neu = [o for o in bpy.data.objects if o not in vorher]
        w = masse[0]
        quer = Vector((1.0, 0.62, 0.0)).normalized()   # senkrecht zur Blickrichtung der Kamera
        for o in neu:
            if o.parent is None:
                o.location += quer * (x + w / 2)
        objs += neu
        x += w + 0.3
    bpy.context.view_layer.update()
    lo, hi = _bbox(objs)
    render_einrichten(2400, 1000)
    mitte = (lo + hi) / 2
    kamera(mitte, x + 0.2, 2400, 1000)
    rendern(os.path.join(ZIEL_BILD, "alle.png"))


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    nur = None
    if "--nur" in argv:
        nur = argv[argv.index("--nur") + 1].split(",")
    if "--uebersicht" in argv:
        uebersicht()
        return
    global M
    for katalog_id, (bau, _) in MODELLE.items():
        if nur and katalog_id not in nur:
            continue
        szene_leeren()
        M = materialien()
        bau()
        ob = modifier_anwenden_und_verbinden(katalog_id, "--teile" in argv)
        pfad = exportieren(katalog_id)
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print(f"[anlagen] {katalog_id}: {tris} Dreiecke, {os.path.getsize(pfad)} B -> {pfad}")
        if "--ohne-render" not in argv:
            modell_rendern(katalog_id, ob)
    if not nur and "--ohne-render" not in argv:
        uebersicht()


M = {}
main()
