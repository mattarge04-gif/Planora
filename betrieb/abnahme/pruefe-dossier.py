"""Selbstpruefung der vier SBOM-Saetze und ihrer Lizenz-Zuordnung."""
import gzip
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path

ziel = Path(sys.argv[1])
nachweis = json.loads((ziel/'nachweis.json').read_text(encoding='utf-8'))
upstream = json.loads((ziel/'upstream-nachweis.json').read_text(encoding='utf-8'))
texte = {x['spdx']: x for x in upstream if 'spdx' in x and not x.get('offen')}
quellen = {(x['typ'], x['name'], x['version']): x for x in upstream if 'typ' in x}
assert {i['dienst'] for i in nachweis['images']} == {'app','backup','db','proxy'}
zuordnung = []
for image in nachweis['images']:
    dienst = image['dienst']
    syft = json.loads(gzip.decompress((ziel/f'{dienst}.syft.json.gz').read_bytes()))
    spdx = json.loads(gzip.decompress((ziel/f'{dienst}.spdx.json.gz').read_bytes()))
    cdx = json.loads(gzip.decompress((ziel/f'{dienst}.cdx.json.gz').read_bytes()))
    assert syft['artifacts'] and spdx['spdxVersion'].startswith('SPDX-') and cdx['bomFormat'] == 'CycloneDX'
    assert len(syft['artifacts']) == image['pakete']
    for datei in image['dateien']:
        assert hashlib.sha256((ziel/datei['datei']).read_bytes()).hexdigest() == datei['sha256']
    for a in syft['artifacts']:
        ids = {ident for l in a.get('licenses',[]) for ident in re.findall(r'[a-zA-Z0-9][a-zA-Z0-9.\-+]*',l.get('spdxExpression',''))} - {'AND','OR','WITH'}
        q = quellen.get((a['type'],a['name'],a['version']))
        zuordnung.append({'image':dienst,'typ':a['type'],'name':a['name'],'version':a['version'],'spdxTexte':sorted(ids & texte.keys()),'upstreamDateien':q.get('dateien',[]) if q else [],'upstreamOffen':q.get('offen') if q else None})
        assert ids <= texte.keys(), f'Fehlender Standardtext: {ids-texte.keys()}'
for pfad in ziel.glob('*.tar.gz'):
    with tarfile.open(pfad) as tar:
        assert all(e.isfile() and e.size >= 0 for e in tar)
(ziel/'lizenz-zuordnung.json').write_text(json.dumps(zuordnung,indent=2),encoding='utf-8',newline='\n')
offen = [x for x in quellen.values() if x.get('offen')]
(ziel/'OFFENE-TEXTE.md').write_text('# Komponenten ohne eigene Upstream-Lizenzdatei\n\nDiese technische Luecke verhindert die Behauptung einer vollstaendigen komponentengenauen Lizenztext-/Notice-Abdeckung. Vorhandene SPDX-Standardtexte sind kein Ersatz fuer fehlende Copyright-/Notice-Angaben. Lokale/private Pakete und mitgelieferte Test-Fixtures muessen ebenfalls vom Lizenz-Owner zugeordnet werden.\n\n' + '\n'.join(f'- `{x["name"]}@{x["version"]}` ({x["typ"]}): {x["offen"]}' for x in offen) + '\n\nSiehe upstream-nachweis.json fuer Quellen, Einzeldateien und Pruefsummen; menschliche Lieferfreigabe bleibt separat offen.\n', encoding='utf-8', newline='\n')
dateien = [{'datei':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(ziel.iterdir()) if p.is_file() and p.name != 'SHA256SUMS.json']
(ziel/'SHA256SUMS.json').write_text(json.dumps(dateien,indent=2),encoding='utf-8',newline='\n')
print(json.dumps({'images':4,'sbomDateien':12,'paketVorkommen':len(zuordnung),'spdxStandardtexte':len(texte),'upstreamPakete':len(quellen),'upstreamOhneEigeneLizenzdatei':sum(bool(x.get('offen')) for x in quellen.values()),'dateien':len(dateien)}))
