import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomAvailability, RoomTypeDetail } from '../types/catalog.types';

/** Antwort von PostgREST: `{ data, error }` – am Ende jeder Abfragekette. */
type Response = { data: unknown; error: { message: string } | null };

let response: Response = { data: null, error: null };
const rpc = vi.fn((): Promise<Response> => Promise.resolve(response));
// Die Kette `from().select().order()` bzw. `.limit().maybeSingle()` – jedes Glied liefert
// dasselbe Objekt, das letzte die Antwort.
type Query = {
    select: () => Query;
    limit: () => Query;
    order: () => Promise<Response>;
    maybeSingle: () => Promise<Response>;
};
const query: Query = {
    select: (): Query => query,
    limit: (): Query => query,
    order: (): Promise<Response> => Promise.resolve(response),
    maybeSingle: (): Promise<Response> => Promise.resolve(response),
};
const from = vi.fn((): Query => query);
type PublicUrl = { data: { publicUrl: string } };
const storage = {
    from: (bucket: string): { getPublicUrl: (path: string) => PublicUrl } => ({
        getPublicUrl: (path: string): PublicUrl => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
    }),
};
vi.mock('./supabase', () => ({ supabase: { rpc, from, storage } }));

const { buildNightAvailability, buildRoomCards, fetchAvailabilityCalendar, fetchHotel, fetchRoomTypes, fetchServices, searchAvailability } = await import('./catalog.service');

function detail(id: string, slug: string, images: RoomTypeDetail['room_type_images'] = []): RoomTypeDetail {
    return { id, name: slug, slug, description: null, max_occupancy: 2, room_type_images: images };
}

function availability(slug: string, overrides: Partial<RoomAvailability> = {}): RoomAvailability {
    return {
        room_type_id: slug,
        name: slug,
        slug,
        max_occupancy: 2,
        nights: 3,
        rooms_free: 4,
        total_amount_cents: 146400,
        currency: 'EUR',
        is_bookable: true,
        unavailable_reason: null,
        ...overrides,
    };
}

beforeEach((): void => {
    response = { data: null, error: null };
    rpc.mockClear();
    from.mockClear();
});

describe('Lesezugriffe', () => {
    it('liefern die Zeilen der Abfrage', async () => {
        response = { data: [detail('rt-1', 'double')], error: null };
        await expect(fetchRoomTypes()).resolves.toEqual([detail('rt-1', 'double')]);
        expect(from).toHaveBeenCalledWith('room_types');

        await fetchServices();
        expect(from).toHaveBeenCalledWith('services');
    });

    it('werfen bei einem Fehler der Abfrage', async () => {
        response = { data: null, error: { message: 'kaputt' } };
        await expect(fetchRoomTypes()).rejects.toThrow('kaputt');
        await expect(fetchServices()).rejects.toThrow('kaputt');
        await expect(fetchHotel()).rejects.toThrow('kaputt');
        await expect(searchAvailability({ checkIn: '2026-06-12', checkOut: '2026-06-15', adults: 2, children: 0 })).rejects.toThrow('kaputt');
    });

    it('meldet ein fehlendes Hotel als null, nicht als Fehler', async () => {
        await expect(fetchHotel()).resolves.toBeNull();
    });

    it('übersetzt die Suche in die p_*-Parameter', async () => {
        response = { data: [], error: null };
        await searchAvailability({ checkIn: '2026-06-12', checkOut: '2026-06-15', adults: 2, children: 1 });
        expect(rpc).toHaveBeenCalledWith('search_availability', { p_check_in: '2026-06-12', p_check_out: '2026-06-15', p_adults: 2, p_children: 1 });
    });
});

