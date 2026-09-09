[← Vorheriger Commit](010_2026-09-04_update-project-diary.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# fix(env): clear sensitive keys in .env.example for security

- **Commit:** `defcf50`
- **Datum:** 2026-09-04
- **Autor:** Oliver Jung

## Worum geht es?

Der kleinste Commit des gesamten Branches: **zwei geänderte Zeilen in einer Datei**. Und trotzdem einer, der eine Regel enthält, die für jedes Projekt mit einer `.env` gilt.

```text
 .env.example | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

In Phase 1 (`cdb1af7`) war `.env.example` als Vorlage entstanden – mit **ausgefüllten** Beispielwerten, damit `cp .env.example .env && pnpm db:start && pnpm dev` sofort läuft. Dieser Commit leert die beiden Key-Zeilen wieder.

## Die Änderung im Detail

### `.env.example`

```diff
 # Einrichten:  cp .env.example .env && pnpm db:start && pnpm dev
 VITE_SUPABASE_URL=http://127.0.0.1:54321
-VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
+VITE_SUPABASE_PUBLISHABLE_KEY=

 # Nur fuer `pnpm test:db` und Seeds. BEWUSST OHNE `VITE_`-PRAEFIX:
 # Vite buendelt jede VITE_-Variable in den Browser, und dieser Key umgeht RLS
 # vollstaendig. Er gehoert nach `.env` (gitignored), niemals ins Frontend.
-SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
+SUPABASE_SERVICE_ROLE_KEY=
```

Die Namen der Variablen, die Kommentare und die URL bleiben stehen. Nur die **Werte** verschwinden.

## Warum das wichtig ist – und warum es hier eigentlich harmlos war

Beide Punkte gehören zusammen, sonst lernt man die falsche Hälfte.

### Der harmlose Teil

Die Kommentarzeilen oben in der Datei sagen es selbst:

```text
# Diese Werte sind KEINE Geheimnisse: `supabase start` erzeugt aus einem festen
# JWT-Secret auf jeder Maschine dieselben lokalen Demo-Keys. Der Schutz ist RLS
# (E13), nicht die Verborgenheit des Keys.
```

Das stimmt: Eine **lokale** Supabase-Instanz signiert ihre Keys mit einem festen, öffentlich dokumentierten Secret. Der gelöschte `sb_secret_…`-Wert öffnete niemandem etwas – er gilt nur auf `127.0.0.1:54321`, also auf dem eigenen Rechner. Es ist **kein** Sicherheitsvorfall, und das Repository musste nicht umgeschrieben werden.

### Der Teil, der zählt

Trotzdem ist der Commit richtig, und zwar aus einem Grund, der nichts mit diesem konkreten Key zu tun hat: **eine Vorlage lehrt eine Gewohnheit.**

Eine Datei namens `.env.example`, in der ein Wert namens `SUPABASE_SERVICE_ROLE_KEY` einen echt aussehenden Wert hat, sagt der nächsten Person: „Hier gehören Keys hinein." Und die nächste Person arbeitet vielleicht schon gegen die Cloud-Instanz (Phase 10 war zu diesem Zeitpunkt vertagt, nicht gestrichen). Dann ist der Wert an derselben Stelle in derselben Datei kein Demo-Key mehr – aber die Datei ist weiterhin **nicht** in `.gitignore`, denn `.env.example` soll ja eingecheckt werden.

Das ist die eigentliche Fehlerklasse, und sie hat einen Namen: eine Datei mit zwei Zuständigkeiten. Zusammengefasst:

| Datei          | Zweck                                | In Git?             | Enthält Werte?              |
| -------------- | ------------------------------------ | ------------------- | --------------------------- |
| `.env.example` | **Struktur** – welche Namen gibt es? | ja, absichtlich     | nein, nur leere Zuweisungen |
| `.env`         | **Werte** – wie lauten sie hier?     | nein (`.gitignore`) | ja                          |

Wer diese Trennung einhält, kann in `.env.example` nie versehentlich ein Geheimnis veröffentlichen – weil dort grundsätzlich keine Werte stehen. Das ist dieselbe Denkweise, die den ganzen Branch prägt (Leitsatz 7 aus `docs/datenbank/README.md`): **Korrektheit „by construction" statt „by Aufmerksamkeit".** Nicht „aufpassen, dass in `.env.example` nur harmlose Keys stehen", sondern „in `.env.example` stehen gar keine Keys".

### Der bewusst benannte Preis

Die Vorlage wird durch diese Änderung **weniger bequem**. Vorher genügte `cp .env.example .env`, jetzt braucht es einen Schritt mehr: `pnpm db:start` ausführen und die von der CLI ausgegebenen Keys eintragen.

```bash
pnpm db:start
# Die CLI gibt am Ende u.a. aus:
#   API URL: http://127.0.0.1:54321
#   publishable key: sb_publishable_...
#   secret key: sb_secret_...
cp .env.example .env
# und die beiden Keys aus der Ausgabe eintragen
```

Ob das der Mühe wert ist, ist eine echte Abwägung. Hier fällt sie zugunsten der Sicherheit aus – der Aufwand entsteht **einmal pro Entwicklungsrechner**, die Gefahr besteht **bei jedem Commit**.

## Ein Blick auf das Zusammenspiel mit `E35`

Der Kommentar über dem zweiten Key ist stehen geblieben, und er erklärt die Entscheidung `E35` aus dem Entscheidungsprotokoll:

```text
# Nur fuer `pnpm test:db` und Seeds. BEWUSST OHNE `VITE_`-PRAEFIX:
# Vite buendelt jede VITE_-Variable in den Browser, und dieser Key umgeht RLS
# vollstaendig.
```

Hier greifen zwei Schutzmechanismen ineinander, und man sollte sie nicht verwechseln:

1. **Der Name ohne `VITE_`** verhindert, dass Vite den Key überhaupt in das Browser-Bundle packt. Das ist der Schutz „by construction" – auch ein `import.meta.env.SUPABASE_SERVICE_ROLE_KEY` im Frontend-Code wäre schlicht `undefined`.
2. **Der leere Wert in der Vorlage** verhindert, dass ein echter Key jemals in ein eingechecktes Dateiformat gerät.

Der erste schützt die Anwendung, der zweite das Repository. Beide braucht man.

## Was wurde erreicht?

`.env.example` beschreibt ab jetzt nur noch die **Struktur** der Konfiguration, nicht ihre Werte. Damit kann kein Key mehr über diese Datei ins Repository geraten – unabhängig davon, ob er lokal oder aus der Cloud stammt.

Was der Commit **nicht** löst: Der alte Wert steht weiterhin in der Git-Historie (in `cdb1af7`). Ein `git show cdb1af7 -- .env.example` zeigt ihn. Bei einem echten Geheimnis wäre das Löschen im Arbeitsstand also nur der erste Schritt – der Key müsste beim Anbieter **widerrufen** werden, weil man ihn aus einer geteilten Historie nicht mehr zurückholen kann. Hier ist es unproblematisch, weil der Wert lokal und auf jeder Maschine derselbe ist.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](012_2026-09-06_add-envdir-configuration-to-vite.md)
