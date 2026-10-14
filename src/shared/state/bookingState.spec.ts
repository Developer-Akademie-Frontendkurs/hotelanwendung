import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomCard } from '../types/catalog.types';
import { CHILD_BED, type ExtraService } from '../../views/BookingView/services';
import { bookingState } from './bookingState';

function room(roomTypeId: string, roomsFree: number): RoomCard {
    return {
        roomTypeId,
        slug: roomTypeId,
        name: roomTypeId,
        description: null,
        imageUrl: null,
        imageAlt: '',
        maxOccupancy: 2,
        availability: { priceLabel: null, amountCents: 10000, currency: 'EUR', nights: 2, roomsFree, isBookable: true, unavailableReason: null },
    };
}

function service(code: string): ExtraService {
    return { code, name: code, description: null, chargeBasis: 'per_stay', unitAmountCents: 0, currency: 'EUR' };
}

const EXTRA_SERVICES: readonly ExtraService[] = [service(CHILD_BED), service('PARKING')];

beforeEach((): void => {
    bookingState.reset();
});

describe('bookingState – Entwurf (V10)', () => {
    it('führt Gäste und Kontaktdaten im Snapshot', () => {
        const details = bookingState.getCustomerDetails();
        const next = { ...details, customer: { ...details.customer, firstName: 'Erika' } };

        bookingState.setGuests({ adults: 2, children: null });
        bookingState.setCustomerDetails(next);

        expect(bookingState.getSnapshot()).toMatchObject({ guests: { adults: 2, children: null }, customerDetails: next });
    });

    it('gibt die Gäste als Kopie heraus', () => {
        bookingState.setGuests({ adults: 2, children: 0 });
        const guests = bookingState.getGuests();
        guests.adults = 5;
        expect(bookingState.getGuests().adults).toBe(2);
    });

    it('benachrichtigt bei jeder Änderung', () => {
        const listener = vi.fn();
        const unsubscribe = bookingState.subscribe(listener);

        bookingState.setGuests({ adults: 1, children: null });
        bookingState.setCustomerDetails(bookingState.getCustomerDetails());
        bookingState.applySearchResult([], []);
        unsubscribe();

        expect(listener).toHaveBeenCalledTimes(3);
    });

    it('setzt mit reset auch Gäste, Kontaktdaten und Kategorien zurück', () => {
        const empty = bookingState.getCustomerDetails();
        bookingState.setGuests({ adults: 2, children: 1 });
        bookingState.setCustomerDetails({ ...empty, customer: { ...empty.customer, email: 'erika@beispiel.at' } });

        bookingState.reset();

        expect(bookingState.getGuests()).toEqual({ adults: null, children: null });
        expect(bookingState.getCustomerDetails()).toEqual(empty);
        expect(bookingState.getRooms()).toEqual([]);
    });
});

describe('bookingState – Aktionen (D6)', () => {
    /** 2 Doppelzimmer, 2 Kinder mit 2 Kinderbetten, Parkplatz und Frühstück. */
    function selectFamily(): void {
        bookingState.setGuests({ adults: 2, children: 2 });
        bookingState.applySearchResult([room('double', 5)], EXTRA_SERVICES);
        bookingState.selectRoomQuantity('double', 2);
        bookingState.setBreakfast(true);
        bookingState.setServices({ [CHILD_BED]: 2, PARKING: 1 });
    }

    function countNotifications(action: () => void): number {
        const listener = vi.fn();
        const unsubscribe = bookingState.subscribe(listener);
        action();
        unsubscribe();
        return listener.mock.calls.length;
    }

    it('selectRoomQuantity senkt die Kinderbetten mit den Zimmern – mit genau einer Benachrichtigung', () => {
        selectFamily();
        expect(
            countNotifications((): void => {
                bookingState.selectRoomQuantity('double', 1);
            }),
        ).toBe(1);
        expect(bookingState.getServices()).toEqual({ [CHILD_BED]: 1, PARKING: 1 });
    });

    it('selectRoomQuantity mit 0 nimmt Frühstück und Leistungen weg', () => {
        selectFamily();
        bookingState.selectRoomQuantity('double', 0);
        expect(bookingState.getRoomQuantities()).toEqual({});
        expect(bookingState.getBreakfast()).toBe(false);
        expect(bookingState.getServices()).toEqual({});
    });

    it('setGuests senkt die Kinderbetten sofort, ohne neue Suche', () => {
        selectFamily();
        expect(
            countNotifications((): void => {
                bookingState.setGuests({ adults: 2, children: 1 });
            }),
        ).toBe(1);
        expect(bookingState.getServiceQuantity(CHILD_BED)).toBe(1);
    });

    it('applySearchResult gleicht Mengen und Leistungen ab und meldet die Anpassung', () => {
        selectFamily();
        let notice: string | null = null;
        const notifications = countNotifications((): void => {
            notice = bookingState.applySearchResult([room('double', 1)], EXTRA_SERVICES);
        });

        expect(notifications).toBe(1);
        expect(notice).not.toBeNull();
        expect(bookingState.getRoomQuantities()).toEqual({ double: 1 });
        expect(bookingState.getServices()).toEqual({ [CHILD_BED]: 1, PARKING: 1 });
        expect(bookingState.getExtraServices()).toBe(EXTRA_SERVICES);
    });

    it('applySearchResult lässt eine passende Auswahl unangetastet', () => {
        selectFamily();
        expect(bookingState.applySearchResult([room('double', 5)], EXTRA_SERVICES)).toBeNull();
        expect(bookingState.getRoomQuantities()).toEqual({ double: 2 });
        expect(bookingState.getServices()).toEqual({ [CHILD_BED]: 2, PARKING: 1 });
    });
});
