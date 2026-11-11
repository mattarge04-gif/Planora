// Isolations- und Mountpruefung beider Abnahme-Instanzen; laeuft in der eigenen WSL-Distribution (linux.sh).
// Jede Instanz muss genau die erwarteten Dienste mit genau den erwarteten Mounts haben; danach duerfen sich
// Volumes, Netze und beschreibbare Bind-Quellen der beiden Instanzen nicht ueberschneiden.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const docker = (...a) => execFileSync('docker', a, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const bundle = '/opt/pb/bundle';
const LAUFEND = ['api', 'db', 'journal', 'proxy', 'worker'];
const EINMAL = ['migrator', 'proxy-init'];
const geheim = (n, unter, namen, alias = {}) => Object.fromEntries(namen.map(name => [`/run/secrets/${name}`, { typ: 'bind', quelle: `/etc/planora/pb-${n}/secrets/${unter}/${alias[name] ?? name}`, rw: false }]));
const vol = (n, name, rw = true) => ({ typ: 'volume', quelle: `planora-pb-${n}_${name}`, rw });
// Das Backup-Image erbt VOLUME /var/lib/postgresql; Docker legt dafuer je Container ein anonymes Volume an.
const ANONYM = 'anonym', anonym = name => /^[0-9a-f]{64}$/.test(name);

// Ziel -> erwartete Quelle; Anzahl und Ziele muessen exakt stimmen.
function erwartet(n) {
  return {
    db: { ...geheim(n, 'db', ['db_superuser_passwort', 'db_app_passwort', 'db_migrator_passwort', 'db_backup_passwort', 'db_betrieb_passwort']), '/var/lib/postgresql': vol(n, 'pgdata') },
    api: { ...geheim(n, 'app', ['db_app_passwort', 'auth_secret']), '/daten/dokumente': vol(n, 'dokumente') },
    worker: { ...geheim(n, 'app', ['db_app_passwort']), '/daten/dokumente': vol(n, 'dokumente') },
    proxy: {
      '/etc/caddy/Caddyfile': { typ: 'bind', quelle: `${bundle}/Caddyfile`, rw: false },
      '/srv/wartung/wartung.html': { typ: 'bind', quelle: `${bundle}/wartung.html`, rw: false },
      '/data': vol(n, 'caddy-data'),
    },
    journal: {
      '/dokumente': vol(n, 'dokumente', false),
      '/staging': vol(n, 'backup-staging'),
      '/ziel': { typ: 'bind', quelle: `/srv/pb-ziel-${n}`, rw: true },
      '/run/backup': { typ: 'bind', quelle: `/etc/planora/pb-${n}/backup`, rw: false },
      '/var/lib/postgresql': { typ: 'volume', quelle: ANONYM, rw: true },
    },
  };
}

function instanz(n) {
  const projekt = `planora-pb-${n}`;
  const ids = docker('ps', '-a', '-q', '--filter', `label=com.docker.compose.project=${projekt}`).split(/\s+/).filter(Boolean);
  assert(ids.length, `${projekt}: keine Container`);
  const container = JSON.parse(docker('inspect', ...ids));
  const dienst = c => c.Config.Labels['com.docker.compose.service'];
  const laufend = container.filter(c => c.State.Running);
  assert.deepEqual(laufend.map(dienst).sort(), LAUFEND, `${projekt}: laufende Dienste`);
  for (const c of container.filter(c => !c.State.Running)) {
    assert(EINMAL.includes(dienst(c)) && c.State.ExitCode === 0, `${projekt}: unerwarteter beendeter Container ${c.Name} (Exit ${c.State.ExitCode})`);
  }
  const soll = erwartet(n), ressourcen = { volumes: new Set(), netze: new Set(), rwBinds: new Set(), roBinds: new Set() };
  for (const c of laufend) {
    const d = dienst(c);
    const ist = Object.fromEntries(c.Mounts.map(m => [m.Destination, { typ: m.Type, quelle: m.Type === 'volume' ? (anonym(m.Name) ? ANONYM : m.Name) : m.Source, rw: m.RW }]));
    assert.equal(c.Mounts.length, Object.keys(ist).length, `${projekt}/${d}: doppelte Mount-Ziele`);
    assert.deepEqual(ist, soll[d], `${projekt}/${d}: Mounts weichen ab`);
    console.log(`${projekt}/${d}: ${c.Mounts.length} Mounts wie erwartet`);
    for (const m of c.Mounts) {
      if (m.Type === 'volume') ressourcen.volumes.add(m.Name);
      else (m.RW ? ressourcen.rwBinds : ressourcen.roBinds).add(m.Source);
    }
    for (const [name, netz] of Object.entries(c.NetworkSettings.Networks)) {
      assert(name.startsWith(`${projekt}_`), `${projekt}/${d}: fremdes Netz ${name}`);
      ressourcen.netze.add(netz.NetworkID);
    }
  }
  return ressourcen;
}

const a = instanz(1), b = instanz(2);
const schnitt = (x, y) => [...x].filter(v => y.has(v));
assert.deepEqual(schnitt(a.volumes, b.volumes), [], 'Gemeinsame Volumes');
assert.deepEqual(schnitt(a.netze, b.netze), [], 'Gemeinsame Netze');
assert.deepEqual(schnitt(a.rwBinds, b.rwBinds), [], 'Gemeinsame beschreibbare Bind-Quellen');
// Gemeinsam duerfen nur die read-only Dateien des signierten Bundles sein, keine Secrets oder Backup-Konfiguration.
assert.deepEqual(schnitt(a.roBinds, b.roBinds).sort(), [`${bundle}/Caddyfile`, `${bundle}/wartung.html`], 'Gemeinsame read-only Bind-Quellen');
// Alle Volumes des Daemons gehoeren genau einer der beiden Instanzen.
const alle = docker('volume', 'ls', '--format', '{{.Name}}').split(/\s+/).filter(Boolean);
// Anonyme Volumes nur, wenn sie an einem geprueften Container einer Instanz haengen.
for (const v of alle) assert(/^planora-pb-[12]_/.test(v) || a.volumes.has(v) || b.volumes.has(v), `Volume ausserhalb der Instanzen: ${v}`);
console.log(JSON.stringify({ volumes: [a.volumes.size, b.volumes.size], netze: [a.netze.size, b.netze.size], rwBinds: [a.rwBinds.size, b.rwBinds.size], anonymeVolumes: alle.filter(anonym).length, gemeinsamReadOnly: 2, daemonVolumes: alle.length }));
console.log('PASS: Dienste/Mount-Anzahl und -Ziele exakt; worker, journal und Backup-Ressourcen getrennt; keine gemeinsamen Volumes/Netze/beschreibbaren Binds');
