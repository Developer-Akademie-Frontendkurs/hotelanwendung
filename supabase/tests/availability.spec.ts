import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';
import { createFixture, isoDay, type Fixture } from './helpers/fixtures';

/**
 * Die vier Fälle aus dem „Fertig, wenn" der Phase 5 — plus die Maskierung aus E28.
 *
 * Die Kapazitätsformel (schema.md, Abschnitt 3) lautet:
 *
 *   kapazität = aktive Zimmer − an dieser Nacht gesperrte Zimmer          (E18)
 *   frei      = kapazität − blockierende Buchungen dieser Nacht           (E11)
 *
 * Getestet wird sie über `availability_nights` (rohe Zahlen, Admin-Sicht) und über
 * `availability_calendar` (maskierte Gästesicht). Beide lesen dieselbe Regel — genau
 * das ist der Punkt der Aufteilung.
 */

type NightRow = {
    night: string;
    room_type_id: string;
    fits: boolean;
    capacity: number;
    rooms_free: number;
    rate_cents: number | null;
};

type CalendarRow = {
    night: string;
    is_available: boolean;
    rooms_free: number | null;
    unavailable_reason: string | null;
};

describe('Kapazitätsformel (E11, E18)', () => {
    let fixture: Fixture;
    const NIGHT = isoDay(20);
    const NEXT = isoDay(21);
    const bookingIds: string[] = [];

    beforeAll(async () => {
        // 3 Zimmer, Preise für die nächsten 60 Nächte.
        fixture = await createFixture({ roomCount: 3, maxOccupancy: 2, withRatePlan: true, withCustomer: true });

        await serviceClient.from('room_type_rates').insert({
            room_type_id: fixture.roomTypeId,
            rate_plan_id: fixture.ratePlanId,
            valid_from: isoDay(0),
            valid_to: isoDay(60),
            amount_cents: 12000,
        });

        // 3 blockierende Buchungen in EINER Nacht, ohne zugewiesenes Zimmer —
        // die Kategorie ist damit ausgebucht.
        for (let i = 0; i < 3; i += 1) {
            const { data } = await serviceClient
                .from('bookings')
                .insert({
                    customer_id: fixture.customerId,
                    room_type_id: fixture.roomTypeId,
                    rate_plan_id: fixture.ratePlanId,
                    check_in: NIGHT,
                    check_out: NEXT,
                    adults: 2,
                    total_amount_cents: 12000,
                })
                .select('id')
                .single();
            bookingIds.push(data?.id as string);
        }
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    async function nightRow(): Promise<NightRow> {
        const { data, error } = await serviceClient.rpc('availability_nights', {
            p_hotel_id: fixture.hotelId,
            p_from: NIGHT,
            p_to: NEXT,
            p_adults: 2,
            p_room_type_id: fixture.roomTypeId,
        });
        expect(error).toBeNull();
        return (data as NightRow[])[0] as NightRow;
    }

    it('Fall 1: 3 Zimmer, 3 blockierende Buchungen → rooms_free = 0', async () => {
        const row = await nightRow();
        expect(row.capacity).toBe(3);
        expect(row.rooms_free).toBe(0);
    });

    it('Fall 1b: der Gast sieht die Nacht als nicht verfügbar', async () => {
        const { data, error } = await anonClient.rpc('availability_calendar', {
            p_from: NIGHT,
            p_to: NEXT,
            p_adults: 2,
            p_room_type_id: fixture.roomTypeId,
            p_hotel_id: fixture.hotelId,
        });
        expect(error).toBeNull();
        const row = (data as CalendarRow[])[0] as CalendarRow;
        expect(row.is_available).toBe(false);
        // Kein `ausgebucht` nach außen (E28) …
        expect(row.unavailable_reason).toBe('nicht_buchbar');
        // … und keine Zahl, aus der sich `ausgebucht` von `kein_preis`
        // zurückrechnen ließe. Sonst wäre die Maskierung des Grundes wirkungslos.
        expect(row.rooms_free).toBeNull();
    });

    it('Fall 2: eine Buchung storniert → rooms_free = 1 (E11)', async () => {
        await serviceClient
            .from('bookings')
            .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
            .eq('id', bookingIds[0] as string);

        const row = await nightRow();
        expect(row.rooms_free).toBe(1);

        // Und die Nacht ist für den Gast wieder buchbar.
        const { data } = await anonClient.rpc('availability_calendar', {
            p_from: NIGHT,
            p_to: NEXT,
            p_adults: 2,
            p_room_type_id: fixture.roomTypeId,
            p_hotel_id: fixture.hotelId,
        });
        const calendar = (data as CalendarRow[])[0] as CalendarRow;
        expect(calendar.is_available).toBe(true);
        expect(calendar.rooms_free).toBe(1);
    });

    it('Fall 3: ein Zimmer der Kategorie gesperrt → rooms_free um 1 kleiner (E18)', async () => {
        await serviceClient.from('room_blocks').insert({
            room_id: fixture.roomIds[0],
            starts_on: NIGHT,
            ends_on: NEXT,
            reason: 'defekt',
        });

        const row = await nightRow();
        // Die Sperrung senkt die KAPAZITÄT, nicht die Belegung.
        expect(row.capacity).toBe(2);
        expect(row.rooms_free).toBe(0);
    });

    it('Fall 3b: eine Sperrung darf die Kapazität ins Negative drücken (E18)', async () => {
        // Die Storno aus Fall 2 zurücknehmen: 3 Buchungen, 2 Zimmer Kapazität.
        await serviceClient
            .from('bookings')
            .update({ status: 'confirmed', cancelled_at: null })
            .eq('id', bookingIds[0] as string);

        const row = await nightRow();
        // −1 ist kein Rechenfehler, sondern die Meldung einer Überbuchung an den
        // Betrieb. Das Zimmer IST kaputt — die Datenbank darf diese Tatsache nicht
        // ablehnen, aber sie muss sie sichtbar machen.
        expect(row.rooms_free).toBe(-1);
    });
});

describe('Fall 4: Nacht ohne Preiszeile (E25)', () => {
    let fixture: Fixture;
    // Innerhalb des Horizonts (365), aber außerhalb der gesetzten Preise (60).
    const NIGHT = isoDay(80);
    const NEXT = isoDay(81);

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 2, maxOccupancy: 2, withRatePlan: true });
        await serviceClient.from('room_type_rates').insert({
            room_type_id: fixture.roomTypeId,
            rate_plan_id: fixture.ratePlanId,
            valid_from: isoDay(0),
            valid_to: isoDay(60),
            amount_cents: 12000,
        });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('Zimmer sind frei, aber es gibt keinen Preis', async () => {
        const { data } = await serviceClient.rpc('availability_nights', {
            p_hotel_id: fixture.hotelId,
            p_from: NIGHT,
            p_to: NEXT,
            p_adults: 2,
            p_room_type_id: fixture.roomTypeId,
        });
        const row = (data as NightRow[])[0] as NightRow;
        expect(row.rooms_free).toBe(2);
        // NULL, nicht 0. Ein Preis von 0 wäre die gefährlichste Antwort von allen:
        // die Buchung ginge durch und der Aufenthalt wäre gratis.
        expect(row.rate_cents).toBeNull();
    });

    it('ist nicht buchbar — und der Gast erfährt nicht, warum', async () => {
        const { data } = await anonClient.rpc('availability_calendar', {
            p_from: NIGHT,
            p_to: NEXT,
            p_adults: 2,
            p_room_type_id: fixture.roomTypeId,
            p_hotel_id: fixture.hotelId,
        });
        const row = (data as CalendarRow[])[0] as CalendarRow;
        expect(row.is_available).toBe(false);
        expect(row.unavailable_reason).toBe('nicht_buchbar');
    });

    it('search_availability liefert total_amount_cents = NULL, nicht 0', async () => {
        const { data } = await anonClient.rpc('search_availability', {
            p_check_in: isoDay(79),
            p_check_out: isoDay(82),
            p_adults: 2,
            p_hotel_id: fixture.hotelId,
        });
        const row = (data as { is_bookable: boolean; total_amount_cents: number | null }[])[0];
        expect(row?.is_bookable).toBe(false);
        expect(row?.total_amount_cents).toBeNull();
    });
});

