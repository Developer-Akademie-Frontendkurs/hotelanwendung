-- Belegung als Gesamtzahl (E48) und mehrere Kategorien in einem Vorgang (E44).
--
-- E45 hatte festgelegt: p_adults/p_children beschreiben EIN Zimmer. Das wird hier
-- revidiert. "2 Erwachsene, 1 Kind" heisst ab jetzt: zwei Erwachsene und ein Kind
-- fuer den GANZEN Vorgang - egal, wie viele Zimmer es werden.
--
-- Damit wandert die Belegungspruefung von "passt diese Gruppe in EIN Zimmer?" zu
-- "passt diese Gruppe in die gewaehlten Zimmer ZUSAMMEN?". Diese Frage laesst sich
-- erst beantworten, wenn alle Kategorien in einem Aufruf ankommen. Genau das ist E44
-- (p_positions jsonb) - ohne E44 stuende die Regel nur im Browser (Leitsatz 1).
--
-- Was sich aendert:
--   1. availability_nights liefert max_occupancy statt fits und kennt keine Belegung
--      mehr. Ob eine Gruppe passt, ist keine Eigenschaft EINER Kategorie mehr.
--   2. group_capacity() rechnet, wie viele Personen hoechstens in einen Bestand
--      passen - die eine Stelle, an der diese Regel steht.
--   3. availability_calendar fragt "passt die Gruppe in die freien Zimmer des
--      ganzen Hotels?" statt "gibt es eine Kategorie, in die sie allein passt?".
--   4. search_availability sortiert keine Kategorie mehr als zu_klein aus: Eine
--      Double Suite ist fuer vier Personen nicht zu klein, sie braucht zwei Zimmer.
--   5. create_booking nimmt p_positions, prueft die Gesamtkapazitaet und verteilt
--      die Personen selbst auf die Zimmerzeilen (E48, Verteilungsregel unten).

-- ---------------------------------------------------------------------------
-- Die alten Signaturen verschwinden, statt als Ueberladung stehen zu bleiben
-- ---------------------------------------------------------------------------
--
-- Wie in 20260916103000: Zwei gleichnamige Funktionen, die sich nur in Parametern
-- mit Default unterscheiden, machen Aufrufe ueber PostgREST mehrdeutig.
drop function if exists public.create_booking(date, date, uuid, int, text, text, text, int, text, int, boolean);
drop function if exists public.availability_nights(uuid, date, date, int, int, uuid);
drop function if exists public.reject_booking(text, date);

-- ---------------------------------------------------------------------------
-- 1. availability_nights: Bestand und Preis, keine Belegung mehr
-- ---------------------------------------------------------------------------
create or replace function public.availability_nights(
    p_hotel_id uuid,
    p_from date,
    p_to date,
    p_room_type_id uuid default null
)
returns table (
    night date,
    room_type_id uuid,
    max_occupancy int,
    capacity int,
    rooms_free int,
    rate_cents int,
    currency text
)
language sql
stable
security definer
set search_path = ''
as $$
with naechte as (
    -- Halb-offen: p_to ist der Abreisetag und damit KEINE Nacht (E29).
    select generate_series(p_from, p_to - 1, interval '1 day')::date as night
),
kategorien as (
    select rt.id, rt.max_occupancy
    from public.room_types rt
    where rt.hotel_id = p_hotel_id
      and rt.archived_at is null
      and (p_room_type_id is null or rt.id = p_room_type_id)
),
basis as (
    select n.night, k.id as room_type_id, k.max_occupancy
    from naechte n
    cross join kategorien k
),
-- Aktive Zimmer der Kategorie. Archivierte zaehlen NICHT (E22).
aktive_zimmer as (
    select r.room_type_id, count(*)::int as anzahl
    from public.rooms r
    join kategorien k on k.id = r.room_type_id
    where r.archived_at is null
    group by r.room_type_id
),
-- Gesperrte Zimmer je Nacht (E18). Sie senken die Kapazitaet, nicht die Belegung.
sperrungen as (
    select b.night, b.room_type_id, count(distinct rb.room_id)::int as anzahl
    from basis b
    join public.rooms r on r.room_type_id = b.room_type_id and r.archived_at is null
    join public.room_blocks rb on rb.room_id = r.id and rb.period @> b.night
    group by b.night, b.room_type_id
),
-- Blockierende Buchungen je Nacht. Was blockiert, entscheidet is_blocking_status -
-- an genau einer Stelle definiert (E11), nicht hier nachgebaut.
belegung as (
    select b.night, b.room_type_id, count(*)::int as anzahl
    from basis b
    join public.bookings bk
      on bk.room_type_id = b.room_type_id
     and bk.stay @> b.night
     and public.is_blocking_status(bk.status)
    group by b.night, b.room_type_id
),
-- Preis der Nacht im Standardtarif des Hotels (E5).
preise as (
    select b.night, b.room_type_id, rtr.amount_cents, rtr.currency
    from basis b
    join public.rate_plans rp
      on rp.hotel_id = p_hotel_id and rp.is_default and rp.archived_at is null
    join public.room_type_rates rtr
      on rtr.room_type_id = b.room_type_id
     and rtr.rate_plan_id = rp.id
     and rtr.validity @> b.night
)
select
    b.night,
    b.room_type_id,
    b.max_occupancy,
    (coalesce(az.anzahl, 0) - coalesce(s.anzahl, 0)) as capacity,
    -- BEWUSST NICHT auf 0 begrenzt: Eine Sperrung darf bestaetigte Buchungen ueber
    -- die Kapazitaet heben (E18). Ein negativer Wert ist die Meldung dieser
    -- Ueberbuchung an den Betrieb, kein Rechenfehler.
    (coalesce(az.anzahl, 0) - coalesce(s.anzahl, 0) - coalesce(bel.anzahl, 0)) as rooms_free,
    p.amount_cents as rate_cents,
    p.currency
