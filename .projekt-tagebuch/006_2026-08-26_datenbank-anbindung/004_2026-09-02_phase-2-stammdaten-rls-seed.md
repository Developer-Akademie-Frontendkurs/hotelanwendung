[← Vorheriger Commit](003_2026-09-02_phase-1-cli-umgebungstrennung-testgeruest.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(db): Phase 2 - Stammdaten, RLS und Minimalseed

- **Commit:** `08bb4f0`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Die ersten echten Tabellen. Sechs Migrationen legen die **Stammdaten** an – Hotel, Zimmerkategorien, Zimmer, Bilder und Zimmersperrungen – jede mit ihren Zugriffsregeln in derselben Datei. Dazu ein Minimalseed und die ersten 16 Tests.

```text
 docs/datenbank/umsetzungsplan.md                   |  5 +-
 package.json                                       |  3 +-
 supabase/migrations/20260902101000_foundation.sql  | 44 ++++++++++
 supabase/migrations/20260902102000_hotels.sql      | 40 +++++++++
 supabase/migrations/20260902103000_room_types.sql  | 36 ++++++++
 supabase/migrations/20260902104000_rooms.sql       | 34 ++++++++
 .../migrations/20260902105000_room_type_images.sql | 54 ++++++++++++
 supabase/migrations/20260902106000_room_blocks.sql | 42 ++++++++++
 supabase/scripts/seed-storage.mjs                  | 74 +++++++++++++++++
 supabase/seed.sql                                  | 90 ++++++++++++++++++--
 supabase/tests/helpers/fixtures.ts                 | 87 ++++++++++++++++++++
 supabase/tests/rls-stammdaten.spec.ts              | 95 ++++++++++++++++++++++
 supabase/tests/room-blocks.spec.ts                 | 69 ++++++++++++++++
 13 files changed, 666 insertions(+), 7 deletions(-)
```

Zwei Grundsätze prägen diesen Commit:

**Eine Migration pro fachlichem Schritt.** Nicht eine große Datei mit allen Tabellen. Der Grund steht im Umsetzungsplan: _„Migrationen sind unveränderlich, sobald sie geteilt sind — ab dann wird nur noch vorwärts migriert."_ Wenn jede Tabelle ihre eigene Datei hat, ist im Nachhinein nachvollziehbar, wann und warum sie entstand.

**RLS geht sofort an, nicht in Phase 7** (`V3`). Jede Tabelle bekommt ihre Policies in derselben Migration, in der sie entsteht.

### Zum Dateinamen der Migrationen

```text
20260902101000_foundation.sql
└──────┬─────┘ └────┬────┘
   Zeitstempel    sprechender Name
```

Die Supabase-CLI führt Migrationen in **lexikografischer Reihenfolge** der Dateinamen aus. Der Zeitstempel `YYYYMMDDHHMMSS` sorgt dafür, dass diese Reihenfolge der zeitlichen entspricht. Hier sind die Nummern bewusst in Tausenderschritten gewählt (`101000`, `102000`, `103000`), damit später eine Migration dazwischen geschoben werden kann.

## 1. `foundation` – das Fundament

Die erste Migration legt keine Tabelle an, sondern Voraussetzungen:

```sql
-- btree_gist erlaubt in einem GiST-Exclusion-Constraint die Gleichheitspruefung auf
-- uuid neben der Ueberlappungspruefung auf daterange. Ohne diese Erweiterung sind
-- `EXCLUDE USING gist (room_id WITH =, period WITH &&)` und alle spaeteren
-- Ueberlappungs-Constraints nicht anlegbar.
create extension if not exists btree_gist;
```

Zum Hintergrund: PostgreSQL kennt verschiedene Index-Typen. `btree` kann Gleichheit und Sortierung, `gist` kann räumliche und Bereichsfragen („überlappen sich diese zwei Zeiträume?"). Für die Bedingung _„dasselbe Zimmer UND überlappende Zeiträume"_ braucht man beides in einem Index – und genau das liefert die Erweiterung `btree_gist`.

Dann die wichtigste Funktion des ganzen Schemas:

```sql
-- ---------------------------------------------------------------------------
-- is_staff() — der EINZIGE Ort, an dem Mitarbeitendenrechte geprueft werden (E13)
-- ---------------------------------------------------------------------------
--
-- v1 gibt hart `false` zurueck: Es gibt noch kein Login fuer Mitarbeitende, und alles
-- Administrative laeuft ueber den Service-Role-Key, der RLS ohnehin umgeht (E35).
--
-- Das ist Absicht und kein Platzhalter, den man vergessen darf: Sobald es Rollen gibt,
-- wird GENAU DIESE Funktion geaendert (z. B. auf eine `profiles.role`-Abfrage) und
-- jede Policy im Schema gilt sofort mit. Wer stattdessen `auth.uid()` in einzelne
-- Policies schreibt, muss sie spaeter alle finden.
create or replace function public.is_staff() returns boolean language sql stable
set search_path = ''
as $$
select false;
$$;
```

Eine Funktion, die immer `false` zurückgibt – und der wertvollste Teil dieser Migration. Das Konzept heißt **Seam** (Nahtstelle): eine Stelle, die heute trivial ist, aber genau der Ort, an dem eine spätere Erweiterung ansetzt.

Der Vergleich macht es deutlich:

```sql
-- SO NICHT: die Regel steht in jeder Policy erneut
create policy rooms_select on public.rooms
for select using (
    exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'staff')
);
-- ... und noch 14-mal in anderen Tabellen.

-- SO: die Regel steht einmal
create policy rooms_select_staff on public.rooms
for select using (public.is_staff());
```

Beim ersten Ansatz muss man beim Einführen von Rollen fünfzehn Policies finden und einzeln umschreiben – und eine davon vergisst man. Beim zweiten ändert man eine Funktion, und alle Policies gelten sofort mit der neuen Regel.

Auffällig ist außerdem `set search_path = ''`. Der `search_path` legt fest, in welchen Schemas PostgreSQL nach unqualifizierten Namen sucht. Auf `''` gesetzt, findet die Funktion nur Objekte, die vollständig benannt sind (`public.customers` statt `customers`). Das verhindert einen echten Angriff: Legt jemand eine eigene Tabelle in einem Schema an, das im `search_path` vor `public` steht, würde die Funktion plötzlich in dessen Tabelle schauen. Bei Funktionen mit `SECURITY DEFINER` (später in Phase 5/6) ist das der klassische Weg, eine Datenbank zu übernehmen.

Die dritte Zutat ist eine Konvention aus `E8`:

```sql
create or replace function public.set_updated_at() returns trigger language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
```

Jede Tabelle hängt später einen Trigger daran, damit `updated_at` automatisch mitläuft – statt es in jedem `UPDATE` von Hand zu setzen (und in einem zu vergessen).

## 2. `hotels` – eine Tabelle mit genau einer Zeile

```sql
create table public.hotels (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address_line1 text,
    postal_code text,
    city text,
    country_code text,
    email text,
    phone text,
    -- Definiert, was "heute" ist. Ohne Zeitzone waere jede Verfuegbarkeitsrechnung
    -- an der Tagesgrenze eine Wette auf die Serverkonfiguration.
    timezone text not null default 'Europe/Berlin',
    check_in_time time not null,
    check_out_time time not null,
    -- Buchungshorizont als Stammdatum, nicht als Konstante im Frontend (E30).
    booking_horizon_days int not null default 540 check (booking_horizon_days > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

Eine Tabelle für ein einziges Hotel wirkt zunächst überflüssig. Die Begründung im Kommentar dreht das Argument um:

```sql
-- Die Tabelle existiert nicht als Multi-Hotel-Vorbereitung, sondern weil diese Daten
-- heute gebraucht werden (Impressum, Kontakt, Check-in-Zeiten, Zeitzone). Dass die
-- Erweiterung auf mehrere Hotels dadurch billig wird, ist Nebenprodukt (E2, E14).
```

Das ist Leitsatz 2 in Anwendung: _Erweiterbar ≠ alle Achsen offen._ Die Tabelle wird nicht „für später" gebaut, sondern weil Adresse, Kontakt und Check-in-Zeiten irgendwo stehen müssen – und eine Tabelle ist dafür der richtige Ort. Dass ein zweites Hotel dann nur ein `INSERT` wäre, ist ein Geschenk, kein Ziel.

Interessant ist `booking_horizon_days`. Wie weit im Voraus darf man buchen? Diese Zahl ist eine **Geschäftsentscheidung**, keine technische Konstante. Steht sie als `const BOOKING_HORIZON = 540` im TypeScript-Code, braucht ihre Änderung ein Deployment. In der Datenbank ist es ein `UPDATE`.

Dann die Zugriffsregeln:

```sql
create trigger hotels_set_updated_at before update on public.hotels
for each row execute function public.set_updated_at();

-- RLS ab Tag 1, deny by default (E13, V3).
alter table public.hotels enable row level security;

-- Stammdaten des Hotels sind oeffentlich - sie stehen auf jeder Seite im Impressum.
create policy hotels_select_all on public.hotels
for select using (true);

-- Schreiben nur Mitarbeitende. In v1 ist das niemand (is_staff() = false); Seeds und
-- Administratives laufen ueber den Service-Role-Key, der RLS umgeht (E35).
create policy hotels_write_staff on public.hotels
for all using (public.is_staff()) with check (public.is_staff());
```

Das Wichtigste an Row Level Security in drei Sätzen:

1. `enable row level security` schaltet die Prüfung ein. Ab dann ist **alles verboten**, was keine Policy erlaubt („deny by default").
2. Eine Policy für `select` ist ein **Filter**, kein Tor. Passt eine Zeile nicht, wird sie stillschweigend weggelassen – es gibt keinen Fehler. Das ist Absicht: Eine Fehlermeldung würde verraten, dass es die Zeile gibt.
3. `using` gilt für vorhandene Zeilen (Lesen, Ändern, Löschen), `with check` für neue oder geänderte Werte (Einfügen, Ändern).

## 3. `room_types` – die verkaufte Einheit

```sql
create table public.room_types (
    id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references public.hotels on delete restrict,
    name text not null,
    slug text not null,
    description text,
    -- Ohne max_occupancy ist jede Suche falsch: "2 Erwachsene + 2 Kinder" muss
    -- Kategorien ausschliessen koennen, in die vier Personen nicht passen (E15).
    max_occupancy int not null check (max_occupancy >= 1),
    -- Nie loeschen, nur archivieren (E22). NULL = aktiv.
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hotel_id, slug)
);
```

Drei Dinge zum Mitnehmen:

**`on delete restrict`.** Der Versuch, ein Hotel zu löschen, an dem Kategorien hängen, schlägt fehl. Das ist `E22`: _Nichts wird gelöscht._ Die Alternativen wären `cascade` (löscht die Kategorien mit – gefährlich) oder `set null` (hinterlässt Kategorien ohne Hotel – unsinnig).

**`archived_at` statt `DELETE`.** Eine Kategorie, die nicht mehr verkauft wird, bekommt einen Zeitstempel. Sie verschwindet aus der Gästeansicht, bleibt aber für bestehende Buchungen und für Auswertungen erhalten. Wer stattdessen löschen wollte, würde ohnehin an `on delete restrict` von `bookings` scheitern.

**`unique (hotel_id, slug)`** – nicht `unique (slug)`. Der Slug ist der URL-Teil (`/zimmer/double-suite`). Eindeutig muss er pro Hotel sein, nicht global. Der Kommentar erklärt, warum das jetzt schon so steht:

```sql
    -- Sprechende URLs pro Hotel eindeutig - die Spalte traegt hotel_id bereits,
    -- damit die Multi-Hotel-Erweiterung keine Constraint-Aenderung braucht (E2).
```

Die Policy zeigt die Archivierung in Aktion:

```sql
-- Gaeste sehen nur aktive Kategorien. Archivierte bleiben fuer Mitarbeitende und
-- fuer bestehende Buchungen erreichbar - deshalb archivieren statt loeschen (E22).
create policy room_types_select_active on public.room_types
for select using (archived_at is null or public.is_staff());
```

Die Filterung „nur aktive" liegt damit in der **Datenbank**, nicht in jeder Abfrage. Wer `select * from room_types` schreibt, bekommt als Gast automatisch nur die aktiven – man kann das Filter nicht vergessen.

## 4. `rooms` – die erste Tabelle, die Gäste gar nicht sehen

```sql
create table public.rooms (
    id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references public.hotels on delete restrict,
    room_type_id uuid not null references public.room_types on delete restrict,
    room_number text not null,
    -- Archivierte Zimmer zaehlen NICHT in die Kapazitaet (E22). Sie zu loeschen wuerde
    -- an bestehenden Buchungen scheitern - und das ist genau richtig so.
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hotel_id, room_number)
);

