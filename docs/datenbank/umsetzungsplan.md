# Umsetzungsplan — Datenbank-Schema Hotelanwendung

> **Zweck:** Diese Datei ist so geschrieben, dass die Umsetzung in einer **späteren Session**
> aufgesetzt werden kann, ohne die Grilling-Unterhaltung wiederholen zu müssen.
>
> **Vorher lesen:** [README.md](./README.md) (Entscheidungen E1–E31 mit Begründung) und
> [schema.md](./schema.md) (normatives Schema).
>
> **Regel für die Umsetzung:** `schema.md` ist die Quelle der Wahrheit. Weicht der Plan davon ab,
> gilt `schema.md` — oder es wird zuerst dort geändert (und in `README.md` begründet).

---

## 0. Einstieg in die nächste Session

Kopiervorlage für den ersten Prompt:

> Lies `docs/datenbank/README.md`, `docs/datenbank/schema.md` und
> `docs/datenbank/umsetzungsplan.md`. Wir setzen Phase **N** um. Halte dich an die Entscheidungen
> E1–E31; wenn dir etwas widersprüchlich vorkommt, frag nach, statt zu raten.

Vor jeder Phase: **Branch anlegen** (dieses Repo arbeitet mit Themenbranches, siehe
`FORK-WORKFLOW.md`).

**Zustand der Umgebung (geprüft am 2026-08-17):**

| | Stand |
| --- | --- |
| Docker | vorhanden (Server 29.7.1) — Voraussetzung für die lokale Supabase-Instanz |
| Supabase CLI | **nicht installiert** → Phase 1, Schritt 1 |
| `supabase/`-Verzeichnis | existiert nicht |
| Supabase-Client im Code | `src/shared/services/supabase.ts`, URL + publishable key **hart im Code** |
| `.env` | existiert, Inhalt per Policy nicht lesbar — Werte muss Oliver selbst prüfen |

---

## Phase 1 — Werkzeuge und Projektgerüst (E7)

**Ziel:** Schema als Code, lokal reproduzierbar, ohne die Cloud-Instanz anzufassen.

1. Supabase CLI als Dev-Dependency (nicht global — sonst hat jede Maschine eine andere Version):
   `pnpm add -D supabase`
2. `pnpm supabase init` → erzeugt `supabase/config.toml`
3. `pnpm supabase start` → lokale Postgres-Instanz in Docker
4. Skripte in `package.json` ergänzen:
   `db:start`, `db:stop`, `db:reset` (`supabase db reset` — spielt alle Migrationen + Seed neu ein),
   `db:diff`, `db:types` (`supabase gen types typescript --local`)
