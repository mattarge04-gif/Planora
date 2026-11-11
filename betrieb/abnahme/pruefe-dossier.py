"""Dossier-Pruefung der vier SBOM-Saetze und ihrer Lizenz-Zuordnung.

Ohne Option rein lesend: Gesamtpruefsummen, SBOM-Hashes, jedes referenzierte Archivmitglied
(upstream-nachweis.json, *.lizenzen.tar.json) und die abgeleiteten Dateien werden gegen den
Bestand geprueft; es wird nichts geschrieben.
Mit --erzeugen werden lizenz-zuordnung.json, OFFENE-TEXTE.md, FREIGABE.md und SHA256SUMS.json
neu geschrieben und anschliessend dieselbe lesende Pruefung ausgefuehrt.
"""
import gzip
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path

SUMMEN = 'SHA256SUMS.json'
ABGELEITET = ('lizenz-zuordnung.json', 'OFFENE-TEXTE.md', 'FREIGABE.md')


class DossierFehler(Exception):
    pass


def pruefe(bedingung, meldung):
    if not bedingung:
        raise DossierFehler(meldung)


def sha(daten):
    return hashlib.sha256(daten).hexdigest()


def lies_json(ziel, name):
    return json.loads((ziel/name).read_text(encoding='utf-8'))


def archiv_mitglieder(pfad):
    """Alle Mitglieder als Name -> Bytes; Duplikate und Nicht-Dateien sind ein Fehler."""
    mitglieder = {}
    with tarfile.open(pfad) as tar:
        for e in tar:
            pruefe(e.isfile(), f'{pfad.name}: kein regulaeres Mitglied {e.name}')
            pruefe(e.name not in mitglieder, f'{pfad.name}: doppeltes Mitglied {e.name}')
            mitglieder[e.name] = tar.extractfile(e).read()
    return mitglieder


