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

alter table public.booking_nights enable row level security;

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
