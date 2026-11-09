# M1 – Server-Paket, lokaler Login, Feature-Schalter (Spec, Entwurf)

Stand: 2026-11-09 · Branch `welle-4-b2b` · Status: **Entwurf V2 (nach Pruefpunkt 3), PO-Freigabe ausstehend**
Kennzeichnung: [F] Fakt mit Quelle · [A] Annahme/Vorschlag · [?] PO-Entscheid offen.
Grundlage: E34–E37 (`docs/architektur/00-kontext.md`), ADR 0027–0031, `07-analyse-b2b.md`, `08-pruefung.md` (Pruefpunkt 2, Befunde 4–10, PO-Entscheide 1–12), `09-recherche-m1.md` (alle Versions-/Lizenzangaben dort mit Quelle, Abruf 2026-11-09).

## 1. Ziel und Umfang

M1 liefert das **Fundament jeder Kundeninstanz**: ein installierbares, aktualisierbares und wiederherstellbares Compose-Paket mit lokalem Login, Rollen, Feature-Schaltern und Audit. Fachfunktionen (3D, Viewer, Upload, Erfassung) kommen in M2–M6 und bauen darauf auf.

**Im Umfang:** Paketstruktur und Versionsmanifest · Installation auf sauberer VM · lokaler Login mit Rollen und Liegenschafts-Scope · Modulmanifest und Schalter · Dispatch-Sperre fuer externe Aufrufe (Rahmen, KI selbst erst M9/M10) · Speicher-Port mit Dateisystem-Adapter (ohne Upload-UI; K01-Ablauf ist M5) · Backup/Restore · Update mit Drain · Audit mit pseudonymer ID · Lizenz-Dossier-Geruest.
**Nicht im Umfang:** Fachmodule, Upload-Oberflaeche, SSO, MFA-Pflicht, PITR, HA, mehrere Sprachen.

## 2. Vorlaeufige Annahmen fuer offene PO-Entscheide

Ohne PO-Antwort gelten die Empfehlungen aus `08-pruefung.md` als **[A]**. Jede Zeile kann der PO aendern; die Spec nennt die betroffene Stelle.

| PO-Nr. | Annahme fuer M1 [A] | Betrifft |
|---|---|---|
| 1 Zielbetrieb | Erstinstallation auf **CH-VM bei uns**; On-Premise mit demselben Paket wird nur als Offline-Installation getestet. Produktivdaten erst nach Siemens-IT-Freigabe. | §3, §9 |
| 2 Login/Rechte | Lokaler Login ok; **MFA (TOTP) optional, nicht Pflicht**; Rollen Admin/Bearbeiter/Leser + Liegenschafts-Scope. | §5 |
| 3 Speicher/Lizenzen | **Dateisystem-Volume**, kein S3-Server; Lizenz-Owner = Matt, juristische Pruefung vor erster Lieferung. | §6, §10 |
| 4 Backup/SLA | Naechtlich + vor Update; Ziel = CH-S3 eines Drittanbieters, clientseitig verschluesselt; **RPO 24 h / RTO 1 Arbeitstag**; Schluessel bei Planora + versiegelte Kopie beim Chef. | §7 |
| 5 Updates | Planora installiert Updates im Wartungsfenster nach Absprache; technisch geprueft wird N-1 → N. | §8 |
| 6 Netz | "Nur Claude" gilt fuer **fachliche** APIs. Betriebsverkehr erlaubt, aber abschaltbar: ClamAV-Signaturen, ACME, Backup-Ziel, optional SMTP. Offline-Variante: Signaturen/Images per Bundle. | §3, §6 |
| 7 Modulverkauf | Freischaltung nur durch Planora-Betreiberrolle; vertraglich, kein Lizenzserver. Abschalten erhaelt Daten. | §4 |

## 3. Paket und Zielplattform

