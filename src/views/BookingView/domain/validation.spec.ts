import { describe, expect, it } from 'vitest';
import type { BookingDraft } from '../../../shared/types/booking.types';
import type { RoomCard } from '../../../shared/types/catalog.types';
import { getCheckoutError, getCompletedSteps, getCurrentStep } from './validation';

function card(roomTypeId: string, maxOccupancy: number): RoomCard {
    return {
        roomTypeId,
        slug: roomTypeId,
        name: roomTypeId,
        description: null,
        imageUrl: null,
        imageAlt: '',
        maxOccupancy,
        availability: { priceLabel: null, amountCents: null, currency: 'EUR', nights: 2, roomsFree: 5, isBookable: true, unavailableReason: null },
    };
}

const ROOMS: readonly RoomCard[] = [card('double', 2), card('single', 1)];

/** Ein vollständiger Entwurf: 2 Erwachsene im Doppelzimmer, Formular ausgefüllt. */
function draft(overrides: Partial<BookingDraft> = {}): BookingDraft {
    return {
        checkIn: '2026-06-12',
        checkOut: '2026-06-15',
        nights: 3,
        adults: 2,
        children: 0,
        positions: [{ roomTypeId: 'double', rooms: 1 }],
        withBreakfast: false,
        services: [],
        customer: { firstName: 'Erika', lastName: 'Muster', email: 'erika@beispiel.at', phone: null },
        residence: { street: 'Hauptplatz', houseNumber: '12a', postalCode: '9500', city: 'Villach', countryCode: 'AT' },
        billing: null,
        ...overrides,
    };
}

const EMPTY_FORM: Partial<BookingDraft> = {
    customer: { firstName: '', lastName: '', email: '', phone: null },
    residence: { street: '', houseNumber: '', postalCode: '', city: '', countryCode: 'AT' },
};

describe('getCheckoutError', () => {
    it('meldet nichts, wenn alles da ist', () => {
        expect(getCheckoutError(draft(), ROOMS)).toBeNull();
    });

    it('fragt zuerst nach dem Zeitraum', () => {
        expect(getCheckoutError(draft({ checkOut: null, adults: null, positions: [], ...EMPTY_FORM }), ROOMS)?.section).toBe('dates');
    });

    it('fragt dann nach den Gästen', () => {
        expect(getCheckoutError(draft({ adults: null, positions: [] }), ROOMS)?.section).toBe('guests');
    });

    it('verlangt mindestens ein Zimmer', () => {
        expect(getCheckoutError(draft({ positions: [] }), ROOMS)).toEqual({ section: 'rooms', message: 'Bitte wählen Sie mindestens ein Zimmer.' });
    });

    it('meldet fehlende Betten – Kinder zählen mit', () => {
        expect(getCheckoutError(draft({ children: 1 }), ROOMS)).toEqual({ section: 'rooms', message: 'Noch 1 Person ohne Bett – bitte ein weiteres Zimmer wählen.' });
        expect(getCheckoutError(draft({ adults: 4, children: 1 }), ROOMS)?.message).toBe('Noch 3 Personen ohne Bett – bitte weitere Zimmer wählen.');
    });

    it('zählt die Betten über mehrere Kategorien zusammen', () => {
        const positions = [
            { roomTypeId: 'double', rooms: 1 },
            { roomTypeId: 'single', rooms: 1 },
        ];
        expect(getCheckoutError(draft({ children: 1, positions }), ROOMS)).toBeNull();
    });

    it('verweist erst zuletzt auf das Formular', () => {
        expect(getCheckoutError(draft(EMPTY_FORM), ROOMS)).toEqual({ section: 'form', message: 'Bitte tragen Sie alle notwendigen Informationen ein.' });
    });
});

describe('getCompletedSteps', () => {
    it('meldet alle Schritte bei einem vollständigen Entwurf', () => {
        expect(getCompletedSteps(draft(), ROOMS)).toEqual([1, 2, 3]);
    });

    it('meldet Schritt 1 erst mit Zeitraum und Erwachsenen', () => {
        expect(getCompletedSteps(draft({ checkOut: null }), ROOMS)).not.toContain(1);
        expect(getCompletedSteps(draft({ adults: null }), ROOMS)).not.toContain(1);
    });

    it('meldet Schritt 2 nur, wenn die Betten für alle reichen', () => {
        expect(getCompletedSteps(draft({ positions: [] }), ROOMS)).not.toContain(2);
        expect(getCompletedSteps(draft({ children: 1 }), ROOMS)).not.toContain(2);
    });

    it('meldet Schritt 2 nicht, solange die Erwachsenen offen sind', () => {
        expect(getCompletedSteps(draft({ adults: null }), ROOMS)).not.toContain(2);
    });

    it('meldet Schritt 3 unabhängig von den anderen', () => {
        expect(getCompletedSteps(draft({ checkIn: null, positions: [] }), ROOMS)).toEqual([3]);
        expect(getCompletedSteps(draft(EMPTY_FORM), ROOMS)).toEqual([1, 2]);
    });
});

describe('getCurrentStep', () => {
    it('nennt den ersten offenen Schritt', () => {
        expect(getCurrentStep([])).toBe(1);
        expect(getCurrentStep([1])).toBe(2);
        expect(getCurrentStep([1, 3])).toBe(2);
    });

    it('meldet null, wenn alles erledigt ist', () => {
        expect(getCurrentStep([1, 2, 3])).toBeNull();
    });
});
