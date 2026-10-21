-- posts (E36) - KURS-SPIKE, NICHT TEIL DER DOMAENE.
--
-- Die Tabelle stammt aus dem Supabase-Tutorial am Anfang des Kurses. An ihr haengen
-- `PostsView` (/posts) und `SinglePostView` (/posts/:id). Weil die Migrationshistorie
-- bei `hotels` beginnt (V2) und die Cloud-Instanz nie eingefangen wurde, gab es sie
-- lokal bisher nicht - die beiden Routen liefen ins Leere.
--
-- Bewusst eine eigene, letzte Migration: Ihr Entfernen ist spaeter ein `git rm` der
-- Views plus eine Drop-Migration, ohne eine Domaenentabelle anzufassen. Die Beispiel-
-- zeilen stehen in `seed.sql`.

create table public.posts (
    id uuid primary key default gen_random_uuid(),
    title text not null check (btrim(title) <> ''),
    description text not null,
    created_at timestamptz not null default now()
);

comment on table public.posts is
    'E36: Kurs-Spike aus dem Supabase-Tutorial, nicht Teil der Domaene. Lesbar fuer alle, schreibbar nur fuer Mitarbeitende.';

alter table public.posts enable row level security;

-- Oeffentlich lesbar - die Posts-Seiten sind ohne Login erreichbar.
create policy posts_select_all on public.posts
for select using (true);

create policy posts_write_staff on public.posts
for all using (public.is_staff()) with check (public.is_staff());