| Container | Rolle | Ab Stufe | Bemerkung |
|---|---|---|---|
| `proxy` | Caddy, statische Konfiguration, einziger veroeffentlichter Port 443 (+80 fuer ACME) | 1 | kein Docker-Socket; CH: ACME; On-Prem: Kunden-CA oder `tls internal` mit Root-Verteilung [A] |
| `api` | Fastify-BFF + statisches Frontend | 1 | Better Auth eingebunden |
| `worker` | pg-boss-Handler | 1 | gleiche Codebasis/Image wie `api`, anderer Startbefehl |
| `migrator` | einmaliger Lauf mit Advisory-Lock | 1 | einzige Rolle mit DDL |
| `db` | PostgreSQL 18.x, Digest gepinnt | 1 | eigene Instanz-DB (ADR 0031) |
| `clamav` | Virenscan | 1 | GPLv2 → Dossier §10 |
| `backup` | eigener Container mit `pg_dump` + restic + Journal-Outbox, ausgeloest per Host-Timer | 1 | laeuft unabhaengig von App-Queue |
| `gotenberg` | Office → PDF | 2 (M4) | Lizenz-Dossier inkl. LibreOffice/Chromium |
| `ocr` | OCRmyPDF | 2 (M4) | Ghostscript-Frage [?] §10 |

Zielplattform [A, im Spike messen]: Ubuntu 24.04 LTS oder Debian 12, x86-64, 4 vCPU, 8 GB RAM, 100 GB Disk (Stufe 1–2), Docker Engine und Compose in exakt freigegebener Version. Volumes: `pgdata`, `dokumente`, `caddy-data`, `backup-staging`. Secrets nur in `/etc/planora/<instanz>/` auf dem Host (Rechte 600), nie im Paket.

**Versionsmanifest** (`release.json`, signiert): Release-Version, je Image Digest und Image-ID, Architektur, Schema-Version, pg-boss-Schema, Job-Payload-Versionen, Modulmanifest-Version, Katalog-/Regelwerk-Version, Mindestvorgaenger, Migrations-Pruefsummen. Keine `latest`-Tags.

## 4. Modulvertrag (Befund 4, PP3-1)

**Begriffe:** *geliefert* = Modul ist im installierten Release enthalten (Release-Stufe ≥ Lieferstufe). *aktiv* = in dieser Instanz eingeschaltet. **Kernmodule** sind aktiv, sobald geliefert, und nicht schaltbar. **Optionen** sind nach Installation immer **aus** (ADR 0029); welche Optionen eingeschaltet werden, bestimmt das **Installationsprofil** des Kundenvertrags, ausgefuehrt vom Betreiber und auditiert.

```ts
// Modulmanifest (im Code, versioniert, Teil von release.json)
type Modul = {
  id: string;                 // stabil, z.B. "lebensdauer"
  art: "kern" | "option";
  lieferstufe: 1 | 2 | 3 | 4;
  braucht: string[];          // harte Abhaengigkeiten: muessen aktiv sein
  nutztWennAktiv: string[];   // weiche: Teilfunktion erscheint nur, wenn aktiv
  routen: string[];           // API-Prefixe, an denen der Guard greift
  jobs: string[];             // Job-Typen, an denen der Guard greift
  extern: ("claude")[];       // externe Ziele, an denen der Dispatch-Guard greift
};
```

