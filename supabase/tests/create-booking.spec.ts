import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';
import { createFixture, isoDay, type Fixture } from './helpers/fixtures';

/**
 * Test 5 und Test 6 aus E34 — die beiden, ohne die E10 und E5 nur behauptet sind.
 *
 * Gebucht wird durchgehend mit dem `anonClient`: create_booking ist der Gastweg
 * (E6), und nur so ist belegt, dass ein Gast ohne Konto buchen kann, ohne
 * Schreibrecht auf `bookings` zu haben.
 */

type BookingResult = {
    booking_group_id: string | null;
    bookings: { id: string; booking_reference: string; total_amount_cents: number; nights: number }[];
    total_amount_cents: number;
    nights: number;
};

type RejectDetail = { code: string; datum: string | null; grund: string };

/** Liest den strukturierten Fehler aus E31 aus dem PostgREST-Fehler. */
function detailOf(error: { details?: string | null } | null): RejectDetail {
    return JSON.parse(error?.details ?? '{}') as RejectDetail;
}

async function book(fixture: Fixture, overrides: Record<string, unknown> = {}) {
    return anonClient.rpc('create_booking', {
        p_check_in: isoDay(30),
        p_check_out: isoDay(33),
        p_room_type_id: fixture.roomTypeId,
        p_adults: 2,
        p_email: `gast.${fixture.roomTypeId.slice(0, 8)}@muster.test`,
        p_first_name: 'Anna',
        p_last_name: 'Beispiel',
        ...overrides,
    });
}

/** Legt Preise für die nächsten 60 Nächte an. */
async function withRates(fixture: Fixture, amountCents = 10000): Promise<void> {
    const { error } = await serviceClient.from('room_type_rates').insert({
        room_type_id: fixture.roomTypeId,
        rate_plan_id: fixture.ratePlanId,
        valid_from: isoDay(0),
        valid_to: isoDay(60),
        amount_cents: amountCents,
    });
    expect(error).toBeNull();
}

describe('create_booking: der glückliche Pfad', () => {
    let fixture: Fixture;
    let result: BookingResult;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 2, maxOccupancy: 2, withRatePlan: true });
        await withRates(fixture, 10000);
        const { data, error } = await book(fixture);
        expect(error).toBeNull();
        result = data as BookingResult;
    });

    afterAll(async () => {
        await serviceClient
            .from('customers')
            .delete()
            .eq('email_normalized', `gast.${fixture.roomTypeId.slice(0, 8)}@muster.test`);
        await fixture.cleanup();
    });

    it('legt genau eine Buchung an, ohne Gruppe', async () => {
        expect(result.bookings).toHaveLength(1);
        // Eine Gruppe von eins ist keine Gruppe (E27).
        expect(result.booking_group_id).toBeNull();
    });

    it('rechnet drei Nächte à 10 000 ct', () => {
        expect(result.nights).toBe(3);
        expect(result.total_amount_cents).toBe(30000);
    });

    it('friert den Preis pro Nacht ein — drei Zeilen, nicht vier (E21, E29)', async () => {
        const { data } = await serviceClient.from('booking_nights').select('night, amount_cents').eq('booking_id', result.bookings[0]?.id).order('night');
        expect(data).toHaveLength(3);
        // Der Abreisetag bekommt KEINE Zeile: an ihm wird nicht geschlafen.
        expect((data as { night: string }[]).map((row) => row.night)).toEqual([isoDay(30), isoDay(31), isoDay(32)]);
    });

    it('schreibt ein `created`-Ereignis in die Historie (E12)', async () => {
        const { data } = await serviceClient.from('booking_events').select('event_type, actor_kind').eq('booking_id', result.bookings[0]?.id);
        expect(data).toHaveLength(1);
        expect((data as { event_type: string; actor_kind: string }[])[0]).toMatchObject({ event_type: 'created', actor_kind: 'customer' });
    });

    it('legt den Kunden an und erzeugt bei der ZWEITEN Buchung keinen zweiten (E26)', async () => {
        const email = `gast.${fixture.roomTypeId.slice(0, 8)}@muster.test`;

        // Zweite Buchung, andere Nächte, E-Mail in ANDERER Schreibweise. Ohne
        // email_normalized (E32) entstünde hier ein zweiter Kundendatensatz — und
        // das spätere Konto fände nur die Hälfte der eigenen Buchungen.
        const { error } = await book(fixture, {
            p_check_in: isoDay(40),
            p_check_out: isoDay(42),
            p_email: email.toUpperCase(),
        });
        expect(error).toBeNull();

        const { data } = await serviceClient.from('customers').select('id').eq('email_normalized', email);
        expect(data).toHaveLength(1);
    });

    it('erzeugt für zwei Zimmer eine Gruppe und zwei Buchungen (E20/E27)', async () => {
        const { data, error } = await book(fixture, {
            p_check_in: isoDay(50),
            p_check_out: isoDay(52),
            p_rooms: 2,
        });
        expect(error).toBeNull();
        const gruppe = data as BookingResult;
        expect(gruppe.booking_group_id).not.toBeNull();
        expect(gruppe.bookings).toHaveLength(2);
        // Zwei Buchungsnummern für zwei Zimmer — branchenüblich, und die Nummer
        // bleibt an der einzelnen Buchung (E23/E27).
        expect(gruppe.bookings[0]?.booking_reference).not.toBe(gruppe.bookings[1]?.booking_reference);
        expect(gruppe.total_amount_cents).toBe(40000);
    });
});

