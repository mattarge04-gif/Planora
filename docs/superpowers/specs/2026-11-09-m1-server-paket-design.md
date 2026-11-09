# M1 – Server-Paket, lokaler Login, Feature-Schalter (Spec, Entwurf)

Stand: 2026-11-09 · Branch `welle-4-b2b` · Status: **Entwurf, PO-Freigabe ausstehend**
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
| `backup` | Host-Timer bzw. eigener Container mit `pg_dump` + restic | 1 | laeuft unabhaengig von App-Queue |
| `gotenberg` | Office → PDF | 2 (M4) | Lizenz-Dossier inkl. LibreOffice/Chromium |
| `ocr` | OCRmyPDF | 2 (M4) | Ghostscript-Frage [?] §10 |

Zielplattform [A, im Spike messen]: Ubuntu 24.04 LTS oder Debian 12, x86-64, 4 vCPU, 8 GB RAM, 100 GB Disk (Stufe 1–2), Docker Engine und Compose in exakt freigegebener Version. Volumes: `pgdata`, `dokumente`, `caddy-data`, `backup-staging`. Secrets nur in `/etc/planora/<instanz>/` auf dem Host (Rechte 600), nie im Paket.

**Versionsmanifest** (`release.json`, signiert): Release-Version, je Image Digest und Image-ID, Architektur, Schema-Version, pg-boss-Schema, Job-Payload-Versionen, Modulmanifest-Version, Katalog-/Regelwerk-Version, Mindestvorgaenger, Migrations-Pruefsummen. Keine `latest`-Tags.

## 4. Modulvertrag (schliesst Befund 4)

**Lieferstufe ≠ Aktivierung.** Die Lieferstufe sagt, ab welchem Release ein Modul im Code existiert; die Aktivierung sagt, ob es in einer Instanz laeuft.

```ts
// Modulmanifest (im Code, versioniert)
type Modul = {
  id: string;                 // stabil, z.B. "lebensdauer"
  art: "kern" | "option";     // kern = immer an, nicht schaltbar
  lieferstufe: 1 | 2 | 3 | 4;
  braucht: string[];          // harte Abhaengigkeiten (muessen aktiv sein)
  nutztWennAktiv: string[];   // weiche Abhaengigkeiten (Feature erscheint nur, wenn aktiv)
  routen: string[];           // Prefixe, an denen der Guard greift
  jobs: string[];             // Job-Typen, an denen der Guard greift
  extern: ("claude")[];       // externe Ziele, an denen der Dispatch-Guard greift
  default: boolean;           // nur fuer art=option
};
```

| Modul | Art | Stufe | braucht | nutztWennAktiv | Hinweis |
|---|---|---|---|---|---|
| plattform, identitaet, instanz, katalog, struktur, dokumente, bestand | kern | 1 | – | – | |
| erfassung (Formular/Excel) | kern | 1 | struktur, bestand, katalog | – | aus `interview` herausgeloest |
| szene | kern | 1 | struktur, bestand | **lebensdauer** | Ampelfarben nur, wenn `lebensdauer` aktiv – loest szene→erneuerung |
| lebensdauer (bisher `erneuerung`, ohne Geld) | option | 2 | bestand, katalog | zustand | Default an ab Stufe 2 |
| zustand | option | 2 | bestand | – | Default aus bis ZHAW-Scope geklaert [?] |
| hinweise | option | 2 | lebensdauer | – | |
| export | kern | 2 | bestand | lebensdauer | |
| suche | option | 3 | dokumente | – | |
| ki | option | 4 | – | – | `extern: ["claude"]` |
| interview_agent | option | 4 | erfassung, **ki** | – | |
| extraktion | option | 4 | dokumente, bestand, **ki** | – | |

**Erlaubte Kombinationen:** Gueltig ist jede Menge, die alle `braucht`-Abhaengigkeiten erfuellt. Getestet werden die Stufenprofile S1 (nur Kern), S2 (+lebensdauer, export, hinweise), S3 (+suche), S4 (+ki, interview_agent, extraktion) sowie "S4 ohne ki" [A].