| Modul | Art | Stufe | braucht | nutztWennAktiv | Routen / Jobs [A] |
|---|---|---|---|---|---|
| plattform, identitaet, instanz, katalog, struktur, dokumente, bestand | kern | 1 | – | – | `/api/auth/*`, `/api/admin/*`, `/api/struktur/*`, `/api/dokumente/*`, `/api/bestand/*` |
| erfassung (Formular/Excel) | kern | 1 | struktur, bestand, katalog | – | `/api/erfassung/*`; Job `erfassung.excel-import` |
| szene | kern | 1 | struktur, bestand | lebensdauer | `/api/szene/*` (Ampelfarben nur wenn `lebensdauer` aktiv) |
| export | kern | 2 | bestand | lebensdauer | `/api/export/*`; Job `export.excel` |
| lebensdauer (ohne Geld, E24) | option | 2 | bestand, katalog | zustand | `/api/lebensdauer/*`; Job `lebensdauer.neuberechnen` |
| zustand | option | 2 | bestand | – | `/api/zustand/*` (bis ZHAW-Scope geklaert nicht im Profil, [?] PO 8) |
| hinweise | option | 2 | lebensdauer | – | `/api/hinweise/*`; Job `hinweise.taeglich` |
| suche | option | 3 | dokumente | – | `/api/suche/*`; Job `suche.indexieren` |
| ki | option | 4 | – | – | – (nur Dispatch-Ziel `claude`) |
| interview_agent | option | 4 | erfassung, ki | – | `/api/interview/*`; Job `interview.antwort` |
| extraktion | option | 4 | dokumente, bestand, ki | – | `/api/extraktion/*`; Job `extraktion.lauf` |

**Installationsprofile** (getestet): P1 = Kern Stufe 1 · P2 = P1 + export + lebensdauer + hinweise · P3 = P2 + suche · P4 = P3 + ki + interview_agent + extraktion · P4-ohne-KI = P3 (ki, interview_agent, extraktion aus). Optionen, die nicht im Profil stehen, bleiben aus.

**Schalten:** nur Rolle `betreiber`, auditiert. Einschalten verlangt aktive `braucht`-Module. **Abschalten mit Kaskade:** Der Betreiber sieht die abhaengigen aktiven Module und bestaetigt; alle werden in **einer** Transaktion abgeschaltet (z.B. `ki` → auch `interview_agent`, `extraktion`). Abschalten von `ki` folgt zusaetzlich §4.1.

**Guard:** `modulAktiv(id)` = indizierter Read auf `modul_schalter` pro Anfrage/Jobstart, **kein Prozess-Cache**; DB-Fehler → geschlossen (503). Nicht gelieferte Module → 404. HTTP: vor Rechtepruefung → 404. Job-Start und jede Fortsetzung: Modul aktiv **und** aktuelle Rechte des Ausloesers, sonst `pausiert_modul` bzw. `abgelehnt_recht` (sichtbar, kein Retry-Loop). Gemessener Zuschlag p95 ≤ 1.1 ms bei 2000 Anfragen/20 parallel (lokal) [F, Spike S13 T2]; auf Zielhardware wiederholen.

### 4.1 Dispatch-Sperre externe Aufrufe (Befund 5, PP3-2)

Korrektheit beruht auf einer **Zeilensperre**, nicht auf NOTIFY:
1. Jeder externe Aufruf laeuft in `ExternDispatch.senden(ziel, auftrag)` innerhalb **einer** DB-Transaktion: `SELECT aktiv FROM modul_schalter WHERE modul_id='ki' FOR SHARE` (+ Wartungsflag, Budget-Reservierung). Ist das Modul aus → Abbruch ohne Request.
2. Unmittelbar **vor dem fetch** und **vor dem Ergebnis-Commit** prueft der Aufruf zusaetzlich `abschaltung_angefordert` (Spike S13: ohne diese Pruefung entstehen bei totem Listener Requests/Ergebnisse zwischen (a) und (c)). Der Netzwerkaufruf wird **innerhalb dieser Transaktion** gestartet und abgewartet (Timeout ≤ 120 s [A]); das Ergebnis wird in derselben Transaktion als Entwurf gespeichert und erst dann committet. Die Share-Sperre bleibt ueber den ganzen Aufruf bestehen.
3. **Abschalten** = (a) Eintrag `abschaltung_angefordert(modul, zeit)` committen (eigene Transaktion), (b) laufende Aufrufe brechen ab: Signal per NOTIFY **und** Polling dieses Eintrags alle 1 s durch jeden laufenden Aufruf (NOTIFY nur fuer Tempo, nicht fuer Korrektheit), (c) `UPDATE modul_schalter SET aktiv=false` – wartet, bis alle Share-Sperren frei sind, und committet.
4. Garantie: Nach dem Commit von (c) haelt keine Transaktion mehr eine Share-Sperre, und jede neue sieht `aktiv=false` → **0 Requests nach Abschalt-Commit**, und kein Ergebnis wird danach uebernommen. Abgebrochene Aufrufe werden als `abgebrochen_modul_aus` protokolliert (eigene kurze Transaktion).
Gemessen [F, Spike S13 T3, 6 Varianten × 50 Laeufe]: 0 Requests und 0 Ergebnisse nach Abschalt-Commit; Dauer bis Commit p50 2 ms mit Listener, bis 0.83 s ohne. Das fruehere NOTIFY-Design (V1) verletzte die Garantie (bis 10 Verstoesse bei 20 parallelen Aufrufen).
5. Parallelitaet begrenzt: max. 5 gleichzeitige externe Aufrufe pro Instanz [A] (je eine DB-Verbindung). Listener-Ausfall verlangsamt nur das Abschalten (Polling), verletzt die Garantie nicht.
6. Wartende Jobs → `pausiert_modul`; Entwuerfe bleiben unbestaetigt; Reaktivierung setzt fort mit erneuter Modul- und Rechtepruefung.

