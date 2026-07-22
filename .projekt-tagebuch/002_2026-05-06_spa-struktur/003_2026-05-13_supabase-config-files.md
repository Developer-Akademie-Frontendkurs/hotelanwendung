[← Vorheriger Commit](002_2026-05-13_revert-abstractview-homeview.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Erste Konfigurationsdateien für Supabase

- **Commit:** `0d99341`
- **Datum:** 2026-05-13
- **Autor:** Oliver Jung

## Worum geht es?

Ein kleiner Vorbereitungs-Commit. Es werden eine `.env`-Datei (für die Supabase-Zugangsdaten) und automatisch von Vite erzeugte Cache-Dateien (`.vite/deps/...`) hinzugefügt.

## Die Änderungen im Detail

### `.env` – Umgebungsvariablen

Die `.env`-Datei enthält die Verbindungsdaten zu Supabase. Solche Werte gehören nicht direkt in den Quellcode, sondern in Umgebungsvariablen, die Vite über `import.meta.env` bereitstellt.

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_API_KEY=...
```

### `.vite/deps/...` – Vite-Cache

Die Dateien unter `.vite/deps/` werden von Vite automatisch generiert (Dependency-Pre-Bundling). Sie wurden hier mit eingecheckt; üblicherweise würde man sie über `.gitignore` ausschließen.

## Was wurde erreicht?

Die Supabase-Konfiguration ist vorbereitet. Der nächste Commit baut die eigentliche SPA-Struktur auf.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](004_2026-05-13_spa-grundstruktur.md)