create index rooms_room_type_id_idx on public.rooms (room_type_id) where archived_at is null;
```

Der Index ist ein **Teilindex** (`partial index`) – erkennbar am `where` am Ende. Er enthält nur Zeilen mit `archived_at is null`. Da die Verfügbarkeitsrechnung ausschließlich aktive Zimmer zählt, ist ein Index über alle Zimmer unnötig groß. Teilindizes sind kleiner, schneller und billiger beim Schreiben.

Die Policy ist die restriktivste bisher:

```sql
-- Zimmernummern sind Betriebsinterna: Ein Gast bucht eine Kategorie und hat keinen
-- Grund zu erfahren, dass Zimmer 204 existiert. Die Kapazitaetsrechnung braucht die
-- Tabelle trotzdem - sie laeuft ab Phase 5 ueber SECURITY DEFINER-Funktionen, die
-- nur die Anzahl freier Zimmer herausgeben, nie die Zimmer selbst (E17).
create policy rooms_select_staff on public.rooms
for select using (public.is_staff());
```

Da `is_staff()` in v1 immer `false` liefert, bekommt **jeder** Gast null Zeilen aus `rooms`. Und trotzdem muss die Verfügbarkeitssuche zählen können, wie viele Zimmer frei sind. Wie das ohne Leserecht funktioniert, ist der Inhalt der Phase 5: eine Funktion mit `SECURITY DEFINER`, die mit den Rechten ihres Eigentümers läuft und nur eine **Zahl** zurückgibt.

Das Muster ist übertragbar: **Nicht die Daten freigeben, sondern eine Antwort auf die konkrete Frage.**

## 5. `room_type_images` – Barrierefreiheit als `NOT NULL`

```sql
create table public.room_type_images (
    id uuid primary key default gen_random_uuid(),
    -- CASCADE ist hier korrekt und kein Widerspruch zu E22: Bilder sind kein Vertrag,
    -- sondern Zubehoer der Kategorie. Und eine Kategorie mit Buchungen laesst sich
    -- ohnehin nicht loeschen (ON DELETE RESTRICT auf bookings).
    room_type_id uuid not null references public.room_types on delete cascade,
    storage_path text not null,
    -- NOT NULL. Barrierefreiheit ist nicht optional (E19) - ein leerer Alternativtext
    -- ist eine bewusste Entscheidung des Autors, ein fehlender ist ein Versehen.
    alt_text text not null,
    -- Bewusst NICHT unique: sonst wird jedes Umsortieren zu einer Kette von
    -- Zwischenschritten. Duplikate sind harmlos, die Sortierung stabilisiert (sort_order, id).
    sort_order int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index room_type_images_order_idx on public.room_type_images (room_type_id, sort_order, id);
```

Drei kleine Entscheidungen mit großer Aussagekraft:

**`alt_text text not null`.** Der Alternativtext für Screenreader ist ein Pflichtfeld. Wer wirklich ein dekoratives Bild ohne Textbedarf hat, schreibt `''` – eine bewusste Handlung. Der Unterschied zwischen „ich habe entschieden, dass hier kein Text nötig ist" und „ich habe nicht daran gedacht" ist in der Datenbank sichtbar. Das ist Barrierefreiheit als Constraint statt als Bitte.

**`sort_order` ohne `unique`.** Klingt nach Schlampigkeit, ist aber praktisch gedacht. Bei eindeutiger Sortiernummer bräuchte jedes Umsortieren („Bild 3 nach vorne") eine Kette von Zwischenschritten, weil man nicht zwei Bilder gleichzeitig auf Position 1 haben darf. Duplikate sind hier harmlos, die Reihenfolge wird über `(sort_order, id)` stabilisiert.

**`on delete cascade` als bewusste Ausnahme.** Überall sonst gilt `restrict`. Bilder sind Zubehör, nicht Vertragsbestandteil. Und der Kommentar nennt den Schutz, der trotzdem greift: Eine Kategorie mit Buchungen ist gar nicht löschbar.

Am Ende der Migration kommt etwas, das über SQL hinausgeht – der Storage-Bucket:

```sql
-- Oeffentlich lesbar: Zimmerbilder stehen auf der Startseite, ein signierter Link pro
-- Bild waere Aufwand ohne Schutzwirkung.
insert into storage.buckets (id, name, public)
values ('room-images', 'room-images', true)
on conflict (id) do nothing;

-- Schreiben nur Mitarbeitende (in v1: nur der Service-Role-Key, E35).
create policy room_images_insert_staff on storage.objects
for insert with check (bucket_id = 'room-images' and public.is_staff());
```

Supabase Storage ist selbst in Postgres verwaltet: Buckets sind Zeilen in `storage.buckets`, Dateien Zeilen in `storage.objects`. Dadurch gilt für Dateien dieselbe Policy-Mechanik wie für Tabellen – ein sehr angenehmer Nebeneffekt.

Das `on conflict (id) do nothing` macht das `INSERT` **idempotent**: Ein zweiter Lauf ändert nichts, statt zu scheitern.

## 6. `room_blocks` – der erste Exclusion-Constraint

Die interessanteste Migration dieser Phase. Zimmersperrungen (Renovierung, Defekt, Eigenbelegung) dürfen sich für dasselbe Zimmer nicht überlappen:

```sql
create table public.room_blocks (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.rooms on delete restrict,
    starts_on date not null,
    -- Halb-offen [starts_on, ends_on): der letzte Tag ist NICHT gesperrt (E8).
    ends_on date not null,
    period daterange generated always as (daterange(starts_on, ends_on, '[)')) stored,
    reason text not null,
    note text,
    created_by uuid references auth.users,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_on > starts_on),
    -- Sperrungen DESSELBEN Zimmers duerfen sich nicht ueberlappen. Hier ist ein
    -- Exclusion-Constraint richtig, weil er genau ein Zimmer betrifft. Bei Buchungen
    -- geht das nicht, weil dort die Kategorie gezaehlt wird (E3/E10).
    exclude using gist (room_id with =, period with &&)
);
```

Zwei Techniken lohnen genaues Hinsehen.

### Die generierte `daterange`-Spalte

```sql
period daterange generated always as (daterange(starts_on, ends_on, '[)')) stored
```

`daterange` ist ein eigener PostgreSQL-Datentyp für Datumsbereiche. Der dritte Parameter `'[)'` gibt die **Grenzen** an:

| Notation | Bedeutung                             | `daterange('2027-03-10','2027-03-20', …)` enthält |
| -------- | ------------------------------------- | ------------------------------------------------- |
| `'[]'`   | beide Grenzen eingeschlossen          | 10. bis 20. (11 Tage)                             |
| `'[)'`   | Anfang ja, Ende nein (**halb-offen**) | 10. bis 19. (10 Tage)                             |
| `'()'`   | beide ausgeschlossen                  | 11. bis 19. (9 Tage)                              |

Halb-offen ist die Wahl aus `E8`. Damit kann eine Sperrung am 20. beginnen, wenn die vorige am 20. „endet" – lückenlos anschließen ohne Konflikt.

Die Spalte ist `generated always as (...) stored`: Sie wird von der Datenbank aus `starts_on` und `ends_on` berechnet. Man kann sie nicht von Hand setzen, und sie kann nicht in Widerspruch zu den beiden Basisspalten geraten.

### Der Exclusion-Constraint

```sql
exclude using gist (room_id with =, period with &&)
```

Zu lesen als: _„Es dürfen keine zwei Zeilen existieren, bei denen `room_id` gleich (`=`) ist **und** `period` sich überlappt (`&&`)."_

Ein `EXCLUDE`-Constraint ist die Verallgemeinerung von `UNIQUE`. `unique (room_id)` würde bedeuten „keine zwei Zeilen mit gleichem `room_id`" – hier ist die Bedingung aber „gleiches Zimmer _und_ überlappender Zeitraum". Der Operator `&&` bedeutet bei Bereichstypen „überlappt sich mit".

Warum ist das so wertvoll? Weil die Alternative fehleranfällig ist:

```ts
// FALSCH, obwohl es richtig aussieht:
const konflikte = await supabase
    .from('room_blocks')
    .select('id')
    .eq('room_id', roomId)
    .lt('starts_on', endsOn)
    .gt('ends_on', startsOn);

