# Umsetzungsplan — Datenbank-Schema Hotelanwendung

> **Zweck:** Diese Datei ist so geschrieben, dass die Umsetzung in einer **späteren Session**
> aufgesetzt werden kann, ohne die Grilling-Unterhaltung wiederholen zu müssen.
>
> **Vorher lesen:** [README.md](./README.md) (Entscheidungen E1–E46 mit Begründung) und
> [schema.md](./schema.md) (normatives Schema).
>
> **Regel für die Umsetzung:** `schema.md` ist die Quelle der Wahrheit. Weicht der Plan davon ab,
> gilt `schema.md` — oder es wird zuerst dort geändert (und in `README.md` begründet).

---

## 0. Einstieg in die nächste Session

Kopiervorlage für den ersten Prompt:

> Lies `docs/datenbank/README.md`, `docs/datenbank/schema.md` und
> `docs/datenbank/umsetzungsplan.md`. Wir setzen Phase **N** um. Halte dich an die Entscheidungen
> E1–E46 und die Vorgehensentscheidungen V1–V17; wenn dir etwas widersprüchlich vorkommt, frag
> nach, statt zu raten.

**Branch- und Commit-Schnitt (V6):** Phasen 1–7 laufen auf **einem** Themenbranch
(`datenbank-anbindung`), **ein Commit pro Phase**. Kein Branch und kein PR pro Phase — die Phasen
bauen aufeinander auf und sind einzeln nie lauffähig, sieben PRs wären Zeremonie ohne Nutzen.
(Der frühere Verweis auf `FORK-WORKFLOW.md` ist entfernt: diese Datei existiert im Repo nicht.)

**Zustand der Umgebung (nachgeprüft am 2026-09-02):**

| | Stand |
| --- | --- |
| Docker | vorhanden (Server 29.7.2, containerized) — Voraussetzung für die lokale Supabase-Instanz |
| Supabase CLI | **nicht installiert**; `supabase@2.116.0` per npm erreichbar → Phase 1, Schritt 1 |
| Container-Registry | erreichbar (kein Firewall-Block) |
| `supabase/`-Verzeichnis | existiert nicht |
| Supabase-Client im Code | `src/shared/services/supabase.ts`, URL + publishable key **hart im Code** |
| `.env` | existiert und ist **in Git getrackt**; Variablen heißen `VITE_SUPABASE_URL`, `VITE_SUPABASE_API_KEY` |
| Tests | genau eine Datei (`src/_testing-spike/math.spec.ts`), keine `vitest.config.ts` |
| Zimmerbilder | genau zwei: `double-premium.jpg`, `double-suite.jpg` — der Seed richtet sich danach (V4) |
| `FORK-WORKFLOW.md` | **existiert nicht** (der frühere Verweis in diesem Plan war tot) |

---

## 0b. Vorgehensentscheidungen (Grilling-Runde 2026-09-02)

Domänenentscheidungen stehen als E1–E46 in `README.md`. Was hier steht, ist **Vorgehen** — es ändert
das Schema nicht, aber es bestimmt, wie diese Umsetzung abläuft.

| # | Entscheidung | Begründung in Kurzform |
| --- | --- | --- |
| **V1** | Diese Umsetzung umfasst **Phase 1–7**. Phase 8–9 (Typen, Service-Schicht, Kalender-UI) und Phase 10 (Cloud) sind vertagt. | Phase 8 hängt an Typen, die es erst nach Phase 7 gibt; Phase 9 ist UI-Arbeit mit eigenem Rhythmus. |
| **V2** | Die bestehende Cloud-Instanz ist ein **Wegwerf-Spike**. Die Migrationshistorie beginnt bei `hotels`; **kein** `supabase db pull`. | Ein `db pull` würde die Spike-Tabelle `posts` für immer als Migration 0 zementieren. Freigegeben trotz Datenverlust-Potenzial — die Instanz enthält nur Tutorial-Daten. |
| **V3** | **RLS geht direkt nach Phase 2 an**, nicht erst in Phase 7. Seeds laufen über den Service-Role-Key. | Sonst baut man fünf Phasen gegen eine offene Datenbank und weiß beim Anschalten nicht mehr, welche Abfrage aus welchem Grund leer ist. |
| **V4** | **Minimalseed:** 1 Hotel, 3 Kategorien, 8 Zimmer, Rate-Plan `STANDARD`, 12 Monate Preise, **null Buchungen**. `hotels.booking_horizon_days` im Seed auf **365**. | Der Horizont-Default 540 würde bei 12 Monaten Preisen ~5 Monate „nicht buchbar" erzeugen — korrekt laut E25, sieht aber aus wie ein Bug. Horizont und Preisabdeckung müssen sich decken. |
| **V5** | Testumfang und -werkzeug: siehe **E34**. | Steht in der E-Reihe, weil die Auswahl der sechs Kriterien direkt an Domänenentscheidungen hängt. |
| **V6** | Ein Themenbranch, **ein Commit pro Phase**. | Sieben PRs für sieben aufeinander aufbauende Migrationen sind Zeremonie ohne Nutzen. |
| **V7** | Dokumentation wird **vor** der ersten Migration fortgeschrieben, nicht danach. | Migrationen kann man später lesen, Begründungen nicht rekonstruieren. Genau deshalb existiert `README.md`. |

> **Nachtrag 2026-09-09 zu V1:** Phase 8 und 9 sind **nicht mehr vertagt** — sie sind der Inhalt des
> Branches `verbindung-ui-zu-datenbank`, zusammen mit den neuen Phasen 7b und 9b. Vertagt bleibt
> allein Phase 10 (Cloud). Siehe 0c und V8–V16.

---

## 0c. Grilling-Runde 8 (2026-09-09) — Anbindung der Buchungsseite

Ausgangslage: Die Phasen 1–7 stehen, die Buchungsseite existiert als Oberfläche, und ein Teil davon
ist bereits angeschlossen (Zimmerliste über `room_types` + `search_availability`, Bilder über
Storage). Diese Runde klärt, was „die Buchungsseite mit der Datenbank verbinden" vollständig heißt.

**Was beim Erheben des Ist-Standes gefunden wurde** — jeder Punkt hat eine Frage ausgelöst:

