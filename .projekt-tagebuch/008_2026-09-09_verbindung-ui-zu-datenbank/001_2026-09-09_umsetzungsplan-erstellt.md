[← Vorheriger Commit](../007_2026-09-06_buchungsseite-ui-fertigstellen/002_2026-09-06_add-room-interfaces-and-card-rendering.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# umsetzungsplan erstellt

- **Commit:** `e724f6c`
- **Datum:** 2026-09-09
- **Autor:** Oliver Jung

## Worum geht es?

Ein **reiner Dokumentations-Commit** – und der wichtigste des Branches, weil er festlegt, was die vier folgenden bauen werden. Kein SQL, kein TypeScript, 469 geänderte Zeilen in drei Markdown-Dateien.

```text
 docs/datenbank/README.md         | 148 +++++++++++++++++++-
 docs/datenbank/schema.md         |  68 +++++++++-
 docs/datenbank/umsetzungsplan.md | 284 ++++++++++++++++++++++++++++++++++++---
 3 files changed, 469 insertions(+), 31 deletions(-)
```

Das ist derselbe Aufbau wie am Anfang von Branch `datenbank-anbindung`: erst die Entscheidungen mit Begründung, dann der Code. Die Regel dahinter hat dort eine Nummer bekommen (`V7`): _„Migrationen kann man später lesen, Begründungen nicht rekonstruieren."_

Nur der Anlass ist umgekehrt. Damals wurde ein Schema entworfen, das es noch nicht gab. Diesmal existieren **beide** Seiten – Datenbank und Oberfläche – und die Runde klärt, was „die Buchungsseite mit der Datenbank verbinden" vollständig heißt.

## Die drei Dateien und ihre Rollen

Bevor es in die Inhalte geht, lohnt sich der Blick auf die Arbeitsteilung. Sie ist in diesem Projekt streng:

| Datei               | Rolle                             | Was hier hineinkommt                                                     |
| ------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `README.md`         | **Entscheidungsprotokoll**        | `E…` – Domänenentscheidungen mit Begründung und verworfenen Alternativen |
| `schema.md`         | **normative Quelle der Wahrheit** | Tabellen, Spalten, Policies, Indizes – so, wie sie gelten sollen         |
| `umsetzungsplan.md` | **Arbeitsanleitung**              | `V…` – Vorgehen, Phasen, Commit-Schnitt, Abschlusskriterien              |

Die Unterscheidung zwischen `E…` (Fachlichkeit) und `V…` (Arbeitsweise) ist selbst eine Entscheidung aus dem Vorgänger-Branch. Ihr Wert zeigt sich hier: `E45` („Belegung gilt pro Zimmer") wäre auch in einem anderen Hotelprojekt eine Frage. `V12` („vorerst keine Frontend-Tests") gilt nur für diese Woche in diesem Projekt.

## Teil 1 – Die Bestandsaufnahme

Der erste inhaltliche Block im Umsetzungsplan ist eine Tabelle mit zehn Zeilen. Sie ist das Ergebnis davon, den Ist-Stand **systematisch** abzugehen statt nach Gefühl:

```markdown
**Was beim Erheben des Ist-Standes gefunden wurde** — jeder Punkt hat eine Frage ausgelöst:

| Lücke                                                                                          | Bezug                                  |
| ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| Keine generierten Typen (`src/shared/types/` existierte nicht), Client untypisiert             | Phase 8                                |
| Keine Service-Schicht — die View ruft `supabase.from`/`.rpc`/`.storage` direkt                 | Phase 8.4 (dort ausdrücklich verboten) |
| Kalender kennt `availability_calendar` nicht: `selectable: !isPast` — Ausgebuchtes ist wählbar | Phase 9                                |
| Keine Zimmerauswahl — `room_type_id` landet nirgends                                           | im Plan nicht vorgesehen               |
| Checkout ist Figma-Attrappe („Double Suite", „732 €", „Maxime Musterfrau")                     | im Plan nicht vorgesehen               |
| `submit()` endet in `console.log`, `create_booking` wird nie gerufen                           | im Plan nicht vorgesehen               |
| Rechnungsadress-Formular hat **kein Ziel im Schema** — `customers` hat keine Adressspalten     | → E42                                  |
| Kalender blättert unbegrenzt vorwärts, `booking_horizon_days` = 365                            | E30                                    |
| Gästezahl doppeldeutig: pro Zimmer (Datenbank) vs. gesamt (Oberfläche)                         | → E45                                  |
| Popup-Text verspricht eine Bestätigungsmail; `bookings` kennt kein `pending`                   | E11 → E46                              |
```

Die Spalte „Bezug" ist das Interessante. Sie sortiert die Lücken in vier Klassen, und die Klasse bestimmt, wer sie schließen kann:

1. **„Phase 8/9"** – im Plan vorgesehen, muss nur gebaut werden.
2. **„im Plan nicht vorgesehen"** – drei Punkte, die niemand geplant hatte. Der Plan war unvollständig, nicht falsch.
3. **„E30", „E11"** – die Regel existiert in der Datenbank, die Oberfläche hält sich nicht daran.
4. **„→ E42", „→ E45", „→ E46"** – hier fehlt eine **Entscheidung**. Ein Formularfeld ohne Ziel im Schema kann man nicht wegprogrammieren.

Für Lernende ist Klasse 4 die lehrreiche. Das Rechnungsadress-Formular war in Branch `buchungsseite-ui-fertigstellen` mit `<label>`, `autocomplete` und `placeholder` sorgfältig gebaut – und hatte trotzdem **keinen Ort, an dem die Eingabe landen könnte**. Solche Lücken findet man nicht, indem man Code liest, sondern indem man fragt: _Wohin geht dieser Wert?_

## Teil 2 – Fünf Fragerunden, 30 Fragen

Der Plan hält die Fragen selbst fest, mit einer Begründung, die man leicht überliest:

> `README.md` enthält die Begründungen der Domänenentscheidungen (E42–E46), hier steht, **was** gefragt und entschieden wurde — damit später nachvollziehbar ist, dass es eine Frage _war_.

„Damit nachvollziehbar ist, dass es eine Frage war." Das ist der Unterschied zwischen einer Entscheidung und einer Selbstverständlichkeit. Wer nur das Ergebnis aufschreibt, kann später nicht mehr erkennen, ob eine Alternative geprüft wurde.

Ein Auszug aus der Tabelle:

```markdown
| #   | Frage                                                                      | Entscheidung                                                  |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Q1  | Umfang: nur Typen/Service, plus Kalender, oder plus Buchungsabschluss?     | **alles** — Phase 8 + 9 + Buchungsabschluss                   |
| Q2  | Rechnungsadresse: Felder streichen, Attrappe lassen oder Schema erweitern? | **eigene Tabelle** `billing_addresses`, 1:n zum Kunden (E42)  |
| Q6  | Eine Seite oder drei Schritt-Routen?                                       | **eine Seite** (V11)                                          |
| Q7  | Testumfang                                                                 | **vorerst keine Tests**, werden später nachgezogen (V12)      |
| Q12 | Wie wählt der Gast ein Zimmer aus?                                         | _überholt durch Q26_ — Mengenwähler statt Auswahl-Button      |
| Q24 | Eine Kategorie mit Menge, oder mehrere Kategorien je Vorgang?              | **mehrere Kategorien**, `p_positions jsonb` (E44)             |
| Q30 | „Ändern dürfen" gegen „eine Buchung ist ein Vertrag"                       | Ändern nur auf **unbenutzten** Adressen, auch für Staff (E43) |
```

### Die zwei umgeworfenen Antworten

Vier Einträge in der Tabelle stehen durchgestrichen da – „_überholt durch Q26_", „_ersetzt durch Q27_", „_präzisiert in Q18_", „_präzisiert in Q28/Q30_". Sie wurden **nicht gelöscht**, und der Plan sagt, warum:

> **Zwei Fragen haben eine frühere Antwort umgeworfen** — das ist der Ertrag der Runde, nicht ihr Makel: Q24 hat Q12 („`p_rooms` fest auf 1") kassiert, und Q30 hat gezeigt, dass Q28 und Q9 sich widersprachen. Beide Widersprüche wären sonst als Code entstanden und erst beim Debuggen aufgefallen.

Der Widerspruch zwischen Q9 und Q28 ist ein besonders schönes Beispiel, weil beide Antworten einzeln vernünftig klingen:

- **Q9:** Die Buchung _verweist_ auf die Adresse (statt sie zu kopieren). Begründung: keine zweite Wahrheit.
- **Q28:** Lesen und **Ändern** dürfen der Kunde selbst und Mitarbeitende.

Zusammen ergibt das: Der Gast zieht 2027 um, ändert seine Adresse – und die Rechnungsadresse der Buchung von 2026 ändert sich rückwirkend mit. Genau das, was „eine Buchung ist ein Vertrag" ausschließen soll. Q30 löst es auf: Ändern nur auf Adressen, an denen **keine** Buchung hängt.

Ohne die Frage wäre der Widerspruch als Policy in eine Migration gewandert und irgendwann als seltsames Verhalten aufgefallen.

## Teil 3 – Die fünf Domänenentscheidungen in `README.md`

Der neue Abschnitt „4h. Entschieden (Runde 8)" beginnt mit einem Satz, der die Reihenfolge des ganzen Projekts rechtfertigt:

> Drei der fünf Entscheidungen sind Korrekturen an Annahmen aus den Phasen 1–7. Das ist kein Makel des Schemas, sondern der erwartbare Ertrag der ersten echten Oberfläche darauf: Erst wer die Maske baut, merkt, welche Felder nirgends hinpassen.

### `E42` – Die Rechnungsadresse ist eine eigene Tabelle

Die Kernunterscheidung ist begrifflich, nicht technisch:

> Eine Adresse am Kunden wäre dessen **Sitzadresse** — wo er wohnt. Die Rechnungsadresse ist etwas anderes: wohin die Rechnung geht. Die beiden fallen häufig zusammen und sind trotzdem nicht dasselbe Feld; wer sie in eine Spaltengruppe legt, kann sie nie wieder trennen, ohne Daten zu interpretieren.

Der letzte Halbsatz ist die eigentliche Begründung. Zwei Begriffe in ein Feld zu legen ist billig; sie später auseinanderzunehmen erfordert, dass jemand jede Zeile ansieht und entscheidet, was gemeint war.

**Straße und Hausnummer getrennt** – anders als bei `hotels`, wo `address_line1` genügt:

> Das Formular hat zwei Felder. Zusammenkleben und später wieder auseinanderparsen verliert Information — und zwar genau bei den Adressen, bei denen es darauf ankommt („Musterstraße 3a/2/17").

**`country_code` als ISO-2 statt Freitext**, mit ausdrücklich benanntem Preis:

> Das ist Absicht — Freitext-Länder sind in jeder späteren Auswertung wertlos, und „Österreich"/„Oesterreich"/„AT" nebeneinander ist kein Datenbestand, sondern eine Aufräumaufgabe auf Vorrat.

Und **was bewusst fehlt**: kein `is_default`, kein `label`, kein `company`. Die Begründung ist eine Kette: Solche Spalten sind nur bedienbar, wenn ein Gast seine Adressen sehen kann; das kann er in v1 nicht; also wären es Spalten, die niemand füllt.

### `E43` – Die Buchung verweist; benutzte Adressen sind unveränderlich

Hier wird eine schon vorhandene Regel des Schemas auf einen neuen Fall angewendet – und ausdrücklich **anders** gelöst als beim Preis:

|                       | Preis pro Nacht                                    | Rechnungsadresse                                              |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Lösung                | **kopieren** (`booking_nights` friert ein)         | **verweisen** + Zeile unveränderlich machen                   |
| Warum                 | pro Nacht verschieden, stammt aus einer Berechnung | sechs Spalten, immer gleich, keine Berechnung                 |
| Preis der Alternative | –                                                  | „Kopieren von sechs Spalten ohne Gegenwert" + zweite Wahrheit |

Durchgesetzt wird die Unveränderlichkeit über eine `UPDATE`-Policy mit einer Hilfsfunktion `billing_address_in_use(uuid)`. Der Plan erklärt, warum sie `SECURITY DEFINER` braucht – und zwar nicht aus dem üblichen Grund:

> `SECURITY DEFINER` ist hier **nicht** wegen Privilegien nötig, sondern damit die Policy nicht durch die RLS von `bookings` hindurchfragen muss und dabei je nach Aufrufer ein anderes Ergebnis bekommt.

Das ist eine Feinheit, die man sich merken kann: Eine Prüffunktion, die selbst durch RLS liest, prüft für verschiedene Nutzer verschiedene Dinge. Für einen Gast wäre „keine Buchung zeigt auf diese Adresse" wahr, sobald er die betreffende Buchung nicht sehen darf.

**Und die Grenze der Lösung wird selbst benannt**, doppelt:

> Erstens ist „unveränderlich" hier eine **Policy**, kein Constraint — der Service-Role-Key umgeht RLS vollständig. Es heißt „kein Weg über die Anwendung", nicht „physisch unmöglich". Zweitens sieht in v1 **niemand** einen Unterschied: Ohne Login ist `current_customer_id()` leer und `is_staff()` gibt `false`.

Eine Regel aufzuschreiben, die heute nichts bewirkt, und das dazuzuschreiben, ist ehrlicher als beides weglassen.

### `E44` – Mehrere Kategorien in einem Vorgang

Die Signaturänderung:

```sql
-- vorher
create_booking(p_room_type_id uuid, p_rooms int, p_check_in date, …)

-- nachher
create_booking(p_positions jsonb, p_check_in date, …)
--   p_positions = [{"room_type_id": "…", "rooms": 2}, …]
```

Der Aufbau der Begründung ist der lehrreiche Teil. `E41` hatte Positionen abgelehnt – aber nicht, weil sie unmöglich wären:

> Die Begründung dort war nicht „geht nicht", sondern „die Oberfläche kann es nicht bedienen, also wäre es Ballast (E15)". Die Oberfläche kann es jetzt: Sie fragt Mengen pro Zimmerart ab. Damit fällt die Begründung, und der vorbereitete Weg (Gruppe + Schleife) wird gegangen.

**Eine Entscheidung wird also nicht widerrufen – ihre Voraussetzung entfällt.** Das ist nur möglich, weil in `E41` nicht nur das Ergebnis, sondern der _Grund_ stand. Wäre dort „keine Positionen" ohne Begründung notiert, wäre die Änderung eine Meinungsänderung; so ist sie eine Folgerung.

**Der Ertrag einer alten Entscheidung.** `E33` hatte den Advisory-Lock hotelweit gelegt statt pro Kategorie. Jetzt:

> Er deckt alle Positionen gemeinsam ab. Wäre er pro Kategorie gewählt worden, bräuchte eine Zwei-Kategorien-Buchung jetzt zwei Locks in garantierter Reihenfolge — genau die Verklemmung, die E33 vorausgesehen hat. Die Entscheidung zahlt sich hier zum ersten Mal aus.

Für Lernende: Eine _Verklemmung_ (englisch _deadlock_) entsteht, wenn zwei Vorgänge zwei Sperren in **unterschiedlicher** Reihenfolge nehmen – A hält 1 und will 2, B hält 2 und will 1. Beide warten für immer. Die üblichen Gegenmittel sind „immer in derselben Reihenfolge sperren" oder „nur eine Sperre nehmen". `E33` hat den zweiten Weg gewählt, bevor es den Anwendungsfall gab.

**Ausdrücklich verworfen** wird die naheliegende Abkürzung:

> `create_booking` zweimal nacheinander aus dem Frontend aufzurufen. Das sieht aus wie dasselbe zum Nulltarif, bricht aber die Atomarität — schlägt der zweite Aufruf fehl, steht die erste Buchung bereits verbindlich in der Datenbank, und niemand hat sie bestellt.

**Und der Preis, benannt:** Ein `jsonb`-Parameter kommt in den generierten TypeScript-Typen als `Json` an und verliert damit genau die Typsicherheit, die `E7` herstellt. Der Ausgleich: ein handgeschriebener Eingabetyp in der Service-Schicht **plus** Validierung in der SQL-Funktion selbst – „die Datenbank bleibt die letzte Verteidigungslinie".

### `E45` – Die Belegung gilt pro Zimmer

Die Doppeldeutigkeit aus Commit 001 des Vorgänger-Branches wird aufgelöst, und zwar zugunsten der Datenbank:

> Die Datenbank hat sich hier längst festgelegt, nur hat es vor der Mengenauswahl niemand gemerkt: `availability_nights` prüft `max_occupancy` **pro Zimmer** (E15), und `create_booking` schreibt `p_adults` in **jede** der _n_ Buchungszeilen. Die Oberfläche las sich umgekehrt — ein zentrales „Anzahl der Gäste" über der Seite wirkt wie eine Gesamtzahl.

Und die entscheidende Beobachtung zur Fehlerklasse:

> Diese Doppeldeutigkeit war folgenlos, solange es genau ein Zimmer gab; mit Mengen produziert sie falsche Suchergebnisse.

Ein Fehler, der bei _einem_ Zimmer korrekte Ergebnisse liefert und bei _zwei_ falsche, ist besonders unangenehm: Er entsteht nicht beim Programmieren, sondern beim Erweitern – und wer ihn dann sucht, sucht in der neuen Funktion und nicht in der Beschriftung.

Warum nicht die Datenbank angepasst wird: „hieße, `max_occupancy` gegen sich selbst zu verwenden — also gewinnt die Datenbank, und die Beschriftung wird ehrlich."

**Die Lücke, die bleibt**, ist genau ausgemessen: Eine Familie, die ein Doppel- und ein Einzelzimmer nimmt, muss mit _einer_ Belegung suchen, die für **beide** Zimmer passen muss – und schließt damit Kategorien aus, die gereicht hätten. Der Ausweg ist benannt: ein Feld mehr pro Position im `jsonb` aus `E44`, also additiv und ohne Schemaänderung.

### `E46` – Die Bestätigung behauptet keine Mail

Der kleinste Punkt, und ein guter Abschluss, weil er zeigt, dass ein **Entwurf** dem Schema widersprechen kann:

> Der Entwurfstext widerspricht E11. Dort wurde `pending` ausdrücklich verworfen — „ein Zustand, aus dem nichts herausführt, solange es keine Zahlung gibt". Eine Buchung ist im Moment ihrer Entstehung `confirmed` und verbindlich. Der Gast aufzufordern, etwas zu bestätigen, was bereits gilt, wäre falsch; ihn dafür auf eine Mail zu verweisen, die noch niemand versendet, wäre doppelt falsch.

Aus „Bitte bestätigen Sie diese via erhaltener Email." wird „Ihre Buchung ist bestätigt." – und die **Buchungsnummer** kommt dazu:

> ohne Mail und ohne Kundenkonto ist die Buchungsnummer das **einzige**, woran der Gast seine Buchung je wiederfindet — sie wegzulassen macht die Bestätigung zu einer Höflichkeitsfloskel.

Und die Abweichung wird datiert statt still vollzogen: „Der Satz kommt zurück, sobald der Mailversand steht; ein Kommentar an der Stelle im Code hält fest, warum er weg ist."

## Teil 4 – Was sich in `schema.md` ändert

`schema.md` ist die normative Quelle – hier stehen keine Begründungen, sondern Festlegungen. Der Commit zieht vier Dinge nach.

### Das ERD bekommt zwei Beziehungen und eine Entität

```diff
     ROOM_TYPES ||--o{ BOOKINGS : "verkauft als"
     RATE_PLANS ||--o{ BOOKINGS : "gebucht zu"
     CUSTOMERS ||--o{ BOOKINGS : "bucht"
+    CUSTOMERS ||--o{ BILLING_ADDRESSES : "hat"
+    BILLING_ADDRESSES ||--o{ BOOKINGS : "berechnet an"
     BOOKING_GROUPS ||--o{ BOOKINGS : "fasst zusammen"
```

Die Notation ist **Mermaid** – ein Diagramm als Text, das GitHub direkt rendert. `||--o{` liest sich als „genau eins zu null-oder-mehr". Der Vorteil gegenüber einem exportierten Bild: Das Diagramm liegt im Diff. Man sieht in `git show`, dass eine Beziehung dazugekommen ist.

### Die neue Tabelle als Spaltentabelle

```diff
+### `billing_addresses` — Rechnungsadresse, nicht Sitzadresse (E42, E43)
+
+| Spalte | Typ | Regeln |
+| --- | --- | --- |
+| `id` | `uuid` | PK |
+| `customer_id` | `uuid` | `NOT NULL REFERENCES customers ON DELETE RESTRICT` |
+| `street` | `text` | `NOT NULL` |
+| `house_number` | `text` | `NOT NULL` |
+| `postal_code` | `text` | `NOT NULL` |
+| `city` | `text` | `NOT NULL` |
+| `country_code` | `text` | `NOT NULL CHECK (char_length(country_code) = 2)` — ISO-3166-1 alpha-2 |
+| `archived_at` | `timestamptz` | `NULL` = aktiv (E22) |
```

`ON DELETE RESTRICT` ist im ganzen Schema das durchgehende Muster: Ein Kunde, an dem noch Adressen hängen, kann nicht gelöscht werden. Die Alternative `CASCADE` würde beim Löschen des Kunden stillschweigend Adressen mitnehmen, auf die Buchungen zeigen – und `RESTRICT` an `bookings.billing_address_id` würde das dann verhindern, aber mit einer Fehlermeldung an völlig anderer Stelle. Konsequentes `RESTRICT` heißt: Nichts verschwindet unbemerkt.

### `bookings` bekommt eine Spalte

```diff
 | `customer_id` | `uuid` | `NOT NULL REFERENCES customers ON DELETE RESTRICT` |
+| `billing_address_id` | `uuid` | `NOT NULL REFERENCES billing_addresses ON DELETE RESTRICT` (E43) |
 | `room_type_id` | `uuid` | `NOT NULL REFERENCES room_types ON DELETE RESTRICT` |
```

`NOT NULL` hat eine Konsequenz, die im Plan an anderer Stelle auftaucht: Die Adressfelder werden damit **Pflichtfelder im Formular**. Phase 9b listet sie ausdrücklich als Pflicht auf – „wegen `billing_address_id not null`". Eine Schemaentscheidung schreibt hier direkt eine Formularvalidierung vor.

### Der Ablauf von `create_booking` wird umgeschrieben

Der Pseudocode-Block in `schema.md` zeigt den Umbau am kompaktesten:

```diff
+0. p_positions validieren: nicht leer, keine Kategorie doppelt,
+   rooms >= 1 je Position, Summe <= 8                -- E44
 1. pg_advisory_xact_lock(hashtext('booking:' || hotel_id))  -- EIN Lock fuers Hotel (E10, E33)
+   -- deckt ALLE Positionen ab; genau dafuer wurde er hotelweit gewaehlt
 2. Horizont, Vergangenheit, Belegung pruefen        -- E30, E15
-3. search_availability() fuer den Zeitraum          -- eine Wahrheit, kein Copy-Paste
+   -- Belegung gilt PRO ZIMMER, nicht pro Reise      -- E45
+3. availability_nights() je Position und Nacht      -- eine Wahrheit, kein Copy-Paste
 4. bei Ablehnung: strukturierter Fehler
-   { code, datum, grund }                          -- E31
+   { code, datum, room_type_id, grund }             -- E31, E44
 5. customers: per email_normalized finden oder anlegen -- E26, E32
-6. bookings einfuegen (Referenz erzeugen)           -- E23
+6. billing_addresses: neue Zeile anlegen            -- E42, E43
+7. bookings einfuegen (Referenz erzeugen)           -- E23
+8. booking_nights aus den Saisonpreisen einfrieren  -- E21
+9. booking_events: 'created'                        -- E12
+   -- ab der ZWEITEN Buchung (auch ueber zwei Positionen mit je einem Zimmer):
+   -- booking_groups-Zeile, alles in DIESER Transaktion (E20/E27/E44)
```

Drei Details, die man daran sehen kann:

- **Schritt 0 ist neu.** Eingaben werden geprüft, _bevor_ die Sperre genommen wird. Eine Sperre für eine ungültige Anfrage zu halten, blockiert andere ohne Nutzen.
- **Der Fehler bekommt ein Feld mehr.** `room_type_id` im `DETAIL`-JSON, damit die Oberfläche weiß, an **welcher** Karte sie den Hinweis anzeigt. Das Datum allein genügt bei mehreren Positionen nicht mehr.
- **Die Gruppen-Bedingung ändert sich.** Vorher „`p_rooms > 1`", jetzt „ab der zweiten Buchung" – zwei Positionen mit je einem Zimmer sind auch zwei Buchungen und brauchen eine Gruppe. Ein Ein-Zeichen-Fehler, der ohne diesen Hinweis leicht entsteht.

### Und zwei neue Indizes – einer mit einer ungewöhnlichen Begründung

```diff
+| `billing_addresses(customer_id)` | Adressen eines Kunden (Kundenkonto, E42) |
+| `bookings(billing_address_id)` | `billing_address_in_use()` — die Funktion sitzt in einer Policy und wird bei **jedem** Änderungsversuch ausgewertet (E43) |
```

Der zweite ist lehrreich: Ein Index nicht für eine Abfrage der Anwendung, sondern für eine **Policy**. Weil `billing_address_in_use()` in der `UPDATE`-Policy steht, läuft sie bei jedem Änderungsversuch – und ohne Index wäre das jedes Mal ein vollständiger Durchlauf durch `bookings`.

## Teil 5 – Der Umsetzungsplan: Phasen, Commits, Prüfbarkeit

### Die Vertagung wird aufgehoben – als datierter Nachtrag

```markdown
> **Nachtrag 2026-09-09 zu V1:** Phase 8 und 9 sind **nicht mehr vertagt** — sie sind der Inhalt des
> Branches `verbindung-ui-zu-datenbank`, zusammen mit den neuen Phasen 7b und 9b. Vertagt bleibt
> allein Phase 10 (Cloud). Siehe 0c und V8–V16.
```

Die alte `V1`-Zeile wird nicht überschrieben, sondern kommentiert. Dasselbe Muster steht im `README.md` über dem überholten Absatz von `E41`:

```markdown
> **Nachtrag 2026-09-09:** Der letzte Absatz ist durch **E44** überholt. Die Oberfläche kann die
> Schnittstelle inzwischen bedienen — damit fällt die Begründung, sie nicht zu bauen.
```

**Warum nicht einfach überschreiben?** Weil der alte Text zusammen mit dem Nachtrag mehr aussagt als der neue allein: Er zeigt, dass es einen Grund gab und dass dieser Grund entfallen ist. In einer Datei, deren Zweck das Nachvollziehen von Entscheidungen ist, ist die Änderungsspur der Inhalt.

### Neue Phasen 7b und 9b – die Nummerierung mit Buchstaben

Statt alles nach Phase 8 zu verschieben, bekommen die Einschübe Buchstaben. `7b` liegt zwischen 7 und 8, `9b` nach 9. Das hält die bereits umgesetzten und dokumentierten Phasen 1–7 in ihrer Nummer – eine Umnummerierung würde jeden Verweis in neun Tagebuch-Dateien und drei Doku-Dateien ungültig machen.

### Der Commit-Schnitt

```markdown
| #   | Inhalt                                                                                      | Phase |
| --- | ------------------------------------------------------------------------------------------- | ----- |
| 1   | Migration `billing_addresses` samt RLS und `billing_address_in_use()`                       | 7b    |
| 2   | Migration `create_booking` neu: Positionen **und** Rechnungsadresse in einem Schritt        | 7b    |
| 3   | Typen generieren, Service-Schicht, bestehende Zugriffe umziehen — **Verhalten unverändert** | 8     |
| 4   | Kalender aus `availability_calendar`, E29-Regel, Horizont-Kappung                           | 9     |
| 5   | Mengenwähler, Checkout, `create_booking`, Bestätigungs-Popup                                | 9b    |
```

Und ein Unterschied zum Vorgänger-Branch, der ausdrücklich benannt wird (`V17`):

> **Fünf Commits** auf `verbindung-ui-zu-datenbank`, jeder für sich lauffähig (anders als die Phasen 1–7).

In `datenbank-anbindung` waren die Phasen einzeln nie lauffähig – eine Migration ohne ihre Nachfolger ist ein halbes Schema. Frontend-Commits sind anders: Nach Commit 3 läuft die Seite, nur eben unverändert. Der Commit-Schnitt folgt also nicht einer Gewohnheit, sondern der Natur des Inhalts.

Die Begründung, warum Commit 2 zwei Änderungen zusammenfasst, ist genauso pragmatisch:

> Commit 2 fasst beide Änderungen an `create_booking` zusammen, weil beide dieselbe Funktion ersetzen — zwei `drop`/`create`-Runden hintereinander helfen niemandem.

### Abschlusskriterien, die man ausführen kann

Das ist die für die Praxis wertvollste Eigenschaft des Plans. Jede Phase endet mit „**Fertig, wenn:** …", und die Bedingungen sind überprüfbar statt beurteilbar:

**Phase 7b, Commit 1:**

> `rls_audit()` liefert weiterhin **null Zeilen**. Die Prüffunktion aus Phase 7 gilt ausdrücklich auch für Tabellen, die es damals noch nicht gab — das ist jetzt der erste Ernstfall.

Die Dauerprüfung aus dem Vorgänger-Branch wird hier zum ersten Mal auf eine Tabelle angewendet, die es bei ihrer Entstehung noch nicht gab. Genau dafür war sie gedacht.

**Phase 8:**

```bash
grep -rn "from.*services/supabase" src/ --include=*.ts | grep -v "src/shared/services/"
```

> Danach findet der Befehl **nichts** mehr. Diese Zeile ist die Prüfung, nicht der gute Vorsatz.

Ein Architekturgrundsatz („Views greifen nicht direkt auf Supabase zu") ist normalerweise eine Bitte. Als `grep`-Befehl ist er eine Bedingung – und ließe sich später in einen Lint-Regel oder einen CI-Schritt heben.

**Phase 9:**

> eine ausgebuchte Nacht sperrt ihr Datum als **Anreisetag** und lässt es als **Abreisetag** wählbar. Dieser eine Fall ist die Auszahlung von E8 — stimmt er nicht, verkauft die Seite keine Anschlussnächte.

Ein einziger, konkreter Fall statt „der Kalender funktioniert". Er prüft die halb-offenen Zeiträume aus `E8`, die den ganzen Datenbank-Branch prägen: Eine Buchung vom 10. bis 12. belegt die Nächte 10 und 11, nicht die Nacht 12. Wer den 12. als Anreisetag sperrt, verliert Umsatz an jeder Anschlussbuchung.

**Phase 7b, Commit 2** – mit einem eingebauten Warnhinweis:

> **Achtung bei Commit 2:** Hier wird die Funktion angefasst, an der die Kernaussage von E10 hängt. Wer den Nebenläufigkeitstest nach dem Umbau nicht laufen lässt, hat die Entscheidung nur noch behauptet.

Das schließt an die Erfahrung aus Commit 008 des Vorgänger-Branches an, wo ein Nebenläufigkeitstest mit zwei parallelen Anfragen auch **ohne** Sperre grün blieb und erst mit sechs Anfragen aussagekräftig wurde.

### Die bewussten Auslassungen

`V12` verzichtet auf Frontend-Tests – und zieht sofort die Konsequenz:

> Konsequenz, damit sie nicht überrascht: Die E29-Regel und `buildRoomCards` sind ab jetzt nur über die Oberfläche geprüft. Deshalb V16, letzter Punkt: die Regeln werden trotzdem als eigenständige Funktionen herausgezogen.

Und Phase 9b endet mit einer Liste, die man sich als Vorlage merken kann:

> **Bewusst offen nach dieser Phase:** keine Tests auf der Frontend-Seite (V12), keine Bestätigungsmail (E46), keine Belegung je Position (E45), keine Zusatzleistungen, keine Einwilligung mit Zeitstempel. Alle fünf sind benannt, keine ist versehentlich.

Der letzte Satz ist die ganze Lehre: **Der Unterschied zwischen technischer Schuld und geplanter Reihenfolge ist, ob die Lücke einen Namen hat.**

## Was wurde erreicht?

Nach diesem Commit steht der komplette Bauplan für die vier folgenden Commits: eine neue Tabelle mit Policies, eine umgebaute `create_booking`-Funktion, eine Service-Schicht, ein datengetriebener Kalender und eine echte Buchungsstrecke mit Bestätigung. Jede Phase hat ein Abschlusskriterium, jede offene Lücke einen Namen.

Der Entscheidungsbaum ist damit wieder geschlossen – `README.md` vermerkt: _„Die Frontier ist leer — alle Entscheidungen des Entscheidungsbaums sind getroffen (E1–E46)."_

Der Branch ist **noch nicht in `main` gemergt**; die Commits 2 bis 5 aus dem Plan folgen. Wer diesen Eintrag später liest und die Umsetzung sehen will, findet sie in den nachfolgenden Commits desselben Branches.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
