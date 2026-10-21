[← Vorheriger Commit](027_2026-10-14_catalog-service-booking-state-destroy-hook.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# update project dairy

- **Commit:** `e51ac15`
- **Datum:** 2026-10-14
- **Autor:** Oliver Jung

## Worum geht es?

Ein **reiner Dokumentations-Commit** – der fünfte dieser Art im Branch nach 002, 013, 015 und 024. Er zieht das Tagebuch um vier Einträge nach: den Tagebuch-Commit 024 selbst und die drei Commits der Review-Gruppe D (025–027).

```text
 .projekt-tagebuch/000_index.md                     |   2 +-
 .../008_2026-09-09_verbindung-ui-zu-datenbank.md   |  24 +-
 .../014_2026-09-26_booking-steps-management.md     |   2 +-
 ...room-quantity-handling-availability-messages.md |   2 +-
 .../024_2026-10-07_project-diary-update.md         |  89 ++++
 ...26-10-14_formatting-functions-calendar-logic.md | 268 ++++++++++
 ...0-14_checkout-error-handling-completed-steps.md | 296 +++++++++++
 ...4_catalog-service-booking-state-destroy-hook.md | 577 +++++++++++++++++++++
 8 files changed, 1256 insertions(+), 4 deletions(-)
```

Kein Anwendungscode ist betroffen. Die Commit-Message enthält – wie schon bei 024 – „dairy" statt „diary".

## Die Änderungen im Detail

### 1. Index und Branch-Hauptdatei zählen weiter

```diff
-| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 23      | offen             |
+| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 27      | offen             |
```

Wie bei allen Tagebuch-Commits zuvor zählt der Commit sich selbst nicht mit: Er schreibt „27", ist aber selbst der achtundzwanzigste.

In der Branch-Hauptdatei kommen vier Tabellenzeilen (024–027) dazu. Diesmal formatiert Prettier die Tabelle **nicht** neu – kein neuer Dateiname ist länger als der bisher längste (`019_…`). Deshalb ist der Diff mit 24 Zeilen viel kleiner als beim letzten Mal (70 Zeilen):

```diff
+| [024](008_2026-09-09_verbindung-ui-zu-datenbank/024_2026-10-07_project-diary-update.md)                         | 2026-10-07 | Projekttagebuch um die Einträge 015–023 ergänzt (reiner Doku-Commit)                    |
+| [025](008_2026-09-09_verbindung-ui-zu-datenbank/025_2026-10-14_formatting-functions-calendar-logic.md)          | 2026-10-14 | D1/D2: `shared/format.ts` und `domain/calendar.ts` mit Tests                            |
+| [026](008_2026-09-09_verbindung-ui-zu-datenbank/026_2026-10-14_checkout-error-handling-completed-steps.md)      | 2026-10-14 | D3: `domain/validation.ts` – Code statt Textvergleich                                   |
+| [027](008_2026-09-09_verbindung-ui-zu-datenbank/027_2026-10-14_catalog-service-booking-state-destroy-hook.md)   | 2026-10-14 | D4–D7: `catalog.service.ts`, Store als Entwurf, `destroy()`                             |
```

### 2. Ein neuer Nachtrag statt umgeschriebener Zusammenfassung

Wie schon bei 015 und 024 bleibt die bestehende Zusammenfassung stehen; unten kommt ein Abschnitt „Nachtrag (Commits 024–027)" dazu. Er ordnet die Commits den Review-Punkten zu und hält zwei Einsichten fest:

```markdown
Der rote Faden: **Logik aus der View in reine Funktionen und Services ziehen** – erst die
Hilfsfunktionen, dann die Regeln, schließlich Datenzugriff und Zustand.
```

Dazu eine Warnung aus Commit 026: Automatisch umgeschriebene Tailwind-Klassen hatten ein `class`-Attribut ohne schließendes `">` hinterlassen – kein Werkzeug hat es bemerkt, weil `tsc`, ESLint und Vitest nicht in Template-Strings hineinsehen.

### 3. Die Navigationskette wird geflickt

Bemerkenswert ist der Teil des Commits, der **alte** Dateien anfasst. Zwei Detaildateien bekommen ihren fehlenden „Nächster Commit"-Link:

```diff
-[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
+[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](015_2026-09-26_update-project-diary.md)
```

- **014** war seit dem Nachtrag in Commit 015 eine Sackgasse (der Fehler wird in der Detaildatei zu 024 beschrieben).
- **023** war bis hierher das Ende der Kette und zeigt jetzt auf 024.

Genau dieses Muster wiederholt sich bei jedem Nachtrag: Die neuen Dateien bekommen ihre Links beim Anlegen, die **bisher letzte** Datei muss man bewusst verlängern. Die Detaildatei 027 dieses Commits endet folgerichtig wieder ohne „Nächster Commit" – sie ist jetzt das neue Ende.

## Was wurde erreicht?

Das Tagebuch steht auf dem Stand von `git log` bis einschließlich Commit 027, und die durchgehende Commit-Kette ist wieder lückenlos. Kein Anwendungscode ist betroffen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](029_2026-10-21_move-markup-into-templates.md)