describe('Zeitgrenzen: Vergangenheit und Horizont (E30)', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, maxOccupancy: 2, withRatePlan: true });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    async function reason(offsetDays: number): Promise<string | null> {
        const { data, error } = await anonClient.rpc('availability_calendar', {
            p_from: isoDay(offsetDays),
            p_to: isoDay(offsetDays + 1),
            p_adults: 2,
            p_hotel_id: fixture.hotelId,
        });
        expect(error).toBeNull();
        return ((data as CalendarRow[])[0] as CalendarRow).unavailable_reason;
    }

    it('meldet für gestern `vergangenheit` — auch dem Gast', async () => {
        // Nicht maskiert: Dass ein vergangener Tag nicht buchbar ist, verrät nichts
        // über den Betrieb, und die generische Antwort wäre hier nur unhöflich.
        expect(await reason(-1)).toBe('vergangenheit');
    });

    it('meldet jenseits von booking_horizon_days `ausserhalb_horizont`', async () => {
        // Fixture-Horizont ist 365 Tage.
        expect(await reason(400)).toBe('ausserhalb_horizont');
    });

    it('die letzte Nacht innerhalb des Horizonts ist nicht `ausserhalb_horizont`', async () => {
        // Halb-offen: buchbar sind [heute, heute + 365). Tag 364 gehört dazu,
        // Tag 365 nicht. Ohne diesen Test wäre ein Off-by-one am Horizontrand
        // unsichtbar — er zeigt sich erst ein Jahr später.
        expect(await reason(364)).not.toBe('ausserhalb_horizont');
        expect(await reason(365)).toBe('ausserhalb_horizont');
    });
});

