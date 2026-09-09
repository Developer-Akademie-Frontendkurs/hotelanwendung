-- generate_booking_reference() — menschenlesbare Buchungsnummer ab Tag 1 (E23).
--
-- 8 Zeichen aus einem Alphabet OHNE `I`, `O`, `0` und `1`. Der Grund ist nicht
-- Aesthetik: Diese Nummer wird am Telefon buchstabiert und von Hand abgetippt.
-- "I oder 1?" und "O oder 0?" sind die beiden Verwechslungen, die dabei garantiert
-- passieren - also gibt es sie nicht.
--
-- 32 Zeichen an 8 Stellen sind 1,1 Billionen Kombinationen. Die Nummer ist keine
-- fortlaufende Zahl, damit sie nicht verraet, wie viele Buchungen es gibt.

create or replace function public.generate_booking_reference() returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
    alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    candidate text;
    attempts int := 0;
begin
    loop
        candidate := '';
        for i in 1..8 loop
            candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
        end loop;

        exit when not exists (select 1 from public.bookings b where b.booking_reference = candidate);

        -- Kollisionsbehandlung. Bei 1,1 Billionen Moeglichkeiten ist das toter Code,
        -- solange die Tabelle nicht Millionen Zeilen hat - aber "statistisch
        -- unmoeglich" ist kein Fehlerbehandlungskonzept. Die Schleife bricht ab,
        -- statt endlos zu laufen.
        attempts := attempts + 1;
        if attempts >= 20 then
            raise exception 'Konnte nach % Versuchen keine freie Buchungsnummer erzeugen', attempts
                using errcode = '55000';
        end if;
    end loop;

    return candidate;
end;
$$;

comment on function public.generate_booking_reference() is
    'E23: 8 Zeichen, Alphabet ohne I O 0 1 - die Nummer wird am Telefon buchstabiert.';

-- Das UNIQUE auf bookings.booking_reference ist der eigentliche Schutz; diese
-- Funktion vermeidet nur, dass er zuschlaegt. Beim Buchen laeuft ausserdem der
-- hotelweite Advisory-Lock (E33), der gleichzeitige Einfuegungen ohnehin
-- serialisiert - eine Race Condition zwischen Pruefung und INSERT gibt es dort nicht.
revoke all on function public.generate_booking_reference() from public;
revoke all on function public.generate_booking_reference() from anon, authenticated;
