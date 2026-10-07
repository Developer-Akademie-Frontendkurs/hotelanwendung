import { describe, expect, it } from 'vitest';
import type { RoomCard } from './room.interface';
import { clampQuantity, getMissingBeds, getRoomLimit, getRoomMax, MAX_ROOMS_PER_BOOKING, reconcileQuantities } from './roomQuantity';

function card(roomTypeId: string, maxOccupancy: number, roomsFree: number | null = 5): RoomCard {
    return {
        roomTypeId,
        slug: roomTypeId,
        name: roomTypeId,
        description: null,
        imageUrl: null,
        imageAlt: '',
        maxOccupancy,
        availability: { priceLabel: null, amountCents: null, currency: 'EUR', nights: 2, roomsFree, isBookable: true, unavailableReason: null },
    };
}

describe('getRoomLimit (E44, E48)', () => {
    it('gibt ohne Erwachsenenzahl die Vorgangsgrenze zurück', () => {
        expect(getRoomLimit(null)).toBe(MAX_ROOMS_PER_BOOKING);
    });

    it('lässt nie mehr Zimmer als Erwachsene zu', () => {
        expect(getRoomLimit(3)).toBe(3);
        expect(getRoomLimit(12)).toBe(MAX_ROOMS_PER_BOOKING);
    });
});

describe('clampQuantity mit Zimmergrenze', () => {
    it('meldet `adults`, wenn die Erwachsenen die Grenze setzen', () => {
        expect(clampQuantity(3, 5, 0, 2)).toEqual({ value: 2, limitedBy: 'adults' });
    });

    it('meldet `total`, wenn die Vorgangsgrenze greift', () => {
        expect(clampQuantity(9, 10, 0, MAX_ROOMS_PER_BOOKING)).toEqual({ value: MAX_ROOMS_PER_BOOKING, limitedBy: 'total' });
    });

    it('bevorzugt `roomsFree` bei Gleichstand', () => {
        expect(clampQuantity(3, 2, 0, 2)).toEqual({ value: 2, limitedBy: 'roomsFree' });
    });

    it('zählt andere Kategorien gegen die Grenze', () => {
        expect(getRoomMax(5, 1, 2)).toBe(1);
    });
});

describe('reconcileQuantities nach geänderter Erwachsenenzahl', () => {
    it('verringert die Auswahl auf die Zahl der Erwachsenen', () => {
        const result = reconcileQuantities({ a: 2, b: 1 }, [card('a', 2), card('b', 2)], 2);
        expect(result.quantities).toEqual({ a: 2 });
        expect(result.notice).not.toBeNull();
    });
});

describe('getMissingBeds (E48)', () => {
    const rooms = [card('double', 2), card('suite', 4)];

    it('zählt die Betten über alle gewählten Kategorien zusammen', () => {
        expect(getMissingBeds({ double: 1, suite: 1 }, rooms, 6)).toBe(0);
    });

    it('nennt die Personen ohne Bett', () => {
        expect(getMissingBeds({ double: 1 }, rooms, 5)).toBe(3);
    });

    it('wird nie negativ', () => {
        expect(getMissingBeds({ suite: 2 }, rooms, 2)).toBe(0);
    });
});
