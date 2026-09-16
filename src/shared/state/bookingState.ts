export type BookingStep = 1 | 2 | 3;

export type BookingDates = {
    checkIn: Date | null;
    checkOut: Date | null;
};

/**
 * Gewählte Zimmer je Kategorie, geschlüsselt nach `room_type_id`.
 *
 * Der Schlüssel ist bewusst die UUID und nicht der sprechendere `slug`: die Positionen
 * in `create_booking` (`p_positions`) verlangen genau diese ID.
 */
export type RoomQuantities = Readonly<Record<string, number>>;

type Listener = () => void;

let checkIn: Date | null = null;
let checkOut: Date | null = null;
let roomQuantities: Record<string, number> = {};

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
    notify();
}

function reset(): void {
    roomQuantities = {};
    setDates(null, null);
}

function isStepComplete(step: BookingStep): boolean {
    if (step === 1) {
        return checkIn !== null && checkOut !== null;
    }

    // Step 2 (Zimmerauswahl) und Step 3 (persönliche Daten) haben noch keine View.
    // Sobald sie existieren, kommt ihre Abschluss-Bedingung hier dazu.
    return false;
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
    reset,
    isStepComplete,
    subscribe,
};
