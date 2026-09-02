import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';
import { createFixture, type Fixture } from './helpers/fixtures';

/**
 * Test 3 aus E34 — der wichtigste in diesem Satz — plus die Widerspruchs-CHECKs.
 *
 * Test 3 ist der halb-offene Anschlusstag: Reist Gast A am 12. ab und Gast B am 12.
 * an, ist das EINE freie Nacht, keine Kollision. Wer hier ein geschlossenes Intervall
 * verwendet, verkauft nie eine Anschlussnacht — der teuerste Off-by-one-Fehler in
 * Buchungssystemen, und einer, der niemals eine Fehlermeldung erzeugt.
 */
describe('bookings: Zeitraeume und Zimmerbelegung', () => {
    let fixture: Fixture;
    let roomA: string;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 2, withRatePlan: true, withCustomer: true });
        roomA = fixture.roomIds[0] as string;
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    async function booking(overrides: Record<string, unknown> = {}) {
        return serviceClient
            .from('bookings')
            .insert({
                customer_id: fixture.customerId,
                room_type_id: fixture.roomTypeId,
                rate_plan_id: fixture.ratePlanId,
                check_in: '2029-04-10',
                check_out: '2029-04-12',
                adults: 2,
                total_amount_cents: 24000,
                ...overrides,
            })
            .select('id, booking_reference, stay')
            .single();
    }

    it('nimmt eine erste Buchung mit zugewiesenem Zimmer an', async () => {
        const { data, error } = await booking({ room_id: roomA, check_in: '2029-04-10', check_out: '2029-04-12' });
        expect(error).toBeNull();
        // Halb-offen: [2029-04-10, 2029-04-12) sind zwei Naechte.
        expect(data?.stay).toBe('[2029-04-10,2029-04-12)');
    });

    it('AKZEPTIERT Abreise = Anreise der naechsten Buchung im SELBEN Zimmer (Test 3, E8/E29)', async () => {
        const { error } = await booking({ room_id: roomA, check_in: '2029-04-12', check_out: '2029-04-14' });
        expect(error).toBeNull();
    });

    it('LEHNT eine echte Ueberlappung im selben Zimmer AB', async () => {
        const { error } = await booking({ room_id: roomA, check_in: '2029-04-11', check_out: '2029-04-13' });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23P01'); // exclusion_violation
    });

    it('erlaubt die Ueberlappung im ANDEREN Zimmer', async () => {
        const { error } = await booking({ room_id: fixture.roomIds[1], check_in: '2029-04-11', check_out: '2029-04-13' });
        expect(error).toBeNull();
    });

    it('erlaubt zwei ueberlappende Buchungen OHNE zugewiesenes Zimmer', async () => {
        // Das Constraint kennt nur zugewiesene Zimmer. Dass die Kategorie nicht
        // ueberbucht wird, ist NICHT seine Aufgabe, sondern die des Advisory-Locks in
        // create_booking (E10/E33) — hier wird das bewusst nicht abgefangen.
        const first = await booking({ check_in: '2029-07-01', check_out: '2029-07-05' });
        const second = await booking({ check_in: '2029-07-02', check_out: '2029-07-06' });
        expect(first.error).toBeNull();
        expect(second.error).toBeNull();
    });

    it('erlaubt eine STORNIERTE Buchung ueberlappend im selben Zimmer (E11)', async () => {
        const { error } = await booking({
            room_id: roomA,
            check_in: '2029-04-11',
            check_out: '2029-04-13',
            status: 'cancelled',
            cancelled_at: new Date('2029-01-01').toISOString(),
        });
        // Eine Storno belegt keine Kapazitaet — sonst blockierte jede abgesagte
        // Buchung das Zimmer fuer immer.
        expect(error).toBeNull();
    });

    it('LEHNT eine no_show-Buchung ueberlappend im selben Zimmer AB (E11)', async () => {
        // Gegenprobe zur Storno: Ein No-Show blockiert weiter, denn die Nacht WAR
        // verkauft. Ohne diesen Test koennte is_blocking_status alles ausser
        // 'confirmed' durchlassen und der vorige Test waere trotzdem gruen.
        const { error } = await booking({
            room_id: roomA,
            check_in: '2029-04-10',
            check_out: '2029-04-11',
            status: 'no_show',
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23P01');
    });

    it('LEHNT check_out <= check_in AB', async () => {
        const { error } = await booking({ check_in: '2029-09-01', check_out: '2029-09-01' });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514'); // check_violation
    });

    it('LEHNT adults = 0 AB', async () => {
        const { error } = await booking({ check_in: '2029-09-10', check_out: '2029-09-12', adults: 0 });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514');
    });
});

describe('bookings: Storno-Widerspruch (E11)', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, withRatePlan: true, withCustomer: true });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    async function booking(overrides: Record<string, unknown>) {
        return serviceClient.from('bookings').insert({
            customer_id: fixture.customerId,
            room_type_id: fixture.roomTypeId,
            rate_plan_id: fixture.ratePlanId,
            check_in: '2030-03-01',
            check_out: '2030-03-03',
            adults: 1,
            total_amount_cents: 10000,
            ...overrides,
        });
    }

    it('LEHNT status = cancelled OHNE cancelled_at AB', async () => {
        const { error } = await booking({ status: 'cancelled' });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514');
    });

    it('LEHNT cancelled_at bei status = confirmed AB — die andere Richtung', async () => {
        // Der CHECK ist als Gleichheit zweier Wahrheitswerte geschrieben, damit BEIDE
        // Richtungen abgedeckt sind. Ohne diesen Test faellt die zweite lautlos aus.
        const { error } = await booking({ status: 'confirmed', cancelled_at: new Date('2030-01-01').toISOString() });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514');
    });

    it('LEHNT einen unbekannten status AB', async () => {
        const { error } = await booking({ status: 'wartet_auf_zahlung' });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514');
    });
});

