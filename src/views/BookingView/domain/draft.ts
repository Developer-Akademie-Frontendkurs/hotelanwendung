import type { BookingDraft, BookingPosition, BookingServiceSelection, BookingSnapshot } from '../../../shared/types/booking.types';
import { countNights, toISODate } from './calendar';

/** Der Zustand in der Form der `create_booking`-Parameter – was noch fehlt, bleibt `null`. */
export function buildBookingDraft(snapshot: BookingSnapshot): BookingDraft {
    const { checkIn, checkOut, guests } = snapshot;

    return {
        checkIn: checkIn === null ? null : toISODate(checkIn),
        checkOut: checkOut === null ? null : toISODate(checkOut),
        nights: countNights(checkIn, checkOut),
        adults: guests.adults,
        // Leeres Kinderfeld heißt „keine Kinder" – keine Vermutung, sondern die Abwesenheit von Kindern.
        children: guests.children ?? 0,
        // Eine Position je Kategorie – die Form von `p_positions` in `create_booking`
        // (E44). Frühstück und Gäste gelten für den ganzen Vorgang (E48).
        positions: Object.entries(snapshot.roomQuantities).map(([roomTypeId, rooms]: [string, number]): BookingPosition => ({ roomTypeId, rooms })),
        withBreakfast: snapshot.breakfast,
        // Die Form von `p_services` (E49). Die Menge ist nur beim Kinderbett mehr als 1.
        services: Object.entries(snapshot.services).map(([code, quantity]: [string, number]): BookingServiceSelection => ({ code, quantity })),
        ...snapshot.customerDetails,
    };
}
