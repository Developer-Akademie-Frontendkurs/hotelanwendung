[← Vorheriger Commit](005_2026-09-16_belegung-verpflichtend-kein-suchdefault.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# zimmer anzahl und frühstuck integriert

- **Commit:** `deb55be`
- **Datum:** 2026-09-16
- **Autor:** Oliver Jung

## Worum geht es?

Die kurze Commit-Message täuscht: Mit über 1 100 neuen Zeilen in zwölf Dateien ist das einer der größten Commits des Branches. Er führt die **Zusatzleistung Frühstück** ein – und zwar von der Datenbank bis zur Checkbox auf der Zimmerkarte.

```text
 docs/datenbank/README.md                           |  66 ++++-
 docs/datenbank/schema.md                           |  66 ++++-
 docs/datenbank/umsetzungsplan.md                   |  17 +-
 screenshots/fruehstueck-zimmerkarte.png            | Bin 0 -> 257719 bytes
 src/shared/state/bookingState.ts                   |  42 +++
 src/views/BookingView/Booking.ts                   | 125 +++++++-
 src/views/BookingView/breakfast.ts                 |  66 +++++
 supabase/migrations/20260916101000_services.sql    |  73 +++++
 .../migrations/20260916102000_booking_extras.sql   |  80 ++++++
 .../20260916103000_create_booking_extras.sql       | 319 +++++++++++++++++++++
 supabase/seed.sql                                  |  21 ++
 supabase/tests/booking-extras.spec.ts              | 263 +++++++++++++++++
 12 files changed, 1124 insertions(+), 14 deletions(-)
```

Der Commit folgt dem Muster des Projekts in voller Länge: **Entscheidung (`E47`) → Schema → Migration → Seed → Datenbanktests → Frontend.** Er zeigt, dass eine scheinbar kleine UI-Anforderung („eine Checkbox mit Frühstück") eine grundsätzliche Frage aufwirft: _Gehört der Betrag in den Zimmerpreis oder wird er ein eigener Posten?_

## Die Änderungen im Detail

### 1. Die Entscheidung `E47`: ein eigener Posten

In `docs/datenbank/README.md` steht die neue Entscheidung mit drei Begründungen, „von denen jeder allein reicht":

```markdown
### E47 — Das Frühstück ist ein eigener Posten, nicht Teil des Zimmerpreises

1. **Der Zimmerpreis kann es nicht ausdrücken.** `room_type_rates.amount_cents` gilt pro **Zimmer**
   und Nacht, das Frühstück kostet pro **Person** und Morgen. …
2. **Das Einfrieren wäre unumkehrbar.** `booking_nights` friert den Preis pro Nacht ein (E21). Wäre
   das Frühstück eingebacken, ließe sich an einer bestehenden Buchung nie mehr trennen, was
   Beherbergung und was Verpflegung war …
3. **Der Client darf den Preis nicht setzen** (E6, Leitsatz 1). `create_booking` rechnet die Summe
   selbst. …
```

Für Lernende ist Grund 1 der wichtigste: Es ist eine Frage der **Bezugsgröße**. Ein Doppelzimmer kostet dasselbe, egal ob eine oder zwei Personen darin schlafen – das Frühstück nicht. Zwei Preise mit unterschiedlicher Bezugsgröße gehören nicht in dieselbe Spalte.

Ausdrücklich verworfen wird auch der naheliegende Zwischenweg, einen zweiten Tarif „Übernachtung mit Frühstück" anzulegen: Dann müsste jede Saison und jede Kategorie doppelt gepflegt werden, „und eine vergessene [Preisänderung] wäre stillschweigend ein falscher Preis".

Ebenso bemerkenswert ist ein kleiner Nachtrag an anderer Stelle der README. Zusatzleistungen standen bisher auf der Liste der Dinge, die **absichtlich** nicht Teil des Schemas sind (Entscheidung `E15`, der „Scope-Zaun"), mit dem Versprechen, dass sie sich später additiv ergänzen lassen. Der Commit hält fest:

```markdown
> **Nachtrag 2026-09-16:** Die **Zusatzleistungen** sind seit E47 drin (`services` / `booking_extras`).
> Der Zaun hat gehalten, was er versprochen hat: Die Erweiterung war rein additiv.
```

Hier wird eine frühere Behauptung („das lässt sich später ergänzen") an der Wirklichkeit geprüft – und bestätigt.

### 2. Zwei neue Tabellen nach bekanntem Muster

Datei `supabase/migrations/20260916101000_services.sql` – die **Stammdaten** (was gilt heute):

```sql
create table public.services (
    id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references public.hotels on delete restrict,
    code text not null,
    name text not null,

    -- Die Bezugsgroesse sagt, was EINE Einheit in booking_extras.quantity ist. Ohne
    -- sie waere `quantity = 4` nur im Quelltext von create_booking nachschlagbar.
    charge_basis text not null check (charge_basis in ('per_person_night')),

    amount_cents int not null check (amount_cents > 0),

    -- Kinderpreis. NULL heisst "kein eigener Preis" - Kinder zahlen dann wie
    -- Erwachsene, statt still gratis zu fruehstuecken.
    --
    -- Anders als bei room_type_rates ist hier 0 ERLAUBT und bedeutet "Kinder frei".
    child_amount_cents int check (child_amount_cents >= 0),

    currency text not null default 'EUR' check (char_length(currency) = 3),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (hotel_id, code)
);
```

Datei `supabase/migrations/20260916102000_booking_extras.sql` – der **Vertrag** (was beim Buchen galt):

```sql
create table public.booking_extras (
    booking_id uuid not null references public.bookings on delete cascade,
    service_id uuid not null references public.services on delete restrict,

    guest_kind text not null check (guest_kind in ('adult', 'child')),
    quantity int not null check (quantity > 0),
    unit_amount_cents int not null check (unit_amount_cents >= 0),
    amount_cents int not null check (amount_cents >= 0),

    created_at timestamptz not null default now(),

    primary key (booking_id, service_id, guest_kind),

    -- Die Zeile prueft sich selbst.
    constraint booking_extras_amount_consistent check (amount_cents = quantity * unit_amount_cents)
);
```

Das Paar `services`/`booking_extras` entspricht genau dem schon bekannten Paar `room_type_rates`/`booking_nights` aus Branch `datenbank-anbindung`: Die eine Tabelle sagt, was **heute** gilt, die andere hält fest, was **beim Buchen** galt. Ändert das Hotel morgen den Frühstückspreis, bleiben bestehende Buchungen unberührt – eine Buchung ist ein Vertrag.

Drei Details, die man mitnehmen sollte:

- **`ON DELETE CASCADE` vs. `ON DELETE RESTRICT`.** Die Posten sind Teil der Buchung und verschwinden mit ihr (`CASCADE`). Eine Leistung, auf die eine Buchung verweist, darf dagegen **nicht** gelöscht werden (`RESTRICT`) – sie wird archiviert.
- **Das selbstprüfende `CHECK`.** `amount_cents = quantity * unit_amount_cents` macht es unmöglich, eine Zeile zu speichern, deren Summe nicht zu ihren Faktoren passt.
- **`NULL` und `0` bedeuten Verschiedenes.** Beim Kinderpreis heißt `NULL` „wie Erwachsene", `0` heißt „gratis". Wer beides gleich behandelt, verschenkt versehentlich Frühstücke.

Außerdem bekommt `bookings` zwei Spalten:

```sql
alter table public.bookings
    add column extras_amount_cents int not null default 0 check (extras_amount_cents >= 0),
    add column grand_total_cents int generated always as (total_amount_cents + extras_amount_cents) stored;
```

`GENERATED ALWAYS AS … STORED` ist eine **generierte Spalte**: PostgreSQL berechnet den Wert beim Schreiben selbst, niemand kann ihn falsch setzen. Die Begründung, warum nicht einfach `total_amount_cents` die neue Summe wird, ist lehrreich: Diese Spalte bedeutete bisher „Summe der Nächte". Ihre Bedeutung still zu ändern, würde jede bestehende Abfrage etwas anderes meinen lassen. Deshalb bekommt der neue Wert einen **neuen Namen**.

### 3. `create_booking` rechnet das Frühstück mit

Datei `supabase/migrations/20260916103000_create_booking_extras.sql`. Die Funktion bekommt einen Parameter mehr – und die alte Signatur wird ausdrücklich entfernt:

```sql
-- Die alte Signatur wird GEDROPPT, nicht ueberladen: Zwei Funktionen mit gleichem
-- Namen, deren Argumentlisten sich nur um einen Parameter mit Default unterscheiden,
-- machen jeden bisherigen Aufruf mehrdeutig ("function is not unique") - PostgREST
-- bekaeme dann einen Fehler statt einer Buchung.
drop function if exists public.create_booking(date, date, uuid, int, text, text, text, int, text, int);

create or replace function public.create_booking(
    -- … bisherige Parameter …
    p_rooms int default 1,
    p_with_breakfast boolean default false
)
```

Das ist eine Falle, die man kennen sollte: In PostgreSQL ist eine Funktion über **Name + Parametertypen** identifiziert. `create or replace` mit einer anderen Parameterliste ersetzt also nicht die alte Funktion, sondern legt eine **zweite** an.

Der neue Rechenschritt:

```sql
-- 4b. Zusatzleistung Fruehstueck (E47)
--
-- Anzahl der Fruehstuecke = Anzahl der NAECHTE: gefruehstueckt wird am Morgen nach
-- jeder Nacht, das letzte am Abreisetag.
if p_with_breakfast then
    select s.id, s.amount_cents, coalesce(s.child_amount_cents, s.amount_cents)
    into v_service_id, v_unit_adult, v_unit_child
    from public.services s
    where s.hotel_id = v_hotel_id
      and s.code = 'BREAKFAST'
      and s.archived_at is null;

    -- Kein Eintrag heisst nicht "gratis" …
    if v_service_id is null then
        perform public.reject_booking('leistung_unbekannt', p_check_in);
    end if;

    v_extra_adult := v_naechte * p_adults * v_unit_adult;
    v_extra_child := v_naechte * v_children * v_unit_child;
    v_extras := v_extra_adult + v_extra_child;
end if;
```

Und beim Einfrieren entstehen getrennte Zeilen für Erwachsene und Kinder – die Kinderzeile nur, wenn es Kinder gibt:

```sql
if p_with_breakfast then
    insert into public.booking_extras (booking_id, service_id, guest_kind, quantity, unit_amount_cents, amount_cents)
    select v_booking_id, v_service_id, 'adult', v_naechte * p_adults, v_unit_adult, v_extra_adult
    union all
    select v_booking_id, v_service_id, 'child', v_naechte * v_children, v_unit_child, v_extra_child
    where v_children > 0;
end if;
```

Der neue Ablehnungsgrund `leistung_unbekannt` wird für Gäste maskiert (`mask_reason`) – „dass unsere Konfiguration lückenhaft ist, geht ihn nichts an".

### 4. Seed und Tests

Im Seed (`supabase/seed.sql`) steht das Frühstück als Datenzeile: 17 € für Erwachsene, 8,50 € für Kinder.

```sql
insert into public.services (id, hotel_id, code, name, charge_basis, amount_cents, child_amount_cents)
values (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000001',
    'BREAKFAST',
    'Frühstück',
    'per_person_night',
    1700,
    850
);
```

Die neue Testdatei `supabase/tests/booking-extras.spec.ts` prüft mit dem **Gast-Client** (`anonClient`), was die Entscheidung trägt. Ein Beispiel:

```ts
it('lässt den Zimmerpreis unberührt und weist den Aufschlag daneben aus', () => {
    expect(result.nights).toBe(3);
    expect(result.total_amount_cents).toBe(3 * NIGHT_CENTS);
    expect(result.extras_amount_cents).toBe(3 * 2 * BREAKFAST_CENTS + 3 * 1 * BREAKFAST_CHILD_CENTS);
    expect(result.grand_total_cents).toBe(result.total_amount_cents + result.extras_amount_cents);
});
```

Weitere Tests prüfen, dass der Preis **eingefroren** ist (Preiserhöhung am Service ändert die Buchung nicht), dass ohne Kinder nur eine Zeile entsteht, dass eine fehlende Frühstücksleistung zur Ablehnung führt – und dass ein Gast zwar die Preisliste sehen darf, aber **nicht** die Posten fremder Buchungen (RLS).

### 5. Frontend: `breakfast.ts` als Rechenhilfe

Die neue Datei `src/views/BookingView/breakfast.ts` beginnt mit einem wichtigen Satz:

```ts
/**
 * Die Rechnung hier ist eine **Bequemlichkeit, keine zweite Wahrheit** … Verbindlich
 * rechnet `create_booking`; was hier steht, ist nur die Zahl, die der Gast vor dem
 * Absenden sehen soll. Weichen beide ab, gewinnt die Datenbank – und dann ist diese
 * Datei falsch, nicht die Buchung.
 */

export function getBreakfastAmountCents(service: BreakfastService, occupancy: Occupancy, nights: number, rooms: number): number {
    const perRoom = nights * (occupancy.adults * service.unitAmountCents + occupancy.children * service.childUnitAmountCents);
    return perRoom * rooms;
}

export function buildBreakfastService(row: ServiceRow | null): BreakfastService | null {
    if (row === null) return null;

    return {
        serviceId: row.id,
        name: row.name,
        unitAmountCents: row.amount_cents,
        childUnitAmountCents: row.child_amount_cents ?? row.amount_cents,
        currency: row.currency,
    };
}
```

`buildBreakfastService` löst den fehlenden Kinderpreis **genau so** auf wie die Datenbank (`coalesce(child_amount_cents, amount_cents)`). Zwei Implementierungen derselben Regel sind gefährlich – wenn es sie schon geben muss, sollen sie wenigstens sichtbar dasselbe tun.

### 6. `bookingState`: Frühstück neben den Mengen

```ts
/**
 * Frühstück je Kategorie, geschlüsselt wie die Mengen (E47).
 *
 * Bewusst neben `roomQuantities` und nicht darin: Die Regeln in `roomQuantity.ts`
 * rechnen mit Zahlen, und ein Objekt statt einer Zahl würde jede dieser Funktionen
 * anfassen, ohne dass eine von ihnen das Häkchen je braucht.
 */
export type RoomBreakfast = Readonly<Record<string, boolean>>;
```

Und eine Regel, die an zwei Enden durchgesetzt wird – **kein Frühstück ohne Zimmer**:

```ts
function setRoomQuantities(next: RoomQuantities): void {
    roomQuantities = Object.fromEntries(/* … Nullen filtern … */);

    // Ohne Zimmer kein Frühstück. Bliebe das Häkchen stehen, käme es beim erneuten
    // Wählen derselben Kategorie unbestellt zurück …
    roomBreakfast = Object.fromEntries(
        Object.entries(roomBreakfast).filter(([roomTypeId, wanted]: [string, boolean]): boolean => wanted && roomQuantities[roomTypeId] !== undefined),
    );
    notify();
}

function setBreakfast(roomTypeId: string, wanted: boolean): void {
    if (wanted && getRoomQuantity(roomTypeId) === 0) return;

    // Abgewähltes wird entfernt, nicht auf `false` gesetzt: `false` und „nicht gewählt"
    // sind dieselbe Aussage, und zwei Schreibweisen für eine Aussage laufen auseinander.
    roomBreakfast = wanted
        ? { ...roomBreakfast, [roomTypeId]: true }
        : Object.fromEntries(Object.entries(roomBreakfast).filter(([id]: [string, boolean]): boolean => id !== roomTypeId));
    notify();
}
```

„Zwei Schreibweisen für eine Aussage laufen auseinander" – dasselbe Prinzip wie bei den Nullen in den Mengen aus Commit 004.

### 7. Die Checkbox auf der Zimmerkarte

In `Booking.ts` lädt `loadRooms()` den Frühstückspreis jetzt parallel zu den Zimmern – aus der Datenbank, nicht als Konstante:

```diff
-            const [details, availability] = await Promise.all([
+            const [details, breakfast, availability] = await Promise.all([
                 supabase.from('room_types').select('id, name, slug, description, room_type_images(storage_path, alt_text, sort_order)').order('name'),
+                supabase.from('services').select('id, name, amount_cents, child_amount_cents, currency').eq('code', 'BREAKFAST').maybeSingle(),
```

`.maybeSingle()` liefert genau eine Zeile oder `null` – ohne Fehler, wenn keine existiert. Ist keine Frühstücksleistung hinterlegt, gibt es keine Checkbox: „eine Checkbox, die in eine Ablehnung führt, ist eine Falle."

Unter der Checkbox steht der Preis – und sobald sie angehakt ist, der **konkrete Aufschlag**:

```ts
/**
 * Ohne Häkchen der Einzelpreis, mit Häkchen der Betrag, der tatsächlich dazukommt.
 * Ein Aufschlag, den der Gast erst auf der Bestätigung als Zahl sieht, ist kein
 * Angebot, sondern eine Überraschung.
 */
private getBreakfastLabel(room: RoomCard): string {
    // …
    const perAdult = formatPrice(service.unitAmountCents, service.currency);
    const perChild = formatPrice(service.childUnitAmountCents, service.currency);
    const preise = `${perAdult} pro Erwachsenem, ${perChild} pro Kind und Nacht`;
    // …
    const amount = getBreakfastAmountCents(service, occupancy, availability.nights, rooms);
    return `+ ${formatPrice(amount, service.currency)} · ${preise}`;
}
```

Eine kleine, aber typische Korrektur betrifft `formatPrice`:

```diff
 function formatPrice(cents: number, currency: string): string {
-    const amount = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(cents / 100);
+    const digits = cents % 100 === 0 ? 0 : 2;
+    const amount = new Intl.NumberFormat('de-AT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
     return currency === 'EUR' ? `${amount}€` : `${amount} ${currency}`;
 }
```

Mit `minimumFractionDigits: 0` wurde der Kinderpreis von 850 Cent als „8,5€" angezeigt – „als Betrag gelesen ein Tippfehler". Jetzt gibt es entweder keine oder genau zwei Nachkommastellen.

Schließlich enthält das Objekt, das `submit()` (noch per `console.log`) ausgibt, jetzt Positionen:

```ts
positions: Object.entries(quantities).map(
    ([roomTypeId, rooms]: [string, number]): BookingPosition => ({
        roomTypeId,
        rooms,
        withBreakfast: breakfast[roomTypeId] ?? false,
    }),
),
```

Ein Screenshot der fertigen Zimmerkarte liegt als `screenshots/fruehstueck-zimmerkarte.png` im Repo.

## Was wurde erreicht?

Das Frühstück ist buchbar – verbindlich gerechnet in der Datenbank, als eigener, eingefrorener Posten, und in der Oberfläche mit dem Betrag angezeigt, der tatsächlich dazukommt. Der Scope-Zaun `E15` hat sich als tragfähig erwiesen: Keine bestehende Tabelle hat ihre Bedeutung geändert.

| Technik                                     | Wozu                                                             |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Stammdaten + eingefrorene Vertragszeilen    | Preisänderungen berühren bestehende Buchungen nicht              |
| Generierte Spalte (`GENERATED ALWAYS AS`)   | Summe, die niemand falsch setzen kann                            |
| Neuer Name statt neuer Bedeutung            | bestehende Abfragen meinen weiterhin dasselbe                    |
| Selbstprüfendes `CHECK`                     | Summe und Faktoren können nicht auseinanderlaufen                |
| Alte Funktionssignatur `drop`pen            | keine mehrdeutigen Überladungen in PostgreSQL                    |
| `NULL` ≠ `0` beim Preis                     | „kein eigener Preis" ist nicht „gratis"                          |
| Frontend-Rechnung als „Bequemlichkeit"      | die Datenbank bleibt die einzige verbindliche Quelle             |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](007_2026-09-23_belegung-als-gesamtzahl-mehrere-kategorien.md)