**Guard:** `modulAktiv(id)` liest **ohne Prozess-Cache** aus `modul_schalter` (eine indizierte Zeile pro Pruefung; Messung im Spike) [A]. Geprueft an: HTTP-Route (vor Rechtepruefung → 404), Job-Start (→ Status `pausiert_modul`, bleibt sichtbar, kein Retry-Loop), Dispatch zu externem Ziel (§4.1). Schalten: nur Rolle `betreiber` (Planora), auditiert; Abschalten mit aktivem abhaengigem Modul wird abgelehnt. Unbekannte Module in `modul_schalter` (nach Downgrade) bleiben aus.

### 4.1 Dispatch-Sperre externe Aufrufe (schliesst Befund 5, Rahmen fuer Stufe 4)

- Jeder externe Aufruf geht durch `ExternDispatch.senden(ziel, auftrag)`. Diese Funktion prueft **unmittelbar vor dem Netzwerkaufruf** in derselben DB-Verbindung `modulAktiv(...)`, Wartungsmodus und Budget; nur dann wird der Aufruf mit `AbortController` gestartet und in `extern_aufruf` mit Status `laufend` protokolliert.
- **Abschalten** setzt den Schalter und bricht alle `laufend`-Aufrufe ueber ihren `AbortController` ab (Signal per `LISTEN/NOTIFY` an Worker). Ergebnisse, die nach dem Abschaltzeitpunkt eintreffen, werden als `verworfen_modul_aus` gespeichert und nicht uebernommen.
- **Wartende Jobs** gehen auf `pausiert_modul`; **Teilresultate** bleiben als Entwurf, nichts wird bestaetigt. **Reaktivierung** setzt pausierte Jobs fort; jeder Fortsetzungsschritt prueft Rechte und Modul erneut.
- Nachweis: Race-Test "Abschalten waehrend 20 paralleler Aufrufe" gegen Fake-Provider → 0 neue Requests nach Abschalt-Commit, alle laufenden abgebrochen oder verworfen.

## 5. Login und Rechte (schliesst Befund 8)

- **Better Auth 1.7.x** (MIT, Fastify- und Drizzle-Adapter) [F, 09 §1], exakter Pin im Scaffold. **DB-Sessions ohne Cookie-Cache**; Passwort-Hash **Argon2id** ueber `@node-rs/argon2`, Parameter mindestens nach OWASP (19 MiB, 2 Iterationen, p=1) [F, 09 §1], auf Zielhardware gemessen.
- Cookie `HttpOnly; Secure; SameSite=Lax`; Rotation nach Login und Rechteaenderung; Leerlauf 30 min, absolut 12 h [A]. Schreibende Routen: Origin-Allowlist + Header `X-Planora-Request`; `disableCSRFCheck` bleibt aus.
- **Jede geschuetzte Anfrage** prueft DB-Session, Kontosperre und aktuelle Rolle/Scope. Rollenwechsel, Sperre, Passwortwechsel → alle Sessions des Kontos in derselben Transaktion loeschen.
- **Downloads und Viewer-Dateien** nur ueber eine Route, die bei **jedem Abruf** autorisiert; keine langlebigen signierten URLs. Wo ein Link noetig ist (z.B. PDF.js-Range-Requests): Token max. 5 min, an Session gebunden [A].
- **Erstadmin:** `planora setup` auf der Host-Konsole erzeugt Einmal-Token (15 min); kein Standardpasswort. **Recovery:** mit SMTP Reset-Link; ohne SMTP Reset durch Admin (Einmal-Link, 30 min, persoenlich uebergeben); letzter Admin ueber Host-Konsole. Alle Token gehasht gespeichert, nie geloggt.
- Rollen: `betreiber` (Planora: Module, Updates; keine Fachdaten-Bearbeitung [A]), `admin` (Benutzer, Rollen, Scope), `bearbeiter`, `leser`; Scope je Liegenschaft. MFA: TOTP-Plugin eingebaut, pro Konto optional [A, PO 2].

## 6. Speicher-Port