from basis b
left join aktive_zimmer az on az.room_type_id = b.room_type_id
left join sperrungen s on s.night = b.night and s.room_type_id = b.room_type_id
left join belegung bel on bel.night = b.night and bel.room_type_id = b.room_type_id
left join preise p on p.night = b.night and p.room_type_id = b.room_type_id;
$$;

comment on function public.availability_nights(uuid, date, date, uuid) is
    'Interner Kern (E17, E48): rohe Kapazitaets- und Preiszahlen pro Nacht und Kategorie, ohne Belegung und ohne Maskierung.';

revoke all on function public.availability_nights(uuid, date, date, uuid) from public;
revoke all on function public.availability_nights(uuid, date, date, uuid) from anon, authenticated;
grant execute on function public.availability_nights(uuid, date, date, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. group_capacity: wie viele Personen passen in diesen Bestand?
-- ---------------------------------------------------------------------------
--
-- Jedes Zimmer braucht mindestens einen Erwachsenen (E48). Mehr Zimmer als
-- Erwachsene kann eine Gruppe also nicht belegen - und wer hoechstens k Zimmer
-- nehmen darf, nimmt fuer die groesste Kapazitaet die k GROESSTEN. Deshalb:
-- absteigend nach max_occupancy sortieren und bis zum Zimmerlimit auffuellen.
--
-- Die Gruppe passt genau dann, wenn diese Zahl >= Erwachsene + Kinder ist: Die k
-- gewaehlten Zimmer bekommen je einen Erwachsenen, der Rest verteilt sich auf die
-- freien Betten - Kinder duerfen dabei in jedes Zimmer.
create or replace function public.group_capacity(p_rooms int[], p_occupancy int[], p_room_limit int)
returns int
language sql
immutable
set search_path = ''
as $$
select coalesce(sum(least(z.rooms, greatest(p_room_limit - z.davor, 0)) * z.occupancy), 0)::int
from (
    select
        greatest(u.rooms, 0) as rooms,
        u.occupancy,
        coalesce(sum(greatest(u.rooms, 0)) over (order by u.occupancy desc, u.ord rows between unbounded preceding and 1 preceding), 0) as davor
    from unnest(p_rooms, p_occupancy) with ordinality as u(rooms, occupancy, ord)
) z;
$$;

comment on function public.group_capacity(int[], int[], int) is
    'E48: hoechste Personenzahl, die in p_rooms Zimmer (je p_occupancy Betten) passt, wenn hoechstens p_room_limit Zimmer belegt werden.';

revoke all on function public.group_capacity(int[], int[], int) from public;
revoke all on function public.group_capacity(int[], int[], int) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. availability_calendar: passt die Gruppe in das freie Hotel?
-- ---------------------------------------------------------------------------
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
    select h.id, h.booking_horizon_days
    from public.hotels h
    where h.id = coalesce(p_hotel_id, (select h2.id from public.hotels h2 order by h2.created_at limit 1))
),
roh as (
    select an.*
    from hotel
    cross join lateral public.availability_nights(hotel.id, p_from, p_to, p_room_type_id) an
),
je_nacht as (
    select
        r.night,
        -- Drei Bestaende, drei Fragen. Die Reihenfolge der Gruende unten folgt ihnen:
        -- Reicht das Hotel ueberhaupt? Reichen die freien Zimmer? Und die mit Preis?
        -- Zimmerlimit wie in create_booking: nie mehr Zimmer als Erwachsene, nie mehr
        -- als 8 je Vorgang (E44).
        public.group_capacity(array_agg(r.capacity), array_agg(r.max_occupancy), least(p_adults, 8)) as passen_gesamt,
        public.group_capacity(array_agg(r.rooms_free), array_agg(r.max_occupancy), least(p_adults, 8)) as passen_frei,
        public.group_capacity(
            array_agg(case when r.rate_cents is null then 0 else r.rooms_free end),
            array_agg(r.max_occupancy),
            least(p_adults, 8)
        ) as passen_frei_mit_preis,
        sum(greatest(r.rooms_free, 0))::int as summe_freie
    from roh r
    group by r.night
),
bewertet as (
    select
        n.night,
        n.summe_freie,
        case
            -- Zeitlich Unmoegliches vor Fachlichem (unveraendert seit E30).
            when n.night < current_date then 'vergangenheit'
            when n.night >= current_date + (select h.booking_horizon_days from hotel h) then 'ausserhalb_horizont'
            -- Auch leer waere das Hotel fuer diese Gruppe zu klein.
            when n.passen_gesamt < p_adults + coalesce(p_children, 0) then 'zu_klein'
            when n.passen_frei < p_adults + coalesce(p_children, 0) then 'ausgebucht'
            when n.passen_frei_mit_preis < p_adults + coalesce(p_children, 0) then 'kein_preis'
            else null
        end as grund
    from je_nacht n
)
select
    b.night,
    (b.grund is null) as is_available,
    -- Maskiert wie bisher (E28): keine Zahl, aus der sich der Grund zurueckrechnen liesse.
    case when b.grund is null or public.is_staff() then b.summe_freie else null end as rooms_free,
    public.mask_reason(b.grund) as unavailable_reason
