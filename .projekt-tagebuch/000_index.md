# Projekttagebuch: Hotelanwendung

Dieses Tagebuch dokumentiert die Entwicklung der **Hotelanwendung** anhand der Git-Historie. Die Anwendung ist eine **Single-Page-Application (SPA)**, die mit **TypeScript**, **Vite**, **Tailwind CSS** und **Supabase** umgesetzt wird. Jeder Branch steht für einen abgeschlossenen Entwicklungsabschnitt; jeder Commit wird ausführlich mit Code-Beispielen erklärt.

Ziel dieses Tagebuchs ist es, für Lernende nachvollziehbar zu machen, **was** in jedem Schritt verändert wurde und **warum**.

## Verwendeter Techstack

- **Sprache:** TypeScript
- **Build-Tool / Dev-Server:** Vite
- **Styling:** Tailwind CSS (v4) mit eigenem Theme
- **Backend / Datenbank:** Supabase
- **Tests:** Vitest
- **Code-Qualität:** ESLint, Prettier

## Branch-Übersicht

Die Branches sind chronologisch nach ihrem ersten Commit sortiert. Inhaltlich bauen sie aufeinander auf: `spa-struktur` setzt auf `project-setup` auf, `testing-spike` auf `spa-struktur` und `startseite-erstellen` auf `testing-spike`.

| Nr. | Datum | Branch | Commits | Status |
|-----|-------|--------|---------|--------|
| [001](001_2026-04-29_project-setup.md) | 2026-04-29 | project-setup | 7 | gemergt in `main` |
| [002](002_2026-05-06_spa-struktur.md) | 2026-05-06 | spa-struktur | 13 | offen |
| [003](003_2026-06-03_testing-spike.md) | 2026-06-03 | testing-spike | 2 | offen |
| [004](004_2026-06-10_startseite-erstellen.md) | 2026-06-10 | startseite-erstellen | 14 | offen |

## Wie lese ich dieses Tagebuch?

- Jede **Branch-Hauptdatei** gibt einen kompakten Überblick über das Ziel des Branches und listet alle Commits.
- Jede **Commit-Detaildatei** erklärt die konkreten Code-Änderungen mit `diff`- und Code-Blöcken.
- Über die Navigationsleisten kannst du dich chronologisch durch alle Commits (branch-übergreifend) bewegen.
