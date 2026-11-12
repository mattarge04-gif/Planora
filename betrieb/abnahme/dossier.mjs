import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { pruefeArchivIdentitaet } from './archiv-identitaet.mjs';
const quelle = resolve(process.argv[2]), ziel = resolve(process.argv[3]);
const docker = (...args) => execFileSync('docker', args, {encoding:'utf8',maxBuffer:10*1024*1024,timeout:900000});
const syft = 'anchore/syft@sha256:03215d0e98b661d0ecbc8575dbc14d65be1743b5de5df6410aecb7e80f95b060';
const { pruefeRelease } = await import(pathToFileURL(join(quelle,'bundle/werkzeug/betrieb/release.js')));
const release = pruefeRelease(readFileSync(join(quelle,'bundle/release.json'),'utf8'),readFileSync(join(quelle,'release.pub'),'utf8'));
const webLockfile = join(quelle, 'package-lock-web.json');
execFileSync('node',[join(quelle,'bundle/werkzeug/betrieb/dossier.js'),'--bundle',join(quelle,'bundle'),'--schluessel',join(quelle,'release.pub'),'--lockfile',join(quelle,'package-lock.json'),...(existsSync(webLockfile) ? ['--lockfile-web',webLockfile] : []),'--ausgabe',ziel]);
copyFileSync(join(quelle,'package-lock.json'),join(ziel,'package-lock.json'));
if (existsSync(webLockfile)) copyFileSync(webLockfile, join(ziel, 'package-lock-web.json'));
const ergebnisse = [];
for (const img of release.images) {
  const name = `pb-lizenz-${img.dienst}`;
  docker('run','--rm','--name',name,'--network','none','-e','SYFT_CHECK_FOR_APP_UPDATE=false','-v',`${join(quelle,'bundle')}:/quelle:ro`,'-v',`${ziel}:/ausgabe`,syft,`docker-archive:/quelle/${img.archiv}`,'-o',`syft-json=/ausgabe/${img.dienst}.syft.json`,'-o',`spdx-json=/ausgabe/${img.dienst}.spdx.json`,'-o',`cyclonedx-json=/ausgabe/${img.dienst}.cdx.json`);
  const sbom = JSON.parse(readFileSync(join(ziel,`${img.dienst}.syft.json`)));
  if (!sbom.artifacts.length) throw Error('Leeres SBOM');
  // Lizenz-Rootfs nur aus dem gelieferten Archiv und ueber die unveraenderliche Image-ID, nie ueber einen Tag.
  const archiv = join(quelle,'bundle',img.archiv), identitaet = pruefeArchivIdentitaet(archiv, img.imageId);
  docker('load','--quiet','-i',archiv);
  const tar = join(quelle,`${img.dienst}-rootfs.tar`);
  docker('create','--name',name,img.imageId);
  try {
    const containerImage = docker('inspect','--format','{{.Image}}',name).trim();
    if (containerImage !== img.imageId) throw Error(`${img.dienst}: Container-Image ${containerImage} ungleich signierter ID ${img.imageId}`);
    identitaet.containerImage = containerImage;
    docker('export','-o',tar,name);
  }
  finally { docker('rm',name); }
  execFileSync('python',[join(import.meta.dirname,'lizenzen.py'),tar,join(ziel,`${img.dienst}.lizenzen.tar.gz`)],{stdio:'inherit'});
  rmSync(tar);
  const unbekannt = sbom.artifacts.filter(a=>!a.licenses?.length || a.licenses.every(l=>!l.spdxExpression)).map(a=>({name:a.name,version:a.version,typ:a.type}));
  const dateien = [];
  for (const format of ['syft','spdx','cdx']) {
    const pfad = join(ziel,`${img.dienst}.${format}.json`), bytes = readFileSync(pfad);
    const gz = gzipSync(bytes); writeFileSync(`${pfad}.gz`,gz); rmSync(pfad);
    dateien.push({datei:`${img.dienst}.${format}.json.gz`,sha256:createHash('sha256').update(gz).digest('hex')});
  }
  const archiveHash = createHash('sha256');
  for await (const chunk of createReadStream(join(quelle,'bundle',img.archiv))) archiveHash.update(chunk);
  ergebnisse.push({dienst:img.dienst,imageId:img.imageId,rootfsQuelle:identitaet,archivSha256:archiveHash.digest('hex'),pakete:sbom.artifacts.length,lizenzUngeklaert:unbekannt,dateien});
}
copyFileSync(join(quelle,'bundle/release.json'),join(ziel,'release.json'));
copyFileSync(join(quelle,'release.pub'),join(ziel,'release.pub'));
writeFileSync(join(ziel,'nachweis.json'),JSON.stringify({syft,scope:'squashed',status:'MENSCHLICHE_PRUEFUNG_OFFEN',images:ergebnisse},null,2));
writeFileSync(join(ziel,'FREIGABE.md'),'# Lieferfreigabe offen\n\n- [ ] Alle vier Pflichtimages und IDs gegen signiertes Release abgleichen.\n- [ ] SBOMs inklusive OS-, npm- und Go-Komponenten pruefen; Scanner sind kein Vollstaendigkeitsbeweis.\n- [ ] Ungeklaerte Lizenzangaben in nachweis.json zuordnen.\n- [ ] Lizenzarchive auf komponentenbezogene Vollstaendigkeit, Notices und Quellcodepflichten pruefen; fehlende Texte nachfordern.\n- [ ] Statisch gebundene Go-Abhaengigkeiten von Caddy, age und restic separat abgleichen.\n- [ ] Optionales ClamAV ist nicht geliefert und braucht bei Lieferung ein eigenes Dossier.\n- [ ] Verantwortliche Person, Entscheid, Datum und konkrete Lieferfassung dokumentieren.\n\n[A] Automatisch gesammelt werden vorhandene Lizenzdateien im ausgelieferten Dateisystem; fehlende Upstream-Texte sind damit nicht automatisch ergaenzt. Keine juristische oder menschliche Lieferfreigabe.\n');
console.log(JSON.stringify(ergebnisse.map(e=>({dienst:e.dienst,pakete:e.pakete,ungeklaert:e.lizenzUngeklaert.length}))));
