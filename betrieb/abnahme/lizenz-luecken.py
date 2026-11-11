"""Ergaenzt belegte Lizenzzuordnungen; fuehrt weder Paketcode noch Builds aus."""
import base64
import gzip
import hashlib
import io
import json
import re
import sys
import tarfile
import urllib.request
from pathlib import Path

ziel = Path(sys.argv[1])
nachweis = json.loads((ziel/'upstream-nachweis.json').read_text(encoding='utf-8'))
cache = {}
paket_cache = {}
dateien = {}
with tarfile.open(ziel/'upstream-lizenzen.tar.gz') as tar:
    for entry in tar:
        assert entry.isfile() and entry.name not in dateien
        dateien[entry.name] = tar.extractfile(entry).read()

def hole(url):
    if url not in cache:
        with urllib.request.urlopen(url, timeout=45) as r:
            cache[url] = r.read()
    return cache[url]

def paket(name, version):
    key = name, version
    if key not in paket_cache:
        url = f'https://registry.npmjs.org/{name}/{version}'
        meta = json.loads(hole(url))
        archive_url = meta['dist']['tarball']
        raw = hole(archive_url)
        # Exakte Registry-Integritaet, keine aktuelle oder benachbarte Version einsetzen.
        algorithm, digest = meta['dist']['integrity'].split('-', 1)
        assert algorithm == 'sha512' and hashlib.sha512(raw).digest() == base64.b64decode(digest)
        with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
            files = {e.name: tar.extractfile(e).read() for e in tar if e.isfile()}
        p = json.loads(files['package/package.json'])
        assert (p['name'], p['version']) == key
        paket_cache[key] = meta, p, files, archive_url, hashlib.sha256(raw).hexdigest()
    return paket_cache[key]

