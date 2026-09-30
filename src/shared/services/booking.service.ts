/**
 * Buchen über `create_booking` (Phase 9b, Punkt 8; V9, V15).
 *
 * Anders als die Lesezugriffe **wirft** diese Funktion bei einer Ablehnung nicht: Eine
 * ausgebuchte Nacht ist ein erwartetes Ergebnis, kein Ausnahmefall. Die Oberfläche
 * bekommt stattdessen `{ ok: false, error }` mit Code, Datum und Kategorie aus dem
 * `DETAIL`-JSON von `reject_booking` (E31).
 *
 * Alles andere – Netzwerk, Server, unlesbare Antwort – ist keine Ablehnung und wird als
 * `BookingFailedError` geworfen (V15).
 */

import { supabase } from './supabase';

export type BookingRequestAddress = {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    countryCode: string;
};

/** Was `create_booking` braucht – camelCase, die Übersetzung in `p_*` passiert hier. */
export type BookingRequest = {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    positions: readonly { roomTypeId: string; rooms: number }[];
    withBreakfast: boolean;
    services: readonly { code: string; quantity: number }[];
    customer: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
    };
    residence: BookingRequestAddress;
    /** `null` heißt: Rechnung an die Sitzadresse. */
    billing: (BookingRequestAddress & { company: string | null }) | null;
};

/** Eine Zeile aus `bookings` – ein Zimmer des Vorgangs. */
export type CreatedRoomBooking = {
    id: string;
    bookingReference: string;
    roomTypeId: string;
    grandTotalCents: number;
    currency: string;
};

export type CreatedBooking = {
    /** `null` bei nur einem Zimmer – ein Vorgang entsteht erst ab zwei Zeilen in `bookings`. */
    bookingGroupId: string | null;
    bookings: CreatedRoomBooking[];
    nights: number;
    grandTotalCents: number;
};

export type BookingRejection = {
    /** Der Code aus `reject_booking` – für Gäste maskiert (`nicht_buchbar`, E28). */
    code: string;
    /** Die erste betroffene Nacht, `YYYY-MM-DD`. */
    date: string | null;
    roomTypeId: string | null;
    /** Der Satz aus der Datenbank – nur als Rückfall gedacht, er kommt ohne Umlaute. */
    message: string;
};

/**
 * `create_booking` ist nicht mit einer Ablehnung beantwortet worden.
 *
 * `outcomeUnknown` sagt, ob die Buchung trotzdem angelegt sein kann: Kam keine Antwort
 * der Datenbank an (Netzwerk, Zeitüberschreitung, Gateway), kann der Commit durch sein.
 * Ein erneuter Versuch hieße dann Doppelbuchung. Antwortet dagegen die Datenbank mit
 * einem Fehlercode, ist die Transaktion zurückgerollt – es ist sicher nichts gebucht.
 */
export class BookingFailedError extends Error {
    readonly outcomeUnknown: boolean;

    constructor(message: string, outcomeUnknown: boolean) {
        super(message);
        this.name = 'BookingFailedError';
        this.outcomeUnknown = outcomeUnknown;
    }
}

export type CreateBookingResult = { ok: true; data: CreatedBooking } | { ok: false; error: BookingRejection };

