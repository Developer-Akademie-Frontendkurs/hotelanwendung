import type { BookingDraft, BookingStep, RoomQuantities } from '../../../shared/types/booking.types';
import { getInvalidFields } from '../address';
import type { RoomCard } from '../../../shared/types/catalog.types';
import { formatMissingBedsNotice, getMissingBeds } from '../roomQuantity';

/** Reihenfolge der Schritte im Header – zugleich die Reihenfolge der Seite. */
export const BOOKING_STEP_ORDER: readonly BookingStep[] = [1, 2, 3];

/** Bereich der Seite, in dem das Problem liegt – die View entscheidet daran, wohin sie springt. */
export type CheckoutSection = 'dates' | 'guests' | 'rooms' | 'form';

export type CheckoutError = {
    section: CheckoutSection;
    message: string;
};

/**
 * Was vor dem Buchen noch fehlt (Phase 9b, Punkt 7) – in der Reihenfolge der Seite,
 * damit der Gast von oben nach unten arbeiten kann. `null` heißt: alles da.
 */
export function getCheckoutError(draft: BookingDraft, rooms: readonly RoomCard[]): CheckoutError | null {
    if (draft.checkIn === null || draft.checkOut === null) return { section: 'dates', message: 'Bitte wählen Sie zuerst Ihren Zeitraum.' };
    if (draft.adults === null) return { section: 'guests', message: 'Bitte wählen Sie die Anzahl der Gäste.' };
    if (draft.positions.length === 0) return { section: 'rooms', message: 'Bitte wählen Sie mindestens ein Zimmer.' };

    const missingBeds = getDraftMissingBeds(draft, rooms);
    if (missingBeds !== null && missingBeds > 0) return { section: 'rooms', message: formatMissingBedsNotice(missingBeds) };

    if (getInvalidFields(draft).length > 0) return { section: 'form', message: 'Bitte tragen Sie alle notwendigen Informationen ein.' };
    return null;
}

/**
 * Welche Schritte im Header erledigt sind – mit denselben Bedingungen, die
 * `getCheckoutError` vor dem Buchen prüft. Die Schritte hängen nicht voneinander ab:
 * Wer zuerst das Formular ausfüllt, sieht Schritt 3 schon als erledigt.
 */
export function getCompletedSteps(draft: BookingDraft, rooms: readonly RoomCard[]): BookingStep[] {
    const steps: BookingStep[] = [];
    if (draft.checkIn !== null && draft.checkOut !== null && draft.adults !== null) steps.push(1);
    if (draft.positions.length > 0 && getDraftMissingBeds(draft, rooms) === 0) steps.push(2);
    if (getInvalidFields(draft).length === 0) steps.push(3);
    return steps;
}

/** Der fällige Schritt ist der erste, der noch nicht erledigt ist – `null`, wenn alles erledigt ist. */
export function getCurrentStep(completedSteps: readonly BookingStep[]): BookingStep | null {
    return BOOKING_STEP_ORDER.find((step: BookingStep): boolean => !completedSteps.includes(step)) ?? null;
}

/**
 * Fehlende Betten für die Gäste des Entwurfs – `null`, solange die Zahl der Erwachsenen
 * offen ist: Dann lässt sich nicht sagen, ob die Betten reichen.
 */
function getDraftMissingBeds(draft: BookingDraft, rooms: readonly RoomCard[]): number | null {
    if (draft.adults === null) return null;

    const quantities: RoomQuantities = Object.fromEntries(draft.positions.map(({ roomTypeId, rooms: count }): [string, number] => [roomTypeId, count]));
    return getMissingBeds(quantities, rooms, draft.adults + draft.children);
}
