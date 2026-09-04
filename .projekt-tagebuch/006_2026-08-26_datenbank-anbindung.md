[← Vorheriger Branch](005_2026-07-22_buchungs-seite.md) · [📓 Index](000_index.md)

# 006 – Branch `datenbank-anbindung`

**Erster Commit:** 2026-08-26 · **Commits:** 9 · **Status:** offen

## Ziel des Branches

Der Branch `buchungs-seite` endete mit einem interaktiven Kalender – und einem `TODO`: Die gewählten Daten gingen nirgendwohin. Dieser Branch baut das, was darunter fehlt: **die Datenbank**.

Bis hierher hatte die Anwendung genau eine Tabelle (`posts`, aus einem Tutorial) in einer Supabase-Instanz in der Cloud, deren Struktur nur dort existierte. Danach gilt: Das komplette Schema ist Code im Repository, lokal reproduzierbar und durch Tests abgesichert.

Der Branch ist ungewöhnlich aufgebaut. Die ersten **zwei** Commits enthalten keine Zeile SQL, sondern ausschließlich Dokumentation:

- **Entscheidungsprotokoll** (`docs/datenbank/README.md`) mit 41 begründeten Entscheidungen `E1`–`E41`, jeweils samt verworfenen Alternativen.
- **Normatives Schema** (`docs/datenbank/schema.md`) mit ERD und Tabellendefinitionen – die Quelle der Wahrheit.
- **Umsetzungsplan** (`docs/datenbank/umsetzungsplan.md`) mit Phasen und überprüfbaren Abschlusskriterien.

Erst danach entsteht Code, und zwar streng nach dem Plan: **eine Phase, ein Commit** (`V6`).

Inhaltlich umfasst der Branch:

- **Supabase-CLI und Migrationen** – Schema als Code, `pnpm db:reset` baut alles neu auf (`E7`).
- **Umgebungstrennung** – `.env` verlässt Git, der Service-Role-Key bekommt bewusst **kein** `VITE_`-Präfix (`E35`).
- **Zwei getrennte Testläufe** – `pnpm test` ohne Docker, `pnpm test:db` gegen die lokale Instanz (`E34`).
- **Row Level Security ab der ersten Tabelle**, nicht nachträglich (`V3`) – jede Tabelle bekommt ihre Policies in derselben Migration.
- **Stammdaten**: Hotel, Zimmerkategorien, Zimmer, Bilder, Zimmersperrungen.
- **Saisonpreise** mit Exclusion-Constraint: zwei widersprechende Preise für dieselbe Nacht sind _unmöglich_, nicht bloß verboten.
- **Buchungen** als Verträge: eingefrorener Preis **pro Nacht**, unveränderliche Änderungshistorie, halb-offene Zeiträume durchgehend.
- **Verfügbarkeitsrechnung** in drei geschichteten Funktionen – roher Kern, maskierte Sichten.
- **`create_booking`** als einzige Vertrauensgrenze: hotelweiter Advisory-Lock gegen Überbuchung, strukturierte Ablehnung mit Code und Datum.
- **`rls_audit`** als Dauerprüfung der Zugriffskontrolle: keine Zeilen = bestanden.

Am Ende: **91 grüne Tests**, davon sechs, die laut `E34` genau deshalb ausgewählt wurden, weil die geprüfte Eigenschaft sonst _lautlos ausfällt_.

## Commits

