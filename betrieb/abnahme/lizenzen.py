"""Sammelt ausgelieferte Lizenz-/Notice-Dateien ohne Rootfs auf den Host zu entpacken."""
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path

quelle, ziel = map(Path, sys.argv[1:])
dateien = []
with tarfile.open(quelle) as rootfs, tarfile.open(ziel, 'w:gz') as aus:
    for entry in rootfs:
        if not entry.isfile() or not re.search(r'(^|/)(licen[cs]e[^/]*|copying[^/]*|copyright|notice[^/]*)$', entry.name, re.I):
            continue
        data = rootfs.extractfile(entry).read()
        aus.addfile(entry, __import__('io').BytesIO(data))
        dateien.append({'pfad': entry.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
ziel.with_suffix('.json').write_text(json.dumps(dateien, indent=2), encoding='utf-8', newline='\n')
print(json.dumps({'lizenzdateien': len(dateien), 'bytes': sum(x['bytes'] for x in dateien)}))
