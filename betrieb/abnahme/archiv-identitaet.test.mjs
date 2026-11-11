// node --test betrieb/abnahme/archiv-identitaet.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeArchivIdentitaet, tarMitglied } from './archiv-identitaet.mjs';

// Minimales ustar-Archiv wie aus `docker save`.
function tar(mitglieder) {
  const teile = [];
  for (const [name, inhalt] of mitglieder) {
    const daten = Buffer.from(inhalt), kopf = Buffer.alloc(512);
    kopf.write(name, 0, 'utf8');
    kopf.write('0000644\0', 100); kopf.write('0000000\0', 108); kopf.write('0000000\0', 116);
    kopf.write(daten.length.toString(8).padStart(11, '0') + '\0', 124);
    kopf.write('00000000000\0', 136); kopf.write('0', 156); kopf.write('ustar\0', 257); kopf.write('00', 263);
    kopf.fill(' ', 148, 156);
    let summe = 0; for (const b of kopf) summe += b;
    kopf.write(summe.toString(8).padStart(6, '0') + '\0 ', 148);
    teile.push(kopf, daten, Buffer.alloc((512 - daten.length % 512) % 512));
  }
  return Buffer.concat([...teile, Buffer.alloc(1024)]);
}

const manifest = '{"schemaVersion":2}';
const id = 'sha256:' + createHash('sha256').update(manifest).digest('hex');
const index = digest => JSON.stringify({ manifests: [{ digest }] });
const mitArchiv = (inhalt, pruefung) => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-archiv-')), pfad = join(dir, 'image.tar');
  try { writeFileSync(pfad, tar(inhalt)); return pruefung(pfad); } finally { rmSync(dir, { recursive: true }); }
};

test('liest Mitglieder hinter grossen Vorgaengern', () => mitArchiv([['blobs/sha256/x', 'a'.repeat(1500)], ['index.json', 'ok']], p => {
  assert.equal(tarMitglied(p, 'index.json').toString(), 'ok');
  assert.throws(() => tarMitglied(p, 'fehlt.json'), /fehlt/);
}));

test('akzeptiert Archiv, dessen Index und Blob die signierte ID tragen', () => mitArchiv(
  [[`blobs/sha256/${id.slice(7)}`, manifest], ['index.json', index(id)]],
  p => assert.deepEqual(pruefeArchivIdentitaet(p, id), { archivIndex: id, blobGeprueft: true })));

test('verweigert Archiv mit anderem Image im Index', () => mitArchiv(
  [[`blobs/sha256/${id.slice(7)}`, manifest], ['index.json', index('sha256:' + '0'.repeat(64))]],
  p => assert.throws(() => pruefeArchivIdentitaet(p, id), /Index verweist nicht genau/)));

test('verweigert Archiv mit manipuliertem Blob unter der signierten ID', () => mitArchiv(
  [[`blobs/sha256/${id.slice(7)}`, manifest + ' '], ['index.json', index(id)]],
  p => assert.throws(() => pruefeArchivIdentitaet(p, id), /inhaltlich falsch/)));

test('verweigert Archiv mit mehreren Images', () => mitArchiv(
  [['index.json', JSON.stringify({ manifests: [{ digest: id }, { digest: id }] })]],
  p => assert.throws(() => pruefeArchivIdentitaet(p, id), /Index verweist nicht genau/)));
