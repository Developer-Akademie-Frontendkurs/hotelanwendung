-- search_availability() — eine Zeile PRO KATEGORIE (E17, E28).
--
-- Fuettert die Ergebnisliste: Minimum freier Zimmer ueber den Zeitraum und
-- Gesamtpreis. Das Minimum ist der richtige Aggregator, nicht der Durchschnitt:
-- Eine Kategorie, die an drei von vier Naechten frei ist, ist fuer einen
-- viernaechtigen Aufenthalt nicht buchbar.
--
-- Rueckgabe nur als Aggregat (E17): Nie einzelne Zimmer, nie Zimmernummern - nur
-- "so viele sind frei" und "so viel kostet es".

create or replace function public.search_availability(
    p_check_in date,
    p_check_out date,
    p_adults int,
    p_children int default 0,
    p_hotel_id uuid default null
)
returns table (
    room_type_id uuid,
    name text,
    slug text,
    max_occupancy int,
    nights int,
    rooms_free int,
    total_amount_cents int,
    currency text,
    is_bookable boolean,
    unavailable_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_hotel_id uuid;
    v_horizon int;
begin
    if p_check_out <= p_check_in then
        -- Halb-offen heisst: mindestens eine Nacht. Ein leerer Zeitraum ist keine
        -- Anfrage, sondern ein Fehler - und wird als solcher gemeldet, statt still
        -- null Zeilen zu liefern.
        raise exception 'Abreise muss nach der Anreise liegen (% >= %)', p_check_in, p_check_out
            using errcode = '22007';
    end if;

    select h.id, h.booking_horizon_days
    into v_hotel_id, v_horizon
    from public.hotels h
    where h.id = coalesce(p_hotel_id, (select h2.id from public.hotels h2 order by h2.created_at limit 1));

    if v_hotel_id is null then
        raise exception 'Kein Hotel gefunden' using errcode = 'P0002';
    end if;

    return query
    with roh as (
        select * from public.availability_nights(v_hotel_id, p_check_in, p_check_out, p_adults, p_children, p_room_type_id => null)
    ),
    je_kategorie as (
        select
            r.room_type_id,
            bool_and(r.fits) as passt,
            min(r.rooms_free) as min_frei,
            count(*)::int as naechte,
            -- Fehlt EINE Nacht im Preis, ist die Summe unbekannt - nicht 0.
            -- Ein Gesamtpreis von 0 waere die gefaehrlichste Antwort von allen (E25).
            case when count(r.rate_cents) = count(*) then sum(r.rate_cents)::int else null end as summe,
            max(r.currency) as currency
        from roh r
        group by r.room_type_id
    ),
    bewertet as (
        select
            k.*,
            case
                when p_check_in < current_date then 'vergangenheit'
                when p_check_out > current_date + v_horizon then 'ausserhalb_horizont'
                when not k.passt then 'zu_klein'
                when k.min_frei <= 0 then 'ausgebucht'
                when k.summe is null then 'kein_preis'
                else null
            end as grund
        from je_kategorie k
    )
    select
        rt.id,
        rt.name,
        rt.slug,
        rt.max_occupancy,
        b.naechte,
        case when b.grund is null or public.is_staff() then b.min_frei else null end,
        -- Der Preis wird bei nicht buchbaren Kategorien unterdrueckt. Sonst haette
        -- eine ausgebuchte Kategorie einen Preis, was in der Oberflaeche wie ein
        -- Angebot aussieht.
        case when b.grund is null or public.is_staff() then b.summe else null end,
        coalesce(b.currency, 'EUR'),
        (b.grund is null) as is_bookable,
        public.mask_reason(b.grund)
    from bewertet b
    join public.room_types rt on rt.id = b.room_type_id
    order by b.grund nulls first, b.summe nulls last, rt.name;
end;
$$;

comment on function public.search_availability(date, date, int, int, uuid) is
    'E17: eine Zeile pro Kategorie, Minimum ueber den Zeitraum und Gesamtpreis. Maskiert fuer Gaeste (E28).';

-- Absichtlich werden AUCH nicht buchbare Kategorien zurueckgegeben, mit Grund. Eine
-- Ergebnisliste, die ausgebuchte Kategorien verschweigt, laesst den Gast glauben, es
-- gaebe sie nicht - und beim naechsten Termin sind sie wieder da.
revoke all on function public.search_availability(date, date, int, int, uuid) from public;
grant execute on function public.search_availability(date, date, int, int, uuid) to anon, authenticated, service_role;
