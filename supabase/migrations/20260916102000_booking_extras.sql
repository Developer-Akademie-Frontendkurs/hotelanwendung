-- booking_extras — eingefrorener Preis der Zusatzleistungen (E21, E47).
--
-- Dasselbe Paar wie room_type_rates/booking_nights: services sagt, was HEUTE gilt,
-- booking_extras sagt, was beim Buchen GALT. Eine Preisaenderung am Fruehstueck
-- beruehrt bestehende Buchungen nicht - eine Buchung ist ein Vertrag.
--
-- Getrennte Zeilen fuer Erwachsene und Kinder, nicht eine Summe: Der Kinderpreis ist
-- ein anderer Preis, und auf einer Rechnung stehen deshalb zwei Positionen. Wer beide
-- zusammenzieht, kann "2 Erwachsene + 1 Kind" spaeter nicht mehr aus dem Betrag
-- zurueckrechnen.

create table public.booking_extras (
    -- CASCADE wie bei booking_nights: die Posten sind Teil der Buchung.
    booking_id uuid not null references public.bookings on delete cascade,
    -- RESTRICT: eine Leistung, die auf einer Buchung steht, wird archiviert, nicht
    -- geloescht (E22).
    service_id uuid not null references public.services on delete restrict,

    guest_kind text not null check (guest_kind in ('adult', 'child')),

    -- Einheiten nach services.charge_basis - bei 'per_person_night' also
    -- Personen dieser Art x Naechte.
    quantity int not null check (quantity > 0),

    -- 0 ist erlaubt: "Kinder fruehstuecken gratis" ist eine Konfiguration und soll als
    -- Position sichtbar bleiben, statt zu verschwinden.
    unit_amount_cents int not null check (unit_amount_cents >= 0),
    amount_cents int not null check (amount_cents >= 0),

    created_at timestamptz not null default now(),

    primary key (booking_id, service_id, guest_kind),

    -- Die Zeile prueft sich selbst. Ohne dieses CHECK waere eine Position denkbar, die
    -- eine andere Summe behauptet als ihre eigenen Faktoren ergeben - und niemand
    -- wuesste, welche der beiden Zahlen stimmt.
    constraint booking_extras_amount_consistent check (amount_cents = quantity * unit_amount_cents)
);

comment on table public.booking_extras is
    'E47: eingefrorene Zusatzleistungen je Buchung, getrennt nach Erwachsenen und Kindern.';

alter table public.booking_extras enable row level security;

-- Sichtbar ueber die zugehoerige Buchung - ausgeschrieben wie bei booking_nights,
-- damit die Regel an der Tabelle steht und nicht aus einer anderen abgeleitet wird.
create policy booking_extras_select_own on public.booking_extras
for select using (
    exists (
        select 1
        from public.bookings b
        where b.id = booking_extras.booking_id
          and (b.customer_id = (select public.current_customer_id()) or public.is_staff())
    )
);

-- Kein Schreibrecht: Posten entstehen in create_booking. Ein eingefrorener Preis, den
-- der Client setzen darf, ist nicht eingefroren.

-- ---------------------------------------------------------------------------
-- bookings: die Summe der Zusatzleistungen (E47)
-- ---------------------------------------------------------------------------
--
-- total_amount_cents behaelt seine Bedeutung: der ZIMMERPREIS, also die Summe der
-- booking_nights. Diese Invariante ist heute implizit gueltig und waere sonst
-- stillschweigend gebrochen - jede bestehende Abfrage, jeder Test und die
-- Rueckgabe von create_booking meinten damit bisher den vollen Betrag.
--
-- Der volle Betrag bekommt deshalb einen eigenen, generierten Namen. Damit gibt es
-- keine Stelle mehr, an der "die Summe" zweideutig ist.
alter table public.bookings
    add column extras_amount_cents int not null default 0 check (extras_amount_cents >= 0),
    add column grand_total_cents int generated always as (total_amount_cents + extras_amount_cents) stored;

comment on column public.bookings.total_amount_cents is
    'Zimmerpreis - Summe der booking_nights. OHNE Zusatzleistungen (E47).';
comment on column public.bookings.extras_amount_cents is
    'Summe der booking_extras dieser Buchung (E47).';
comment on column public.bookings.grand_total_cents is
    'Was der Gast zahlt: Zimmer + Zusatzleistungen. Die Spalte, die in Bestaetigung und Rechnung gehoert (E47).';
