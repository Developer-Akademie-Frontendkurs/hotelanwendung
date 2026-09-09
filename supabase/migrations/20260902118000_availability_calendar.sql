-- availability_calendar() — eine Zeile PRO NACHT (E24, E28, E29).
--
-- Fuettert den Kalender. Ein Tageswert bedeutet "diese NACHT ist verfuegbar" - nicht
-- "dieser Tag ist frei". Die Oberflaeche leitet daraus ab (E29):
--   Anreisetag waehlbar, wenn DIESE Nacht frei ist
--   Abreisetag waehlbar, wenn die VORHERIGE Nacht frei ist
-- Wer stattdessen den Tag komplett durchstreicht, verkauft keine Anschlussnaechte.

create or replace function public.availability_calendar(
    p_from date,
    p_to date,
    p_adults int,
    p_children int default 0,
    p_room_type_id uuid default null,
    p_hotel_id uuid default null
)
returns table (
    night date,
    is_available boolean,
    rooms_free int,
    unavailable_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
with hotel as (
    -- Ein Hotel (E14). Der Parameter existiert, damit die Multi-Hotel-Erweiterung
    -- kein Signaturwechsel ist - und damit Tests gegen ihre eigene Fixture arbeiten
    -- koennen, statt gegen den Seed.
    select h.id, h.booking_horizon_days
    from public.hotels h
    where h.id = coalesce(p_hotel_id, (select h2.id from public.hotels h2 order by h2.created_at limit 1))
),
roh as (
    select an.*
    from hotel
    cross join lateral public.availability_nights(hotel.id, p_from, p_to, p_adults, p_children, p_room_type_id) an
),
je_nacht as (
    select
        r.night,
        -- Gibt es ueberhaupt eine Kategorie, in die die Gaeste passen? (E15)
        bool_or(r.fits) as passt_irgendwo,
        -- Freie Zimmer in passenden Kategorien
        max(case when r.fits then r.rooms_free end) as beste_freie,
        -- ... und davon welche mit Preis
        max(case when r.fits and r.rate_cents is not null then r.rooms_free end) as beste_freie_mit_preis,
        sum(case when r.fits then r.rooms_free else 0 end)::int as summe_freie
    from roh r
    group by r.night
),
bewertet as (
    select
        n.night,
        n.summe_freie,
        case
            -- Reihenfolge ist bedeutungstragend: Was zeitlich unmoeglich ist, muss
            -- vor allem Fachlichen kommen, sonst meldet der Kalender "ausgebucht"
            -- fuer einen Tag, der einfach vorbei ist.
            when n.night < current_date then 'vergangenheit'
            -- Halb-offen wie ueberall: buchbar sind die Naechte
            -- [heute, heute + booking_horizon_days) (E30).
            when n.night >= current_date + (select h.booking_horizon_days from hotel h) then 'ausserhalb_horizont'
            when not coalesce(n.passt_irgendwo, false) then 'zu_klein'
            when coalesce(n.beste_freie, 0) <= 0 then 'ausgebucht'
            when coalesce(n.beste_freie_mit_preis, 0) <= 0 then 'kein_preis'
            else null
        end as grund
    from je_nacht n
)
select
    b.night,
    (b.grund is null) as is_available,
    -- Fuer Gaeste wird die Zahl bei nicht buchbaren Naechten unterdrueckt, und das
    -- ist kein Zierrat: Der Unterschied zwischen `ausgebucht` (rooms_free = 0) und
    -- `kein_preis` (rooms_free > 0) waere sonst aus der Zahl ablesbar - die
    -- Maskierung des Grundes waere wirkungslos (E28).
    case when b.grund is null or public.is_staff() then b.summe_freie else null end as rooms_free,
    public.mask_reason(b.grund) as unavailable_reason
from bewertet b
order by b.night;
$$;

comment on function public.availability_calendar(date, date, int, int, uuid, uuid) is
    'E24: eine Zeile pro Nacht mit Grund. Gruende und Zahlen maskiert fuer Gaeste (E28).';

revoke all on function public.availability_calendar(date, date, int, int, uuid, uuid) from public;
grant execute on function public.availability_calendar(date, date, int, int, uuid, uuid) to anon, authenticated, service_role;