if (konflikte.data?.length === 0) {
    await supabase.from('room_blocks').insert({ ... });   // ← hier ist die Lücke
}
```

Zwischen der Prüfung und dem Einfügen liegt Zeit. In dieser Zeit kann eine zweite Anfrage dasselbe tun, ebenfalls „keine Konflikte" feststellen und einfügen. Am Ende sind zwei überlappende Sperrungen in der Datenbank, und **kein Fehler wurde gemeldet**. Ein Constraint hat diese Lücke nicht: Die Prüfung passiert atomar im Moment des Schreibens.

Und dann der Kommentar, der eine bewusste Nicht-Regel benennt:

```sql
-- Bewusst NICHT durchgesetzt (E18): dass eine Sperrung bestaetigte Buchungen ueber die
-- Kapazitaet hebt. Das Zimmer IST kaputt - die Datenbank darf diese Tatsache nicht
-- ablehnen. Gemeldet wird es, verhindert nicht.
```

Das ist eine feine Unterscheidung: Wenn drei Zimmer alle gebucht sind und eines kaputtgeht, dann ist die Kapazität jetzt zwei bei drei Buchungen. Man kann diese Realität nicht per Constraint verbieten – der Handwerker kommt trotzdem. Die Datenbank soll sie **sichtbar machen**, nicht ablehnen. In Phase 5 wird `rooms_free` daher auch negative Werte liefern dürfen.

## 7. Der Minimalseed

`supabase/seed.sql` bekommt Inhalt (`V4`):

```sql
insert into public.hotels (id, name, address_line1, postal_code, city, country_code, email, phone, timezone, check_in_time, check_out_time, booking_horizon_days)
values (
    '00000000-0000-4000-8000-000000000001',
    'Karawanken Hof',
    'Karawankenweg 1',
    '9535',
    'Schiefling am Woerthersee',
    'AT',
    'willkommen@karawankenhof.example',
    '+43 4274 000000',
    'Europe/Vienna',
    '15:00',
    '11:00',
    -- 365 statt der Vorgabe 540: der Seed deckt 12 Monate Preise ab (Phase 3).
    -- Ein weiterer Horizont wuerde Monate erzeugen, die im Kalender als "nicht
    -- buchbar" erscheinen - korrekt laut E25, aber nicht von einem Bug zu
    -- unterscheiden. Horizont und Preisabdeckung muessen sich decken (V4).
    365
);
```

Auffällig sind die **festen UUIDs**. Normalerweise überlässt man `gen_random_uuid()` die Arbeit. Hier nicht, und der Kommentar am Dateikopf sagt warum:

```sql
-- Feste UUIDs, damit ein Reset reproduzierbar ist und Links auf Kategorien nach
-- jedem Reset weiter funktionieren.
```

Wer beim Entwickeln die URL `/zimmer/…?id=00000000-0000-4000-8000-000000000101` im Browser offen hat, will nach `pnpm db:reset` nicht neu suchen müssen. Die Nummerierung ist zudem lesbar geordnet: `…001` das Hotel, `…101`–`…103` die Kategorien, `…201` der Tarif.

Drei Kategorien, davon eine bewusst unvollständig:

```sql
    (
        -- Bewusst ohne Bild: "Kategorie ohne Bild" ist ein Fall, den die Oberflaeche
        -- ohnehin aushalten muss - und es gibt nur zwei Zimmerbilder im Repo (V4).
        '00000000-0000-4000-8000-000000000103',
        '00000000-0000-4000-8000-000000000001',
        'Einzelzimmer Alpin',
        'einzelzimmer-alpin',
        'Kompaktes Einzelzimmer zur ruhigen Gartenseite.',
        1
    );
