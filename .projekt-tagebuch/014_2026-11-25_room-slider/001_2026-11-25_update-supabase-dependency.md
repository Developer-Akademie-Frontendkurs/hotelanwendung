[← Vorheriger Commit](../013_2026-11-18_calendar-unavailable-days/001_2026-11-18_nicht-buchbare-tage-im-calender-nicht-waehlbar.md) · [↑ Branch-Übersicht](../014_2026-11-25_room-slider.md) · [📓 Index](../000_index.md)

# chore: update supabase dependency to version 2.122.1

- **Commit:** `81ce9db`
- **Datum:** 2026-11-25
- **Autor:** Oliver Jung

> **Hinweis:** Dieser Commit wurde direkt auf `main` erstellt. Der Branch `feature/room-slider` wurde erst danach auf genau diesem Commit angelegt (Details in der [Branch-Übersicht](../014_2026-11-25_room-slider.md)).

## Worum geht es?

Ein reines **Wartungs-Update**: Die Supabase-CLI wird von Version 2.116.0 auf 2.122.1 angehoben. Am Anwendungscode ändert sich nichts.

```text
 package.json   |  2 +-
 pnpm-lock.yaml | 74 +++++++++++++++++++++++++++++-----------------------------
 2 files changed, 38 insertions(+), 38 deletions(-)
```

Der Präfix `chore:` in der Commit-Message folgt der Konvention _Conventional Commits_: `feat` für neue Funktionen, `fix` für Fehlerbehebungen, `chore` für Pflegearbeiten, die weder das eine noch das andere sind – etwa Abhängigkeiten aktualisieren.

## Welches „supabase" ist das?

Im Projekt gibt es zwei Pakete mit ähnlichem Namen, die man leicht verwechselt:

| Paket                   | Wofür                                                                            | Wo eingetragen    |
| ----------------------- | -------------------------------------------------------------------------------- | ----------------- |
| `@supabase/supabase-js` | Client-Bibliothek, mit der das **Frontend** Daten liest und schreibt             | `dependencies`    |
| `supabase`              | **Kommandozeilenwerkzeug** (CLI) für die lokale Datenbank, Migrationen und Typen | `devDependencies` |

Dieser Commit betrifft nur die **CLI**. Sie steckt hinter den Skripten in `package.json`:

```json
"scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset && node supabase/scripts/seed-storage.mjs",
    "db:diff": "supabase db diff",
    "db:types": "supabase gen types typescript --local > src/shared/types/database.types.ts"
}
```

Weil die CLI als `devDependency` im Projekt installiert ist (statt global auf dem Rechner), arbeiten alle im Team mit derselben Version. `pnpm db:start` ruft das `supabase`-Programm aus `node_modules/.bin` auf.

## Die Änderungen im Detail

### 1. `package.json`

```diff
         "prettier": "3.8.3",
-        "supabase": "^2.116.0",
+        "supabase": "^2.122.1",
         "typescript": "~6.0.2",
```

Das Dach `^` bedeutet: „mindestens diese Version, aber innerhalb derselben Hauptversion 2". `^2.116.0` hätte 2.122.1 also schon erlaubt. Warum trotzdem ändern? Weil die **Lock-Datei** festhält, welche Version tatsächlich installiert ist – und die stand noch auf 2.116.0. Mit dem neuen Mindeststand bekommt niemand mehr eine ältere Version.

### 2. `pnpm-lock.yaml`

Die Lock-Datei wird von `pnpm` selbst geschrieben (z. B. durch `pnpm up supabase@2.122.1`), nie von Hand. Sie enthält drei Arten von Änderungen:

```diff
       supabase:
-        specifier: ^2.116.0
-        version: 2.116.0
+        specifier: ^2.122.1
+        version: 2.122.1
```

Oben unter `importers` steht, was `package.json` verlangt (`specifier`) und was aufgelöst wurde (`version`).

```diff
-  '@supabase/cli-darwin-arm64@2.116.0':
-    resolution: {integrity: sha512-Mvfxf5q7oQ1KR59ndFFyGkh12IfwKH5ZOv7O…}
+  '@supabase/cli-darwin-arm64@2.122.1':
+    resolution: {integrity: sha512-yttIyKa7QU+yB6oxdErlI7zHYn2ohHSMqjNW…}
     cpu: [arm64]
     os: [darwin]
```

Die CLI ist in Go geschrieben und wird als fertiges Programm ausgeliefert. Für jedes Betriebssystem und jeden Prozessor gibt es ein eigenes Paket (`darwin-arm64` = Mac mit Apple-Chip, `linux-x64`, `windows-x64` …). Alle acht stehen in der Lock-Datei; installiert wird nur das passende, die übrigen sind `optional: true`. Die `integrity`-Prüfsumme sorgt dafür, dass beim Installieren genau die Datei ankommt, die beim Erzeugen der Lock-Datei heruntergeladen wurde.

## Warum ist das für diesen Branch wichtig?

Mit der neuen CLI-Version erzeugt `pnpm db:types` die Datei `src/shared/types/database.types.ts` in einem **anderen Format** (kompakter, zusätzlich mit dem Schema `graphql_public` und einem Feld `ComputedFields`). Das sieht man im nächsten Commit: Dort hat die generierte Datei über 1 400 geänderte Zeilen, obwohl inhaltlich nur eine Tabelle dazukommt. Wer generierten Code im Repo hat, sollte das Werkzeug, das ihn erzeugt, deshalb ebenfalls mit fester Version im Projekt führen.

## Was wurde erreicht?

Alle Entwickler:innen arbeiten nach `pnpm install` mit der Supabase-CLI 2.122.1. Die Typen der Datenbank werden damit reproduzierbar erzeugt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../014_2026-11-25_room-slider.md) · [Nächster Commit →](002_2026-11-25_zimmerslider-startseite-aus-datenbank.md)