from bewertet b
order by b.night;
$$;

comment on function public.availability_calendar(date, date, int, int, uuid, uuid) is
    'E24/E48: eine Zeile pro Nacht. Buchbar, wenn die GANZE Gruppe in die freien Zimmer passt. Maskiert fuer Gaeste (E28).';

revoke all on function public.availability_calendar(date, date, int, int, uuid, uuid) from public;
grant execute on function public.availability_calendar(date, date, int, int, uuid, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. search_availability: keine Kategorie ist mehr "zu klein"
-- ---------------------------------------------------------------------------
--
-- p_adults/p_children bleiben in der Signatur: Sie sind die Anfrage, und die
-- Oberflaeche schickt sie weiterhin. Ob die Gruppe in die gewaehlten Zimmer passt,
-- entscheidet sich aber erst an der Auswahl - im Browser als Hinweis, in
-- create_booking verbindlich.
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
        select * from public.availability_nights(v_hotel_id, p_check_in, p_check_out, p_room_type_id => null)
    ),
    je_kategorie as (
        select
            r.room_type_id,
            min(r.rooms_free) as min_frei,
            count(*)::int as naechte,
            -- Fehlt EINE Nacht im Preis, ist die Summe unbekannt - nicht 0 (E25).
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
    'E17/E48: eine Zeile pro Kategorie, Minimum ueber den Zeitraum und Gesamtpreis. Keine Belegungspruefung je Kategorie. Maskiert fuer Gaeste (E28).';

revoke all on function public.search_availability(date, date, int, int, uuid) from public;
grant execute on function public.search_availability(date, date, int, int, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reject_booking: der Fehler nennt die Position (E44)
-- ---------------------------------------------------------------------------
--
-- Mit mehreren Kategorien reicht das Datum nicht mehr: Die Oberflaeche muss wissen,
-- an WELCHER Karte sie den Grund anzeigt. NULL heisst "betrifft den ganzen Vorgang"
-- (Zeitraum, Belegung, Gesamtkapazitaet).
create or replace function public.reject_booking(p_code text, p_date date default null, p_room_type_id uuid default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
    v_code text := public.mask_reason(p_code);
    v_grund text;
begin
    v_grund := case v_code
        when 'ausgebucht' then 'Fuer dieses Datum sind keine Zimmer dieser Kategorie mehr frei.'
        when 'kein_preis' then 'Fuer dieses Datum ist kein Preis hinterlegt.'
        when 'zu_klein' then 'Die gewaehlten Zimmer reichen fuer diese Belegung nicht aus.'
        when 'vergangenheit' then 'Das Datum liegt in der Vergangenheit.'
        when 'ausserhalb_horizont' then 'So weit im Voraus sind noch keine Buchungen moeglich.'
        when 'ungueltiger_zeitraum' then 'Die Abreise muss nach der Anreise liegen.'
        when 'kategorie_unbekannt' then 'Diese Zimmerkategorie gibt es nicht.'
        when 'ungueltige_belegung' then 'Die Belegung ist ungueltig.'
        when 'leistung_unbekannt' then 'Fuer dieses Hotel ist die gewuenschte Zusatzleistung nicht hinterlegt.'
        else 'Fuer dieses Datum ist keine Buchung moeglich.'
    end;

    raise exception '%', v_grund
        using errcode = 'P0001',
              detail = jsonb_build_object('code', v_code, 'datum', p_date, 'room_type_id', p_room_type_id, 'grund', v_grund)::text;
end;
$$;

revoke all on function public.reject_booking(text, date, uuid) from public;
revoke all on function public.reject_booking(text, date, uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. create_booking(p_positions): mehrere Kategorien, Belegung als Gesamtzahl
-- ---------------------------------------------------------------------------
--
-- p_positions: [{"room_type_id": "<uuid>", "rooms": 2}, ...]
-- p_adults/p_children: Personen des GANZEN Vorgangs (E48).
--
-- Verteilungsregel (E48) - die Zimmer werden in der Reihenfolge der Positionen
-- durchlaufen, innerhalb einer Position der Reihe nach:
--   1. Jedes Zimmer bekommt einen Erwachsenen.
--   2. Die uebrigen Erwachsenen reihum, solange ein Zimmer unter max_occupancy ist.
--   3. Danach die Kinder nach demselben Verfahren.
-- Die Aufteilung ist vorlaeufig; die Rezeption kann sie aendern. Sie steht an den
-- Zimmerzeilen, weil adults/children dort pro Buchung gelten und max_occupancy pro
-- Zimmer weiterhin die harte Grenze ist.
create or replace function public.create_booking(
    p_check_in date,
    p_check_out date,
    p_positions jsonb,
    p_adults int,
    p_email text,
    p_first_name text,
    p_last_name text,
    p_children int default 0,
    p_phone text default null,
    p_with_breakfast boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_hotel_id uuid;
    v_horizon int;
    v_rate_plan_id uuid;
    v_customer_id uuid;
    v_group_id uuid;
    v_booking_id uuid;
    v_children int := coalesce(p_children, 0);
    v_naechte int;
    v_nacht record;
    v_row record;
    v_element jsonb;
    v_bookings jsonb := '[]'::jsonb;
    i int;
    j int;
    v_vergeben boolean;
    v_rest int;
    v_anzahl numeric;
    v_occ int;

    -- je Position
    v_pos_type uuid[] := '{}';
    v_pos_rooms int[] := '{}';
    v_pos_occupancy int[] := '{}';
    v_pos_total int[] := '{}';
    v_pos_hotel uuid;
    v_pos_archived timestamptz;
    v_pos_naechte int;
    v_summe int;
    v_zimmer_gesamt int := 0;
    v_betten int := 0;

    -- je Zimmer (Zeile in bookings)
    v_slot_pos int[] := '{}';
    v_slot_adults int[] := '{}';
    v_slot_children int[] := '{}';

    -- Fruehstueck (E47)
    v_service_id uuid;
    v_unit_adult int;
    v_unit_child int;
    v_extra int;
    v_total int := 0;
    v_extras int := 0;
begin
    -- 0. Eingaben, die gar keine Anfrage sind
    if p_check_out <= p_check_in then
        perform public.reject_booking('ungueltiger_zeitraum', p_check_in);
    end if;
    if p_adults is null or p_adults < 1 or v_children < 0 then
        perform public.reject_booking('ungueltige_belegung', p_check_in);
    end if;
    if p_email is null or position('@' in p_email) = 0 then
        raise exception 'E-Mail-Adresse fehlt oder ist ungueltig' using errcode = '22023';
    end if;

    -- 0b. Positionen lesen und pruefen (E44)
    --
    -- Der jsonb-Parameter kommt untypisiert an - die Funktion ist deshalb die letzte
    -- Verteidigungslinie und prueft die Form selbst, statt auf den Cast zu vertrauen:
    -- Ein kaputter UUID-Text soll ein strukturierter Fehler sein, keine 22P02.
    if p_positions is null or jsonb_typeof(p_positions) <> 'array' or jsonb_array_length(p_positions) = 0 then
        perform public.reject_booking('ungueltige_belegung', p_check_in);
    end if;

    for v_element in select value from jsonb_array_elements(p_positions)
    loop
        -- Verschachtelt statt mit OR verkettet: PostgreSQL garantiert keine
        -- Auswertungsreihenfolge, und der Cast darf erst laufen, wenn feststeht,
        -- dass dort eine Zahl steht.
        if jsonb_typeof(v_element) <> 'object'
           or coalesce(v_element ->> 'room_type_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or jsonb_typeof(v_element -> 'rooms') is distinct from 'number' then
            perform public.reject_booking('ungueltige_belegung', p_check_in);
        end if;
        v_anzahl := (v_element ->> 'rooms')::numeric;
        if v_anzahl <> trunc(v_anzahl) or v_anzahl < 1 or v_anzahl > 8 then
            perform public.reject_booking('ungueltige_belegung', p_check_in);
        end if;

        -- Eine Kategorie zweimal waere zweimal dieselbe Frage mit zwei Antworten.
        if (v_element ->> 'room_type_id')::uuid = any (v_pos_type) then
            perform public.reject_booking('ungueltige_belegung', p_check_in, (v_element ->> 'room_type_id')::uuid);
        end if;

        v_pos_type := v_pos_type || (v_element ->> 'room_type_id')::uuid;
        v_pos_rooms := v_pos_rooms || (v_element ->> 'rooms')::int;
    end loop;

    select sum(r)::int into v_zimmer_gesamt from unnest(v_pos_rooms) as r;

    -- Obergrenze je Vorgang (E44) und: jedes Zimmer braucht einen Erwachsenen (E48).
    if v_zimmer_gesamt > 8 or v_zimmer_gesamt > p_adults then
        perform public.reject_booking('ungueltige_belegung', p_check_in);
    end if;

    -- Alle Kategorien muessen existieren und zu EINEM Hotel gehoeren. Ein Vorgang
    -- ueber zwei Hotels haette zwei Locks und zwei Tarife - das gibt es nicht.
    for i in 1..array_length(v_pos_type, 1) loop
        select rt.hotel_id, rt.archived_at, rt.max_occupancy
        into v_pos_hotel, v_pos_archived, v_occ
        from public.room_types rt
        where rt.id = v_pos_type[i];

        if v_pos_hotel is null or v_pos_archived is not null or (v_hotel_id is not null and v_pos_hotel <> v_hotel_id) then
            perform public.reject_booking('kategorie_unbekannt', p_check_in, v_pos_type[i]);
        end if;

        v_hotel_id := v_pos_hotel;
        v_pos_occupancy := v_pos_occupancy || v_occ;
        v_betten := v_betten + v_occ * v_pos_rooms[i];
        v_pos_hotel := null;
        v_pos_archived := null;
    end loop;

    -- 1. Advisory-Lock, HOTELWEIT (E10, E33). Er deckt alle Positionen gemeinsam ab -
    -- genau der Fall, fuer den E33 ihn hotelweit gewaehlt hat.
    perform pg_advisory_xact_lock(hashtext('booking:' || v_hotel_id::text));

    select h.booking_horizon_days into v_horizon from public.hotels h where h.id = v_hotel_id;

    select rp.id into v_rate_plan_id
    from public.rate_plans rp
    where rp.hotel_id = v_hotel_id and rp.is_default and rp.archived_at is null;

    if v_rate_plan_id is null then
        perform public.reject_booking('kein_preis', p_check_in);
    end if;

    -- 2./3. Jede Position Nacht fuer Nacht - aus derselben Quelle wie Ergebnisliste
    -- und Kalender (availability_nights).
    for i in 1..array_length(v_pos_type, 1) loop
        v_pos_naechte := 0;
        v_summe := 0;

        for v_nacht in
            select *
            from public.availability_nights(v_hotel_id, p_check_in, p_check_out, v_pos_type[i])
            order by night
        loop
            v_pos_naechte := v_pos_naechte + 1;

            if v_nacht.night < current_date then
                perform public.reject_booking('vergangenheit', v_nacht.night);
            elsif v_nacht.night >= current_date + v_horizon then
                perform public.reject_booking('ausserhalb_horizont', v_nacht.night);
            elsif v_nacht.rooms_free < v_pos_rooms[i] then
                -- Der strukturierte Fehler nennt die ERSTE Nacht und die Position.
                perform public.reject_booking('ausgebucht', v_nacht.night, v_pos_type[i]);
            elsif v_nacht.rate_cents is null then
                -- Niemals Preis 0 (E25).
                perform public.reject_booking('kein_preis', v_nacht.night, v_pos_type[i]);
            end if;

            v_summe := v_summe + v_nacht.rate_cents;
        end loop;

        if v_pos_naechte = 0 then
            perform public.reject_booking('ungueltiger_zeitraum', p_check_in);
        end if;

        v_naechte := v_pos_naechte;
        v_pos_total := v_pos_total || v_summe;
    end loop;

    -- 3b. Passt die Gruppe in die gewaehlten Zimmer ZUSAMMEN? (E48)
    if v_betten < p_adults + v_children then
        perform public.reject_booking('zu_klein', p_check_in);
    end if;

    -- 3c. Verteilung auf die Zimmer (Regel oben)
    for i in 1..array_length(v_pos_type, 1) loop
        for j in 1..v_pos_rooms[i] loop
            v_slot_pos := v_slot_pos || i;
            v_slot_adults := v_slot_adults || 1;
            v_slot_children := v_slot_children || 0;
        end loop;
    end loop;

    v_rest := p_adults - v_zimmer_gesamt;
    while v_rest > 0 loop
        v_vergeben := false;
        for j in 1..v_zimmer_gesamt loop
            exit when v_rest = 0;
            if v_slot_adults[j] + v_slot_children[j] < v_pos_occupancy[v_slot_pos[j]] then
                v_slot_adults[j] := v_slot_adults[j] + 1;
                v_rest := v_rest - 1;
                v_vergeben := true;
            end if;
        end loop;
        -- Kann nach 3b nicht eintreten; ohne diese Zeile waere ein Fehler dort aber
        -- eine Endlosschleife statt einer Ablehnung.
        if not v_vergeben then
            perform public.reject_booking('zu_klein', p_check_in);
        end if;
    end loop;

    v_rest := v_children;
    while v_rest > 0 loop
        v_vergeben := false;
        for j in 1..v_zimmer_gesamt loop
            exit when v_rest = 0;
            if v_slot_adults[j] + v_slot_children[j] < v_pos_occupancy[v_slot_pos[j]] then
                v_slot_children[j] := v_slot_children[j] + 1;
                v_rest := v_rest - 1;
                v_vergeben := true;
            end if;
        end loop;
        if not v_vergeben then
            perform public.reject_booking('zu_klein', p_check_in);
        end if;
    end loop;

    -- 4. Fruehstueck fuer ALLE Gaeste des Vorgangs (E47, E48)
    if p_with_breakfast then
        select s.id, s.amount_cents, coalesce(s.child_amount_cents, s.amount_cents)
        into v_service_id, v_unit_adult, v_unit_child
        from public.services s
        where s.hotel_id = v_hotel_id
          and s.code = 'BREAKFAST'
          and s.archived_at is null;

        -- Kein Eintrag heisst nicht "gratis" (E25).
        if v_service_id is null then
            perform public.reject_booking('leistung_unbekannt', p_check_in);
        end if;
    end if;

    -- 5. Kunde: ueber email_normalized finden oder anlegen (E26, E32).
    select c.id into v_customer_id
    from public.customers c
    where c.email_normalized = lower(p_email);

    if v_customer_id is null then
        insert into public.customers (email, first_name, last_name, phone)
        values (p_email, p_first_name, p_last_name, p_phone)
        returning id into v_customer_id;
    end if;

    -- 6.-8. Buchungen, Naechte, Posten und Historie - alles in DIESER Transaktion.
    if v_zimmer_gesamt > 1 then
        -- Eine Gruppe von eins ist keine Gruppe (E27).
        insert into public.booking_groups default values returning id into v_group_id;
    end if;

    for j in 1..v_zimmer_gesamt loop
        i := v_slot_pos[j];

        -- Jede Zeile traegt das Fruehstueck IHRER Gaeste. Die Summe der Zeilen ist
        -- damit genau der Betrag fuer alle Gaeste - keine zweite Rechnung.
        v_extra := case
            when p_with_breakfast then v_naechte * (v_slot_adults[j] * v_unit_adult + v_slot_children[j] * v_unit_child)
            else 0
        end;

        insert into public.bookings (
            customer_id, room_type_id, rate_plan_id, booking_group_id,
            check_in, check_out, adults, children, total_amount_cents, extras_amount_cents
        )
        values (
            v_customer_id, v_pos_type[i], v_rate_plan_id, v_group_id,
            p_check_in, p_check_out, v_slot_adults[j], v_slot_children[j], v_pos_total[i], v_extra
        )
        returning id into v_booking_id;

        -- 7. Preis pro Nacht EINFRIEREN (E21).
        insert into public.booking_nights (booking_id, night, amount_cents)
        select v_booking_id, an.night, an.rate_cents
        from public.availability_nights(v_hotel_id, p_check_in, p_check_out, v_pos_type[i]) an;

        -- 7b. Fruehstueck ebenso einfrieren (E21, E47).
        if p_with_breakfast then
            insert into public.booking_extras (booking_id, service_id, guest_kind, quantity, unit_amount_cents, amount_cents)
            select v_booking_id, v_service_id, 'adult', v_naechte * v_slot_adults[j], v_unit_adult, v_naechte * v_slot_adults[j] * v_unit_adult
            union all
            select v_booking_id, v_service_id, 'child', v_naechte * v_slot_children[j], v_unit_child, v_naechte * v_slot_children[j] * v_unit_child
            where v_slot_children[j] > 0;
        end if;

        -- 8. Historie (E12)
        insert into public.booking_events (booking_id, event_type, payload, actor_kind, actor_user_id)
        values (
            v_booking_id,
            'created',
            jsonb_build_object(
                'zimmer_gesamt', v_zimmer_gesamt,
                'gruppe', v_group_id,
                'fruehstueck', p_with_breakfast,
                -- Die Gesamtbelegung der Anfrage, damit die automatische Verteilung
                -- spaeter nachvollziehbar bleibt (E48).
                'erwachsene_gesamt', p_adults,
                'kinder_gesamt', v_children
            ),
            'customer',
            auth.uid()
        );

        select b.id, b.booking_reference, b.check_in, b.check_out, b.adults, b.children, b.total_amount_cents,
               b.extras_amount_cents, b.grand_total_cents, b.currency, b.room_type_id, b.status
        into v_row
        from public.bookings b where b.id = v_booking_id;

        v_total := v_total + v_row.total_amount_cents;
        v_extras := v_extras + v_row.extras_amount_cents;

        v_bookings := v_bookings || jsonb_build_object(
            'id', v_row.id,
            'booking_reference', v_row.booking_reference,
            'check_in', v_row.check_in,
            'check_out', v_row.check_out,
            'nights', v_naechte,
            'adults', v_row.adults,
            'children', v_row.children,
            'total_amount_cents', v_row.total_amount_cents,
            'extras_amount_cents', v_row.extras_amount_cents,
            'grand_total_cents', v_row.grand_total_cents,
            'currency', v_row.currency,
            'room_type_id', v_row.room_type_id,
            'status', v_row.status
        );
    end loop;

    return jsonb_build_object(
        'booking_group_id', v_group_id,
        'bookings', v_bookings,
        'total_amount_cents', v_total,
        'extras_amount_cents', v_extras,
        'grand_total_cents', v_total + v_extras,
        'nights', v_naechte,
        'adults', p_adults,
        'children', v_children
    );
end;
$$;

comment on function public.create_booking(date, date, jsonb, int, text, text, text, int, text, boolean) is
    'E6/E10/E31/E44/E47/E48: einziger Weg, eine Buchung anzulegen. Mehrere Kategorien, Belegung als Gesamtzahl, automatische Verteilung auf die Zimmer.';

revoke all on function public.create_booking(date, date, jsonb, int, text, text, text, int, text, boolean) from public;
grant execute on function public.create_booking(date, date, jsonb, int, text, text, text, int, text, boolean) to anon, authenticated, service_role;
