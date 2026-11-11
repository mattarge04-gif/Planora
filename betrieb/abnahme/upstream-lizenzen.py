"""Ergaenzt exakte npm-/Go-Quellpakete und SPDX-Standardtexte, ohne Code auszufuehren."""
import concurrent.futures
import gzip
import hashlib
import io
import json
import re
import sys
import tarfile
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ziel = Path(sys.argv[1])
pakete = {}
ids = set()
for pfad in ziel.glob('*.syft.json.gz'):
    sbom = json.loads(gzip.decompress(pfad.read_bytes()))
    for a in sbom['artifacts']:
        if a['type'] in ('go-module', 'npm'):
            pakete[(a['type'], a['name'], a['version'])] = a
        for lizenz in a.get('licenses', []):
            ids.update(re.findall(r'[a-zA-Z0-9][a-zA-Z0-9.\-+]*', lizenz.get('spdxExpression', '')))

def hole(url):
    with urllib.request.urlopen(url, timeout=45) as r:
        return r.read()

def sammeln(key):
    typ, name, version = key
    try:
        if name == 'stdlib':
            url = f'https://raw.githubusercontent.com/golang/go/{version}/LICENSE'
            return key, url, [('LICENSE', hole(url))], None
        if typ == 'go-module' and name in ('caddy', 'github.com/restic/restic', 'github.com/tianon/gosu'):
            # Build-Hauptmodule enthalten teils keinen kanonischen Modulpfad/Version.
            url = {'caddy': 'https://raw.githubusercontent.com/caddyserver/caddy/v2.11.9/LICENSE', 'github.com/restic/restic': 'https://raw.githubusercontent.com/restic/restic/v0.19.1/LICENSE', 'github.com/tianon/gosu': 'https://raw.githubusercontent.com/tianon/gosu/1.19/LICENSE'}[name]
            return key, url, [('LICENSE', hole(url))], None
        if typ == 'go-module':
            escape = lambda s: ''.join('!' + c.lower() if c.isupper() else c for c in s)
            url = f'https://proxy.golang.org/{escape(name)}/@v/{escape(version)}.zip'
            with zipfile.ZipFile(io.BytesIO(hole(url))) as z:
                files = [(n, z.read(n)) for n in z.namelist() if re.search(r'(^|/)(licen[cs]e[^/]*|copying[^/]*|notice[^/]*|copyright)$', n, re.I) and not n.endswith('/')]
        else:
            url = f'https://registry.npmjs.org/{urllib.parse.quote(name, safe="@/")}/-/{name.rsplit("/",1)[-1]}-{version}.tgz'
            with tarfile.open(fileobj=io.BytesIO(hole(url)), mode='r:gz') as z:
                files = [(e.name, z.extractfile(e).read()) for e in z if e.isfile() and re.search(r'(^|/)(licen[cs]e[^/]*|copying[^/]*|notice[^/]*|copyright)$', e.name, re.I)]
        if not files and typ == 'npm':
            meta = json.loads(hole(f'https://registry.npmjs.org/{urllib.parse.quote(name, safe="@/")}/{version}'))
            repository = meta.get('repository', {})
            if isinstance(repository, dict) and meta.get('gitHead'):
                match = re.search(r'github.com[/:]([^/]+/[^/#]+?)(?:\.git)?$', repository.get('url', ''))
                if match:
                    for directory in [repository.get('directory', ''), '']:
                        for filename in ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'LICENCE', 'COPYING']:
                            candidat = f'https://raw.githubusercontent.com/{match[1]}/{meta["gitHead"]}/' + (directory.rstrip('/')+'/' if directory else '') + filename
                            try:
                                data = hole(candidat)
                                files, url = [(filename, data)], candidat
                                break
                            except urllib.error.HTTPError as e:
                                if e.code != 404:
                                    raise
                        if files:
                            break
        return key, url, files, None if files else 'Keine Lizenzdatei im exakten Quellpaket oder versionierten Repository'
    except Exception as e:
        return key, '', [], str(e)

nachweis = []
with tarfile.open(ziel/'upstream-lizenzen.tar.gz', 'w:gz') as aus:
    def speichern(name, data):
        info = tarfile.TarInfo(name)
        info.size, info.mtime, info.mode = len(data), 0, 0o644
        aus.addfile(info, io.BytesIO(data))
        return {'pfad': name, 'sha256': hashlib.sha256(data).hexdigest()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for key, url, files, fehler in pool.map(sammeln, sorted(pakete)):
            prefix = hashlib.sha256('|'.join(key).encode()).hexdigest()[:20]
            belege = [speichern(f'{prefix}/{i}-{Path(n).name}', data) for i, (n, data) in enumerate(files)]
            nachweis.append({'typ': key[0], 'name': key[1], 'version': key[2], 'quelle': url, 'dateien': belege, 'offen': fehler})
    for ident in sorted(ids - {'AND', 'OR', 'WITH'}):
        url = f'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/{ident}.txt'
        try:
            belege = [speichern(f'SPDX/{ident}.txt', hole(url))]
            nachweis.append({'spdx': ident, 'quelle': url, 'dateien': belege})
        except Exception as e:
            nachweis.append({'spdx': ident, 'quelle': url, 'offen': str(e)})
(ziel/'upstream-nachweis.json').write_text(json.dumps(nachweis, indent=2), encoding='utf-8', newline='\n')
print(json.dumps({'quellpakete': len(pakete), 'eintraege': len(nachweis), 'offen': sum(bool(x.get('offen')) for x in nachweis)}))
