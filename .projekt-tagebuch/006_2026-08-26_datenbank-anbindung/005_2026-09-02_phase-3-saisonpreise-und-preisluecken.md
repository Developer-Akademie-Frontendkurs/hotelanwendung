[← Vorheriger Commit](004_2026-09-02_phase-2-stammdaten-rls-seed.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(db): Phase 3 - Saisonpreise, Ueberlappungsschutz und Preisluecken

- **Commit:** `2e25062`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Ein Hotelzimmer kostet im August mehr als im November. Diese Phase baut die Preisstruktur – und zwar so, dass zwei widersprechende Preise für dieselbe Nacht **unmöglich** sind, nicht bloß verboten.

```text
 supabase/migrations/20260902107000_rate_plans.sql  |  36 ++++++
 .../migrations/20260902108000_room_type_rates.sql  |  46 +++++++
 .../migrations/20260902109000_find_rate_gaps.sql   |  87 +++++++++++++
 supabase/seed.sql                                  |  53 ++++++++
 supabase/tests/helpers/fixtures.ts                 |  28 ++++-
 supabase/tests/rates.spec.ts                       | 136 +++++++++++++++++++++
 6 files changed, 384 insertions(+), 2 deletions(-)
```

Drei Migrationen, ein erweiterter Seed und die erste **Prüffunktion** – eine Funktion, deren Zweck es ist, Konfigurationsfehler zu finden.

## 1. `rate_plans` – ein Seam mit einer einzigen Zeile

```sql
-- rate_plans (E5).
--
-- Der Seam, der "Flex / Nicht erstattbar / Fruehbucher" spaeter zu DATENZEILEN macht
-- statt zu einer Schemaaenderung. v1 hat genau einen Plan: STANDARD.
--
-- Die Tabelle rechtfertigt sich schon heute: ohne sie haette room_type_rates keinen
-- Platz fuer die Frage "welcher Preis von welcher Art", und der erste zusaetzliche
-- Tarif waere eine Migration mit Backfill statt eines INSERT.

create table public.rate_plans (
    id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references public.hotels on delete restrict,
    code text not null,
    name text not null,
    description text,
    is_default boolean not null default false,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hotel_id, code)
);
```

Wieder eine Tabelle, die in v1 nur eine Zeile enthält – wie `hotels` in Phase 2. Und wieder mit derselben Argumentationsstruktur: Sie ist nicht „für später" da, sondern weil `room_type_rates` sonst keinen Platz für die Frage _„Preis für welchen Tarif?"_ hätte.

Die Rechnung wird explizit benannt: Ohne diese Tabelle wäre der erste zusätzliche Tarif eine **Migration mit Backfill** – Spalte anlegen, alle bestehenden Zeilen füllen, Constraint nachziehen. Mit ihr ist es ein `INSERT`.

Interessant ist der Index:

```sql
-- Hoechstens ein Standardtarif pro Hotel. Ohne diesen Index waere "der Standard"
-- eine Frage der Sortierreihenfolge - und damit zufaellig.
create unique index rate_plans_one_default_idx on public.rate_plans (hotel_id) where is_default and archived_at is null;
```

Ein **eindeutiger Teilindex** – eine sehr elegante Technik. Zu lesen als: _„Es darf höchstens eine Zeile pro `hotel_id` geben, bei der `is_default` wahr und `archived_at` leer ist."_

Ein gewöhnliches `unique (hotel_id, is_default)` würde etwas anderes bedeuten: höchstens einen Standard **und** höchstens einen Nicht-Standard – also maximal zwei Tarife insgesamt. Falsch. Die Bedingung im `where` löst das exakt.

Der Kommentar nennt die Konsequenz eines fehlenden Constraints: Wenn zwei Tarife `is_default = true` haben, entscheidet ein `select … where is_default limit 1` per Sortierreihenfolge, welcher gewinnt – und die ist in SQL ohne `order by` **nicht garantiert**. Der Preis eines Zimmers wäre dann zufällig. Ein Fehler, der sich niemals reproduzieren lässt.

## 2. `room_type_rates` – die eigentlichen Saisonpreise

```sql
create table public.room_type_rates (
    id uuid primary key default gen_random_uuid(),
    room_type_id uuid not null references public.room_types on delete restrict,
    rate_plan_id uuid not null references public.rate_plans on delete restrict,
    valid_from date not null,
    -- Halb-offen [valid_from, valid_to): der letzte Tag gehoert zum naechsten
    -- Zeitraum. Damit lassen sich Saisons luecken- und ueberlappungsfrei
    -- aneinanderlegen, ohne bei jedem Uebergang einen Tag zu verlieren (E8).
    valid_to date not null,
    validity daterange generated always as (daterange(valid_from, valid_to, '[)')) stored,
    -- Geld als integer Cent, nie float (E8). 0 ist verboten: ein Preis von null ist
    -- keine Konfiguration, sondern ein Versehen - eine fehlende Zeile ist der
    -- richtige Weg, "nicht buchbar" zu sagen (E25).
    amount_cents int not null check (amount_cents > 0),
    currency text not null default 'EUR' check (char_length(currency) = 3),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (valid_to > valid_from),
    -- Zwei widersprechende Preise fuer dieselbe Nacht sind damit UNMOEGLICH - nicht
    -- "verboten laut Doku", sondern von der Datenbank abgelehnt. Luecken bleiben
    -- erlaubt und bedeuten "nicht buchbar" (E25).
    exclude using gist (room_type_id with =, rate_plan_id with =, validity with &&)
);
```

### Der Exclusion-Constraint über drei Bedingungen

```sql
exclude using gist (room_type_id with =, rate_plan_id with =, validity with &&)
```

In Phase 2 hatte der Constraint zwei Bedingungen (Zimmer + Zeitraum), hier sind es drei: _„Es dürfen keine zwei Zeilen existieren mit gleicher Kategorie **und** gleichem Tarif **und** überlappendem Gültigkeitszeitraum."_

Damit ist die Preisfrage eindeutig beantwortbar. Für jede Kombination aus Kategorie, Tarif und Nacht gibt es **höchstens einen** Preis. Nie zwei – das wäre ein Widerspruch. Und der Test dazu belegt, dass es funktioniert:

```ts
it('nimmt einen ersten Saisonzeitraum an', async () => {
    const { error } = await rate('2028-01-01', '2028-02-01');
    expect(error).toBeNull();
});

it('LEHNT einen überlappenden Zeitraum derselben Kategorie und desselben Tarifs AB', async () => {
    const { error } = await rate('2028-01-15', '2028-03-01');
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23P01'); // exclusion_violation
});

it('erlaubt einen Anschlusszeitraum: valid_to = valid_from des nächsten', async () => {
    // Der halb-offene Bereich (E8) macht lückenlose Saisonketten möglich. Wäre er
    // geschlossen, müsste zwischen zwei Saisons ein Tag Abstand liegen — und der
    // wäre dann preislos und damit nicht buchbar (E25).
    const { error } = await rate('2028-02-01', '2028-03-01');
    expect(error).toBeNull();
});
```

Der dritte Test ist der wichtige. Zwei Saisons können direkt aneinander anschließen: Die eine endet am 1. Februar, die andere beginnt am 1. Februar. Mit geschlossenen Intervallen müsste zwischen zwei Saisons ein Tag Abstand liegen – und dieser Tag hätte dann **keinen Preis** und wäre nicht buchbar. Ein Off-by-one, der pro Saisonwechsel einen Tag Umsatz kostet und niemals eine Fehlermeldung erzeugt.

### `amount_cents > 0` – warum 0 verboten ist

```sql
amount_cents int not null check (amount_cents > 0),
```

Nicht `>= 0`, sondern `> 0`. Der Kommentar:

```sql
    -- Geld als integer Cent, nie float (E8). 0 ist verboten: ein Preis von null ist
    -- keine Konfiguration, sondern ein Versehen - eine fehlende Zeile ist der
    -- richtige Weg, "nicht buchbar" zu sagen (E25).
```

Das ist eine feine, aber folgenreiche Unterscheidung. Es gibt drei denkbare Zustände:

| Zustand              | Bedeutung                    | Umsetzung im Schema        |
| -------------------- | ---------------------------- | -------------------------- |
| Preis ist X          | Zimmer kostet X Cent         | Zeile mit `amount_cents=X` |
| Zimmer nicht buchbar | kein Angebot in dieser Nacht | **keine Zeile**            |
| Preis ist 0          | Zimmer ist gratis            | **verboten**               |

Ein Preis von 0 wäre ein gültiger Preis: Die Buchung würde durchgehen, und der Aufenthalt wäre kostenlos. Genau das ist der gefährlichste denkbare Konfigurationsfehler. Deshalb existiert dieser Zustand gar nicht – „nicht buchbar" wird durch das **Fehlen** einer Zeile ausgedrückt.

Der Test dazu:

```ts
it('LEHNT amount_cents = 0 AB — ein Preis von null ist ein Versehen (E25)', async () => {
    const { error } = await rate('2028-06-01', '2028-07-01', 0);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514'); // check_violation
});
```

### Eine Ehrlichkeit über die Multi-Hotel-Erweiterung

```sql
-- Anmerkung fuer die Multi-Hotel-Erweiterung (E2): Die Tabelle kennt kein hotel_id,
-- sondern erbt es ueber room_type_id UND rate_plan_id. Dass beide zum selben Hotel
-- gehoeren muessen, erzwingt heute nichts - bei einem Hotel ist das gegenstandslos,
-- beim zweiten braucht es einen zusammengesetzten Fremdschluessel.
```

Ein Kommentar, der eine **bekannte Lücke** benennt statt sie zu verschweigen. Theoretisch könnte man eine Preiszeile anlegen, die eine Kategorie aus Hotel A mit einem Tarif aus Hotel B verbindet. Bei einem Hotel unmöglich, bei zwei ein echtes Problem – und der Lösungsweg (zusammengesetzter Fremdschlüssel) steht schon da.

Solche Notizen sind wertvoller als der Versuch, heute schon alles abzudichten. Sie kosten drei Zeilen und sparen der nächsten Person eine halbe Stunde Nachdenken.

## 3. `find_rate_gaps` – eine Funktion, die Fehler sucht

Die interessanteste Migration dieser Phase. Sie legt keine Tabelle an, sondern eine **Prüffunktion**.

Warum braucht man die überhaupt? Der Kommentar erklärt es:

```sql
-- find_rate_gaps(tage int) — Naechte ohne Preiszeile (E25).
--
-- Warum diese Funktion ueberhaupt existiert: Eine Preisluecke ist ERLAUBT und
-- bedeutet "nicht buchbar". Im Kalender sieht sie deshalb genauso aus wie
-- "ausgebucht" - fuer den Betrieb sind das aber entgegengesetzte Signale:
-- ausgebucht ist Erfolg, kein_preis ist ein Konfigurationsfehler (E28).
-- Ohne diese Funktion bemerkt niemand den Unterschied.
```

Das ist der Kern: Aus Gästesicht ist beides „geht nicht". Aus Betriebssicht ist eines der beste denkbare Zustand (alles verkauft) und das andere ein Fehler (vergessen, Preise zu pflegen). Ein Kalender, der beides gleich darstellt, ist für Gäste richtig und für den Betrieb blind.

### Die Funktion im Detail

```sql
create or replace function public.find_rate_gaps(tage int default 365)
returns table (
    hotel_id uuid,
    room_type_id uuid,
    room_type_name text,
    rate_plan_id uuid,
    rate_plan_code text,
    gap_start date,
    gap_end date,
    nights int
)
language sql
stable
set search_path = ''
as $$
```

`returns table (...)` bedeutet: Die Funktion verhält sich wie eine Tabelle und kann in `select … from find_rate_gaps(365)` benutzt werden. `stable` sagt PostgreSQL, dass die Funktion innerhalb einer Abfrage bei gleichen Argumenten dasselbe liefert – das erlaubt Optimierungen.

Der Körper ist eine Kette von **CTEs** (Common Table Expressions, die `with`-Blöcke). Jeder Schritt ist einzeln benennbar und lesbar:

**Schritt 1 – alle betrachteten Nächte erzeugen:**

```sql
with horizon as (
    select generate_series(current_date, current_date + (tage - 1), interval '1 day')::date as night
),
```

`generate_series` erzeugt eine Zeile pro Tag. Bei `tage = 365` sind das 365 Zeilen – von heute bis heute+364.

**Schritt 2 – alle Kombinationen aus Kategorie und Tarif:**

```sql
-- Jede aktive Kategorie mit jedem aktiven Tarif DESSELBEN Hotels. Absichtlich alle
-- Tarife und nicht nur der Standard: ein buchbarer Tarif ohne Preis ist genau der
-- Konfigurationsfehler, um den es hier geht.
combos as (
    select rt.hotel_id, rt.id as room_type_id, rt.name as room_type_name, rp.id as rate_plan_id, rp.code as rate_plan_code
    from public.room_types rt
    join public.rate_plans rp on rp.hotel_id = rt.hotel_id and rp.archived_at is null
    where rt.archived_at is null
),
```

**Schritt 3 – die fehlenden finden:**

```sql
missing as (
    select c.hotel_id, c.room_type_id, c.room_type_name, c.rate_plan_id, c.rate_plan_code, h.night
    from combos c
    cross join horizon h
    where not exists (
        select 1
        from public.room_type_rates r
        where r.room_type_id = c.room_type_id
          and r.rate_plan_id = c.rate_plan_id
          and r.validity @> h.night
    )
),
```

Der `cross join` bildet **jede** Kombination aus Kategorie/Tarif und Nacht – bei 3 Kategorien × 1 Tarif × 365 Nächten sind das 1095 Zeilen. Davon bleiben nur die übrig, für die keine passende Preiszeile existiert.

Der Operator `@>` heißt „enthält". `r.validity @> h.night` prüft, ob der Datumsbereich diesen Tag umfasst. Das ist deutlich lesbarer als `h.night >= r.valid_from and h.night < r.valid_to` – und weniger fehleranfällig, weil das `<` gegen `<=` nicht verwechselt werden kann.

**Schritt 4 – die eigentliche Kunst: „Gaps and Islands":**

```sql
-- Aufeinanderfolgende fehlende Naechte zu einem Block zusammenfassen: `night` minus
-- der laufenden Nummer ist innerhalb einer Luecke konstant. 300 Einzelzeilen waeren
-- fuer eine Admin-Ansicht unbrauchbar; drei Bloecke sagen dasselbe.
islands as (
    select
        hotel_id,
        room_type_id,
        room_type_name,
        rate_plan_id,
        rate_plan_code,
        night,
        night - (row_number() over (partition by room_type_id, rate_plan_id order by night))::int as island
    from missing
)
```

Dieses Muster ist ein bekannter SQL-Trick und lohnt sich zu verstehen. Angenommen, die Nächte 10, 11, 12 und 20, 21 fehlen:

| `night` | `row_number()` | `night - row_number()` = `island` |
| ------- | -------------- | --------------------------------- |
| Tag 10  | 1              | 9                                 |
| Tag 11  | 2              | 9                                 |
| Tag 12  | 3              | 9                                 |
| Tag 20  | 4              | 16                                |
| Tag 21  | 5              | 16                                |

Innerhalb eines **zusammenhängenden** Blocks steigen beide Werte um genau 1 – die Differenz bleibt konstant. An jeder Lücke springt sie. Damit ist die Differenz eine Gruppen-ID, nach der man einfach gruppieren kann:

```sql
select
    hotel_id, room_type_id, room_type_name, rate_plan_id, rate_plan_code,
    min(night) as gap_start,
    -- Halb-offen wie ueberall sonst (E8): gap_end ist der erste Tag MIT Preis.
    (max(night) + 1) as gap_end,
    count(*)::int as nights
from islands
group by hotel_id, room_type_id, room_type_name, rate_plan_id, rate_plan_code, island
order by room_type_name, gap_start;
```

Und beachte die Konsequenz bei `gap_end`: Auch hier halb-offen. `gap_end` ist der erste Tag **mit** Preis. Diese Konvention gilt im ganzen Schema, ausnahmslos – und dass sie ausnahmslos gilt, ist ihr eigentlicher Wert.

### Der Zugriffsschutz – und eine überraschende Wendung

```sql
-- SECURITY INVOKER (Standard) und nicht DEFINER - und das ist eine bewusste
-- Entscheidung: Ein `is_staff()`-Wachposten in der Funktion wuerde in v1 AUCH den
-- Service-Role-Key abweisen, denn is_staff() gibt fuer jede Rolle false zurueck
-- (E13). Mit Invoker-Rechten regelt stattdessen das EXECUTE-Recht den Zugang: der
-- Service-Role-Key darf, der Gast im Browser nicht.
revoke all on function public.find_rate_gaps(int) from public;
revoke all on function public.find_rate_gaps(int) from anon, authenticated;
grant execute on function public.find_rate_gaps(int) to service_role;
```

Hier zeigt sich ein Problem, das erst bei der Umsetzung sichtbar wurde. Der naheliegende Weg wäre gewesen:

```sql
-- SO NICHT (in v1):
create function public.find_rate_gaps(...) ...
as $$
begin
    if not public.is_staff() then
        raise exception 'nur fuer Mitarbeitende';
    end if;
    ...
end;
$$;
```

Das sieht gut aus, ist aber in v1 **unbrauchbar**: `is_staff()` gibt für _jede_ Rolle `false` zurück, auch für `service_role`. Die Funktion wäre für niemanden aufrufbar – eine Prüffunktion, die niemand ausführen kann.

Die Lösung: Kein Wachposten in der Funktion, sondern das **`EXECUTE`-Recht** regelt den Zugang. `revoke` nimmt allen das Recht, `grant` gibt es dem `service_role` zurück.

Diese Erkenntnis wird später in Phase 7 als Entscheidung `E38` festgehalten – ein Beispiel dafür, dass manche Dinge erst beim Bauen sichtbar werden, egal wie gut man vorher geplant hat.

Der Unterschied zwischen den beiden Sicherheitsmodellen:

| Modell             | Funktion läuft mit den Rechten von … | typischer Einsatz                      |
| ------------------ | ------------------------------------ | -------------------------------------- |
| `SECURITY INVOKER` | dem **Aufrufer** (Standard)          | Funktion soll nicht mehr dürfen als er |
| `SECURITY DEFINER` | dem **Eigentümer** der Funktion      | Funktion darf mehr (Phase 5/6)         |

## 4. Der Seed: Saisonpreise relativ zu heute

```sql
insert into public.rate_plans (id, hotel_id, code, name, description, is_default)
values (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000001',
    'STANDARD',
    'Standardtarif',
    'Flexibel stornierbar bis 14 Tage vor Anreise.',
    true
);
```

Und dann ein besonders lehrreicher Teil:

```sql
-- 13 Monatsblöcke ab dem aktuellen Monatsanfang — relativ zu current_date und nicht
-- mit festen Datumsangaben, damit ein Reset in sechs Monaten immer noch 12 Monate
-- abdeckt und der Kalender nicht in die Vergangenheit zeigt.
--
-- 13 statt 12: booking_horizon_days = 365 reicht vom heutigen Tag aus in den
-- 13. Monat hinein. Ein Block zu wenig wäre eine Preislücke am Horizontrand — also
-- genau der Fall, der laut E25 wie ein Bug aussieht, ohne einer zu sein.
insert into public.room_type_rates (room_type_id, rate_plan_id, valid_from, valid_to, amount_cents)
select
    basis.room_type_id,
    '00000000-0000-4000-8000-000000000201',
    monat::date,
    (monat + interval '1 month')::date,
    -- Saisonfaktor über den Kalendermonat. Ganzzahlige Cent, nie float (E8).
    round(
        basis.grundpreis_cents
        * case extract(month from monat)
            when 7 then 1.35   -- Juli
            when 8 then 1.35   -- August
            when 12 then 1.30  -- Weihnachten/Silvester
            when 2 then 1.20   -- Semesterferien / Ski
            when 5 then 1.10
            when 6 then 1.10
            when 9 then 1.10
            else 1.0
          end
    )::int
from generate_series(
        date_trunc('month', current_date),
        date_trunc('month', current_date) + interval '12 months',
        interval '1 month'
     ) as monat
cross join (
    values
        ('00000000-0000-4000-8000-000000000101'::uuid, 24000),  -- Double Suite
        ('00000000-0000-4000-8000-000000000102'::uuid, 16500),  -- Double Premium
        ('00000000-0000-4000-8000-000000000103'::uuid, 9500)    -- Einzelzimmer Alpin
) as basis (room_type_id, grundpreis_cents);
```

Drei Dinge sind hier bemerkenswert.

**Relative Datumsangaben statt fester.** Statt `'2026-09-01'` steht `date_trunc('month', current_date)`. Der Unterschied wird erst in sechs Monaten sichtbar: Ein Seed mit festen Daten läuft dann gegen Preise, die alle in der Vergangenheit liegen – der Kalender ist leer, und niemand versteht warum. Mit relativen Daten deckt jeder Reset wieder 12 Monate ab dem aktuellen Monat ab.

**Ein `INSERT … SELECT` statt 39 einzelner Zeilen.** Der `cross join` kombiniert 13 Monate mit 3 Kategorien und ergibt 39 Preiszeilen aus einer einzigen Anweisung. Der Saisonfaktor kommt aus einem `case` über die Monatsnummer.

**13 statt 12 Monate.** Der Kommentar erklärt es: Der Buchungshorizont ist 365 Tage. Vom 15. September aus gerechnet endet er am 15. September des Folgejahres – und reicht damit in den 13. Monatsblock hinein. Mit nur 12 Blöcken hätte der Kalender am äußersten Rand einen preislosen Bereich. Fachlich korrekt („keine Preiszeile = nicht buchbar"), aber von einem Bug nicht zu unterscheiden.

Das ist eine schöne Illustration dafür, dass **Randfälle bei Seed-Daten genauso mitgedacht werden müssen** wie im Code.

**Und `round(...)::int`.** Der Saisonfaktor `1.35` erzeugt eine Fließkommazahl. `round` macht daraus eine ganze Zahl, `::int` den passenden Typ. Damit bleibt die Regel „Geld ist immer `integer` Cent" auch im Seed gewahrt.

## 5. Die Fixture-Erweiterung

Zwei kleine, aber nützliche Ergänzungen in `fixtures.ts`:

```diff
 export type Fixture = {
     hotelId: string;
     roomTypeId: string;
     roomIds: string[];
+    /** Nur gesetzt, wenn `withRatePlan` angefordert wurde. */
+    ratePlanId?: string;
     cleanup: () => Promise<void>;
 };

+/** Datum als ISO-Tag, `offsetDays` Tage nach heute (UTC — wie der Datenbankcontainer). */
+export function isoDay(offsetDays: number): string {
+    const date = new Date();
+    date.setUTCDate(date.getUTCDate() + offsetDays);
+    return date.toISOString().slice(0, 10);
+}
```

`isoDay` wird ab hier in fast jedem Test benutzt. Der Grund ist derselbe wie beim Seed: Feste Datumsangaben in Tests laufen irgendwann ab. Ein Test, der `2026-09-15` prüft, ist ab dem 16. September ein Vergangenheits-Test – und schlägt fehl, weil die Buchung dann `vergangenheit` melden muss.

Der Hinweis auf **UTC** ist nicht dekorativ: `setUTCDate` und `toISOString` arbeiten in UTC, genau wie der Datenbankcontainer. Mit `setDate` (lokale Zeitzone) würde der Test in bestimmten Zeitzonen um Mitternacht einen Tag daneben liegen.

Interessant auch die Rückgabe am Ende der Funktion:

```ts
return ratePlanId === undefined ? { hotelId, roomTypeId, roomIds, cleanup } : { hotelId, roomTypeId, roomIds, ratePlanId, cleanup };
```

Das sieht umständlich aus, ist aber eine Folge der strikten TypeScript-Konfiguration des Projekts: `exactOptionalPropertyTypes` unterscheidet zwischen „Eigenschaft fehlt" und „Eigenschaft ist `undefined`". Ein `{ ratePlanId: undefined }` wäre bei `ratePlanId?: string` also ein Typfehler.

## 6. Die Tests zu `find_rate_gaps`

Der interessanteste Test des Commits – er baut absichtlich einen Fehler ein und prüft, ob die Prüffunktion ihn findet:

```ts
describe('find_rate_gaps (E25)', () => {
    let fixture: Fixture;

    // Fenster: heute .. heute+40, mit einem absichtlichen Loch von Tag 10 bis Tag 17.
    const HORIZON = 40;
    const GAP_START = isoDay(10);
    const GAP_END = isoDay(17);

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, withRatePlan: true });

        // Zwei Blöcke links und rechts des Lochs — der Rest des Fensters ist gedeckt.
        const { error } = await serviceClient.from('room_type_rates').insert([
            { room_type_id: fixture.roomTypeId, rate_plan_id: fixture.ratePlanId, valid_from: isoDay(0), valid_to: GAP_START, amount_cents: 11000 },
            { room_type_id: fixture.roomTypeId, rate_plan_id: fixture.ratePlanId, valid_from: GAP_END, valid_to: isoDay(HORIZON + 5), amount_cents: 11000 },
        ]);
        expect(error).toBeNull();
    });

    it('findet die absichtlich gerissene Lücke mit exakten Grenzen', async () => {
        const { data, error } = await serviceClient.rpc('find_rate_gaps', { tage: HORIZON });
        expect(error).toBeNull();

        const own = (data as { room_type_id: string; gap_start: string; gap_end: string; nights: number }[]).filter((row) => row.room_type_id === fixture.roomTypeId);

        expect(own).toHaveLength(1);
        expect(own[0]?.gap_start).toBe(GAP_START);
        // gap_end ist halb-offen: der erste Tag MIT Preis.
        expect(own[0]?.gap_end).toBe(GAP_END);
        expect(own[0]?.nights).toBe(7);
    });
```

Die Prüfung ist genau, nicht ungefähr: **eine** Lücke, mit **diesen** Grenzen und **genau sieben** Nächten. Tag 10 bis Tag 16 sind sieben Nächte; Tag 17 hat wieder einen Preis. Ein Off-by-one in der Gaps-and-Islands-Logik würde hier sofort auffallen.

Und dann die Gegenprobe:

```ts
it('meldet für den gedeckten Seed-Bestand keine Lücke', async () => {
    // Der Gegentest zum vorigen: eine Prüffunktion, die immer etwas findet, ist
    // so wertlos wie eine, die nie etwas findet.
    const { data, error } = await serviceClient.rpc('find_rate_gaps', { tage: 365 });
    expect(error).toBeNull();

    const seedHotel = (data as { hotel_id: string }[]).filter((row) => row.hotel_id === '00000000-0000-4000-8000-000000000001');
    expect(seedHotel).toHaveLength(0);
});
```

Dieser Satz aus dem Kommentar ist der Merksatz des ganzen Commits:

> Eine Prüffunktion, die immer etwas findet, ist so wertlos wie eine, die nie etwas findet.

Der Test beweist gleich zwei Dinge auf einmal: dass `find_rate_gaps` keine Falschmeldungen produziert **und** dass der Seed aus Punkt 4 wirklich 365 Tage lückenlos abdeckt – dass die Entscheidung „13 Monate statt 12" also richtig gerechnet war.

Zuletzt die Rechteprüfung, ebenfalls mit Gegenprobe:

```ts
it('ist für den Gast nicht aufrufbar', async () => {
    // Kein is_staff()-Wachposten in der Funktion, sondern das EXECUTE-Recht:
    // ein Wachposten würde in v1 auch den Service-Role-Key abweisen (E13/E35).
    const { error } = await anonClient.rpc('find_rate_gaps', { tage: 30 });
    expect(error).not.toBeNull();
    // Auf den Code festgenagelt, damit der Test nicht aus dem falschen Grund grün
    // wird — etwa weil die Funktion umbenannt wurde und PostgREST 404 liefert.
    expect(error?.code).toBe('42501'); // permission denied for function
});

it('lässt den Gast die Preise selbst aber lesen', async () => {
    // Preise sind öffentlich (sie stehen auf der Kategorieseite) — nur die
    // Auskunft darüber, wo welche fehlen, ist es nicht (E28).
    const { data, error } = await anonClient.from('room_type_rates').select('amount_cents').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
});
```

Der Kommentar im ersten Test benennt eine echte Falle beim Testen von Berechtigungen. Ohne die Festlegung auf `42501` wäre der Test auch grün, wenn die Funktion **umbenannt** wurde – dann käme nämlich `PGRST202` („keine passende Funktion gefunden"), also auch ein Fehler. Der Test hätte dann nie ein Recht geprüft, sondern nur einen Tippfehler.

Der zweite Test ist die Gegenprobe: Die Sperre ist gezielt. Die Preise selbst darf der Gast lesen – sie stehen ja auf der Zimmerseite. Nur die **Auskunft über fehlende** Preise ist Betriebsinterna.

## Was wurde erreicht?

Das Abschlusskriterium der Phase lautete: _„zwei überlappende Preiszeiträume für dieselbe Kategorie und denselben Rate-Plan werden abgelehnt **und** `find_rate_gaps(365)` findet eine absichtlich gerissene Lücke."_ Erfüllt, mit nun **24 grünen Tests**.

Konkret:

- Preise sind pro Kategorie, Tarif und Zeitraum hinterlegt, in ganzzahligen Cent.
- Widersprechende Preise für dieselbe Nacht sind durch den Exclusion-Constraint unmöglich.
- Anschließende Saisons funktionieren lückenlos, weil die Zeiträume halb-offen sind.
- Ein Preis von 0 ist verboten; „nicht buchbar" wird durch das Fehlen einer Zeile ausgedrückt.
- `find_rate_gaps` findet Konfigurationslücken und fasst sie zu Blöcken zusammen.
- 39 Seed-Preiszeilen decken 13 Monate ab – und `find_rate_gaps(365)` meldet nichts.

Die drei übertragbaren Ideen aus dieser Phase:

1. **Ein eindeutiger Teilindex** drückt „höchstens einer davon" aus, wo `UNIQUE` nicht passt.
2. **Gaps and Islands** macht aus 300 Einzelmeldungen drei brauchbare Blöcke.
3. **Zugang über `EXECUTE`-Rechte** statt über einen Wachposten in der Funktion – wichtig, wenn die Rollenprüfung selbst noch ein Platzhalter ist.

Als Nächstes kommen Kunden und Buchungen – und dort trifft man erstmals auf einen `EXCLUDE`-Constraint mit einer **Bedingung** darin.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](006_2026-09-02_phase-4-kunden-buchungen-naechte-historie.md)