| Nr.                                                                                                   | Datum      | Beschreibung                                                                                |
| ----------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| [001](006_2026-08-26_datenbank-anbindung/001_2026-08-26_datenbank-schema-und-umsetzungsplan.md)       | 2026-08-26 | Schema, Entscheidungsprotokoll und Umsetzungsplan – 2 000 Zeilen Doku, kein SQL             |
| [002](006_2026-08-26_datenbank-anbindung/002_2026-09-02_runde-6-und-vorgehensentscheidungen.md)       | 2026-09-02 | Runde 6 (`E32`–`E36`) und Vorgehensentscheidungen `V1`–`V7` (reiner Doku-Commit)            |
| [003](006_2026-08-26_datenbank-anbindung/003_2026-09-02_phase-1-cli-umgebungstrennung-testgeruest.md) | 2026-09-02 | Phase 1: Supabase-CLI, `.env` aus Git, zwei Testläufe, zwei Clients                         |
| [004](006_2026-08-26_datenbank-anbindung/004_2026-09-02_phase-2-stammdaten-rls-seed.md)               | 2026-09-02 | Phase 2: Stammdaten, RLS ab Tag 1, Storage-Bucket, Minimalseed, erster Exclusion-Constraint |
| [005](006_2026-08-26_datenbank-anbindung/005_2026-09-02_phase-3-saisonpreise-und-preisluecken.md)     | 2026-09-02 | Phase 3: Saisonpreise, Überlappungsschutz und `find_rate_gaps` (Gaps and Islands)           |
| [006](006_2026-08-26_datenbank-anbindung/006_2026-09-02_phase-4-kunden-buchungen-naechte-historie.md) | 2026-09-02 | Phase 4: Kunden, Buchungen, eingefrorene Nächte und append-only Historie                    |
| [007](006_2026-08-26_datenbank-anbindung/007_2026-09-02_phase-5-verfuegbarkeit.md)                    | 2026-09-02 | Phase 5: Verfügbarkeit pro Nacht und pro Kategorie, Maskierung auch der Zahlen              |
| [008](006_2026-08-26_datenbank-anbindung/008_2026-09-02_phase-6-create-booking.md)                    | 2026-09-02 | Phase 6: `create_booking` mit Advisory-Lock, Preiseinfrierung und strukturierter Ablehnung  |
| [009](006_2026-08-26_datenbank-anbindung/009_2026-09-02_phase-7-rls-abnahme.md)                       | 2026-09-02 | Phase 7: `rls_audit` als Dauerprüfung, Runde 7 (`E37`–`E41`), Doku nachgeführt              |

## Zusammenfassung

Dieser Branch ist der erste im Projekt, in dem die eigentliche Arbeit nicht im Frontend passiert – und er unterscheidet sich auch in der Arbeitsweise deutlich von den vorherigen.

**Zwei Doku-Commits vor der ersten Zeile Code.** Commit 001 legt 2 000 Zeilen Dokumentation an: ein Entscheidungsprotokoll mit 31 begründeten Entscheidungen, ein normatives Schema und einen Umsetzungsplan. Commit 002 ergänzt fünf weitere Entscheidungen (`E32`–`E36`), die beim Durchgehen des Plans als Lücken auffielen, und trennt erstmals **Domänenentscheidungen** (`E…`, Fachlichkeit) von **Vorgehensentscheidungen** (`V…`, Arbeitsweise). Die Begründung dafür ist `V7`: _„Migrationen kann man später lesen, Begründungen nicht rekonstruieren."_

Für Lernende ist das die vielleicht wichtigste Beobachtung am ganzen Branch. Bei einer Angular-Komponente kann man anfangen und umbauen. Bei einer Datenbank nicht: Migrationen sind unveränderlich, sobald sie geteilt sind – ab dann wird nur noch vorwärts migriert. Ein Denkfehler in der Tabellenstruktur ist deutlich teurer als einer in einer View.

**Der rote Faden: es gibt kein Backend.** Die Anwendung ist eine SPA, die direkt mit Supabase spricht. Jede Prüfung im TypeScript-Code kann jeder im Browser umgehen. Deshalb liegt in diesem Branch **jede** Geschäftsregel in der Datenbank – als `CHECK`, als `EXCLUDE`, als Policy oder als Funktion. Der Leitsatz aus `README.md` bringt es auf den Punkt: _„Was der Client prüfen könnte, ist keine Regel – nur eine Bitte."_

**Korrektheit „by construction" statt „by Aufmerksamkeit".** Dieser Gedanke (Leitsatz 7) kehrt in jeder Phase wieder, und die Beispiele sind gut übertragbar:

| Problem                                  | Lösung im Branch                                  | Verhindert                                     |
| ---------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Service-Key könnte im Browser landen     | Name ohne `VITE_`-Präfix + Typisierung            | Vite bündelt ihn gar nicht ein                 |
| Zwei Preise für dieselbe Nacht           | `EXCLUDE USING gist`                              | Datenbank lehnt ab, nicht der Code prüft       |
| Anschlussnacht nicht verkäuflich         | halb-offene `daterange` überall                   | Off-by-one, der nie eine Fehlermeldung erzeugt |
| `Anna@…` und `anna@…` als zwei Kunden    | generierte Spalte `email_normalized`              | Suche kann nicht falsch geschrieben werden     |
| Buchungsnummer am Telefon verwechseln    | Alphabet ohne `I`, `O`, `0`, `1`                  | die Zeichen existieren nicht                   |
| Historie nachträglich ändern             | `REVOKE update, delete` – auch für `service_role` | RLS allein hätte den Service-Key nicht erfasst |
| Zwei Gäste kaufen dasselbe letzte Zimmer | `pg_advisory_xact_lock` hotelweit                 | Prüfung und Einfügen werden serialisiert       |

