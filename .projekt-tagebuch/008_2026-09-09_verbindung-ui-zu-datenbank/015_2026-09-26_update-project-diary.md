[← Vorheriger Commit](014_2026-09-26_booking-steps-management.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(diary): update project diary to reflect commits 002-012 and enhance navigation

- **Commit:** `813760d`
- **Datum:** 2026-09-26
- **Autor:** Oliver Jung

## Worum geht es?

Ein **reiner Dokumentations-Commit** – der dritte dieser Art im Branch nach 002 und 013. Er trägt die beiden Commits nach, die seit dem letzten Tagebuch-Update dazugekommen waren: den Tagebuch-Commit 013 selbst und die Buchungsschritte aus Commit 014.

```text
 .projekt-tagebuch/000_index.md                     |   2 +-
 .../008_2026-09-09_verbindung-ui-zu-datenbank.md   |  10 +-
 ...26-09-26_booking-creation-modal-confirmation.md |   2 +-
 .../013_2026-09-26_project-diary.md                |  94 +++++
 .../014_2026-09-26_booking-steps-management.md     | 443 +++++++++++++++++++++
 5 files changed, 548 insertions(+), 3 deletions(-)
```

Kleine Unschärfe in der Commit-Message: Dort steht „commits 002-012", tatsächlich neu sind aber die Einträge **013 und 014**. Die Commits 002–012 hatte schon Commit 013 nachgetragen. Für Lernende ein guter Hinweis darauf, warum man die Commit-Message erst schreibt, wenn man sich den Diff (`git diff --staged`) noch einmal angesehen hat.

## Die Änderungen im Detail

### 1. Index und Branch-Hauptdatei zählen weiter

```diff
-| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 12      | offen             |
+| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 14      | offen             |
```

```diff
-**Erster Commit:** 2026-09-09 · **Commits:** 12 · **Status:** offen
+**Erster Commit:** 2026-09-09 · **Commits:** 14 · **Status:** offen
```

Und wieder dasselbe Phänomen wie in Commit 013: Der Commit, der „14" schreibt, ist selbst schon der fünfzehnte. Er kann sich nicht mitzählen, weil es ihn beim Speichern der Datei noch nicht gibt.

### 2. Zwei neue Zeilen in der Commit-Tabelle

```diff
 | [012](…/012_2026-09-26_booking-creation-modal-confirmation.md)        | 2026-09-26 | `create_booking` aus der Oberfläche, `booking.service.ts`, `<dialog>`-Bestätigung       |
+| [013](…/013_2026-09-26_project-diary.md)                              | 2026-09-26 | Projekttagebuch für die Commits 002–012 nachziehen (reiner Doku-Commit)                 |
+| [014](…/014_2026-09-26_booking-steps-management.md)                   | 2026-09-26 | Buchungsschritte im Sticky-Header: Status aus der View, Sprungmarken zu den Bereichen   |
```

### 3. Ein Nachtrag statt einer neuen Zusammenfassung

Die Zusammenfassung der Branch-Hauptdatei wird **nicht** umgeschrieben, sondern um einen Abschnitt „Nachtrag (Commits 013–014)" ergänzt. Er erklärt in einem Absatz, warum die Steps im Header falsch anzeigten und warum die Sprungmarken per `scrollIntoView` scrollen statt per `#hash`:

```markdown
### Nachtrag (Commits 013–014)

Commit 013 zieht das Tagebuch bis Commit 012 nach (reiner Doku-Commit, wie schon 002). Commit 014 erledigt das TODO „Buchungssteps verknüpfen": …

Im TODO-Block von `Booking.ts` bleibt damit nur noch die Frage nach Migrationen offen; `V8` und die Service-Schicht für Lesezugriffe stehen weiterhin aus.
```

Das Muster „anhängen statt umschreiben" hält die Zusammenfassung lesbar als **Chronik**: Wer sie liest, sieht, was zu welchem Stand bekannt war.

### 4. Die Navigationskette wird verlängert

Commit 012 war bis hierher das Ende der Kette und bekommt seinen „Nächster Commit"-Link:

```diff
-[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
+[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](013_2026-09-26_project-diary.md)
```

### 5. Zwei neue Detaildateien

`013_2026-09-26_project-diary.md` (94 Zeilen) und `014_2026-09-26_booking-steps-management.md` (443 Zeilen). Der Unterschied in der Länge ist typisch: Ein Doku-Commit lässt sich knapp beschreiben, ein Commit, der Zustand, View und Header gleichzeitig ändert, nicht.

## Was wurde erreicht?

Das Tagebuch steht wieder auf dem Stand von `git log` – bis einschließlich Commit 014. Kein Anwendungscode ist betroffen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](016_2026-09-30_review-document.md)
