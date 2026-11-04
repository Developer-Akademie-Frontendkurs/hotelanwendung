[← Vorheriger Commit](035_2026-10-21_rejections-at-room-card-and-calendar-day.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# update project diary

- **Commit:** `0b7c6ac`
- **Datum:** 2026-10-21
- **Autor:** Oliver Jung

## Worum geht es?

Ein **reiner Dokumentations-Commit** – der sechste dieser Art im Branch nach 002, 013, 015, 024 und 028. Er zieht das Tagebuch um acht Einträge nach: den Tagebuch-Commit 028 selbst und die sieben Commits 029–035, mit denen die Review-Gruppen D (Rest), E und F (bis auf F6) abgearbeitet wurden.

```text
 .projekt-tagebuch/000_index.md                     |   2 +-
 .../008_2026-09-09_verbindung-ui-zu-datenbank.md   |  27 +-
 ...4_catalog-service-booking-state-destroy-hook.md |   2 +-
 .../028_2026-10-14_update-project-diary.md         |  78 +++++
 .../029_2026-10-21_move-markup-into-templates.md   | 224 ++++++++++++++
 ...26-10-21_tests-addresses-service-store-rules.md | 230 ++++++++++++++
 .../031_2026-10-21_posts-spike-migration.md        | 102 ++++++
 ...10-21_generated-database-types-posts-service.md | 243 +++++++++++++++
 ...21_calendar-availability-horizon-night-rules.md | 342 +++++++++++++++++++++
 ...034_2026-10-21_selection-bar-below-room-list.md | 162 ++++++++++
 ...-21_rejections-at-room-card-and-calendar-day.md | 203 ++++++++++++
 11 files changed, 1612 insertions(+), 3 deletions(-)
```

Kein Anwendungscode ist betroffen. Die Commit-Message schreibt diesmal korrekt „diary" – bei 024 und 028 stand noch „dairy".

## Die Änderungen im Detail

### 1. Index und Branch-Hauptdatei zählen weiter

Datei: `.projekt-tagebuch/000_index.md`

```diff
-| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 27      | offen             |
+| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 35      | offen             |
```

Wie bei allen Tagebuch-Commits zuvor zählt der Commit sich selbst nicht mit: Er schreibt „35", ist aber selbst der sechsunddreißigste. Das ist kein Fehler, sondern liegt in der Natur der Sache – ein Commit kann seinen eigenen Hash nicht kennen, und damit auch keinen Eintrag über sich selbst enthalten. Der nächste Tagebuch-Commit holt ihn nach.

In der Branch-Hauptdatei kommen die Kopfzeile und acht Tabellenzeilen (028–035) dazu:

```diff
-**Erster Commit:** 2026-09-09 · **Commits:** 27 · **Status:** offen
+**Erster Commit:** 2026-09-09 · **Commits:** 35 · **Status:** offen
```

```diff
+| [028](008_2026-09-09_verbindung-ui-zu-datenbank/028_2026-10-14_update-project-diary.md)                         | 2026-10-14 | Projekttagebuch um die Einträge 024–027 ergänzt (reiner Doku-Commit)                    |
+| [029](008_2026-09-09_verbindung-ui-zu-datenbank/029_2026-10-21_move-markup-into-templates.md)                   | 2026-10-21 | D8: Markup aus `Booking.ts` in vier Template-Dateien                                    |
+| [030](008_2026-09-09_verbindung-ui-zu-datenbank/030_2026-10-21_tests-addresses-service-store-rules.md)          | 2026-10-21 | E1–E5: Tests für Adressen, Service, Store und Datenbank                                 |
 …
+| [035](008_2026-09-09_verbindung-ui-zu-datenbank/035_2026-10-21_rejections-at-room-card-and-calendar-day.md)     | 2026-10-21 | F5: Ablehnungen an Zimmerkarte und Kalendertag                                          |
```

Auch diesmal formatiert Prettier die Tabelle nicht neu – kein neuer Dateiname ist länger als der bisher längste.

### 2. Ein neuer Nachtrag

Wie bei 015, 024 und 028 bleibt die bestehende Zusammenfassung stehen; unten kommt ein Abschnitt „Nachtrag (Commits 028–035)" dazu. Er enthält eine Tabelle, die jeden Commit seinen Review-Punkten zuordnet, und zwei Einsichten:

```markdown
Zwei Einsichten ragen heraus. Erstens: **Der typisierte Client hat echte Fehler gefunden** – `null`
für Parameter, die einen Default haben und deshalb weggelassen werden müssen. […] Zweitens: Nach
Gruppe D passen neue Funktionen ohne Sonderwege in die Struktur.
```

Der Nachtrag endet mit dem offenen Rest: **F6** (Umsetzungsplan pflegen) und Gruppe **G** (Barrierefreiheit). Genau diese beiden Punkte erledigen die nächsten zwei Commits (037 und 038).

### 3. Die Navigationskette wird verlängert

Wie in 028 beschrieben: Die neuen Dateien bekommen ihre Links beim Anlegen, die **bisher letzte** Datei muss man bewusst verlängern. Diesmal war das 027:

```diff
-[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
+[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](028_2026-10-14_update-project-diary.md)
```

Die neue Detaildatei 035 endet wieder ohne „Nächster Commit" – sie ist jetzt das Ende der Kette.

## Was wurde erreicht?

Das Tagebuch steht auf dem Stand von `git log` bis einschließlich Commit 035, und die durchgehende Commit-Kette ist lückenlos. Kein Anwendungscode ist betroffen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](037_2026-10-28_bring-implementation-plan-up-to-date.md)
