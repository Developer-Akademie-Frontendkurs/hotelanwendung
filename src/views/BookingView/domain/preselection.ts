import type { RoomQuantities } from '../../../shared/types/booking.types';
import type { RoomCard } from '../../../shared/types/catalog.types';
import { clampQuantity, getTotalRooms } from '../roomQuantity';

export const BOOKING_PATH = '/buchung';
const ROOM_PARAM = 'zimmer';

/** Link to the booking page with a room type preselected, e.g. `/buchung?zimmer=double-suite`. */
export function getBookingHref(slug: string): string {
    return `${BOOKING_PATH}?${new URLSearchParams({ [ROOM_PARAM]: slug }).toString()}`;
}

export function readPreselectedSlug(search: string): string | null {
    const slug = new URLSearchParams(search).get(ROOM_PARAM)?.trim() ?? '';
    return slug === '' ? null : slug;
}

export type PreselectionResult =
    /** Keep waiting – no dates yet, or the room type cannot be booked for them. */
    | { status: 'pending' }
    /** Done without a change – the guest already chose rooms, or the room type does not exist. */
    | { status: 'dropped' }
    | { status: 'applied'; roomTypeId: string; quantity: number };

/**
 * Turns the preselected room type into one room once availability is known.
 * Only applies while nothing is selected, so it never overrides the guest's own choice.
 */
export function resolvePreselection(slug: string, rooms: readonly RoomCard[], quantities: RoomQuantities, roomLimit: number): PreselectionResult {
    if (getTotalRooms(quantities) > 0) return { status: 'dropped' };

    const room = rooms.find((candidate: RoomCard): boolean => candidate.slug === slug);
    if (room === undefined) return rooms.length === 0 ? { status: 'pending' } : { status: 'dropped' };

    const availability = room.availability;
    if (availability === null || !availability.isBookable) return { status: 'pending' };

    const quantity = clampQuantity(1, availability.roomsFree, 0, roomLimit).value;
    return quantity === 0 ? { status: 'pending' } : { status: 'applied', roomTypeId: room.roomTypeId, quantity };
}
