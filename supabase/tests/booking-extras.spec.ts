import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';
import { createFixture, isoDay, type Fixture } from './helpers/fixtures';

/**
 * Zusatzleistungen (E47) — die Ergänzung zu Test 6 aus E34.
 *
 * Geprüft wird genau das, was die Entscheidung trägt: Der Aufschlag entsteht in der
 * Datenbank (nicht im Browser), er steht als eigener Posten neben dem Zimmerpreis
 * (nicht darin), und er ist eingefroren wie jede andere Zahl an einer Buchung (E21).
 *
 * Gebucht wird mit dem `anonClient`: create_booking ist der Gastweg (E6).
 */

type BookingResult = {
    booking_group_id: string | null;
    bookings: { id: string; total_amount_cents: number; extras_amount_cents: number; grand_total_cents: number }[];
    total_amount_cents: number;
    extras_amount_cents: number;
    grand_total_cents: number;
    nights: number;
};

type ExtraRow = { guest_kind: string; quantity: number; unit_amount_cents: number; amount_cents: number };

type RejectDetail = { code: string; datum: string | null; grund: string };

const NIGHT_CENTS = 10000;
const BREAKFAST_CENTS = 1700;
const BREAKFAST_CHILD_CENTS = 850;

function mailOf(fixture: Fixture): string {
    return `extras.${fixture.roomTypeId.slice(0, 8)}@muster.test`;
}

async function book(fixture: Fixture, overrides: Record<string, unknown> = {}) {
    return anonClient.rpc('create_booking', {
        p_check_in: isoDay(30),
        p_check_out: isoDay(33),
        p_room_type_id: fixture.roomTypeId,
        p_adults: 2,
        p_children: 1,
        p_email: mailOf(fixture),
        p_first_name: 'Anna',
        p_last_name: 'Beispiel',
        ...overrides,
    });
}

async function withRates(fixture: Fixture): Promise<void> {
    const { error } = await serviceClient.from('room_type_rates').insert({
        room_type_id: fixture.roomTypeId,
        rate_plan_id: fixture.ratePlanId,
        valid_from: isoDay(0),
        valid_to: isoDay(60),
        amount_cents: NIGHT_CENTS,
    });
    expect(error).toBeNull();
}

/** Legt das Frühstück für das Hotel der Fixture an und gibt die `services.id` zurück. */
async function withBreakfast(fixture: Fixture, childCents: number | null = BREAKFAST_CHILD_CENTS): Promise<string> {
    const { data, error } = await serviceClient
        .from('services')
        .insert({
            hotel_id: fixture.hotelId,
            code: 'BREAKFAST',
            name: 'Frühstück',
            charge_basis: 'per_person_night',
            amount_cents: BREAKFAST_CENTS,
            child_amount_cents: childCents,
        })
        .select('id')
        .single();
    expect(error).toBeNull();
    return (data as { id: string }).id;
}

async function extrasOf(bookingId: string): Promise<ExtraRow[]> {
    const { data } = await serviceClient.from('booking_extras').select('guest_kind, quantity, unit_amount_cents, amount_cents').eq('booking_id', bookingId).order('guest_kind');
    return (data ?? []) as ExtraRow[];
}

async function cleanup(fixture: Fixture): Promise<void> {
    const { data } = await serviceClient.from('customers').select('id').eq('email_normalized', mailOf(fixture));
    const customerId = (data as { id: string }[] | null)?.[0]?.id;
    if (customerId !== undefined) {
        const { data: bookings } = await serviceClient.from('bookings').select('id').eq('customer_id', customerId);
        const ids = ((bookings ?? []) as { id: string }[]).map((row) => row.id);
        if (ids.length > 0) {
            // booking_extras und booking_nights hängen mit CASCADE an der Buchung —
            // hier trotzdem ausgeschrieben, weil der Service-Client RLS umgeht und
            // ein vergessener Rest die Kapazitätsrechnung des nächsten Tests trifft.
            await serviceClient.from('booking_extras').delete().in('booking_id', ids);
            await serviceClient.from('booking_nights').delete().in('booking_id', ids);
            await serviceClient.from('booking_events').delete().in('booking_id', ids);
            await serviceClient.from('bookings').delete().in('id', ids);
        }
        await serviceClient.from('customers').delete().eq('id', customerId);
    }
    await serviceClient.from('services').delete().eq('hotel_id', fixture.hotelId);
    await fixture.cleanup();
}