## 5. Login und Rechte (Befunde 8, PP3-7/8/9)

**Auth-Konfigurationsvertrag** (Better Auth 1.7.x, exakter Pin im Scaffold; jede Zeile im Spike S13/T1 bzw. Scaffold-Test nachzuweisen) [A, Quellen 09 §1]:
- `emailAndPassword: { enabled: true, disableSignUp: true, password: { hash, verify } /* Argon2id via @node-rs/argon2, OWASP-Minimum 19 MiB/2/1 */, revokeSessionsOnPasswordReset: true, sendResetPassword: <Hook> }`
- Drizzle-Adapter mit `transaction: true`; DB-Sessions, **kein Cookie-Cache**. Widerruf per DB wirkt bei der naechsten Anfrage (401) [F, Spike S13 T1].
- `changePassword` immer mit `revokeOtherSessions: true` (sonst kein Widerruf) [F, Spike S13 T1].
- **Achtung Tests:** Better Auth schaltet die Origin-Pruefung unter `NODE_ENV=test` standardmaessig ab; Testkonfiguration setzt `disableOriginCheck: false` explizit [F, Spike S13 T1].
- Session: **absolut 12 h** ueber `expiresIn` ohne Verlaengerung (`updateAge` ≥ `expiresIn`, im Spike zu bestaetigen); **Leerlauf 30 min** ueber eigene Spalte `zuletzt_aktiv` im Planora-Hook, Pruefung bei jeder Anfrage.
- Rate-Limit: Speicher DB; Login 10 Fehlversuche / 15 min pro Konto und IP → Sperre 15 min [A]; Reset-Anfragen 3 / h.
- Origin-Allowlist + Header `X-Planora-Request` fuer alle schreibenden Routen; `disableCSRFCheck`/`disableOriginCheck` aus.
- Session-Entzug in derselben Transaktion bei: Kontosperre, Rollen-/Scope-Aenderung, Passwortwechsel, Passwort-Reset, Admin-Abmeldung. Jede geschuetzte Anfrage prueft DB-Session, Sperre, Leerlauf und aktuelle Rolle.
- **Erstadmin:** `planora setup` auf der Host-Konsole → Einmal-Token 15 min. **Recovery:** mit Kunden-SMTP Reset-Link (30 min); ohne SMTP erzeugt ein Admin einen Einmal-Link (30 min, persoenliche Uebergabe); letzter Admin: Host-Konsole. Token nur gehasht gespeichert, nie geloggt. Offline-Recovery ist Testfall in A3.
- MFA: TOTP-Plugin eingebaut, pro Konto optional [A, PO 2].

