-- Zusatzleistungen je Vorgang (E49): Kinderbett, Tiefgarage, Haustier, Late
-- Check-out, Massage.
--
-- E47 hatte versprochen, dass der naechste Zusatz ein INSERT ist und keine Migration.
-- Fuer die Zeilen selbst stimmt das (siehe seed.sql). Die Migration braucht es trotzdem,
-- weil die neuen Leistungen etwas anderes zaehlen als das Fruehstueck:
--   1. charge_basis bekommt drei Werte: per_night, per_stay, per_unit.
--   2. amount_cents darf 0 sein - "Kinderbett gratis" ist eine Konfiguration, kein
--      Versehen (dasselbe Argument wie bei child_amount_cents).
--   3. booking_extras.guest_kind bekommt 'none': Ein Stellplatz ist weder Erwachsener
--      noch Kind.
--   4. services bekommt description und sort_order fuer die Buchungsseite.
--   5. create_booking bekommt p_services jsonb.

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
alter table public.services drop constraint services_charge_basis_check;
alter table public.services add constraint services_charge_basis_check
    check (charge_basis in ('per_person_night', 'per_night', 'per_stay', 'per_unit'));

alter table public.services drop constraint services_amount_cents_check;
alter table public.services add constraint services_amount_cents_check check (amount_cents >= 0);

-- Einen Kinderpreis gibt es nur, wo pro Person gerechnet wird. Ein Kinderpreis am
-- Stellplatz waere eine Zahl, die keine Rechnung je liest.
alter table public.services add constraint services_child_price_needs_person
    check (charge_basis = 'per_person_night' or child_amount_cents is null);

alter table public.services
    add column description text,
    add column sort_order int not null default 0;

comment on column public.services.charge_basis is
    'E47/E49: was EINE Einheit in booking_extras.quantity ist - per_person_night (Personen x Naechte), per_night (Naechte), per_stay (1), per_unit (gewaehlte Menge).';

-- ---------------------------------------------------------------------------
-- booking_extras
-- ---------------------------------------------------------------------------
--
-- 'none' bleibt Teil des Primaerschluessels (booking_id, service_id, guest_kind):
-- Eine Leistung je Vorgang steht damit hoechstens einmal an einer Buchung.
--
-- Die Regel "none genau dann, wenn nicht per_person_night" steht in create_booking,
-- nicht als CHECK: Ein Tabellen-CHECK kann nicht in services nachsehen.
alter table public.booking_extras drop constraint booking_extras_guest_kind_check;
alter table public.booking_extras add constraint booking_extras_guest_kind_check
    check (guest_kind in ('adult', 'child', 'none'));

