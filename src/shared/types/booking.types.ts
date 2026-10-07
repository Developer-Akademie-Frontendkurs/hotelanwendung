/**
 * Typen der Buchung, die Fachlogik (`src/views/BookingView/*.ts`) und Zustand
 * (`bookingState`) gemeinsam nutzen.
 *
 * Sie liegen hier statt im Store, damit die Abhängigkeit nur in eine Richtung läuft:
 * Fachlogik und Store importieren beide von hier, die Fachlogik aber nichts aus dem Store.
 */

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

/**
 * Eine Zeile aus `services`, so wie PostgREST sie liefert – für Frühstück und Leistungen
 * je Vorgang dieselbe Tabelle, also auch derselbe Typ.
 */
export interface ServiceRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    charge_basis: string;
    amount_cents: number;
    /** `null` heißt: kein eigener Kinderpreis hinterlegt. */
    child_amount_cents: number | null;
    currency: string;
    sort_order: number;
}

export type Customer = {
    firstName: string;
    lastName: string;
    email: string;
    /** Optional – `null`, wenn leer. */
    phone: string | null;
};

/** Die Form der Adressparameter von `create_booking` (V13). */
export type Address = {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    /**
     * ISO-Code. Bewusst `string` statt der Länderliste: Welche Länder gültig sind, prüfen
     * `isCountryCode()` (Oberfläche) und `is_supported_country()` (Datenbank).
     */
    countryCode: string;
};

export type BillingAddress = Address & {
    /** „Firma / z. Hd." – optional, `null`, wenn leer. */
    company: string | null;
};

/** Kontaktdaten und Adressen – gelten für den ganzen Vorgang (E50, E51). */
export type CustomerDetails = {
    customer: Customer;
    /** Sitzadresse – wo der Gast wohnt. Pflicht. */
    residence: Address;
    /** `null` heißt: Rechnung an die Sitzadresse. */
    billing: BillingAddress | null;
};

/** Eine Zimmerkategorie mit Menge – die Form von `p_positions` in `create_booking` (E44). */
export type BookingPosition = {
    roomTypeId: string;
    rooms: number;
};

/** Eine Zusatzleistung je Vorgang – die Form von `p_services` in `create_booking` (E49). */
export type BookingServiceSelection = {
    code: string;
    quantity: number;
};

/**
 * Was `create_booking` braucht – camelCase; die Übersetzung in `p_*` macht `booking.service.ts`.
 * Gäste als Gesamtzahl des Vorgangs (E48) – verteilt werden sie in `create_booking`.
 */
export type BookingRequest = CustomerDetails & {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    positions: readonly BookingPosition[];
    withBreakfast: boolean;
    services: readonly BookingServiceSelection[];
};
