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
    room_type_images: RoomTypeImage[];
}

/**
 * Ausstattungsmerkmal einer Zimmerkategorie.
 *
 * Bewusst kein Datenbankfeld: für die Icons im Design (Bett, Klimaanlage, Bad, Gym)
 * gibt es kein Schema. Die Zuordnung steht als Konstante in `Booking.ts`.
 */
export interface RoomAmenity {
    icon: string;
    label: string;
}

/** Preis und Verfügbarkeit einer Kategorie – gibt es nur mit gewähltem Zeitraum. */
export interface RoomCardAvailability {
    priceLabel: string | null;
    nights: number;
    roomsFree: number | null;
    isBookable: boolean;
    unavailableReason: string | null;
}

/** Alles, was eine Zimmerkarte zum Rendern braucht – aus beiden Abfragen zusammengeführt. */
export interface RoomCard {
    roomTypeId: string;
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    imageAlt: string;
    /** `null`, solange kein Zeitraum gewählt ist: ohne Datum gibt es weder Preis noch Restbestand. */
    availability: RoomCardAvailability | null;
}