5. Verbindungsdaten aus dem Code in `.env` verschieben (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`) und `src/shared/services/supabase.ts` auf `import.meta.env`
   umstellen.

**Zu Schritt 5, damit im Call keine Verwirrung entsteht:** Der publishable key ist **kein Geheimnis**
und darf im Browser stehen — das Verschieben in `.env` dient der *Umgebungstrennung* (lokal / Cloud),
nicht der Geheimhaltung. Der Schutz ist RLS (E13), nicht die Verborgenheit des Keys.

**Fertig, wenn:** `pnpm db:reset` fehlerfrei durchläuft und `pnpm dev` weiter funktioniert.

---

## Phase 2 — Stammdaten (E14, E3, E15, E19, E22)

Eine Migration pro fachlichem Schritt, nicht eine große. Migrationen sind unveränderlich, sobald sie
geteilt sind — ab dann wird nur noch vorwärts migriert.

1. `hotels` + eine Seed-Zeile
2. `room_types` (inkl. `max_occupancy`, `archived_at`)
3. `rooms`
4. `room_type_images` + Storage-Bucket `room-images` (öffentlich lesbar, Schreiben nur `is_staff()`)
5. `room_blocks` inkl. `EXCLUDE`-Constraint
6. Seed: 4–5 Kategorien, ~15 Zimmer, Bilder aus `src/assets/img/` in den Bucket

**Fertig, wenn:** überlappende Sperrungen für dasselbe Zimmer von der Datenbank **abgelehnt** werden
(negativer Test — der Fehler ist das erwartete Ergebnis).

---

## Phase 3 — Preise (E5, E8, E25)

1. `rate_plans` + Seed-Zeile `STANDARD`
2. `room_type_rates` inkl. `daterange`-Generierung und `EXCLUDE`-Constraint
3. `find_rate_gaps(tage int)`
4. Seed: Saisonpreise für die nächsten 12 Monate

**Fertig, wenn:** zwei überlappende Preiszeiträume für dieselbe Kategorie und denselben Rate-Plan
abgelehnt werden **und** `find_rate_gaps(365)` eine absichtlich gerissene Lücke findet.

---

## Phase 4 — Kunden und Buchungen (E4, E11, E16, E20–E23, E26, E27)

1. `citext`-Extension (oder Verzicht darauf → `UNIQUE (lower(email))`, siehe `schema.md`)
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
eine Buchung mit Abreise = Anreise der nächsten **akzeptiert** wird (das ist der halb-offene Test aus
E8/E29 — er ist der wichtigste in diesem Satz).

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
| Nacht ohne Preiszeile | nicht buchbar, Grund `kein_preis` — **nicht** Preis 0 (E25) |

Zusätzlich: anonyme Aufrufe erhalten **niemals** `kein_preis`/`zu_klein`, sondern den generischen
Grund (E28), und Anfragen jenseits `booking_horizon_days` liefern `ausserhalb_horizont` (E30).

---

## Phase 6 — Buchen (E6, E10, E21, E26, E31)

1. `create_booking(...)` nach dem Ablauf in `schema.md`, Abschnitt 3
2. Strukturierter Fehler: Code + Datum + Grund (E31)
3. Mehrere Zimmer: `booking_groups`-Zeile + *n* `bookings` in **einer** Transaktion
4. `booking_nights` aus den Saisonpreisen einfrieren
5. `booking_events`-Eintrag `created`

**Fertig, wenn:** ein Nebenläufigkeitstest zwei gleichzeitige Buchungen auf das **letzte** Zimmer
abfeuert und **genau eine** gewinnt, während die andere einen strukturierten Fehler bekommt. Dieser
Test ist der Kern von E10 — ohne ihn ist die Entscheidung nur behauptet.

Zusätzlich: eine zweite Buchung mit derselben E-Mail erzeugt **keinen** zweiten Kundendatensatz
(E26), und der eingefrorene Preis bleibt unverändert, nachdem die Saisonpreise anschließend geändert
wurden (E5 — der Test, der beweist, dass eine Buchung ein Vertrag ist).

---

## Phase 7 — RLS (E13)

1. `is_staff()` (v1: `false`) und `current_customer_id()`
2. `ENABLE ROW LEVEL SECURITY` auf **allen** Tabellen
3. Policies gemäß `schema.md`, Abschnitt 4 — ausschließlich über die zwei Funktionen
4. `booking_events`: `UPDATE`/`DELETE`-Rechte entziehen (append-only durchsetzen, nicht vereinbaren)

**Fertig, wenn:** ein anonymer Client `select * from bookings` mit **0 Zeilen** (nicht mit einem
Fehler) beantwortet bekommt und ein direktes `insert into bookings` abgelehnt wird — Buchen geht nur
über die RPC.

**Reihenfolgehinweis:** RLS kann auch schon nach Phase 2 aktiviert werden. Der Vorteil: man baut nie
gegen eine offene Datenbank und merkt fehlende Policies sofort. Der Nachteil: mehr Reibung beim
Seeden. Empfehlung: **RLS früh an**, Seeds über den Service-Role-Key.

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

1. `pnpm supabase link` gegen das bestehende Projekt
2. `supabase db push`
3. `posts`-Spike-Tabelle bewerten: behalten (Tutorial-Referenz) oder in einer eigenen Migration
   entfernen

**Vorher klären, weil es Daten betrifft:** Was passiert mit der bestehenden Cloud-Instanz? Sie
enthält bereits `posts` und wurde per Dashboard gebaut, also existiert für sie **keine**
Migrationshistorie. Optionen: (a) Cloud-Schema per `supabase db pull` als Ausgangsmigration
einfangen, dann darauf aufbauen; (b) Instanz als Wegwerf-Spike behandeln und neu aufsetzen.
**Das ist eine Entscheidung mit Datenverlust-Potenzial und gehört in den Call, nicht in eine
Agenten-Session.**

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

## Offene Punkte für den Call

1. **E28-Interpretation:** feine Sperrgründe nur für `is_staff()` — bestätigt am 2026-08-17,
   im Code noch zu belegen.
2. **Cloud-Instanz** (Phase 10): `db pull` oder neu aufsetzen?
3. **`citext`** oder `UNIQUE (lower(email))`?
4. **RLS-Zeitpunkt:** nach Phase 2 (empfohlen) oder erst Phase 7?
5. **Seed-Umfang:** reicht ein Minimalseed, oder soll ein realistischer Datenbestand
   (12 Monate Preise, ~50 Buchungen) entstehen, damit die Verfügbarkeitslogik sichtbar arbeitet?
   Empfehlung: realistisch — bei drei Buchungen sieht jede Kapazitätsrechnung richtig aus.
