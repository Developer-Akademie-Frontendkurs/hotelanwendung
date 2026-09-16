-- create_booking() bucht das Fruehstueck mit (E47).
--
-- Der Aufschlag wird HIER gerechnet, nicht im Browser. Sonst zeigte der Checkout eine
-- Summe, die in der angelegten Buchung nicht steht - der Gast saehe den Rechenfehler
-- erst auf der Bestaetigung (E6, Leitsatz 1).

-- ---------------------------------------------------------------------------
-- mask_reason: ein Grund mehr hinter der Maske (E28)
-- ---------------------------------------------------------------------------
--
-- "Fuer dieses Hotel ist keine Fruehstuecksleistung hinterlegt" ist eine Aussage ueber
-- unsere Konfiguration, nicht ueber die Verfuegbarkeit - also dieselbe Behandlung wie
-- kein_preis: Mitarbeitende sehen den Grund, Gaeste sehen 'nicht_buchbar'.
create or replace function public.mask_reason(reason text) returns text
language sql
stable
set search_path = ''
as $$
select case
    when reason is null then null
    when public.is_staff() then reason
    when reason in ('ausgebucht', 'kein_preis', 'zu_klein', 'leistung_unbekannt') then 'nicht_buchbar'
    else reason
end;
$$;

-- ---------------------------------------------------------------------------
-- reject_booking: der neue Code bekommt seinen Satz (E31)
-- ---------------------------------------------------------------------------
create or replace function public.reject_booking(p_code text, p_date date default null)
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
        when 'zu_klein' then 'Die Kategorie ist fuer diese Belegung zu klein.'
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
              detail = jsonb_build_object('code', v_code, 'datum', p_date, 'grund', v_grund)::text;
end;
$$;

revoke all on function public.reject_booking(text, date) from public;
revoke all on function public.reject_booking(text, date) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_booking(): ein Parameter mehr
-- ---------------------------------------------------------------------------
--
-- Die alte Signatur wird GEDROPPT, nicht ueberladen: Zwei Funktionen mit gleichem
-- Namen, deren Argumentlisten sich nur um einen Parameter mit Default unterscheiden,
-- machen jeden bisherigen Aufruf mehrdeutig ("function is not unique") - PostgREST
-- bekaeme dann einen Fehler statt einer Buchung.
--
-- p_with_breakfast gilt fuer ALLE Zimmer dieses Aufrufs, also fuer eine Kategorie.
-- Genau das ist die Granularitaet der Checkbox auf der Zimmerkarte. Sobald E44
-- p_room_type_id/p_rooms durch p_positions jsonb ersetzt, wandert der Wert als Feld
-- in die Position - der Weg, den E45 fuer die Belegung je Position schon beschreibt.
-- Fruehstueck je EINZELNEM Zimmer waere dagegen der teure Umbau nach booking_items
-- (E20/E27) und wird hier nicht vorbereitet.
drop function if exists public.create_booking(date, date, uuid, int, text, text, text, int, text, int);