describe('Test 6 (E34): der eingefrorene Preis überlebt eine Preisänderung (E5)', () => {
    let fixture: Fixture;
    let bookingId: string;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, maxOccupancy: 2, withRatePlan: true });
        await withRates(fixture, 10000);
        const { data } = await book(fixture, { p_check_in: isoDay(20), p_check_out: isoDay(22) });
        bookingId = (data as BookingResult).bookings[0]?.id as string;
    });

    afterAll(async () => {
        await serviceClient
            .from('customers')
            .delete()
            .eq('email_normalized', `gast.${fixture.roomTypeId.slice(0, 8)}@muster.test`);
        await fixture.cleanup();
    });

    it('verdoppelt die Saisonpreise — und die Buchung bleibt unberührt', async () => {
        const vorher = await serviceClient.from('bookings').select('total_amount_cents').eq('id', bookingId).single();
        expect(vorher.data?.total_amount_cents).toBe(20000);

        const { error } = await serviceClient.from('room_type_rates').update({ amount_cents: 20000 }).eq('room_type_id', fixture.roomTypeId);
        expect(error).toBeNull();

        const nachher = await serviceClient.from('bookings').select('total_amount_cents').eq('id', bookingId).single();
        const nights = await serviceClient.from('booking_nights').select('amount_cents').eq('booking_id', bookingId);

        // DAS ist der Beweis, dass eine Buchung ein Vertrag ist (E5): Der Preis wird
        // festgeschrieben, nicht neu berechnet. Ohne booking_nights (E21) wäre diese
        // Eigenschaft nach der ersten Preisrunde nicht mehr nachweisbar.
        expect(nachher.data?.total_amount_cents).toBe(20000);
        expect((nights.data as { amount_cents: number }[]).map((row) => row.amount_cents)).toEqual([10000, 10000]);

        // Gegenprobe: Eine NEUE Buchung derselben Nächte kostet jetzt das Doppelte.
        const { data } = await book(fixture, { p_check_in: isoDay(25), p_check_out: isoDay(27) });
        expect((data as BookingResult).total_amount_cents).toBe(40000);
    });
});

