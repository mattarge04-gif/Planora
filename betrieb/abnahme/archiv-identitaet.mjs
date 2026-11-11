import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';

// Liest einzelne Mitglieder eines unkomprimierten Image-Archivs (docker save), ohne es zu entpacken.
export function tarMitglied(pfad, gesucht) {
  const fd = openSync(pfad,'r'), kopf = Buffer.alloc(512);
  try {
    for (let pos = 0; readSync(fd,kopf,0,512,pos) === 512 && kopf[0] !== 0;) {
      const name = kopf.toString('utf8',0,100).replace(/\0.*$/s,''), praefix = kopf.toString('utf8',345,500).replace(/\0.*$/s,'');
      const groesse = parseInt(kopf.toString('ascii',124,136).replace(/\0.*$/s,'').trim() || '0', 8);
      if ((praefix ? `${praefix}/${name}` : name) === gesucht && (kopf[156] === 0x30 || kopf[156] === 0)) {
        const daten = Buffer.alloc(groesse); readSync(fd,daten,0,groesse,pos+512); return daten;
      }
      pos += 512 + Math.ceil(groesse/512)*512;
    }
  } finally { closeSync(fd); }
  throw Error(`${pfad}: Mitglied ${gesucht} fehlt`);
}
// Signierte Image-ID == einziger Index-Eintrag des Archivs == inhaltsadressierter Blob im Archiv.
export function pruefeArchivIdentitaet(archiv, imageId) {
  const index = JSON.parse(tarMitglied(archiv,'index.json'));
  if (index.manifests?.length !== 1 || index.manifests[0].digest !== imageId) throw Error(`${archiv}: Index verweist nicht genau auf ${imageId}`);
  const hex = imageId.replace(/^sha256:/,''), blob = tarMitglied(archiv,`blobs/sha256/${hex}`);
  if (createHash('sha256').update(blob).digest('hex') !== hex) throw Error(`${archiv}: Blob ${imageId} inhaltlich falsch`);
  return {archivIndex: index.manifests[0].digest, blobGeprueft: true};
}