- Port `Ablage` mit `schreibeNeu(stream) → {schluessel, sha256, groesse}`, `lese(schluessel)`, `halte(backupId, schluessel[])`, `loescheVorgemerkt()`. Adapter M1: **Dateisystem** auf Volume `dokumente`, inhaltsadressiert (`sha256/aa/bb/...`), Dateien nach dem Schreiben **unveraenderlich** (Rechte 0440).
- Loeschen = Eintrag in `loesch_journal` + Vormerkung; physisch erst, wenn kein Backup-Hold und Aufbewahrungsfrist abgelaufen.
- Upload-Protokoll (Uppy/tus, K01) ist M5; M1 liefert nur Port, Adapter, Pfad-/Symlink-Schutz und Disk-Fuellstands-Pruefung.

## 7. Backup und Restore (schliesst Befund 6)

Ablauf nach `09-recherche-m1.md` §3 Konsistenzprotokoll, konkret:
1. Backup-Lock (Advisory-Lock + Flag `wartung.backup`): neue Upload-Abschluesse, Loeschungen und GC gesperrt; Lesen und normales Arbeiten laufen weiter [A, kurze Sperre].
2. `pg_dump -Fc` + `pg_dumpall --roles-only`; unter derselben Sperre **Manifest** aus der DB: alle referenzierten Dateischluessel mit SHA-256. Dateien im Manifest erhalten einen Hold.
3. Sperre loesen. restic sichert Dump, Rollen, Manifest, Konfiguration (ohne Secrets im Klartext) und die Manifest-Dateien ins verschluesselte Ziel.
4. `restic check` (Stichprobe taeglich, voll woechentlich [A]); erst danach Sicherungssatz `vollstaendig`, Holds loesen, Healthcheck melden. Fehler → Alarm, kein gueltiger Sicherungspunkt.
5. **Loesch-/Sperrjournal** zusaetzlich bei jeder Aenderung sofort als append-only Eintrag ins Backup-Ziel (eigener restic-Pfad) [A]; Restore spielt es nach dem Dump nach, damit spaetere Loeschungen/Kontosperren nicht zurueckkommen.
6. **Restore** (`planora restore <backup-id>`): auf frischer VM; prueft Instanz-ID, Manifest, Hashes, Versionen, Schluessel; fehlend → Abbruch. Danach: alle Sessions und Token geloescht, Worker und Modul `ki` gesperrt bis Admin-Freigabe, Journal nachgezogen.
Ziel-RPO 24 h, RTO 1 Arbeitstag [A, PO 4]; keine PITR-Zusage.

## 8. Update (schliesst Befund 7)

`planora update <bundle>` in dieser Reihenfolge, Abbruch bei jedem Fehler vor Schritt 4 ohne Aenderung:
1. Vorpruefung: Signatur, Architektur, Mindestvorgaenger, freier Platz, gueltiger Sicherungspunkt < 24 h.
2. Wartungsmodus: Proxy zeigt Wartungsseite fuer Schreibzugriffe; `offWork(..., {wait:true})` fuer alle Queues, dann `stop({graceful:true})`; Quieszenz pruefen (keine aktiven Handler, keine Schreibverbindungen ausser Migrator). Nicht nachweisbar → Abbruch.
3. Backup nach §7.
4. `docker load` + Image-ID-Abgleich gegen Manifest; `migrator` (Advisory-Lock, Journal, Pruefsummen).
5. Neue `api` starten, Smoke-Checks (Health, Login, Session-Entzug, Modulmanifest, Datei lesen); dann `worker`, Wartungsmodus aus.
**Schemaregel:** Expand → Backfill → Contract; Contract erst, wenn der Mindestvorgaenger im Manifest die alte Spalte nicht mehr nutzt. Jobs tragen `payloadVersion`; Worker verarbeiten N und N-1, unbekannte → `geparkt_version` (sichtbar, kein Retry). **Rueckweg:** altes Image nur bei schemakompatiblem Release, sonst Restore §7.

## 9. Installation

`planora install` (Shell-Skript im Bundle): prueft Plattform und Ressourcen, legt Secrets an, laedt Images offline, startet `db` → `migrator` → `api`/`worker` → `proxy`, druckt Setup-Token. Abnahme: Installation auf frischer VM in < 60 min nach Anleitung, ohne Internet ausser genehmigtem Betriebsverkehr [A].

