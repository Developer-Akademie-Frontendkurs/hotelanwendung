[← Vorheriger Commit](004_2026-04-29_index-header-color-vite-server.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [📓 Index](../000_index.md)

# Doku und ESLint `node_modules` ignorieren

- **Commit:** `3955a74`
- **Datum:** 2026-04-29
- **Autor:** Oliver Jung

## Worum geht es?

Ein Pflege-Commit: Die Projektdokumentation (ein eigenes, projektinternes Tagebuch unter `.projekttagebuch/`) wird ergänzt, und ESLint wird angewiesen, den Ordner `node_modules` nicht zu prüfen.

## Die Änderungen im Detail

### `eslint.config.ts` – `node_modules` ignorieren

Ohne diese Einstellung würde ESLint versuchen, auch die Tausenden Dateien in `node_modules` zu prüfen. Das kostet Zeit und liefert irrelevante Warnungen. Über ein `ignores`-Muster wird der Ordner ausgeschlossen.

```ts
// Auszug aus eslint.config.ts
{
  ignores: ['node_modules'],
}
```

### Projektinterne Dokumentation

Die Datei `.projekttagebuch/branches/0001-project-setup.md` wird um Notizen zum Setup erweitert. Hinweis: Dieser Ordner ist eine **bereits vorhandene** projektinterne Dokumentation und nicht Teil dieses generierten Tagebuchs.

## Was wurde erreicht?

ESLint läuft schneller und prüft nur noch den eigenen Quellcode. Die Projektnotizen sind aktualisiert.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [Nächster Commit →](006_2026-05-06_integrate-supabase-client.md)