describe('Frühstück als eigener Posten (E47)', () => {
    let fixture: Fixture;
    let serviceId: string;
    let result: BookingResult;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 2, maxOccupancy: 4, withRatePlan: true });
        await withRates(fixture);
        serviceId = await withBreakfast(fixture);

        const { data, error } = await book(fixture, { p_with_breakfast: true });
        expect(error).toBeNull();
        result = data as BookingResult;
    });

    afterAll(async () => {
        await cleanup(fixture);
    });

    it('lässt den Zimmerpreis unberührt und weist den Aufschlag daneben aus', () => {
        // Das ist der Kern der Entscheidung: `total_amount_cents` bedeutet weiterhin
        // "Summe der Nächte". Wäre das Frühstück eingerechnet, hätte diese Zahl
        // stillschweigend ihre Bedeutung geändert — und jede bestehende Abfrage mit ihr.
        expect(result.nights).toBe(3);
        expect(result.total_amount_cents).toBe(3 * NIGHT_CENTS);
        expect(result.extras_amount_cents).toBe(3 * 2 * BREAKFAST_CENTS + 3 * 1 * BREAKFAST_CHILD_CENTS);
        expect(result.grand_total_cents).toBe(result.total_amount_cents + result.extras_amount_cents);
    });

    it('rechnet ein Frühstück pro Nacht, nicht pro Tag', async () => {
        const rows = await extrasOf(result.bookings[0]?.id ?? '');

        // Drei Nächte heißen drei Frühstücke je Person — das letzte am Abreisetag.
        // Dieselbe Zahl wie die booking_nights: keine zweite Zählung, die
        // auseinanderlaufen könnte.
        expect(rows).toEqual([
            { guest_kind: 'adult', quantity: 6, unit_amount_cents: BREAKFAST_CENTS, amount_cents: 6 * BREAKFAST_CENTS },
            { guest_kind: 'child', quantity: 3, unit_amount_cents: BREAKFAST_CHILD_CENTS, amount_cents: 3 * BREAKFAST_CHILD_CENTS },
        ]);
    });

    it('hält Erwachsene und Kinder als getrennte Positionen', async () => {
        const rows = await extrasOf(result.bookings[0]?.id ?? '');

        // Zwei Preise sind zwei Positionen. Zusammengezogen ließe sich "2 Erwachsene
        // und 1 Kind" aus dem Betrag nicht mehr zurückrechnen.
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.guest_kind)).toEqual(['adult', 'child']);
    });

    it('friert den Preis ein — eine Preiserhöhung berührt die Buchung nicht (E21)', async () => {
        const { error } = await serviceClient.from('services').update({ amount_cents: 2500 }).eq('id', serviceId);
        expect(error).toBeNull();

        const { data } = await serviceClient.from('bookings').select('extras_amount_cents, grand_total_cents').eq('id', result.bookings[0]?.id).single();
        expect((data as { extras_amount_cents: number }).extras_amount_cents).toBe(result.extras_amount_cents);

        const rows = await extrasOf(result.bookings[0]?.id ?? '');
        expect(rows[0]?.unit_amount_cents).toBe(BREAKFAST_CENTS);

        // Zurücksetzen: die folgenden Tests dieser Datei rechnen mit dem alten Preis.
        await serviceClient.from('services').update({ amount_cents: BREAKFAST_CENTS }).eq('id', serviceId);
    });
});

