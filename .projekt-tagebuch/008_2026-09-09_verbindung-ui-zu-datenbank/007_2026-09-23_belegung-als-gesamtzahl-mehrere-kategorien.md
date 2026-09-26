[← Vorheriger Commit](006_2026-09-16_zimmer-anzahl-und-fruehstueck-integriert.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): Belegung als Gesamtzahl, mehrere Kategorien je Vorgang (E44, E48)

- **Commit:** `f959c92`
- **Datum:** 2026-09-23
- **Autor:** Oliver Jung

## Worum geht es?

Der inhaltlich schwerste Commit des Branches – und einer, der eine **eigene frühere Entscheidung zurücknimmt**. Im Umsetzungsplan (Commit 001) war mit `E45` festgelegt worden: _Die Gästezahl gilt pro Zimmer._ „2 Erwachsene" mit 3 Zimmern wären also sechs Personen. Eine Woche später zeigt sich, dass das nicht zu dem passt, was ein Gast meint, wenn er „2 Erwachsene, 1 Kind" auswählt.

```text
 docs/datenbank/README.md                           |  49 +-
 docs/datenbank/schema.md                           |  22 +-
 docs/datenbank/umsetzungsplan.md                   |   6 +
 src/shared/state/bookingState.ts                   |  46 +-
 src/views/BookingView/Booking.ts                   | 136 ++--
 src/views/BookingView/breakfast.spec.ts            |  18 +
 src/views/BookingView/breakfast.ts                 |  12 +-
 src/views/BookingView/room.interface.ts            |   3 +
 src/views/BookingView/roomQuantity.spec.ts         |  69 ++
 src/views/BookingView/roomQuantity.ts              |  55 +-
 .../migrations/20260923101000_occupancy_total.sql  | 762 +++++++++++++++++++++
 supabase/tests/availability.spec.ts                |  68 +-
 supabase/tests/booking-extras.spec.ts              |  23 +-
 supabase/tests/create-booking.spec.ts              | 169 ++++-
 supabase/tests/rls-abnahme.spec.ts                 |   5 +-
 15 files changed, 1298 insertions(+), 145 deletions(-)
```

Die Commit-Message listet die Änderungen stichpunktartig auf:

```text
- create_booking nimmt p_positions jsonb, prüft die Gesamtkapazität und
  verteilt die Gäste selbst auf die Zimmerzeilen (revidiert E45)
- availability_nights ohne Belegung, neue group_capacity() für Kalender
- search_availability sortiert keine Kategorie mehr als zu_klein aus
- reject_booking nennt die gescheiterte Position (room_type_id)
- Frühstück gilt für alle Gäste des Vorgangs, Checkbox unter der Zimmerliste
- Mengenwähler: nie mehr Zimmer als Erwachsene, Hinweis "Personen ohne Bett"
- Tests (DB + Vitest) und Doku (E48, schema.md, Umsetzungsplan) nachgezogen
```

## Die Änderungen im Detail

### 1. `E48` revidiert `E45` – und `E45` bleibt stehen

In `docs/datenbank/README.md` wird die alte Entscheidung **nicht gelöscht**, sondern markiert:

```markdown
### E45 — Die Belegung gilt **pro Zimmer**, nicht pro Reise

> **Revidiert am 2026-09-23 durch E48.** Die Belegung ist seitdem eine Gesamtzahl des Vorgangs.
> Der Text bleibt stehen, weil E48 ohne ihn nicht verständlich ist.
```

Die neue Entscheidung beginnt mit ihrer Ausgangslage – der Moment, in dem der Widerspruch auffiel:

```markdown
## 4j. Entschieden (Runde 10) — Belegung als Gesamtzahl

Ausgangslage: Beim Entwurf der Zusatzleistungen (Kinderbett „höchstens eines je Zimmer, aber als
Gesamtzahl") stellte sich heraus, dass die Oberfläche die Gästezahl als **Gesamtzahl** meint — „1 Kind"
heißt ein Kind, nicht eines pro Zimmer. E45 hatte das Gegenteil festgelegt.
```

Und die Begründung in einem Satz: _„Eine Gästezahl, die mit der Zimmerzahl multipliziert wird, lädt zu falschen Suchergebnissen und falschen Preisen ein (sechs Frühstücke für drei Personen)."_