describe('Test 5 (E34): Nebenläufigkeit auf das letzte Zimmer (E10, E33)', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        // GENAU EIN Zimmer. Zwei gleichzeitige Anfragen, ein Platz.
        fixture = await createFixture({ roomCount: 1, maxOccupancy: 2, withRatePlan: true });
        await withRates(fixture, 15000);
    });

    afterAll(async () => {
        await serviceClient
            .from('customers')
            .delete()
            .like('email_normalized', `%.${fixture.roomTypeId.slice(0, 8)}@muster.test`);
        await fixture.cleanup();
    });

    it('lässt GENAU EINE Buchung gewinnen', async () => {
        // Beide Aufrufe gehen gleichzeitig raus. Der hotelweite Advisory-Lock
        // serialisiert sie; der Zweite sieht dann rooms_free = 0.
        //
        // Ohne diesen Test ist E10 nur eine Behauptung: Ein fehlender Lock fällt im
        // Einzelbetrieb NIE auf — er fällt an dem Tag auf, an dem zwei Gäste
        // gleichzeitig klicken, und dann ist ein Zimmer doppelt verkauft.
        //
        // ACHTUNG, nachgemessen am 2026-09-02: Dieser Test allein REICHT NICHT. Mit
        // probeweise entferntem Advisory-Lock blieb er grün — zwei HTTP-Anfragen
        // überschneiden sich nicht zuverlässig genug, um die Lücke zu treffen. Der
        // Test, der die fehlende Serialisierung tatsächlich fängt, ist der folgende
        // mit sechs Anfragen. Diesen hier nicht als Absicherung missverstehen.
        const ergebnisse = await Promise.allSettled([
            book(fixture, { p_check_in: isoDay(35), p_check_out: isoDay(37), p_email: `a.${fixture.roomTypeId.slice(0, 8)}@muster.test` }),
            book(fixture, { p_check_in: isoDay(35), p_check_out: isoDay(37), p_email: `b.${fixture.roomTypeId.slice(0, 8)}@muster.test` }),
        ]);

        const antworten = ergebnisse.map((r) => (r.status === 'fulfilled' ? r.value : { data: null, error: { message: 'rejected' } }));
        const erfolge = antworten.filter((a) => a.error === null);
        const fehler = antworten.filter((a) => a.error !== null);

        expect(erfolge).toHaveLength(1);
        expect(fehler).toHaveLength(1);

        // Und die Datenbank hat wirklich nur eine blockierende Buchung.
        const { data } = await serviceClient.from('bookings').select('id, status').eq('room_type_id', fixture.roomTypeId);
        expect(data).toHaveLength(1);
    });

    it('haelt auch unter 6 gleichzeitigen Anfragen die Kapazitaet von 3 ein', async () => {
        // Der Zwei-Anfragen-Test allein wäre schwach: Er wäre auch grün, wenn die
        // beiden Aufrufe sich zeitlich gar nicht überschnitten hätten. Sechs
        // gleichzeitige Anfragen auf drei Zimmer erzeugen echte Konkurrenz — und
        // die einzig richtige Antwort ist "genau drei".
        //
        // Gegenprobe durchgeführt: Mit entferntem `pg_advisory_xact_lock` gehen ALLE
        // SECHS Buchungen durch. Dieser Test fängt die Lücke also wirklich, statt sie
        // nur zu behaupten.
        const gross = await createFixture({ roomCount: 3, maxOccupancy: 2, withRatePlan: true });
        await withRates(gross, 12000);

        const versuche = Array.from({ length: 6 }, (_, index) =>
            book(gross, {
                p_check_in: isoDay(45),
                p_check_out: isoDay(47),
                p_email: `wettlauf${String(index)}.${gross.roomTypeId.slice(0, 8)}@muster.test`,
            }),
        );
        const ergebnisse = await Promise.allSettled(versuche);
        const antworten = ergebnisse.map((r) => (r.status === 'fulfilled' ? r.value : { data: null, error: { message: 'rejected' } }));

        expect(antworten.filter((a) => a.error === null)).toHaveLength(3);
        expect(antworten.filter((a) => a.error !== null)).toHaveLength(3);

        // Die Datenbank selbst ist der Zeuge, nicht die Antwortzählung: Wäre der
        // Lock wirkungslos, stünden hier mehr als drei blockierende Buchungen.
        const { data } = await serviceClient.from('bookings').select('id').eq('room_type_id', gross.roomTypeId);
        expect(data).toHaveLength(3);

        await serviceClient
            .from('customers')
            .delete()
            .like('email_normalized', `%.${gross.roomTypeId.slice(0, 8)}@muster.test`);
        await gross.cleanup();
    });

    it('gibt der Verliererin einen strukturierten Fehler mit Datum (E31)', async () => {
        // Das Zimmer ist aus dem vorigen Test belegt.
        const { error } = await book(fixture, { p_check_in: isoDay(35), p_check_out: isoDay(37) });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('P0001');

        const detail = detailOf(error);
        // Für den Gast maskiert (E28) — aber MIT Datum, sonst kann die Oberfläche
        // nur "geht nicht" sagen und der Gast probiert blind weiter.
        expect(detail.code).toBe('nicht_buchbar');
        expect(detail.datum).toBe(isoDay(35));
        expect(detail.grund).toBeTruthy();
    });
});

