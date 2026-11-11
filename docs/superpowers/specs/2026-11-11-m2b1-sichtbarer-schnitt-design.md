# M2b-1 – Erster sichtbarer Schnitt: Frontend, Login, 3D-Uebersicht, Seitenpanel (Spec)

Stand: 2026-11-11 · Branch `m2b1-sichtbarer-schnitt` · Status: **Entwurf, Design im Gespraech abschnittsweise freigegeben; Freigabe der Spec ausstehend**
Kennzeichnung: [F] Fakt mit Quelle · [A] Annahme/Vorschlag · [?] offene Frage.
Grundlage: ADR 0004 (Vite-SPA + Fastify-BFF), ADR 0008 (3D R3F, InstancedMesh, Leistungsstufen), ADR 0032, E2 (Ton-Look, isometrisch), Spike S3b, M2a-Spec `2026-11-11-m2a-welt-kern-design.md`.

## 1. Ziel und Abgrenzung

M2b wird in Schritten geliefert (PO 2026-11-11: "zuerst sichtbarer Schnitt"). M2b-1 ist der erste:

**Login → Gebaeudeliste → 3D-Uebersicht → Klick auf Pin → Seitenpanel.**

Befund [F]: Es gibt noch kein Frontend (kein Vite-Projekt, keine Login-Seite; Caddy liefert nur die Wartungsseite). M2b-1 bringt das Frontend-Geruest mit.

**Im Umfang:** Vite/React-Projekt `web/`, Login, Gebaeudeliste, 3D-Uebersicht nach ADR 0008 (Glas-Geschosse, Einheiten-Linien, Pins), Seitenpanel, Gebaeudeliste- und Katalog-Endpunkt, einheitliches 400-Fehlerformat, Auslieferung ueber Fastify, Docker-Build, Lizenz-Dossier.
**Nicht im Umfang (spaetere M2b-Schritte bzw. M2c/M3/M7):** Geschossauswahl und Explosion, Tabellen-/2D-Weg, automatische Leistungsstufen, Tastaturbedienung im 3D, Bauteil-Modelle (GLB), Ampel, jede Erfassung/Bearbeitung im UI, Planora-Branding.

**Gestaltung (PO 2026-11-11):** schlicht, aber sauber. Neutrale Farben, eine Systemschrift, eigene einfache Komponenten ohne UI-Bibliothek. Das 3D folgt E2/ADR 0008.

**Erfolgskriterium:** Nach `npm run welt:beispiel` meldet sich ein Bearbeiter an, waehlt das Beispielgebaeude, sieht 2 Glas-Geschosse, 5 Einheiten und die Pins; Klick auf den Verteiler zeigt im Panel "versorgt: Restaurant, Buero C". Dasselbe funktioniert im Docker-Image.

## 2. Architektur (Ansatz A, PO-Go)

- **Paket `web/`** im Repo: React 19 + Vite, eigene `package.json` und eigenes Lockfile, TypeScript strikt.
- **Auslieferung durch Fastify** mit `@fastify/static`: `web/dist` unter `/`, SPA-Fallback auf `index.html` fuer unbekannte Nicht-API-Pfade. `/api/*` bleibt unberuehrt (unbekannte API-Pfade weiterhin 404 bzw. 501-Platzhalter).
- **Ein Image, eine Version:** Docker-Stufe `web-bau` baut `web/`, Ergebnis nach `/app/web` im Laufzeit-Image. Caddy, Compose, Update und Restore bleiben unveraendert.
- **Gleiche Herkunft** fuer Seite und API: Cookie-Sitzung und CSRF-Header (`x-planora-request: 1`, Origin) funktionieren wie bisher.
- **Lokal:** `npm run dev` in `web/` startet Vite mit Proxy `/api` → Fastify.
- Verworfen: Caddy liefert statisch aus (zweites Artefakt, Aenderung an abgenommenen M1-Teilen); eigener Static-Handler ohne Bibliothek (Path-Traversal-Risiko).

### Neue Abhaengigkeiten [A: exakte Versionen und Lizenzen vor dem Einbau pruefen und festhalten]

| Paket | Wo | Zweck | erwartete Lizenz |
|---|---|---|---|
| `react`, `react-dom` | web | UI | MIT |
| `three` | web | 3D | MIT |
| `@react-three/fiber` | web | React-Renderer fuer three | MIT |
| `vite`, `@vitejs/plugin-react`, `typescript`, `vitest` | web (dev) | Build/Test | MIT |
| `@fastify/static` | app | Auslieferung | MIT |