Für Lernende ist das die eigentliche Lektion dieses Commits: **Entscheidungen dürfen falsch sein.** Wichtig ist, dass man sie mit Datum revidiert und den alten Text stehen lässt. Wer später liest, warum `create_booking` die Gäste selbst verteilt, braucht den Hinweis, dass es früher anders gedacht war.

`E48` hat fünf Punkte, die sich in der Migration wiederfinden:

1. Geprüft wird erst an der **Auswahl**: Passen alle Gäste in die gewählten Zimmer **zusammen**?
2. **Jedes Zimmer braucht einen Erwachsenen** – nie mehr Zimmer als Erwachsene.
3. Der **Kalender** fragt: Passt die Gruppe in die freien Zimmer des ganzen Hotels?
4. Die **Datenbank verteilt** die Gäste auf die Zimmerzeilen.
5. **Frühstück** gilt für alle Gäste des Vorgangs, nicht mehr je Kategorie.

### 2. Die Migration `20260923101000_occupancy_total.sql`

762 Zeilen SQL, die fünf Funktionen neu schreiben. Sie beginnt – wie gewohnt – mit dem Entfernen der alten Signaturen:

```sql
drop function if exists public.create_booking(date, date, uuid, int, text, text, text, int, text, int, boolean);
drop function if exists public.availability_nights(uuid, date, date, int, int, uuid);
drop function if exists public.reject_booking(text, date);
```

#### `availability_nights` kennt keine Belegung mehr

