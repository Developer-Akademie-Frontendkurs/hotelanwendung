-- room_types — die verkaufte Einheit (E3).
--
-- Gebucht wird die Kategorie, nicht das einzelne Zimmer. Das ist die Domaenen-
-- entscheidung, aus der sich Kapazitaetsrechnung (E10) und Zimmerzuweisung beim
-- Check-in ergeben.

create table public.room_types (
    id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references public.hotels on delete restrict,
    name text not null,
    slug text not null,
    description text,
    -- Ohne max_occupancy ist jede Suche falsch: "2 Erwachsene + 2 Kinder" muss
    -- Kategorien ausschliessen koennen, in die vier Personen nicht passen (E15).
    max_occupancy int not null check (max_occupancy >= 1),
    -- Nie loeschen, nur archivieren (E22). NULL = aktiv.
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Sprechende URLs pro Hotel eindeutig - die Spalte traegt hotel_id bereits,
    -- damit die Multi-Hotel-Erweiterung keine Constraint-Aenderung braucht (E2).
    unique (hotel_id, slug)
);

create trigger room_types_set_updated_at before update on public.room_types
for each row execute function public.set_updated_at();

alter table public.room_types enable row level security;

-- Gaeste sehen nur aktive Kategorien. Archivierte bleiben fuer Mitarbeitende und
-- fuer bestehende Buchungen erreichbar - deshalb archivieren statt loeschen (E22).
create policy room_types_select_active on public.room_types
for select using (archived_at is null or public.is_staff());

create policy room_types_write_staff on public.room_types
for all using (public.is_staff()) with check (public.is_staff());