Kein `@react-three/drei`: Kamerasteuerung aus `three/examples/jsm/controls/OrbitControls`. Versionen nach ADR 0008 als Ausgangspunkt (three 0.187.0, @react-three/fiber 9.8.2), aktuelle Staende vor dem Einbau nachschlagen.

## 3. Seiten und Datenfluss

Kein Router-Paket; drei Zustaende in der App:

| Seite | Inhalt | Daten |
|---|---|---|
| Login | E-Mail, Passwort, Fehlermeldung | `POST /api/auth/sign-in/email` (vorhanden) |
| Gebaeude | Liste: Liegenschaft, Gebaeudename, Anzahl Geschosse; Klick oeffnet Ansicht | **neu** `GET /api/struktur/gebaeude` |
| Ansicht | 3D links, Seitenpanel rechts, Kopfzeile mit Gebaeudename, "zurueck", "Abmelden" | `GET /api/szene/gebaeude/:id/welt`, `GET /api/struktur/gebaeude/:id/beschreibung`, `GET /api/katalog/v1` |

- **Sitzung:** Beim Start `GET /api/ich`; 401 → Login. Abmelden ueber `POST /api/auth/sign-out`. Jeder schreibende Aufruf sendet `x-planora-request: 1`.
- **Fehleranzeige:** API-Fehler `{fehler: [...]}` als Meldung; Login-Fehler von Better Auth in deren Format, im UI separat behandelt ("E-Mail oder Passwort falsch", Sperre/Rate-Limit als eigene Meldung).
- **Ladezustand und Fehler** je Seite sichtbar; leere Gebaeudeliste mit Hinweis "Noch keine Gebaeude erfasst".

## 4. Backend-Ergaenzungen

1. **`GET /api/struktur/gebaeude`** – Liste `{ id, name, liegenschaftId, liegenschaftName, geschosse }[]`, sortiert nach Liegenschaftsname, Gebaeudename. Nur Gebaeude in Liegenschaften mit `fach.lesen`; Admin sieht alle; Betreiber und Benutzer ohne Rolle erhalten eine leere Liste (keine Fachdaten). Kein Paging (Instanz je Kunde, kleine Mengen) [A].
2. **`GET /api/katalog/v1`** – `KATALOG_V1` (IDs, Namen, Bereich) fuer angemeldete Benutzer. Modul `katalog` existiert im Manifest [F].
3. **Einheitliches 400-Format:** Schema-Fehler der Fastify-Routen werden als `{ fehler: [{ pfad, code: "struktur_ungueltig", meldung }] }` beantwortet (eigener Error-Handler fuer Validierungsfehler). Erledigt den offenen Punkt aus M2a-Spec §11. Better-Auth-Antworten bleiben unveraendert.
4. **Statische Auslieferung:** Registrierung nur, wenn das Web-Verzeichnis existiert (Pfad per `PLANORA_WEB_DIR`, Default `/app/web` im Image). Header fuer HTML/Assets:
   - `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'` [A: `unsafe-inline` fuer Stil-Attribute von React; pruefen, ob verzichtbar]
   - `index.html`: `Cache-Control: no-cache`; Dateien mit Hash im Namen: `Cache-Control: public, max-age=31536000, immutable`.
   - Wartungsmodus und Modul-Guard betreffen nur `/api` bzw. Caddy und bleiben unveraendert.

## 5. 3D-Szene

**Technik:** `three` + `@react-three/fiber`, `frameloop="demand"` (Zeichnen nur bei Aenderung, S3b), Pixeldichte max. 1.5 (ADR 0008).

| Element | Darstellung |
|---|---|
| Geschosse | je eine flache, halbtransparente Platte ueber dem Grundriss (`welt.grundriss`, `yUnten`), Kanten als Linien |
| Fassade | Umriss je Teilrechteck als vertikale/horizontale Linien ueber alle Geschosse, eine `LineSegments` |
| Einheiten | Rechtecke (`welt.einheiten[].rechteck`) als Linien auf der Platte; Bezeichnung als Text-Sprite (Canvas-Textur) |
| Geschoss-Beschriftung | Text-Sprite seitlich: "<Code> · <Anzahl> Einheiten" |
| Pins | ein `InstancedMesh` (Scheibe/kurzer Zylinder knapp ueber dem Boden) je Symbol aus `welt.symbole`; Farbe je Katalog-Bereich (Zentrale / Verteilung / Einheit, drei neutrale, gut unterscheidbare Toene); `vorgeschlagen` halbtransparent; ausgewaehlt hervorgehoben |

**Kamera:** orthografisch, isometrisch (ca. 35° Neigung, 45° gedreht), beim Laden auf die Gebaeude-Bounding-Box eingepasst. `OrbitControls` mit Grenzen: keine Ansicht von unten, Zoom begrenzt; jede Aenderung loest `invalidate()` aus.