**Downloads und Viewer:** eine gleich-urspruengliche Route `GET /api/dokumente/:id/datei` mit Range-Unterstuetzung, autorisiert **jede** Anfrage (auch jede Range) per Session-Cookie; **keine Tokens, keine signierten URLs** (PP3-9).

**Rechtematrix** [A, PO 2]:

| Aktion | betreiber | admin | bearbeiter | leser |
|---|---|---|---|---|
| Module schalten, Update, Backup ausloesen | ja | nein | nein | nein |
| Benutzer, Rollen, Liegenschafts-Scope verwalten | nein | ja | nein | nein |
| Fachdaten lesen (im Scope) | nein [A] | ja | ja | ja |
| Fachdaten aendern, Dokumente hochladen/verknuepfen (im Scope) | nein | ja | ja | nein |
| Dokument loeschen (vorgemerkt, §6) | nein | ja | nein | nein |
| Audit lesen | nur Betriebsereignisse | ja | nein | nein |

Scope: jede Fachaktion prueft die Liegenschaft des Zielobjekts gegen `rolle_liegenschaft` (Admin: alle). Negative Tests (fremde Liegenschaft, Betreiber auf Fachdaten, Leser schreibt) sind Teil von A4.

**DB-Rollen und GRANTs** (ADR 0031): `planora_owner` besitzt das Schema, kein Login im Betrieb · `planora_migrator` DDL, nur im Migrator-Container · `planora_app` (api und worker) SELECT/INSERT/UPDATE/DELETE auf Fachtabellen, auf `audit_eintrag` **nur INSERT ueber Funktion**, kein UPDATE/DELETE, kein DDL · `planora_backup` mit `pg_read_all_data`, kein Schreiben. Test: Audit-Manipulation durch `planora_app` schlaegt fehl (A4).

## 6. Speicher-Port

- Port `Ablage`: `schreibeNeu(stream) → {schluessel, sha256, groesse}`, `lese(schluessel, range?)`, `existiert(schluessel)`, `entferne(schluessel)` (nur GC). Adapter M1: **Dateisystem**, inhaltsadressiert (`sha256/aa/bb/...`), nach dem Schreiben **unveraenderlich** (0440). Pfad-/Symlink-Schutz, Disk-Fuellstand ≥ 90 % → Schreibstopp.
- **Loeschen** = DB-Vormerkung + Journal (§7.3). **GC** entfernt Dateien nur, wenn (a) keine Referenz mehr, (b) Vormerkung aelter als Aufbewahrungsfrist (30 Tage [A]), (c) Journal-Eintrag quittiert und (d) **kein Backup im Zustand `laufend`** (§7.1).
- Upload-Protokoll (Uppy/tus, K01) ist M5.

## 7. Backup und Restore (Befunde 6, PP3-3/4/5)

### 7.1 Konsistenter Sicherungssatz ohne Schreibstopp
1. Zeile `backup_lauf(id, zustand='laufend', start)` committen → GC pausiert (§6 d).
2. Transaktion `REPEATABLE READ`: `pg_export_snapshot()`; in **diesem Snapshot** das Manifest erzeugen (alle referenzierten Dateischluessel + SHA-256 + Groesse, Schema-/Release-/Modulversion); parallel `pg_dump -Fc --snapshot=<id>` (Rolle `planora_backup`) [F: Option `--snapshot` laut pg_dump-Doku, Q2 in 08 Pruefpunkt 3]. Dump und Manifest zeigen damit **denselben** Datenstand; parallele Schreibzugriffe stoeren nicht.
3. Da Dateien unveraenderlich sind und GC pausiert, existieren alle Manifest-Dateien bis zum Ende des Laufs.
4. restic sichert Dump, `pg_dumpall --roles-only`, Manifest, Konfiguration und die Manifest-Dateien, Tag = Backup-ID.
5. **Pruefung:** Snapshot-Inhalt (`restic ls`) vollstaendig gegen das Manifest abgleichen; `restic check --read-data-subset=5%` taeglich, voll monatlich [A]. Jeder restic-Exitcode ≠ 0 → `fehlgeschlagen` + Alarm.
6. Zustaende `laufend → gesichert → geprueft | fehlgeschlagen`. Reconcile beim Start und stuendlich: `laufend` aelter als 6 h → `fehlgeschlagen`, GC laeuft wieder (kein ewiger Hold).
7. Retention gemeinsam je Backup-ID: 14 taeglich, 8 woechentlich, 12 monatlich [A]; GC-Aufbewahrungsfrist ≥ Abstand zweier Backups.