```

Ein guter Gedanke für Testdaten: **Der unangenehme Fall gehört in den Seed.** Wenn alle Seed-Kategorien ein Bild haben, entdeckt niemand den Fehler in der Bildanzeige – bis das erste Hotel eine Kategorie ohne Foto anlegt.

Acht Zimmer mit unterschiedlicher Verteilung (3 Suiten, 3 Premium, 2 Einzel) – wichtig, weil die Kapazitätsrechnung später pro Kategorie zählt und gleiche Zahlen Fehler verstecken würden.

## 8. Bilder gehören nicht in SQL

```diff
     "db:reset": "supabase db reset",
+    "db:reset": "supabase db reset && node supabase/scripts/seed-storage.mjs",
```

Der Grund steht im Kopf des neuen Skripts:

```js
/**
 * Laedt die Zimmerbilder in den Storage-Bucket `room-images` (E19).
 *
 * Warum ein Skript und keine Migration: SQL kann keine Binaerdateien hochladen. Die
 * Zeilen in `room_type_images` kommen aus `seed.sql`, die Dateien von hier.
 *
 * Aufruf:  node supabase/scripts/seed-storage.mjs
 * Braucht: laufende lokale Instanz (`pnpm db:start`) und SUPABASE_SERVICE_ROLE_KEY
 *          in `.env` - der Bucket ist oeffentlich LESBAR, aber schreiben darf nur
 *          `is_staff()`, und das ist in v1 niemand (E35).
 *
 * Idempotent: `upsert: true`, damit ein zweiter Aufruf nichts kaputt macht.
 */