def ableiten(ziel):
    """Berechnet die abgeleiteten Dateien ausschliesslich aus den Quelldateien des Dossiers."""
    nachweis = lies_json(ziel, 'nachweis.json')
    upstream = lies_json(ziel, 'upstream-nachweis.json')
    texte = {x['spdx']: x for x in upstream if 'spdx' in x and not x.get('offen')}
    quellen = {(x['typ'], x['name'], x['version']): x for x in upstream if 'typ' in x}
    pruefe({i['dienst'] for i in nachweis['images']} == {'app', 'backup', 'db', 'proxy'}, 'Nicht genau die vier Pflichtimages')
    zuordnung = []
    for image in nachweis['images']:
        dienst = image['dienst']
        syft = json.loads(gzip.decompress((ziel/f'{dienst}.syft.json.gz').read_bytes()))
        spdx = json.loads(gzip.decompress((ziel/f'{dienst}.spdx.json.gz').read_bytes()))
        cdx = json.loads(gzip.decompress((ziel/f'{dienst}.cdx.json.gz').read_bytes()))
        pruefe(syft['artifacts'] and spdx['spdxVersion'].startswith('SPDX-') and cdx['bomFormat'] == 'CycloneDX', f'{dienst}: SBOM unlesbar')
        pruefe(len(syft['artifacts']) == image['pakete'], f'{dienst}: Paketanzahl weicht ab')
        for a in syft['artifacts']:
            ids = {ident for l in a.get('licenses', []) for ident in re.findall(r'[a-zA-Z0-9][a-zA-Z0-9.\-+]*', l.get('spdxExpression', ''))} - {'AND', 'OR', 'WITH'}
            q = quellen.get((a['type'], a['name'], a['version']))
            zuordnung.append({'image': dienst, 'typ': a['type'], 'name': a['name'], 'version': a['version'], 'spdxTexte': sorted(ids & texte.keys()), 'upstreamDateien': q.get('dateien', []) if q else [], 'upstreamOffen': q.get('offen') if q else None, **({'begruendung': q.get('ergaenzung') or q['teilweise']} if q and (q.get('ergaenzung') or q.get('teilweise')) else {})})
            pruefe(ids <= texte.keys(), f'Fehlender Standardtext: {ids - texte.keys()}')
    offen = [x for x in quellen.values() if x.get('offen')]
    geschlossen = sum(bool(x.get('ergaenzung')) and not x.get('offen') for x in quellen.values())
    inhalte = {
        'lizenz-zuordnung.json': json.dumps(zuordnung, indent=2),
        'OFFENE-TEXTE.md': f'# Offene Lizenz-/Liefertext-Zuordnungen\n\nNachtrag: {geschlossen} der urspruenglich 14 Zuordnungen technisch mit Quellen belegt, {len(offen)} offen. Separate LICENSE-Dateien sind nicht zwingend: README-Lizenzabschnitte, exakt gebundene Elternpakete und Debian-copyright-Dateien sind dokumentierte Belege. Keine juristische oder menschliche Lieferfreigabe. Die Deepmerge-Fixture ist per PO-Entscheid 2026-11-11 technisch geschlossen (beide permissiv, ISC- und MIT-Text beigelegt).\n\n' + '\n'.join(f'- `{x["name"]}@{x["version"]}` ({x["typ"]}): {x["offen"]}' for x in offen) + '\n\nSiehe zuordnungen-nachtrag.json fuer die einzelnen begruendeten Zuordnungen und upstream-nachweis.json fuer Quellen, Archivmitglieder und Pruefsummen.\n',
        'FREIGABE.md': f'# Menschliche Lizenz-/Lieferfreigabe offen\n\nTechnischer Nachtrag: {geschlossen}/14 bisher offene Zuordnungen belegt; {len(offen)} verbleibend. Dies ist keine menschliche oder juristische Freigabe; die Checkliste bleibt per PO-Entscheid 2026-11-11 bewusst offen.\n\nPO-Entscheide 2026-11-11 (technisch dokumentiert in upstream-nachweis.json/zuordnungen-nachtrag.json): Deepmerge-Fixture mit ISC- und MIT-Text beigelegt und technisch geschlossen (beide permissiv). Planora proprietaer, alle Rechte beim Anbieter, nicht-exklusives, nicht uebertragbares Nutzungsrecht des Kunden fuer seine Instanz waehrend der Vertragsdauer, Lieferung/Betrieb als signierte Images ohne Quellcode, Drittkomponenten unter eigenen Lizenzen gemaess Dossier. Betrieb auf Server/Domain des Anbieters (CH-VM), Kunde ohne eigene IT.\n\n- [ ] Deepmerge-Fixture: beigelegte ISC- und MIT-Texte gemaess PO-Entscheid sichten.\n- [ ] [?] Planora: schriftliche Rechtekette Entwickler -> Firma und Vertragstext juristisch klaeren; Liefermodell siehe nachtrag/*/0-po-liefermodell.md.\n- [ ] Die begruendeten Zuordnungen samt Copyright/Notices in zuordnungen-nachtrag.json pruefen; @npmcli/agent enthaelt sowohl die Debian-Copyright-Angabe als auch die Autorenangabe des exakten npm-Pakets.\n- [ ] SPDX-/OS-/npm-/Go-Komponenten, Lizenzpflichten und gegebenenfalls Quellcodepflichten insgesamt pruefen; Scanner sind kein Vollstaendigkeitsbeweis.\n- [ ] Image-IDs, Archive und signiertes Release der konkreten Lieferung abgleichen.\n- [ ] Optionales ClamAV bei spaeterer Lieferung separat bewerten; hier nicht geliefert.\n- [ ] Verantwortliche Person, Entscheid, Datum und Lieferfassung dokumentieren.\n\n[A] Die technische Zuordnung ersetzt keine juristische Bewertung; Sigstore-Signaturen wurden beim Drizzle-Quellhinweis nicht verifiziert. Die echte VM-Abnahme auf der CH-VM des Anbieters bleibt separat offen.\n',
    }
    kennzahlen = {'images': 4, 'sbomDateien': 12, 'paketVorkommen': len(zuordnung), 'spdxStandardtexte': len(texte), 'upstreamPakete': len(quellen), 'nachtragGeschlossen': geschlossen, 'upstreamOffen': len(offen)}
    return inhalte, kennzahlen