-- ---------------------------------------------------------------------------
-- reject_booking: ein Code mehr
-- ---------------------------------------------------------------------------
--
-- 'ungueltige_leistung' ist - wie 'ungueltige_belegung' - ein Fehler der Anfrage,
-- nicht unserer Konfiguration, und bleibt deshalb auch fuer Gaeste sichtbar.
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
        when 'ungueltige_leistung' then 'Die gewaehlten Zusatzleistungen sind ungueltig.'
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
-- create_booking(..., p_services)
-- ---------------------------------------------------------------------------
--
-- p_services: [{"code": "GARAGE"}, {"code": "CHILD_BED", "quantity": 2}, ...]
-- Alles andere wie in 20260923101000 (E44, E48). Alte Signatur gedroppt, keine
-- Ueberladung.
drop function if exists public.create_booking(date, date, jsonb, int, text, text, text, int, text, boolean);

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
    p_with_breakfast boolean default false,
    p_services jsonb default '[]'::jsonb
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

    -- Zusatzleistungen je Vorgang (E49)
    v_services jsonb := coalesce(p_services, '[]'::jsonb);
    v_svc_codes text[] := '{}';
    v_svc_quantities int[] := '{}';
    v_svc_ids uuid[] := '{}';
    v_svc_units int[] := '{}';
    v_svc_mengen int[] := '{}';
    v_svc_total int := 0;
    v_svc record;
    v_menge int;
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

    -- 0c. Zusatzleistungen lesen und pruefen (E49)
    --
    -- Nur die Form. Ob es die Leistung im Hotel gibt, steht erst fest, wenn das Hotel
    -- bekannt ist (Schritt 4b).
    if jsonb_typeof(v_services) <> 'array' then
        perform public.reject_booking('ungueltige_leistung', p_check_in);
    end if;

    for v_element in select value from jsonb_array_elements(v_services)
    loop
        if jsonb_typeof(v_element) <> 'object' or jsonb_typeof(v_element -> 'code') is distinct from 'string' then
            perform public.reject_booking('ungueltige_leistung', p_check_in);
        end if;
        if (v_element ->> 'code') = any (v_svc_codes) then
            perform public.reject_booking('ungueltige_leistung', p_check_in);
        end if;

        -- Ohne `quantity` ist es eine Einheit - der Normalfall einer Checkbox.
        v_menge := 1;
        if v_element ? 'quantity' then
            if jsonb_typeof(v_element -> 'quantity') is distinct from 'number' then
                perform public.reject_booking('ungueltige_leistung', p_check_in);
            end if;
            v_anzahl := (v_element ->> 'quantity')::numeric;
            if v_anzahl <> trunc(v_anzahl) or v_anzahl < 1 or v_anzahl > 8 then
                perform public.reject_booking('ungueltige_leistung', p_check_in);
            end if;
            v_menge := v_anzahl::int;
        end if;

        v_svc_codes := v_svc_codes || (v_element ->> 'code');
        v_svc_quantities := v_svc_quantities || v_menge;
    end loop;

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

    -- 4b. Zusatzleistungen je Vorgang (E49)
    --
    -- Der Preis kommt aus `services`, nie aus dem Aufruf (E6). Die Menge je Posten
    -- folgt der Bezugsgroesse:
    --   per_night -> Naechte      (Tiefgarage: ein Stellplatz je Nacht)
    --   per_stay  -> 1            (Massage, Late Check-out, Haustier)
    --   per_unit  -> die Menge    (Kinderbett)
    if array_length(v_svc_codes, 1) is not null then
        for i in 1..array_length(v_svc_codes, 1) loop
            -- Das Fruehstueck hat seinen eigenen Parameter (E47/E48). Kaeme es auch hier
            -- an, gaebe es zwei Wege zu derselben Position - und zwei Preise dafuer.
            if v_svc_codes[i] = 'BREAKFAST' then
                perform public.reject_booking('ungueltige_leistung', p_check_in);
            end if;

            select s.id, s.code, s.charge_basis, s.amount_cents
            into v_svc
            from public.services s
            where s.hotel_id = v_hotel_id
              and s.code = v_svc_codes[i]
              and s.archived_at is null;

            if v_svc.id is null or v_svc.charge_basis = 'per_person_night' then
                perform public.reject_booking('leistung_unbekannt', p_check_in);
            end if;

            -- Eine Menge gibt es nur, wo die Bezugsgroesse eine Menge ist. "2 Massagen"
            -- per Checkbox waere eine Bestellung, die die Oberflaeche nie anbietet.
            if v_svc.charge_basis <> 'per_unit' and v_svc_quantities[i] <> 1 then
                perform public.reject_booking('ungueltige_leistung', p_check_in);
            end if;

            -- Kinderbett: nur mit Kind, hoechstens eines je Zimmer (E49). Die Regel haengt
            -- am Code und nicht an einer Spalte - es gibt genau eine solche Leistung, und
            -- eine Spalte fuer einen Fall waere Vorratsbau (E15).
            if v_svc.code = 'CHILD_BED' and (v_children = 0 or v_svc_quantities[i] > least(v_children, v_zimmer_gesamt)) then
                perform public.reject_booking('ungueltige_belegung', p_check_in);
            end if;

            v_menge := case v_svc.charge_basis
                when 'per_night' then v_naechte
                when 'per_stay' then 1
                else v_svc_quantities[i]
            end;

            v_svc_ids := v_svc_ids || v_svc.id;
            v_svc_units := v_svc_units || v_svc.amount_cents;
            v_svc_mengen := v_svc_mengen || v_menge;
            v_svc_total := v_svc_total + v_menge * v_svc.amount_cents;
            v_svc := null;
        end loop;
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

        -- Die Leistungen je Vorgang haengen an der ERSTEN Buchung (E49). Verteilt auf
        -- alle Zeilen hiesse ein Stellplatz "ein Drittel Stellplatz je Zimmer".
        if j = 1 then
            v_extra := v_extra + v_svc_total;
        end if;

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

        -- 7c. Leistungen je Vorgang einfrieren (E21, E49). 'none': Ein Stellplatz ist
        -- weder Erwachsener noch Kind. Auch 0-Euro-Posten stehen hier - das Kinderbett
        -- muss bereitstehen, auch wenn es nichts kostet.
        if j = 1 and array_length(v_svc_ids, 1) is not null then
            insert into public.booking_extras (booking_id, service_id, guest_kind, quantity, unit_amount_cents, amount_cents)
            select v_booking_id, u.id, 'none', u.menge, u.unit, u.menge * u.unit
            from unnest(v_svc_ids, v_svc_mengen, v_svc_units) as u(id, menge, unit);
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
                'kinder_gesamt', v_children,
                'leistungen', v_services
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

comment on function public.create_booking(date, date, jsonb, int, text, text, text, int, text, boolean, jsonb) is
    'E6/E10/E31/E44/E47/E48/E49: einziger Weg, eine Buchung anzulegen. Mehrere Kategorien, Belegung als Gesamtzahl, Fruehstueck und Zusatzleistungen je Vorgang.';

revoke all on function public.create_booking(date, date, jsonb, int, text, text, text, int, text, boolean, jsonb) from public;
grant execute on function public.create_booking(date, date, jsonb, int, text, text, text, int, text, boolean, jsonb) to anon, authenticated, service_role;
