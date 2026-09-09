[← Vorheriger Commit](005_2026-09-02_phase-3-saisonpreise-und-preisluecken.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(db): Phase 4 - Kunden, Buchungen, Naechte und Historie

- **Commit:** `ffe76a9`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Die größte Phase des Branches. Sieben Migrationen legen das Herzstück der Domäne an: Kunden, Buchungen, den eingefrorenen Preis pro Nacht und eine unveränderliche Änderungshistorie.

```text
 .../20260902110000_is_blocking_status.sql          |  31 ++
 supabase/migrations/20260902111000_customers.sql   |  71 +++++
 .../migrations/20260902112000_booking_groups.sql   |  25 ++
 .../20260902113000_booking_reference.sql           |  52 ++++
 supabase/migrations/20260902114000_bookings.sql    |  83 ++++++
 .../migrations/20260902115000_booking_nights.sql   |  38 +++
 .../migrations/20260902116000_booking_events.sql   |  47 +++
 supabase/tests/bookings.spec.ts                    | 315 +++++++++++++++++++++
 supabase/tests/customers.spec.ts                   |  84 ++++++
 supabase/tests/helpers/fixtures.ts                 |  37 ++-
 10 files changed, 781 insertions(+), 2 deletions(-)
```

Bemerkenswert: 400 Zeilen SQL und 400 Zeilen Tests. Das Verhältnis ist kein Zufall – hier entstehen die Regeln, die im Fehlerfall Geld kosten.

## 1. `is_blocking_status` – eine Regel an genau einer Stelle

```sql
-- is_blocking_status(text) — "belegt diese Buchung Kapazitaet?" (E11).
--
-- Genau EINE Stelle. Die Regel lautet: alles ausser `cancelled` blockiert. Ein
-- No-Show blockiert weiter, denn die Nacht WAR verkauft; eine Storno nicht.
--
-- Warum das eine Funktion ist und kein wiederholtes `status <> 'cancelled'`: Diese
-- Bedingung steht sonst im Exclusion-Constraint, im Teilindex, in der
-- Verfuegbarkeitsrechnung und in jeder Admin-Abfrage. Vier Kopien einer Regel
-- driften, und wenn sie driften, widerspricht die Anwendung sich selbst.

create or replace function public.is_blocking_status(status text) returns boolean
language sql
immutable
parallel safe
as $$
select status is distinct from 'cancelled';
$$;
```

Eine Funktion mit einer Zeile Inhalt – und die vielleicht wichtigste Design-Entscheidung dieser Phase.

Die fachliche Frage lautet: Welche Buchungen belegen Kapazität? Die Antwort: alle außer `cancelled`. Insbesondere ein `no_show` blockiert weiter, denn die Nacht **war** verkauft; der Gast ist nur nicht erschienen.

Warum eine Funktion und nicht viermal `status <> 'cancelled'`? Weil diese Bedingung an vier Stellen gebraucht wird: im Exclusion-Constraint, im Teilindex, in der Verfügbarkeitsrechnung (Phase 5) und in `create_booking` (Phase 6). Vier Kopien einer Regel driften – und ab dem Moment, in dem eine davon abweicht, widerspricht die Anwendung sich selbst. Es ist dasselbe Argument wie bei `is_staff()` in Phase 2.

`is distinct from` statt `<>` ist übrigens ein wichtiges Detail: `NULL <> 'cancelled'` ergibt in SQL `NULL` (also nicht wahr), `NULL is distinct from 'cancelled'` ergibt `true`. Bei einer Funktion, die in einem Index-Prädikat steht, will man keine Überraschungen mit `NULL`.

### Der Preis, den die Migration selbst benennt

```sql
-- ACHTUNG, und das ist der Preis dieser Loesung: Weil Indizes und
-- Exclusion-Constraints diese Funktion im Praedikat verwenden, ist sie IMMUTABLE
-- deklariert und Postgres glaubt das. Wer sie spaeter aendert (z. B. "no_show
-- blockiert nicht mehr"), muss die abhaengigen Objekte NEU AUFBAUEN - sonst
-- entscheidet der Index weiter nach der alten Regel, ohne dass etwas auffaellt:
--
--   reindex table public.bookings;
--
-- Kein `set search_path` hier: die Funktion greift auf nichts zu, und ein SET-Zusatz
-- verhindert das Inlining, das sie in Indexpraedikaten billig macht.
```

Hier lohnt genaues Hinsehen, weil es eine echte Falle beschreibt.

`IMMUTABLE` ist ein **Versprechen** an PostgreSQL: „Diese Funktion gibt für gleiche Eingaben immer dasselbe zurück." Nur mit diesem Versprechen darf sie in einem Index-Prädikat stehen – denn der Index speichert das Ergebnis. PostgreSQL prüft das Versprechen nicht; es glaubt es.

Ändert man die Funktion später (etwa: `no_show` blockiert nicht mehr), enthält der Index weiterhin die alten Entscheidungen. Abfragen, die den Index nutzen, liefern dann Ergebnisse nach der **alten** Regel – ohne Fehlermeldung. Ein außerordentlich unangenehmer Fehler.

Die Migration stellt nicht nur das Problem, sondern auch die Lösung bereit: `reindex table public.bookings`. Solche „Falls du das mal änderst, dann …"-Notizen direkt am Ort des Problems sind Gold wert, weil sie garantiert gefunden werden.

Der zweite Absatz erklärt eine bewusste Abweichung von der Konvention: Alle anderen Funktionen haben `set search_path = ''`. Diese nicht, weil ein `SET`-Zusatz PostgreSQL am **Inlining** hindert. Und ohne Inlining wird aus einer Vergleichsoperation ein Funktionsaufruf pro Zeile. Bei `is_staff()` (einmal pro Abfrage) ist das gleichgültig, in einem Index-Prädikat nicht. Da die Funktion auf keine Tabelle zugreift, entfällt das Sicherheitsargument hier.

## 2. `customers` – und eine Funktion gegen Rekursion

```sql
create table public.customers (
    id uuid primary key default gen_random_uuid(),
    -- ON DELETE SET NULL ist hier - und NUR hier - richtig, obwohl E22 SET NULL
    -- verwirft: Wird das Supabase-Konto geloescht, bleibt der Kunde samt Buchungen
    -- bestehen. Genau das ist der Sinn der Trennung von auth.users.
    user_id uuid unique references auth.users (id) on delete set null,
    -- Originalschreibweise. Sie steht in der Bestaetigungsmail, also wird sie nicht
    -- ueberschrieben (E32).
    email text not null,
    -- Die Case-Insensitivitaet ist eine SPALTE, keine Konvention (E32): gesucht wird
    -- immer hierueber, die Eindeutigkeit haengt an einem gewoehnlichen UNIQUE. Ein
    -- funktionaler Index auf lower(email) haette dieselbe Eindeutigkeit garantiert,
    -- aber `where email = 'Max@Muster.de'` haette die Zeile trotzdem nicht gefunden.
    email_normalized text generated always as (lower(email)) stored not null unique,
    first_name text not null,
    last_name text not null,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

Die Umsetzung von `E32` aus Commit 002. Zwei Spalten für eine Adresse: `email` behält die Schreibweise des Gastes (sie steht in der Bestätigungsmail), `email_normalized` ist die kleingeschriebene Version und trägt das `UNIQUE`.

`user_id` ist **nullable** – ein Gast kann ohne Konto buchen. Und `on delete set null` ist hier die einzige zugelassene Ausnahme von `E22`: Löscht Supabase das Auth-Konto, bleibt der Kunde samt seinen Buchungen bestehen. Der Vertrag überlebt das Konto. Genau das ist der Sinn der Trennung zwischen `auth.users` (gehört Supabase) und `customers` (gehört der Domäne).

### `current_customer_id()` – und warum `SECURITY DEFINER` hier nichts mit Rechten zu tun hat

```sql
-- SECURITY DEFINER, und das hat hier NICHTS mit Privilegien zu tun, sondern mit
-- Rekursion: Die Policy auf `customers` benutzt diese Funktion, und die Funktion
-- liest aus `customers`. Mit Invoker-Rechten wuerde die Policy sich selbst aufrufen
-- und Postgres bricht mit "infinite recursion detected in policy" ab.
--
-- Der Alternativweg waere `user_id = auth.uid()` direkt in der Policy - genau das
-- verstreute auth.uid(), das E13 verbietet, damit Identitaet an einer Stelle liegt.
create or replace function public.current_customer_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
select c.id from public.customers c where c.user_id = auth.uid();
$$;
```

Ein Problem, auf das man beim ersten RLS-Projekt garantiert stößt. Der Ablauf ohne `SECURITY DEFINER`:

1. Jemand fragt `select * from customers`.
2. RLS prüft die Policy: `id = current_customer_id()`.
3. `current_customer_id()` macht `select … from customers`.
4. RLS prüft die Policy für diese Abfrage: `id = current_customer_id()`.
5. … und so weiter.

PostgreSQL erkennt das und bricht ab: `infinite recursion detected in policy for relation "customers"`.

Mit `SECURITY DEFINER` läuft die Funktion mit den Rechten ihres Eigentümers und **umgeht damit RLS** – die Rekursion ist gebrochen. Der Zusatz dient hier also nicht dazu, mehr zu dürfen, sondern dazu, eine Schleife zu vermeiden.

Der zweite Absatz des Kommentars nennt die verworfene Alternative: `using (user_id = auth.uid())` direkt in der Policy hätte auch funktioniert und keine Rekursion erzeugt. Aber dann stünde `auth.uid()` verstreut in Policies – genau das, was `E13` verhindern will, damit Identität an einer Stelle liegt.

### Ein Performance-Detail in den Policies

```sql
-- Der eigene Datensatz oder Mitarbeitende. Das `(select ...)` ist kein Zierrat:
-- so wertet Postgres die Funktion EINMAL pro Abfrage aus und nicht pro Zeile.
create policy customers_select_own on public.customers
for select using (id = (select public.current_customer_id()) or public.is_staff());
```

Die Klammern um `(select public.current_customer_id())` sehen nach überflüssiger Verschachtelung aus, machen aber einen messbaren Unterschied. Als Unterabfrage geschrieben, erkennt PostgreSQL den Ausdruck als **konstant für die gesamte Abfrage** und wertet ihn einmal aus. Ohne die Klammern würde die Funktion potenziell pro geprüfter Zeile aufgerufen. Bei tausend Zeilen ist das der Unterschied zwischen einem und tausend Aufrufen.

Das ist ein bekanntes Muster in Supabase-Projekten und einer der häufigsten Gründe für unerwartet langsame Abfragen mit RLS.

Und schließlich:

```sql
-- Kein INSERT und kein DELETE: Kunden entstehen ausschliesslich in create_booking
-- (Phase 6), damit dieselbe E-Mail nie zwei Datensaetze erzeugt (E26). Geloescht
-- wird nichts (E22).
```

Eine Policy, die **nicht** existiert, ist auch eine Aussage. Weil RLS „deny by default" arbeitet, ist das Fehlen einer `INSERT`-Policy eine wirksame Sperre.

## 3. `booking_groups` – eine bewusst leere Tabelle

```sql
create table public.booking_groups (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now()
);
```

Zwei Spalten, davon eine der Primärschlüssel. Der Kommentar erklärt, warum das so bleiben muss:

```sql
-- Bewusst leer. Sie fasst mehrere Buchungen eines Vorgangs zusammen (Familie bucht
-- zwei Zimmer), traegt aber weder Kunde noch Buchungsnummer noch Gesamtsumme.
--
-- Das ist der Punkt, an dem man aufpassen muss: Sobald diese Tabelle Kunde,
-- Buchungsnummer und Summe traegt, IST sie der Vorgang - und dann ist E20 gefallen
-- und wir haben `bookings` + `booking_items` mit anderen Namen. Zwei
-- Reservierungsnummern fuer zwei Zimmer sind branchenueblich und tragen bis dahin.
--
-- Tabelle statt nackter uuid-Spalte, weil eine Gruppen-ID ohne Fremdschluessel
-- verwaisen kann, ohne dass es auffaellt.
```

Das ist eine ungewöhnlich klare Warnung an das zukünftige Ich. Die Versuchung ist offensichtlich: Wenn man erst einmal eine Gruppentabelle hat, wandern nach und nach Kunde, Gesamtsumme und eine Vorgangsnummer hinein. Und dann hat man – unter anderen Namen – die Struktur `bookings` (Kopf) + `booking_items` (Positionen) gebaut, die `E20` ausdrücklich verworfen hatte.

Der letzte Absatz begründet, warum es überhaupt eine Tabelle ist und nicht nur eine `uuid`-Spalte auf `bookings`: Ohne Fremdschlüssel könnte eine Gruppen-ID auf nichts zeigen, und niemand würde es merken.

## 4. `generate_booking_reference` – eine Nummer für das Telefon

```sql
-- 8 Zeichen aus einem Alphabet OHNE `I`, `O`, `0` und `1`. Der Grund ist nicht
-- Aesthetik: Diese Nummer wird am Telefon buchstabiert und von Hand abgetippt.
-- "I oder 1?" und "O oder 0?" sind die beiden Verwechslungen, die dabei garantiert
-- passieren - also gibt es sie nicht.
--
-- 32 Zeichen an 8 Stellen sind 1,1 Billionen Kombinationen. Die Nummer ist keine
-- fortlaufende Zahl, damit sie nicht verraet, wie viele Buchungen es gibt.

create or replace function public.generate_booking_reference() returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
    alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    candidate text;
    attempts int := 0;
begin
    loop
        candidate := '';
        for i in 1..8 loop
            candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
        end loop;

        exit when not exists (select 1 from public.bookings b where b.booking_reference = candidate);

        -- Kollisionsbehandlung. Bei 1,1 Billionen Moeglichkeiten ist das toter Code,
        -- solange die Tabelle nicht Millionen Zeilen hat - aber "statistisch
        -- unmoeglich" ist kein Fehlerbehandlungskonzept. Die Schleife bricht ab,
        -- statt endlos zu laufen.
        attempts := attempts + 1;
        if attempts >= 20 then
            raise exception 'Konnte nach % Versuchen keine freie Buchungsnummer erzeugen', attempts
                using errcode = '55000';
        end if;
    end loop;

    return candidate;
end;
$$;
```

Zwei Design-Entscheidungen mit Praxisbezug:

**Das reduzierte Alphabet.** Aus 36 möglichen Zeichen (10 Ziffern + 26 Buchstaben) werden 32 – `I`, `O`, `0` und `1` fehlen. Der Grund ist nicht Ästhetik, sondern das Telefon: „War das ein O oder eine Null?" ist die garantierte Rückfrage. Ein Zeichen, das es nicht gibt, kann nicht verwechselt werden. Das ist derselbe Gedanke wie bei `VITE_` in Phase 1: **Fehler unmöglich machen statt sie zu verbieten.**

**Der Abbruch nach 20 Versuchen.** Bei 32⁸ ≈ 1,1 Billionen Kombinationen ist eine Kollision praktisch unmöglich. Trotzdem gibt es eine Obergrenze, und der Kommentar begründet sie in einem Satz, der über diesen Fall hinausgeht:

> „statistisch unmöglich" ist kein Fehlerbehandlungskonzept

Eine `loop` ohne Abbruchbedingung ist eine Endlosschleife, die auf Wahrscheinlichkeitsrechnung vertraut. Wenn irgendwann doch etwas nicht stimmt – etwa `random()` liefert konstante Werte, weil ein Seed gesetzt wurde – hängt die Datenbanksitzung für immer. Ein Fehler nach 20 Versuchen ist unangenehm, aber diagnostizierbar.

Und die Klarstellung am Ende, was hier eigentlich schützt:

```sql
-- Das UNIQUE auf bookings.booking_reference ist der eigentliche Schutz; diese
-- Funktion vermeidet nur, dass er zuschlaegt. Beim Buchen laeuft ausserdem der
-- hotelweite Advisory-Lock (E33), der gleichzeitige Einfuegungen ohnehin
-- serialisiert - eine Race Condition zwischen Pruefung und INSERT gibt es dort nicht.
```

Die Funktion prüft „ist die Nummer frei?" und fügt danach ein. Zwischen beidem liegt theoretisch Zeit für eine Kollision – aber der eigentliche Schutz ist das `UNIQUE` auf der Spalte, das atomar wirkt.

## 5. `bookings` – der Vertrag

Die zentrale Tabelle des Schemas:

```sql
create table public.bookings (
    id uuid primary key default gen_random_uuid(),
    booking_reference text not null unique default public.generate_booking_reference(),
    customer_id uuid not null references public.customers on delete restrict,
    room_type_id uuid not null references public.room_types on delete restrict,
    -- Zuweisung beim Check-in (E3). NULL heisst: Kategorie verkauft, Zimmer offen.
    room_id uuid references public.rooms on delete restrict,
    rate_plan_id uuid not null references public.rate_plans on delete restrict,
    -- Nullable (E27): die meisten Buchungen stehen allein.
    booking_group_id uuid references public.booking_groups on delete restrict,
    check_in date not null,
    -- Halb-offen: der Abreisetag ist KEINE gebuchte Nacht (E8, E29).
    check_out date not null,
    stay daterange generated always as (daterange(check_in, check_out, '[)')) stored,
    adults int not null check (adults >= 1),
    children int not null default 0 check (children >= 0),
    -- text + CHECK statt ENUM (E11): Enum-Werte lassen sich nachtraeglich nur
    -- hinzufuegen, nicht sauber entfernen oder umbenennen. Kein `pending` - das waere
    -- ein Zustand, aus dem nichts herausfuehrt, solange es keine Zahlung gibt.
    status text not null default 'confirmed',
    total_amount_cents int not null check (total_amount_cents >= 0),
    currency text not null default 'EUR' check (char_length(currency) = 3),
    -- Denormalisiert, damit "wann wurde storniert" ohne Blick in die Historie
    -- beantwortbar ist (E22).
    cancelled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    ...
```

`room_id` ist **nullable** – das ist `E3` in Spaltenform. Gebucht wird die Kategorie; welches Zimmer der Gast bekommt, entscheidet die Rezeption beim Check-in. `NULL` bedeutet also nicht „fehlt", sondern „noch nicht zugewiesen".

### `text` + `CHECK` statt `ENUM`

```sql
    constraint bookings_status_valid check (status in ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
```

Eine Abwägung, die man häufig zu treffen hat. PostgreSQL kennt echte `ENUM`-Typen, und die wären hier naheliegend. Die Begründung dagegen:

> Enum-Werte lassen sich nachträglich nur hinzufügen, nicht sauber entfernen oder umbenennen.

`alter type … add value` gibt es; `drop value` gibt es nicht. Einen Enum-Wert loszuwerden bedeutet: neuen Typ anlegen, Spalte umstellen, alten Typ löschen – und das mit Sperren auf der Tabelle. Ein `CHECK`-Constraint dagegen lässt sich mit einer Migration ändern.

Bemerkenswert ist auch, was **fehlt**: kein `pending`. Die Begründung: _„das wäre ein Zustand, aus dem nichts herausführt, solange es keine Zahlung gibt."_ Ein Status, für den es keinen Übergang gibt, ist ein Datenmüllplatz. Statuswerte einzuführen, weil sie „später sicher gebraucht werden", ist eine verbreitete Falle.

### Der Widerspruchs-`CHECK`

```sql
    -- Verhindert den klassischen Zwei-Felder-Widerspruch: "storniert, aber kein
    -- Stornozeitpunkt" - und ebenso "nicht storniert, aber Stornozeitpunkt gesetzt".
    -- Als Gleichheit zweier Wahrheitswerte geschrieben, damit BEIDE Richtungen
    -- abgedeckt sind; zwei getrennte CHECKs waeren leichter zu uebersehen.
    constraint bookings_cancelled_consistent check ((status = 'cancelled') = (cancelled_at is not null)),
```

Eine sehr elegante Konstruktion. `(A) = (B)` mit zwei Wahrheitswerten bedeutet: entweder beide wahr oder beide falsch. Ausgeschrieben:

| `status = 'cancelled'` | `cancelled_at is not null` | erlaubt? |
| ---------------------- | -------------------------- | -------- |
| ja                     | ja                         | ✓        |
| ja                     | nein                       | ✗        |
| nein                   | ja                         | ✗        |
| nein                   | nein                       | ✓        |

Der naive Ansatz wäre gewesen:

```sql
-- Deckt nur EINE Richtung ab:
check (status <> 'cancelled' or cancelled_at is not null)
```

Das verhindert „storniert ohne Zeitpunkt", erlaubt aber „bestätigt mit Stornozeitpunkt" – ein Widerspruch, der stillschweigend in der Datenbank landet. Als Gleichung geschrieben, sind beide Richtungen automatisch abgedeckt, und man kann keine vergessen.

Und die Tests prüfen genau beide:

```ts
it('LEHNT status = cancelled OHNE cancelled_at AB', async () => {
    const { error } = await booking({ status: 'cancelled' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
});

it('LEHNT cancelled_at bei status = confirmed AB — die andere Richtung', async () => {
    // Der CHECK ist als Gleichheit zweier Wahrheitswerte geschrieben, damit BEIDE
    // Richtungen abgedeckt sind. Ohne diesen Test faellt die zweite lautlos aus.
    const { error } = await booking({ status: 'confirmed', cancelled_at: new Date('2030-01-01').toISOString() });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
});
```

### Der Exclusion-Constraint mit Bedingung

```sql
    -- Ein Geschenk, kein Ersatz fuer E10: Fuer die Kategorie-Zaehlung hilft dieses
    -- Constraint nicht (es kennt nur zugewiesene Zimmer), aber ab dem Moment der
    -- Zimmerzuweisung ist Doppelbelegung physisch unmoeglich.
    --
    -- Das Praedikat benutzt is_blocking_status() und nicht `status <> 'cancelled'`,
    -- damit die Regel aus E11 an genau einer Stelle steht. Preis: eine Aenderung
    -- dieser Funktion verlangt `reindex table public.bookings`.
    constraint bookings_no_double_room exclude using gist (room_id with =, stay with &&)
        where (room_id is not null and public.is_blocking_status(status))
);
```

Jetzt hat der Exclusion-Constraint ein `where` – er gilt nur für einen **Teil** der Zeilen. Zu lesen als: _„Es dürfen keine zwei Zeilen existieren mit gleichem `room_id` und überlappendem `stay` – aber nur unter den Zeilen, bei denen ein Zimmer zugewiesen ist und der Status blockiert."_

Beide Bedingungen sind nötig:

- **`room_id is not null`**: Viele Buchungen haben noch kein Zimmer. Ohne die Bedingung würden sie im Constraint alle als „gleiches Zimmer = NULL" behandelt.
- **`is_blocking_status(status)`**: Eine stornierte Buchung darf im Zeitraum einer neuen liegen. Sonst würde jede Absage das Zimmer für immer blockieren.

Und der Kommentar ist ehrlich darüber, was dieses Constraint **nicht** leistet: Es schützt nicht vor Überbuchung der Kategorie. Denn es kennt nur zugewiesene Zimmer, und die Kategorie-Zählung ist ein anderes Problem (`E10`, Phase 6). Es ist ein Extra, kein Ersatz.

Die Tests belegen alle Fälle einzeln:

```ts
it('AKZEPTIERT Abreise = Anreise der naechsten Buchung im SELBEN Zimmer (Test 3, E8/E29)', async () => {
    const { error } = await booking({ room_id: roomA, check_in: '2029-04-12', check_out: '2029-04-14' });
    expect(error).toBeNull();
});

it('LEHNT eine echte Ueberlappung im selben Zimmer AB', async () => {
    const { error } = await booking({ room_id: roomA, check_in: '2029-04-11', check_out: '2029-04-13' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23P01'); // exclusion_violation
});

it('erlaubt zwei ueberlappende Buchungen OHNE zugewiesenes Zimmer', async () => {
    // Das Constraint kennt nur zugewiesene Zimmer. Dass die Kategorie nicht
    // ueberbucht wird, ist NICHT seine Aufgabe, sondern die des Advisory-Locks in
    // create_booking (E10/E33) — hier wird das bewusst nicht abgefangen.
    const first = await booking({ check_in: '2029-07-01', check_out: '2029-07-05' });
    const second = await booking({ check_in: '2029-07-02', check_out: '2029-07-06' });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
});

it('erlaubt eine STORNIERTE Buchung ueberlappend im selben Zimmer (E11)', async () => {
    const { error } = await booking({ room_id: roomA, check_in: '2029-04-11', check_out: '2029-04-13', status: 'cancelled', cancelled_at: new Date('2029-01-01').toISOString() });
    // Eine Storno belegt keine Kapazitaet — sonst blockierte jede abgesagte
    // Buchung das Zimmer fuer immer.
    expect(error).toBeNull();
});

it('LEHNT eine no_show-Buchung ueberlappend im selben Zimmer AB (E11)', async () => {
    // Gegenprobe zur Storno: Ein No-Show blockiert weiter, denn die Nacht WAR
    // verkauft. Ohne diesen Test koennte is_blocking_status alles ausser
    // 'confirmed' durchlassen und der vorige Test waere trotzdem gruen.
    const { error } = await booking({ room_id: roomA, check_in: '2029-04-10', check_out: '2029-04-11', status: 'no_show' });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23P01');
});
```

Die letzten zwei Tests sind zusammen ein Musterbeispiel. Der Storno-Test allein wäre auch grün, wenn `is_blocking_status` fälschlich nur `'confirmed'` als blockierend zählte. Der `no_show`-Test schließt diese Lücke. **Beide Richtungen einer booleschen Regel müssen geprüft werden**, sonst kann man sie mit einer falschen Implementierung verwechseln.

Der erste dieser Tests ist übrigens **Test 3 aus `E34`** – laut Umsetzungsplan der wichtigste des ganzen Satzes. Der Kommentar im Kopf der Testdatei erklärt, warum:

```ts
/**
 * Test 3 ist der halb-offene Anschlusstag: Reist Gast A am 12. ab und Gast B am 12.
 * an, ist das EINE freie Nacht, keine Kollision. Wer hier ein geschlossenes Intervall
 * verwendet, verkauft nie eine Anschlussnacht — der teuerste Off-by-one-Fehler in
 * Buchungssystemen, und einer, der niemals eine Fehlermeldung erzeugt.
 */
```

### Die Indizes

```sql
-- Ueberlappungssuche der Verfuegbarkeit. Der Teilindex ersetzt den dort zusaetzlich
-- genannten vollstaendigen GiST-Index auf (room_type_id, stay): Die
-- Verfuegbarkeitsrechnung fragt ausschliesslich nach blockierenden Buchungen, ein
-- zweiter Index ueber alle Zeilen waere toter Schreibaufwand bei jedem INSERT.
create index bookings_blocking_stay_idx on public.bookings using gist (room_type_id, stay)
    where public.is_blocking_status(status);

create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_check_in_idx on public.bookings (check_in);
create index bookings_status_idx on public.bookings (status);
create index bookings_group_id_idx on public.bookings (booking_group_id) where booking_group_id is not null;
-- booking_reference braucht keinen eigenen Index: das UNIQUE legt ihn an.
```

Zwei Beobachtungen zum Thema Indizes, die oft übersehen werden:

**Indizes kosten beim Schreiben.** Jeder Index muss bei jedem `INSERT` und `UPDATE` mitgepflegt werden. Ein Index, den keine Abfrage nutzt, ist kein neutraler Zusatz, sondern reine Kosten. Deshalb weicht die Migration hier bewusst vom Plan ab: Die Verfügbarkeitsrechnung fragt immer nur nach blockierenden Buchungen, also reicht ein Teilindex.

**`UNIQUE` legt selbst einen Index an.** Die letzte Kommentarzeile verhindert einen häufigen Fehler: einen zusätzlichen Index auf eine Spalte zu legen, die bereits `unique` ist. Der wäre exakt redundant.

## 6. `booking_nights` – der eingefrorene Preis

```sql
-- booking_nights — eingefrorener Preis PRO NACHT (E21).
--
-- Nicht nur eine Gesamtsumme auf der Buchung: Ohne die Aufschluesselung pro Nacht
-- sind "Umsatz im Maerz", "Verlaengerung um zwei Naechte" und "Teilstorno" nicht
-- beantwortbar, ohne die Saisonpreise rueckwirkend nachzurechnen - und die haben
-- sich bis dahin geaendert.
--
-- Jede Nacht des halb-offenen Intervalls bekommt genau eine Zeile. Der Abreisetag
-- NICHT: an ihm wird nicht geschlafen (E29).

create table public.booking_nights (
    -- CASCADE: Die Naechte sind Teil der Buchung, kein eigenstaendiges Objekt.
    -- Loeschbar ist die Buchung selbst ohnehin praktisch nie (E22).
    booking_id uuid not null references public.bookings on delete cascade,
    night date not null,
    amount_cents int not null check (amount_cents >= 0),
    created_at timestamptz not null default now(),
    primary key (booking_id, night)
);
```

Diese Tabelle ist die technische Umsetzung von Leitsatz 3: **Eine Buchung ist ein Vertrag.**

Wenn der Preis nur als Gesamtsumme auf `bookings` stünde, wäre die Rechnung nicht mehr aufschlüsselbar. Und das ist keine akademische Sorge – der Kommentar nennt drei konkrete Fälle:

| Frage                          | mit `booking_nights`          | nur mit Gesamtsumme                          |
| ------------------------------ | ----------------------------- | -------------------------------------------- |
| „Umsatz im März?"              | Summe über die Nächte im März | nicht beantwortbar                           |
| „Verlängerung um 2 Nächte"     | 2 Zeilen ergänzen             | Gesamtsumme neu rechnen – mit welchem Preis? |
| „Teilstorno der letzten Nacht" | eine Zeile entfernen          | Differenz raten                              |

Der Primärschlüssel ist **zusammengesetzt**: `primary key (booking_id, night)`. Damit kann jede Nacht innerhalb einer Buchung nur einmal vorkommen – eine Doppelbuchung derselben Nacht ist unmöglich.

Der Zugriffsschutz:

```sql
-- Sichtbar ueber die zugehoerige Buchung. Die Unterabfrage laeuft mit den Rechten
-- des Aufrufers, also greift auf `bookings` deren eigene Policy zusaetzlich - die
-- Bedingung ist hier trotzdem ausgeschrieben, damit die Regel lesbar an der Tabelle
-- steht und nicht aus einer anderen abgeleitet werden muss.
create policy booking_nights_select_own on public.booking_nights
for select using (
    exists (
        select 1
        from public.bookings b
        where b.id = booking_nights.booking_id
          and (b.customer_id = (select public.current_customer_id()) or public.is_staff())
    )
);

-- Kein Schreibrecht: Naechte entstehen in create_booking (Phase 6). Ein eingefrorener
-- Preis, den der Client setzen darf, ist nicht eingefroren.
```

Der letzte Satz ist der Punkt: Ein „eingefrorener" Preis, den der Client selbst schreiben kann, ist keine Zusicherung. Deshalb gibt es keine `INSERT`-Policy.

## 7. `booking_events` – append-only, und zwar wirklich

```sql
-- booking_events — append-only Historie (E12).
--
-- Ab Tag 1, nicht nachtraeglich: Eine Historie, die erst eingebaut wird, wenn man sie
-- braucht, beginnt genau in dem Moment, in dem die interessanten Aenderungen schon
-- passiert sind.

create table public.booking_events (
    id uuid primary key default gen_random_uuid(),
    -- RESTRICT, nicht CASCADE: Die Historie darf eine Buchung ueberleben. Ihr
    -- Verschwinden waere das Gegenteil ihres Zwecks.
    booking_id uuid not null references public.bookings on delete restrict,
    event_type text not null,
    payload jsonb not null default '{}',
    actor_kind text not null check (actor_kind in ('customer', 'staff', 'system')),
    actor_user_id uuid references auth.users,
    created_at timestamptz not null default now()
);
```

Der Satz im Kopf ist eine gute Faustregel: Eine Historie, die man nachträglich einbaut, beginnt genau dann, wenn die interessanten Änderungen schon vorbei sind. Deshalb ab Tag 1.

Bemerkenswert ist der Unterschied zu `booking_nights`: Dort `cascade` (Nächte gehören zur Buchung), hier `restrict` (die Historie darf die Buchung überleben). Der Verweis auf `on delete` ist keine Formalität, sondern eine fachliche Aussage über die Beziehung.

`actor_kind` unterscheidet drei Urheber: `customer`, `staff`, `system`. Wichtig für die Nachvollziehbarkeit – „wer hat diese Buchung storniert?" ist eine andere Frage als „was wurde geändert?".

Und dann die eigentliche Pointe:

```sql
-- Append-only wird DURCHGESETZT, nicht vereinbart (E12).
--
-- Zwei Ebenen, weil eine nicht reicht:
-- 1. Keine INSERT/UPDATE/DELETE-Policy - damit ist fuer anon und authenticated
--    bereits alles zu (RLS ist deny by default).
-- 2. Die Rechte werden zusaetzlich ENTZOGEN, und zwar auch dem service_role. Denn
--    der Service-Role-Key umgeht RLS vollstaendig - ohne diesen Schritt koennte das
--    Seed-Skript die Historie umschreiben, und eine Historie, die man aendern kann,
--    ist keine.
--
-- Schreiben duerfen ausschliesslich SECURITY DEFINER-Funktionen (Phase 6), die als
-- Eigentuemer laufen. INSERT bleibt fuer service_role erlaubt, damit Seeds und
-- Administratives ueberhaupt Ereignisse anlegen koennen - nur Aendern und Loeschen
-- ist niemandem erlaubt.
revoke update, delete on public.booking_events from anon, authenticated, service_role;
```

Hier ist ein wichtiger Unterschied zu verstehen, der bei Supabase oft unterschätzt wird:

| Mechanismus      | wirkt auf                  | greift `service_role`? |
| ---------------- | -------------------------- | ---------------------- |
| RLS-Policies     | einzelne **Zeilen**        | **nein** – umgeht RLS  |
| `GRANT`/`REVOKE` | die **Tabelle** als Ganzes | **ja**                 |

RLS ist ein Zeilenfilter und wird vom `service_role`-Key ausgeschaltet. `REVOKE` ist ein Tabellenrecht und gilt für jede Rolle, die es nicht explizit hat. Für eine wirklich unveränderliche Historie braucht man daher die zweite Ebene – sonst könnte ein Seed-Skript oder ein Wartungsjob die Historie umschreiben.

Der Test dazu ist raffiniert gebaut:

```ts
it('LEHNT UPDATE und DELETE ab — selbst fuer den Service-Role-Key', async () => {
    // Der entscheidende Punkt: Der Service-Role-Key umgeht RLS. Waeren nur die
    // Policies weggelassen, koennte das Seed-Skript die Historie umschreiben.
    // Deshalb sind UPDATE und DELETE zusaetzlich als RECHT entzogen.
    //
    // Der Test braucht keine Zeile: Postgres prueft das Tabellenrecht, bevor es
    // ueberhaupt nach passenden Zeilen sucht. Das ist hier ein Vorteil — sonst
    // muesste der Test ein Ereignis anlegen, das er anschliessend nicht mehr
    // wegraeumen koennte (genau die Eigenschaft, um die es geht).
    const irgendeineBuchung = '00000000-0000-4000-8000-0000000009ff';

    const update = await serviceClient.from('booking_events').update({ event_type: 'manipuliert' }).eq('booking_id', irgendeineBuchung);
    expect(update.error).not.toBeNull();
    expect(update.error?.code).toBe('42501');

    const remove = await serviceClient.from('booking_events').delete().eq('booking_id', irgendeineBuchung);
    expect(remove.error).not.toBeNull();
    expect(remove.error?.code).toBe('42501');
});
```

Die UUID zeigt auf nichts – und das ist Absicht. PostgreSQL prüft das Tabellenrecht, **bevor** es Zeilen sucht. Der Test kann also ohne Testdaten arbeiten. Der Kommentar erklärt, warum das hier besonders praktisch ist: Ein Test, der ein echtes Ereignis anlegt, könnte es hinterher nicht wegräumen – genau weil `DELETE` niemandem erlaubt ist.

Ein besonders schönes Detail steht am Ende des Gegentests:

```ts
// KEIN cleanup: Diese Zeilen ueberleben absichtlich bis zum naechsten
// `pnpm db:reset`. Eine Historie, die der Test wegraeumen kann, waere keine
// (E12) — und die Buchung dahinter haelt ON DELETE RESTRICT fest (E22).
// Beides ist hier nicht Unsauberkeit, sondern das Ergebnis.
```

Ein Test, der bewusst Daten hinterlässt. Normalerweise ein Verstoß gegen jede Testhygiene – hier ist es der Beweis der geprüften Eigenschaft. Wenn der Test aufräumen könnte, wäre die Historie nicht unveränderlich.

## 8. Die Kunden-Tests

`customers.spec.ts` prüft die Umsetzung von `E32`, und der Kommentar erklärt zuerst, worum es fachlich geht:

```ts
/**
 * E26 / E32 — Kundenidentität über die E-Mail-Adresse.
 *
 * Ohne Case-Insensitivität legen `Anna@…` und `anna@…` zwei Kunden an, und die ganze
 * Mechanik aus E26 ist wirkungslos: Das später angelegte Konto findet nur die Hälfte
 * der eigenen Buchungen, und die andere Hälfte gehört einem Kunden, den es
 * eigentlich nicht gibt. Nachträgliches Zusammenführen von Kundendatensätzen über
 * Verträge hinweg gehört zu den unangenehmsten Migrationen überhaupt.
 */
```

Fünf Tests deckern die Spalte vollständig ab:

```ts
it('erzeugt email_normalized in Kleinschreibung', async () => {
    const { data, error } = await customer(`Anna.Beispiel.${stamp}@Muster.TEST`);
    expect(error).toBeNull();
    expect(data?.email_normalized).toBe(`anna.beispiel.${stamp}@muster.test`);
});

it('behält die Originalschreibweise in email', async () => {
    // Sie steht in der Bestätigungsmail. Ein normalisierender Trigger hätte sie
    // unwiederbringlich zerstört — deshalb eine zweite, generierte Spalte (E32).
    const { data } = await serviceClient.from('customers').select('email').eq('email_normalized', `anna.beispiel.${stamp}@muster.test`).single();
    expect(data?.email).toBe(`Anna.Beispiel.${stamp}@Muster.TEST`);
});

it('LEHNT dieselbe Adresse in anderer Schreibweise AB', async () => {
    const { error } = await customer(`ANNA.BEISPIEL.${stamp}@muster.test`);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505'); // unique_violation
});

it('email_normalized ist nicht von Hand setzbar — die Spalte ist generiert', async () => {
    const { error } = await serviceClient.from('customers').insert({
        email: `direkt.${stamp}@muster.test`,
        email_normalized: 'etwas.anderes@muster.test',
        first_name: 'Anna',
        last_name: 'Beispiel',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('428C9'); // generated_always
});
```

Der letzte Test ist der interessanteste: Er beweist, dass die generierte Spalte nicht **unterlaufen** werden kann. Wäre sie von Hand setzbar, könnte jemand `email = 'Anna@X'` mit `email_normalized = 'völlig-anderes@y'` schreiben – und die Eindeutigkeitsgarantie wäre wertlos. Der Fehlercode `428C9` heißt genau das: „Spalte kann nicht direkt geschrieben werden, sie ist `GENERATED ALWAYS`."

Der `stamp` (ein Zufallssuffix) in jeder Adresse ist ein praktisches Detail: Ohne ihn würde ein zweiter Testlauf ohne `db:reset` an einer `unique_violation` scheitern – aus dem falschen Grund.

## Was wurde erreicht?

Das Abschlusskriterium der Phase war das umfangreichste im ganzen Plan, und alle Punkte sind erfüllt. **50 grüne Tests**, und laut Commit-Message _„auch beim zweiten Lauf ohne Reset"_ – ein Kriterium, das mehr aussagt, als es klingt: Tests, die nur direkt nach einem Reset grün sind, hinterlassen Zustand und lassen sich im Alltag nicht wiederholen.

Konkret existieren nun:

- `customers` mit case-insensitiver Identität als generierte Spalte, und `current_customer_id()` als einzige Stelle, an der `auth.uid()` zu einem Kunden wird.
- `bookings` als Vertrag: halb-offener Zeitraum, Statuswerte mit `CHECK`, Widerspruchsschutz als Wahrheitswert-Gleichung, Doppelbelegungsschutz mit Bedingung.
- `booking_nights` mit dem eingefrorenen Preis pro Nacht – kein Schreibrecht für irgendwen.
- `booking_events` als wirklich unveränderliche Historie, durchgesetzt auf zwei Ebenen.
- `booking_reference` mit einem Alphabet, das Telefon-Verwechslungen ausschließt.
- `is_blocking_status()` als einzige Stelle für „belegt Kapazität?", samt Notiz zum `REINDEX`.

Die drei übertragbaren Ideen aus dieser Phase:

1. **`(A) = (B)` bei zwei Wahrheitswerten** deckt beide Richtungen eines Widerspruchs ab – zwei getrennte `CHECK`s würde man einzeln vergessen.
2. **`SECURITY DEFINER` löst nicht nur Rechteprobleme**, sondern auch RLS-Rekursion.
3. **RLS und `GRANT` sind zwei unabhängige Ebenen.** Wer den `service_role`-Key mit einkalkulieren muss, braucht beide.

Auffällig ist, was noch **nicht** geht: Eine Buchung anlegen kann bislang nur der `service_role`-Key. Für Gäste gibt es keine `INSERT`-Policy auf `bookings` – bewusst, denn das Buchen bekommt in Phase 6 seinen eigenen, kontrollierten Weg. Zuvor muss aber geklärt werden, wie man überhaupt feststellt, ob noch ein Zimmer frei ist.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](007_2026-09-02_phase-5-verfuegbarkeit.md)
