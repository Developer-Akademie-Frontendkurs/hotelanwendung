[← Vorheriger Commit](009_2026-09-02_phase-7-rls-abnahme.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# update project diary

- **Commit:** `e2536be`
- **Datum:** 2026-09-04
- **Autor:** Oliver Jung

## Worum geht es?

Ein reiner **Dokumentations-Commit**: Er verändert keine Zeile SQL und keine Zeile TypeScript, sondern schreibt das Projekttagebuch auf den Stand der eben abgeschlossenen Phasen 1–7 fort. Er ist damit das Gegenstück zu den Doku-Commits aus Branch `buchungs-seite` (dort 002, 004, 008 und 009) – nur eine Größenordnung darüber.

```text
 .projekt-tagebuch/000_index.md                     |  10 +-
 .projekt-tagebuch/005_2026-07-22_buchungs-seite.md |  33 +-
 ...2026-08-08_update-project-diary-booking-page.md |   2 +-
 .../009_2026-08-26_projekttagebuch-aktualisiert.md |  90 +++
 .../006_2026-08-26_datenbank-anbindung.md          |  92 +++
 ...26-08-26_datenbank-schema-und-umsetzungsplan.md | 212 ++++++
 ...26-09-02_runde-6-und-vorgehensentscheidungen.md | 332 +++++++++
 ...02_phase-1-cli-umgebungstrennung-testgeruest.md | 404 +++++++++++
 .../004_2026-09-02_phase-2-stammdaten-rls-seed.md  | 751 +++++++++++++++++++++
 ...-09-02_phase-3-saisonpreise-und-preisluecken.md | 562 +++++++++++++++
 ...02_phase-4-kunden-buchungen-naechte-historie.md | 692 +++++++++++++++++++
 .../007_2026-09-02_phase-5-verfuegbarkeit.md       | 600 ++++++++++++++++
 .../008_2026-09-02_phase-6-create-booking.md       | 626 +++++++++++++++
 .../009_2026-09-02_phase-7-rls-abnahme.md          | 444 ++++++++++++
 14 files changed, 4830 insertions(+), 20 deletions(-)
```

**4 830 neue Zeilen Markdown für 9 Commits.** Das ist – gemessen an den Migrationen, die sie beschreiben – etwa das Zweieinhalbfache. Wer diese Zahl für übertrieben hält, hat recht, wenn es um ein Produktionsprojekt geht; hier ist die Dokumentation aber das **Produkt**: Das Repository ist ein Lernprojekt, und der `.projekt-tagebuch/`-Ordner ist der Teil, den man später liest.

## Die Änderungen im Detail

Der Commit macht vier Dinge gleichzeitig. Es lohnt, sie auseinanderzuhalten, weil jedes davon in jedem Doku-Nachtrag wieder vorkommt.

### 1. Der abgeschlossene Vorgänger-Branch wird geschlossen

Vier der 14 Dateien gehören gar nicht zum aktuellen Branch, sondern zu `buchungs-seite`. Dort fehlte die letzte Detaildatei, und der Status stand noch auf „offen":

```diff
-| [005](005_2026-07-22_buchungs-seite.md)       | 2026-07-22 | buchungs-seite       | 8       | offen             |
+| [005](005_2026-07-22_buchungs-seite.md)       | 2026-07-22 | buchungs-seite       | 9       | gemergt in `main` |
+| [006](006_2026-08-26_datenbank-anbindung.md)  | 2026-08-26 | datenbank-anbindung  | 9       | offen             |
```

Und in der Branch-Hauptdatei von `buchungs-seite` bekommt die Navigationsleiste erstmals einen Vorwärts-Link:

```diff
-[← Vorheriger Branch](004_2026-06-10_startseite-erstellen.md) · [📓 Index](000_index.md)
+[← Vorheriger Branch](004_2026-06-10_startseite-erstellen.md) · [📓 Index](000_index.md) · [Nächster Branch →](006_2026-08-26_datenbank-anbindung.md)
```

Das ist ein Muster, das in einer verketteten Dokumentation unvermeidlich ist: **Der letzte Eintrag kann seinen Nachfolger noch nicht kennen.** Er bekommt den Link erst, wenn es den Nachfolger gibt – also einen Commit später. Wer eine solche Kette pflegt, ändert bei jedem neuen Glied immer zwei Dateien: das neue und das vorherige.

### 2. Der Techstack-Abschnitt im Index wird präziser

Vorher stand dort nur „Supabase" und „Vitest". Nach sieben Phasen Datenbankarbeit ist das zu grob:

```diff
-- **Backend / Datenbank:** Supabase
--- **Tests:** Vitest
+- **Backend / Datenbank:** Supabase (PostgreSQL) – Schema als Migrationen im Repo, Zugriffskontrolle über Row Level Security
+- **Datenbank-Werkzeuge:** Supabase CLI, lokale Instanz in Docker
+- **Tests:** Vitest – `pnpm test` für Unit-Tests, `pnpm test:db` für Datenbanktests
```

Inhaltlich wichtig ist die Ergänzung „Schema als Migrationen im Repo": Vorher war Supabase eine Cloud-Instanz, deren Struktur nur dort existierte. Der Techstack hat sich also nicht um ein Werkzeug erweitert, sondern in seiner **Bedeutung** verändert – und genau das musste im Index nachgezogen werden.

### 3. Neun Detaildateien und eine Branch-Hauptdatei für Branch 006

Der eigentliche Umfang. Auffällig ist die Verteilung:

| Datei                          | Zeilen | Thema                                      |
| ------------------------------ | -----: | ------------------------------------------ |
| `004_…_phase-2-stammdaten…`    |    751 | Stammdaten, RLS ab Tag 1, erster `EXCLUDE` |
| `006_…_phase-4-kunden…`        |    692 | Buchungen, eingefrorene Nächte, Historie   |
| `008_…_phase-6-create-booking` |    626 | Advisory-Lock, strukturierte Ablehnung     |
| `007_…_phase-5-verfuegbarkeit` |    600 | drei geschichtete Funktionen               |
| `005_…_phase-3-saisonpreise…`  |    562 | Überlappungsschutz, Gaps and Islands       |
| `009_…_phase-7-rls-abnahme`    |    444 | `rls_audit()` als Dauerprüfung             |
| `003_…_phase-1-cli…`           |    404 | Werkzeuge, Umgebungstrennung, Testgerüst   |
| `002_…_runde-6…`               |    332 | reiner Doku-Commit im Original             |
| `001_…_schema-und-plan`        |    212 | reiner Doku-Commit im Original             |

Die längsten Einträge sind nicht die mit dem meisten SQL, sondern die mit den **meisten Entscheidungen**. Phase 2 legt fünf Tabellen an – und mit ihnen das Muster „RLS gehört in dieselbe Migration wie die Tabelle", das den Rest des Branches prägt. Diese Erklärung ist länger als das SQL, das sie beschreibt.

### 4. Ein einziges Zeichen in einer alten Datei

Die dritte Zeile im Diffstat ist die interessanteste: `008_2026-08-08_update-project-diary-booking-page.md | 2 +-`. Eine Zeile hin, eine Zeile her – das ist die **untere Navigationsleiste**, die einen Vorwärts-Link zum neu entstandenen Commit 009 desselben Branches bekommt.

Solche Ein-Zeilen-Änderungen an alten Dateien sind das Kennzeichen einer **doppelt verketteten Liste** auf dem Dateisystem: Jeder Eintrag zeigt auf Vorgänger und Nachfolger, also muss beim Anhängen der Vorgänger angefasst werden. Wer sich das ansieht und denkt „das müsste ein Generator machen", denkt richtig – siehe die Beobachtung in Commit 009 des Vorgänger-Branches.

## Warum Doku in eigenen Commits?

Diese Frage stellt sich bei diesem Commit besonders deutlich, weil er so groß ist. Drei Gründe, die sich in diesem Repository beobachten lassen:

1. **Lesbare Code-Diffs.** Die Phasen-Commits `cdb1af7` bis `e1aef3b` enthalten SQL, Tests und Doku-Anpassungen – aber kein Tagebuch. Wer `git show 08bb4f0` aufruft, sieht die Migration und nichts sonst.
2. **Unabhängige Zeitpunkte.** Der Code entstand am 2026-09-02, das Tagebuch am 2026-09-04. Hätte man beides vermischt, wäre entweder der Code zwei Tage später eingecheckt worden oder das Tagebuch unvollständig geblieben.
3. **Umkehrbarkeit.** Ein Doku-Commit lässt sich gefahrlos zurücknehmen. Ein gemischter Commit nicht – man müsste die Hälfte behalten.

Der Gegenpreis, ehrlich benannt: Die Historie enthält Commits, die für das laufende Programm bedeutungslos sind. Bei `git log --oneline` sieht man 12 Commits, von denen nur 11 die Anwendung verändern.

## Was wurde erreicht?

Nach diesem Commit sind **alle** Commits der Phasen 1–7 dokumentiert, Branch `buchungs-seite` ist als abgeschlossen gekennzeichnet, und die Navigationskette läuft von Branch 001 bis Branch 006 ohne Bruch durch. Die zwei kleinen Korrektur-Commits, die unmittelbar danach folgen (`defcf50` und `227ad78`), waren zu diesem Zeitpunkt noch nicht gemacht – sie werden erst in diesem Tagebuch-Update hier nachgetragen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](011_2026-09-04_clear-sensitive-keys-in-env-example.md)
