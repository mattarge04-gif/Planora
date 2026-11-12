import cv2,json,numpy as np
from pathlib import Path
root=Path('docs/design/kritiken/2026-11-12-redesign-r3')
paths={'ref01':'docs/design/referenzen/01-dashboard.png','ref02':'docs/design/referenzen/02-gebaeude.png','a':str(root/'a/ansatz-a-1440x900.png'),'b':str(root/'b/ansatz-b-1440x900.png')}
report={}
for key,path in paths.items():
 im=cv2.imread(path)
 if key=='ref01': im=im[289:802,160:1055] # screen content, exclude monitor/browser and page background
 hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV); v=hsv[:,:,2]; s=hsv[:,:,1]
 report[key]={'region':'reference screen content crop [160,289,1055,802]' if key=='ref01' else 'full image','brightness_mean':round(float(v.mean()),2),'brightness_p95':float(np.percentile(v,95)),'saturation_mean':round(float(s.mean()),2),'white_fraction_v240_s20':round(float(((v>=240)&(s<=20)).mean()),4)}
(root/'bildmetriken.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
