"""Negativtests fuer pruefe-dossier.py an einer Kopie des committeten Dossiers.

Aufruf: python -I betrieb/abnahme/test_pruefe_dossier.py [dossier]
"""
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

HIER = Path(__file__).resolve().parent
SKRIPT = HIER/'pruefe-dossier.py'
QUELLE = Path(sys.argv[1]) if len(sys.argv) > 1 else HIER/'dossier-2026-11-11'


def lauf(ziel, *optionen):
    return subprocess.run([sys.executable, '-I', str(SKRIPT), *optionen, str(ziel)], capture_output=True, text=True, encoding='utf-8')


def ersetze_mitglied(archiv, name, neu):
    """Packt das Archiv mit einem veraenderten Mitglied neu, sonst unveraendert."""
    mitglieder = []
    with tarfile.open(archiv) as tar:
        for e in tar:
            mitglieder.append((e, neu if e.name == name else tar.extractfile(e).read()))
    with tarfile.open(archiv, 'w:gz') as tar:
        for e, daten in mitglieder:
            e.size = len(daten)
            tar.addfile(e, io.BytesIO(daten))


def summen_neu(ziel):
    dateien = [{'datei': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(ziel.iterdir()) if p.is_file() and p.name != 'SHA256SUMS.json']
    (ziel/'SHA256SUMS.json').write_text(json.dumps(dateien, indent=2), encoding='utf-8', newline='\n')


class PruefeDossier(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.ziel = Path(self.tmp.name)/'dossier'
        shutil.copytree(QUELLE, self.ziel)

    def tearDown(self):
        self.tmp.cleanup()

    def assertFehler(self, r, text):
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn(text, r.stderr)

    def test_unveraendert_bestanden_und_rein_lesend(self):
        vorher = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in self.ziel.iterdir()}
        r = lauf(self.ziel)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)['modus'], 'geprueft')
        self.assertEqual(vorher, {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in self.ziel.iterdir()})

    def test_manipulierter_upstream_beleg_trotz_neuer_summen(self):
        beleg = json.loads((self.ziel/'upstream-nachweis.json').read_text(encoding='utf-8'))[0]['dateien'][0]['pfad']
        ersetze_mitglied(self.ziel/'upstream-lizenzen.tar.gz', beleg, b'manipuliert\n')
        # --erzeugen schreibt neue Gesamtsummen; die Mitgliedspruefung muss die Manipulation trotzdem finden.
        self.assertFehler(lauf(self.ziel, '--erzeugen'), 'Falscher Lizenzbeleg')

    def test_manipulierte_image_lizenzdatei_trotz_neuer_summen(self):
        pfad = json.loads((self.ziel/'app.lizenzen.tar.json').read_text(encoding='utf-8'))[0]['pfad']
        ersetze_mitglied(self.ziel/'app.lizenzen.tar.gz', pfad, b'manipuliert\n')
        self.assertFehler(lauf(self.ziel, '--erzeugen'), 'Falsche Lizenzdatei')

    def test_veraenderte_datei_ohne_neue_summen(self):
        with (self.ziel/'release.json').open('ab') as f:
            f.write(b' ')
        self.assertFehler(lauf(self.ziel), 'Pruefsumme falsch: release.json')

    def test_zusaetzliche_datei(self):
        (self.ziel/'untergeschoben.txt').write_text('x', encoding='utf-8')
        self.assertFehler(lauf(self.ziel), 'ungelistet')

    def test_veraenderte_abgeleitete_datei_mit_passenden_summen(self):
        (self.ziel/'FREIGABE.md').write_text('# Alles freigegeben\n', encoding='utf-8', newline='\n')
        summen_neu(self.ziel)
        self.assertFehler(lauf(self.ziel), 'Abgeleitete Datei veraltet oder veraendert: FREIGABE.md')

    def test_erzeugen_stellt_abgeleitete_dateien_wieder_her(self):
        (self.ziel/'FREIGABE.md').write_text('# Alles freigegeben\n', encoding='utf-8', newline='\n')
        self.assertEqual(lauf(self.ziel, '--erzeugen').returncode, 0)
        self.assertEqual((self.ziel/'FREIGABE.md').read_bytes(), (QUELLE/'FREIGABE.md').read_bytes())


if __name__ == '__main__':
    unittest.main(argv=sys.argv[:1], verbosity=2)
