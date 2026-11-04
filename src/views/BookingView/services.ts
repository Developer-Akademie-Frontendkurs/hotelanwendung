import type { ServiceQuantities, ServiceRow } from '../../shared/types/booking.types';

export const CHILD_BED = 'CHILD_BED';
export const BREAKFAST = 'BREAKFAST';
export type ExtraChargeBasis = 'per_night' | 'per_stay' | 'per_unit';

type ExtraServiceRow = ServiceRow & { charge_basis: ExtraChargeBasis };

export interface ExtraService {
    code: string;
    name: string;
    description: string | null;
    chargeBasis: ExtraChargeBasis;
    unitAmountCents: number;
    currency: string;
}

export type ServiceContext = {
    rooms: number;
    children: number;
};

export function buildExtraServices(rows: readonly ServiceRow[]): ExtraService[] {
    return rows
        .filter((row: ServiceRow): row is ExtraServiceRow => isExtraChargeBasis(row.charge_basis))
        .sort((a: ExtraServiceRow, b: ExtraServiceRow): number => a.sort_order - b.sort_order)
        .map(
            (row: ExtraServiceRow): ExtraService => ({
                code: row.code,
                name: row.name,
                description: row.description,
                chargeBasis: row.charge_basis,
                unitAmountCents: row.amount_cents,
                currency: row.currency,
            }),
        );
}

export function getServiceAmountCents(service: ExtraService, quantity: number, nights: number): number {
    if (quantity <= 0) return 0;
    switch (service.chargeBasis) {
        case 'per_night':
            return nights * service.unitAmountCents;
        case 'per_stay':
            return service.unitAmountCents;
        case 'per_unit':
            return quantity * service.unitAmountCents;
    }
}

export function getServiceMax(service: ExtraService, context: ServiceContext): number {
    if (context.rooms === 0) return 0;
    if (service.code === CHILD_BED) return Math.min(context.children, context.rooms);
    return 1;
}

export function reconcileServices(selected: ServiceQuantities, services: readonly ExtraService[], context: ServiceContext): ServiceQuantities {
    const next: Record<string, number> = {};
    for (const service of services) {
        const wanted = selected[service.code] ?? 0;
        const value = Math.min(wanted, getServiceMax(service, context));
        if (value > 0) next[service.code] = value;
    }
    return next;
}

function isExtraChargeBasis(value: string): value is ExtraChargeBasis {
    return value === 'per_night' || value === 'per_stay' || value === 'per_unit';
}
