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

Die Branches sind chronologisch nach ihrem ersten Commit sortiert. Inhaltlich bauen sie aufeinander auf: `spa-struktur` setzt auf `project-setup` auf, `testing-spike` auf `spa-struktur`, `startseite-erstellen` auf `testing-spike`, `buchungs-seite` auf `startseite-erstellen`, `datenbank-anbindung` auf `buchungs-seite`, `buchungsseite-ui-fertigstellen` auf `datenbank-anbindung` und `verbindung-ui-zu-datenbank` auf `main`. Mit dem Merge von Pull Request #5 (2026-11-04) waren alle bis dahin begonnenen Branches in `main` aufgenommen. Danach folgen kleine, kurzlebige Branches, die jeweils direkt von `main` abzweigen und per eigenem Pull Request zurückfließen: `favicon-hinterlegen` (PR #6), `fix-inputs-on-booking-page` (PR #7) und `bugfix--CSP-für-google-maps-fix` (PR #8).

Eine Besonderheit ab Branch 006: `buchungsseite-ui-fertigstellen` wurde **von** `datenbank-anbindung` abgezweigt, bevor dieser gemergt war. Deshalb kamen beide Branches gemeinsam über **einen** Pull Request (#4) in `main` – im `git log` von `main` stehen die Datenbank-Commits und die UI-Commits direkt hintereinander.

Eine weitere Besonderheit betrifft Branch 012: `feat-ausgebuchte-tage-im-callender-anzeigen` enthält keinen eigenen Commit. Der Commit `e08e20d` entstand direkt auf `main`; der Branch wurde erst danach an dieser Stelle angelegt und ist hier dokumentiert, damit der Commit nicht fehlt. Das eigentliche Kalender-Feature steckt in Branch 013, `feature/calendar-unavailable-days`. Er ist auf GitHub bereits über Pull Request #9 gemergt; im lokalen `main` (Stand `e08e20d`) fehlt dieser Merge noch.

| Nr.                                                                  | Datum      | Branch                                      | Commits | Status                                        |
| -------------------------------------------------------------------- | ---------- | ------------------------------------------- | ------- | --------------------------------------------- |
| [001](001_2026-04-29_project-setup.md)                               | 2026-04-29 | project-setup                               | 7       | gemergt in `main`                             |
| [002](002_2026-05-06_spa-struktur.md)                                | 2026-05-06 | spa-struktur                                | 13      | gemergt in `main`                             |
| [003](003_2026-06-03_testing-spike.md)                               | 2026-06-03 | testing-spike                               | 2       | gemergt in `main`                             |
| [004](004_2026-06-10_startseite-erstellen.md)                        | 2026-06-10 | startseite-erstellen                        | 15      | gemergt in `main`                             |
| [005](005_2026-07-22_buchungs-seite.md)                              | 2026-07-22 | buchungs-seite                              | 9       | gemergt in `main`                             |
| [006](006_2026-08-26_datenbank-anbindung.md)                         | 2026-08-26 | datenbank-anbindung                         | 12      | gemergt in `main`                             |
| [007](007_2026-09-06_buchungsseite-ui-fertigstellen.md)              | 2026-09-06 | buchungsseite-ui-fertigstellen              | 2       | gemergt in `main`                             |
| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)                  | 2026-09-09 | verbindung-ui-zu-datenbank                  | 42      | gemergt in `main`                             |
| [009](009_2026-11-11_favicon-hinterlegen.md)                         | 2026-11-11 | favicon-hinterlegen                         | 1       | gemergt in `main`                             |
| [010](010_2026-11-18_fix-inputs-on-booking-page.md)                  | 2026-11-18 | fix-inputs-on-booking-page                  | 1       | gemergt in `main`                             |
| [011](011_2026-11-18_bugfix-csp-fuer-google-maps-fix.md)             | 2026-11-18 | bugfix--CSP-für-google-maps-fix             | 1       | gemergt in `main`                             |
| [012](012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md) | 2026-11-18 | feat-ausgebuchte-tage-im-callender-anzeigen | 1       | Commit direkt auf `main`                      |
| [013](013_2026-11-18_calendar-unavailable-days.md)                   | 2026-11-18 | feature/calendar-unavailable-days           | 1       | lokal offen, in `origin/main` gemergt (PR #9) |

## Wie lese ich dieses Tagebuch?

- Jede **Branch-Hauptdatei** gibt einen kompakten Überblick über das Ziel des Branches und listet alle Commits.
- Jede **Commit-Detaildatei** erklärt die konkreten Code-Änderungen mit `diff`- und Code-Blöcken.
- Über die Navigationsleisten kannst du dich chronologisch durch alle Commits (branch-übergreifend) bewegen.
