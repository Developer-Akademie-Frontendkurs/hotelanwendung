import { describe, expect, it } from 'vitest';
import type { BreakfastService } from './breakfast';
import type { RoomCard } from './room.interface';
import { BREAKFAST, type ExtraService } from './services';
import { buildOrderLines, getOrderTotalCents, type OrderInput } from './summary';

function room(roomTypeId: string, amountCents: number | null): RoomCard {
    return {
        roomTypeId,
        slug: roomTypeId,
        name: roomTypeId,
        description: null,
        imageUrl: null,
        imageAlt: '',
        maxOccupancy: 2,
        availability: { priceLabel: null, amountCents, currency: 'EUR', nights: 2, roomsFree: 3, isBookable: amountCents !== null, unavailableReason: null },
    };
}

function service(code: string, chargeBasis: ExtraService['chargeBasis'], unitAmountCents: number): ExtraService {
    return { code, name: code, description: null, chargeBasis, unitAmountCents, currency: 'EUR' };
}

const breakfast: BreakfastService = { serviceId: 'b', name: 'Frühstück', description: null, unitAmountCents: 1700, childUnitAmountCents: 850, currency: 'EUR' };
const services = [service('CHILD_BED', 'per_unit', 0), service('GARAGE', 'per_night', 1500), service('MASSAGE', 'per_stay', 7500)];

function input(overrides: Partial<OrderInput> = {}): OrderInput {
    return {
        rooms: [room('suite', 36600), room('premium', 29800)],
        quantities: { suite: 2 },
        nights: 2,
        occupancy: { adults: 3, children: 1 },
        breakfast,
        withBreakfast: false,
        services,
        serviceQuantities: {},
        ...overrides,
    };
}

describe('buildOrderLines', () => {
    it('rechnet Zimmer als Menge × Preis je Zimmer für den Zeitraum', () => {
        expect(buildOrderLines(input())).toEqual([{ kind: 'room', id: 'suite', name: 'suite', quantity: 2, amountCents: 73200, currency: 'EUR' }]);
    });

    it('folgt der Reihenfolge der Karten, nicht der Auswahl', () => {
        const lines = buildOrderLines(input({ quantities: { premium: 1, suite: 1 } }));
        expect(lines.map((line) => line.id)).toEqual(['suite', 'premium']);
    });

    it('nimmt Frühstück für alle Gäste und Nächte auf', () => {
        const line = buildOrderLines(input({ withBreakfast: true })).find((candidate) => candidate.kind === 'breakfast');
        expect(line).toMatchObject({ quantity: 4, amountCents: 2 * (3 * 1700 + 850) });
    });

    it('rechnet Leistungen nach ihrer Bezugsgröße', () => {
        const lines = buildOrderLines(input({ serviceQuantities: { CHILD_BED: 1, GARAGE: 1, MASSAGE: 1 } }));
        expect(lines.filter((line) => line.kind === 'service').map((line) => [line.id, line.amountCents])).toEqual([
            ['CHILD_BED', 0],
            ['GARAGE', 3000],
            ['MASSAGE', 7500],
        ]);
    });

    it('lässt Preise ohne Zeitraum offen – außer bei Leistungen, die keine Nächte brauchen', () => {
        const lines = buildOrderLines(input({ nights: null, withBreakfast: true, serviceQuantities: { GARAGE: 1, MASSAGE: 1 }, rooms: [room('suite', null)] }));
        expect(lines.map((line) => [line.id, line.amountCents])).toEqual([
            ['suite', null],
            [BREAKFAST, null],
            ['GARAGE', null],
            ['MASSAGE', 7500],
        ]);
    });
});

describe('getOrderTotalCents', () => {
    it('summiert alle Zeilen', () => {
        expect(getOrderTotalCents(buildOrderLines(input({ withBreakfast: true, serviceQuantities: { MASSAGE: 1 } })))).toBe(73200 + 11900 + 7500);
    });

    it('gibt ohne Zeilen keine Summe', () => {
        expect(getOrderTotalCents([])).toBeNull();
    });

    it('gibt keine Summe, sobald eine Zeile keinen Preis hat', () => {
        expect(getOrderTotalCents(buildOrderLines(input({ nights: null, rooms: [room('suite', null)] })))).toBeNull();
    });
});
