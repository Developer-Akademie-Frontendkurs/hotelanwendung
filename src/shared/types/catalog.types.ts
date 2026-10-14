/**
 * Stammdaten und Verfügbarkeit, wie `catalog.service.ts` sie liest, und die Zimmerkarte,
 * die daraus entsteht.
 *
 * Die `*Row`-/`*Detail`-Typen bilden die Antworten von PostgREST ab (snake_case); sie
 * fallen weg, sobald die generierten Typen da sind (V8, `pnpm db:types`).
 */

import type { UnavailableReason } from './booking.codes';

/** Eine Zeile aus der Datenbankfunktion `search_availability`. */
export interface RoomAvailability {
    room_type_id: string;
    name: string;
    slug: string;
    max_occupancy: number;
    nights: number;
    // Beide sind NULL, sobald die Kategorie nicht buchbar ist: `search_availability`
    // unterdrückt Preis und Restbestand bewusst, damit nichts wie ein Angebot aussieht.
    rooms_free: number | null;
    total_amount_cents: number | null;
    currency: string;
    is_bookable: boolean;
    unavailable_reason: string | null;
}

/** Ein Bild einer Zimmerkategorie aus `room_type_images`. */
export interface RoomTypeImage {
    storage_path: string;
    alt_text: string;
    sort_order: number;
}

/** Stammdaten einer Kategorie samt Bildern – per Embed in einer Abfrage geholt. */
export interface RoomTypeDetail {
    /** `room_types.id` – Schlüssel der gewählten Menge und später der Position in `create_booking`. */
    id: string;
    name: string;
    slug: string;
    description: string | null;
    max_occupancy: number;
    room_type_images: RoomTypeImage[];
}

/** Preis und Verfügbarkeit einer Kategorie – gibt es nur mit gewähltem Zeitraum. */
export interface RoomCardAvailability {
    priceLabel: string | null;
    /** Preis EINES Zimmers für den ganzen Zeitraum – die Zusammenfassung rechnet damit weiter. */
    amountCents: number | null;
    currency: string;
    nights: number;
    roomsFree: number | null;
    isBookable: boolean;
    /** `null` auch bei einem Grund, den die Oberfläche nicht kennt – dann zeigt sie den allgemeinen Satz. */
    unavailableReason: UnavailableReason | null;
}

/** Alles, was eine Zimmerkarte zum Rendern braucht – aus beiden Abfragen zusammengeführt. */
export interface RoomCard {
    roomTypeId: string;
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    imageAlt: string;
    /** Betten je Zimmer – die Summe über die Auswahl muss für alle Gäste reichen (E48). */
    maxOccupancy: number;
    /** `null`, solange kein Zeitraum gewählt ist: ohne Datum gibt es weder Preis noch Restbestand. */
    availability: RoomCardAvailability | null;
}

/** Die Stammdaten aus `hotels`, die die Zusammenfassung braucht (genau eine Zeile, E14). */
export interface HotelRow {
    name: string;
    address_line1: string | null;
    postal_code: string | null;
    city: string | null;
    country_code: string | null;
    /** `time` kommt über PostgREST als `"14:00:00"`. */
    check_in_time: string;
    check_out_time: string;
}
