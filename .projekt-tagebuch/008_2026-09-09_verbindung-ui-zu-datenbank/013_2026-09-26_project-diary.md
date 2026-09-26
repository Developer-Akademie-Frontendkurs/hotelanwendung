[← Vorheriger Commit](012_2026-09-26_booking-creation-modal-confirmation.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): project diary

- **Commit:** `453aadf`
- **Datum:** 2026-09-26
- **Autor:** Oliver Jung

## Worum geht es?

Ein **reiner Dokumentations-Commit**, der das Projekttagebuch auf den Stand von Commit 012 bringt. Zwischen dem letzten Tagebuch-Commit (002, am 2026-09-09) und diesem hier lagen zehn Commits mit Anwendungscode, Migrationen und Tests – keiner davon war bis dahin im Tagebuch beschrieben.

Kein Anwendungscode, 3 362 neue Zeilen Markdown in vierzehn Dateien:

```text
 .projekt-tagebuch/000_index.md                     |   2 +-
 .../008_2026-09-09_verbindung-ui-zu-datenbank.md   |  52 ++-
 .../001_2026-09-09_umsetzungsplan-erstellt.md      |   2 +-
 .../002_2026-09-09_projekttagebuch-aktualisiert.md |  66 +++
 ...-16_update-comments-for-database-integration.md |  69 +++
 ..._2026-09-16_mengenwaehler-je-zimmerkategorie.md | 345 ++++++++++++++
 ...9-16_belegung-verpflichtend-kein-suchdefault.md | 175 ++++++++
 ...-16_zimmer-anzahl-und-fruehstueck-integriert.md | 371 ++++++++++++++++
 ...3_belegung-als-gesamtzahl-mehrere-kategorien.md | 449 +++++++++++++++++++
 ...26-09-23_sektion-zusatzleistungen-je-vorgang.md | 367 +++++++++++++++
 .../009_2026-09-26_customer-address-management.md  | 493 +++++++++++++++++++++
 ...0_2026-09-26_enhance-address-form-validation.md | 141 ++++++
 ...1_2026-09-26_booking-summary-dynamic-pricing.md | 390 ++++++++++++++++
 ...26-09-26_booking-creation-modal-confirmation.md | 448 +++++++++++++++++++
 14 files changed, 3362 insertions(+), 8 deletions(-)
```

Wie bei Commit 002 und den Doku-Commits in früheren Branches gilt: Auch ein Commit, der nur das Tagebuch ändert, bekommt einen eigenen Eintrag. Sonst laufen die Nummerierung im Tagebuch und die Reihenfolge in `git log` auseinander.

## Die Änderungen im Detail

### 1. Index und Branch-Hauptdatei zählen neu

Im Index ändert sich genau eine Zeile – die Commit-Zahl des offenen Branches springt von 1 auf 12:

```diff
-| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 1       | offen             |
+| [008](008_2026-09-09_verbindung-ui-zu-datenbank.md)     | 2026-09-09 | verbindung-ui-zu-datenbank     | 12      | offen             |
```

Dieselbe Zahl steht in der Kopfzeile der Branch-Hauptdatei:

```diff
-**Erster Commit:** 2026-09-09 · **Commits:** 1 · **Status:** offen
+**Erster Commit:** 2026-09-09 · **Commits:** 12 · **Status:** offen
```

Auffällig: 12 statt 13. Der Commit, der diese Zahl schreibt, kann sich selbst noch nicht mitzählen – er existiert ja erst, **nachdem** die Datei gespeichert ist. Deshalb wird jeder Tagebuch-Commit erst vom **nächsten** Tagebuch-Update erfasst (so wie dieser Eintrag hier).

### 2. Die Zusammenfassung bekommt eine zweite Hälfte

Bis hierher bestand die Branch-Zusammenfassung nur aus der Beschreibung des Plans (Commit 001) und endete mit dem Satz, dass die Umsetzungs-Commits „folgen". Der Commit teilt sie in zwei Abschnitte:

```diff
-Der Branch besteht bislang aus **einem** Commit, und der enthält keine Zeile ausführbaren Code – …
+### Der Plan (Commit 001)
+
+Der erste Commit des Branches enthält keine Zeile ausführbaren Code – …
```

```diff
-Der Branch ist **noch nicht in `main` gemergt** und hat von den fünf geplanten Commits erst den vorbereitenden Doku-Commit. …
+### Die Umsetzung (Commits 003–012)
+
+Die Zusammenfassung oben beschreibt den Plan. Die zehn folgenden Commits setzen ihn um – und weichen dabei an mehreren Stellen **mit Ansage** von ihm ab. …
```

Der Plan-Teil bleibt dabei inhaltlich stehen. Das ist bewusst so: Er beschreibt, was am 2026-09-09 vorgesehen war – und der neue Abschnitt vergleicht damit, was tatsächlich gebaut wurde (zwei revidierte Entscheidungen, viermal ersetztes `create_booking`, deutlich größerer Umfang).

### 3. Die Navigation wird verlängert

Wie schon in Commit 002: Die bis dahin letzte Commit-Datei bekommt ihren „Nächster Commit"-Link.

```diff
-[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
+[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](002_2026-09-09_projekttagebuch-aktualisiert.md)
```

### 4. Elf neue Commit-Detaildateien

Neu sind die Einträge 002 bis 012. Die umfangreichsten sind `009_…_customer-address-management.md` (493 Zeilen) und `007_…_belegung-als-gesamtzahl-mehrere-kategorien.md` (449 Zeilen) – die beiden Commits, in denen sich Schema, Migration, Datenbanktests und Oberfläche gleichzeitig geändert haben.

## Was wurde erreicht?

Das Tagebuch ist wieder auf dem Stand von `git log` – bis einschließlich Commit 012. Für Lernende lohnt sich ein Blick auf die Größenordnung: Zehn Commits Code erzeugen hier gut 3 300 Zeilen Erklärung. Das liegt nicht an Füllmaterial, sondern daran, dass jeder dieser Commits mehrere Schichten gleichzeitig berührt (Entscheidungsprotokoll, SQL, TypeScript, Tests) und jede davon für sich verstanden werden will.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](014_2026-09-26_booking-steps-management.md)