create or replace function public.create_booking(
    p_check_in date,
    p_check_out date,
    p_room_type_id uuid,
    p_adults int,
    p_email text,
    p_first_name text,
    p_last_name text,
    p_children int default 0,
    p_phone text default null,
    p_rooms int default 1,
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
    v_total int := 0;
    v_naechte int;
    v_nacht record;
    v_bookings jsonb := '[]'::jsonb;
    v_row record;
    i int;
    -- Zusatzleistungen (E47)
    v_children int := coalesce(p_children, 0);
    v_service_id uuid;
    v_unit_adult int;
    v_unit_child int;
    v_extra_adult int := 0;
    v_extra_child int := 0;
    v_extras int := 0;
begin
    -- 0. Eingaben, die gar keine Anfrage sind
    if p_check_out <= p_check_in then
        perform public.reject_booking('ungueltiger_zeitraum', p_check_in);
    end if;
    if p_adults < 1 or v_children < 0 or p_rooms < 1 then
        perform public.reject_booking('ungueltige_belegung', p_check_in);
    end if;
    if p_email is null or position('@' in p_email) = 0 then
        raise exception 'E-Mail-Adresse fehlt oder ist ungueltig' using errcode = '22023';
    end if;

    select rt.hotel_id into v_hotel_id
    from public.room_types rt
    where rt.id = p_room_type_id and rt.archived_at is null;

    if v_hotel_id is null then
        perform public.reject_booking('kategorie_unbekannt', p_check_in);
    end if;

    -- 1. Advisory-Lock, HOTELWEIT (E10, E33)
    --
    -- Ab hier laeuft kein zweiter Buchungsvorgang dieses Hotels parallel. Der Lock
    -- gilt bis zum Ende der Transaktion (xact) und muss nicht freigegeben werden -
    -- auch nicht im Fehlerfall.
    --
    -- Warum nicht feiner, etwa pro Kategorie: Eine Buchung ueber mehrere Kategorien
    -- (E20/E27) muesste dann mehrere Locks in garantiert sortierter Reihenfolge
    -- halten, sonst verklemmen sich zwei gleichzeitige Gruppenbuchungen. Bei einem
    -- Hotel dieser Groesse ist der Durchsatz belanglos, der Deadlock aber real.
    perform pg_advisory_xact_lock(hashtext('booking:' || v_hotel_id::text));

    select h.booking_horizon_days into v_horizon from public.hotels h where h.id = v_hotel_id;

    select rp.id into v_rate_plan_id
    from public.rate_plans rp
    where rp.hotel_id = v_hotel_id and rp.is_default and rp.archived_at is null;

    if v_rate_plan_id is null then
        perform public.reject_booking('kein_preis', p_check_in);
    end if;

    -- 2./3. Pruefung Nacht fuer Nacht — aus DERSELBEN Quelle, die auch die
    -- Ergebnisliste und den Kalender fuettert (availability_nights). Zwei
    -- Implementierungen derselben Regel waeren die eigentliche Fehlerquelle.
    v_naechte := 0;
    for v_nacht in
        select *
        from public.availability_nights(v_hotel_id, p_check_in, p_check_out, p_adults, v_children, p_room_type_id)
        order by night
    loop
        v_naechte := v_naechte + 1;

        -- Reihenfolge wie im Kalender: zeitlich Unmoegliches vor Fachlichem.
        if v_nacht.night < current_date then
            perform public.reject_booking('vergangenheit', v_nacht.night);
        elsif v_nacht.night >= current_date + v_horizon then
            perform public.reject_booking('ausserhalb_horizont', v_nacht.night);
        elsif not v_nacht.fits then
            perform public.reject_booking('zu_klein', v_nacht.night);
        elsif v_nacht.rooms_free < p_rooms then
            -- 4. Der strukturierte Fehler nennt die ERSTE Nacht, an der es scheitert.
            perform public.reject_booking('ausgebucht', v_nacht.night);
        elsif v_nacht.rate_cents is null then
            -- Niemals Preis 0 (E25): eine fehlende Preiszeile ist keine Gratisnacht.
            perform public.reject_booking('kein_preis', v_nacht.night);
        end if;

        v_total := v_total + v_nacht.rate_cents;
    end loop;

    if v_naechte = 0 then
        perform public.reject_booking('ungueltiger_zeitraum', p_check_in);
    end if;

    -- 4b. Zusatzleistung Fruehstueck (E47)
    --
    -- Anzahl der Fruehstuecke = Anzahl der NAECHTE: gefruehstueckt wird am Morgen nach
    -- jeder Nacht, das letzte am Abreisetag. Dieselbe Zahl wie die booking_nights -
    -- und damit keine zweite Zaehlung, die auseinanderlaufen koennte.
    if p_with_breakfast then
        select s.id, s.amount_cents, coalesce(s.child_amount_cents, s.amount_cents)
        into v_service_id, v_unit_adult, v_unit_child
        from public.services s
        where s.hotel_id = v_hotel_id
          and s.code = 'BREAKFAST'
          and s.archived_at is null;

        -- Kein Eintrag heisst nicht "gratis": Ein Fruehstueck zum Preis 0 waere hier
        -- dieselbe gefaehrliche Antwort wie ein Gesamtpreis von 0 bei fehlender
        -- Preiszeile (E25).
        if v_service_id is null then
            perform public.reject_booking('leistung_unbekannt', p_check_in);
        end if;

        v_extra_adult := v_naechte * p_adults * v_unit_adult;
        v_extra_child := v_naechte * v_children * v_unit_child;
        v_extras := v_extra_adult + v_extra_child;
    end if;

    -- 5. Kunde: ueber email_normalized finden oder anlegen (E26, E32).
    --
    -- Kein Update auf Namen und Telefon bei einem bestehenden Kunden: Wer zum
    -- zweiten Mal bucht, soll nicht versehentlich seinen Datensatz ueberschreiben,
    -- nur weil er den Vornamen anders getippt hat. Aenderungen an Stammdaten sind
    -- ein eigener Vorgang.
    select c.id into v_customer_id
    from public.customers c
    where c.email_normalized = lower(p_email);

    if v_customer_id is null then
        insert into public.customers (email, first_name, last_name, phone)
        values (p_email, p_first_name, p_last_name, p_phone)
        returning id into v_customer_id;
    end if;

    -- 6.-8. Buchung(en), Naechte und Historie — alles in DIESER Transaktion.
    if p_rooms > 1 then
        -- Bewusst nur bei mehreren Zimmern (E27): Eine Gruppe von eins ist keine
        -- Gruppe, und die Tabelle soll nicht stillschweigend zum Vorgang werden.
        insert into public.booking_groups default values returning id into v_group_id;
    end if;

    for i in 1..p_rooms loop
        insert into public.bookings (
            customer_id, room_type_id, rate_plan_id, booking_group_id,
            check_in, check_out, adults, children, total_amount_cents, extras_amount_cents
        )
        values (
            v_customer_id, p_room_type_id, v_rate_plan_id, v_group_id,
            p_check_in, p_check_out, p_adults, v_children, v_total, v_extras
        )
        returning id into v_booking_id;

        -- 7. Preis pro Nacht EINFRIEREN (E21). Ab hier aendert eine Anpassung der
        -- Saisonpreise nichts mehr an dieser Buchung - eine Buchung ist ein Vertrag.
        insert into public.booking_nights (booking_id, night, amount_cents)
        select v_booking_id, an.night, an.rate_cents
        from public.availability_nights(v_hotel_id, p_check_in, p_check_out, p_adults, v_children, p_room_type_id) an;

        -- 7b. Zusatzleistungen ebenso einfrieren (E21, E47). Getrennte Zeilen fuer
        -- Erwachsene und Kinder - es sind zwei Preise und damit zwei Positionen.
        if p_with_breakfast then
            insert into public.booking_extras (booking_id, service_id, guest_kind, quantity, unit_amount_cents, amount_cents)
            select v_booking_id, v_service_id, 'adult', v_naechte * p_adults, v_unit_adult, v_extra_adult
            union all
            select v_booking_id, v_service_id, 'child', v_naechte * v_children, v_unit_child, v_extra_child
            where v_children > 0;
        end if;

        -- 8. Historie (E12)
        insert into public.booking_events (booking_id, event_type, payload, actor_kind, actor_user_id)
        values (
            v_booking_id,
            'created',
            jsonb_build_object('zimmer_gesamt', p_rooms, 'gruppe', v_group_id, 'fruehstueck', p_with_breakfast),
            -- Der Weg durch diese Funktion IST der Gastweg (E6). Ereignisse mit
            -- actor_kind 'staff' oder 'system' entstehen an anderen Stellen.
            'customer',
            auth.uid()
        );

        select b.id, b.booking_reference, b.check_in, b.check_out, b.total_amount_cents,
               b.extras_amount_cents, b.grand_total_cents, b.currency, b.room_type_id, b.status
        into v_row
        from public.bookings b where b.id = v_booking_id;

        v_bookings := v_bookings || jsonb_build_object(
            'id', v_row.id,
            'booking_reference', v_row.booking_reference,
            'check_in', v_row.check_in,
            'check_out', v_row.check_out,
            'nights', v_naechte,
            -- total_amount_cents ist weiterhin der ZIMMERPREIS. Was der Gast zahlt,
            -- steht in grand_total_cents - der Name, der keine Verwechslung zulaesst.
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
        'total_amount_cents', v_total * p_rooms,
        'extras_amount_cents', v_extras * p_rooms,
        'grand_total_cents', (v_total + v_extras) * p_rooms,
        'nights', v_naechte
    );
end;
$$;

comment on function public.create_booking(date, date, uuid, int, text, text, text, int, text, int, boolean) is
    'E6/E10/E31/E47: einziger Weg, eine Buchung anzulegen. Hotelweiter Advisory-Lock, strukturierte Ablehnung, Zusatzleistungen.';

-- Gaeste duerfen buchen - das ist der Sinn der Funktion. Sie duerfen aber weiterhin
-- nicht direkt in `bookings` schreiben (keine Insert-Policy, Phase 4).
revoke all on function public.create_booking(date, date, uuid, int, text, text, text, int, text, int, boolean) from public;
grant execute on function public.create_booking(date, date, uuid, int, text, text, text, int, text, int, boolean) to anon, authenticated, service_role;
