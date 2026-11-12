# Digital Twin – Abschluss Teilaufgabe 8

12.11.2026 · `m2b2-redesign` · [Umsetzung und Grenzen](../../superpowers/plans/2026-11-12-teilaufgabe-8.md) · [Unabhängige Bildkritik](../../design/kritiken/2026-11-12-feinschliff-r1.md).

48 GPU-Bilder: 27 im [Dashboard-Durchgang](dashboard/bericht.json), 21 im [Zoom-/Tastaturdurchgang](zoom/bericht.json). Jeweils 1440 × 900, 1920 × 1080 und 1280 × 720. Renderer: **ANGLE / NVIDIA GeForce RTX 3070 Ti / D3D11**. Je Durchgang und Fenster **60 fps** bei Drehung; dies zählt Browser-Animationstakte und ist kein GPU-Framezeitbenchmark. Beide Durchgänge liefen teilweise gleichzeitig auf derselben GPU.

| Zustand | 1440 × 900 | 1280 × 720 |
|---|---|---|
| Direkter Einstieg | [Bild](zoom/einstieg-1440x900.png) | [Bild](zoom/einstieg-1280x720.png) |
| Auswahl | [Bild](zoom/auswahl-1440x900.png) | [Bild](zoom/auswahl-1280x720.png) |
| Tastaturzoom | [Bild](zoom/tastaturzoom-1440x900.png) | [Bild](zoom/tastaturzoom-1280x720.png) |
| Mausradzoom | [Bild](zoom/mausradzoom-1440x900.png) | [Bild](zoom/mausradzoom-1280x720.png) |
| T-Rückmeldung | [Bild](zoom/technik-rueckmeldung-1440x900.png) | [Bild](zoom/technik-rueckmeldung-1280x720.png) |
| Tabellenfokus | [Bild](zoom/tabellenfokus-1440x900.png) | [Bild](zoom/tabellenfokus-1280x720.png) |
| Profilmenü | [Bild](dashboard/profilmenue-1440x900.png) | [Bild](dashboard/profilmenue-1280x720.png) |
| Separieren | [Bild](dashboard/separiert-1440x900.png) | [Bild](dashboard/separiert-1280x720.png) |

Die unabhängige Kritik hat zehn Bilder geprüft: bereit für PO-Sichtung, keine zwingende neue Korrektur. Keine neue PO-Abnahme behauptet.

Zusätzliche [Browser-Funktionsprüfung](funktion.json) bei 1280 × 720: acht Anlagen, genau eine Tabellenzeile mit `tabindex=0`, Ende/Pos1/Pfeil ab bewegen den Fokus, Enter setzt die Auswahl; T zeigt eine sichtbare Meldung und setzt denselben Text in `aria-live`. Altansichten fehlen im Profilmenü. Keine echte Screenreader-Ausgabe geprüft.

Keine CSP-Verletzung und kein `pageerror` in den Protokollen. Bekannte Meldungen bleiben dokumentiert: 401 vor Login, `THREE.Clock`-Deprecation, D3D-Shaderwarnungen X4000/X3595. Keine beobachtete Funktionsstörung.

Technisch: 172 Webtests, Typprüfung und Build erfolgreich; `/lizenzen.txt` liefert HTTP 200 mit identischem Inhalt wie die Quelldatei. Backend/Docker und vollständiges Release-Lizenzdossier nicht erneut geprüft. Die separate Testinstanz 3100/54600 ist wieder gestoppt, PO-Instanz 3000/54500 blieb unberührt.