def sammeln(eintrag):
    name, version = eintrag['name'], eintrag['version']
    prefix = 'nachtrag/' + hashlib.sha256(f'{name}|{version}'.encode()).hexdigest()[:20]
    belege = []

    def belege_datei(datei, raw, quelle, mitglied=None, archiv_hash=None):
        pfad = f'{prefix}/{len(belege)}-{datei}'
        dateien[pfad] = raw
        b = {'pfad': pfad, 'sha256': hashlib.sha256(raw).hexdigest(), 'quelle': quelle}
        if mitglied:
            b.update(archivMitglied=mitglied, archivSha256=archiv_hash)
        belege.append(b)

    def roh(datei, url):
        raw = hole(url)
        belege_datei(datei, raw, url)
        return raw

    def aus_paket(n, v, mitglied, datei):
        _, p, files, url, digest = paket(n, v)
        belege_datei(datei, files[mitglied], url, mitglied, digest)
        return p, files[mitglied]

    if name == 'planora-app':
        raise ValueError('Privates eigenes Projekt ohne Lizenz-/Liefertext im Repository; Produkt-Owner muss Eigentum und vertragliches Liefermodell dokumentieren, keine externe Lizenz erfinden')
    if name == 'benchmarks':
        fundstellen = []
        konflikte = []
        for sbom in ziel.glob('*.syft.json.gz'):
            artifacts = json.loads(gzip.decompress(sbom.read_bytes()))['artifacts']
            for a in artifacts:
                if a['type'] == 'npm' and (a['name'], a['version']) == (name, version):
                    for location in a['locations']:
                        path = location['path']
                        parent = '@fastify/deepmerge' if '/@fastify/deepmerge/benchmark/' in path else 'secure-json-parse' if '/secure-json-parse/benchmarks/' in path else None
                        assert parent, f'Nicht zugeordnete Fixture: {path}'
                        parent_version = next(x['version'] for x in artifacts if x['type'] == 'npm' and x['name'] == parent)
                        member = 'package/' + path.split(parent+'/',1)[1]
                        p, raw = aus_paket(parent, parent_version, member, 'fixture-package.json')
                        fixture = json.loads(raw)
                        assert fixture['name'] == name, f'Falsche Fixture an {path}'
                        aus_paket(parent, parent_version, 'package/package.json', 'eltern-package.json')
                        aus_paket(parent, parent_version, 'package/LICENSE', 'eltern-LICENSE')
                        fundstellen.append({'image': sbom.name, 'pfad': path, 'elternpaket': parent, 'version': parent_version, 'lizenzElternpaket': p['license'], 'lizenzFixture': fixture.get('license')})
                        if fixture.get('license') not in (None, p['license']):
                            assert fixture['license'] == 'ISC', 'Unbekannte abweichende Fixture-Lizenz'
                            roh('fixture-ISC.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/ISC.txt')
                            konflikte.append(path)
        assert len(fundstellen) == 4
        grund = 'Mitgelieferte Fixture-Unterverzeichnisse zweier exakt versionierter Pakete; deren paketweite LICENSE und alle vier SBOM-Fundstellen separat belegt, kein eigenstaendiges Registry-Paket'
        eintrag['fundstellen'] = fundstellen
        if konflikte:
            eintrag.update(dateien=belege, teilweise='secure-json-parse-Fixture ueber BSD-3-Clause-Elterntext belegt; Deepmerge-Fixture samt abweichendem ISC-Eintrag und beiden Lizenztexten gesichert')
            raise ValueError('@fastify/deepmerge 3.2.4: benchmark/package.json deklariert ISC, Eltern-LICENSE MIT; Fixture-Autor leer und keine eigene Copyright-Datei, deshalb keine eindeutige Auswahl belegen; secure-json-parse-Fixture separat belegt')
    else:
        meta, p, files, archive_url, archive_hash = paket(name, version)
        aus_paket(name, version, 'package/package.json', 'package.json')
        belege_datei('registry.json', json.dumps(meta, indent=2).encode(), f'https://registry.npmjs.org/{name}/{version}')
        if name in ('pg-types', 'pgpass'):
            _, readme = aus_paket(name, version, 'package/README.md', 'README.md')
            assert b'Permission is hereby granted' in readme and b'Copyright' in readme
            grund = 'Vollstaendiger MIT-Text mit Copyright direkt in der README des integritaetsgeprueften exakten npm-Pakets'
        elif name in ('spdx-exceptions', 'spdx-license-ids'):
            aus_paket(name, version, 'package/README.md', 'README.md')
            lizenz = p['license']
            assert lizenz == ('CC-BY-3.0' if name == 'spdx-exceptions' else 'CC0-1.0')
            roh('Lizenztext.txt', f'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/{lizenz}.txt')
            grund = 'Paket-README dokumentiert Copyright/Attribution beziehungsweise ausdrueckliche CC0-Zuordnung; voller zugehoeriger Creative-Commons-Text beigefuegt'
        elif name in ('@node-rs/argon2-linux-x64-gnu', '@rolldown/binding-linux-x64-gnu'):
            parent = '@node-rs/argon2' if name.startswith('@node-rs/') else 'rolldown'
            aus_paket(name, version, 'package/README.md', 'binaerpaket-README.md')
            pp, _ = aus_paket(parent, version, 'package/package.json', 'eltern-package.json')
            assert pp['optionalDependencies'][name] == version and pp['license'] == p['license'] == 'MIT'
            aus_paket(parent, version, 'package/LICENSE', 'eltern-LICENSE')
            grund = 'Plattformspezifisches Binaerpaket: README-Zugehoerigkeit, identische Version/Lizenz und exakte optionalDependency des Elternpakets samt dessen MIT-Text belegt'
        elif name.startswith('@aws-sdk/'):
            commit = 'dee2abd898e7d1c69dd5ca5d74ecdce92e47d19d'
            directory = 'packages-internal/' + name.split('/')[1]
            base = f'https://raw.githubusercontent.com/aws/aws-sdk-js-v3/{commit}/'
            source = json.loads(roh('upstream-package.json', base+directory+'/package.json'))
            assert (source['name'], source['version'], source['license']) == (name, version, p['license'])
            text = roh('upstream-LICENSE', base+'LICENSE')
            assert b'Copyright 2018 Amazon.com' in text and p['license'] == 'Apache-2.0'
            grund = f'Exakte Paketversion und Apache-2.0 am AWS-Release-Commit {commit} geprueft; paketuebergreifender LICENSE-Text einschliesslich Amazon-Copyright beigefuegt'
        elif name == 'drizzle-orm':
            url = meta['dist']['attestations']['url']
            attestations = json.loads(roh('npm-provenance.json', url))
            statement = next(json.loads(base64.b64decode(a['bundle']['dsseEnvelope']['payload'])) for a in attestations['attestations'] if a['predicateType'] == 'https://slsa.dev/provenance/v1')
            assert any(s['digest'].get('sha512') == hashlib.sha512(hole(archive_url)).hexdigest() for s in statement['subject'])
            commit = statement['predicate']['buildDefinition']['resolvedDependencies'][0]['digest']['gitCommit']
            assert re.fullmatch('[0-9a-f]{40}', commit)
            roh('upstream-LICENSE', f'https://raw.githubusercontent.com/drizzle-team/drizzle-orm/{commit}/LICENSE')
            grund = f'Exaktes npm-Archiv per SHA512 mit Registry-Provenance-Subjekt abgeglichen; LICENSE am darin genannten Quellcommit {commit}; keine Sigstore-Signaturpruefung behauptet'
        elif name == 'abstract-logging':
            _, readme = aus_paket(name, version, 'package/Readme.md', 'Readme.md')
            assert b'http://jsumners.mit-license.org/' in readme and p['license'] == 'MIT'
            base = 'https://raw.githubusercontent.com/remy/mit-license/21ac30f351903ff23b399289cb4fdda05fb45f15/'
            author = json.loads(roh('lizenzgeber.json', base+'users/jsumners.json'))
            assert author['copyright'] == 'James Sumners' and author['copyright'] in p['author']
            roh('MIT-Vorlage.ejs', base+'licenses/MIT.ejs')
            grund = 'Exaktes Paket verweist auf die Autorenlizenz jsumners.mit-license.org; dessen versionierter Hosting-Quellcode belegt James Sumners als Copyright-Inhaber und enthaelt den vollen MIT-Text als Vorlage, ohne erfundene Jahreszahl'
        elif name == '@npmcli/agent':
            orig_url = 'https://snapshot.debian.org/file/1d708e9c826d617662c650cdbe682072e7597a7d'
            deb_url = 'https://snapshot.debian.org/file/a956152df2cc8bc74eee782be835d2e8b3bf31b2'
            for url, sha1 in [(orig_url, '1d708e9c826d617662c650cdbe682072e7597a7d'), (deb_url, 'a956152df2cc8bc74eee782be835d2e8b3bf31b2')]:
                assert hashlib.sha1(hole(url)).hexdigest() == sha1
            with tarfile.open(fileobj=io.BytesIO(hole(orig_url)), mode='r:xz') as tar:
                member = next(e for e in tar if e.name.endswith('/node_modules/@npmcli/agent/package.json'))
                raw = tar.extractfile(member).read()
                source = json.loads(raw)
                assert (source['name'], source['version'], source['license']) == (name, version, p['license'])
                belege_datei('debian-agent-package.json', raw, orig_url, member.name, hashlib.sha256(hole(orig_url)).hexdigest())
            with tarfile.open(fileobj=io.BytesIO(hole(deb_url)), mode='r:xz') as tar:
                raw = tar.extractfile('debian/copyright').read()
                assert b'Files: node_modules/*\nCopyright: npm, Inc.\nLicense: ISC' in raw and b'License: ISC\n Permission to use' in raw
                belege_datei('debian-copyright', raw, deb_url, 'debian/copyright', hashlib.sha256(hole(deb_url)).hexdigest())
            grund = 'Debian-Snapshot npm 11.19.0+ds1-1 enthaelt exakt @npmcli/agent 4.0.2; dessen node_modules-Copyright-/ISC-Text beigefuegt, zusaetzlich abweichende Autorenangabe GitHub Inc. aus dem exakten npm-Paket erhalten'
        else:
            raise ValueError('Keine belegte Ergaenzungsregel fuer diese Komponente')
    assert belege
    eintrag.update(dateien=belege, offen=None, ergaenzung=grund)

