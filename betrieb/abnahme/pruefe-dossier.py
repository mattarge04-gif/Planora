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
with tarfile.open(ziel/'upstream-lizenzen.tar.gz') as tar:
    archiv = {e.name: tar.extractfile(e).read() for e in tar if e.isfile()}
for quelle in upstream:
    for beleg in quelle.get('dateien', []):
        assert hashlib.sha256(archiv[beleg['pfad']]).hexdigest() == beleg['sha256'], f'Falscher Lizenzbeleg: {beleg["pfad"]}'
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
        zuordnung.append({'image':dienst,'typ':a['type'],'name':a['name'],'version':a['version'],'spdxTexte':sorted(ids & texte.keys()),'upstreamDateien':q.get('dateien',[]) if q else [],'upstreamOffen':q.get('offen') if q else None,**({'begruendung':q.get('ergaenzung') or q['teilweise']} if q and (q.get('ergaenzung') or q.get('teilweise')) else {})})
        assert ids <= texte.keys(), f'Fehlender Standardtext: {ids-texte.keys()}'
for pfad in ziel.glob('*.tar.gz'):
    with tarfile.open(pfad) as tar:
        assert all(e.isfile() and e.size >= 0 for e in tar)
(ziel/'lizenz-zuordnung.json').write_text(json.dumps(zuordnung,indent=2),encoding='utf-8',newline='\n')
offen = [x for x in quellen.values() if x.get('offen')]
geschlossen = sum(bool(x.get('ergaenzung')) and not x.get('offen') for x in quellen.values())
(ziel/'OFFENE-TEXTE.md').write_text(f'# Offene Lizenz-/Liefertext-Zuordnungen\n\nNachtrag: {geschlossen} der urspruenglich 14 Zuordnungen technisch mit Quellen belegt, {len(offen)} offen. Separate LICENSE-Dateien sind nicht zwingend: README-Lizenzabschnitte, exakt gebundene Elternpakete und Debian-copyright-Dateien sind dokumentierte Belege. Keine juristische oder menschliche Lieferfreigabe.\n\n' + '\n'.join(f'- `{x["name"]}@{x["version"]}` ({x["typ"]}): {x["offen"]}' for x in offen) + '\n\nSiehe zuordnungen-nachtrag.json fuer die einzelnen begruendeten Zuordnungen und upstream-nachweis.json fuer Quellen, Archivmitglieder und Pruefsummen.\n', encoding='utf-8', newline='\n')
(ziel/'FREIGABE.md').write_text(f'# Menschliche Lizenz-/Lieferfreigabe offen\n\nTechnischer Nachtrag: {geschlossen}/14 bisher offene Zuordnungen belegt; {len(offen)} verbleibend. Dies ist keine menschliche oder juristische Freigabe.\n\n- [ ] [?] Fixture-Widerspruch in OFFENE-TEXTE.md klaeren: @fastify/deepmerge benchmark/package.json ISC gegen Eltern-LICENSE MIT, keine eindeutige Auswahl behaupten.\n- [ ] [?] Privates Planora-Produkt: Lizenz-/Liefermodell und Eigentum vom Produkt-Owner dokumentieren.\n- [ ] Die begruendeten Zuordnungen samt Copyright/Notices in zuordnungen-nachtrag.json pruefen; @npmcli/agent enthaelt sowohl die Debian-Copyright-Angabe als auch die Autorenangabe des exakten npm-Pakets.\n- [ ] SPDX-/OS-/npm-/Go-Komponenten, Lizenzpflichten und gegebenenfalls Quellcodepflichten insgesamt pruefen; Scanner sind kein Vollstaendigkeitsbeweis.\n- [ ] Image-IDs, Archive und signiertes Release der konkreten Lieferung abgleichen.\n- [ ] Optionales ClamAV bei spaeterer Lieferung separat bewerten; hier nicht geliefert.\n- [ ] Verantwortliche Person, Entscheid, Datum und Lieferfassung dokumentieren.\n\n[A] Die technische Zuordnung ersetzt keine juristische Bewertung; Sigstore-Signaturen wurden beim Drizzle-Quellhinweis nicht verifiziert. Echte VM-/Betreiberabnahme bleibt separat offen.\n', encoding='utf-8', newline='\n')
dateien = [{'datei':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(ziel.iterdir()) if p.is_file() and p.name != 'SHA256SUMS.json']
(ziel/'SHA256SUMS.json').write_text(json.dumps(dateien,indent=2),encoding='utf-8',newline='\n')
print(json.dumps({'images':4,'sbomDateien':12,'paketVorkommen':len(zuordnung),'spdxStandardtexte':len(texte),'upstreamPakete':len(quellen),'nachtragGeschlossen':geschlossen,'upstreamOffen':len(offen),'lizenzbelegeGeprueft':sum(len(q.get('dateien',[])) for q in upstream),'dateien':len(dateien)}))