describe('booking_reference (E23)', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, withRatePlan: true, withCustomer: true });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('ist 8 Zeichen lang und enthaelt kein I, O, 0 oder 1', async () => {
        const { data, error } = await serviceClient
            .from('bookings')
            .insert({
                customer_id: fixture.customerId,
                room_type_id: fixture.roomTypeId,
                rate_plan_id: fixture.ratePlanId,
                check_in: '2031-02-01',
                check_out: '2031-02-04',
                adults: 2,
                total_amount_cents: 30000,
            })
            .select('booking_reference')
            .single();

        expect(error).toBeNull();
        const reference = data?.booking_reference as string;
        expect(reference).toHaveLength(8);
        // Genau das Alphabet aus E23 — die Zeichen, die am Telefon verwechselt
        // werden, kommen nicht vor.
        expect(reference).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    });
});

describe('RLS: Buchungen', () => {
    let fixture: Fixture;
    let bookingId: string;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, withRatePlan: true, withCustomer: true });
        const { data } = await serviceClient
            .from('bookings')
            .insert({
                customer_id: fixture.customerId,
                room_type_id: fixture.roomTypeId,
                rate_plan_id: fixture.ratePlanId,
                check_in: '2032-05-01',
                check_out: '2032-05-03',
                adults: 2,
                total_amount_cents: 20000,
            })
            .select('id')
            .single();
        bookingId = data?.id as string;

        await serviceClient.from('booking_nights').insert([
            { booking_id: bookingId, night: '2032-05-01', amount_cents: 10000 },
            { booking_id: bookingId, night: '2032-05-02', amount_cents: 10000 },
        ]);
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('Gast bekommt bei bookings 0 Zeilen — keinen Fehler', async () => {
        const { data, error } = await anonClient.from('bookings').select('booking_reference');
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('Gast bekommt bei booking_nights 0 Zeilen', async () => {
        const { data, error } = await anonClient.from('booking_nights').select('night');
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('Mitarbeiterpfad: der Service-Role-Key sieht die Naechte', async () => {
        // Gegenprobe zum vorigen Test. Ohne sie waeren 0 Zeilen auch dann gruen,
        // wenn die Naechte gar nicht angelegt worden waeren.
        const { data, error } = await serviceClient.from('booking_nights').select('night').eq('booking_id', bookingId);
        expect(error).toBeNull();
        expect(data).toHaveLength(2);
    });

    it('Gast darf NICHT direkt in bookings einfuegen — gebucht wird nur ueber die RPC (E6)', async () => {
        const { error } = await anonClient.from('bookings').insert({
            customer_id: fixture.customerId,
            room_type_id: fixture.roomTypeId,
            rate_plan_id: fixture.ratePlanId,
            check_in: '2032-08-01',
            check_out: '2032-08-03',
            adults: 2,
            total_amount_cents: 1,
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501'); // insufficient_privilege
    });
});

describe('booking_events: append-only (E12)', () => {
    it('LEHNT UPDATE und DELETE ab — selbst fuer den Service-Role-Key', async () => {
        // Der entscheidende Punkt: Der Service-Role-Key umgeht RLS. Waeren nur die
        // Policies weggelassen, koennte das Seed-Skript die Historie umschreiben.
        // Deshalb sind UPDATE und DELETE zusaetzlich als RECHT entzogen.
        //
        // Der Test braucht keine Zeile: Postgres prueft das Tabellenrecht, bevor es
        // ueberhaupt nach passenden Zeilen sucht. Das ist hier ein Vorteil — sonst
        // muesste der Test ein Ereignis anlegen, das er anschliessend nicht mehr
        // wegraeumen koennte (genau die Eigenschaft, um die es geht).
        const irgendeineBuchung = '00000000-0000-4000-8000-0000000009ff';

        const update = await serviceClient.from('booking_events').update({ event_type: 'manipuliert' }).eq('booking_id', irgendeineBuchung);
        expect(update.error).not.toBeNull();
        expect(update.error?.code).toBe('42501');

        const remove = await serviceClient.from('booking_events').delete().eq('booking_id', irgendeineBuchung);
        expect(remove.error).not.toBeNull();
        expect(remove.error?.code).toBe('42501');
    });

    it('erlaubt INSERT fuer den Service-Role-Key — Historie muss entstehen koennen', async () => {
        const fixture = await createFixture({ roomCount: 1, withRatePlan: true, withCustomer: true });
        const { data: booking } = await serviceClient
            .from('bookings')
            .insert({
                customer_id: fixture.customerId,
                room_type_id: fixture.roomTypeId,
                rate_plan_id: fixture.ratePlanId,
                check_in: '2033-05-01',
                check_out: '2033-05-03',
                adults: 1,
                total_amount_cents: 20000,
            })
            .select('id')
            .single();

        const { error } = await serviceClient.from('booking_events').insert({
            booking_id: booking?.id,
            event_type: 'created',
            actor_kind: 'system',
            payload: { quelle: 'test' },
        });
        expect(error).toBeNull();

        const { data: events } = await serviceClient.from('booking_events').select('event_type').eq('booking_id', booking?.id);
        expect(events).toHaveLength(1);

        // KEIN cleanup: Diese Zeilen ueberleben absichtlich bis zum naechsten
        // `pnpm db:reset`. Eine Historie, die der Test wegraeumen kann, waere keine
        // (E12) — und die Buchung dahinter haelt ON DELETE RESTRICT fest (E22).
        // Beides ist hier nicht Unsauberkeit, sondern das Ergebnis.
    });
});
