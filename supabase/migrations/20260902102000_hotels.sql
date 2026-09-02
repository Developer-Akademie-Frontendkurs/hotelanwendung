-- hotels — genau eine Zeile (E14).
--
-- Die Tabelle existiert nicht als Multi-Hotel-Vorbereitung, sondern weil diese Daten
-- heute gebraucht werden (Impressum, Kontakt, Check-in-Zeiten, Zeitzone). Dass die
-- Erweiterung auf mehrere Hotels dadurch billig wird, ist Nebenprodukt (E2, E14).

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
