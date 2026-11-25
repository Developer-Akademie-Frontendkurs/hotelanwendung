-- room_type_features: amenities per room type for the homepage slider.
-- `code` selects the icon in the frontend; unknown codes get a neutral fallback icon.

create table public.room_type_features (
    id uuid primary key default gen_random_uuid(),
    -- Cascade like room_type_images: features belong to the room type, they are no contract.
    room_type_id uuid not null references public.room_types on delete cascade,
    code text not null,
    label text not null check (char_length(label) > 0),
    sort_order int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (room_type_id, code)
);

create index room_type_features_order_idx on public.room_type_features (room_type_id, sort_order, id);

create trigger room_type_features_set_updated_at before update on public.room_type_features
for each row execute function public.set_updated_at();

alter table public.room_type_features enable row level security;

create policy room_type_features_select_all on public.room_type_features
for select using (true);

create policy room_type_features_write_staff on public.room_type_features
for all using (public.is_staff()) with check (public.is_staff());
