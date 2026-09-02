-- booking_groups (E27).
--
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

create table public.booking_groups (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now()
);

alter table public.booking_groups enable row level security;

-- Fuer Gaeste uninteressant: Sie sehen ihre Buchungen, nicht die Klammer darum.
create policy booking_groups_select_staff on public.booking_groups
for select using (public.is_staff());

-- Kein Schreibrecht: Gruppen entstehen in create_booking (Phase 6).