**Eine Regel, eine Stelle.** Drei kleine Funktionen tragen das ganze Schema: `is_staff()` (wer ist Personal?), `is_blocking_status()` (belegt eine Buchung Kapazität?) und `mask_reason()` (welcher Grund darf nach außen?). Alle drei sind trivial – zwei geben eine Zeile zurück. Ihr Wert liegt darin, dass die zugehörige Regel **nirgendwo sonst** steht. Wer Rollen einführt, ändert `is_staff()`, und fünfzehn Policies gelten sofort mit. Dasselbe Muster in Phase 5: `availability_nights()` ist die einzige Stelle, an der Kapazität gerechnet wird – Kalender, Ergebnisliste und Buchung lesen alle daraus.

**Die Tests sind der eigentliche Inhalt der zweiten Hälfte.** Und das Auswahlkriterium aus `E34` ist übertragbar auf jedes Projekt: nicht „was ist wichtig?", sondern **„was fällt lautlos aus?"** Ein fehlendes Constraint meldet sich nie. Es wird irgendwann doppelt gebucht. Konsequent geprüft wird deshalb immer in Paaren – der verbotene Fall _und_ die Gegenprobe:

- Überlappende Sperrung wird abgelehnt – **und** dieselbe Überlappung im anderen Zimmer geht durch.
- Stornierte Buchung blockiert nicht – **und** eine `no_show`-Buchung blockiert doch.
- `find_rate_gaps` findet eine gerissene Lücke – **und** meldet für den vollständigen Seed nichts.
- Der eingefrorene Preis bleibt nach der Preisänderung gleich – **und** eine neue Buchung kostet das Doppelte.
- Der Gast sieht keine Buchungen – **und** er sieht die öffentlichen Stammdaten weiterhin.

Ein Test ohne Gegenprobe kann nicht zwischen „funktioniert richtig" und „lehnt alles ab" unterscheiden.

**Der lehrreichste Moment steckt in Commit 008.** Der Umsetzungsplan verlangte einen Nebenläufigkeitstest mit zwei gleichzeitigen Buchungen. Beim Gegenprüfen – Advisory-Lock probeweise entfernt – blieb dieser Test **grün**: Zwei HTTP-Anfragen überschneiden sich nicht zuverlässig genug. Erst sechs gleichzeitige Anfragen auf drei Zimmer fingen die Lücke; ohne Lock gingen dort alle sechs durch. Der schwache Test bleibt trotzdem stehen – mit einem ausdrücklichen Vermerk, dass er nicht die Absicherung ist. Die Begründung in `E39`: _„Ein Test, der eine Entscheidung belegen soll, es aber nicht tut, ist schlimmer als kein Test – er täuscht Sicherheit vor."_

**Und der Branch ist ehrlich über seine Lücken.** Die letzte Phase hält in `E37`–`E41` fest, was erst beim Bauen sichtbar wurde: dass `E28` eine Lücke hatte (die Zahl verrät den maskierten Grund), dass ein `is_staff()`-Wachposten in v1 auch den Service-Role-Key abgewiesen hätte, und dass der Staff-Zweig der Maskierung derzeit **toter Code** ist – ungetestet, mit benanntem Lösungsweg. Das ist etwas anderes als verschwiegene technische Schuld: Eine benannte Lücke mit Ausweg kostet drei Zeilen und spart der nächsten Person eine Stunde.

Der Branch ist derzeit **noch nicht in `main` gemergt**. Die Phasen 8–10 sind bewusst vertagt (`V1`): TypeScript-Typen und Service-Schicht, der Anschluss der Kalender-UI aus Branch `buchungs-seite` an `availability_calendar` und `create_booking`, und schließlich das Cloud-Deployment. Damit schließt sich der Bogen: Dort entstand ein Kalender mit einem `TODO`, hier das Backend, das es erfüllen kann.

---

[← Vorheriger Branch](005_2026-07-22_buchungs-seite.md) · [📓 Index](000_index.md)
