[← Vorheriger Commit](002_2026-06-15_assets-vite-config.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# Implement routing for posts and single post view with Supabase data fetching

- **Commit:** `548b62b`
- **Datum:** 2026-06-16
- **Autor:** Oliver Jung

## Worum geht es?

Wichtig für das Verständnis: Die **Commit-Message** dieses Commits spricht von Routing und Supabase-Datenabruf – die eigentliche **Routing-Funktionalität** (`PostsView`, `SinglePostView`, dynamisches Routing) wurde jedoch bereits früher im Branch `spa-struktur` umgesetzt (siehe [002 · Commit 006](../002_2026-05-06_spa-struktur/006_2026-05-20_routing-posts-single-post-supabase.md)).

Dieser Commit selbst enthält **keinen Anwendungscode**. Inhaltlich handelt es sich um eine **Umstellung der Projektdokumentation**: Das alte, sitzungsbasierte Log-Verzeichnis `.projekttagebuch/` (mit `branches/` und `sessions/`) wird entfernt und durch die neue, didaktische Tagebuch-Struktur `.projekt-tagebuch/` ersetzt.

Das ist eine gute Gelegenheit, eine typische Erfahrung aus der Praxis zu benennen: **Commit-Message und tatsächlicher Inhalt passen nicht immer zusammen.** Wer eine Historie nachvollziehen will, sollte sich daher nie allein auf die Message verlassen, sondern immer den echten Diff (`git show <hash>`) prüfen.

## Die Änderungen im Detail

### Entfernt: `.projekttagebuch/` (altes Session-Log)

Die frühere Struktur bestand aus manuell gepflegten Branch- und Sitzungsnotizen und wird vollständig gelöscht:

```diff
-.projekttagebuch/branches/0001-project-setup.md
-.projekttagebuch/branches/0002-spa-struktur.md
-.projekttagebuch/sessions/0001-project-setup/2026-04-29-21-06.md
-.projekttagebuch/sessions/0001-project-setup/2026-05-06-17-31.md
-.projekttagebuch/sessions/0002-spa-struktur/2026-05-06-18-49.md
-.projekttagebuch/sessions/0002-spa-struktur/2026-05-13-19-00.md
-.projekttagebuch/sessions/0002-spa-struktur/2026-05-20-19-57.md
-.projekttagebuch/sessions/0002-spa-struktur/2026-05-21-06-41.md
```

### Hinzugefügt: `.projekt-tagebuch/` (neue Tagebuch-Struktur)

An ihre Stelle tritt die aktuelle Struktur mit `000_index.md`, je einer Branch-Hauptdatei pro Branch und Unterordnern mit ausführlichen Commit-Detaildateien – also genau das Format, das du gerade liest.

## Was wurde erreicht?

Die Projektdokumentation wurde von einem sitzungsbasierten Log auf ein strukturiertes, didaktisches Projekttagebuch umgestellt. Am Anwendungscode selbst ändert sich in diesem Commit nichts. Merke dir: Bei mehrdeutigen Commit-Messages immer den tatsächlichen Diff prüfen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](004_2026-06-17_add-images-caveat-font.md)