export async function createBooking(request: BookingRequest): Promise<CreateBookingResult> {
    const { billing } = request;

    // Ohne generierte Typen (V8 steht noch aus) ist `data` hier `any` – als `unknown`
    // gelesen, prüft `parseCreatedBooking()` die Form selbst.
    const response: { data: unknown; error: { message: string; details: string | null; code?: string } | null } = await supabase.rpc('create_booking', {
        p_check_in: request.checkIn,
        p_check_out: request.checkOut,
        p_positions: request.positions.map((position: { roomTypeId: string; rooms: number }): { room_type_id: string; rooms: number } => ({
            room_type_id: position.roomTypeId,
            rooms: position.rooms,
        })),
        p_adults: request.adults,
        p_children: request.children,
        p_with_breakfast: request.withBreakfast,
        p_services: request.services,
        p_email: request.customer.email,
        p_first_name: request.customer.firstName,
        p_last_name: request.customer.lastName,
        p_phone: request.customer.phone,
        p_street: request.residence.street,
        p_house_number: request.residence.houseNumber,
        p_postal_code: request.residence.postalCode,
        p_city: request.residence.city,
        p_country_code: request.residence.countryCode,
        // Ohne Rechnungsadresse bleiben die Parameter ganz weg: Schon ein einzelnes
        // gesetztes Feld hieße für `create_booking` „halbe Rechnungsadresse" (E51).
        ...(billing === null
            ? {}
            : {
                  p_billing_company: billing.company,
                  p_billing_street: billing.street,
                  p_billing_house_number: billing.houseNumber,
                  p_billing_postal_code: billing.postalCode,
                  p_billing_city: billing.city,
                  p_billing_country_code: billing.countryCode,
              }),
    });

    const { data, error } = response;
    if (error) {
        const rejection = error.code === REJECTION_SQLSTATE ? parseRejection(error.message, error.details) : null;
        if (rejection !== null) return { ok: false, error: rejection };

        // Ohne `code` stammt der Fehler nicht aus Postgres/PostgREST: postgrest-js meldet
        // einen gescheiterten `fetch` mit leerem `code`, ein Gateway-Fehler kommt als
        // reiner Text. Ob die Datenbank committet hat, weiß dann niemand.
        const outcomeUnknown = error.code === undefined || error.code === '';
        throw new BookingFailedError(`create_booking fehlgeschlagen: ${error.message}`, outcomeUnknown);
    }

    const created = parseCreatedBooking(data);
    if (created === null) {
        // Die Buchung ist angelegt, nur die Antwort hat eine unerwartete Form. Das ist
        // ein Programmierfehler, keine Ablehnung – und darf nicht als „nicht gebucht"
        // beim Gast ankommen, sonst bucht er ein zweites Mal.
        throw new BookingFailedError('create_booking hat eine unerwartete Antwort geliefert.', true);
    }
    return { ok: true, data: created };
}

/** Der SQLSTATE, mit dem `reject_booking` wirft. */
const REJECTION_SQLSTATE = 'P0001';

/**
 * Liest das `DETAIL`-JSON von `reject_booking`. Fehlt es oder hat es keinen `code`, war
 * der Fehler keine Ablehnung – dann `null`, und der Aufrufer wirft.
 */
function parseRejection(message: string, details: string | null | undefined): BookingRejection | null {
    if (!details) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(details);
    } catch {
        return null;
    }
    if (!isRecord(parsed) || typeof parsed.code !== 'string') return null;

    return {
        code: parsed.code,
        date: typeof parsed.datum === 'string' ? parsed.datum : null,
        roomTypeId: typeof parsed.room_type_id === 'string' ? parsed.room_type_id : null,
        message: typeof parsed.grund === 'string' ? parsed.grund : message,
    };
}

/**
 * Schmale Laufzeitprüfung des Ergebnisses: `create_booking` liefert `jsonb`, und dafür
 * gibt es keinen Typ, dem man trauen könnte (E44). Geprüft wird nur, was die Oberfläche
 * liest.
 */
function parseCreatedBooking(data: unknown): CreatedBooking | null {
    if (!isRecord(data) || !Array.isArray(data.bookings)) return null;
    const groupId = data.booking_group_id;
    if (groupId !== null && typeof groupId !== 'string') return null;
    if (typeof data.nights !== 'number' || typeof data.grand_total_cents !== 'number') return null;

    const bookings: CreatedRoomBooking[] = [];
    for (const row of data.bookings as unknown[]) {
        if (
            !isRecord(row) ||
            typeof row.id !== 'string' ||
            typeof row.booking_reference !== 'string' ||
            typeof row.room_type_id !== 'string' ||
            typeof row.grand_total_cents !== 'number' ||
            typeof row.currency !== 'string'
        ) {
            return null;
        }
        bookings.push({
            id: row.id,
            bookingReference: row.booking_reference,
            roomTypeId: row.room_type_id,
            grandTotalCents: row.grand_total_cents,
            currency: row.currency,
        });
    }
    if (bookings.length === 0) return null;

    return { bookingGroupId: groupId, bookings, nights: data.nights, grandTotalCents: data.grand_total_cents };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
