import type { RoomQuantities, ServiceQuantities } from '../types/booking.types';

export type BookingStep = 1 | 2 | 3;

export const BOOKING_STEP_ORDER: readonly BookingStep[] = [1, 2, 3];

export type BookingDates = {
    checkIn: Date | null;
    checkOut: Date | null;
};

type Listener = () => void;

let checkIn: Date | null = null;
let checkOut: Date | null = null;
let roomQuantities: Record<string, number> = {};
// Frühstück für ALLE Gäste des Vorgangs (E47, E48). Seit die Belegung eine Gesamtzahl
// ist, gibt es keine Gäste „einer Kategorie" mehr, an die ein Häkchen gebunden wäre.
let breakfast = false;
let services: Record<string, number> = {};
// Welche Schritte erledigt sind, meldet die BookingView: Die Bedingungen hängen an Daten,
// die nur sie kennt (Belegung, Bettenzahl der Kategorien, Formular).
let completedSteps: ReadonlySet<BookingStep> = new Set();

const listeners = new Set<Listener>();

function notify(): void {
    listeners.forEach((listener: Listener): void => {
        listener();
    });
}

function getDates(): BookingDates {
    return { checkIn, checkOut };
}

function setDates(nextCheckIn: Date | null, nextCheckOut: Date | null): void {
    checkIn = nextCheckIn;
    checkOut = nextCheckOut;
    notify();
}

function getRoomQuantities(): RoomQuantities {
    return { ...roomQuantities };
}

function getRoomQuantity(roomTypeId: string): number {
    return roomQuantities[roomTypeId] ?? 0;
}

function setRoomQuantity(roomTypeId: string, rooms: number): void {
    setRoomQuantities({ ...roomQuantities, [roomTypeId]: rooms });
}

function setRoomQuantities(next: RoomQuantities): void {
    // Mengen von 0 fallen heraus, statt als `0` stehen zu bleiben: sonst wandern leere
    // Positionen bis in `create_booking` mit.
    roomQuantities = Object.fromEntries(Object.entries(next).filter(([, rooms]: [string, number]): boolean => rooms > 0));

    // Ohne Zimmer kein Frühstück. Bliebe das Häkchen stehen, käme es beim erneuten
    // Wählen eines Zimmers unbestellt zurück – und stünde dann in einer Summe, die der
    // Gast nie gesetzt hat.
    if (Object.keys(roomQuantities).length === 0) {
        breakfast = false;
        services = {};
    }
    notify();
}

function getBreakfast(): boolean {
    return breakfast;
}

function setBreakfast(wanted: boolean): void {
    // Kein Häkchen ohne Zimmer – dieselbe Regel wie oben, nur an dem Ende, an dem der
    // Gast klickt.
    breakfast = wanted && Object.keys(roomQuantities).length > 0;
    notify();
}

function getServices(): ServiceQuantities {
    return { ...services };
}

function getServiceQuantity(code: string): number {
    return services[code] ?? 0;
}

function setServices(next: ServiceQuantities): void {
    // Ohne Zimmer keine Leistungen – dieselbe Regel wie beim Frühstück.
    const hasRooms = Object.keys(roomQuantities).length > 0;
    services = hasRooms ? Object.fromEntries(Object.entries(next).filter(([, quantity]: [string, number]): boolean => quantity > 0)) : {};
    notify();
}

function setServiceQuantity(code: string, quantity: number): void {
    setServices({ ...services, [code]: quantity });
}

function reset(): void {
    roomQuantities = {};
    breakfast = false;
    services = {};
    completedSteps = new Set();
    setDates(null, null);
}

function isStepComplete(step: BookingStep): boolean {
    return completedSteps.has(step);
}

/**
 * Nur bei einer echten Änderung benachrichtigen – die View ruft das auch aus einem
 * eigenen `subscribe` heraus auf, ohne diese Bremse gäbe es eine Endlosschleife.
 */
function setCompletedSteps(steps: readonly BookingStep[]): void {
    const next = new Set(steps);
    const unchanged = next.size === completedSteps.size && steps.every((step: BookingStep): boolean => completedSteps.has(step));
    if (unchanged) return;

    completedSteps = next;
    notify();
}

/** Der fällige Schritt ist der erste, der noch nicht erledigt ist – `null`, wenn alles erledigt ist. */
function getCurrentStep(): BookingStep | null {
    return BOOKING_STEP_ORDER.find((step: BookingStep): boolean => !completedSteps.has(step)) ?? null;
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    return (): void => {
        listeners.delete(listener);
    };
}

export const bookingState = {
    getDates,
    setDates,
    getRoomQuantities,
    getRoomQuantity,
    setRoomQuantity,
    setRoomQuantities,
    getBreakfast,
    setBreakfast,
    getServices,
    getServiceQuantity,
    setServices,
    setServiceQuantity,
    reset,
    isStepComplete,
    setCompletedSteps,
    getCurrentStep,
    subscribe,
};
