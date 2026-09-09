# Umsetzungsplan — Datenbank-Schema Hotelanwendung

> **Zweck:** Diese Datei ist so geschrieben, dass die Umsetzung in einer **späteren Session**
> aufgesetzt werden kann, ohne die Grilling-Unterhaltung wiederholen zu müssen.
>
> **Vorher lesen:** [README.md](./README.md) (Entscheidungen E1–E36 mit Begründung) und
> [schema.md](./schema.md) (normatives Schema).
>
> **Regel für die Umsetzung:** `schema.md` ist die Quelle der Wahrheit. Weicht der Plan davon ab,
> gilt `schema.md` — oder es wird zuerst dort geändert (und in `README.md` begründet).

---

## 0. Einstieg in die nächste Session

Kopiervorlage für den ersten Prompt:

> Lies `docs/datenbank/README.md`, `docs/datenbank/schema.md` und
> `docs/datenbank/umsetzungsplan.md`. Wir setzen Phase **N** um. Halte dich an die Entscheidungen
> E1–E36; wenn dir etwas widersprüchlich vorkommt, frag nach, statt zu raten.

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

Domänenentscheidungen stehen als E1–E36 in `README.md`. Was hier steht, ist **Vorgehen** — es ändert
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

## Phase 8 — Typen und Frontend-Anbindung

1. `pnpm db:types` → generierte Typen in `src/shared/types/database.types.ts`
2. `createClient<Database>(...)` typisieren
3. `post.interface.ts` als Muster ablösen: **keine** handgeschriebenen Interfaces für Tabellen mehr —
   generierte Typen sind die Wahrheit, handgeschriebene driften
4. Ein schmaler Datenzugriffs-Layer (z. B. `src/shared/services/booking.service.ts`), der die drei
   RPCs kapselt. Views rufen **nie** direkt `supabase.rpc(...)` auf — sonst liegt Fachlogik in der
   Darstellung
5. `_testing-spike`-Aufbau (Vitest) für die Service-Schicht nutzen

**Fertig, wenn:** ein Typfehler entsteht, sobald man in einer Migration eine Spalte umbenennt und die
Typen neu generiert. Genau das ist der Gegenwert von E7.

---

## Phase 9 — Kalender-UI (E24, E28, E29)

1. Kalenderkomponente, gefüttert aus `availability_calendar`
2. Tagesregel: **Anreise** = diese Nacht frei, **Abreise** = vorherige Nacht frei
3. Nicht wählbare Tage durchgestrichen, Tooltip mit Datum + „Buchung nicht möglich"
4. Nach abgelehnter Buchung (E31): denselben Tooltip aus dem strukturierten Fehler erzeugen

**Fertig, wenn:** eine Nacht ausgebucht ist, ihr Datum als **Anreisetag** gesperrt und als
**Abreisetag** wählbar bleibt. Dieser eine Test ist die Auszahlung von E8 — steht er nicht, verkauft
die Seite Anschlussnächte nicht.

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