```

Der Kern des Skripts:

```js
const IMAGES = [
    { file: 'src/assets/img/double-suite.jpg', storagePath: 'double-suite.jpg' },
    { file: 'src/assets/img/double-premium.jpg', storagePath: 'double-premium.jpg' },
];

for (const image of IMAGES) {
    const body = await readFile(join(REPO_ROOT, image.file));
    const { error } = await client.storage.from(BUCKET).upload(image.storagePath, body, {
        contentType: 'image/jpeg',
        upsert: true,
    });

    if (error) {
        failed = true;
        console.error(`FEHLER ${image.storagePath}: ${error.message}`);
    } else {
        console.log(`hochgeladen  ${image.file} -> ${BUCKET}/${image.storagePath}`);
    }
}

if (failed) {
    process.exitCode = 1;
}
```

Drei Details, die ein Skript von einem Werkzeug unterscheiden:

**`upsert: true`.** Ein zweiter Lauf überschreibt statt zu scheitern. Idempotenz ist bei allem, was in `db:reset` hängt, praktisch Pflicht.

**`process.exitCode = 1` bei Fehlern.** Ohne diese Zeile würde `node script.mjs` mit Exitcode 0 endet – „alles gut" – obwohl im Log Fehler stehen. In einer `&&`-Kette wie `db:reset` würde niemand es merken.

**Kein `dotenv`.** Das Skript liest die `.env` mit vier Zeilen selbst:

```js
/** Minimaler .env-Leser - das Repo hat bewusst keine dotenv-Abhaengigkeit. */
async function readEnvFile() {
    const raw = await readFile(join(REPO_ROOT, '.env'), 'utf8');
    const entries = raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const index = line.indexOf('=');
            return [line.slice(0, index), line.slice(index + 1)];
        });
    return Object.fromEntries(entries);
}
```

Eine legitime Abwägung: Für diesen Zweck reicht das, und jede Abhängigkeit ist etwas, das man pflegen und aktualisieren muss. (`line.indexOf('=')` statt `line.split('=')` ist übrigens kein Zufall – Werte können selbst `=` enthalten, etwa in Base64-Schlüsseln.)

## 9. Fixtures: jeder Test baut seine eigene Welt

Die neue Datei `supabase/tests/helpers/fixtures.ts` löst ein Problem, das jeder Datenbanktest hat: Woher kommen die Testdaten?

```ts
/**
 * Fixtures legen die Tests selbst an (E34) — nicht der Seed.
 *
 * Der Seed ist minimal (V4) und soll es bleiben: Ein Seed, der alle Testfaelle
 * enthaelt, wird mit jedem neuen Test groesser, und irgendwann testen die Tests
 * gegen Daten, die niemand mehr versteht. Jeder Test baut seine Welt selbst und
 * raeumt sie wieder ab.
 *
 * Jede Fixture bekommt ein eigenes Hotel. Das ist grosszuegig, aber es macht Tests
 * voneinander unabhaengig — und Kapazitaetsrechnungen (ab Phase 5) sind nur dann
 * aussagekraeftig, wenn kein fremdes Zimmer mitzaehlt.
 */
