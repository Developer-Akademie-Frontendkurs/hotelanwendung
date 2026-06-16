[← Vorheriger Commit](001_2026-05-06_gitignore-abstractview-homeview.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Revert des vorherigen Commits

- **Commit:** `7ddaf7c`
- **Datum:** 2026-05-13
- **Autor:** Oliver Jung

## Worum geht es?

Dies ist ein **Revert**: Git macht die Änderungen des vorherigen Commits (`0fa80b0`) rückgängig. Ein Revert erzeugt dabei keinen Sprung in der Historie, sondern einen neuen Commit, der genau das Gegenteil der vorherigen Änderung enthält – die zuvor hinzugefügten Zeilen werden also wieder entfernt.

Das ist ein didaktisch wichtiges Muster: Statt einen Commit aus der Historie zu löschen, dokumentiert man mit einem Revert nachvollziehbar, dass ein Ansatz verworfen wurde.

## Die Änderungen im Detail

Die im vorherigen Commit angelegten Dateien werden wieder gelöscht bzw. zurückgesetzt:

```diff
- src/views/AbstractView.ts   (gelöscht)
- src/views/HomeView/Home.ts  (gelöscht)
- src/main.ts                 (Router-Skizze entfernt)
- .gitignore                  (zurückgesetzt)
```

## Was wurde erreicht?

Der Arbeitsstand entspricht wieder dem vor `0fa80b0`. Die View-Struktur wird in Commit `004` neu und durchdachter aufgebaut.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](003_2026-05-13_supabase-config-files.md)
