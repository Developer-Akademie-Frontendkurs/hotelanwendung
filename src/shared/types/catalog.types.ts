/**
 * Stammdaten und Verfügbarkeit, wie `catalog.service.ts` sie liest, und die Zimmerkarte,
 * die daraus entsteht.
 *
 * Die `*Row`-/`*Detail`-Typen sind die Antworten von PostgREST (snake_case) und werden aus
 * den generierten Typen abgeleitet (V8) – benennt eine Migration eine Spalte um, wird das
 * nach `pnpm db:types` hier zum Typfehler. Handgeschrieben bleiben die Zimmerkarte (sie
 * beschreibt die Oberfläche, keine Tabelle) und `RoomAvailability` (siehe dort).
 */

import type { UnavailableReason } from './booking.codes';
import type { Tables } from './database.types';

/**
 * Eine Zeile aus der Datenbankfunktion `search_availability`.
 *
 * Bewusst NICHT aus `Database['public']['Functions']` abgeleitet: Für Rückgaben von
 * Funktionen erzeugt der Generator jede Spalte als nicht-nullbar – `rooms_free` und
 * `total_amount_cents` sind aber gerade dann NULL, wenn eine Kategorie nicht buchbar ist
 * (E37). Abgeleitet würde der Typ diese Prüfung abschaffen.
 */
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

/**
 * Eine Nacht aus der Datenbankfunktion `availability_calendar` (E24) – handgeschrieben aus
 * demselben Grund wie `RoomAvailability`: `rooms_free` und `unavailable_reason` sind NULL,
 * sobald bzw. solange die Nacht buchbar ist.
 */
export interface AvailabilityNightRow {
    /** `YYYY-MM-DD` – die Nacht, die an diesem Tag beginnt (E29). */
    night: string;
    is_available: boolean;
    rooms_free: number | null;
    unavailable_reason: string | null;
}

/** Eine Nacht, wie die Tagesregeln des Kalenders sie lesen (E24, E29). */
export type NightStatus = {
    available: boolean;
    /** Für Gäste maskiert (E28) – meist `nicht_buchbar`. */
    reason: UnavailableReason | null;
};

/** Die Nächte des Horizonts, geschlüsselt nach `YYYY-MM-DD`. */
export type NightAvailability = ReadonlyMap<string, NightStatus>;

/** Ein Bild einer Zimmerkategorie aus `room_type_images`. */
export type RoomTypeImage = Pick<Tables<'room_type_images'>, 'storage_path' | 'alt_text' | 'sort_order'>;

/**
 * Stammdaten einer Kategorie samt Bildern – per Embed in einer Abfrage geholt.
 * `id` ist der Schlüssel der gewählten Menge und der Position in `create_booking`.
 */
export type RoomTypeDetail = Pick<Tables<'room_types'>, 'id' | 'name' | 'slug' | 'description' | 'max_occupancy'> & {
    room_type_images: RoomTypeImage[];
};

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

/**
 * Die Stammdaten aus `hotels`, die Zusammenfassung und Kalender brauchen (genau eine Zeile,
 * E14). `check_in_time`/`check_out_time` kommen über PostgREST als `"14:00:00"`;
 * `booking_horizon_days` begrenzt den Kalender (E30).
 */
export type HotelRow = Pick<Tables<'hotels'>, 'name' | 'address_line1' | 'postal_code' | 'city' | 'country_code' | 'check_in_time' | 'check_out_time' | 'booking_horizon_days'>;
