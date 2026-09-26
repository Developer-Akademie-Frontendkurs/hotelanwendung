/**
 * Bestellzeilen und Gesamtsumme der Zusammenfassung „Ihre Buchung" (Phase 9b, Punkte 4–5).
 *
 * Wie `breakfast.ts` und `services.ts` eine **Bequemlichkeit, keine zweite Wahrheit**:
 * Verbindlich rechnet `create_booking`. Was hier steht, ist die Zahl, die der Gast vor
 * dem Absenden sieht – und genau deshalb steckt jede sichtbare Zeile auch in der Summe (V16).
 */

import type { RoomQuantities, ServiceQuantities } from '../../shared/state/bookingState';
import { getBreakfastAmountCents, type BreakfastService, type Occupancy } from './breakfast';
import type { RoomCard } from './room.interface';
import { getServiceAmountCents, type ExtraService } from './services';

export type OrderLineKind = 'room' | 'breakfast' | 'service';

/** Eine Zeile der Zusammenfassung. */
export interface OrderLine {
    kind: OrderLineKind;
    /** `room_type_id`, `services.code` bzw. `BREAKFAST` – damit das Entfernen-Kreuz weiß, was es entfernt. */
    id: string;
    name: string;
    /** Zimmer je Kategorie, Menge einer Leistung, beim Frühstück die Zahl der Gäste. */
    quantity: number;
    /** `null`, solange kein Zeitraum gewählt ist: ohne Nächte gibt es keinen Preis. */
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

/**
 * Baut die Zeilen in der Reihenfolge der Seite: Zimmer wie die Karten, dann Frühstück,
 * dann die Leistungen nach `sort_order`.
 */
export function buildOrderLines(input: OrderInput): OrderLine[] {
    const lines: OrderLine[] = [];

    for (const room of input.rooms) {
        const quantity = input.quantities[room.roomTypeId] ?? 0;
        if (quantity === 0) continue;

        // `total_amount_cents` aus `search_availability` ist der Preis EINES Zimmers für
        // den ganzen Zeitraum.
        const perRoom = room.availability?.amountCents ?? null;
        lines.push({
            kind: 'room',
            id: room.roomTypeId,
            name: room.name,
            quantity,
            amountCents: perRoom === null ? null : quantity * perRoom,
            currency: room.availability?.currency ?? 'EUR',
        });
    }

    const breakfast = input.breakfast;
    if (breakfast !== null && input.withBreakfast) {
        lines.push({
            kind: 'breakfast',
            id: 'BREAKFAST',
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

/**
 * Summe aller Zeilen – oder `null`, wenn eine davon keinen Preis hat.
 *
 * Eine Summe, in der eine sichtbare Zeile fehlt, wäre ein Rechenfehler vor den Augen
 * des Gastes. Ohne Zeilen gibt es ebenfalls keine Summe: „0 €" sähe aus wie ein Angebot.
 */
export function getOrderTotalCents(lines: readonly OrderLine[]): number | null {
    if (lines.length === 0) return null;

    let total = 0;
    for (const line of lines) {
        if (line.amountCents === null) return null;
        total += line.amountCents;
    }
    return total;
}
