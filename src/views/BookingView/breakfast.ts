import type { ServiceRow } from '../../shared/types/booking.types';

type BreakfastServiceRow = Pick<ServiceRow, 'id' | 'name' | 'description' | 'amount_cents' | 'child_amount_cents' | 'currency'>;

export interface BreakfastService {
    serviceId: string;
    name: string;
    description: string | null;
    unitAmountCents: number;
    childUnitAmountCents: number;
    currency: string;
}

export type Occupancy = {
    adults: number;
    children: number;
};

export function getBreakfastAmountCents(service: BreakfastService, occupancy: Occupancy, nights: number): number {
    return nights * (occupancy.adults * service.unitAmountCents + occupancy.children * service.childUnitAmountCents);
}

export function buildBreakfastService(row: BreakfastServiceRow | null): BreakfastService | null {
    if (row === null) return null;

    return {
        serviceId: row.id,
        name: row.name,
        description: row.description,
        unitAmountCents: row.amount_cents,
        childUnitAmountCents: row.child_amount_cents ?? row.amount_cents,
        currency: row.currency,
    };
}
