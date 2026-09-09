-- booking_events — append-only Historie (E12).
--
-- Ab Tag 1, nicht nachtraeglich: Eine Historie, die erst eingebaut wird, wenn man sie
-- braucht, beginnt genau in dem Moment, in dem die interessanten Aenderungen schon
-- passiert sind.

create table public.booking_events (
    id uuid primary key default gen_random_uuid(),
    -- RESTRICT, nicht CASCADE: Die Historie darf eine Buchung ueberleben. Ihr
    -- Verschwinden waere das Gegenteil ihres Zwecks.
    booking_id uuid not null references public.bookings on delete restrict,
    event_type text not null,
    payload jsonb not null default '{}',
    actor_kind text not null check (actor_kind in ('customer', 'staff', 'system')),
    actor_user_id uuid references auth.users,
    created_at timestamptz not null default now()
);

create index booking_events_booking_id_idx on public.booking_events (booking_id, created_at);

alter table public.booking_events enable row level security;

create policy booking_events_select_own on public.booking_events
for select using (
    exists (
        select 1
        from public.bookings b
        where b.id = booking_events.booking_id
          and (b.customer_id = (select public.current_customer_id()) or public.is_staff())
    )
);

-- Append-only wird DURCHGESETZT, nicht vereinbart (E12).
--
-- Zwei Ebenen, weil eine nicht reicht:
-- 1. Keine INSERT/UPDATE/DELETE-Policy - damit ist fuer anon und authenticated
--    bereits alles zu (RLS ist deny by default).
-- 2. Die Rechte werden zusaetzlich ENTZOGEN, und zwar auch dem service_role. Denn
--    der Service-Role-Key umgeht RLS vollstaendig - ohne diesen Schritt koennte das
--    Seed-Skript die Historie umschreiben, und eine Historie, die man aendern kann,
--    ist keine.
--
-- Schreiben duerfen ausschliesslich SECURITY DEFINER-Funktionen (Phase 6), die als
-- Eigentuemer laufen. INSERT bleibt fuer service_role erlaubt, damit Seeds und
-- Administratives ueberhaupt Ereignisse anlegen koennen - nur Aendern und Loeschen
-- ist niemandem erlaubt.
revoke update, delete on public.booking_events from anon, authenticated, service_role;