zielnamen = {'@aws-sdk/credential-provider-http', '@aws-sdk/credential-provider-login', '@aws-sdk/nested-clients', '@node-rs/argon2-linux-x64-gnu', '@npmcli/agent', '@rolldown/binding-linux-x64-gnu', 'abstract-logging', 'benchmarks', 'drizzle-orm', 'pg-types', 'pgpass', 'planora-app', 'spdx-exceptions', 'spdx-license-ids'}
bearbeitet = [e for e in nachweis if e.get('name') in zielnamen]
assert len(bearbeitet) == 14
for e in bearbeitet:
    if e.get('regelVersion') in (2, 3) and e.get('dateien'):
        assert all(hashlib.sha256(dateien[b['pfad']]).hexdigest() == b['sha256'] for b in e['dateien'])
        continue
    try:
        sammeln(e)
    except Exception as fehler:
        e.pop('ergaenzung', None)
        e['offen'] = '[?] ' + (str(fehler) or type(fehler).__name__)
    e['regelVersion'] = 2

# PO-Entscheide 2026-11-11 (Regelversion 3). Technische Dokumentation der Produkt-Owner-Entscheide, keine juristische Freigabe.
PO = 'PO-Entscheid 2026-11-11'
LIEFERMODELL = f'''# Planora: Lizenz- und Liefermodell ({PO})

- Planora (`planora-app`) ist proprietaer; alle Rechte liegen beim Anbieter.
- Der Kunde erhaelt ein nicht-exklusives, nicht uebertragbares Nutzungsrecht fuer seine Instanz waehrend der Vertragsdauer.
- Lieferung und Betrieb erfolgen als signierte Images; Quellcode wird nicht geliefert.
- Betriebsmodell: Der Anbieter stellt Server (CH-VM) und Domain und betreibt die Instanz; der Kunde braucht keine eigene IT.
- Drittkomponenten in den Images stehen unter ihren eigenen Lizenzen gemaess diesem Dossier (SBOMs, Lizenzarchive, upstream-nachweis.json).

[?] Offen (juristisch): schriftliche Rechtekette Entwickler -> Firma und der Vertragstext mit dem Kunden.
'''
for e in bearbeitet:
    if e['name'] == 'benchmarks':
        isc = [b for b in e.get('dateien', []) if b['pfad'].endswith('-fixture-ISC.txt')]
        mit = [b for b in e.get('dateien', []) if b['pfad'].endswith('-eltern-LICENSE') and '/@fastify/deepmerge/' in b.get('quelle', '')]
        assert isc and mit and all(hashlib.sha256(dateien[b['pfad']]).hexdigest() == b['sha256'] for b in isc + mit), 'Deepmerge-Fixture: ISC- oder MIT-Text fehlt'
        e.pop('teilweise', None)
        e.update(offen=None, poEntscheid=PO, regelVersion=3, ergaenzung=f'{PO}: Deepmerge-Fixture (benchmark/package.json ISC, Eltern-LICENSE @fastify/deepmerge 3.2.4 MIT) technisch geschlossen, weil beide permissiv und beide Texte beigelegt sind; keine juristische Auswahl zwischen beiden. secure-json-parse-Fixture ueber BSD-3-Clause-Elterntext belegt.')
    elif e['name'] == 'planora-app':
        raw = LIEFERMODELL.encode()
        pfad = 'nachtrag/' + hashlib.sha256(f'{e["name"]}|{e["version"]}'.encode()).hexdigest()[:20] + '/0-po-liefermodell.md'
        dateien[pfad] = raw
        e.update(quelle=PO, dateien=[{'pfad': pfad, 'sha256': hashlib.sha256(raw).hexdigest(), 'quelle': PO}], poEntscheid=PO, regelVersion=3,
                 ergaenzung=f'{PO}: proprietaer, alle Rechte beim Anbieter; nicht-exklusives, nicht uebertragbares Nutzungsrecht des Kunden fuer seine Instanz waehrend der Vertragsdauer; Lieferung/Betrieb als signierte Images ohne Quellcode; Drittkomponenten unter eigenen Lizenzen gemaess Dossier.',
                 offen='[?] Liefermodell per PO-Entscheid dokumentiert; schriftliche Rechtekette Entwickler -> Firma und Vertragstext (juristisch) offen')

temp = ziel/'upstream-lizenzen.neu.tar.gz'
with temp.open('wb') as ausgabe, gzip.GzipFile(filename='', mode='wb', fileobj=ausgabe, mtime=0) as gz, tarfile.open(fileobj=gz, mode='w') as tar:
    for name, raw in sorted(dateien.items()):
        info = tarfile.TarInfo(name)
        info.size, info.mode, info.mtime = len(raw), 0o644, 0
        tar.addfile(info, io.BytesIO(raw))
temp.replace(ziel/'upstream-lizenzen.tar.gz')
(ziel/'upstream-nachweis.json').write_text(json.dumps(nachweis, indent=2), encoding='utf-8', newline='\n')
(ziel/'zuordnungen-nachtrag.json').write_text(json.dumps(bearbeitet, indent=2), encoding='utf-8', newline='\n')
print(json.dumps({'untersucht': len(bearbeitet), 'geschlossen': sum(not e.get('offen') for e in bearbeitet), 'offen': sum(bool(e.get('offen')) for e in bearbeitet)}))
