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

/**
 * Zusatzleistungen je Vorgang (E49), geschlüsselt nach `services.code`, Wert = Menge.
 *
 * Eine Checkbox ist Menge 1; nur das Kinderbett kennt mehr. Nicht gewählte Leistungen
 * stehen nicht als 0 darin – dieselbe Regel wie bei den Zimmermengen.
 */
export type ServiceQuantities = Readonly<Record<string, number>>;

type Listener = () => void;

let checkIn: Date | null = null;
let checkOut: Date | null = null;
let roomQuantities: Record<string, number> = {};
// Frühstück für ALLE Gäste des Vorgangs (E47, E48). Seit die Belegung eine Gesamtzahl
// ist, gibt es keine Gäste „einer Kategorie" mehr, an die ein Häkchen gebunden wäre.
let breakfast = false;
let services: Record<string, number> = {};

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
    getBreakfast,
    setBreakfast,
    getServices,
    getServiceQuantity,
    setServices,
    setServiceQuantity,
    reset,
    isStepComplete,
    subscribe,
};
