"""S1 Variante C (Stresstest): Ausschnitt nur Zeichnungsflaeche, ohne Plankopf, Massketten,
Massstabsleiste und Tabelle; ungerade Bildgroesse. Das Modell kann die Lage nicht aus
Papierformat + Massstab berechnen, sondern muss im Bild messen."""
import json, pathlib, pymupdf
HIER = pathlib.Path(__file__).parent; QUELLE = HIER.parent / "beispiele" / "lindenhof"
CLIP = pymupdf.Rect(52, 170, 760, 642)
for gs in ["EG", "OG"]:
    p = pymupdf.open(QUELLE / f"01_Grundriss_{gs}.pdf")[0]
    pix = p.get_pixmap(matrix=pymupdf.Matrix(2.37, 2.37), clip=CLIP)
    pix.save(HIER / "eingabe" / f"grundriss_{gs}_ausschnitt.png"); print(gs, pix.width, pix.height)
(HIER / "eingabe" / "ausschnitt_clip.json").write_text(json.dumps({"clip_pt": [CLIP.x0, CLIP.y0, CLIP.x1, CLIP.y1]}))
