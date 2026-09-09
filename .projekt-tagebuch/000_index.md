# Projekttagebuch: Hotelanwendung

Dieses Tagebuch dokumentiert die Entwicklung der **Hotelanwendung** anhand der Git-Historie. Die Anwendung ist eine **Single-Page-Application (SPA)**, die mit **TypeScript**, **Vite**, **Tailwind CSS** und **Supabase** umgesetzt wird. Jeder Branch steht für einen abgeschlossenen Entwicklungsabschnitt; jeder Commit wird ausführlich mit Code-Beispielen erklärt.

Ziel dieses Tagebuchs ist es, für Lernende nachvollziehbar zu machen, **was** in jedem Schritt verändert wurde und **warum**.

## Verwendeter Techstack

- **Sprache:** TypeScript
- **Build-Tool / Dev-Server:** Vite
- **Styling:** Tailwind CSS (v4) mit eigenem Theme
- **Backend / Datenbank:** Supabase (PostgreSQL) – Schema als Migrationen im Repo, Zugriffskontrolle über Row Level Security
- **Datenbank-Werkzeuge:** Supabase CLI, lokale Instanz in Docker
- **Tests:** Vitest – `pnpm test` für Unit-Tests, `pnpm test:db` für Datenbanktests
- **Code-Qualität:** ESLint, Prettier

## Branch-Übersicht

Die Branches sind chronologisch nach ihrem ersten Commit sortiert. Inhaltlich bauen sie aufeinander auf: `spa-struktur` setzt auf `project-setup` auf, `testing-spike` auf `spa-struktur`, `startseite-erstellen` auf `testing-spike`, `buchungs-seite` auf `startseite-erstellen`, `datenbank-anbindung` auf `buchungs-seite`, `buchungsseite-ui-fertigstellen` auf `datenbank-anbindung` und `verbindung-ui-zu-datenbank` auf `main`.

Eine Besonderheit ab Branch 006: `buchungsseite-ui-fertigstellen` wurde **von** `datenbank-anbindung` abgezweigt, bevor dieser gemergt war. Deshalb kamen beide Branches gemeinsam über **einen** Pull Request (#4) in `main` – im `git log` von `main` stehen die Datenbank-Commits und die UI-Commits direkt hintereinander.

| Nr.                                                     | Datum      | Branch                         | Commits | Status            |
| ------------------------------------------------------- | ---------- | ------------------------------ | ------- | ----------------- |
| [001](001_2026-04-29_project-setup.md)                  | 2026-04-29 | project-setup                  | 7       | gemergt in `main` |
| [002](002_2026-05-06_spa-struktur.md)                   | 2026-05-06 | spa-struktur                   | 13      | gemergt in `main` |
| [003](003_2026-06-03_testing-spike.md)                  | 2026-06-03 | testing-spike                  | 2       | gemergt in `main` |
| [004](004_2026-06-10_startseite-erstellen.md)           | 2026-06-10 | startseite-erstellen           | 15      | gemergt in `main` |
| [005](005_2026-07-22_buchungs-seite.md)                 | 2026-07-22 | buchungs-seite                 | 9       | gemergt in `main` |
| [006](006_2026-08-26_datenbank-anbindung.md)            | 2026-08-26 | datenbank-anbindung            | 12      | gemergt in `main` |
| [007](007_2026-09-06_buchungsseite-ui-fertigstellen.md) | 2026-09-06 | buchungsseite-ui-fertigstellen | 2       | gemergt in `main` |
| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 1       | offen             |

## Wie lese ich dieses Tagebuch?

- Jede **Branch-Hauptdatei** gibt einen kompakten Überblick über das Ziel des Branches und listet alle Commits.
- Jede **Commit-Detaildatei** erklärt die konkreten Code-Änderungen mit `diff`- und Code-Blöcken.
- Über die Navigationsleisten kannst du dich chronologisch durch alle Commits (branch-übergreifend) bewegen.
