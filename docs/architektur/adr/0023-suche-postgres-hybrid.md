# 0023 – Suche: PostgreSQL-Volltext + pgvector mit Reciprocal Rank Fusion

> **Status ab Welle 4: angepasst (E34–E37, 2026-11-09).**
> [A] Stufe 3: PostgreSQL-Volltext, pgvector/RRF und lokaler Embedding-Server (E36); Voyage, Managed-PG- und Mandanten-RLS-Annahmen entfallen.
> [A] Modell/Server/Lizenz/RAM/CPU noch zu verifizieren (`bge-m3` Kandidat); Liegenschaftsrechte auch fuer Snippets/Vektortreffer; Claude-Reranking erst Stufe 4 (vgl. offene Frage in E37).
> Der folgende Text ist die bisherige Fassung und bleibt als Historie erhalten.

Status: akzeptiert (PO-Entscheid E31), Embedding-Anbieter offen (E27) · 2026-11-09 · Bezug: E26, E27, E30, E7

## Kontext
E26 verlangt Suche nach Dokumentname, Volltext und Inhalt (semantisch), DE/FR/IT, Treffer mit Seite und Sprung in den Viewer. E7: nur Standard-PostgreSQL; AD-3: Mandantentrennung per RLS.

## Entscheid
- Modul **`suche`** besitzt Tabelle **`such_abschnitt`** (`mandant_id`, `dokument_id`, `seite`, `abschnitt_nr`, `text`, `sprache`, `tsv tsvector`, `embedding vector(n)`, `bbox`, `pipeline_version`), RLS mit `FORCE` und zusammengesetzten FKs wie alle Mandantentabellen.
- Abschnitte stammen aus der Docling-Struktur (ADR 0009); `tsv` mit der eingebauten Textsuche-Konfiguration je Sprache (german, french, italian, english).
- **pgvector** (PostgreSQL License, auf Exoscale/Aiven verfuegbar [F, Q11-Tech]) mit HNSW-Index.
- Anfrage: drei Wege parallel (Dokumentname, `tsvector`, Vektor), zusammengefuehrt per **Reciprocal Rank Fusion** in SQL; Reranking mit Haiku nur bei aktiver KI des Mandanten. Treffer: Dokument, Seite, Ausschnitt, `bbox` → Viewer (ADR 0022).
- **RLS + HNSW:** iterativer Index-Scan von pgvector (`hnsw.iterative_scan`) [A: Version auf Exoscale pruefen]; Test mit 2 Mandanten unterschiedlicher Groesse muss vollen Recall zeigen.
- **Embeddings** ueber den Port `EmbeddingProvider`; selbst gehostet nur mit einem **fertigen Server** (z.B. text-embeddings-inference, Modell bge-m3/multilingual-e5) – Wahl gegen Voyage AI bleibt E27.
- UI-Einstieg: **kbar** (Ctrl+K) und Suchseite.

## Alternativen
- Meilisearch, Typesense, OpenSearch, Solr: zweiter Datenspeicher ausserhalb von RLS, widerspricht E7.
- `pg_search`/ParadeDB (BM25): auf Managed-PG voraussichtlich nicht installierbar [?]; V2 pruefen.

## Konsequenzen
- + Eine Datenbank, eine Mandantentrennung, Backups/PITR inklusive.
- − Ranking etwas schwaecher als spezialisierte Suchmaschinen [A]; Vektorindex braucht RAM in Managed PG.
