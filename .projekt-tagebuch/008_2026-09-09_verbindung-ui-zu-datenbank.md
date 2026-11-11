[← Vorheriger Branch](007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](000_index.md)

# 008 – Branch `verbindung-ui-zu-datenbank`

**Erster Commit:** 2026-09-09 · **Commits:** 42 · **Status:** gemergt in `main` (PR #5, 2026-11-04)

## Ziel des Branches

Der Branch löst die Vertagung aus `V1` auf. Nach `datenbank-anbindung` (Datenbank fertig, Phasen 1–7) und `buchungsseite-ui-fertigstellen` (Oberfläche gebaut, teils angebunden) steht jetzt die Aufgabe an, die dem Branch ihren Namen gibt: **die Buchungsseite vollständig mit der Datenbank verbinden.**

Vollständig heißt hier mehr, als der ursprüngliche Plan vorsah. Beim Erheben des Ist-Standes kamen zehn Lücken zusammen – und drei davon konnte man nicht durch Programmieren schließen, weil ihnen im Schema das Ziel fehlte. Ein Rechnungsadress-Formular ohne Adressspalten in der Datenbank ist keine Aufgabe für das Frontend.

Deshalb beginnt der Branch **wieder** mit einem reinen Doku-Commit – so wie `datenbank-anbindung` mit zwei begonnen hat. Fünf Fragerunden, 30 Fragen, fünf neue Domänenentscheidungen (`E42`–`E46`), zehn neue Vorgehensentscheidungen (`V8`–`V17`) und ein Plan aus vier Phasen und fünf Commits.

Was der Branch nach diesem Plan bauen wird:

| Phase  | Inhalt                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| **7b** | Tabelle `billing_addresses` samt RLS; `create_booking` neu mit Positionen und Rechnungsadresse                      |
| **8**  | `pnpm db:types`, Service-Schicht (`availability`, `booking`, `roomTypes`), `bookingState` als vollständiger Entwurf |
| **9**  | Kalender aus `availability_calendar`, Wählbarkeitsregeln, Horizont-Kappung                                          |
| **9b** | Mengenwähler je Zimmerkarte, echter Checkout, `create_booking`-Aufruf, Bestätigungs-Popup                           |

Vertagt bleibt allein Phase 10 (Cloud-Deployment).

## Commits

| Nr.                                                                                                                | Datum      | Beschreibung                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------- |
| [001](008_2026-09-09_verbindung-ui-zu-datenbank/001_2026-09-09_umsetzungsplan-erstellt.md)                         | 2026-09-09 | Grilling-Runde 8: `E42`–`E46`, `V8`–`V17`, Phasen 7b/8/9/9b (reiner Doku-Commit)        |
| [002](008_2026-09-09_verbindung-ui-zu-datenbank/002_2026-09-09_projekttagebuch-aktualisiert.md)                    | 2026-09-09 | Projekttagebuch für die Branches 006–008 nachziehen (reiner Doku-Commit)                |
| [003](008_2026-09-09_verbindung-ui-zu-datenbank/003_2026-09-16_update-comments-for-database-integration.md)        | 2026-09-16 | TODO-Block als Arbeitsliste für die Anbindung in `Booking.ts`                           |
| [004](008_2026-09-09_verbindung-ui-zu-datenbank/004_2026-09-16_mengenwaehler-je-zimmerkategorie.md)                | 2026-09-16 | Mengenwähler je Kategorie, Mengen in `bookingState`, Regeln in `roomQuantity.ts`        |
| [005](008_2026-09-09_verbindung-ui-zu-datenbank/005_2026-09-16_belegung-verpflichtend-kein-suchdefault.md)         | 2026-09-16 | Keine geratene Belegung mehr: ohne Erwachsenenzahl keine Suche                          |
| [006](008_2026-09-09_verbindung-ui-zu-datenbank/006_2026-09-16_zimmer-anzahl-und-fruehstueck-integriert.md)        | 2026-09-16 | `E47`: Frühstück als eigener Posten – `services`, `booking_extras`, `grand_total_cents` |
| [007](008_2026-09-09_verbindung-ui-zu-datenbank/007_2026-09-23_belegung-als-gesamtzahl-mehrere-kategorien.md)      | 2026-09-23 | `E48` revidiert `E45`: Belegung als Gesamtzahl, `p_positions`, `group_capacity()`       |
| [008](008_2026-09-09_verbindung-ui-zu-datenbank/008_2026-09-23_sektion-zusatzleistungen-je-vorgang.md)             | 2026-09-23 | `E49`: Sektion Zusatzleistungen, `charge_basis`, `p_services`                           |
| [009](008_2026-09-09_verbindung-ui-zu-datenbank/009_2026-09-26_customer-address-management.md)                     | 2026-09-26 | `E50`/`E51`: `customer_addresses`, Sitz- und optionale Rechnungsadresse, Formular       |
| [010](008_2026-09-09_verbindung-ui-zu-datenbank/010_2026-09-26_enhance-address-form-validation.md)                 | 2026-09-26 | Graue Platzhalter, neue Beispielwerte, Fokus ins erste fehlerhafte Feld                 |
| [011](008_2026-09-09_verbindung-ui-zu-datenbank/011_2026-09-26_booking-summary-dynamic-pricing.md)                 | 2026-09-26 | „Ihre Buchung" ohne Attrappe: `summary.ts`, Hoteldaten, Entfernen-Kreuz                 |
| [012](008_2026-09-09_verbindung-ui-zu-datenbank/012_2026-09-26_booking-creation-modal-confirmation.md)             | 2026-09-26 | `create_booking` aus der Oberfläche, `booking.service.ts`, `<dialog>`-Bestätigung       |
| [013](008_2026-09-09_verbindung-ui-zu-datenbank/013_2026-09-26_project-diary.md)                                   | 2026-09-26 | Projekttagebuch für die Commits 002–012 nachziehen (reiner Doku-Commit)                 |
| [014](008_2026-09-09_verbindung-ui-zu-datenbank/014_2026-09-26_booking-steps-management.md)                        | 2026-09-26 | Buchungsschritte im Sticky-Header: Status aus der View, Sprungmarken zu den Bereichen   |
| [015](008_2026-09-09_verbindung-ui-zu-datenbank/015_2026-09-26_update-project-diary.md)                            | 2026-09-26 | Projekttagebuch um die Einträge 013–014 ergänzt (reiner Doku-Commit)                    |
| [016](008_2026-09-09_verbindung-ui-zu-datenbank/016_2026-09-30_review-document.md)                                 | 2026-09-30 | Review-Dokument mit den Gruppen A–F als Fahrplan für die Aufräumarbeiten                |
| [017](008_2026-09-09_verbindung-ui-zu-datenbank/017_2026-09-30_booking-error-handling-ui-flow.md)                  | 2026-09-30 | A1/A2: „weiter" bucht nicht mehr, `BookingFailedError` mit `outcomeUnknown`             |
| [018](008_2026-09-09_verbindung-ui-zu-datenbank/018_2026-10-07_escape-html-xss-protection.md)                      | 2026-10-07 | A3: `escapeHtml()` für alle Werte von außen, Content-Security-Policy                    |
| [019](008_2026-09-09_verbindung-ui-zu-datenbank/019_2026-10-07_booking-logic-cleanup-service-reconciliation.md)    | 2026-10-07 | A4/A5, B1/B2: späte Antworten verwerfen, Kinderbetten abgleichen, Lint grün             |
| [020](008_2026-09-09_verbindung-ui-zu-datenbank/020_2026-10-07_standardize-variable-names.md)                      | 2026-10-07 | B3: Bezeichner durchgehend englisch, Regel in `CLAUDE.md`                               |
| [021](008_2026-09-09_verbindung-ui-zu-datenbank/021_2026-10-07_constants-breakfast-default-currency.md)            | 2026-10-07 | B4: Konstanten `BREAKFAST` und `DEFAULT_CURRENCY` statt Magic Strings                   |
| [022](008_2026-09-09_verbindung-ui-zu-datenbank/022_2026-10-07_booking-codes-and-types.md)                         | 2026-10-07 | B5–B8, C1–C3: `RejectionCode`-Union, Texttabellen, gemeinsame Buchungstypen             |
| [023](008_2026-09-09_verbindung-ui-zu-datenbank/023_2026-10-07_room-quantity-handling-availability-messages.md)    | 2026-10-07 | C4/C5: Zimmer-frei-Texte sauber benannt, gemeinsamer Schritt-Knopf                      |
| [024](008_2026-09-09_verbindung-ui-zu-datenbank/024_2026-10-07_project-diary-update.md)                            | 2026-10-07 | Projekttagebuch um die Einträge 015–023 ergänzt (reiner Doku-Commit)                    |
| [025](008_2026-09-09_verbindung-ui-zu-datenbank/025_2026-10-14_formatting-functions-calendar-logic.md)             | 2026-10-14 | D1/D2: `shared/format.ts` und `domain/calendar.ts` mit Tests                            |
| [026](008_2026-09-09_verbindung-ui-zu-datenbank/026_2026-10-14_checkout-error-handling-completed-steps.md)         | 2026-10-14 | D3: `domain/validation.ts` – Code statt Textvergleich                                   |
| [027](008_2026-09-09_verbindung-ui-zu-datenbank/027_2026-10-14_catalog-service-booking-state-destroy-hook.md)      | 2026-10-14 | D4–D7: `catalog.service.ts`, Store als Entwurf, `destroy()`                             |
| [028](008_2026-09-09_verbindung-ui-zu-datenbank/028_2026-10-14_update-project-diary.md)                            | 2026-10-14 | Projekttagebuch um die Einträge 024–027 ergänzt (reiner Doku-Commit)                    |
| [029](008_2026-09-09_verbindung-ui-zu-datenbank/029_2026-10-21_move-markup-into-templates.md)                      | 2026-10-21 | D8: Markup aus `Booking.ts` in vier Template-Dateien                                    |
| [030](008_2026-09-09_verbindung-ui-zu-datenbank/030_2026-10-21_tests-addresses-service-store-rules.md)             | 2026-10-21 | E1–E5: Tests für Adressen, Service, Store und Datenbank                                 |
| [031](008_2026-09-09_verbindung-ui-zu-datenbank/031_2026-10-21_posts-spike-migration.md)                           | 2026-10-21 | `E36`: Kurs-Spike `posts` als eigene, letzte Migration                                  |
| [032](008_2026-09-09_verbindung-ui-zu-datenbank/032_2026-10-21_generated-database-types-posts-service.md)          | 2026-10-21 | F1/F2: generierte Typen, `createClient<Database>`, `posts.service.ts`                   |
| [033](008_2026-09-09_verbindung-ui-zu-datenbank/033_2026-10-21_calendar-availability-horizon-night-rules.md)       | 2026-10-21 | F3: Kalender mit `availability_calendar`, Horizont, Nachtregeln                         |
| [034](008_2026-09-09_verbindung-ui-zu-datenbank/034_2026-10-21_selection-bar-below-room-list.md)                   | 2026-10-21 | F4: Auswahlleiste unter Schritt 2 mit Sprung zu den Daten                               |
| [035](008_2026-09-09_verbindung-ui-zu-datenbank/035_2026-10-21_rejections-at-room-card-and-calendar-day.md)        | 2026-10-21 | F5: Ablehnungen an Zimmerkarte und Kalendertag                                          |
| [036](008_2026-09-09_verbindung-ui-zu-datenbank/036_2026-10-21_update-project-diary.md)                            | 2026-10-21 | Projekttagebuch um die Einträge 028–035 ergänzt (reiner Doku-Commit)                    |
| [037](008_2026-09-09_verbindung-ui-zu-datenbank/037_2026-10-28_bring-implementation-plan-up-to-date.md)            | 2026-10-28 | F6: Umsetzungsplan auf den tatsächlichen Stand gebracht                                 |
| [038](008_2026-09-09_verbindung-ui-zu-datenbank/038_2026-10-28_accessibility-form-errors-calendar-live-regions.md) | 2026-10-28 | G1–G4: Fehlerzeilen, eigener „ד-Knopf, Tages-Labels, weniger `aria-live`                |
| [039](008_2026-09-09_verbindung-ui-zu-datenbank/039_2026-11-04_refactor-booking-templates-remove-comments.md)      | 2026-11-04 | Kommentare entfernt, Posts-Views gelöscht (Build-Bruch, behoben in 041)                 |
| [040](008_2026-09-09_verbindung-ui-zu-datenbank/040_2026-11-04_update-project-diary.md)                            | 2026-11-04 | Projekttagebuch um die Einträge 036–039 ergänzt (reiner Doku-Commit)                    |
| [041](008_2026-09-09_verbindung-ui-zu-datenbank/041_2026-11-04_remove-unused-posts-routes.md)                      | 2026-11-04 | Posts-Routen und -Imports aus `main.ts` entfernt – Build wieder grün                    |
| [042](008_2026-09-09_verbindung-ui-zu-datenbank/042_2026-11-04_update-project-diary.md)                            | 2026-11-04 | Projekttagebuch um die Einträge 040–041 ergänzt (reiner Doku-Commit)                    |

Merge-Commits gibt es im Branch selbst nicht – er ist seit seinem Start nicht mit `main` synchronisiert worden. In `main` kam er am 2026-11-04 über **Pull Request #5** (Merge-Commit `9cdecc8`).

## Zusammenfassung

### Der Plan (Commit 001)

Der erste Commit des Branches enthält keine Zeile ausführbaren Code – 469 geänderte Zeilen in drei Markdown-Dateien. Für Lernende ist gerade das der Punkt, an dem sich das Muster dieses Projekts am deutlichsten zeigt.

**Das Muster: erst fragen, dann bauen.** Es ist dasselbe wie in `datenbank-anbindung`, nur diesmal von der anderen Seite. Dort wurde das Schema entworfen, bevor es die Oberfläche gab. Hier wird die Oberfläche befragt, und dabei fallen Widersprüche im Schema auf. Der Commit hält beides fest: die zehn gefundenen Lücken **und** die 30 Fragen, mit denen sie geklärt wurden.

Die Lückentabelle ist deshalb lesenswert, weil sie zeigt, wie viel man findet, wenn man den Ist-Stand systematisch abgeht statt nach Gefühl:

| Lücke                                                                        | Konsequenz                   |
| ---------------------------------------------------------------------------- | ---------------------------- |
| Keine generierten Typen, Client untypisiert                                  | Phase 8                      |
| Keine Service-Schicht – Views rufen `supabase.from`/`.rpc`/`.storage` direkt | Phase 8, `V9`                |
| Kalender kennt `availability_calendar` nicht: `selectable: !isPast`          | Phase 9                      |
| Keine Zimmerauswahl – `room_type_id` landet nirgends                         | war im Plan nicht vorgesehen |
| Checkout ist Figma-Attrappe                                                  | war im Plan nicht vorgesehen |
| `submit()` endet in `console.log`                                            | war im Plan nicht vorgesehen |
| Rechnungsadress-Formular hat **kein Ziel im Schema**                         | neue Tabelle → `E42`         |
| Kalender blättert unbegrenzt vorwärts                                        | `E30`, `V14`                 |
| Gästezahl doppeldeutig: pro Zimmer vs. gesamt                                | `E45`                        |
| Popup verspricht eine Mail, `bookings` kennt kein `pending`                  | `E11` → `E46`                |

**Drei der fünf neuen Domänenentscheidungen korrigieren Annahmen aus den Phasen 1–7.** Der Commit benennt das ausdrücklich als erwartbaren Ertrag und nicht als Makel: _„Erst wer die Maske baut, merkt, welche Felder nirgends hinpassen."_ Das ist eine Aussage über Reihenfolge, nicht über Qualität – und sie ist der Grund, warum man Schemata nicht bis zur Perfektion entwirft, bevor man eine Oberfläche daraufsetzt.

Die inhaltlich weitreichendste Änderung ist `E44`: `create_booking` bekommt statt `p_room_type_id`/`p_rooms` einen Parameter `p_positions jsonb` und kann damit **mehrere Zimmerkategorien in einem Vorgang** buchen. Interessant ist die Begründung, weil sie eine frühere Entscheidung nicht widerlegt, sondern deren **Voraussetzung** entfallen lässt: `E41` hatte Positionen abgelehnt – nicht weil sie unmöglich wären, sondern weil „die Oberfläche sie nicht bedienen kann, also wäre es Ballast (`E15`)". Die Oberfläche kann es jetzt. Damit fällt die Begründung, und der bereits vorbereitete Weg (`booking_groups` + Schleife) wird gegangen.

**Und hier zahlt eine Entscheidung von vor einer Woche zum ersten Mal aus.** `E33` legte den Advisory-Lock in `create_booking` **hotelweit** fest, nicht pro Zimmerkategorie – mit der Begründung, dass Locks pro Kategorie eine garantierte Reihenfolge bräuchten. Mit `E44` wird das konkret: Eine Buchung über zwei Kategorien bräuchte jetzt zwei Locks in fester Reihenfolge, sonst droht eine Verklemmung. Der hotelweite Lock deckt beide Positionen ohne Änderung ab. Genau das ist der Ertrag von Entscheidungen, die man mit Begründung aufschreibt: Man erkennt später, dass sie richtig waren – und warum.

**Zwei Fragen haben eine frühere Antwort derselben Runde umgeworfen** – und der Commit lässt sie sichtbar stehen, mit dem Vermerk „_überholt durch Q26_" bzw. „_ersetzt durch Q27_". Q24 kassierte Q12, Q30 zeigte einen Widerspruch zwischen Q28 und Q9. Der Kommentar dazu ist der Kern der Arbeitsweise: _„Beide Widersprüche wären sonst als Code entstanden und erst beim Debuggen aufgefallen."_ Eine durchgestrichene Antwort in einem Protokoll kostet eine Zeile; derselbe Widerspruch in zwei Migrationen kostet einen Nachmittag.

**Was dieser Branch bewusst auslässt, ist ebenfalls entschieden, nicht vergessen.** `V12` legt fest: **vorerst keine Tests** für die Frontend-Seite. Und zieht die Konsequenz gleich mit: Weil die `E29`-Wählbarkeitsregel und `buildRoomCards()` damit nur über die Oberfläche geprüft sind, werden sie trotzdem als **eigenständige Funktionen** herausgezogen (`V16`) – „es kostet nichts und ist die Voraussetzung dafür, dass die Tests später ohne Umbau nachgezogen werden können". Eine bewusste Lücke mit benanntem Ausweg ist etwas anderes als eine verschwiegene.

Ebenfalls bemerkenswert: Der Plan enthält mehrere **Abschlusskriterien, die als Befehl prüfbar sind** statt als guter Vorsatz. Das schärfste steht in Phase 8:

```bash
grep -rn "from.*services/supabase" src/ --include=*.ts | grep -v "src/shared/services/"
```

Findet dieser Befehl noch etwas, ist die Phase nicht fertig. Der Plan schreibt dazu: _„Diese Zeile ist die Prüfung, nicht der gute Vorsatz."_

### Die Umsetzung (Commits 003–012)

Die Zusammenfassung oben beschreibt den Plan. Die zehn folgenden Commits setzen ihn um – und weichen dabei an mehreren Stellen **mit Ansage** von ihm ab. Der Mengenwähler (004) und die Pflicht-Belegung (005) werden vorgezogen, jeweils mit einem Nachtrag im Umsetzungsplan, der die Abweichung begründet. Die geplante Reihenfolge war ein Werkzeug, kein Vertrag.

**Der Umfang ist deutlich gewachsen.** Der Plan sah Zimmerauswahl, Checkout und Rechnungsadresse vor. Dazugekommen sind Frühstück (`E47`), fünf weitere Zusatzleistungen (`E49`) und die Unterscheidung von Wohn- und Rechnungsadresse (`E50`/`E51`). Jede dieser Erweiterungen folgt demselben Muster: Entscheidung in der README, Schema in `schema.md`, Migration, Seed, Datenbanktests, dann erst die Oberfläche.

**Zwei Entscheidungen aus Commit 001 wurden revidiert** – und in beiden Fällen bleibt der alte Text mit einem datierten Vermerk stehen:

| alt   | neu   | was sich änderte                                                                               |
| ----- | ----- | ---------------------------------------------------------------------------------------------- |
| `E45` | `E48` | Die Gästezahl gilt für den ganzen Vorgang, nicht pro Zimmer – die Datenbank verteilt die Gäste |
| `E42` | `E50` | `billing_addresses` wird nie migriert; stattdessen `customer_addresses` mit `kind`             |

Das bestätigt den Satz, mit dem die Zusammenfassung oben den Plan kommentiert: _„Erst wer die Maske baut, merkt, welche Felder nirgends hinpassen."_ Es galt auch noch, als die Maske schon teilweise stand.

**`create_booking` wurde viermal ersetzt** (006, 007, 008, 009) – jedes Mal mit `drop function` der alten Signatur, damit keine mehrdeutigen Überladungen entstehen. Und der hotelweite Advisory-Lock aus `E33` hat, wie vorhergesagt, die Buchung über mehrere Kategorien ohne Änderung abgedeckt.

**Im Frontend** entsteht Schritt für Schritt eine kleine Architektur, die es vorher nicht gab:

- reine Rechenfunktionen je Thema (`roomQuantity.ts`, `breakfast.ts`, `services.ts`, `address.ts`, `summary.ts`), jeweils ausdrücklich als „Bequemlichkeit, keine zweite Wahrheit" markiert – verbindlich rechnet die Datenbank,
- erste Frontend-Tests (`*.spec.ts` in `src/`), obwohl `V12` sie „vorerst" ausgeschlossen hatte – möglich, weil `V16` die Logik schon testbar geschnitten hatte,
- die erste Service-Datei für Schreibzugriffe (`src/shared/services/booking.service.ts`) und die erste wiederverwendbare UI-Komponente (`src/shared/ui/modal.ts`).

Mit Commit 012 ist das Ziel des Branches erreicht: **Die Buchungsseite bucht.** Von den zehn Lücken aus der Bestandsaufnahme sind die fachlichen geschlossen – Zimmerauswahl, Checkout, `submit()`, Rechnungsadresse, Gästezahl, Popup-Text.

**Offen** sind zum dokumentierten Stand noch die generierten Typen (`V8`) und die vollständige Service-Schicht: Die Lesezugriffe der View laufen weiterhin direkt über `supabase.from`/`.rpc`, das Prüfkriterium aus Phase 8 wäre also noch nicht erfüllt. Im TODO-Block von `Booking.ts` stehen außerdem noch „Buchungssteps verknüpfen" und die Frage nach Migrationen. Der Branch ist **noch nicht in `main` gemergt**.

### Nachtrag (Commits 013–014)

Commit 013 zieht das Tagebuch bis Commit 012 nach (reiner Doku-Commit, wie schon 002). Commit 014 erledigt das TODO „Buchungssteps verknüpfen": Die drei Schritte im Header stammten noch aus der Idee „eine Seite pro Schritt" und zeigten, seit alles auf einer Seite liegt, nur noch Schritt 1 an. Jetzt meldet die `BookingView` die erledigten Schritte nach denselben Regeln, die auch vor dem Buchen gelten, `bookingState` leitet daraus den fälligen Schritt ab (mit Gleichheitsprüfung gegen eine Endlosschleife), und der Header ist sticky mit anklickbaren Sprungmarken. Die Sprünge scrollen per `scrollIntoView` selbst, weil ein nativer `#hash`-Sprung über `popstate` den selbstgeschriebenen Router zum Neu-Rendern – und damit zum Zurücksetzen der Buchung – bringen würde.

Im TODO-Block von `Booking.ts` bleibt damit nur noch die Frage nach Migrationen offen; `V8` und die Service-Schicht für Lesezugriffe stehen weiterhin aus.

### Nachtrag (Commits 015–023)

Commit 015 trägt die Tagebuch-Einträge 013 und 014 nach (reiner Doku-Commit). Danach ändert der Branch seinen Charakter: **Statt neuer Funktionen folgt ein Review – und dessen systematische Abarbeitung.**

Commit 016 legt `docs/reviews/2026-09-30_verbindung-ui-zu-datenbank.md` an – ein Review des ganzen Branches gegen `main`, gegliedert nach Dringlichkeit: **A** Bugs, **B** schnelle Aufräumarbeiten, **C** Typen und Duplikate, **D** Trennung von Design, Datenfluss und Logik, **E** Tests, **F** offene Punkte aus dem Umsetzungsplan. Jeder folgende Commit hakt darin Punkte ab, oft mit einem Satz dazu, **wie** umgesetzt wurde oder warum nichts zu tun war (A6 erwies sich als Fehlalarm).

| Commits | Review-Punkte  | Kern                                                                                                  |
| ------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| 017     | A1, A2         | „weiter" bucht nicht mehr; Netzwerkfehler werden nicht mehr als „nicht gebucht" ausgegeben            |
| 018     | A3             | XSS-Schutz in zwei Schichten: `escapeHtml()` und Content-Security-Policy                              |
| 019     | A4, A5, B1, B2 | späte Antworten alter View-Instanzen verworfen, Kinderbetten abgeglichen, Lint grün                   |
| 020–021 | B3, B4         | englische, ehrliche Bezeichner; Konstanten statt Magic Strings                                        |
| 022     | B5–B8, C1–C3   | Datenbank-Codes als Union-Typ mit Prüffunktion an der Grenze, `Record`-Texttabellen, gemeinsame Typen |
| 023     | C4, C5         | gleichnamige Funktionen mit verschiedenem Zweck umbenannt, gemeinsamer `−`/`+`-Knopf                  |

Ein Muster zieht sich durch die Commits 021–023: **ungültige Zustände nicht darstellbar machen.** Erst Konstanten statt freier Strings, dann Union-Typen mit `Record`-Tabellen (ein fehlender Text ist ein Compilerfehler), schließlich ein Literal-Typ `-1 | 1` für die Richtung eines Knopfs. Daten von außen werden dabei **einmal an der Grenze** geprüft; unbekannte Datenbank-Codes werden zu `null` statt zu einem Absturz.

Damit sind die Gruppen **A, B und C vollständig erledigt**. Offen sind Gruppe D (u. a. `catalog.service.ts` für die Lesezugriffe – das würde zugleich `V9`/Phase 8.4 erfüllen –, Formatierer und Kalender auslagern, `Booking.ts` mit über 2000 Zeilen in Templates aufteilen), Gruppe E (weitere Tests) und F. Der Branch ist weiterhin **nicht in `main` gemergt**.

### Nachtrag (Commits 024–027)

Commit 024 trägt die Tagebuch-Einträge 015–023 nach (reiner Doku-Commit). Danach geht es mit **Gruppe D** des Reviews weiter – der Trennung von Design, Datenfluss und Logik in `Booking.ts`.

| Commits | Review-Punkte | Kern                                                                                                          |
| ------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| 025     | D1, D2        | Formatierer nach `shared/format.ts`, Kalender als reine Funktion nach `domain/calendar.ts`, jeweils mit Tests |
| 026     | D3            | `getCheckoutError` liefert `{ section, message }`, Bettenprüfung über die Zahl statt über den Hinweistext     |
| 027     | D4–D7         | `catalog.service.ts`, `bookingState` als vollständiger Entwurf, Aktionen mit einem `notify`, `destroy()`-Hook |

Der rote Faden: **Logik aus der View in reine Funktionen und Services ziehen** – erst die Hilfsfunktionen, dann die Regeln, schließlich Datenzugriff und Zustand. Zwei Einsichten ragen heraus. Erstens: Entscheidungen hängen an Codes und Zahlen, nie an Anzeigetexten (`section === 'form'` statt `message === FORM_INCOMPLETE`). Zweitens: Abgeleiteter Zustand wird berechnet statt gespeichert – der Header leitet die erledigten Schritte jetzt selbst aus dem Entwurf ab, `setCompletedSteps` und die Endlosschleifen-Sperre entfallen.

Mit Commit 027 ist das Prüfkriterium aus Phase 8.4 für die Buchungsseite erfüllt: `Booking.ts` importiert `supabase` nicht mehr. Nur `Posts.ts`/`SinglePost.ts` greifen noch direkt zu (Review-Punkt F2).

Eine Warnung steckt in Commit 026: Automatisch auf Tailwind-v4-Schreibweise umgeschriebene Klassen haben drei `class`-Attribute beschädigt, eins davon ohne schließendes `">` – die Zimmerkarte lag dadurch über dem Kalender. Weder `tsc` noch ESLint noch die Tests sehen in Template-Strings hinein; repariert wurde es in Commit 027.

Offen sind damit noch **D8** (Templates aus `Booking.ts` in eigene Dateien), Gruppe E (weitere Tests) und F. Der Branch ist weiterhin **nicht in `main` gemergt**.

### Nachtrag (Commits 028–035)

Commit 028 trägt die Tagebuch-Einträge 024–027 nach (reiner Doku-Commit) und flickt dabei die Navigationskette an 014 und 023. Danach werden die restlichen Review-Gruppen abgearbeitet – alle Commits ab 029 stammen vom selben Tag.

| Commits | Review-Punkte | Kern                                                                                                   |
| ------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| 029     | D8            | Templates unter `BookingView/templates/`: Daten rein, HTML raus; `Booking.ts` von 1870 auf 1304 Zeilen |
| 030     | E1–E5         | Tests auf allen Schichten, dazu ein Datenbanktest, der mit der Zeit von selbst rot wurde               |
| 031–032 | F1, F2        | `posts` als Spike-Migration (`E36`), generierte Typen, `createClient<Database>`, `posts.service.ts`    |
| 033     | F3            | Kalender aus `availability_calendar`: Anreise-/Abreiseregeln (`E29`), Horizont (`E30`), Tooltips       |
| 034     | F4            | Auswahlleiste „Zimmer · Nächte · Summe" mit Sprung zu den persönlichen Daten                           |
| 035     | F5            | Ablehnungen aus `create_booking` zusätzlich an Zimmerkarte und Kalendertag                             |

Zwei Einsichten ragen heraus. Erstens: **Der typisierte Client hat echte Fehler gefunden** – `null` für Parameter, die einen Default haben und deshalb weggelassen werden müssen. Zugleich bleiben Rückgaben von Datenbankfunktionen bewusst handgeschrieben, weil der Generator sie nie als nullbar beschreibt. Generierte Typen sind nur so gut wie die Information, die der Generator hat. Zweitens: Nach Gruppe D passen neue Funktionen ohne Sonderwege in die Struktur. Die Auswahlleiste (034) verteilt sich auf Text (`summary.ts`), Markup (Template), Koordination (View) und Test, und der Kalender (033) trennt Laden (Service), Regeln (`domain/calendar.ts`) und Zeichnen (Template).

Damit ist das Prüfkriterium aus Phase 8.4 vollständig erfüllt – außerhalb von `services/` importiert nichts mehr `supabase` –, und die Phasen 8, 9 und 9b sind umgesetzt. Im Review-Dokument sind die Gruppen **A bis E vollständig** und aus **F** die Punkte F1–F5 abgehakt. Offen sind noch **F6** (den Umsetzungsplan auf den aktuellen Stand bringen) und Gruppe **G** (Barrierefreiheit, u. a. `aria-describedby` an den Formularfeldern und ein eigener Knopf für das „ד im Kalender). Der Branch ist weiterhin **nicht in `main` gemergt**.

### Nachtrag (Commits 036–039)

Commit 036 trägt die Tagebuch-Einträge 028–035 nach (reiner Doku-Commit). Danach werden die letzten offenen Review-Punkte erledigt, und ein Aufräum-Commit schließt an.

| Commits | Review-Punkte | Kern                                                                                                    |
| ------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| 037     | F6            | Umsetzungsplan gepflegt: E1–E51, V9/V12/V17 mit „Stand", tatsächlicher Commit-Schnitt, Phase 7b neu     |
| 038     | G1–G4         | Fehlerzeilen per `aria-describedby`, „ד als eigener Knopf, `aria-label`/`aria-pressed`, weniger Ansagen |
| 039     | –             | neue Kommentar-Regel in `CLAUDE.md`, rund 670 Kommentarzeilen entfernt, Posts-Views gelöscht            |

Zwei Einsichten ragen heraus. Erstens: **Überholtes wird durchgestrichen, nicht gelöscht** (037). Der Plan zeigt jetzt Plan und Wirklichkeit nebeneinander – und hält fest, dass das Risiko, vor dem die ursprüngliche Reihenfolge schützen sollte, tatsächlich eingetreten ist. Zweitens: **Barrierefreiheit beginnt bei nativem HTML** (038). Ein echter `<button>` statt `span role="button"`, ein `<output>` statt `aria-live` – viele ARIA-Attribute bringt das richtige Element schon mit. Der Commit sagt außerdem offen, was er nicht prüfen konnte: den Screenreader im Browser.

Mit 038 sind im Review-Dokument **alle Gruppen A bis G abgehakt**. Commit 039 hinterlässt allerdings eine Baustelle: Er löscht `Posts.ts` und `SinglePost.ts`, während `src/main.ts` beide weiter importiert – `tsc` und damit `pnpm build` schlagen auf diesem Stand fehl. (Behoben in Commit 041, siehe unten.) Außerdem steht über `ROOM_AMENITIES` ein Prüfvermerk `// CHECK: Wird das noch verwendet?` (die Tabelle wird an zwei Stellen verwendet). Der Branch ist weiterhin **nicht in `main` gemergt**.

### Nachtrag (Commits 040–041)

Commit 040 trägt die Tagebuch-Einträge 036–039 nach (reiner Doku-Commit); weil der Link zu 038 länger ist als alle bisherigen, formatiert Prettier dabei die ganze Commit-Tabelle neu. Commit 041 (`d78f56b`) **behebt den Build-Bruch aus 039**: Er entfernt die Imports von `PostsView`, `SinglePostView` und `postsHeader` sowie die Routen `/posts` und `/posts/:id` aus `src/main.ts`. `tsc --noEmit` läuft damit wieder fehlerfrei.

Die Lehre aus 039 und 041 zusammen: Der Compiler findet **kaputte** Importe zuverlässig, **verwaiste** nicht. Nach 041 sind `posts.service.ts` und der Export `postsHeader` ungenutzt, und `CLAUDE.md` nennt die Posts-Views noch als Beispiel. Der Prüfvermerk über `ROOM_AMENITIES` steht ebenfalls noch.

### Abschluss (Commit 042 und Merge in `main`)

Commit 042 trägt die Einträge 040–041 nach (reiner Doku-Commit) und ist der letzte Commit des Branches. Am selben Morgen, um 07:38 Uhr, wird der Branch über **Pull Request #5** in `main` gemergt (Merge-Commit `9cdecc8`).

Ein Blick auf die Eltern des Merge-Commits zeigt, wie sauber dieser Merge ist:

```bash
git log --oneline -1 9cdecc8^1   # 9b81803 – Merge von PR #4, Stand von main
git log --oneline -1 9cdecc8^2   # 4ee10fb – letzter Commit des Branches
git merge-base 9cdecc8^1 9cdecc8^2   # 9b81803
```

Die Merge-Basis ist identisch mit `main`: Seit PR #4 ist in `main` **nichts** passiert. Konflikte waren deshalb ausgeschlossen – Git hätte sogar vorspulen können (Fast-Forward), GitHub legt bei einem Pull Request aber standardmäßig einen Merge-Commit an. Der Unterschied `9cdecc8^1..9cdecc8` umfasst 132 Dateien, rund 22 600 neue und knapp 1 000 entfernte Zeilen – das ganze Volumen von zwei Monaten Arbeit in einem einzigen Pull Request.

Damit ist die Buchungsseite vollständig an die Datenbank angebunden, die Review-Gruppen A–G sind erledigt und alle Branches liegen in `main`. Mit in `main` gekommen sind auch die offenen Reste aus 041: `posts.service.ts` und `postsHeader` sind ungenutzt, `CLAUDE.md` nennt `SinglePostView` noch als Beispiel, und über `ROOM_AMENITIES` steht weiterhin der Prüfvermerk `CHECK`. Vertagt bleibt laut Plan Phase 10 (Cloud-Deployment).

---

[← Vorheriger Branch](007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](000_index.md)