## 10. Audit und Lizenzen (schliesst Befunde 9 und 10)

- **Audit:** jedes Konto erhaelt bei Anlage eine zufaellige `audit_id`; Audit-Eintraege speichern nur `audit_id`. Zuordnung `audit_id ↔ benutzer` in eigener Tabelle, loeschbar (Pseudonymisierung ohne Umschreiben gehashter Eintraege). Erfasst: Login/Fehlversuch/Sperre, Rollen-, Modul-, Update-, Backup-, Restore-Ereignisse, Betreiberzugriffe.
- **Lizenz-Dossier** je Release: SBOM (Syft) je Image-Digest, Lizenztexte/NOTICE, Source-Archive fuer GPLv2 (ClamAV), MPL (OCRmyPDF), LibreOffice/Chromium-Teile (Gotenberg). Allowlist in ADR 0024 um PostgreSQL License, GPLv2-Ausnahme ClamAV, MPL-2.0 ergaenzen.
- [?] **Ghostscript (AGPL)** im OCR-Image: OCR-Image ohne Ghostscript bauen, falls moeglich [A]; sonst juristische Klaerung vor Stufe 2.

## 11. Abnahmekriterien M1

| # | Nachweis |
|---|---|
| A1 | Installation auf frischer VM nach Anleitung, Setup-Token, Erstadmin, Login |
| A2 | Zweite Instanz auf derselben Testmaschine: keine geteilten Volumes/Netze/Secrets, Backup-Ziel verschieden |
| A3 | Login-Tests: Rate-Limit, Argon2id-Hash, Session-Fixation, Entzug bei Rollenwechsel sofort wirksam, CSRF/Origin |
| A4 | Modul-Guard: Route 404 trotz direktem Aufruf, Job `pausiert_modul`, Abhaengigkeit verhindert Abschalten, Audit-Eintrag |
| A5 | Dispatch-Race (§4.1) gegen Fake-Provider: 0 Requests nach Abschalten |
| A6 | Backup + Restore auf frischer VM, Hash-Vollpruefung, Sessions ungueltig, Loeschjournal nachgezogen |
| A7 | Update N-1 → N mit Beispieldaten, inkl. Abbruch mitten im Migrator und Wiederanlauf; Rueckweg geuebt |
| A8 | Lizenz-Dossier fuer alle Stufe-1-Images erzeugt |

## 12. Aufgaben und Schaetzung

| # | Aufgabe | PT [A] |
|---|---|---|
| 1 | Scaffold (Monorepo, Fastify, Drizzle, pg-boss, Vite), CI mit Tests | 1.5 |
| 2 | Compose-Paket, Manifest, Install-Skript, Caddy | 1.5 |
| 3 | Login, Rollen, Scope, Recovery, Setup-Token (Better Auth) | 2 |
| 4 | Modulmanifest, Guard, Schalter-UI fuer Betreiber, Dispatch-Rahmen | 1.5 |
| 5 | Speicher-Port + Dateisystem-Adapter, Loeschjournal | 1 |
| 6 | Backup/Restore inkl. Manifest, Holds, Journal | 2 |
| 7 | Update mit Drain, Offline-Bundle | 1.5 |
| 8 | Audit mit pseudonymer ID, Lizenz-Dossier-Skript | 1 |
| | **Total M1** | **≈ 12 PT** (Plan V2: 7 PT) |

**Auswirkung auf den Plan [A]:** +5 PT → alle Stufen ≈ 1 Woche spaeter (Stufe 2 ≈ W13). Zusammen mit der Analysten-Kritik an M3/M5/M6/M11 realistisch **Stufe 2 ≈ W14** – PO-Entscheid, ob Plan V2 angepasst wird.

## 13. Offene Punkte [?]

PO-Entscheide 1–7 (§2, vorlaeufig angenommen) · ZHAW-Scope `zustand` (PO 8) · Ghostscript (§10) · Mindestversionen Docker/Compose · Verantwortliche fuer Lizenzfreigabe und Schluesselverwahrung.