describe('create_booking: Ablehnungen (E31)', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, maxOccupancy: 2, withRatePlan: true });
        await withRates(fixture, 10000);
    });

    afterAll(async () => {
        await serviceClient
            .from('customers')
            .delete()
            .eq('email_normalized', `gast.${fixture.roomTypeId.slice(0, 8)}@muster.test`);
        await fixture.cleanup();
    });

    async function reject(overrides: Record<string, unknown>): Promise<RejectDetail> {
        const { error } = await book(fixture, overrides);
        expect(error).not.toBeNull();
        return detailOf(error);
    }

    it('Vergangenheit', async () => {
        const detail = await reject({ p_check_in: isoDay(-3), p_check_out: isoDay(-1) });
        expect(detail.code).toBe('vergangenheit');
        expect(detail.datum).toBe(isoDay(-3));
    });

    it('jenseits des Buchungshorizonts', async () => {
        const detail = await reject({ p_check_in: isoDay(400), p_check_out: isoDay(402) });
        expect(detail.code).toBe('ausserhalb_horizont');
    });

    it('Belegung zu groß für die Kategorie — maskiert', async () => {
        const detail = await reject({ p_check_in: isoDay(31), p_check_out: isoDay(33), p_adults: 4 });
        expect(detail.code).toBe('nicht_buchbar');
        expect(detail.datum).toBe(isoDay(31));
    });

    it('Nacht ohne Preiszeile — maskiert, und niemals gratis (E25)', async () => {
        const detail = await reject({ p_check_in: isoDay(80), p_check_out: isoDay(82) });
        expect(detail.code).toBe('nicht_buchbar');
        expect(detail.datum).toBe(isoDay(80));
    });

    it('leerer Zeitraum', async () => {
        const detail = await reject({ p_check_in: isoDay(31), p_check_out: isoDay(31) });
        expect(detail.code).toBe('ungueltiger_zeitraum');
    });

    it('unbekannte Kategorie', async () => {
        const detail = await reject({ p_room_type_id: '00000000-0000-4000-8000-0000000000ff' });
        expect(detail.code).toBe('kategorie_unbekannt');
    });

    it('mehr Zimmer als frei', async () => {
        const detail = await reject({ p_check_in: isoDay(31), p_check_out: isoDay(33), p_rooms: 5 });
        expect(detail.code).toBe('nicht_buchbar');
    });

    it('legt bei einer Ablehnung KEINEN Kunden an — die Transaktion rollt komplett zurück', async () => {
        const email = `verworfen.${fixture.roomTypeId.slice(0, 8)}@muster.test`;
        await book(fixture, { p_check_in: isoDay(-3), p_check_out: isoDay(-1), p_email: email });

        const { data } = await serviceClient.from('customers').select('id').eq('email_normalized', email);
        // Ohne diesen Test könnten fehlgeschlagene Versuche eine Kundenkartei aus
        // Geistern erzeugen. Die Kundenanlage passiert nach der Prüfung, aber in
        // DERSELBEN Transaktion — beides zusammen macht es dicht.
        expect(data).toHaveLength(0);
    });

    it('reject_booking ist für den Gast nicht direkt aufrufbar', async () => {
        const { error } = await anonClient.rpc('reject_booking', { p_code: 'ausgebucht' });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501');
    });
});
