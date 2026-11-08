import sys, pymupdf
doc = pymupdf.open(sys.argv[1]); p = doc[0]
print("page", p.rect, "rot", p.rotation)
dr = p.get_drawings()
print("drawings", len(dr))
from collections import Counter
rects=[]
for d in dr:
    for it in d["items"]:
        if it[0]=="re":
            r=it[1]; rects.append((round(r.x0,1),round(r.y0,1),round(r.width,1),round(r.height,1),d.get("width"),d.get("fill")))
big=[r for r in rects if r[2]>60 and r[3]>60]
for r in sorted(big): print("re",r)
for w in p.get_text("words"):
    if any(k in w[4] for k in ["EG-0","OG-0","24.00","6.00","6.40","3.20"]): print(round(w[0],1),round(w[1],1),w[4])
