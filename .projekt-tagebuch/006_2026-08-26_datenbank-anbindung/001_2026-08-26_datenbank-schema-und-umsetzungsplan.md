[← Vorheriger Commit](../005_2026-07-22_buchungs-seite/009_2026-08-26_projekttagebuch-aktualisiert.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# Add database schema and implementation plan for hotel application

- **Commit:** `49ec754`
- **Datum:** 2026-08-26
- **Autor:** Oliver Jung

## Worum geht es?

Der erste Commit des Branches enthält **keine einzige Zeile SQL** – und das ist die wichtigste Beobachtung an ihm. Er legt vier Dokumente unter `docs/datenbank/` an, insgesamt gut 2 000 Zeilen:

```text
 docs/datenbank/README.md              | 751 ++++++++++++++++++++++++++++++++++
 docs/datenbank/schema-uebersicht.html | 603 +++++++++++++++++++++++++++
 docs/datenbank/schema.md              | 465 +++++++++++++++++++++
 docs/datenbank/umsetzungsplan.md      | 239 +++++++++++
 4 files changed, 2058 insertions(+)
```

Bisher hatte die Anwendung genau **eine** Tabelle in Supabase: `posts`, aus einem Tutorial übernommen. Jetzt soll ein echtes Hotel-Buchungssystem entstehen – mit Zimmerkategorien, Saisonpreisen, Verfügbarkeiten und Buchungen. Und statt sofort `create table` zu tippen, wird zuerst **entschieden und begründet**.

Für Lernende ist das der eigentliche Inhalt dieses Commits: **Datenmodellierung ist eine Kette von Trade-offs, nicht eine Liste von Tabellen.**

## Die vier Dokumente und ihre Rollen

Die Aufteilung ist nicht willkürlich; jedes Dokument beantwortet genau eine Frage:

| Datei                    | Frage                       | Normativ?                        |
| ------------------------ | --------------------------- | -------------------------------- |
| `README.md`              | **Warum** sieht es so aus?  | nein – Begründungen und Verlauf  |
| `schema.md`              | **Was** wird gebaut?        | **ja – Quelle der Wahrheit**     |
| `umsetzungsplan.md`      | **Wie** wird es gebaut?     | nein – Phasen und Reihenfolge    |
| `schema-uebersicht.html` | Visualisierung für den Call | nein – Ableitung aus `schema.md` |

Die Regel dahinter steht im Kopf von `schema.md`:

```markdown
> **Dies ist das normative Dokument.** Artifact-Seite und FigJam-Board sind **Ableitungen** (E9).
> Geändert wird immer erst hier.
```

Das ist ein Muster, das weit über dieses Projekt hinaus trägt: Sobald es mehrere Darstellungen derselben Sache gibt (ein Diagramm, eine HTML-Seite, ein Whiteboard), muss **eine** davon die Quelle sein. Sonst widersprechen sie sich nach der dritten Änderung, und niemand weiß, welche stimmt.

## 1. `README.md` – das Entscheidungsprotokoll

Das umfangreichste Dokument enthält keine Tabellen, sondern **31 numerierte Entscheidungen** (`E1` bis `E31`), jede mit Begründung und – besonders wichtig – mit den **verworfenen Alternativen**.

Die Methode wird im Dokument selbst beschrieben:

```markdown
## 1. Methode

Das Schema wird nicht "hingeschrieben", sondern als **Entscheidungsbaum** erarbeitet.
Jede Entscheidung hängt an Vorentscheidungen. Gearbeitet wird in **Runden**: pro Runde
werden nur die Fragen gestellt, deren Voraussetzungen bereits geklärt sind. Fragen, deren
Antwort von einer noch offenen Frage abhängt, kommen bewusst **später** — sonst rät man.
```

Der Ausgangspunkt für alles Folgende ist eine Feststellung über den Ist-Zustand des Projekts:

```markdown
**Konsequenz für die Modellierung:** Es gibt **kein Backend**. Jede Geschäftsregel, die
verlässlich gelten muss, muss deshalb in der Datenbank liegen — nicht im TypeScript-Code,
den jeder Client umgehen kann.
```

Das ist der rote Faden des ganzen Branches. Die Anwendung ist eine SPA, die **direkt** mit Supabase spricht. Es gibt keinen Server dazwischen, der eine Regel durchsetzen könnte. Wer im Browser die Entwicklerkonsole öffnet, kann jeden Aufruf nachbauen – also ist jede Prüfung im TypeScript-Code nur eine Bitte, keine Regel.

### Die Leitsätze

Am Ende des Dokuments stehen sieben Sätze, die man sich als Lernender merken kann:

```markdown
1. **Die Datenbank ist die letzte Verteidigungslinie.** Ohne Backend gilt: was der Client
   prüfen könnte, ist keine Regel — nur eine Bitte. (E6)
2. **Erweiterbar ≠ alle Achsen offen.** Erweiterbarkeit heißt "die spätere Änderung ist eine
   mechanische Migration", nicht "jede Möglichkeit ist heute schon eingebaut". (E2, E5)
3. **Eine Buchung ist ein Vertrag.** Ihre Fakten (Preis, Zeitraum, Kategorie) werden
   festgeschrieben, nicht neu berechnet. (E5)
4. **Fremde Systeme nicht in die Domäne verdrahten.** `auth.users` gehört Supabase. (E4)
5. **Modelliere die Domäne, nicht die einfachste Implementierung** — und benenne den Preis
   dafür sofort und laut. (E3)
6. **Schema als Code, oder es existiert nicht überprüfbar.** (E7)
7. **Korrektheit by construction schlägt Korrektheit by Aufmerksamkeit.** Halb-offene
   Intervalle, Cent-Integers, Constraints statt Konventionen. (E8)
```

Besonders Satz 7 wird in den folgenden Commits immer wieder auftauchen. „By construction" heißt: Ein Fehler ist nicht _verboten_, sondern **unmöglich** – weil die Datenbank ihn ablehnt, nicht weil in der Doku steht, dass man es nicht tun soll.

### Ein Beispiel für eine Entscheidung samt Preis

Die vielleicht folgenreichste Entscheidung ist `E3`:

```markdown
### E3 — Gebucht wird die **Kategorie**, nicht das Zimmer
```

Ein Gast bucht „Double Suite", nicht „Zimmer 203". Das entspricht der Realität in Hotels – die Zimmerzuweisung passiert erst beim Check-in. Aber es macht die Verfügbarkeitsrechnung deutlich schwieriger: Man kann nicht einfach prüfen, ob _ein_ Zimmer frei ist, sondern muss **zählen**, wie viele Zimmer der Kategorie in jeder einzelnen Nacht noch frei sind. Genau daraus entsteht später der Überbuchungsschutz mit einem Advisory-Lock (`E10`).

Das Dokument benennt diesen Preis ausdrücklich, statt ihn zu verschweigen. Auch das ist eine übertragbare Gewohnheit: **Eine Entscheidung ohne benannten Nachteil ist meist keine Entscheidung, sondern eine Annahme.**

## 2. `schema.md` – das normative Schema

Hier steht, was gebaut wird. Zuerst ein ERD als Mermaid-Diagramm, das direkt in GitHub gerendert wird:

```text
erDiagram
    HOTELS ||--o{ ROOM_TYPES : "hat"
    HOTELS ||--o{ ROOMS : "hat"
    HOTELS ||--o{ RATE_PLANS : "hat"

    ROOM_TYPES ||--o{ ROOMS : "gruppiert"
    ROOM_TYPES ||--o{ ROOM_TYPE_RATES : "kostet"
    RATE_PLANS ||--o{ ROOM_TYPE_RATES : "bepreist"

    ROOMS ||--o{ ROOM_BLOCKS : "gesperrt durch"
    ROOMS ||--o{ BOOKINGS : "zugewiesen zu"

    ROOM_TYPES ||--o{ BOOKINGS : "verkauft als"
    CUSTOMERS ||--o{ BOOKINGS : "bucht"
    BOOKING_GROUPS ||--o{ BOOKINGS : "fasst zusammen"

    BOOKINGS ||--|{ BOOKING_NIGHTS : "eingefroren pro Nacht"
    BOOKINGS ||--o{ BOOKING_EVENTS : "Historie"

    AUTH_USERS |o--o| CUSTOMERS : "Konto (optional, spaeter)"
```

Zwölf Tabellen, und jede hat einen Grund. Bemerkenswert sind die Kommentare direkt im Diagramm – sie verweisen auf die Entscheidung, aus der die jeweilige Spalte stammt:

```text
    ROOM_TYPES {
        uuid id PK
        uuid hotel_id FK
        text name
        text slug UK
        int max_occupancy "E15 - ohne das ist die Suche falsch"
        timestamptz archived_at "E22 - nie loeschen"
    }
```

Danach folgen die Tabellen im Detail, jede als Spaltentabelle mit Regeln. Und ganz oben die Konventionen, die für **alle** Tabellen gelten:

```markdown
Konventionen durchgehend (E8): englisch/`snake_case`/Plural, `uuid`-PK per
`gen_random_uuid()`, Geld als `integer` Cent, Zeiträume **halb-offen** `[von, bis)`,
`created_at`/`updated_at` als `timestamptz`.
```

Drei dieser Konventionen sind für Lernende besonders lohnend:

**Geld als `integer` Cent.** Nie `float`, nie `real`. Fließkommazahlen können `0,1` nicht exakt darstellen; nach ein paar Additionen stimmt die Summe um Cents nicht mehr. `24000` Cent statt `240.00` Euro löst das Problem, indem es gar nicht entsteht.

**Halb-offene Zeiträume `[von, bis)`.** Der Anfangstag gehört dazu, der Endtag nicht. Reist Gast A am 12. ab und Gast B am 12. an, ist das **keine** Kollision – der 12. ist für A keine gebuchte Nacht mehr. Mit geschlossenen Intervallen `[von, bis]` würde man nie eine Anschlussnacht verkaufen; ein Fehler, der niemals eine Fehlermeldung erzeugt, sondern nur Umsatz kostet.

**`uuid` statt fortlaufender Zahlen.** Eine Buchungs-ID `1043` verrät, wie viele Buchungen es gibt, und lädt dazu ein, `1044` auszuprobieren.

## 3. `umsetzungsplan.md` – die Phasen

Das dritte Dokument ist an eine **spätere Session** adressiert – an jemanden, der die Diskussion nicht miterlebt hat:

```markdown
> **Zweck:** Diese Datei ist so geschrieben, dass die Umsetzung in einer **späteren Session**
> aufgesetzt werden kann, ohne die Grilling-Unterhaltung wiederholen zu müssen.
>
> **Regel für die Umsetzung:** `schema.md` ist die Quelle der Wahrheit. Weicht der Plan davon
> ab, gilt `schema.md` — oder es wird zuerst dort geändert (und in `README.md` begründet).
```

Der Plan teilt die Arbeit in zehn Phasen. Entscheidend ist, dass jede Phase ein **überprüfbares Abschlusskriterium** hat – nicht „Preise sind fertig", sondern ein konkreter Test:

```markdown
## Phase 3 — Preise (E5, E8, E25)

1. `rate_plans` + Seed-Zeile `STANDARD`
2. `room_type_rates` inkl. `daterange`-Generierung und `EXCLUDE`-Constraint
3. `find_rate_gaps(tage int)`
4. Seed: Saisonpreise für die nächsten 12 Monate

**Fertig, wenn:** zwei überlappende Preiszeiträume für dieselbe Kategorie und denselben
Rate-Plan abgelehnt werden **und** `find_rate_gaps(365)` eine absichtlich gerissene Lücke
findet.
```

Und in Phase 4 steht der wichtigste Satz des ganzen Plans:

```markdown
**Fertig, wenn:** … und eine Buchung mit Abreise = Anreise der nächsten **akzeptiert** wird
(das ist der halb-offene Test aus E8/E29 — er ist der wichtigste in diesem Satz).
```

Ein Abschlusskriterium, bei dem der **Fehler das erwartete Ergebnis** ist, oder bei dem ein scheinbarer Konflikt akzeptiert werden muss – das ist eine ganz andere Qualität als „läuft durch".

## 4. `schema-uebersicht.html` – die Visualisierung

Die vierte Datei ist eine eigenständige HTML-Seite mit dem Schema in grafischer Form, gedacht als Grundlage für die Präsentation im Kurs. Sie ist ausdrücklich **nicht normativ**: Wenn sich das Schema ändert, wird zuerst `schema.md` geändert und die HTML-Seite danach nachgezogen.

## Was wurde erreicht?

Nach diesem Commit existiert das komplette Datenmodell – **auf Papier**. Zwölf Tabellen, sechs Datenbankfunktionen, ein RLS-Konzept und ein Umsetzungsplan in zehn Phasen, jede Entscheidung begründet und jede verworfene Alternative benannt.

Die naheliegende Frage lautet: Ist das nicht zu viel Vorarbeit für ein Kursprojekt? Zwei Antworten darauf:

1. **Migrationen sind unveränderlich, sobald sie geteilt sind.** Anders als eine TypeScript-Datei kann man eine ausgelieferte Migration nicht einfach umschreiben – man kann nur eine neue hinterherschieben. Ein Denkfehler in der Tabellenstruktur ist damit deutlich teurer als ein Denkfehler in einer View.
2. **Die Begründungen sind später nicht rekonstruierbar.** Warum `room_id` auf `bookings` nullable ist, lässt sich aus der Migration ablesen. Warum es die _richtige_ Entscheidung war und welche Alternative verworfen wurde, nicht.

Genau diese zweite Beobachtung wird im nächsten Commit noch einmal als Vorgehensentscheidung `V7` festgehalten: Dokumentation wird **vor** der ersten Migration fortgeschrieben, nicht danach.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](002_2026-09-02_runde-6-und-vorgehensentscheidungen.md)
