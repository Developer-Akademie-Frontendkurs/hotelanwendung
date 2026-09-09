-- room_type_images + Storage-Bucket (E19).
--
-- Bilder liegen im Supabase Storage, die Tabelle haelt nur Pfad, Alternativtext und
-- Reihenfolge.

create table public.room_type_images (
    id uuid primary key default gen_random_uuid(),
    -- CASCADE ist hier korrekt und kein Widerspruch zu E22: Bilder sind kein Vertrag,
    -- sondern Zubehoer der Kategorie. Und eine Kategorie mit Buchungen laesst sich
    -- ohnehin nicht loeschen (ON DELETE RESTRICT auf bookings).
    room_type_id uuid not null references public.room_types on delete cascade,
    storage_path text not null,
    -- NOT NULL. Barrierefreiheit ist nicht optional (E19) - ein leerer Alternativtext
    -- ist eine bewusste Entscheidung des Autors, ein fehlender ist ein Versehen.
    alt_text text not null,
    -- Bewusst NICHT unique: sonst wird jedes Umsortieren zu einer Kette von
    -- Zwischenschritten. Duplikate sind harmlos, die Sortierung stabilisiert (sort_order, id).
    sort_order int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index room_type_images_order_idx on public.room_type_images (room_type_id, sort_order, id);

create trigger room_type_images_set_updated_at before update on public.room_type_images
for each row execute function public.set_updated_at();

alter table public.room_type_images enable row level security;

create policy room_type_images_select_all on public.room_type_images
for select using (true);

create policy room_type_images_write_staff on public.room_type_images
for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Storage-Bucket `room-images`
-- ---------------------------------------------------------------------------
-- Oeffentlich lesbar: Zimmerbilder stehen auf der Startseite, ein signierter Link pro
-- Bild waere Aufwand ohne Schutzwirkung.
insert into storage.buckets (id, name, public)
values ('room-images', 'room-images', true)
on conflict (id) do nothing;

-- Schreiben nur Mitarbeitende (in v1: nur der Service-Role-Key, E35).
create policy room_images_insert_staff on storage.objects
for insert with check (bucket_id = 'room-images' and public.is_staff());

create policy room_images_update_staff on storage.objects
for update using (bucket_id = 'room-images' and public.is_staff())
with check (bucket_id = 'room-images' and public.is_staff());

create policy room_images_delete_staff on storage.objects
for delete using (bucket_id = 'room-images' and public.is_staff());
