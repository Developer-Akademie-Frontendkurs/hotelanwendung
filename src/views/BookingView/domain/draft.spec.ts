import { describe, expect, it } from 'vitest';
import type { BookingSnapshot } from '../../../shared/types/booking.types';
import { buildBookingDraft } from './draft';

const customerDetails: BookingSnapshot['customerDetails'] = {
    customer: { firstName: 'Erika', lastName: 'Muster', email: 'erika@beispiel.at', phone: null },
    residence: { street: 'Hauptplatz', houseNumber: '12a', postalCode: '9500', city: 'Villach', countryCode: 'AT' },
    billing: null,
};

function snapshot(overrides: Partial<BookingSnapshot> = {}): BookingSnapshot {
    return {
        checkIn: new Date(2026, 5, 12),
        checkOut: new Date(2026, 5, 15),
        guests: { adults: 2, children: 1 },
        roomQuantities: { 'rt-double': 1, 'rt-single': 2 },
        breakfast: true,
        services: { CHILD_BED: 1 },
        customerDetails,
        ...overrides,
    };
}

describe('buildBookingDraft', () => {
    it('übersetzt den Zustand in die Form von create_booking', () => {
        expect(buildBookingDraft(snapshot())).toEqual({
            checkIn: '2026-06-12',
            checkOut: '2026-06-15',
            nights: 3,
            adults: 2,
            children: 1,
            positions: [
                { roomTypeId: 'rt-double', rooms: 1 },
                { roomTypeId: 'rt-single', rooms: 2 },
            ],
            withBreakfast: true,
            services: [{ code: 'CHILD_BED', quantity: 1 }],
            ...customerDetails,
        });
    });

    it('lässt Fehlendes als null stehen', () => {
        const draft = buildBookingDraft(snapshot({ checkOut: null, guests: { adults: null, children: null } }));
        expect(draft).toMatchObject({ checkIn: '2026-06-12', checkOut: null, nights: null, adults: null });
    });

    it('liest leere Kinder als „keine Kinder"', () => {
        expect(buildBookingDraft(snapshot({ guests: { adults: 2, children: null } })).children).toBe(0);
    });
});
