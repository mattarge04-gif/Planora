"""S1 Vorbereitung: rendert Grundrissseiten als PNG (wie Pipeline-Kachel) und
extrahiert Textzeilen mit normierten Koordinaten (wie pdfjs-Schritt der Hybrid-Pipeline).
Aufruf: _werkzeuge/venv/Scripts/python s01-grundriss/vorbereiten.py"""
import json, pathlib, pymupdf
HIER = pathlib.Path(__file__).parent
QUELLE = HIER.parent / "beispiele" / "lindenhof"
for gs in ["EG", "OG"]:
    doc = pymupdf.open(QUELLE / f"01_Grundriss_{gs}.pdf"); p = doc[0]
    W, H = p.rect.width, p.rect.height
    pix = p.get_pixmap(matrix=pymupdf.Matrix(2, 2))  # 2381 x 1684 px, < 2576 px Kante
    pix.save(HIER / "eingabe" / f"grundriss_{gs}.png")
    zeilen = []
    for b in p.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            t = " ".join(s["text"] for s in l["spans"]).strip()
            if not t: continue
            x0, y0, x1, y1 = l["bbox"]
            zeilen.append({"text": t, "x0": round(x0/W, 4), "y0": round(y0/H, 4), "x1": round(x1/W, 4), "y1": round(y1/H, 4)})
    (HIER / "eingabe" / f"textzeilen_{gs}.json").write_text(json.dumps({"seite_breite_pt": W, "seite_hoehe_pt": H, "koordinaten": "normiert 0..1, Ursprung oben links", "zeilen": zeilen}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(gs, pix.width, pix.height, len(zeilen))
