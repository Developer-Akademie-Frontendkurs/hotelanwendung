import { describe, expect, it } from 'vitest';
import type { RoomCard, RoomCardAvailability } from '../../../shared/types/catalog.types';
import { getBookingHref, readPreselectedSlug, resolvePreselection } from './preselection';

function card(slug: string, availability: Partial<RoomCardAvailability> | null): RoomCard {
    return {
        roomTypeId: `id-${slug}`,
        slug,
        name: slug,
        description: null,
        imageUrl: null,
        imageAlt: '',
        maxOccupancy: 2,
        availability:
            availability === null
                ? null
                : { priceLabel: null, amountCents: null, currency: 'EUR', nights: 2, roomsFree: 3, isBookable: true, unavailableReason: null, ...availability },
    };
}

describe('Link und Parameter', () => {
    it('baut den Link und liest den Slug wieder heraus', () => {
        const href = getBookingHref('double suite&x');
        expect(href).toBe('/buchung?zimmer=double+suite%26x');
        expect(readPreselectedSlug(href.slice(href.indexOf('?')))).toBe('double suite&x');
    });

    it('ignoriert einen fehlenden oder leeren Parameter', () => {
        expect(readPreselectedSlug('')).toBeNull();
        expect(readPreselectedSlug('?zimmer=')).toBeNull();
    });
});

describe('resolvePreselection', () => {
    it('wartet, solange es keine Verfügbarkeit gibt', () => {
        expect(resolvePreselection('suite', [card('suite', null)], {}, 8)).toEqual({ status: 'pending' });
        expect(resolvePreselection('suite', [], {}, 8)).toEqual({ status: 'pending' });
    });

    it('wählt ein Zimmer, sobald die Kategorie buchbar ist', () => {
        expect(resolvePreselection('suite', [card('double', {}), card('suite', {})], {}, 8)).toEqual({ status: 'applied', roomTypeId: 'id-suite', quantity: 1 });
    });

    it('wartet bei einer nicht buchbaren Kategorie', () => {
        expect(resolvePreselection('suite', [card('suite', { isBookable: false, roomsFree: null })], {}, 8)).toEqual({ status: 'pending' });
    });

    it('überschreibt keine Auswahl des Gastes', () => {
        expect(resolvePreselection('suite', [card('suite', {})], { 'id-double': 1 }, 8)).toEqual({ status: 'dropped' });
    });

    it('verwirft einen unbekannten Slug', () => {
        expect(resolvePreselection('unbekannt', [card('suite', {})], {}, 8)).toEqual({ status: 'dropped' });
    });
});
