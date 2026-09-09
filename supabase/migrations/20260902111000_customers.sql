-- customers (E4, E26, E32).
--
-- Eigene Tabelle, `auth.users` nur optional verknuepft: `auth.users` gehoert Supabase,
-- nicht der Domaene (E4). Ein Gast kann ohne Konto buchen; legt er spaeter eines an,
-- wird `user_id` an den bestehenden Datensatz gehaengt und alle frueheren Buchungen
-- sind sichtbar - ohne nachtraegliches Zusammenfuehren von Kundendatensaetzen (E26).

create table public.customers (
    id uuid primary key default gen_random_uuid(),
    -- ON DELETE SET NULL ist hier - und NUR hier - richtig, obwohl E22 SET NULL
    -- verwirft: Wird das Supabase-Konto geloescht, bleibt der Kunde samt Buchungen
    -- bestehen. Genau das ist der Sinn der Trennung von auth.users.
    user_id uuid unique references auth.users (id) on delete set null,
    -- Originalschreibweise. Sie steht in der Bestaetigungsmail, also wird sie nicht
    -- ueberschrieben (E32).
    email text not null,
    -- Die Case-Insensitivitaet ist eine SPALTE, keine Konvention (E32): gesucht wird
    -- immer hierueber, die Eindeutigkeit haengt an einem gewoehnlichen UNIQUE. Ein
    -- funktionaler Index auf lower(email) haette dieselbe Eindeutigkeit garantiert,
    -- aber `where email = 'Max@Muster.de'` haette die Zeile trotzdem nicht gefunden.
    email_normalized text generated always as (lower(email)) stored not null unique,
    first_name text not null,
    last_name text not null,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- current_customer_id() — mappt auth.uid() auf customers.id (E13)
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER, und das hat hier NICHTS mit Privilegien zu tun, sondern mit
-- Rekursion: Die Policy auf `customers` benutzt diese Funktion, und die Funktion
-- liest aus `customers`. Mit Invoker-Rechten wuerde die Policy sich selbst aufrufen
-- und Postgres bricht mit "infinite recursion detected in policy" ab.
--
-- Der Alternativweg waere `user_id = auth.uid()` direkt in der Policy - genau das
-- verstreute auth.uid(), das E13 verbietet, damit Identitaet an einer Stelle liegt.
create or replace function public.current_customer_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
select c.id from public.customers c where c.user_id = auth.uid();
$$;

comment on function public.current_customer_id() is
    'E13: einziger Ort, an dem auth.uid() zu einem Kunden wird. SECURITY DEFINER wegen RLS-Rekursion.';

revoke all on function public.current_customer_id() from public;
grant execute on function public.current_customer_id() to anon, authenticated, service_role;

alter table public.customers enable row level security;

-- Der eigene Datensatz oder Mitarbeitende. Das `(select ...)` ist kein Zierrat:
-- so wertet Postgres die Funktion EINMAL pro Abfrage aus und nicht pro Zeile.
create policy customers_select_own on public.customers
for select using (id = (select public.current_customer_id()) or public.is_staff());

create policy customers_update_own on public.customers
for update using (id = (select public.current_customer_id()) or public.is_staff())
with check (id = (select public.current_customer_id()) or public.is_staff());

-- Kein INSERT und kein DELETE: Kunden entstehen ausschliesslich in create_booking
-- (Phase 6), damit dieselbe E-Mail nie zwei Datensaetze erzeugt (E26). Geloescht
-- wird nichts (E22).
