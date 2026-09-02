-- find_rate_gaps(tage int) — Naechte ohne Preiszeile (E25).
--
-- Warum diese Funktion ueberhaupt existiert: Eine Preisluecke ist ERLAUBT und
-- bedeutet "nicht buchbar". Im Kalender sieht sie deshalb genauso aus wie
-- "ausgebucht" - fuer den Betrieb sind das aber entgegengesetzte Signale:
-- ausgebucht ist Erfolg, kein_preis ist ein Konfigurationsfehler (E28).
-- Ohne diese Funktion bemerkt niemand den Unterschied.

create or replace function public.find_rate_gaps(tage int default 365)
returns table (
    hotel_id uuid,
    room_type_id uuid,
    room_type_name text,
    rate_plan_id uuid,
    rate_plan_code text,
    gap_start date,
    gap_end date,
    nights int
)
language sql
stable
set search_path = ''
as $$
with horizon as (
    select generate_series(current_date, current_date + (tage - 1), interval '1 day')::date as night
),
-- Jede aktive Kategorie mit jedem aktiven Tarif DESSELBEN Hotels. Absichtlich alle
-- Tarife und nicht nur der Standard: ein buchbarer Tarif ohne Preis ist genau der
-- Konfigurationsfehler, um den es hier geht.
combos as (
    select rt.hotel_id, rt.id as room_type_id, rt.name as room_type_name, rp.id as rate_plan_id, rp.code as rate_plan_code
    from public.room_types rt
    join public.rate_plans rp on rp.hotel_id = rt.hotel_id and rp.archived_at is null
    where rt.archived_at is null
),
missing as (
    select c.hotel_id, c.room_type_id, c.room_type_name, c.rate_plan_id, c.rate_plan_code, h.night
    from combos c
    cross join horizon h
    where not exists (
        select 1
        from public.room_type_rates r
        where r.room_type_id = c.room_type_id
          and r.rate_plan_id = c.rate_plan_id
          and r.validity @> h.night
    )
),
-- Aufeinanderfolgende fehlende Naechte zu einem Block zusammenfassen: `night` minus
-- der laufenden Nummer ist innerhalb einer Luecke konstant. 300 Einzelzeilen waeren
-- fuer eine Admin-Ansicht unbrauchbar; drei Bloecke sagen dasselbe.
islands as (
    select
        hotel_id,
        room_type_id,
        room_type_name,
        rate_plan_id,
        rate_plan_code,
        night,
        night - (row_number() over (partition by room_type_id, rate_plan_id order by night))::int as island
    from missing
)
select
    hotel_id,
    room_type_id,
    room_type_name,
    rate_plan_id,
    rate_plan_code,
    min(night) as gap_start,
    -- Halb-offen wie ueberall sonst (E8): gap_end ist der erste Tag MIT Preis.
    (max(night) + 1) as gap_end,
    count(*)::int as nights
from islands
group by hotel_id, room_type_id, room_type_name, rate_plan_id, rate_plan_code, island
order by room_type_name, gap_start;
$$;

comment on function public.find_rate_gaps(int) is
    'Admin (E25): Naechte ohne Preiszeile, zu Bloecken zusammengefasst. gap_end ist halb-offen.';

-- SECURITY INVOKER (Standard) und nicht DEFINER - und das ist eine bewusste
-- Entscheidung: Ein `is_staff()`-Wachposten in der Funktion wuerde in v1 AUCH den
-- Service-Role-Key abweisen, denn is_staff() gibt fuer jede Rolle false zurueck
-- (E13). Mit Invoker-Rechten regelt stattdessen das EXECUTE-Recht den Zugang: der
-- Service-Role-Key darf, der Gast im Browser nicht.
revoke all on function public.find_rate_gaps(int) from public;
revoke all on function public.find_rate_gaps(int) from anon, authenticated;
grant execute on function public.find_rate_gaps(int) to service_role;
