import type { BookingDraft, BookingPosition, BookingServiceSelection, BookingSnapshot } from '../../../shared/types/booking.types';
import { countNights, toISODate } from './calendar';

export function buildBookingDraft(snapshot: BookingSnapshot): BookingDraft {
    const { checkIn, checkOut, guests } = snapshot;

    return {
        checkIn: checkIn === null ? null : toISODate(checkIn),
        checkOut: checkOut === null ? null : toISODate(checkOut),
        nights: countNights(checkIn, checkOut),
        adults: guests.adults,
        children: guests.children ?? 0,
        positions: Object.entries(snapshot.roomQuantities).map(([roomTypeId, rooms]: [string, number]): BookingPosition => ({ roomTypeId, rooms })),
        withBreakfast: snapshot.breakfast,
        services: Object.entries(snapshot.services).map(([code, quantity]: [string, number]): BookingServiceSelection => ({ code, quantity })),
        ...snapshot.customerDetails,
    };
}