```

Der Aufbau:

```ts
export type Fixture = {
    hotelId: string;
    roomTypeId: string;
    roomIds: string[];
    cleanup: () => Promise<void>;
};

/** Legt Hotel + eine Kategorie + `roomCount` Zimmer an. */
export async function createFixture(options: { roomCount?: number; maxOccupancy?: number } = {}): Promise<Fixture> {
    const roomCount = options.roomCount ?? 1;
    const suffix = uniqueSuffix();

    const { data: hotel, error: hotelError } = await serviceClient
        .from('hotels')
        .insert({
            name: `Testhotel ${suffix}`,
            check_in_time: '15:00',
            check_out_time: '11:00',
            booking_horizon_days: 365,
        })
        .select('id')
        .single();
    if (hotelError) throw new Error(`Fixture: hotels — ${hotelError.message}`);
    const hotelId = hotel.id as string;
    // … Kategorie und Zimmer analog
```

Und das Aufräumen:

```ts
// Abbau in umgekehrter Reihenfolge: ON DELETE RESTRICT (E22) laesst nichts
// anderes zu — und genau das ist der Sinn der Entscheidung.
const cleanup = async (): Promise<void> => {
    await serviceClient
        .from('room_blocks')
        .delete()
        .in('room_id', roomIds.length > 0 ? roomIds : ['00000000-0000-0000-0000-000000000000']);
    await serviceClient.from('rooms').delete().eq('room_type_id', roomTypeId);
    await serviceClient.from('room_type_images').delete().eq('room_type_id', roomTypeId);
    await serviceClient.from('room_types').delete().eq('id', roomTypeId);
    await serviceClient.from('hotels').delete().eq('id', hotelId);
};
```

Die Reihenfolge ist erzwungen, nicht gewählt: Zuerst die Sperrungen, dann die Zimmer, dann die Kategorie, dann das Hotel. Wegen `on delete restrict` scheitert jede andere Reihenfolge – die Entscheidung `E22` wirkt hier sogar auf die Testhelfer zurück. Das ist ein gutes Zeichen: Eine Regel, die man auch beim Aufräumen nicht umgehen kann, ist wirklich durchgesetzt.

Jede Fixture bekommt ein **eigenes Hotel**. Etwas verschwenderisch, aber es macht die Tests voneinander unabhängig – und für Kapazitätszählungen ab Phase 5 ist das zwingend.

## 10. Die ersten echten Tests

### Test 1 aus `E34`: der Überlappungsschutz

```ts
/**
 * Test 1 aus E34 — beweist E18.
 *
 * Die Regel "Sperrungen desselben Zimmers duerfen sich nicht ueberlappen" ist ein
 * Exclusion-Constraint, kein Anwendungscode. Ohne diesen Test faellt ein fehlendes
 * Constraint lautlos aus: es wuerde einfach doppelt gesperrt, und die Kapazitaets-
 * rechnung ab Phase 5 waere still falsch.
 */
describe('room_blocks: Ueberlappungsschutz (E18)', () => {
    // …
    it('nimmt eine erste Sperrung an', async () => {
        const { error } = await block(roomA, '2027-03-10', '2027-03-20');
        expect(error).toBeNull();
    });

    it('LEHNT eine ueberlappende Sperrung desselben Zimmers AB', async () => {
        const { error } = await block(roomA, '2027-03-15', '2027-03-25');

        // Der Fehler IST das erwartete Ergebnis. 23P01 = exclusion_violation.
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23P01');
    });

    it('erlaubt dieselbe Ueberlappung fuer ein ANDERES Zimmer', async () => {
        // Beweist, dass der Constraint auf das Zimmer bezogen ist und nicht global
        // sperrt — sonst waere er zwar sicher, aber unbenutzbar.
        const { error } = await block(roomB, '2027-03-15', '2027-03-25');
        expect(error).toBeNull();
    });

    it('erlaubt eine Anschlusssperrung: Ende = Beginn der naechsten', async () => {
        // Halb-offene Intervalle (E8). Waere `period` geschlossen, wuerde hier der
        // Constraint zuschlagen — und im Betrieb liesse sich kein Zimmer ohne
        // Ein-Tag-Luecke durchsperren.
        const { error } = await block(roomA, '2027-03-20', '2027-03-25');
        expect(error).toBeNull();
    });
});
```

Diese vier Tests zusammen sind ein Musterbeispiel für **vollständige** Prüfung einer Regel:

| Test | Prüft                              | Ohne diesen Test wäre möglich              |
| ---- | ---------------------------------- | ------------------------------------------ |
| 1    | Der Normalfall funktioniert        | Constraint blockt einfach alles            |
| 2    | Der verbotene Fall wird abgelehnt  | Constraint fehlt ganz                      |
| 3    | Andere Zimmer sind nicht betroffen | Constraint sperrt global (unbenutzbar)     |
| 4    | Anschluss ist erlaubt (halb-offen) | Intervall wäre geschlossen (Umsatzverlust) |

Test 3 und 4 sind die **Gegenproben**. Ein Constraint, das zu viel verbietet, ist auch falsch – es fällt nur anders auf. Wer nur Test 2 schreibt, kann nicht unterscheiden zwischen „funktioniert richtig" und „lehnt alles ab".

Beachtenswert ist auch der Umgang mit Fehlercodes: `expect(error?.code).toBe('23P01')`. Nicht nur „irgendein Fehler", sondern **dieser** Fehler. PostgreSQL-Fehlercodes sind standardisiert:

| Code    | Bedeutung              | tritt auf bei                  |
| ------- | ---------------------- | ------------------------------ |
| `23P01` | exclusion_violation    | `EXCLUDE`-Constraint verletzt  |
| `23514` | check_violation        | `CHECK`-Constraint verletzt    |
| `23505` | unique_violation       | `UNIQUE` verletzt              |
| `23502` | not_null_violation     | `NOT NULL` verletzt            |
| `42501` | insufficient_privilege | keine Berechtigung (RLS/GRANT) |

Warum auf den Code festnageln? Damit der Test nicht aus dem **falschen Grund** grün wird. Hätte man nur `expect(error).not.toBeNull()` geschrieben, wäre der Test auch grün, wenn die Tabelle gar nicht existiert oder ein Tippfehler im Spaltennamen steckt.

### RLS-Tests: der Unterschied zwischen 0 Zeilen und einem Fehler

```ts
/**
 * RLS auf den Stammdaten (E13, V3).
 *
 * Diese Tests gehoeren nicht zu den sechs aus E34, kosten aber je zwei Zeilen — und
 * sie pruefen die Eigenschaft, die am leisesten ausfaellt: eine fehlende Policy
 * merkt man nicht, weil alles funktioniert. Nur zu viel ist sichtbar.
 *
 * Entscheidend ist, dass hier der `anonClient` benutzt wird. Mit dem Service-Role-Key
 * ist jeder dieser Tests gruen, weil er RLS umgeht — mit nur einem Client testet man
 * RLS nie.
 */
```

Der lehrreichste Test der Datei:

```ts
it('Gast bekommt bei rooms 0 Zeilen — keinen Fehler', async () => {
    // Der Unterschied ist wichtig: RLS filtert, es blockt nicht. Ein Fehler
    // wuerde verraten, dass die Tabelle existiert und Zeilen enthaelt.
    const { data, error } = await anonClient.from('rooms').select('room_number');
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
});
```

Das ist der Kern von Row Level Security und ein häufiges Missverständnis. RLS liefert **kein** „Zugriff verweigert". Es liefert einfach nichts. Für den Gast sieht die Tabelle `rooms` aus, als wäre sie leer.

Warum ist das besser? Weil eine Fehlermeldung Information ist. „Zugriff verweigert" verrät: Die Tabelle existiert, sie heißt `rooms`, und es gibt etwas zu verbergen. Null Zeilen verraten nichts.

Der Gegensatz dazu, wenige Zeilen weiter:

```ts
it('Gast darf nicht in hotels schreiben', async () => {
    const { error } = await anonClient.from('hotels').insert({
        name: 'Fremdes Hotel',
        check_in_time: '15:00',
        check_out_time: '11:00',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501'); // insufficient_privilege
});
```

Beim **Schreiben** gibt es einen echten Fehler. Auch das ist logisch: Es gibt keinen Grund, einen fehlgeschlagenen Schreibvorgang zu verschweigen – der Aufrufer muss wissen, dass seine Daten nicht angekommen sind. Beim Lesen filtert RLS, beim Schreiben blockt es.

Und die Gegenprobe zur Archivierung:

```ts
it('Gast sieht archivierte room_types NICHT (E22)', async () => {
    await serviceClient
        .from('room_types')
        .update({ archived_at: new Date('2027-01-01').toISOString() })
        .eq('id', fixture.roomTypeId);

    const { data, error } = await anonClient.from('room_types').select('name').eq('id', fixture.roomTypeId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    await serviceClient.from('room_types').update({ archived_at: null }).eq('id', fixture.roomTypeId);
});
```

Hier arbeiten beide Clients im Wechsel: Der Service-Client archiviert (er darf), der anonyme Client prüft, dass er die Zeile nicht mehr sieht. Am Ende wird der Zustand zurückgesetzt, damit die nächsten Tests dieselbe Fixture weiterbenutzen können.

## Was wurde erreicht?

Das Abschlusskriterium der Phase lautete: _„überlappende Sperrungen für dasselbe Zimmer werden von der Datenbank abgelehnt (Test 1 aus E34 — der Fehler ist das erwartete Ergebnis)."_ Erfüllt, mit **16 grünen Tests**.

Konkret existieren jetzt:

- Fünf Stammdaten-Tabellen mit vollständigen Constraints, Triggern und Indizes.
- Ein Storage-Bucket mit Policies auf denselben Mechanismen wie die Tabellen.
- Row Level Security auf **jeder** Tabelle, angelegt jeweils in derselben Migration.
- Ein Seed, der reproduzierbar dieselbe kleine, plausible Welt aufbaut.
- Ein Testgerüst mit Fixtures, das jede Testdatei unabhängig macht.

Die beiden Bausteine, die im Rest des Branches immer wiederkehren, sind hier zum ersten Mal zu sehen:

1. **`is_staff()` als einzige Stelle für Rechte.** Alle Policies verweisen darauf, keine schreibt `auth.uid()` selbst.
2. **Der Exclusion-Constraint.** „Diese Kombination darf nicht doppelt vorkommen" ist eine Zusicherung der Datenbank, nicht ein Prüfschritt im Code, den man vergessen kann.

Als Nächstes kommen die Preise – und dort begegnet man dem Exclusion-Constraint gleich wieder, diesmal über zwei Spalten gleichzeitig.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](005_2026-09-02_phase-3-saisonpreise-und-preisluecken.md)
