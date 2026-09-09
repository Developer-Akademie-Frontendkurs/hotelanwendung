-- room_blocks — Sperrungen einzelner Zimmer (E18).
--
-- Renovierung, Defekt, Eigenbelegung. Verfuegbarkeitsrelevant: ein gesperrtes Zimmer
-- zaehlt an diesem Tag nicht zur Kapazitaet seiner Kategorie.

create table public.room_blocks (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.rooms on delete restrict,
    starts_on date not null,
    -- Halb-offen [starts_on, ends_on): der letzte Tag ist NICHT gesperrt (E8).
    ends_on date not null,
    period daterange generated always as (daterange(starts_on, ends_on, '[)')) stored,
    reason text not null,
    note text,
    created_by uuid references auth.users,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_on > starts_on),
    -- Sperrungen DESSELBEN Zimmers duerfen sich nicht ueberlappen. Hier ist ein
    -- Exclusion-Constraint richtig, weil er genau ein Zimmer betrifft. Bei Buchungen
    -- geht das nicht, weil dort die Kategorie gezaehlt wird (E3/E10).
    exclude using gist (room_id with =, period with &&)
);

create index room_blocks_period_idx on public.room_blocks using gist (period);

create trigger room_blocks_set_updated_at before update on public.room_blocks
for each row execute function public.set_updated_at();

alter table public.room_blocks enable row level security;

-- Wie rooms: Betriebsinterna. Dass ein Zimmer wegen eines Defekts gesperrt ist, geht
-- den Gast nichts an - er sieht ab Phase 5 nur, dass weniger Zimmer frei sind (E28).
create policy room_blocks_select_staff on public.room_blocks
for select using (public.is_staff());

create policy room_blocks_write_staff on public.room_blocks
for all using (public.is_staff()) with check (public.is_staff());

-- Bewusst NICHT durchgesetzt (E18): dass eine Sperrung bestaetigte Buchungen ueber die
-- Kapazitaet hebt. Das Zimmer IST kaputt - die Datenbank darf diese Tatsache nicht
-- ablehnen. Gemeldet wird es, verhindert nicht.
