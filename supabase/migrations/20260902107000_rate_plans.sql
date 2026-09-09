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

-- Hoechstens ein Standardtarif pro Hotel. Ohne diesen Index waere "der Standard"
-- eine Frage der Sortierreihenfolge - und damit zufaellig.
create unique index rate_plans_one_default_idx on public.rate_plans (hotel_id) where is_default and archived_at is null;

create trigger rate_plans_set_updated_at before update on public.rate_plans
for each row execute function public.set_updated_at();

alter table public.rate_plans enable row level security;

create policy rate_plans_select_active on public.rate_plans
for select using (archived_at is null or public.is_staff());

create policy rate_plans_write_staff on public.rate_plans
for all using (public.is_staff()) with check (public.is_staff());