describe('Frühstück: die Fälle ohne Aufschlag (E47)', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 3, maxOccupancy: 4, withRatePlan: true });
        await withRates(fixture);
        await withBreakfast(fixture);
    });

    afterAll(async () => {
        await cleanup(fixture);
    });

    it('bucht ohne Frühstück ohne Posten und ohne Aufschlag', async () => {
        const { data, error } = await book(fixture, { p_check_in: isoDay(40), p_check_out: isoDay(42) });
        expect(error).toBeNull();
        const gebucht = data as BookingResult;

        expect(gebucht.extras_amount_cents).toBe(0);
        expect(gebucht.grand_total_cents).toBe(gebucht.total_amount_cents);
        expect(await extrasOf(gebucht.bookings[0]?.id ?? '')).toHaveLength(0);
    });

    it('legt ohne Kinder nur die Erwachsenen-Position an', async () => {
        const { data, error } = await book(fixture, { p_check_in: isoDay(44), p_check_out: isoDay(46), p_children: 0, p_with_breakfast: true });
        expect(error).toBeNull();
        const gebucht = data as BookingResult;

        // Keine Zeile mit quantity 0: eine Position über nichts ist keine Position.
        const rows = await extrasOf(gebucht.bookings[0]?.id ?? '');
        expect(rows).toHaveLength(1);
        expect(rows[0]?.guest_kind).toBe('adult');
        expect(gebucht.extras_amount_cents).toBe(2 * 2 * BREAKFAST_CENTS);
    });

    it('schlägt den Aufschlag auf JEDES Zimmer des Vorgangs (E45)', async () => {
        const { data, error } = await book(fixture, { p_check_in: isoDay(48), p_check_out: isoDay(50), p_rooms: 2, p_with_breakfast: true });
        expect(error).toBeNull();
        const gebucht = data as BookingResult;

        // Die Belegung gilt pro Zimmer, also auch das Frühstück: zwei Zimmer mit je
        // 2 Erwachsenen und 1 Kind sind sechs Personen am Buffet.
        const jeZimmer = 2 * 2 * BREAKFAST_CENTS + 2 * 1 * BREAKFAST_CHILD_CENTS;
        expect(gebucht.bookings[0]?.extras_amount_cents).toBe(jeZimmer);
        expect(gebucht.extras_amount_cents).toBe(2 * jeZimmer);
    });
});

describe('Frühstück: Konfigurationslücken und Sichtbarkeit (E25, E28, E13)', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, maxOccupancy: 4, withRatePlan: true });
        await withRates(fixture);
    });

    afterAll(async () => {
        await cleanup(fixture);
    });

    it('lehnt ab, wenn für das Hotel keine Frühstücksleistung hinterlegt ist', async () => {
        // Kein Eintrag heißt NICHT "gratis". Ein Frühstück zum Preis 0 wäre dieselbe
        // gefährliche Antwort wie ein Gesamtpreis von 0 bei fehlender Preiszeile (E25).
        const { error } = await book(fixture, { p_with_breakfast: true });
        expect(error).not.toBeNull();

        const detail = JSON.parse(error?.details ?? '{}') as RejectDetail;
        // Für den Gast maskiert (E28): dass unsere Konfiguration lückenhaft ist, geht
        // ihn nichts an — `is_staff()` sähe `leistung_unbekannt`.
        expect(detail.code).toBe('nicht_buchbar');
    });

    it('bucht dieselbe Anfrage ohne Frühstück anstandslos', async () => {
        const { error } = await book(fixture, { p_check_in: isoDay(35), p_check_out: isoDay(37) });
        expect(error).toBeNull();
    });

    it('zeigt dem Gast die Preisliste, aber nicht die Posten fremder Buchungen', async () => {
        await withBreakfast(fixture);

        // Preise sind öffentlich — sie stehen an der Zimmerkarte.
        const { data: preise } = await anonClient.from('services').select('code, amount_cents').eq('hotel_id', fixture.hotelId);
        expect(preise).toHaveLength(1);

        const { data: gebucht } = await book(fixture, { p_check_in: isoDay(38), p_check_out: isoDay(39), p_with_breakfast: true });
        const bookingId = (gebucht as BookingResult).bookings[0]?.id ?? '';

        // Die Posten selbst nicht: ein Gast ohne Konto hat keine current_customer_id()
        // und bekommt damit 0 Zeilen — keinen Fehler (E13).
        const { data: fremd, error } = await anonClient.from('booking_extras').select('amount_cents').eq('booking_id', bookingId);
        expect(error).toBeNull();
        expect(fremd).toHaveLength(0);
    });
});