### 7.2 Schluessel und Konfiguration
Restic-Passwort, Backup-Ziel-Credentials, App-Secrets und ggf. CA-Schluessel liegen als **Schluesselinventar** verschluesselt (age [A, Lizenz im Dossier pruefen], Empfaenger = Planora-Recovery-Key) im Backup-Ziel; der Recovery-Key liegt offline bei Planora + versiegelte Kopie [A, PO 4]. Ohne Inventar kein Restore.

### 7.3 Loesch-/Sperrjournal mit externer Quittung
- Kontosperren, Rollenentzuege und Loeschvormerkungen schreiben in derselben Transaktion eine Zeile `journal(seq, art, ziel, zeit, zustand='offen')` (Outbox, `seq` lueckenlos).
- Ein Outbox-Prozess schreibt jede Zeile **einzeln und idempotent** als Objekt `journal/<instanz>/<seq>.json` ins Backup-Ziel (S3-PUT) und setzt nach HTTP 200 `zustand='quittiert'`. Wiederholung bei Fehler, Alarm nach 15 min offen.
- **Wirkung:** Sperren/Entzuege wirken lokal **sofort** (Sicherheit); die Rueckmeldung an den Admin zeigt "Sicherung des Journals ausstehend", bis quittiert. Physisches Loeschen (GC) nur fuer quittierte Eintraege.
- **Restore:** Journal-Objekte ab `seq` des Sicherungssatzes lueckenlos lesen und nachspielen; Luecke oder unlesbares Objekt → Restore bleibt gesperrt bis zu einem manuellen, auditierten Entscheid.

### 7.4 Restore
`planora restore <backup-id>` auf frischer VM: Schluesselinventar entschluesseln → Manifest, Hashes, Release-Version pruefen → Dump einspielen → Journal nachspielen (§7.3) → alle Sessions/Token loeschen → Worker und Modul `ki` gesperrt bis Admin-Freigabe → Abnahme-Checkliste. Ziel RPO 24 h / RTO 1 Arbeitstag [A, PO 4]; keine PITR-Zusage.

## 8. Update (Befunde 7, PP3-6)

`planora update <bundle>` mit Zustandsdatei `/var/lib/planora/<instanz>/update.json` und **Exklusivlock** (Lock-Datei + DB-Advisory-Lock):

| Schritt | Aktion | Bei Fehler |
|---|---|---|
| 0 Vorpruefung | Signatur, Architektur, Kompatibilitaetsmatrix (§8.1), freier Platz, letzter Sicherungssatz `geprueft` < 24 h | Abbruch, nichts veraendert |
| 1 Wartung | Caddy schaltet auf statische Wartungsseite (alle Routen); Flag `wartung` in DB (sperrt Dispatch §4.1 und Job-Produzenten) | Flag zuruecksetzen, Caddy normal |
| 2 Stopp | `docker compose stop api worker` (Grace 60 s), danach Kill; pruefen: keine Verbindung der Rolle `planora_app` in `pg_stat_activity` | Container wieder starten, Schritt 1 rueckgaengig |
| 3 Backup | §7.1 (ohne parallele Schreiber) | wie Schritt 2 |
| 4 Laden | `docker load`, Image-IDs gegen Manifest | wie Schritt 2 |
| 5 Migration | genau ein `migrator` mit Advisory-Lock, Journal, Pruefsummen; nichttransaktionale Schritte einzeln protokolliert und wiederaufnehmbar | Zustand `migration_abgebrochen`: Wiederaufnahme oder Restore (§7.4) |
| 6 Start | neue `api`: Smoke-Checks (Health, Login, Session-Entzug, Modulmanifest, Datei lesen); dann `worker`; Wartung aus | Rueckweg §8.2 |

