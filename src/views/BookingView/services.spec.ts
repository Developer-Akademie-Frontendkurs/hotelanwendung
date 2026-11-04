import { describe, expect, it } from 'vitest';
import { BREAKFAST, buildExtraServices, CHILD_BED, getServiceAmountCents, getServiceMax, reconcileServices, type ExtraService } from './services';
import type { ServiceRow } from '../../shared/types/booking.types';

function row(code: string, charge_basis: string, amount_cents: number, sort_order: number): ServiceRow {
    return { id: code, code, name: code, description: null, charge_basis, amount_cents, child_amount_cents: null, currency: 'EUR', sort_order };
}

const rows = [row('MASSAGE', 'per_stay', 7500, 60), row(BREAKFAST, 'per_person_night', 1700, 10), row('GARAGE', 'per_night', 1500, 30), row(CHILD_BED, 'per_unit', 0, 20)];
const services = buildExtraServices(rows);

function byCode(code: string): ExtraService {
    const service = services.find((candidate) => candidate.code === code);
    if (service === undefined) throw new Error(`${code} fehlt`);
    return service;
}

describe('buildExtraServices (E49)', () => {
    it('lässt das Frühstück weg und sortiert nach sort_order', () => {
        expect(services.map((service) => service.code)).toEqual([CHILD_BED, 'GARAGE', 'MASSAGE']);
    });
});

describe('getServiceAmountCents — dieselbe Mengenregel wie create_booking', () => {
    it('per_night zählt die Nächte', () => {
        expect(getServiceAmountCents(byCode('GARAGE'), 1, 3)).toBe(4500);
    });

    it('per_stay zählt einmal', () => {
        expect(getServiceAmountCents(byCode('MASSAGE'), 1, 3)).toBe(7500);
    });

    it('nicht gewählt kostet nichts', () => {
        expect(getServiceAmountCents(byCode('GARAGE'), 0, 3)).toBe(0);
    });
});

describe('getServiceMax und reconcileServices', () => {
    it('ohne Zimmer ist nichts wählbar', () => {
        expect(getServiceMax(byCode('GARAGE'), { rooms: 0, children: 1 })).toBe(0);
    });

    it('Kinderbett: eines je Kind und Zimmer', () => {
        expect(getServiceMax(byCode(CHILD_BED), { rooms: 2, children: 3 })).toBe(2);
        expect(getServiceMax(byCode(CHILD_BED), { rooms: 3, children: 1 })).toBe(1);
        expect(getServiceMax(byCode(CHILD_BED), { rooms: 2, children: 0 })).toBe(0);
    });

    it('senkt das Kinderbett mit und räumt ohne Zimmer alles weg', () => {
        expect(reconcileServices({ [CHILD_BED]: 2, GARAGE: 1 }, services, { rooms: 1, children: 2 })).toEqual({ [CHILD_BED]: 1, GARAGE: 1 });
        expect(reconcileServices({ [CHILD_BED]: 1, GARAGE: 1 }, services, { rooms: 0, children: 2 })).toEqual({});
    });
});
