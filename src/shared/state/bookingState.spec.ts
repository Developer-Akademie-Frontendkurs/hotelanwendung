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

describe('bookingState – Regeln (E3)', () => {
    function selectRoom(quantity = 1): void {
        bookingState.applySearchResult([room('double', 5)], EXTRA_SERVICES);
        bookingState.selectRoomQuantity('double', quantity);
    }

    it('ohne Zimmer kein Frühstück – das Häkchen bleibt aus', () => {
        bookingState.setBreakfast(true);
        expect(bookingState.getBreakfast()).toBe(false);
    });

    it('ohne Zimmer keine Leistungen', () => {
        bookingState.applySearchResult([room('double', 5)], EXTRA_SERVICES);
        bookingState.setServices({ PARKING: 1 });
        bookingState.setServiceQuantity(CHILD_BED, 1);
        expect(bookingState.getServices()).toEqual({});
    });

    it('nimmt das Frühstück mit dem letzten Zimmer weg – es kommt beim nächsten Zimmer nicht unbestellt zurück', () => {
        selectRoom();
        bookingState.setBreakfast(true);

        bookingState.selectRoomQuantity('double', 0);
        bookingState.selectRoomQuantity('double', 1);

        expect(bookingState.getBreakfast()).toBe(false);
    });

    it('behält Frühstück und Leistungen, solange noch ein Zimmer gewählt ist', () => {
        selectRoom(2);
        bookingState.setBreakfast(true);
        bookingState.setServices({ PARKING: 1 });

        bookingState.selectRoomQuantity('double', 1);

        expect(bookingState.getBreakfast()).toBe(true);
        expect(bookingState.getServices()).toEqual({ PARKING: 1 });
    });

    it('führt Mengen von 0 nicht als 0, sondern gar nicht', () => {
        bookingState.applySearchResult([room('double', 5), room('suite', 5)], EXTRA_SERVICES);
        bookingState.selectRoomQuantity('double', 1);
        bookingState.selectRoomQuantity('suite', 0);
        expect(bookingState.getRoomQuantities()).toEqual({ double: 1 });
        expect(bookingState.getRoomQuantity('suite')).toBe(0);

        bookingState.setServices({ PARKING: 0, [CHILD_BED]: 0 });
        expect(bookingState.getServices()).toEqual({});
    });

    it('kein Kinderbett ohne Kind – auch wenn es schon gewählt war', () => {
        bookingState.setGuests({ adults: 2, children: 1 });
        selectRoom();
        bookingState.setServiceQuantity(CHILD_BED, 1);

        bookingState.setGuests({ adults: 2, children: null });

        expect(bookingState.getServiceQuantity(CHILD_BED)).toBe(0);
    });

    it('verwirft Leistungen, die das Hotel nicht (mehr) anbietet', () => {
        bookingState.setGuests({ adults: 2, children: 0 });
        selectRoom();
        bookingState.setServices({ PARKING: 1, SAUNA: 1 });

        bookingState.applySearchResult([room('double', 5)], [service('PARKING')]);

        expect(bookingState.getServices()).toEqual({ PARKING: 1 });
    });

    it('applySearchResult senkt die Zimmer auf die Zahl der Erwachsenen – jedes Zimmer braucht einen (E48)', () => {
        bookingState.setGuests({ adults: 2, children: 0 });
        selectRoom(2);

        bookingState.setGuests({ adults: 1, children: 0 });
        const notice = bookingState.applySearchResult([room('double', 5)], EXTRA_SERVICES);

        expect(bookingState.getRoomQuantities()).toEqual({ double: 1 });
        expect(notice).not.toBeNull();
    });

    it('gibt die Mengen als Kopie heraus', () => {
        selectRoom();
        // Was der Aufrufer am Ergebnis ändert, kommt im Store nicht an.
        Object.assign(bookingState.getRoomQuantities(), { double: 5 });
        expect(bookingState.getRoomQuantity('double')).toBe(1);
    });

    it('reset leert den ganzen Entwurf und meldet es', () => {
        bookingState.setDates(new Date(2026, 5, 12), new Date(2026, 5, 15));
        bookingState.setGuests({ adults: 2, children: 1 });
        selectRoom();
        bookingState.setBreakfast(true);
        bookingState.setServices({ PARKING: 1 });

        const listener = vi.fn();
        const unsubscribe = bookingState.subscribe(listener);
        bookingState.reset();
        unsubscribe();

        expect(listener).toHaveBeenCalled();
        expect(bookingState.getSnapshot()).toEqual({
            checkIn: null,
            checkOut: null,
            guests: { adults: null, children: null },
            roomQuantities: {},
            breakfast: false,
            services: {},
            customerDetails: bookingState.getCustomerDetails(),
        });
        expect(bookingState.getExtraServices()).toEqual([]);
    });

    it('meldet sich nach unsubscribe nicht mehr', () => {
        const listener = vi.fn();
        bookingState.subscribe(listener)();
        bookingState.setGuests({ adults: 1, children: null });
        expect(listener).not.toHaveBeenCalled();
    });
});
