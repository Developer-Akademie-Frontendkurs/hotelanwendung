import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabase', () => ({ supabase: { rpc } }));

const { BookingFailedError, createBooking } = await import('./booking.service');
type BookingRequest = Parameters<typeof createBooking>[0];

const address = { street: 'Hauptstraße', houseNumber: '1', postalCode: '9020', city: 'Klagenfurt', countryCode: 'AT' };
const request: BookingRequest = {
    checkIn: '2026-10-01',
    checkOut: '2026-10-03',
    adults: 2,
    children: 0,
    positions: [{ roomTypeId: 'rt-1', rooms: 1 }],
    withBreakfast: false,
    services: [],
    customer: { firstName: 'Ada', lastName: 'Gast', email: 'ada@example.com', phone: null },
    residence: address,
    billing: null,
};

async function failure(): Promise<InstanceType<typeof BookingFailedError>> {
    const error: unknown = await createBooking(request).catch((thrown: unknown): unknown => thrown);
    if (!(error instanceof BookingFailedError)) throw new Error('BookingFailedError erwartet');
    return error;
}

beforeEach((): void => {
    rpc.mockReset();
});

describe('createBooking — Ablehnung oder Fehler (V15)', () => {
    it('liefert eine Ablehnung aus reject_booking als Ergebnis', async () => {
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message: 'ausgebucht', details: JSON.stringify({ code: 'ausgebucht', datum: '2026-10-02', room_type_id: 'rt-1' }) },
        });

        await expect(createBooking(request)).resolves.toEqual({
            ok: false,
            error: { code: 'ausgebucht', date: '2026-10-02', roomTypeId: 'rt-1', message: 'ausgebucht' },
        });
    });

    it('bleibt bei einem unbekannten Code eine Ablehnung – mit code null', async () => {
        rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message: 'neu', details: JSON.stringify({ code: 'neuer_code', datum: null, room_type_id: null }) },
        });

        await expect(createBooking(request)).resolves.toEqual({
            ok: false,
            error: { code: null, date: null, roomTypeId: null, message: 'neu' },
        });
    });

    it('wirft bei einem Netzwerkfehler – das Ergebnis ist unbekannt', async () => {
        rpc.mockResolvedValue({ data: null, error: { code: '', message: 'TypeError: Failed to fetch', details: '' }, status: 0 });

        expect((await failure()).outcomeUnknown).toBe(true);
    });

    it('wirft bei einem Gateway-Fehler ohne Code – das Ergebnis ist unbekannt', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'upstream timeout', details: null }, status: 504 });

        expect((await failure()).outcomeUnknown).toBe(true);
    });

    it('wirft bei einem Datenbankfehler ohne Ablehnung – sicher nichts gebucht', async () => {
        rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'E-Mail-Adresse fehlt oder ist ungueltig', details: null }, status: 400 });

        expect((await failure()).outcomeUnknown).toBe(false);
    });

    it('wirft bei P0001 ohne lesbares DETAIL, statt es als Ablehnung auszugeben', async () => {
        rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'irgendwas', details: 'kein json' }, status: 400 });

        expect((await failure()).outcomeUnknown).toBe(false);
    });

    it('wirft bei einer unlesbaren Erfolgsantwort – die Buchung kann angelegt sein', async () => {
        rpc.mockResolvedValue({ data: { unexpected: true }, error: null, status: 200 });

        expect((await failure()).outcomeUnknown).toBe(true);
    });
});

/** Eine P0001-Antwort, wie PostgREST sie für reject_booking liefert. */
function rejectionResponse(details: string | null, message = 'Satz aus der Datenbank'): { data: null; error: { code: string; message: string; details: string | null } } {
    return { data: null, error: { code: 'P0001', message, details } };
}

describe('parseRejection – das DETAIL-JSON aus reject_booking (E31)', () => {
    it('übersetzt datum, room_type_id und grund in die Felder der Oberfläche', async () => {
        rpc.mockResolvedValue(
            rejectionResponse(JSON.stringify({ code: 'zu_klein', datum: '2026-10-01', room_type_id: 'rt-2', grund: 'Die gewaehlten Zimmer reichen nicht.' }), 'zu klein'),
        );

        await expect(createBooking(request)).resolves.toEqual({
            ok: false,
            error: { code: 'zu_klein', date: '2026-10-01', roomTypeId: 'rt-2', message: 'Die gewaehlten Zimmer reichen nicht.' },
        });
    });

    it('nimmt ohne grund die Meldung des Fehlers', async () => {
        rpc.mockResolvedValue(rejectionResponse(JSON.stringify({ code: 'ungueltige_adresse' }), 'Adresse unvollstaendig'));

        await expect(createBooking(request)).resolves.toEqual({
            ok: false,
            error: { code: 'ungueltige_adresse', date: null, roomTypeId: null, message: 'Adresse unvollstaendig' },
        });
    });

    it('setzt Felder mit falschem Typ auf null, statt sie durchzureichen', async () => {
        rpc.mockResolvedValue(rejectionResponse(JSON.stringify({ code: 'ausgebucht', datum: 20261001, room_type_id: { id: 'rt-1' }, grund: 42 }), 'ausgebucht'));

        await expect(createBooking(request)).resolves.toEqual({
            ok: false,
            error: { code: 'ausgebucht', date: null, roomTypeId: null, message: 'ausgebucht' },
        });
    });

    it.each([
        ['ohne DETAIL', null],
        ['mit leerem DETAIL', ''],
        ['mit einem Array als DETAIL', JSON.stringify([{ code: 'ausgebucht' }])],
        ['mit JSON ohne code', JSON.stringify({ datum: '2026-10-01' })],
        ['mit einem code, der kein Text ist', JSON.stringify({ code: 7 })],
        ['mit JSON null', 'null'],
    ])('wirft bei P0001 %s – das ist keine Ablehnung', async (_label: string, details: string | null) => {
        rpc.mockResolvedValue(rejectionResponse(details));

        expect((await failure()).outcomeUnknown).toBe(false);
    });

    it('wertet DETAIL nur bei P0001 aus – ein anderer Code mit Ablehnungs-JSON wirft', async () => {
        rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'check', details: JSON.stringify({ code: 'ausgebucht' }) } });

        expect((await failure()).outcomeUnknown).toBe(false);
    });
});