Bisher lieferte diese interne Funktion pro Nacht und Kategorie ein `fits` („passt die Gruppe in ein Zimmer dieser Kategorie?"). Das ist mit Gesamtzahlen keine sinnvolle Frage mehr. Stattdessen liefert sie die rohe Zahl:

```diff
 returns table (
     night date,
     room_type_id uuid,
-    fits boolean,
+    max_occupancy int,
     capacity int,
     rooms_free int,
     rate_cents int,
     currency text
 )
```

Die Entscheidung „passt die Gruppe?" wandert an die Stellen, die die ganze Auswahl kennen.

#### `group_capacity`: eine kleine, reine SQL-Funktion

```sql
-- Jedes Zimmer braucht mindestens einen Erwachsenen (E48). Mehr Zimmer als
-- Erwachsene kann eine Gruppe also nicht belegen - und wer hoechstens k Zimmer
-- nehmen darf, nimmt fuer die groesste Kapazitaet die k GROESSTEN. Deshalb:
-- absteigend nach max_occupancy sortieren und bis zum Zimmerlimit auffuellen.
create or replace function public.group_capacity(p_rooms int[], p_occupancy int[], p_room_limit int)
returns int
language sql
immutable
set search_path = ''
as $$
select coalesce(sum(least(z.rooms, greatest(p_room_limit - z.davor, 0)) * z.occupancy), 0)::int
from (
    select
        greatest(u.rooms, 0) as rooms,
        u.occupancy,
        coalesce(sum(greatest(u.rooms, 0)) over (order by u.occupancy desc, u.ord rows between unbounded preceding and 1 preceding), 0) as davor
    from unnest(p_rooms, p_occupancy) with ordinality as u(rooms, occupancy, ord)
) z;
$$;
```

Die Funktion ist kompakt, aber enthält zwei SQL-Techniken, die man kennen sollte:

- **`unnest(a, b) with ordinality`** macht aus zwei parallelen Arrays eine Tabelle mit einer Zeile pro Index – plus einer laufenden Nummer (`ord`).
- **Fensterfunktion mit laufender Summe:** `sum(...) over (order by … rows between unbounded preceding and 1 preceding)` berechnet für jede Zeile, wie viele Zimmer **davor** (also in größeren Kategorien) schon gezählt wurden. Damit kann `least(z.rooms, p_room_limit - z.davor)` bestimmen, wie viele Zimmer dieser Kategorie noch ins Zimmerlimit passen.

Ein Beispiel: Freie Zimmer `[2 Suiten à 4 Betten, 3 Doppel à 2 Betten]`, Zimmerlimit 3 (drei Erwachsene). Die Funktion nimmt die zwei Suiten (8 Betten) und ein Doppelzimmer (2 Betten) – Ergebnis 10. Bis zu zehn Personen passen also, wenn drei Erwachsene dabei sind.

`immutable` sagt PostgreSQL, dass das Ergebnis nur von den Argumenten abhängt – die Funktion liest keine Tabellen. Das ist die SQL-Variante einer reinen Funktion.

#### Der Kalender fragt das ganze Hotel

In `availability_calendar` wird für jede Nacht dreimal gefragt – mit immer kleinerem Bestand:

```sql
public.group_capacity(array_agg(r.capacity), array_agg(r.max_occupancy), least(p_adults, 8)) as passen_gesamt,
public.group_capacity(array_agg(r.rooms_free), array_agg(r.max_occupancy), least(p_adults, 8)) as passen_frei,
public.group_capacity(
    array_agg(case when r.rate_cents is null then 0 else r.rooms_free end),
    array_agg(r.max_occupancy),
    least(p_adults, 8)
) as passen_frei_mit_preis,
```

```sql
case
    when n.night < current_date then 'vergangenheit'
    when n.night >= current_date + (select h.booking_horizon_days from hotel h) then 'ausserhalb_horizont'
    -- Auch leer waere das Hotel fuer diese Gruppe zu klein.
    when n.passen_gesamt < p_adults + coalesce(p_children, 0) then 'zu_klein'
    when n.passen_frei < p_adults + coalesce(p_children, 0) then 'ausgebucht'
    when n.passen_frei_mit_preis < p_adults + coalesce(p_children, 0) then 'kein_preis'
    else null
end as grund
```

Die Reihenfolge der drei Fragen bestimmt den Grund: _Reicht das Hotel überhaupt? Reichen die freien Zimmer? Und die mit Preis?_ `zu_klein` bedeutet jetzt: „Auch das leere Hotel reicht nicht."

#### `search_availability` sortiert nichts mehr als „zu klein" aus

```sql
-- p_adults/p_children bleiben in der Signatur: Sie sind die Anfrage, und die
-- Oberflaeche schickt sie weiterhin. Ob die Gruppe in die gewaehlten Zimmer passt,
-- entscheidet sich aber erst an der Auswahl - im Browser als Hinweis, in
-- create_booking verbindlich.
```

Vorher wurde eine Double Suite für vier Personen als „zu klein" ausgegraut. Jetzt ist sie wählbar – man braucht eben zwei davon.

#### `reject_booking` nennt die Position

```sql
create or replace function public.reject_booking(p_code text, p_date date default null, p_room_type_id uuid default null)
-- …
    raise exception '%', v_grund
        using errcode = 'P0001',
              detail = jsonb_build_object('code', v_code, 'datum', p_date, 'room_type_id', p_room_type_id, 'grund', v_grund)::text;
```

Mit mehreren Kategorien reicht ein Datum nicht mehr – die Oberfläche muss wissen, **an welcher Karte** sie den Fehler anzeigt. `NULL` heißt „betrifft den ganzen Vorgang".

#### `create_booking` nimmt `p_positions jsonb`

Die neue Signatur:

```sql
create or replace function public.create_booking(
    p_check_in date,
    p_check_out date,
    p_positions jsonb,          -- [{"room_type_id": "<uuid>", "rooms": 2}, ...]
    p_adults int,               -- Personen des GANZEN Vorgangs (E48)
    p_email text,
    p_first_name text,
    p_last_name text,
    p_children int default 0,
    p_phone text default null,
    p_with_breakfast boolean default false
)
```

Weil `jsonb` **untypisiert** ankommt, prüft die Funktion die Form jeder Position selbst:

```sql
for v_element in select value from jsonb_array_elements(p_positions)
loop
    if jsonb_typeof(v_element) <> 'object'
       or coalesce(v_element ->> 'room_type_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_element -> 'rooms') is distinct from 'number' then
        perform public.reject_booking('ungueltige_belegung', p_check_in);
    end if;
    v_anzahl := (v_element ->> 'rooms')::numeric;
    if v_anzahl <> trunc(v_anzahl) or v_anzahl < 1 or v_anzahl > 8 then
        perform public.reject_booking('ungueltige_belegung', p_check_in);
    end if;

    -- Eine Kategorie zweimal waere zweimal dieselbe Frage mit zwei Antworten.
    if (v_element ->> 'room_type_id')::uuid = any (v_pos_type) then
        perform public.reject_booking('ungueltige_belegung', p_check_in, (v_element ->> 'room_type_id')::uuid);
    end if;
    -- …
end loop;
```

Der Regex auf die UUID ist kein Übereifer: Ohne ihn würde ein kaputter UUID-Text beim Cast `::uuid` einen **technischen** Fehler (`22P02`) werfen statt einer strukturierten Ablehnung, die die Oberfläche lesen kann. Die Datenbank ist hier die letzte Verteidigungslinie, weil es kein eigenes Backend gibt.

Danach prüft die Funktion die neuen Regeln:

```sql
-- Obergrenze je Vorgang (E44) und: jedes Zimmer braucht einen Erwachsenen (E48).
if v_zimmer_gesamt > 8 or v_zimmer_gesamt > p_adults then
    perform public.reject_booking('ungueltige_belegung', p_check_in);
end if;

-- …

-- 3b. Passt die Gruppe in die gewaehlten Zimmer ZUSAMMEN? (E48)
if v_betten < p_adults + v_children then
    perform public.reject_booking('zu_klein', p_check_in);
end if;
```

Und schließlich die **Verteilung** der Gäste auf die einzelnen Zimmerzeilen in `bookings`, die weiterhin je Zeile `adults`/`children` speichern:

```sql
-- Verteilungsregel (E48):
--   1. Jedes Zimmer bekommt einen Erwachsenen.
--   2. Die uebrigen Erwachsenen reihum, solange ein Zimmer unter max_occupancy ist.
--   3. Danach die Kinder nach demselben Verfahren.

v_rest := p_adults - v_zimmer_gesamt;
while v_rest > 0 loop
    v_vergeben := false;
    for j in 1..v_zimmer_gesamt loop
        exit when v_rest = 0;
        if v_slot_adults[j] + v_slot_children[j] < v_pos_occupancy[v_slot_pos[j]] then
            v_slot_adults[j] := v_slot_adults[j] + 1;
            v_rest := v_rest - 1;
            v_vergeben := true;
        end if;
    end loop;
    -- Kann nach 3b nicht eintreten; ohne diese Zeile waere ein Fehler dort aber
    -- eine Endlosschleife statt einer Ablehnung.
    if not v_vergeben then
        perform public.reject_booking('zu_klein', p_check_in);
    end if;
end loop;
```

Der Kommentar über der Abbruchbedingung ist ein Musterbeispiel für **defensive Programmierung**: Der Fall „nichts konnte vergeben werden" ist nach der Prüfung 3b logisch unmöglich. Tritt er doch ein (etwa weil jemand 3b später ändert), soll das eine Fehlermeldung sein – und keine Datenbank, die in einer Endlosschleife hängt.

Beim Frühstück trägt jetzt jede Zimmerzeile den Betrag **ihrer** Gäste:

```sql
v_extra := case
    when p_with_breakfast then v_naechte * (v_slot_adults[j] * v_unit_adult + v_slot_children[j] * v_unit_child)
    else 0
end;
```

Die Summe aller Zeilen ist damit genau der Betrag, den die Oberfläche vorher für alle Gäste angezeigt hat. Die Gesamtbelegung der Anfrage steht zusätzlich im `created`-Ereignis, „damit die automatische Verteilung später nachvollziehbar bleibt".

Und hier zahlt sich eine Entscheidung aus Branch 006 aus – der Kommentar erinnert daran:

```sql
-- 1. Advisory-Lock, HOTELWEIT (E10, E33). Er deckt alle Positionen gemeinsam ab -
-- genau der Fall, fuer den E33 ihn hotelweit gewaehlt hat.
perform pg_advisory_xact_lock(hashtext('booking:' || v_hotel_id::text));
```

### 3. Frontend: Frühstück wandert unter die Liste

Weil die Gäste nicht mehr einer Kategorie gehören, hat eine Frühstücks-Checkbox **pro Karte** keinen Sinn mehr. In `bookingState.ts` wird aus dem `Record<string, boolean>` wieder ein einzelner Wert:

```diff
-let roomBreakfast: Record<string, boolean> = {};
+// Frühstück für ALLE Gäste des Vorgangs (E47, E48). Seit die Belegung eine Gesamtzahl
+// ist, gibt es keine Gäste „einer Kategorie" mehr, an die ein Häkchen gebunden wäre.
+let breakfast = false;
```

```ts
function setBreakfast(wanted: boolean): void {
    // Kein Häkchen ohne Zimmer – dieselbe Regel wie oben, nur an dem Ende, an dem der
    // Gast klickt.
    breakfast = wanted && Object.keys(roomQuantities).length > 0;
    notify();
}
```

Auch `getBreakfastAmountCents` in `breakfast.ts` verliert den Parameter `rooms` – die Rechnung hängt nur noch an den Gästen:

```diff
-export function getBreakfastAmountCents(service: BreakfastService, occupancy: Occupancy, nights: number, rooms: number): number {
-    const perRoom = nights * (occupancy.adults * service.unitAmountCents + occupancy.children * service.childUnitAmountCents);
-    return perRoom * rooms;
+export function getBreakfastAmountCents(service: BreakfastService, occupancy: Occupancy, nights: number): number {
+    return nights * (occupancy.adults * service.unitAmountCents + occupancy.children * service.childUnitAmountCents);
 }
```

Man sieht hier gut, wie ein Fehler in der Fachlichkeit (`E45`) im Code gewuchert war: Die Multiplikation mit `rooms` war die direkte Folge der Annahme „Gäste pro Zimmer".

### 4. Frontend: neue Grenze im Mengenwähler

In `roomQuantity.ts` kommt eine dritte Grenze hinzu – die Zahl der Erwachsenen:

```ts
export type QuantityLimit = 'none' | 'roomsFree' | 'total' | 'adults';

/**
 * Zimmergrenze des Vorgangs: 8 (E44) — und nie mehr Zimmer als Erwachsene, denn jedes
 * Zimmer braucht einen (E48). Ohne gewählte Erwachsenenzahl gilt nur die 8.
 */
export function getRoomLimit(adults: number | null): number {
    return adults === null ? MAX_ROOMS_PER_BOOKING : Math.min(MAX_ROOMS_PER_BOOKING, adults);
}
```

Die bestehenden Funktionen bekommen einen zusätzlichen Parameter mit **Default-Wert** – so bleiben alte Aufrufe gültig:

```diff
-export function getRoomMax(roomsFree: number | null, otherRooms: number): number {
-    return Math.max(0, Math.min(roomsFree ?? 0, MAX_ROOMS_PER_BOOKING - otherRooms));
+export function getRoomMax(roomsFree: number | null, otherRooms: number, roomLimit: number = MAX_ROOMS_PER_BOOKING): number {
+    return Math.max(0, Math.min(roomsFree ?? 0, roomLimit - otherRooms));
 }
```

Und eine neue Funktion zählt, wie viele Personen noch kein Bett haben:

```ts
/**
 * Wie viele Personen in der Auswahl noch kein Bett haben (E48).
 *
 * Die Belegung ist eine Gesamtzahl: Die gewählten Zimmer müssen ZUSAMMEN reichen.
 * Dieselbe Rechnung macht `create_booking` verbindlich (Summe aus Zimmer ×
 * `max_occupancy`); hier ist sie nur der Hinweis, bevor der Gast absendet.
 */
export function getMissingBeds(quantities: RoomQuantities, rooms: readonly RoomCard[], persons: number): number {
    const beds = rooms.reduce((sum: number, room: RoomCard): number => sum + (quantities[room.roomTypeId] ?? 0) * room.maxOccupancy, 0);
    return Math.max(0, persons - beds);
}
```

In `Booking.ts` erscheint das Ergebnis als Hinweis unter der Liste:

```ts
/**
 * Kein Fehler, sondern der nächste Schritt: Wer zwei Zimmer braucht, wählt erst eines
 * und dann das zweite – dazwischen soll dort stehen, was noch fehlt.
 */
private getCapacityText(): string {
    // …
    const missing = getMissingBeds(quantities, this.rooms, adults + (this.guests.children ?? 0));
    if (missing === 0) return '';
    return missing === 1 ? 'Noch 1 Person ohne Bett – bitte ein weiteres Zimmer wählen.' : `Noch ${missing.toString()} Personen ohne Bett – bitte weitere Zimmer wählen.`;
}
```

Damit `maxOccupancy` bekannt ist, lädt die Zimmerabfrage die Spalte mit (`room_types.max_occupancy`), und `RoomTypeDetail`/`RoomCard` bekommen ein neues Feld.

### 5. Erste Frontend-Tests

Obwohl `V12` Frontend-Tests „vorerst" ausgeschlossen hatte, kommen hier die ersten beiden Vitest-Dateien im `src/`-Ordner hinzu: `breakfast.spec.ts` und `roomQuantity.spec.ts`. Das ist genau der Ertrag von `V16` – die Logik war bereits als reine Funktionen herausgezogen, also ließen sich die Tests ohne Umbau schreiben:

```ts
describe('clampQuantity mit Zimmergrenze', () => {
    it('meldet `adults`, wenn die Erwachsenen die Grenze setzen', () => {
        expect(clampQuantity(3, 5, 0, 2)).toEqual({ value: 2, limitedBy: 'adults' });
    });

    it('bevorzugt `roomsFree` bei Gleichstand', () => {
        expect(clampQuantity(3, 2, 0, 2)).toEqual({ value: 2, limitedBy: 'roomsFree' });
    });
});

describe('getMissingBeds (E48)', () => {
    const rooms = [card('doppel', 2), card('suite', 4)];

    it('zählt die Betten über alle gewählten Kategorien zusammen', () => {
        expect(getMissingBeds({ doppel: 1, suite: 1 }, rooms, 6)).toBe(0);
    });

    it('nennt die Personen ohne Bett', () => {
        expect(getMissingBeds({ doppel: 1 }, rooms, 5)).toBe(3);
    });
});
```

Auf der Datenbankseite wachsen `create-booking.spec.ts` und `availability.spec.ts` deutlich. Neue Testfälle heißen u.a.:

- „bucht zwei Kategorien in EINEM Vorgang, mit einer Gruppe"
- „verteilt die Personen nach der Regel aus E48"
- „rollt ALLE Positionen zurück, wenn eine scheitert"
- „kaputte Positionen sind ein strukturierter Fehler, kein Cast-Fehler"
- „ein Erwachsener mit drei Kindern passt nicht: nur ein Zimmer ist belegbar"

Der Test „rollt ALLE Positionen zurück" prüft die wichtigste Eigenschaft einer Transaktion: Entweder wird der ganze Vorgang gebucht oder gar nichts.

## Was wurde erreicht?

Die Buchungsseite versteht die Gästezahl jetzt so, wie ein Mensch sie meint – als Gesamtzahl. Mehrere Kategorien lassen sich in **einem** Vorgang buchen, die Datenbank prüft, ob alle zusammen hineinpassen, und verteilt die Gäste selbst.

| Technik                                        | Wozu                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Revidierte Entscheidung stehen lassen          | spätere Leser verstehen, warum es jetzt anders ist                |
| `jsonb`-Parameter selbst validieren            | strukturierte Ablehnung statt technischem Cast-Fehler             |
| `unnest … with ordinality` + Fensterfunktion   | Arrays als Tabelle, laufende Summen ohne Schleife                 |
| `immutable` SQL-Funktion                       | eine Regel an genau einer Stelle, ohne Tabellenzugriff            |
| Abbruchbedingung für „unmöglichen" Fall        | Fehlermeldung statt Endlosschleife                                |
| Neuer Parameter mit Default-Wert               | bestehende Aufrufe bleiben gültig                                 |
| Reine Funktionen → Tests ohne Umbau            | `V16` zahlt sich zum ersten Mal aus                               |

Offen bleibt laut Nachtrag im Umsetzungsplan die **Rechnungsadresse** (`billing_addresses`): _„`create_booking` wird dafür noch einmal ersetzt."_

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](008_2026-09-23_sektion-zusatzleistungen-je-vorgang.md)
