import type { BookingSnapshot, CustomerDetails, Guests, RoomQuantities, ServiceQuantities } from '../types/booking.types';
import type { RoomCard } from '../types/catalog.types';
// Der Store wendet die Regeln der Fachlogik an, die Fachlogik kennt den Store nicht –
// die Abhängigkeit läuft nur in diese Richtung.
import { getRoomLimit, getTotalRooms, reconcileQuantities } from '../../views/BookingView/roomQuantity';
import { reconcileServices, type ExtraService } from '../../views/BookingView/services';

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
let guests: Guests = { adults: null, children: null };
let customerDetails: CustomerDetails = createEmptyCustomerDetails();
// Die zuletzt geladenen Kategorien samt Verfügbarkeit. Kein Teil des Entwurfs, aber ohne
// sie lässt sich nicht sagen, ob die gewählten Zimmer für alle Gäste reichen (E48) – und
// das braucht neben der View auch der Header.
let rooms: readonly RoomCard[] = [];
// Die buchbaren Leistungen je Vorgang – ohne sie lässt sich eine Auswahl nicht abgleichen.
let extraServices: readonly ExtraService[] = [];

const listeners = new Set<Listener>();

function notify(): void {
    listeners.forEach((listener: Listener): void => {
        listener();
    });
}

/**
 * Leeres Formular. Das Land bleibt leer statt `AT`: Den Vorschlag macht das Formular,
 * und bis es zum ersten Mal gelesen ist, ist hier noch nichts eingegeben.
 */
function createEmptyCustomerDetails(): CustomerDetails {
    return {
        customer: { firstName: '', lastName: '', email: '', phone: null },
        residence: { street: '', houseNumber: '', postalCode: '', city: '', countryCode: '' },
        billing: null,
    };
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

/**
 * Setzt die Menge einer Kategorie und gleicht die Leistungen ab – weniger Zimmer können
 * das Kinderbett-Maximum senken (1 je Zimmer, E49). Geklemmt hat der Aufrufer.
 */
function selectRoomQuantity(roomTypeId: string, quantity: number): void {
    writeRoomQuantities({ ...roomQuantities, [roomTypeId]: quantity });
    reconcileSelectedServices();
    notify();
}

/**
 * Übernimmt ein neues Suchergebnis samt Leistungen und gleicht die Auswahl daran ab
 * (V16.6): Mengen sinken auf das, was noch geht, und mit ihnen die Leistungen.
 *
 * Gibt den Hinweis zurück, falls Mengen angepasst wurden – sonst `null`.
 */
function applySearchResult(nextRooms: readonly RoomCard[], nextExtraServices: readonly ExtraService[]): string | null {
    rooms = nextRooms;
    extraServices = nextExtraServices;
    const reconciled = reconcileQuantities(roomQuantities, rooms, getRoomLimit(guests.adults));
    writeRoomQuantities(reconciled.quantities);
    reconcileSelectedServices();
    notify();
    return reconciled.notice;
}

/** Schreibt die Mengen samt Folgeregeln, ohne zu benachrichtigen – das macht die Aktion einmal am Ende. */
function writeRoomQuantities(next: RoomQuantities): void {
    // Mengen von 0 fallen heraus, statt als `0` stehen zu bleiben: sonst wandern leere
    // Positionen bis in `create_booking` mit.
    roomQuantities = Object.fromEntries(Object.entries(next).filter(([, quantity]: [string, number]): boolean => quantity > 0));

    // Ohne Zimmer kein Frühstück. Bliebe das Häkchen stehen, käme es beim erneuten
    // Wählen eines Zimmers unbestellt zurück – und stünde dann in einer Summe, die der
    // Gast nie gesetzt hat.
    if (Object.keys(roomQuantities).length === 0) {
        breakfast = false;
        services = {};
    }
}

/**
 * Zieht die gewählten Leistungen auf das nach, was Zimmer und Kinder gerade erlauben –
 * ohne zu benachrichtigen. Rein lokal, ohne Anfrage: Der Abgleich darf nicht davon
 * abhängen, dass ein Neuladen gelingt.
 */
function reconcileSelectedServices(): void {
    services = { ...reconcileServices(services, extraServices, { rooms: getTotalRooms(roomQuantities), children: guests.children ?? 0 }) };
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

function getGuests(): Guests {
    return { ...guests };
}

/**
 * Weniger Kinder heißen weniger Kinderbetten – sofort, nicht erst nach dem Neuladen:
 * Schlägt das fehl, stünden sonst mehr Kinderbetten als Kinder in der Bestellung, und
 * `create_booking` lehnt mit `ungueltige_leistung` ab.
 */
function setGuests(next: Guests): void {
    guests = { ...next };
    reconcileSelectedServices();
    notify();
}

/** Die Eingaben im Formular – Objekte werden ersetzt, nie verändert. */
function getCustomerDetails(): CustomerDetails {
    return customerDetails;
}

function setCustomerDetails(next: CustomerDetails): void {
    customerDetails = next;
    notify();
}

function getRooms(): readonly RoomCard[] {
    return rooms;
}

function getExtraServices(): readonly ExtraService[] {
    return extraServices;
}

/** Der ganze Entwurf auf einmal – für alles, was daraus etwas ableitet (Schritte, Anfrage). */
function getSnapshot(): BookingSnapshot {
    return { checkIn, checkOut, guests: getGuests(), roomQuantities: getRoomQuantities(), breakfast, services: getServices(), customerDetails };
}

function reset(): void {
    roomQuantities = {};
    breakfast = false;
    services = {};
    guests = { adults: null, children: null };
    customerDetails = createEmptyCustomerDetails();
    rooms = [];
    extraServices = [];
    setDates(null, null);
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
    selectRoomQuantity,
    applySearchResult,
    getBreakfast,
    setBreakfast,
    getServices,
    getServiceQuantity,
    setServices,
    setServiceQuantity,
    getGuests,
    setGuests,
    getCustomerDetails,
    setCustomerDetails,
    getRooms,
    getExtraServices,
    getSnapshot,
    reset,
    subscribe,
};