/** Eine Zeile aus `bookings` in der Form, die create_booking zurückgibt. */
function bookingRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { id: 'b-1', booking_reference: 'KH-2026-0001', room_type_id: 'rt-1', grand_total_cents: 30000, currency: 'EUR', status: 'confirmed', ...overrides };
}

function createdResponse(data: Record<string, unknown>): { data: unknown; error: null } {
    return { data: { booking_group_id: null, bookings: [bookingRow()], nights: 3, grand_total_cents: 30000, ...data }, error: null };
}

describe('parseCreatedBooking – die Antwort von create_booking (E44)', () => {
    it('übersetzt eine Buchung in camelCase und lässt unbekannte Felder weg', async () => {
        rpc.mockResolvedValue(createdResponse({ total_amount_cents: 30000, residence_address_id: 'a-1' }));

        await expect(createBooking(request)).resolves.toEqual({
            ok: true,
            data: {
                bookingGroupId: null,
                bookings: [{ id: 'b-1', bookingReference: 'KH-2026-0001', roomTypeId: 'rt-1', grandTotalCents: 30000, currency: 'EUR' }],
                nights: 3,
                grandTotalCents: 30000,
            },
        });
    });

    it('liest einen Vorgang mit Gruppe und mehreren Zimmern', async () => {
        rpc.mockResolvedValue(
            createdResponse({
                booking_group_id: 'g-1',
                bookings: [bookingRow(), bookingRow({ id: 'b-2', booking_reference: 'KH-2026-0002', room_type_id: 'rt-2' })],
                grand_total_cents: 60000,
            }),
        );

        const result = await createBooking(request);
        expect(result.ok && result.data.bookingGroupId).toBe('g-1');
        expect(result.ok && result.data.bookings.map((booking) => booking.bookingReference)).toEqual(['KH-2026-0001', 'KH-2026-0002']);
    });

    it.each([
        ['ohne Buchungen', { bookings: [] }],
        ['ohne bookings-Array', { bookings: 'b-1' }],
        ['mit einer Gruppe, die kein Text ist', { booking_group_id: 5 }],
        ['ohne nights', { nights: undefined }],
        ['mit grand_total_cents als Text', { grand_total_cents: '30000' }],
        ['mit einer Zeile ohne Buchungsnummer', { bookings: [bookingRow({ booking_reference: undefined })] }],
        ['mit einer Zeile ohne Währung', { bookings: [bookingRow(), bookingRow({ currency: null })] }],
        ['mit einer Zeile, die kein Objekt ist', { bookings: ['b-1'] }],
    ])('wirft %s – angelegt sein kann die Buchung trotzdem', async (_label: string, data: Record<string, unknown>) => {
        rpc.mockResolvedValue(createdResponse(data));

        expect((await failure()).outcomeUnknown).toBe(true);
    });

    it('wirft bei data null ohne Fehler', async () => {
        rpc.mockResolvedValue({ data: null, error: null });

        expect((await failure()).outcomeUnknown).toBe(true);
    });
});

describe('createBooking – Parameter für create_booking (V13, E51)', () => {
    it('lässt die Rechnungsparameter ohne Rechnungsadresse ganz weg', async () => {
        rpc.mockResolvedValue(createdResponse({}));
        await createBooking(request);

        const [name, params] = rpc.mock.calls[0] as [string, Record<string, unknown>];
        expect(name).toBe('create_booking');
        expect(Object.keys(params).filter((key: string): boolean => key.startsWith('p_billing_'))).toEqual([]);
        expect(params).toMatchObject({ p_street: 'Hauptstraße', p_house_number: '1', p_country_code: 'AT', p_positions: [{ room_type_id: 'rt-1', rooms: 1 }] });
    });

    it('schickt mit Rechnungsadresse alle sechs Felder – auch eine leere Firma als null', async () => {
        rpc.mockResolvedValue(createdResponse({}));
        await createBooking({ ...request, billing: { ...address, company: null, city: 'Wien' } });

        const [, params] = rpc.mock.calls[0] as [string, Record<string, unknown>];
        expect(params).toMatchObject({
            p_billing_company: null,
            p_billing_street: 'Hauptstraße',
            p_billing_house_number: '1',
            p_billing_postal_code: '9020',
            p_billing_city: 'Wien',
            p_billing_country_code: 'AT',
        });
    });
});
