-- Seed der lokalen Entwicklungsdatenbank (V4, Minimalseed).
--
-- Laeuft bei jedem `pnpm db:reset` nach allen Migrationen. Bewusst klein:
-- 1 Hotel, 3 Kategorien, 8 Zimmer, NULL Buchungen. Buchungen entstehen beim
-- Durchklicken und beweisen damit, dass create_booking laeuft. Tests legen ihre
-- Fixtures selbst an (E34), nicht der Seed.
--
-- Feste UUIDs, damit ein Reset reproduzierbar ist und Links auf Kategorien nach
-- jedem Reset weiter funktionieren.

insert into public.hotels (id, name, address_line1, postal_code, city, country_code, email, phone, timezone, check_in_time, check_out_time, booking_horizon_days)
values (
    '00000000-0000-4000-8000-000000000001',
    'Karawanken Hof',
    'Karawankenweg 1',
    '9535',
    'Schiefling am Woerthersee',
    'AT',
    'willkommen@karawankenhof.example',
    '+43 4274 000000',
    'Europe/Vienna',
    '15:00',
    '11:00',
    -- 365 statt der Vorgabe 540: der Seed deckt 12 Monate Preise ab (Phase 3).
    -- Ein weiterer Horizont wuerde Monate erzeugen, die im Kalender als "nicht
    -- buchbar" erscheinen - korrekt laut E25, aber nicht von einem Bug zu
    -- unterscheiden. Horizont und Preisabdeckung muessen sich decken (V4).
    365
);

insert into public.room_types (id, hotel_id, name, slug, description, max_occupancy)
values
    (
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000001',
        'Double Suite',
        'double-suite',
        'Grosszuegige Suite mit getrenntem Wohnbereich und Blick auf die Karawanken.',
        4
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        '00000000-0000-4000-8000-000000000001',
        'Double Premium',
        'double-premium',
        'Doppelzimmer mit Balkon nach Sueden.',
        3
    ),
    (
        -- Bewusst ohne Bild: "Kategorie ohne Bild" ist ein Fall, den die Oberflaeche
        -- ohnehin aushalten muss - und es gibt nur zwei Zimmerbilder im Repo (V4).
        '00000000-0000-4000-8000-000000000103',
        '00000000-0000-4000-8000-000000000001',
        'Einzelzimmer Alpin',
        'einzelzimmer-alpin',
        'Kompaktes Einzelzimmer zur ruhigen Gartenseite.',
        1
    );

-- 8 Zimmer: 3 Suiten, 3 Premium, 2 Einzelzimmer.
insert into public.rooms (hotel_id, room_type_id, room_number)
values
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '201'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '202'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '203'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '101'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '102'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '103'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', '011'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', '012');

-- Die Bilddateien selbst landen ueber `node supabase/scripts/seed-storage.mjs` im
-- Bucket - eine Migration kann keine Binaerdateien hochladen. Die Zeilen hier
-- beschreiben nur, welches Bild zu welcher Kategorie gehoert.
insert into public.room_type_images (room_type_id, storage_path, alt_text, sort_order)
values
    (
        '00000000-0000-4000-8000-000000000101',
        'double-suite.jpg',
        'Wohnbereich der Double Suite mit Sofa und bodentiefem Fenster zum Bergpanorama',
        0
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        'double-premium.jpg',
        'Doppelzimmer Premium mit Doppelbett und Balkontuer',
        0
    );

-- ---------------------------------------------------------------------------
-- Tarif und Saisonpreise (E5, V4)
-- ---------------------------------------------------------------------------

insert into public.rate_plans (id, hotel_id, code, name, description, is_default)
values (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000001',
    'STANDARD',
    'Standardtarif',
    'Flexibel stornierbar bis 14 Tage vor Anreise.',
    true
);

-- 13 Monatsblöcke ab dem aktuellen Monatsanfang — relativ zu current_date und nicht
-- mit festen Datumsangaben, damit ein Reset in sechs Monaten immer noch 12 Monate
-- abdeckt und der Kalender nicht in die Vergangenheit zeigt.
--
-- 13 statt 12: booking_horizon_days = 365 reicht vom heutigen Tag aus in den
-- 13. Monat hinein. Ein Block zu wenig wäre eine Preislücke am Horizontrand — also
-- genau der Fall, der laut E25 wie ein Bug aussieht, ohne einer zu sein.
insert into public.room_type_rates (room_type_id, rate_plan_id, valid_from, valid_to, amount_cents)
select
    basis.room_type_id,
    '00000000-0000-4000-8000-000000000201',
    monat::date,
    (monat + interval '1 month')::date,
    -- Saisonfaktor über den Kalendermonat. Ganzzahlige Cent, nie float (E8).
    round(
        basis.grundpreis_cents
        * case extract(month from monat)
            when 7 then 1.35   -- Juli
            when 8 then 1.35   -- August
            when 12 then 1.30  -- Weihnachten/Silvester
            when 2 then 1.20   -- Semesterferien / Ski
            when 5 then 1.10
            when 6 then 1.10
            when 9 then 1.10
            else 1.0
          end
    )::int
from generate_series(
        date_trunc('month', current_date),
        date_trunc('month', current_date) + interval '12 months',
        interval '1 month'
     ) as monat
cross join (
    values
        ('00000000-0000-4000-8000-000000000101'::uuid, 24000),  -- Double Suite
        ('00000000-0000-4000-8000-000000000102'::uuid, 16500),  -- Double Premium
        ('00000000-0000-4000-8000-000000000103'::uuid, 9500)    -- Einzelzimmer Alpin
) as basis (room_type_id, grundpreis_cents);

-- ---------------------------------------------------------------------------
-- Zusatzleistungen (E47)
-- ---------------------------------------------------------------------------
--
-- Das Fruehstueck ist die erste Zeile in `services` und damit der Beleg, dass der
-- Zusatz Daten sind und keine Schemaaenderung: Ein zweiter Zusatz (Zustellbett,
-- Kinderbett) ist ein weiteres INSERT, keine Migration.
insert into public.services (id, hotel_id, code, name, charge_basis, amount_cents, child_amount_cents)
values (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000001',
    'BREAKFAST',
    'Frühstück',
    -- Pro Person und Nacht: gefruehstueckt wird am Morgen nach jeder gebuchten Nacht.
    'per_person_night',
    1700,
    -- Kinder zur Haelfte. NULL waere "kein eigener Preis" und damit voller Preis -
    -- der Rabatt steht hier als Zahl, nicht als Regel im Quelltext.
    850
);
