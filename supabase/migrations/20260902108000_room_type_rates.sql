-- room_type_rates — Saisonpreise (E5).
--
-- Preis pro Kategorie, Tarif und Zeitraum. Was hier steht, ist der Preis, der HEUTE
-- gilt; was eine Buchung kostet, wird beim Buchen eingefroren (E21) und danach von
-- Aenderungen hier nicht mehr beruehrt. Eine Buchung ist ein Vertrag.

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

-- Anmerkung fuer die Multi-Hotel-Erweiterung (E2): Die Tabelle kennt kein hotel_id,
-- sondern erbt es ueber room_type_id UND rate_plan_id. Dass beide zum selben Hotel
-- gehoeren muessen, erzwingt heute nichts - bei einem Hotel ist das gegenstandslos,
-- beim zweiten braucht es einen zusammengesetzten Fremdschluessel.

create trigger room_type_rates_set_updated_at before update on public.room_type_rates
for each row execute function public.set_updated_at();

alter table public.room_type_rates enable row level security;

-- Preise sind oeffentlich - sie stehen auf der Kategorieseite.
create policy room_type_rates_select_all on public.room_type_rates
for select using (true);

create policy room_type_rates_write_staff on public.room_type_rates
for all using (public.is_staff()) with check (public.is_staff());
