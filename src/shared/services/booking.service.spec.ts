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
