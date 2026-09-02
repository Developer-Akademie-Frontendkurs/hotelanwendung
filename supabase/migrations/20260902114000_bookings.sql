-- bookings — der Vertrag.
--
-- Gebucht wird die Kategorie (E3), nicht das Zimmer: `room_id` ist nullable und wird
-- erst beim Check-in gesetzt. Preis und Zeitraum sind eingefroren (E5) - was der
-- Aufenthalt kostet, wird nicht neu berechnet, wenn sich die Saisonpreise aendern.

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

    constraint bookings_status_valid check (status in ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
    constraint bookings_dates_ordered check (check_out > check_in),

    -- Verhindert den klassischen Zwei-Felder-Widerspruch: "storniert, aber kein
    -- Stornozeitpunkt" - und ebenso "nicht storniert, aber Stornozeitpunkt gesetzt".
    -- Als Gleichheit zweier Wahrheitswerte geschrieben, damit BEIDE Richtungen
    -- abgedeckt sind; zwei getrennte CHECKs waeren leichter zu uebersehen.
    constraint bookings_cancelled_consistent check ((status = 'cancelled') = (cancelled_at is not null)),

    -- Ein Geschenk, kein Ersatz fuer E10: Fuer die Kategorie-Zaehlung hilft dieses
    -- Constraint nicht (es kennt nur zugewiesene Zimmer), aber ab dem Moment der
    -- Zimmerzuweisung ist Doppelbelegung physisch unmoeglich.
    --
    -- Das Praedikat benutzt is_blocking_status() und nicht `status <> 'cancelled'`,
    -- damit die Regel aus E11 an genau einer Stelle steht. Preis: eine Aenderung
    -- dieser Funktion verlangt `reindex table public.bookings` - siehe die Migration
    -- 20260902110000_is_blocking_status.sql.
    constraint bookings_no_double_room exclude using gist (room_id with =, stay with &&)
        where (room_id is not null and public.is_blocking_status(status))
);

create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_updated_at();

-- Indizes (schema.md, Abschnitt 5).
--
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

alter table public.bookings enable row level security;

-- Eigene Buchungen oder Mitarbeitende. Ein Gast ohne Konto hat keine
-- current_customer_id() und bekommt damit 0 Zeilen - keinen Fehler.
create policy bookings_select_own on public.bookings
for select using (customer_id = (select public.current_customer_id()) or public.is_staff());

-- KEINE Insert-, Update- oder Delete-Policy. Gebucht wird ausschliesslich ueber
-- create_booking() (Phase 6). Das ist die Vertrauensgrenze aus E6: Was der Client
-- pruefen koennte, ist keine Regel, sondern eine Bitte.