**Interaktion:** Hover ueber Pin → Zeiger als Hand, kleines Etikett mit Katalog-Name; Klick → Auswahl und Panel; Klick ins Leere oder `Esc` → Auswahl aufheben. Picking per Raycast auf dem `InstancedMesh` (`instanceId` → Symbol).

**Aufbau:** Reine Funktionen in `web/src/szene/` wandeln die Welt in Zeichendaten (Linien-Vertices, Pin-Matrizen und -Farben, Beschriftungen, Kamera-Einpassung); React-Komponenten zeichnen nur diese Daten. Die Funktionen sind ohne Browser testbar.

## 6. Seitenpanel

Bei ausgewaehltem Symbol:

- Kopf: Katalog-Name; Hersteller/Typ (falls vorhanden); Status ("vorgeschlagen" sichtbar markiert); Gesamtmenge bzw. "Menge unbekannt" (`mengeUnbekannt`), sonst `mengeSumme`.
- Bauteil-Zeilen des Symbols (`bauteilIds` → `beschreibung.bauteile`): je Menge (oder "unbekannt") und Baujahr (oder "–").
- Standort: Geschoss-Code und Einheit-Bezeichnung (bzw. "direkt am Geschoss").
- Versorgt: Bezeichnungen der versorgten Einheiten mit Geschoss-Code, sonst "–".
- Fusszeile: "Position schematisch" (ADR 0008).

Ohne Auswahl zeigt das Panel eine kurze Uebersicht: Anzahl Geschosse, Einheiten, Symbole sowie die Hinweise aus der Beschreibung (z.B. `verteiler_vorschlag` als "Buero D: Verteiler noch nicht erfasst").

Die Panel-Daten entstehen in einer reinen Funktion aus Welt, Beschreibung und Katalog (testbar).

## 7. Build und Betrieb

- `app/Dockerfile`: neue Stufe `web-bau` (Node-Image wie `bau`, `npm ci` + `npm run build` in `web/`), `COPY --from=web-bau /web/dist /app/web` ins Laufzeit-Image. Build-Kontext muss `web/` enthalten [A: Kontext und `.dockerignore` beim Planen pruefen].
- **Lizenz-Dossier:** `src/betrieb/dossier.ts` nimmt heute genau ein `--lockfile` [F]. Erweiterung auf mehrere Lockfiles (app und web), damit die Frontend-Pakete im Dossier stehen.
- Keine Aenderung an Caddyfile, Compose, Update, Backup, Restore.

## 8. Tests

| Ebene | Inhalt | Ort |
|---|---|---|
| Frontend-Logik | Welt → Zeichendaten (Plattenpositionen, Linien je Einheit, Pin-Anzahl = Anzahl Symbole, Farben je Bereich, vorgeschlagen halbtransparent, Kamera-Einpassung); Panel-Daten (Zeilen, Namen, "Menge unbekannt", Versorgt-Namen, Hinweise) | `web/` Vitest, ohne Browser |
| Backend | Gebaeudeliste nach Rechten (Leser mit/ohne Scope, Admin, Betreiber, fremde Liegenschaft); Katalog-Endpunkt (angemeldet 200, ohne Sitzung 401); 400-Format `{fehler}` mit `struktur_ungueltig`; Auslieferung (`/` → HTML mit CSP, `/gebaeude/x` → `index.html`, `/api/unbekannt` bleibt 404/501, Asset mit Hash → immutable); ohne Web-Verzeichnis keine Registrierung | `app/test`, `npm test` |
| Docker | Image baut mit `web/`; `GET /` liefert HTML | `test:docker`, Erweiterung des bestehenden Smoke-Tests |
| Sichtpruefung | Login → Liste → 3D → Klick auf Verteiler → Panel "versorgt: Restaurant, Buero C", Screenshot | einmalig per `playwright-cli`, nicht in der Suite |

## 9. Offene Punkte

- [A] Regelwerk-v1-Werte weiterhin Annahme; dieser Schnitt zeigt sie erstmals sichtbar – PO-Rueckmeldung nach dem ersten Bild.
- [A] Farben der drei Pin-Bereiche und Glas-Transparenz werden beim Bauen festgelegt und nach dem ersten Screenshot mit dem PO abgestimmt.
- [?] Messung auf echtem Kundengeraet/VDI (ADR 0008) – nicht Teil von M2b-1.
- [A] Aufwand ca. 3 PT (Gespraechsschaetzung, nicht gemessen).
- Naechste M2b-Schritte: Geschossauswahl/Explosion, Tabellenweg, Leistungsstufen, Tastaturbedienung.