def verifiziere(ziel):
    """Rein lesende Pruefung; wirft DossierFehler bei der ersten Abweichung."""
    # 1. Gesamtpruefsummen: jede Datei gelistet, keine fehlt, keine kommt hinzu.
    summen = lies_json(ziel, SUMMEN)
    gelistet = {x['datei']: x for x in summen}
    pruefe(len(gelistet) == len(summen), 'Doppelte Eintraege in SHA256SUMS.json')
    vorhanden = {p.name for p in ziel.iterdir() if p.is_file() and p.name != SUMMEN}
    pruefe(vorhanden == set(gelistet), f'Dateibestand weicht ab: fehlt {sorted(set(gelistet) - vorhanden)}, ungelistet {sorted(vorhanden - set(gelistet))}')
    for name, eintrag in gelistet.items():
        daten = (ziel/name).read_bytes()
        pruefe(len(daten) == eintrag['bytes'] and sha(daten) == eintrag['sha256'], f'Pruefsumme falsch: {name}')
    # 2. SBOM-Dateien gegen nachweis.json.
    nachweis = lies_json(ziel, 'nachweis.json')
    for image in nachweis['images']:
        for datei in image['dateien']:
            pruefe(sha((ziel/datei['datei']).read_bytes()) == datei['sha256'], f'SBOM-Pruefsumme falsch: {datei["datei"]}')
    # 3. Jedes in upstream-nachweis.json referenzierte Archivmitglied gegen seinen gespeicherten Hash.
    upstream = lies_json(ziel, 'upstream-nachweis.json')
    archiv = archiv_mitglieder(ziel/'upstream-lizenzen.tar.gz')
    referenziert = set()
    for quelle in upstream:
        for beleg in quelle.get('dateien', []):
            pruefe(beleg['pfad'] in archiv, f'Lizenzbeleg fehlt im Archiv: {beleg["pfad"]}')
            pruefe(sha(archiv[beleg['pfad']]) == beleg['sha256'], f'Falscher Lizenzbeleg: {beleg["pfad"]}')
            referenziert.add(beleg['pfad'])
    # zuordnungen-nachtrag.json ist eine Teilmenge; ihre Belege muessen identisch referenziert sein.
    for e in lies_json(ziel, 'zuordnungen-nachtrag.json'):
        for beleg in e.get('dateien', []):
            pruefe(beleg['pfad'] in referenziert and sha(archiv[beleg['pfad']]) == beleg['sha256'], f'Nachtragsbeleg falsch: {beleg["pfad"]}')
    # 4. Ausgelieferte Lizenzdateien je Image gegen ihren Index.
    lizenzdateien = 0
    for image in nachweis['images']:
        dienst = image['dienst']
        index = lies_json(ziel, f'{dienst}.lizenzen.tar.json')
        mitglieder = archiv_mitglieder(ziel/f'{dienst}.lizenzen.tar.gz')
        pruefe(len(index) == len({x['pfad'] for x in index}) == len(mitglieder), f'{dienst}: Lizenzindex und Archiv ungleich gross')
        for x in index:
            pruefe(x['pfad'] in mitglieder, f'{dienst}: Lizenzdatei fehlt im Archiv: {x["pfad"]}')
            daten = mitglieder[x['pfad']]
            pruefe(len(daten) == x['bytes'] and sha(daten) == x['sha256'], f'{dienst}: Falsche Lizenzdatei: {x["pfad"]}')
        lizenzdateien += len(index)
    # 5. Abgeleitete Dateien muessen exakt der Neuberechnung entsprechen.
    inhalte, kennzahlen = ableiten(ziel)
    for name, inhalt in inhalte.items():
        pruefe((ziel/name).read_text(encoding='utf-8') == inhalt, f'Abgeleitete Datei veraltet oder veraendert: {name}')
    return {**kennzahlen, 'lizenzbelegeGeprueft': sum(len(q.get('dateien', [])) for q in upstream), 'imageLizenzdateienGeprueft': lizenzdateien, 'unreferenzierteArchivmitglieder': sorted(set(archiv) - referenziert), 'dateien': len(gelistet)}


def erzeuge(ziel):
    inhalte, _ = ableiten(ziel)
    for name, inhalt in inhalte.items():
        (ziel/name).write_text(inhalt, encoding='utf-8', newline='\n')
    dateien = [{'datei': p.name, 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())} for p in sorted(ziel.iterdir()) if p.is_file() and p.name != SUMMEN]
    (ziel/SUMMEN).write_text(json.dumps(dateien, indent=2), encoding='utf-8', newline='\n')


def main(argv):
    erzeugen = '--erzeugen' in argv
    pfade = [a for a in argv if a != '--erzeugen']
    if len(pfade) != 1:
        print('Aufruf: pruefe-dossier.py [--erzeugen] <dossier>', file=sys.stderr)
        return 2
    ziel = Path(pfade[0])
    if erzeugen:
        erzeuge(ziel)
    try:
        ergebnis = verifiziere(ziel)
    except (DossierFehler, KeyError, OSError, ValueError, tarfile.TarError) as fehler:
        print(f'DOSSIER FEHLERHAFT: {type(fehler).__name__}: {fehler}', file=sys.stderr)
        return 1
    print(json.dumps({'modus': 'erzeugt+geprueft' if erzeugen else 'geprueft', **ergebnis}))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