describe('search_availability: Aggregation und Zugang', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 2, maxOccupancy: 2, withRatePlan: true, withCustomer: true });
        await serviceClient.from('room_type_rates').insert({
            room_type_id: fixture.roomTypeId,
            rate_plan_id: fixture.ratePlanId,
            valid_from: isoDay(0),
            valid_to: isoDay(60),
            amount_cents: 10000,
        });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('summiert den Gesamtpreis über die Nächte', async () => {
        const { data, error } = await anonClient.rpc('search_availability', {
            p_check_in: isoDay(30),
            p_check_out: isoDay(33),
            p_adults: 2,
            p_hotel_id: fixture.hotelId,
        });
        expect(error).toBeNull();
        const row = (data as { nights: number; total_amount_cents: number; rooms_free: number }[])[0];
        expect(row?.nights).toBe(3);
        expect(row?.total_amount_cents).toBe(30000);
        expect(row?.rooms_free).toBe(2);
    });

    it('nimmt das MINIMUM über den Zeitraum, nicht den Durchschnitt', async () => {
        // Eine Buchung an genau einer der drei Nächte drückt das Minimum auf 1.
        // Ein Durchschnitt wäre hier ~1,67 und die Kategorie sähe freier aus, als
        // sie für den vollen Aufenthalt ist.
        await serviceClient.from('bookings').insert({
            customer_id: fixture.customerId,
            room_type_id: fixture.roomTypeId,
            rate_plan_id: fixture.ratePlanId,
            check_in: isoDay(31),
            check_out: isoDay(32),
            adults: 2,
            total_amount_cents: 10000,
        });

        const { data } = await anonClient.rpc('search_availability', {
            p_check_in: isoDay(30),
            p_check_out: isoDay(33),
            p_adults: 2,
            p_hotel_id: fixture.hotelId,
        });
        const row = (data as { rooms_free: number; is_bookable: boolean }[])[0];
        expect(row?.rooms_free).toBe(1);
        expect(row?.is_bookable).toBe(true);
    });

    it('meldet `zu_klein` maskiert, wenn die Belegung nicht passt (E15/E28)', async () => {
        const { data } = await anonClient.rpc('search_availability', {
            p_check_in: isoDay(40),
            p_check_out: isoDay(42),
            p_adults: 4,
            p_hotel_id: fixture.hotelId,
        });
        const row = (data as { is_bookable: boolean; unavailable_reason: string }[])[0];
        expect(row?.is_bookable).toBe(false);
        expect(row?.unavailable_reason).toBe('nicht_buchbar');
    });

    it('LEHNT einen leeren Zeitraum AB, statt still nichts zu liefern', async () => {
        const { error } = await anonClient.rpc('search_availability', {
            p_check_in: isoDay(10),
            p_check_out: isoDay(10),
            p_adults: 2,
            p_hotel_id: fixture.hotelId,
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('22007');
    });

    it('availability_nights ist für den Gast nicht aufrufbar (E17)', async () => {
        // Der interne Kern gibt rohe Zahlen ohne Maskierung heraus. Wäre er
        // erreichbar, wäre die gesamte Zweistufigkeit aus E28 umgehbar.
        const { error } = await anonClient.rpc('availability_nights', {
            p_hotel_id: fixture.hotelId,
            p_from: isoDay(30),
            p_to: isoDay(31),
            p_adults: 2,
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501');
    });
});