| Lücke | Bezug |
| --- | --- |
| Keine generierten Typen (`src/shared/types/` existierte nicht), Client untypisiert | Phase 8 |
| Keine Service-Schicht — die View ruft `supabase.from`/`.rpc`/`.storage` direkt | Phase 8.4 (dort ausdrücklich verboten) |
| Kalender kennt `availability_calendar` nicht: `selectable: !isPast` — Ausgebuchtes ist wählbar | Phase 9 |
| Keine Zimmerauswahl — `room_type_id` landet nirgends | im Plan nicht vorgesehen |
| Checkout ist Figma-Attrappe („Double Suite", „732 €", „Maxime Musterfrau") | im Plan nicht vorgesehen |
| `submit()` endet in `console.log`, `create_booking` wird nie gerufen | im Plan nicht vorgesehen |
| Rechnungsadress-Formular hat **kein Ziel im Schema** — `customers` hat keine Adressspalten | → E42 |
| Kalender blättert unbegrenzt vorwärts, `booking_horizon_days` = 365 | E30 |
| Gästezahl doppeldeutig: pro Zimmer (Datenbank) vs. gesamt (Oberfläche) | → E45 |
| Popup-Text verspricht eine Bestätigungsmail; `bookings` kennt kein `pending` | E11 → E46 |

### Fragen und Antworten

Fünf Runden, 30 Fragen. `README.md` enthält die Begründungen der Domänenentscheidungen (E42–E46),
hier steht, **was** gefragt und entschieden wurde — damit später nachvollziehbar ist, dass es eine
Frage *war*.

| #   | Frage | Entscheidung |
| --- | ----- | ------------ |
| Q1  | Umfang: nur Typen/Service, plus Kalender, oder plus Buchungsabschluss? | **alles** — Phase 8 + 9 + Buchungsabschluss |
| Q2  | Rechnungsadresse: Felder streichen, Attrappe lassen oder Schema erweitern? | **eigene Tabelle** `billing_addresses`, 1:n zum Kunden (E42) |
| Q3  | Generierte Typen und was aus `room.interface.ts` wird | `db:types`, DB-nahe Interfaces ableiten, View-Typen bleiben handgeschrieben (V8) |
| Q4  | Zuschnitt der Service-Schicht | drei Dateien, `supabase` nur noch dort (V9) |
| Q5  | Wo lebt der Buchungsentwurf? | `bookingState` wird der vollständige Entwurf, kein `sessionStorage` (V10) |
| Q6  | Eine Seite oder drei Schritt-Routen? | **eine Seite** (V11) |
| Q7  | Testumfang | **vorerst keine Tests**, werden später nachgezogen (V12) |
| Q8  | Spaltenzuschnitt der neuen Tabelle | Straße/Hausnummer getrennt, `country_code` ISO-2, nur `archived_at` (E42) |
| Q9  | Buchung ↔ Adresse: Verweis oder eingefrorene Kopie? | **Verweis**, Zeile unveränderlich (E43) |
| Q10 | Wie kommt die Adresse in `create_booking`? | **Skalarparameter**, kein `jsonb` (V13) |
| Q11 | Wie viel Kalender laden wir wann? | ganzer Horizont einmal je Belegung, im Speicher gecacht (V14) |
| Q12 | Wie wählt der Gast ein Zimmer aus? | *überholt durch Q26* — Mengenwähler statt Auswahl-Button |
| Q13 | Fehlerform an der Service-Naht | Ablehnung als **Ergebnis** (Result-Union), Infrastrukturfehler werfen (V15) |
| Q14 | Was passiert nach erfolgreicher Buchung? | **Popup** nach Figma-Entwurf, später zusätzlich Mail |
| Q15 | „Extra Angebot 23 €" | *präzisiert in Q18* |
| Q16 | Popup-Text widerspricht E11, Buchungsnummer fehlt | Text angepasst, Buchungsnummer ergänzt (E46) |
| Q17 | Popup-Mechanik und Ort der Komponente | `src/shared/ui/modal.ts`, `<dialog>`, genau ein Ausgang (V16) |
| Q18 | Extra-Zeile sichtbar oder nur im Code? | Bausteine bleiben, Zeile wird **nicht gerendert** (V16) |
| Q19 | Pflichtfelder und Absende-Button | Button aktiv, Prüfung beim Klick; Gästezahl verpflichtend; Datenschutz bleibt Text (V16) |
| Q20 | Buchungshorizont im Kalender | vorwärts kappen, Grenze aus `hotels.booking_horizon_days` (V14) |
| Q21 | Auswahl bei geänderter Gästezahl | *ersetzt durch Q27* |
| Q22 | RLS der neuen Tabelle | *präzisiert in Q28/Q30* |
| Q23 | Commit-Schnitt | *ersetzt durch Q29* |
| Q24 | Eine Kategorie mit Menge, oder mehrere Kategorien je Vorgang? | **mehrere Kategorien**, `p_positions jsonb` (E44) |
| Q25 | Gästezahl pro Zimmer oder pro Reise? | **pro Zimmer** (E45) |
| Q26 | Umsetzung der Zimmerauswahl | Mengenwähler je Karte, Obergrenze 8 Zimmer (V16) |
| Q27 | Auswahl bei geändertem Zeitraum/geänderter Gästezahl | Zeitraum behalten, Mengen zurücksetzen, Hinweis zeigen (V16) |
| Q28 | Wer darf die Rechnungsadresse lesen und ändern? | Kunde selbst **und** Mitarbeitende (E43) |
| Q29 | Commit-Schnitt mit Positionen | **fünf Commits** (V17) |
| Q30 | „Ändern dürfen" gegen „eine Buchung ist ein Vertrag" | Ändern nur auf **unbenutzten** Adressen, auch für Staff (E43) |

**Zwei Fragen haben eine frühere Antwort umgeworfen** — das ist der Ertrag der Runde, nicht ihr
Makel: Q24 hat Q12 („`p_rooms` fest auf 1") kassiert, und Q30 hat gezeigt, dass Q28 und Q9 sich
widersprachen. Beide Widersprüche wären sonst als Code entstanden und erst beim Debuggen aufgefallen.

### Vorgehensentscheidungen V8–V17

| #   | Entscheidung | Begründung in Kurzform |
| --- | ------------ | ---------------------- |
| **V8** | `pnpm db:types` erzeugt `src/shared/types/database.types.ts`; Client als `createClient<Database>`. DB-nahe Typen werden **abgeleitet** (`Database['public']['Functions'][…]['Returns'][number]`, `Tables<'room_types'>`), reine View-Typen (`RoomCard`, `RoomAmenity`, `RoomCardAvailability`) bleiben handgeschrieben. `post.interface.ts` fällt weg. | Phase 8.3: handgeschriebene Tabellentypen driften. View-Typen sind keine Tabellen und driften nicht — sie pauschal mitzugenerieren gäbe es gar nicht. |
| **V9** | Drei Dateien unter `src/shared/services/`: `availability.service.ts` (`availability_calendar`, `search_availability`), `booking.service.ts` (`create_booking`), `roomTypes.service.ts` (Stammdaten, Bild-URLs, Hoteldaten). **`supabase` wird außerhalb von `services/` nicht mehr importiert** — auch nicht für `getPublicUrl`. | Phase 8.4 verlangt es. Eine Regel mit einer Ausnahme für „nur schnell die Bild-URL" ist nach einer Woche keine Regel mehr. |
| **V10** | `bookingState` wird der vollständige Buchungsentwurf (Zeitraum, Belegung, Mengen je Kategorie, Kontakt- und Rechnungsdaten). `this.guests` verlässt die View. **Kein** `sessionStorage`. | Sonst muss die Zusammenfassung ihre Werte aus zwei Quellen zusammenklauben. Gegen Persistenz spricht nicht der Aufwand, sondern die Fehlerklasse: ein wiederhergestellter Entwurf mit abgelaufener Verfügbarkeit. |
| **V11** | Es bleibt **eine** Seite `/buchung`. `BookingStep` wird Fortschrittsanzeige und Sprungziel, kein Router-Konzept. | Der Kommentar in `bookingState` beschreibt eine Absicht, das Markup eine Tatsache — und die Tatsache ist fertig gebaut und entspricht dem Entwurf. |
| **V12** | **Vorerst keine Tests** für die Frontend-Seite; werden später nachgezogen. Die 91 Tests aus `pnpm test:db` decken die RPCs weiter ab. | Ausdrücklich so entschieden (Q7). Konsequenz, damit sie nicht überrascht: Die E29-Regel und `buildRoomCards` sind ab jetzt nur über die Oberfläche geprüft. Deshalb V16, letzter Punkt: die Regeln werden trotzdem als eigenständige Funktionen herausgezogen. |
| **V13** | Die Rechnungsadresse kommt als **fünf Skalarparameter** in `create_booking`, nicht als `jsonb`. | Skalare erscheinen in den generierten Typen benannt und typisiert. Das `jsonb` aus E44 ist kein Gegenbeispiel: eine Liste variabler Länge lässt sich nicht als Skalare ausdrücken, eine feste Adresse schon. |
| **V14** | Kalender: **einmal** der ganze Horizont je Belegungskombination, im Speicher gecacht (Schlüssel `${adults}-${children}`); Nachladen nur bei geänderter Belegung. Vorwärtsblättern endet bei `hotels.booking_horizon_days`. | 365 Zeilen sind für Postgres nichts, und das Blättern wird sofort. Monatsweises Nachladen macht jeden Monatswechsel zu einem Ladezustand — die Variante, die man später wieder ausbaut. Die Horizontgrenze kommt aus den Stammdaten, nicht als Konstante ins Frontend (E30). |
| **V15** | `bookingService.createBooking()` liefert `{ ok: true, data } \| { ok: false, error: { code, date, roomTypeId, message } }`. Lesezugriffe **werfen** weiterhin. Der Service parst `error.details` als JSON und fällt bei unparsbarem Inhalt auf `error.message` zurück. | Eine ausgebuchte Nacht ist ein erwartetes Ergebnis, kein Ausnahmefall — und die Oberfläche braucht `datum` und Kategorie, um den Hinweis an der richtigen Stelle zu zeigen (E31). Bei Lesezugriffen gibt es keine fachliche Ablehnung, nur kaputte Infrastruktur. |
| **V16** | Oberfläche: Mengenwähler je Zimmerkarte (0 bis `min(rooms_free, 8 − bereits gewählte)`), Hervorhebung ab Menge > 0, Auswahlleiste mit Summe; Bestellzeilen je Kategorie mit Menge > 0; Absende-Button immer aktiv mit Prüfung beim Klick; Gästezahl verpflichtend; Datenschutzhinweis bleibt Text; Extra-Angebot-Zeile wird nicht gerendert; Bestätigung über `src/shared/ui/modal.ts` (`<dialog>`, genau ein Ausgang). Wählbarkeits- und Zusammenführungsregeln werden als **eigenständige Funktionen** herausgezogen. | Details und Begründungen in Phase 9/9b. Das Herausziehen der Regeln passiert trotz V12 — es kostet nichts und ist die Voraussetzung dafür, dass die Tests später ohne Umbau nachgezogen werden können. |
| **V17** | **Fünf Commits** auf `verbindung-ui-zu-datenbank`, jeder für sich lauffähig (anders als die Phasen 1–7). Danach ein Tagebuch-Eintrag. | Siehe „Commit-Schnitt" unten. Der Tagebuch-Eintrag, weil dieser Branch drei Entscheidungen enthält, die man aus Migrationen nicht rekonstruiert (V7). |

### Commit-Schnitt

| # | Inhalt | Phase |
| - | ------ | ----- |
| 1 | Migration `billing_addresses` samt RLS und `billing_address_in_use()` | 7b |
| 2 | Migration `create_booking` neu: Positionen **und** Rechnungsadresse in einem Schritt | 7b |
| 3 | Typen generieren, Service-Schicht, bestehende Zugriffe umziehen — **Verhalten unverändert** | 8 |
| 4 | Kalender aus `availability_calendar`, E29-Regel, Horizont-Kappung | 9 |
| 5 | Mengenwähler, Checkout, `create_booking`, Bestätigungs-Popup | 9b |

Commit 2 fasst beide Änderungen an `create_booking` zusammen, weil beide dieselbe Funktion ersetzen —
zwei `drop`/`create`-Runden hintereinander helfen niemandem.

> **Nachtrag 2026-09-16 — Mengenwähler vorgezogen (Grilling-Runde 9).** Der Mengenwähler aus
> Phase 9b, Punkt 1 ist **vor** den Commits 1–4 umgesetzt worden, als eigener Commit auf demselben
> Branch. Er ist ohne Migration, Typen und Service-Schicht lauffähig, und die Commits 3 und 4
> fassen sein Markup nicht an. Frontend-only heißt hier wörtlich: die Mengen stehen in
> `bookingState` (erster Schritt von V10, geschlüsselt nach `room_type_id`), aber noch in keinem
> Aufruf — `create_booking` bekommt sie erst mit Commit 2 und 5. Mitgeliefert sind auch Punkt 1
> von V16.6 (Abgleich der Mengen nach jeder neuen Suche) und die Hervorhebung gewählter Karten;
> Auswahlleiste (9b.2) und Bestellzeilen (9b.4) bleiben bei Commit 5.
>
> Die Obergrenze bleibt bei **8** Zimmern (`MAX_ROOMS_PER_BOOKING` in
> `src/views/BookingView/roomQuantity.ts`) — eine abweichende Zahl in der Oberfläche wurde
> erwogen und verworfen, weil der Gast die Ablehnung sonst erst beim Absenden erfährt. Mit dem
> Minimalseed (8 Zimmer in 3 Kategorien, V4) kann die Grenze nie greifen; sie ist trotzdem
> umgesetzt, weil der Seed nicht die Regel ist.

---

## Phase 1 — Werkzeuge und Projektgerüst (E7, E35)

**Ziel:** Schema als Code, lokal reproduzierbar, ohne die Cloud-Instanz anzufassen.

1. Supabase CLI als Dev-Dependency (nicht global — sonst hat jede Maschine eine andere Version):
   `pnpm add -D supabase`
2. `pnpm supabase init` → erzeugt `supabase/config.toml`
3. `pnpm supabase start` → lokale Postgres-Instanz in Docker
4. Skripte in `package.json` ergänzen:
   `db:start`, `db:stop`, `db:reset` (`supabase db reset` — spielt alle Migrationen + Seed neu ein),
   `db:diff`, `db:types` (`supabase gen types typescript --local`)
5. Umgebung trennen (E35):
   - `git rm --cached .env`, `.env` in `.gitignore` aufnehmen
   - `.env.example` committen — mit den **lokalen** Werten (`http://127.0.0.1:54321` + der lokale
     anon key; beide sind bei Supabase auf jeder Maschine identisch und kein Geheimnis)
   - `.env` lokal auf die Werte der lokalen Instanz setzen; `pnpm dev` zeigt ab jetzt **nicht** mehr
     auf die Cloud (V2)
   - `src/shared/services/supabase.ts` auf `import.meta.env` umstellen
   - Der Service-Role-Key heißt `SUPABASE_SERVICE_ROLE_KEY` — **ohne** `VITE_`-Präfix
6. Testgerüst anlegen (E34): `pnpm test:db` als eigenes Skript, eigene Vitest-Config, zwei Clients
   (Service-Role für Fixtures, anon für RLS). `pnpm test` bleibt unverändert und darf **nie** Docker
   voraussetzen.

**Zu Schritt 5, damit keine Verwirrung entsteht:** Der publishable/anon key ist **kein Geheimnis**
und darf im Browser stehen — das Verschieben in `.env` dient der *Umgebungstrennung* (lokal / Cloud),
nicht der Geheimhaltung. Der Schutz ist RLS (E13), nicht die Verborgenheit des Keys. Die
`VITE_`-Regel schützt dagegen sehr wohl etwas: Vite bündelt jede `VITE_`-Variable in den Browser,
und der Service-Role-Key umgeht RLS vollständig.

**Ab hier ist Docker Projektvoraussetzung** — das gehört ins README des Repos, nicht nur hierher.

**Fertig, wenn:** `pnpm db:reset` fehlerfrei durchläuft, `pnpm dev` gegen die lokale Instanz
funktioniert und `pnpm test` ohne laufendes Docker grün ist.

---

## Phase 2 — Stammdaten (E14, E3, E15, E19, E22)

Eine Migration pro fachlichem Schritt, nicht eine große. Migrationen sind unveränderlich, sobald sie
geteilt sind — ab dann wird nur noch vorwärts migriert.

1. `hotels` + eine Seed-Zeile
2. `room_types` (inkl. `max_occupancy`, `archived_at`)
3. `rooms`
4. `room_type_images` + Storage-Bucket `room-images` (öffentlich lesbar, Schreiben nur `is_staff()`).
   Die Bilddateien selbst kommen über `supabase/scripts/seed-storage.mjs` in den Bucket — SQL kann
   keine Binärdateien hochladen, und ein Reset leert den Storage mit. Das Skript hängt deshalb an
   `pnpm db:reset` und ist idempotent (`upsert`).
5. `room_blocks` inkl. `EXCLUDE`-Constraint
6. Seed (V4, minimal): 1 Hotel mit `booking_horizon_days = 365`, **3** Kategorien, **8** Zimmer.
   Es existieren genau zwei Zimmerbilder (`double-premium.jpg`, `double-suite.jpg`) — die dritte
   Kategorie bleibt bewusst ohne Bild, denn „Kategorie ohne Bild" ist ein Fall, den die UI später
   ohnehin aushalten muss.
7. **RLS jetzt aktivieren (V3)**, nicht erst in Phase 7: `is_staff()` (v1 `false`),
   `current_customer_id()`, `ENABLE ROW LEVEL SECURITY` auf den bereits existierenden Tabellen samt
   Policies. Jede spätere Tabelle bekommt ihre Policies in derselben Migration, in der sie entsteht.
   Phase 7 prüft danach nur noch das Gesamtbild.

**Fertig, wenn:** überlappende Sperrungen für dasselbe Zimmer von der Datenbank **abgelehnt** werden
(Test 1 aus E34 — der Fehler ist das erwartete Ergebnis).

---

## Phase 3 — Preise (E5, E8, E25)

1. `rate_plans` + Seed-Zeile `STANDARD`
2. `room_type_rates` inkl. `daterange`-Generierung und `EXCLUDE`-Constraint
3. `find_rate_gaps(tage int)`
4. Seed: Saisonpreise für die nächsten 12 Monate — deckungsgleich mit
   `booking_horizon_days = 365` (V4), damit keine Lücke entsteht, die nur nach einem Fehler aussieht

**Fertig, wenn:** zwei überlappende Preiszeiträume für dieselbe Kategorie und denselben Rate-Plan
abgelehnt werden (Test 2 aus E34) **und** `find_rate_gaps(365)` eine absichtlich gerissene Lücke
findet.

---

## Phase 4 — Kunden und Buchungen (E4, E11, E16, E20–E23, E26, E27, E32)

1. ~~`citext`-Extension~~ — **entfällt (E32).** Stattdessen: `customers.email_normalized` als
   `GENERATED ALWAYS AS (lower(email)) STORED NOT NULL UNIQUE`
2. `customers`
3. `booking_groups`
4. `bookings` inkl. aller `CHECK`s, generierter `stay`-Spalte und Teil-`EXCLUDE`
5. `booking_nights`
6. `booking_events`
7. `booking_reference`-Generator (8 Zeichen, Alphabet ohne `I O 0 1`, Kollisionsbehandlung)
8. `is_blocking_status(text)` — `IMMUTABLE`
9. Indizes aus `schema.md`, Abschnitt 5

**Fertig, wenn:** zwei Buchungen mit **demselben zugewiesenen Zimmer** und überlappendem Zeitraum
abgelehnt werden, eine Buchung mit `status = 'cancelled'` ohne `cancelled_at` abgelehnt wird, und
eine Buchung mit Abreise = Anreise der nächsten **akzeptiert** wird (Test 3 aus E34, der halb-offene
Fall aus E8/E29 — er ist der wichtigste in diesem Satz).

---

## Phase 5 — Verfügbarkeit (E17, E18, E24, E28, E29, E30)

1. `availability_calendar(von, bis, erwachsene, kinder, kategorie?)` → eine Zeile **pro Nacht**
2. `search_availability(anreise, abreise, erwachsene, kinder)` → eine Zeile **pro Kategorie**
   (Minimum über den Zeitraum + Gesamtpreis)
3. Beide `SECURITY DEFINER`, fixiertes `search_path`, `EXECUTE`-Rechte gezielt vergeben
4. Sperrgründe zweistufig: feine Codes nur bei `is_staff()`, sonst generisch

**Kapazitätsformel und Tagessemantik: siehe `schema.md`, Abschnitt 3.** Nicht neu erfinden.

**Fertig, wenn diese vier Fälle stimmen:**

| Testfall | Erwartung |
| --- | --- |
| Kategorie mit 3 Zimmern, 3 blockierende Buchungen in einer Nacht | `rooms_free = 0`, Grund `ausgebucht` |
| dieselbe Nacht, eine Buchung storniert | `rooms_free = 1` |
| ein Zimmer der Kategorie an dieser Nacht gesperrt | `rooms_free` um 1 kleiner (E18) |
| Nacht ohne Preiszeile | nicht buchbar, Grund `kein_preis` — **nicht** Preis 0 (E25). Test 4 aus E34 |

Zusätzlich: anonyme Aufrufe erhalten **niemals** `kein_preis`/`zu_klein`, sondern den generischen
Grund (E28), und Anfragen jenseits `booking_horizon_days` liefern `ausserhalb_horizont` (E30).

---

## Phase 6 — Buchen (E6, E10, E21, E26, E31, E32, E33)

1. `create_booking(...)` nach dem Ablauf in `schema.md`, Abschnitt 3 — der Advisory-Lock ist
   **hotelweit** (`hashtext('booking:' || hotel_id)`), nicht pro Kategorie (E33)
2. Strukturierter Fehler: Code + Datum + Grund (E31)
3. Mehrere Zimmer: `booking_groups`-Zeile + *n* `bookings` in **einer** Transaktion
4. `booking_nights` aus den Saisonpreisen einfrieren
5. `booking_events`-Eintrag `created`

**Fertig, wenn:** ein Nebenläufigkeitstest zwei gleichzeitige Buchungen auf das **letzte** Zimmer
abfeuert und **genau eine** gewinnt, während die andere einen strukturierten Fehler bekommt
(Test 5 aus E34). Dieser Test ist der Kern von E10 — ohne ihn ist die Entscheidung nur behauptet.

Zusätzlich: eine zweite Buchung mit derselben E-Mail in **anderer Schreibweise** erzeugt **keinen**
zweiten Kundendatensatz (E26/E32), und der eingefrorene Preis bleibt unverändert, nachdem die
Saisonpreise anschließend geändert wurden (Test 6 aus E34 — der Test, der beweist, dass eine Buchung
ein Vertrag ist).

---

## Phase 7 — RLS: Abnahme des Gesamtbilds (E13)

Mit **V3** ist RLS bereits seit Phase 2 aktiv, und jede Tabelle hat ihre Policies in derselben
Migration bekommen, in der sie entstand. Phase 7 aktiviert also nichts mehr — sie **prüft** und
schließt die Lücken, die beim schrittweisen Bauen entstanden sind.

Die Prüfung ist als Funktion umgesetzt und nicht als Checkliste (E40): `rls_audit()` meldet
Tabellen ohne RLS, Tabellen ohne jede Policy, Policies mit direktem `auth.uid()`,
`SECURITY DEFINER` ohne fixiertes `search_path`, interne Funktionen mit `EXECUTE` für `anon`, nicht
entzogene Rechte auf `booking_events` und Schreib-Policies auf `bookings`. **Keine Zeilen =
bestanden** — und die Prüfung gilt auch für Tabellen, die es heute noch nicht gibt.

1. `rls_audit()` anlegen und gegen absichtliche Verstöße gegenprüfen (eine Prüffunktion, die nie
   etwas findet, ist nicht von einer kaputten zu unterscheiden)
2. Befunde abarbeiten, bis die Funktion null Zeilen liefert
3. Verhaltensprobe zusätzlich zur Katalogprüfung: die Katalogabfrage sagt, dass die Regeln **da**
   sind, die Verhaltensprobe sagt, dass sie **wirken**

**Fertig, wenn:** ein anonymer Client `select * from bookings` mit **0 Zeilen** (nicht mit einem
Fehler) beantwortet bekommt und ein direktes `insert into bookings` abgelehnt wird — Buchen geht nur
über die RPC.

**Der Satz, der hierher gehört (E35):** In v1 gibt `is_staff()` hart `false` zurück. Damit läuft
alles Administrative über den Service-Role-Key, der **nie** in den Browser darf. Der Tag, an dem
jemand ihn ins Frontend legt, weil „der Admin-Bereich sonst nicht geht", ist der Tag, an dem RLS
wertlos wird. Der Ausweg ist dann nicht der Key, sondern der Seam aus E13: `is_staff()` an genau
einer Stelle ändern.

---

## Phase 7b — Schema-Nachträge für die Buchungsseite (E42, E43, E44, E45)

**Ziel:** Alles, was die Oberfläche braucht und im Schema noch fehlt — in zwei Migrationen, vorwärts.
Die Migrationen der Phasen 1–7 werden **nicht** angefasst; sie sind geteilt und damit unveränderlich.

### Commit 1 — `billing_addresses`

1. Tabelle `billing_addresses` nach E42: `customer_id` (`on delete restrict`), `street`,
   `house_number`, `postal_code`, `city`, `country_code` (`check char_length = 2`), `archived_at`,
   Zeitstempel + `set_updated_at`-Trigger wie überall.
2. `billing_address_in_use(uuid)` — `SECURITY DEFINER`, `set search_path = ''`, `stable`. Liefert
   `true`, sobald eine Buchung auf die Adresse zeigt. `SECURITY DEFINER` ist hier **nicht** wegen
   Privilegien nötig, sondern damit die Policy nicht durch die RLS von `bookings` hindurchfragen muss
   und dabei je nach Aufrufer ein anderes Ergebnis bekommt.
3. RLS nach E43:
    - `select using (customer_id = (select public.current_customer_id()) or public.is_staff())`
    - `update using (… wie select …) with check (… wie select …)` **plus**
      `not public.billing_address_in_use(id)` in **beiden** Klauseln — sonst kann eine unbenutzte
      Adresse per Update auf eine benutzte gedreht werden.
    - **kein** `insert`, **kein** `delete`. Angelegt wird nur in `create_booking`.
4. `revoke`/`grant` für `billing_address_in_use` nach dem Muster der anderen internen Funktionen.

**Fertig, wenn:** `rls_audit()` weiterhin **null Zeilen** liefert. Die Prüffunktion aus Phase 7 gilt
ausdrücklich auch für Tabellen, die es damals noch nicht gab — das ist jetzt der erste Ernstfall.

### Commit 2 — `create_booking` neu

1. Alte Funktion `drop`en (Signaturwechsel, keine Überladung — E44).
2. Neue Signatur: `p_positions jsonb`, `p_check_in`, `p_check_out`, `p_adults`, `p_children`,
   `p_email`, `p_first_name`, `p_last_name`, `p_phone`, dazu die fünf Adressparameter aus V13.
3. Eingaben prüfen, bevor irgendetwas passiert: `p_positions` ist ein nicht-leeres Array, jede
   Position hat `room_type_id` (uuid) und `rooms >= 1`, **keine Kategorie doppelt**, Summe der Zimmer
   ≤ 8. Verstöße → `reject_booking('ungueltige_belegung', p_check_in)`.
4. Advisory-Lock **unverändert** hotelweit (E33) — er deckt jetzt alle Positionen mit ab. Das
   Hotel wird über die **erste** Position ermittelt; Positionen aus verschiedenen Hotels sind ein
   Eingabefehler, kein Anwendungsfall (E14).
5. Prüfschleife pro Position × Nacht wie bisher, mit derselben Reihenfolge der Gründe
   (`vergangenheit` → `ausserhalb_horizont` → `zu_klein` → `ausgebucht` → `kein_preis`). Die
   Belegung `p_adults`/`p_children` gilt **pro Zimmer** (E45) und damit für jede Position gleich.
6. `reject_booking` um `room_type_id` im `DETAIL`-JSON erweitern (E44, Preis-Absatz) — die Oberfläche
   muss wissen, an welcher Karte sie den Hinweis zeigt.
7. Rechnungsadresse anlegen: **nach** dem Kunden-Upsert, **vor** den Buchungen, in derselben
   Transaktion. Keine Wiederverwendung bestehender Adressen — in v1 kann der Gast seine vorhandenen
   ohnehin nicht sehen (E43).
8. `booking_groups`-Zeile anlegen, sobald **insgesamt** mehr als eine Buchung entsteht — also auch
   bei zwei Positionen mit je einem Zimmer. Die bisherige Bedingung `p_rooms > 1` reicht nicht mehr.
9. Rückgabe: `booking_group_id`, `bookings[]` (unverändert je Zimmer), `nights`,
   `total_amount_cents` als **Summe über alle Positionen** — die bisherige Formel `v_total * p_rooms`
   ist mit Positionen falsch.
10. `revoke`/`grant`/`comment` neu setzen. Beim `drop` gehen sie mit verloren; das lautlos zu
    vergessen hieße, dass `anon` nicht mehr buchen kann.

**Fertig, wenn:** die Tests aus `supabase/tests/create-booking.spec.ts` auf die neue Signatur
angepasst grün sind — **einschließlich** des Nebenläufigkeitstests (E39, „mehr als zwei gleichzeitige
Anfragen"). Zusätzlich zwei neue Fälle: eine Buchung über **zwei** Kategorien erzeugt **eine** Gruppe
und zwei Buchungen mit korrekter Summe, und eine Position, deren Kategorie ausgebucht ist, lehnt den
**ganzen** Vorgang ab — inklusive der anderen, verfügbaren Position. Das ist der Sinn von „eine
Transaktion".

> **Achtung bei Commit 2:** Hier wird die Funktion angefasst, an der die Kernaussage von E10 hängt.
> Wer den Nebenläufigkeitstest nach dem Umbau nicht laufen lässt, hat die Entscheidung nur noch
> behauptet.

---

## Phase 8 — Typen und Service-Schicht (V8, V9, V10, V13, V15)

**Ziel:** Die Naht zwischen Datenbank und Oberfläche entsteht. **Das Verhalten der Seite ändert sich
in dieser Phase nicht** — wer am Ende einen Unterschied im Browser sieht, hat zu viel gemacht.

1. `pnpm db:types` → `src/shared/types/database.types.ts`; `supabase.ts` auf
   `createClient<Database>(…)` umstellen.
2. `room.interface.ts` aufteilen (V8): `RoomAvailability`, `RoomTypeDetail`, `RoomTypeImage` werden
   Ableitungen aus `Database`; `RoomCard`, `RoomCardAvailability`, `RoomAmenity` bleiben, wo sie sind
   — sie beschreiben die Karte, nicht die Tabelle. `post.interface.ts` fällt weg, `Posts.ts` und
   `SinglePost.ts` ziehen mit.
3. Service-Schicht anlegen (V9):
    - `roomTypes.service.ts` — Kategorien samt Bildern, öffentliche Bild-URLs, Hotelstammdaten
      (`check_in_time`, `check_out_time`, Adresse, `booking_horizon_days` für V14/Phase 9).
    - `availability.service.ts` — `availability_calendar`, `search_availability`.
    - `booking.service.ts` — `create_booking` mit dem Result-Union aus V15, handgeschriebenem
      Eingabetyp für `p_positions` und einer schmalen Laufzeitprüfung des `jsonb`-Ergebnisses
      (E44: die generierten Typen sagen dazu nur `Json`).
4. `Booking.ts`, `Posts.ts`, `SinglePost.ts` auf die Services umstellen. Danach findet
   `grep -rn "from.*services/supabase" src/ --include=*.ts | grep -v "src/shared/services/"`
   **nichts** mehr. Diese Zeile ist die Prüfung, nicht der gute Vorsatz.
5. `bookingState` zum vollständigen Entwurf ausbauen (V10): Zeitraum, Belegung, Mengen je Kategorie,
   Kontakt- und Rechnungsdaten. `this.guests` wandert aus der View hinein. `isStepComplete(2|3)`
   bekommt endlich eine echte Bedingung.

**Fertig, wenn:** `pnpm build` (also `tsc`) durchläuft, `pnpm lint` grün ist, die Seite sich exakt
wie vorher verhält — und ein absichtlich in einer Migration umbenanntes Feld nach `pnpm db:types`
einen **Typfehler** erzeugt. Genau das ist der Gegenwert von E7.

---

## Phase 9 — Kalender an `availability_calendar` (E24, E28, E29, E30, V14)

1. Kalender aus `availability_calendar` speisen — einmal über den ganzen Horizont je
   Belegungskombination, im Speicher gecacht (V14).
2. **Tagesregel als eigene Funktion** herausziehen, nicht im Render-Zweig verstecken:
   `isSelectableAsCheckIn(night)` = diese Nacht frei; `isSelectableAsCheckOut(night)` = die
   **vorherige** Nacht frei. Welche der beiden gilt, hängt davon ab, ob bereits ein Anreisetag
   gewählt ist. Das Herausziehen passiert trotz V12 (keine Tests jetzt) — es kostet nichts und ist
   die Voraussetzung dafür, dass die Prüfung später ohne Umbau nachgezogen wird.
3. Nicht wählbare Tage durchgestrichen, Tooltip mit Datum und Grund. Für Gäste ist der Grund fast
   immer `nicht_buchbar` (E28/`mask_reason`) — der Text muss also ohne feine Unterscheidung
   auskommen und trotzdem etwas sagen.
4. Vorwärtsblättern bei `hotels.booking_horizon_days` kappen: `canGoNext()` symmetrisch zum
   vorhandenen `canGoPrev()`, Grenze aus den Stammdaten (E30), **nicht** als Konstante im Frontend.
5. Belegungsänderung lädt den Kalender neu; eine dadurch ungültig gewordene Auswahl wird nach der
   Regel aus V16/Phase 9b behandelt.

**Fertig, wenn:** eine ausgebuchte Nacht ihr Datum als **Anreisetag** sperrt und als **Abreisetag**
wählbar lässt. Dieser eine Fall ist die Auszahlung von E8 — stimmt er nicht, verkauft die Seite keine
Anschlussnächte. Zweitens: Der Kalender lässt sich nicht über den Horizont hinaus blättern.

---

## Phase 9b — Zimmerauswahl, Checkout und Buchen (E44, E45, E46, V15, V16)

1. **Mengenwähler** je Zimmerkarte (`−` / Zahl / `+`), Start 0, Obergrenze
   `min(rooms_free, 8 − bereits gewählte Zimmer)`. Nicht buchbare Kategorien zeigen keinen Wähler,
   sondern ihren Grund. Karten mit Menge > 0 werden hervorgehoben.
2. Auswahlleiste unter der Liste („2 Zimmer · 4 Nächte · 1.464 €") mit Sprung zum Checkout.
3. `search_availability` kennt **kein** `p_rooms`: Die Ausgrauung „nur noch 1 Zimmer frei, du willst
   2" rechnet das Frontend aus `rooms_free`. Das ist eine Bequemlichkeit, **keine** zweite Wahrheit —
   verbindlich prüft `create_booking` (Leitsatz 1).
4. Bestellzeilen im Checkout: **eine je Kategorie mit Menge > 0**, gerendert mit dem vorhandenen
   `getOrderRowHtml()`. Damit bekommt auch das Entfernen-Kreuz aus dem Entwurf eine echte Funktion
   (Menge auf 0). Die Zeile „Extra Angebot 23 €" wird **nicht** gerendert (V16): Sie steckt in keiner
   Summe, und eine sichtbare Position, die im Gesamtpreis fehlt, ist ein Rechenfehler vor den Augen
   des Gastes. Bausteine und `ICON_REMOVE` bleiben für die späteren Zusatzleistungen stehen.
5. Zusammenfassung aus echten Daten: Hoteladresse und Uhrzeiten aus `hotels`
   (`check_in_time`/`check_out_time`), Zeitraum und Belegung aus `bookingState`, Preise aus
   `search_availability`. Die Gästezahl wird als **„Gäste pro Zimmer"** beschriftet (E45).
6. **Auswahl invalidieren** (V16/Q27), wenn sich Zeitraum oder Belegung ändern: Zeitraum behalten,
   Mengen dort auf 0 setzen, wo die Kategorie nicht mehr buchbar oder nicht mehr in der Menge
   verfügbar ist, und einen Hinweis über der Liste zeigen („Ihre Auswahl wurde angepasst: Double
   Premium fasst maximal 3 Gäste."). Der Zeitraum ist die teurere Entscheidung des Gastes, die Menge
   die billigere — also fällt die billigere.
7. **Prüfung beim Klick**, nicht per deaktiviertem Button: Pflicht sind Zeitraum, mindestens ein
   Zimmer, Belegung (verpflichtend, kein stiller Suchdefault), Vorname, Nachname, E-Mail sowie
   Straße, Hausnummer, PLZ, Ort, Land (wegen `billing_address_id not null`). Telefon bleibt optional.
   Bei Verstoß: die rote Zeile aus dem Entwurf anzeigen und in das erste ungültige Feld springen.
   Der Datenschutzhinweis bleibt Text — eine echte Einwilligung bräuchte Checkbox **und** eine
   Spalte mit Zeitpunkt und ist ein eigener Vorgang, kein Nebenprodukt.
8. `booking.service.ts` aufrufen und das Ergebnis nach V15 auswerten. Bei Ablehnung: Hinweis am
   Datum **und** an der Kategorie aus dem `DETAIL`-JSON, danach Kalender und Zimmerliste neu laden —
   die Ablehnung heißt, dass sich die Verfügbarkeit geändert hat.
9. Bei Erfolg: `bookingState.reset()`, dann Bestätigung über `src/shared/ui/modal.ts` (`<dialog>` mit
   `showModal()` — Fokusfang und Hintergrundsperre gibt es damit geschenkt). Inhalt nach E46:
   Hirsch-Logo, „Vielen Dank für Ihre Buchung.", „Ihre Buchung ist bestätigt.", „Wir freuen uns auf
   Sie.", **Buchungsnummer**, Zeitraum, Gesamtpreis, Button „zurück zur Homepage". **Genau ein
   Ausgang:** Button, Escape und Klick auf den Hintergrund führen alle zur Router-Navigation nach
   `/`. Jeder Weg, der nur schließt, ließe den Gast auf einem Formular zurück, dessen Buchung bereits
   getätigt ist.
10. Ein Kommentar am geänderten Popup-Satz hält fest, warum er vom Entwurf abweicht und wann er
    zurückkommt (E46).

**Fertig, wenn:** eine Buchung über **zwei** Kategorien durchläuft, das Popup die Buchungsnummer
zeigt, und ein zweiter Versuch auf das **letzte** freie Zimmer eine Ablehnung mit dem richtigen Datum
**und** der richtigen Karte erzeugt.

**Bewusst offen nach dieser Phase:** keine Tests auf der Frontend-Seite (V12), keine Bestätigungsmail
(E46), keine Belegung je Position (E45), keine Zusatzleistungen, keine Einwilligung mit Zeitstempel.
Alle fünf sind benannt, keine ist versehentlich.

---

## Phase 10 — Erst danach: Cloud

**Entschieden (V2):** Die bestehende Instanz ist ein Wegwerf-Spike. **Kein** `supabase db pull` — die
Migrationshistorie beginnt bei `hotels`. Das war die Entscheidung mit Datenverlust-Potenzial, und sie
ist am 2026-09-02 ausdrücklich freigegeben worden; die Instanz enthält ausschließlich Daten aus dem
`posts`-Tutorial.

1. `pnpm supabase link` gegen das bestehende Projekt (oder ein frisches anlegen)
2. `supabase db push` — die Cloud erhält damit erstmals eine echte Migrationshistorie
3. `posts` kommt per E36 als eigene, letzte Migration mit — nichts weiter zu entscheiden
4. `.env` für die Cloud **nicht** committen (E35); nur `.env.example` ist im Repo

---

## Später, ausdrücklich nicht jetzt

Reihenfolge nach Nutzen, jeweils mit der Entscheidung, die den Weg offen gehalten hat:

| Erweiterung | Kosten | Seam aus |
| --- | --- | --- |
| Kundenkonten (Login, „meine Buchungen") | `user_id` verknüpfen, Policies greifen bereits | E4, E13, E26 |
| Mitarbeitende + Rollen | `is_staff()` **eine** Funktion ändern, `profiles.role` ergänzen | E13 |
| Admin-Live-Liste per Realtime **Broadcast** (nicht `postgres_changes`) | Trigger + Kanal | E6 |
| Zahlungen | neue Tabellen + Edge Function für externe Effekte | E6, E11 (`pending`) |
| Weitere Rate-Plans, Belegungspreise | Datenzeilen statt Schemaänderung | E5 |
| `booking_guests` (Namen der Mitreisenden) | reine Zusatztabelle | E16 |
| Tages-Inventar (Kontingente, Stop-Sell) | zweite Wahrheit, Pflegeaufwand | E10 |
| Mehrere Hotels | `hotel_id`-Backfill, Policies erweitern | E2, E14 |
| **`bookings` → `bookings` + `booking_items`** | **struktureller Umbau — der einzige teure** | E20, E27 |

---

## Vormals offene Punkte — Stand 2026-09-02

Alle fünf sind entschieden. Sie bleiben hier stehen, damit nachvollziehbar ist, *dass* sie eine Frage
waren, und nicht rückblickend als selbstverständlich gelten.

| # | Frage | Entschieden |
| --- | --- | --- |
| 1 | E28-Interpretation: feine Sperrgründe nur für `is_staff()` | **bestätigt.** Konsequenz benannt: da `is_staff()` in v1 `false` ist, sieht sie zunächst niemand — `find_rate_gaps()` ist der einzige Weg, eine Preislücke zu bemerken (E35) |
| 2 | Cloud-Instanz: `db pull` oder neu? | **neu** — Wegwerf-Spike, Historie beginnt bei `hotels` (V2) |
| 3 | `citext` oder `UNIQUE (lower(email))`? | **keins von beiden:** generierte Spalte `email_normalized` (E32) |
| 4 | RLS-Zeitpunkt | **früh**, direkt nach Phase 2 (V3) |
| 5 | Seed-Umfang | **minimal** (V4). Damit sind die „Fertig, wenn"-Kriterien nicht aus dem Seed heraus prüfbar — deshalb legt jeder Test seine Fixtures selbst an (E34) |

**Was bewusst ungeprüft bleibt:** die Wirksamkeit des Advisory-Locks unter realem Lastprofil. Test 5
aus E34 zeigt, dass Serialisierung greift — nicht, wie sie sich bei hundert gleichzeitigen Anfragen
verhält. Bei einem Hotel dieser Größe ist das die richtige Lücke; sie soll nur keine Überraschung
sein.
