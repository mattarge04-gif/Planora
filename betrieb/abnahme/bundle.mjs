// Nur Wegwerf-Schluessel: keine Lieferfreigabe. Ausgabe zwingend ausserhalb des Repos.
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = resolve(import.meta.dirname, '../..');
const ziel = resolve(process.argv[2] ?? '');
if (!process.argv[2] || ziel.startsWith(repo)) throw Error('Neues externes Ausgabeverzeichnis angeben');
mkdirSync(ziel, { recursive: true });
const bundle = join(ziel, 'bundle'); mkdirSync(bundle); mkdirSync(join(bundle, 'images'));
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
for (const f of ['compose.yaml', 'compose.backup.yaml', 'Caddyfile', 'wartung.html', 'planora', 'planora-betrieb@.service', 'planora-sicherung@.service', 'planora-sicherung@.timer']) cpSync(join(repo, 'betrieb', f), join(bundle, f));
docker('create', '--name', 'pb-bundle', 'pb-app:abnahme');
try { docker('cp', 'pb-bundle:/app/dist', join(bundle, 'werkzeug')); }
finally { docker('rm', 'pb-bundle'); }
writeFileSync(join(bundle, 'package.json'), '{"type":"module"}\n');
const { erzeugeRelease, signiereRelease } = await import(pathToFileURL(join(bundle, 'werkzeug/betrieb/release.js')));
const images = [];
for (const [dienst, tag] of [['app','pb-app:abnahme'], ['backup','pb-backup:abnahme'], ['db','postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5'], ['proxy','caddy:2.11.9-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9']]) {
  if (!tag.startsWith('pb-')) docker('pull', tag);
  const imageId = docker('image', 'inspect', tag, '--format', '{{.Id}}').trim();
  // Eigener Tag im Archiv erhaelt auch bei einem frischen Docker-Daemon die Referenz.
  const lokal = `pb-${dienst}:abnahme`; docker('tag', tag, lokal);
  docker('save', '-o', join(bundle, 'images', `${dienst}.tar`), lokal);
  images.push({ dienst, referenz: `${lokal}@${imageId}`, imageId, digest: null, architektur: 'amd64', archiv: `images/${dienst}.tar` });
}
const key = generateKeyPairSync('ed25519');
writeFileSync(join(ziel, 'release.pub'), key.publicKey.export({type:'spki',format:'pem'}));
const r = erzeugeRelease({version:'pb-abnahme',architektur:'amd64',images,migrationsVerzeichnis:join(repo,'app/src/db/migrationen'),modulmanifestVersion:'1',vonVersionen:[],schemaVorher:[]});
writeFileSync(join(bundle, 'release.json'), JSON.stringify(signiereRelease(r, key.privateKey.export({type:'pkcs8',format:'pem'})), null, 2));
cpSync(join(repo, 'app/package-lock.json'), join(ziel, 'package-lock.json'));
console.log(JSON.stringify({ bundle, images: images.length }));
