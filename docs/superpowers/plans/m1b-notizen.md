# M1b – Notizen der Spuren

Kennzeichnung: [F] Fakt · [A] Annahme · [?] offen.

## Spur A

### A1 Health + Wartungsflag
- [F] Basislinie vor Beginn: `cd app && npm test` → 101 Tests gruen (Plan nennt 98).
- [A] `/api/health` ist **keine registrierte Fastify-Route**, sondern wird im ersten `onRequest`-Hook per exaktem Pfadvergleich beantwortet. Grund: Modul-Guard (`FREIE_API_ROUTEN` in `module/manifest.ts`) und Sitzungsregeln (`auth/sitzung.ts`) verlangen fuer jede registrierte `/api`-Route Modul bzw. Sitzung; beide Dateien gehoeren nicht zu Spur A. Sauberer waere ein Eintrag `/api/health` in `FREIE_API_ROUTEN` plus Ausnahme in den Sitzungsregeln → **Wunsch an Koordinator** (ausserhalb Datei-Eigentum).
- [A] Waehrend der Wartung ist auch `POST /api/auth/sign-in/email` gesperrt (Plan: alle mutierenden Methoden ausser `sign-out`). Folge fuer §14.4 Schritt 6: Smoke-Login laeuft nicht ueber HTTP, sondern prozessintern (siehe A5).
- [A] 008 enthaelt zusaetzlich `betrieb_ereignis(art, daten)` (SECURITY DEFINER, nur `planora_betrieb`): schreibt Audit-Eintraege mit festem Praefix `betrieb.`; `setze_wartung` auditiert damit jeden Wechsel (§10: Update-Ereignisse auditiert). `planora_betrieb` erhaelt SELECT auf `instanz_einstellung`, `backup_lauf`, `migration_journal` (Update-Vorpruefung §8 Schritt 0). **Hinweis Spur B:** der SELECT-Grant auf `backup_lauf` fuer `planora_betrieb` steht damit schon in 008.
- [A] Fehlende Zeile `wartung` oder ein Wert ungleich JSON `false` gilt als Wartung aktiv (geschlossen).
