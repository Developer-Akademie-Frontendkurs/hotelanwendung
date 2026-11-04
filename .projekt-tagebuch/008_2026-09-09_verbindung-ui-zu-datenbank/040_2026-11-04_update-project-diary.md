[← Vorheriger Commit](039_2026-11-04_refactor-booking-templates-remove-comments.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# update project diary

- **Commit:** `cb7177e`
- **Datum:** 2026-11-04
- **Autor:** Oliver Jung

## Worum geht es?

Ein **reiner Dokumentations-Commit** – der siebte dieser Art im Branch nach 002, 013, 015, 024, 028 und 036. Er zieht das Tagebuch um vier Einträge nach: den Tagebuch-Commit 036 selbst, die Pflege des Umsetzungsplans (037), die Barrierefreiheit (038) und den Aufräum-Commit (039).

```text
 .projekt-tagebuch/000_index.md                     |   2 +-
 .../008_2026-09-09_verbindung-ui-zu-datenbank.md   |  94 ++++---
 ...-21_rejections-at-room-card-and-calendar-day.md |   2 +-
 .../036_2026-10-21_update-project-diary.md         |  89 ++++++
 ...6-10-28_bring-implementation-plan-up-to-date.md | 157 +++++++++++
 ...essibility-form-errors-calendar-live-regions.md | 311 +++++++++++++++++++++
 ...4_refactor-booking-templates-remove-comments.md | 245 ++++++++++++++++
 7 files changed, 860 insertions(+), 40 deletions(-)
```

Kein Anwendungscode ist betroffen.

## Die Änderungen im Detail

### 1. Index und Branch-Hauptdatei zählen weiter

Datei: `.projekt-tagebuch/000_index.md`

```diff
-| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 35      | offen             |
+| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 39      | offen             |
```

Wie bei allen Tagebuch-Commits zuvor zählt der Commit sich selbst nicht mit: Er schreibt „39", ist aber selbst der vierzigste.

### 2. Diesmal formatiert Prettier die Tabelle neu

In der Branch-Hauptdatei kommen vier Tabellenzeilen (036–039) dazu. Der Diff ist mit 94 Zeilen aber deutlich größer als vier Zeilen – denn der neue Dateiname

```text
038_2026-10-28_accessibility-form-errors-calendar-live-regions.md
```

ist zusammen mit dem Ordnerpfad länger als der bisher längste Link (`019_…`). Prettier verbreitert daraufhin die **ganze Spalte**, und jede Zeile der Commit-Tabelle ändert sich um ein paar Leerzeichen. Dasselbe war schon bei Commit 024 passiert. Für Lernende: Ausgerichtete Markdown-Tabellen sind gut lesbar, erzeugen aber große Diffs, sobald eine einzige Zelle breiter wird.

### 3. Ein neuer Nachtrag

Wie bei 015, 024, 028 und 036 bleibt die bestehende Zusammenfassung stehen; unten kommt ein Abschnitt „Nachtrag (Commits 036–039)" dazu. Er hält fest, dass mit 038 **alle Review-Gruppen A bis G abgehakt** sind – und warnt vor der Baustelle aus 039:

```markdown
Commit 039 hinterlässt allerdings eine Baustelle: Er löscht `Posts.ts` und `SinglePost.ts`,
während `src/main.ts` beide weiter importiert – `tsc` und damit `pnpm build` schlagen auf diesem
Stand fehl.
```

Genau diese Baustelle räumt der nächste Commit (041) auf. Hier zeigt sich ein praktischer Nutzen des Tagebuchs: Beim Dokumentieren wurde der Fehler bemerkt, der Hinweis stand im Text – und der folgende Commit behebt ihn.

### 4. Die Navigationskette wird verlängert

Die bisher letzte Detaildatei 035 bekommt ihren „Nächster Commit"-Link auf 036:

```diff
-[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
+[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](036_2026-10-21_update-project-diary.md)
```

Die neue Detaildatei 039 endet ohne „Nächster Commit" – sie ist jetzt das Ende der Kette.

## Was wurde erreicht?

Das Tagebuch steht auf dem Stand von `git log` bis einschließlich Commit 039, und die durchgehende Commit-Kette ist lückenlos. Kein Anwendungscode ist betroffen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](041_2026-11-04_remove-unused-posts-routes.md)