Ueberfaellige Handler sind mit Schritt 2 sicher beendet (Prozess existiert nicht mehr), unabhaengig vom Verhalten von pg-boss `offWork`/`stop` [F, Q4 in 08 Pruefpunkt 3].

### 8.1 Kompatibilitaetsmatrix (im Manifest)
`von_versionen` (unterstuetzte Ausgangs-Releases), Schema-Version vorher/nachher, pg-boss-Schema, Job-`payloadVersion` (Worker verarbeiten N und N-1; unbekannte → `geparkt_version`, sichtbar, kein Retry), Liste nichttransaktionaler Schritte. **Schemaregel:** Expand → Backfill → Contract; Contract erst, wenn kein Release in `von_versionen` die alte Struktur noch nutzt.

### 8.2 Rueckweg
Altes Image nur, wenn die Matrix das neue Schema als kompatibel fuer das alte Release ausweist; sonst Restore des Sicherungssatzes aus Schritt 3 (kein Datenverlust, da Schreiber gestoppt waren).

## 9. Installation

`planora install` (Shell-Skript im Bundle): prueft Plattform und Ressourcen, legt Secrets an, laedt Images offline (`--pull never`), startet `db` → `migrator` → `api`/`worker` → `proxy`, legt das Installationsprofil an (§4), druckt das Setup-Token. CH-VM: ACME; On-Premise: Kunden-Zertifikat oder `tls internal` mit Root-Export zur Verteilung.

## 10. Audit und Lizenzen (Befunde 9, 10, PP3-10)

- **Audit:** Konto erhaelt bei Anlage eine zufaellige `audit_id`; Eintraege speichern nur diese; Zuordnung `audit_id ↔ benutzer` loeschbar. Erfasst: Login/Fehlversuch/Sperre, Rollen-, Scope-, Modul-, Update-, Backup-, Restore-, Journal-Ereignisse, Betreiberzugriffe.
- **Lizenz-Dossier** je Release: exakte Image-Digests (Pflichtlieferobjekt), SBOM (Syft) inkl. OS- und npm-Pakete, Lizenztexte/NOTICE, Source-Archive/Buildskripte fuer GPLv2 (ClamAV), MPL (OCRmyPDF), LibreOffice-/Chromium-Teile (Gotenberg). Allowlist ADR 0024 um PostgreSQL License, GPLv2-Ausnahme ClamAV, MPL-2.0 ergaenzen.
- **Freigabe:** Das Dossier wird vom Lizenz-Owner (Matt [A], PO 3) geprueft und freigegeben, **bevor** ein Paket ausgeliefert wird. Ghostscript: Pruefung vor jedem Export eines OCR-Images (Ziel: OCR-Image ohne Ghostscript [A]).

## 11. Abnahmekriterien M1