describe('buildRoomCards', () => {
    it('behält die Reihenfolge der Kategorien', () => {
        const cards = buildRoomCards([detail('rt-2', 'suite'), detail('rt-1', 'double')], [availability('double'), availability('suite')]);
        expect(cards.map((card) => card.roomTypeId)).toEqual(['rt-2', 'rt-1']);
    });

    it('nimmt das erste Bild nach sort_order', () => {
        const images = [
            { storage_path: 'b.jpg', alt_text: 'B', sort_order: 2 },
            { storage_path: 'a.jpg', alt_text: 'A', sort_order: 1 },
        ];
        const [card] = buildRoomCards([detail('rt-1', 'double', images)], null);
        expect(card).toMatchObject({ imageUrl: 'https://cdn.test/room-images/a.jpg', imageAlt: 'A' });
    });

    it('kommt ohne Bild aus', () => {
        const [card] = buildRoomCards([detail('rt-1', 'double')], null);
        expect(card).toMatchObject({ imageUrl: null, imageAlt: '' });
    });

    it('lässt die Verfügbarkeit ohne Suche weg', () => {
        const [card] = buildRoomCards([detail('rt-1', 'double')], null);
        expect(card?.availability).toBeNull();
    });

    it('ergänzt Preis und Restbestand aus der Suche', () => {
        const [card] = buildRoomCards([detail('rt-1', 'double')], [availability('double')]);
        expect(card?.availability).toEqual({
            priceLabel: '1.464€',
            amountCents: 146400,
            currency: 'EUR',
            nights: 3,
            roomsFree: 4,
            isBookable: true,
            unavailableReason: null,
        });
    });

    it('übernimmt nur Gründe, die die Oberfläche kennt', () => {
        const blocked = { is_bookable: false, rooms_free: null, total_amount_cents: null };
        const cards = buildRoomCards(
            [detail('rt-1', 'double'), detail('rt-2', 'suite')],
            [availability('double', { ...blocked, unavailable_reason: 'ausgebucht' }), availability('suite', { ...blocked, unavailable_reason: 'unbekannt' })],
        );
        expect(cards.map((card) => card.availability?.unavailableReason)).toEqual(['ausgebucht', null]);
        expect(cards[0]?.availability?.priceLabel).toBeNull();
    });
});

describe('Kalender (E24, V14)', () => {
    it('fragt availability_calendar mit den p_*-Parametern ab', async () => {
        response = { data: [], error: null };
        await fetchAvailabilityCalendar({ from: '2026-10-21', to: '2027-10-21', adults: 2, children: 1 });
        expect(rpc).toHaveBeenCalledWith('availability_calendar', { p_from: '2026-10-21', p_to: '2027-10-21', p_adults: 2, p_children: 1 });
    });

    it('wirft bei einem Fehler der Abfrage', async () => {
        response = { data: null, error: { message: 'kaputt' } };
        await expect(fetchAvailabilityCalendar({ from: '2026-10-21', to: '2026-10-22', adults: 1, children: 0 })).rejects.toThrow('kaputt');
    });

    it('macht aus den Zeilen eine Nachschlagetabelle je Nacht', () => {
        const nights = buildNightAvailability([
            { night: '2026-10-21', is_available: true, rooms_free: 3, unavailable_reason: null },
            { night: '2026-10-22', is_available: false, rooms_free: null, unavailable_reason: 'nicht_buchbar' },
            { night: '2026-10-23', is_available: false, rooms_free: null, unavailable_reason: 'ausserhalb_horizont' },
        ]);
        expect([...nights.entries()]).toEqual([
            ['2026-10-21', { available: true, reason: null }],
            ['2026-10-22', { available: false, reason: 'nicht_buchbar' }],
            ['2026-10-23', { available: false, reason: 'ausserhalb_horizont' }],
        ]);
    });

    it('macht einen unbekannten oder fehlenden Grund zu nicht_buchbar', () => {
        const nights = buildNightAvailability([
            { night: '2026-10-21', is_available: false, rooms_free: null, unavailable_reason: 'neuer_grund' },
            { night: '2026-10-22', is_available: false, rooms_free: null, unavailable_reason: null },
        ]);
        expect(nights.get('2026-10-21')?.reason).toBe('nicht_buchbar');
        expect(nights.get('2026-10-22')?.reason).toBe('nicht_buchbar');
    });
});
