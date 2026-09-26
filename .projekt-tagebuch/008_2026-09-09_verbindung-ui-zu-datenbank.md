[← Vorheriger Branch](007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](000_index.md)

# 008 – Branch `verbindung-ui-zu-datenbank`

**Erster Commit:** 2026-09-09 · **Commits:** 14 · **Status:** offen

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

| Nr.                                                                                                           | Datum      | Beschreibung                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| [001](008_2026-09-09_verbindung-ui-zu-datenbank/001_2026-09-09_umsetzungsplan-erstellt.md)                    | 2026-09-09 | Grilling-Runde 8: `E42`–`E46`, `V8`–`V17`, Phasen 7b/8/9/9b (reiner Doku-Commit)        |
| [002](008_2026-09-09_verbindung-ui-zu-datenbank/002_2026-09-09_projekttagebuch-aktualisiert.md)               | 2026-09-09 | Projekttagebuch für die Branches 006–008 nachziehen (reiner Doku-Commit)                |
| [003](008_2026-09-09_verbindung-ui-zu-datenbank/003_2026-09-16_update-comments-for-database-integration.md)   | 2026-09-16 | TODO-Block als Arbeitsliste für die Anbindung in `Booking.ts`                           |
| [004](008_2026-09-09_verbindung-ui-zu-datenbank/004_2026-09-16_mengenwaehler-je-zimmerkategorie.md)           | 2026-09-16 | Mengenwähler je Kategorie, Mengen in `bookingState`, Regeln in `roomQuantity.ts`        |
| [005](008_2026-09-09_verbindung-ui-zu-datenbank/005_2026-09-16_belegung-verpflichtend-kein-suchdefault.md)    | 2026-09-16 | Keine geratene Belegung mehr: ohne Erwachsenenzahl keine Suche                          |
| [006](008_2026-09-09_verbindung-ui-zu-datenbank/006_2026-09-16_zimmer-anzahl-und-fruehstueck-integriert.md)   | 2026-09-16 | `E47`: Frühstück als eigener Posten – `services`, `booking_extras`, `grand_total_cents` |
| [007](008_2026-09-09_verbindung-ui-zu-datenbank/007_2026-09-23_belegung-als-gesamtzahl-mehrere-kategorien.md) | 2026-09-23 | `E48` revidiert `E45`: Belegung als Gesamtzahl, `p_positions`, `group_capacity()`       |
| [008](008_2026-09-09_verbindung-ui-zu-datenbank/008_2026-09-23_sektion-zusatzleistungen-je-vorgang.md)        | 2026-09-23 | `E49`: Sektion Zusatzleistungen, `charge_basis`, `p_services`                           |
| [009](008_2026-09-09_verbindung-ui-zu-datenbank/009_2026-09-26_customer-address-management.md)                | 2026-09-26 | `E50`/`E51`: `customer_addresses`, Sitz- und optionale Rechnungsadresse, Formular       |
| [010](008_2026-09-09_verbindung-ui-zu-datenbank/010_2026-09-26_enhance-address-form-validation.md)            | 2026-09-26 | Graue Platzhalter, neue Beispielwerte, Fokus ins erste fehlerhafte Feld                 |
| [011](008_2026-09-09_verbindung-ui-zu-datenbank/011_2026-09-26_booking-summary-dynamic-pricing.md)            | 2026-09-26 | „Ihre Buchung" ohne Attrappe: `summary.ts`, Hoteldaten, Entfernen-Kreuz                 |
| [012](008_2026-09-09_verbindung-ui-zu-datenbank/012_2026-09-26_booking-creation-modal-confirmation.md)        | 2026-09-26 | `create_booking` aus der Oberfläche, `booking.service.ts`, `<dialog>`-Bestätigung       |
| [013](008_2026-09-09_verbindung-ui-zu-datenbank/013_2026-09-26_project-diary.md)                              | 2026-09-26 | Projekttagebuch für die Commits 002–012 nachziehen (reiner Doku-Commit)                 |
| [014](008_2026-09-09_verbindung-ui-zu-datenbank/014_2026-09-26_booking-steps-management.md)                   | 2026-09-26 | Buchungsschritte im Sticky-Header: Status aus der View, Sprungmarken zu den Bereichen   |

Merge-Commits gibt es in diesem Branch nicht – er ist seit seinem Start nicht mit `main` synchronisiert worden.

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

| alt   | neu     | was sich änderte                                                                              |
| ----- | ------- | --------------------------------------------------------------------------------------------- |
| `E45` | `E48`   | Die Gästezahl gilt für den ganzen Vorgang, nicht pro Zimmer – die Datenbank verteilt die Gäste |
| `E42` | `E50`   | `billing_addresses` wird nie migriert; stattdessen `customer_addresses` mit `kind`             |

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

---

[← Vorheriger Branch](007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](000_index.md)