| # | Nachweis |
|---|---|
| A1 | Installation auf frischer VM nach Anleitung, offline (`--pull never`), mit Kunden-CA **und** mit `tls internal`; Setup-Token, Erstadmin, Login |
| A2 | Zweite Instanz: keine geteilten Volumes/Netze/Secrets, anderes Backup-Ziel; Fehlkonfiguration (gleiches Backup-Ziel, gleicher Volume-Name) wird von `install` abgelehnt |
| A3 | Auth-Vertrag §5 Zeile fuer Zeile: Rate-Limit/Sperre, Argon2id-Parameter, Session-Fixation, absolut 12 h und Leerlauf 30 min, Entzug in allen fuenf Faellen sofort, Selbstregistrierung gesperrt, Reset mit und ohne SMTP, Rollback bei Fehler im Reset |
| A4 | Modul-Guard (404 trotz direktem Aufruf, Job `pausiert_modul`, Kaskade atomar, DB-Fehler → 503) und Rechtematrix negativ (fremde Liegenschaft, Betreiber auf Fachdaten, Leser schreibt, Audit-Manipulation durch `planora_app`) |
| A5 | Dispatch-Race §4.1 deterministisch: Abschalten waehrend 5 laufender Aufrufe, mit angehaltenem Aufruf direkt nach der DB-Pruefung und mit totem Listener → 0 Requests nach Abschalt-Commit, 0 uebernommene Ergebnisse |
| A6 | Backup mit parallelem Schreiben und Referenzwechsel → Restore auf frischer VM, Manifest vollstaendig; Crash waehrend Backup (Reconcile), fehlende Datei, fehlendes Schluesselinventar, Journal-Luecke → Restore gesperrt; Kontosperre nach dem Backup bleibt nach Restore wirksam |
| A7 | Update N-1 → N mit Daten; Abbruch in jedem Schritt 0–6 mit dokumentiertem Endzustand; haengender Job-Handler wird durch Schritt 2 beendet; Rueckweg altes Image und Restore geuebt |
| A8 | Lizenz-Dossier fuer alle Stufe-1-Images **vollstaendig und vom Owner freigegeben** |

## 12. Aufgaben und Schaetzung

| # | Aufgabe | PT [A] |
|---|---|---|
| 1 | Scaffold (Monorepo, Fastify, Drizzle, pg-boss, Vite), CI mit Tests, DB-Rollen/GRANTs | 1.5 |
| 2 | Compose-Paket, Manifest/Matrix, Install-Skript, Caddy (ACME und interne CA) | 2 |
| 3 | Auth-Vertrag §5, Rechtematrix, Recovery, Setup-Token | 2.5 |
| 4 | Modulmanifest, Guard, Profile, Kaskade, Dispatch-Rahmen §4.1 | 2 |
| 5 | Speicher-Port + Dateisystem-Adapter, GC | 1 |
| 6 | Backup/Restore §7 inkl. Snapshot-Manifest, Journal-Outbox, Schluesselinventar, Reconcile | 3 |
| 7 | Update §8 mit Zustandsmaschine und Rueckweg | 1.5 |
| 8 | Audit, Lizenz-Dossier-Skript, Abnahmelaeufe A1–A8 | 1.5 |
| | **Total M1** | **≈ 15 PT** (Plan V2: 7 PT; nach Spike S13 neu pruefen) |

**Planauswirkung [A]:** +8 PT gegenueber Plan V2. Rechnerische Untergrenze ohne Reserve (5 PT/Woche): Stufe 2 ≈ W13–W14, gesamt ≈ W20–W21. Neuplanung erst nach PO-Entscheid zu Umfang und Terminziel (PO 8); Plan V2 bleibt bis dahin unveraendert.

## 13. Freigabe-Gates und offene Punkte (PP3-11)

| Gate | Braucht PO-Entscheid |
|---|---|
| Spec-Freigabe (Start writing-plans) | PO 2 Rollen/Scope/MFA, PO 7 Modulfreischaltung – oder ausdrueckliche Bestaetigung der Annahmen §2 |
| Erste Installation beim Kunden | PO 1 Zielbetrieb/IT-Freigabe, PO 3 Lizenz-Owner + Dossier-Freigabe, PO 6 Netzausgaenge |
| Kundendaten (produktiv) | PO 4 Backup-Owner/Ziel/Schluessel/RPO-RTO, PO 5 Update-Owner/Wartungsfenster, Siemens-IT-Freigabe |
| Stufe 2 | PO 8 Abnahmeumfang/ZHAW, PO 9 Stratus |
| Stufe 3 | PO 10 Suche-Hardware/Modell, PO 11 E27 |
| Stufe 4 | PO 12 Claude-Datenfluss |

Weitere offene Punkte: Ghostscript (§10), Mindestversionen Docker/Compose, Eigentuemergrenzen innerhalb eines Kunden (PO 2).
