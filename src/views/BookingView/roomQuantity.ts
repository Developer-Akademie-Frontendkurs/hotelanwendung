import type { RoomQuantities } from '../../shared/types/booking.types';
import { RoomCard } from '../../shared/types/catalog.types';

export const MAX_ROOMS_PER_BOOKING = 8;

export type QuantityLimit = 'none' | 'roomsFree' | 'total' | 'adults';

export type ClampedQuantity = {
    value: number;
    limitedBy: QuantityLimit;
};

export type ReconciledQuantities = {
    quantities: RoomQuantities;
    notice: string | null;
};

export function getTotalRooms(quantities: RoomQuantities): number {
    return Object.values(quantities).reduce((sum: number, rooms: number): number => sum + rooms, 0);
}

export function getRoomLimit(adults: number | null): number {
    return adults === null ? MAX_ROOMS_PER_BOOKING : Math.min(MAX_ROOMS_PER_BOOKING, adults);
}

export function getRoomMax(roomsFree: number | null, otherRooms: number, roomLimit: number = MAX_ROOMS_PER_BOOKING): number {
    return Math.max(0, Math.min(roomsFree ?? 0, roomLimit - otherRooms));
}

export function normalizeQuantityInput(raw: string): number {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

export function clampQuantity(desired: number, roomsFree: number | null, otherRooms: number, roomLimit: number = MAX_ROOMS_PER_BOOKING): ClampedQuantity {
    const max = getRoomMax(roomsFree, otherRooms, roomLimit);
    if (desired <= max) return { value: Math.max(0, desired), limitedBy: 'none' };

    if ((roomsFree ?? 0) <= roomLimit - otherRooms) return { value: max, limitedBy: 'roomsFree' };
    return { value: max, limitedBy: roomLimit < MAX_ROOMS_PER_BOOKING ? 'adults' : 'total' };
}

export function getLimitMessage(limit: QuantityLimit, roomsFree: number | null, roomLimit: number = MAX_ROOMS_PER_BOOKING): string | null {
    switch (limit) {
        case 'none':
            return null;
        case 'total':
            return `Mehr als ${MAX_ROOMS_PER_BOOKING.toString()} Zimmer können nicht in einem Vorgang gebucht werden. Bitte kontaktieren Sie uns für Gruppenbuchungen.`;
        case 'adults':
            return roomLimit === 1
                ? 'Jedes Zimmer braucht mindestens einen Erwachsenen – mit 1 Erwachsenen ist 1 Zimmer möglich.'
                : `Jedes Zimmer braucht mindestens einen Erwachsenen – mit ${roomLimit.toString()} Erwachsenen sind höchstens ${roomLimit.toString()} Zimmer möglich.`;
        case 'roomsFree':
            return roomsFree === null || roomsFree === 0
                ? 'Für diesen Zeitraum sind keine Zimmer dieser Kategorie frei.'
                : `Für diesen Zeitraum ${formatRoomsLeftClause(roomsFree)} frei.`;
    }
}

export function reconcileQuantities(quantities: RoomQuantities, rooms: readonly RoomCard[], roomLimit: number = MAX_ROOMS_PER_BOOKING): ReconciledQuantities {
    const next: Record<string, number> = {};
    const reasons: string[] = [];

    for (const room of rooms) {
        const wanted = quantities[room.roomTypeId] ?? 0;
        if (wanted === 0) continue;

        const availability = room.availability;
        if (availability === null) {
            next[room.roomTypeId] = wanted;
            continue;
        }

        if (!availability.isBookable) {
            reasons.push(`${room.name} ist für diesen Zeitraum nicht buchbar.`);
            continue;
        }

        const clamped = clampQuantity(wanted, availability.roomsFree, getTotalRooms(next), roomLimit);
        if (clamped.value > 0) next[room.roomTypeId] = clamped.value;
        if (clamped.value < wanted) {
            reasons.push(
                clamped.limitedBy === 'roomsFree'
                    ? `Von ${room.name} ${formatRoomsLeftClause(clamped.value)} frei.`
                    : `${room.name} wurde auf ${clamped.value.toString()} Zimmer verringert.`,
            );
        }
    }

    return { quantities: next, notice: reasons.length === 0 ? null : `Ihre Auswahl wurde angepasst: ${reasons.join(' ')}` };
}

function formatRoomsLeftClause(roomsFree: number): string {
    return roomsFree === 1 ? 'ist nur noch 1 Zimmer' : `sind nur noch ${roomsFree.toString()} Zimmer`;
}

export function formatRoomsFreeLabel(roomsFree: number): string {
    return roomsFree === 1 ? 'noch 1 Zimmer frei' : `noch ${roomsFree.toString()} Zimmer frei`;
}

export function getMissingBeds(quantities: RoomQuantities, rooms: readonly RoomCard[], persons: number): number {
    const beds = rooms.reduce((sum: number, room: RoomCard): number => sum + (quantities[room.roomTypeId] ?? 0) * room.maxOccupancy, 0);
    return Math.max(0, persons - beds);
}

export function formatMissingBedsNotice(missingBeds: number): string {
    if (missingBeds === 0) return '';
    return missingBeds === 1 ? 'Noch 1 Person ohne Bett – bitte ein weiteres Zimmer wählen.' : `Noch ${missingBeds.toString()} Personen ohne Bett – bitte weitere Zimmer wählen.`;
}
