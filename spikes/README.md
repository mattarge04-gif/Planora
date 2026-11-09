# Spikes (Welle 3, Wegwerf-Machbarkeitstests)

Stand 2026-11-08 · Test-Architekt · Kein Produktivcode. Teststrategie und Gesamtbewertung: `docs/architektur/05-tests.md`.

| Ordner | Spike | Urteil | Ausfuehren |
|---|---|---|---|
| `s01-grundriss/` | S1 Grundriss → Raum-Rechtecke | Lindenhof bestanden, Kriterium offen | `_werkzeuge/venv/Scripts/python s01-grundriss/auswerten.py` |
| `s02-extraktion/` | S2 Elemente + Kennwerte, Halluzinationstest | Lindenhof bestanden, Kriterium offen | `_werkzeuge/venv/Scripts/python s02-extraktion/auswerten.py` |
| `s10-rechenkern/` | S10 Rechenkern | technisch bestanden, fachlich offen | `node --test s10-rechenkern/kern.test.ts` |
| `s03-3d/` | S3 3D-Performance | nicht entschieden (kein Iris-Xe-Laptop) | `cd s03-3d && npm ci && node messen.mjs` (vorher esbuild, siehe README) |
| `s04-rls/` | S4 RLS / Pool-Leak / Audit | lokal bestanden, Exoscale offen | `cd s04-rls && npm ci && node rls_test.mjs` |
| `s12-preisquellen/` | S12 Preisquellen (Recherche) | nicht bestanden | – |
| `s13-m1-kern/` | S13 M1-Kern: Better Auth, Modul-Guard, Dispatch-Race | T1+T2 bestanden, T3 Spec V2 bestanden (V1 nicht), T4 offen | `cd s13-m1-kern && npm ci && node t1_auth.mjs` (t2_guard, t3_dispatch siehe README) |

Testdaten (nur lesen): `beispiele/lindenhof/`.
Python-Werkzeuge: `python -m venv _werkzeuge/venv && _werkzeuge/venv/Scripts/python -m pip install pymupdf` (PyMuPDF, lokal).
KI-Tests liefen im "Abo-Modus" (Claude-Subagenten, je Lauf frisch). Prompt + Schema liegen in `sNN-*/prompt/`, damit dieselben Tests per API wiederholbar sind.
