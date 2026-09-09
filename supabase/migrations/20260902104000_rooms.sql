-- rooms — physische Zimmer.
--
-- Zaehlen fuer die Kapazitaet, werden aber nicht einzeln verkauft (E3). Die Zuweisung
-- an eine Buchung passiert beim Check-in.

create table public.rooms (
    id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references public.hotels on delete restrict,
    room_type_id uuid not null references public.room_types on delete restrict,
    room_number text not null,
    -- Archivierte Zimmer zaehlen NICHT in die Kapazitaet (E22). Sie zu loeschen wuerde
    -- an bestehenden Buchungen scheitern - und das ist genau richtig so.
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (hotel_id, room_number)
);

create index rooms_room_type_id_idx on public.rooms (room_type_id) where archived_at is null;

create trigger rooms_set_updated_at before update on public.rooms
for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

-- Zimmernummern sind Betriebsinterna: Ein Gast bucht eine Kategorie und hat keinen
-- Grund zu erfahren, dass Zimmer 204 existiert. Die Kapazitaetsrechnung braucht die
-- Tabelle trotzdem - sie laeuft ab Phase 5 ueber SECURITY DEFINER-Funktionen, die
-- nur die Anzahl freier Zimmer herausgeben, nie die Zimmer selbst (E17).
create policy rooms_select_staff on public.rooms
for select using (public.is_staff());

create policy rooms_write_staff on public.rooms
for all using (public.is_staff()) with check (public.is_staff());
