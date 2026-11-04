import type { RoomQuantities, ServiceQuantities } from '../../shared/types/booking.types';
import { getBreakfastAmountCents, type BreakfastService, type Occupancy } from './breakfast';
import type { RoomCard } from '../../shared/types/catalog.types';
import { BREAKFAST, getServiceAmountCents, type ExtraService } from './services';
import { formatNights, formatPrice } from '../../shared/format';

export const DEFAULT_CURRENCY = 'EUR';

export type OrderLineKind = 'room' | 'breakfast' | 'service';

export interface OrderLine {
    kind: OrderLineKind;
    id: string;
    name: string;
    quantity: number;
    amountCents: number | null;
    currency: string;
}

export type OrderInput = {
    rooms: readonly RoomCard[];
    quantities: RoomQuantities;
    nights: number | null;
    occupancy: Occupancy;
    breakfast: BreakfastService | null;
    withBreakfast: boolean;
    services: readonly ExtraService[];
    serviceQuantities: ServiceQuantities;
};

export function buildOrderLines(input: OrderInput): OrderLine[] {
    const lines: OrderLine[] = [];

    for (const room of input.rooms) {
        const quantity = input.quantities[room.roomTypeId] ?? 0;
        if (quantity === 0) continue;

        const perRoom = room.availability?.amountCents ?? null;
        lines.push({
            kind: 'room',
            id: room.roomTypeId,
            name: room.name,
            quantity,
            amountCents: perRoom === null ? null : quantity * perRoom,
            currency: room.availability?.currency ?? DEFAULT_CURRENCY,
        });
    }

    const breakfast = input.breakfast;
    if (breakfast !== null && input.withBreakfast) {
        lines.push({
            kind: 'breakfast',
            id: BREAKFAST,
            name: breakfast.name,
            quantity: input.occupancy.adults + input.occupancy.children,
            amountCents: input.nights === null ? null : getBreakfastAmountCents(breakfast, input.occupancy, input.nights),
            currency: breakfast.currency,
        });
    }

    for (const service of input.services) {
        const quantity = input.serviceQuantities[service.code] ?? 0;
        if (quantity === 0) continue;

        // `per_stay` und `per_unit` kennen auch ohne Zeitraum ihren Preis.
        const needsNights = service.chargeBasis === 'per_night';
        lines.push({
            kind: 'service',
            id: service.code,
            name: service.name,
            quantity,
            amountCents: needsNights && input.nights === null ? null : getServiceAmountCents(service, quantity, input.nights ?? 0),
            currency: service.currency,
        });
    }

    return lines;
}

export function getOrderTotalCents(lines: readonly OrderLine[]): number | null {
    if (lines.length === 0) return null;

    let total = 0;
    for (const line of lines) {
        if (line.amountCents === null) return null;
        total += line.amountCents;
    }
    return total;
}

export function formatSelectionSummary(rooms: number, nights: number | null, totalCents: number | null, currency: string): string {
    const parts = [`${rooms.toString()} Zimmer`];
    if (nights !== null) parts.push(formatNights(nights));
    if (totalCents !== null) parts.push(formatPrice(totalCents, currency));
    return parts.join(' · ');
}
