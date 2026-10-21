/**
 * Lesezugriffe der Buchungsseite: Hotel, Zimmerkategorien, Leistungen, Verfügbarkeit
 * (V9, Phase 8.4).
 *
 * Anders als `createBooking` kennen diese Funktionen kein „erwartetes Nein": Jeder
 * Fehler der Abfrage wird geworfen, und die View entscheidet, was der Gast sieht.
 */

import { supabase } from './supabase';
import { formatPrice } from '../format';
import { isUnavailableReason } from '../types/booking.codes';
import type { ServiceRow } from '../types/booking.types';
import type { AvailabilityNightRow, HotelRow, NightAvailability, NightStatus, RoomAvailability, RoomCard, RoomTypeDetail, RoomTypeImage } from '../types/catalog.types';

const ROOM_IMAGE_BUCKET = 'room-images';

/** Belegung und Zeitraum für `search_availability` – Daten als `YYYY-MM-DD`. */
export type AvailabilitySearch = {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
};

/** Die eine Zeile aus `hotels` (E14) – `null`, wenn keine hinterlegt ist. */
export async function fetchHotel(): Promise<HotelRow | null> {
    const { data, error } = await supabase
        .from('hotels')
        .select('name, address_line1, postal_code, city, country_code, check_in_time, check_out_time, booking_horizon_days')
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`hotels konnte nicht geladen werden: ${error.message}`);
    // postgrest-js leitet den Typ aus dem `select` ab – `HotelRow` muss dazu passen.
    return data;
}

/** Die Zimmerkategorien samt Bildern, nach Name sortiert. */
export async function fetchRoomTypes(): Promise<RoomTypeDetail[]> {
    const { data, error } = await supabase
        .from('room_types')
        .select('id, name, slug, description, max_occupancy, room_type_images(storage_path, alt_text, sort_order)')
        .order('name');
    if (error) throw new Error(error.message);
    return data;
}

/**
 * Frühstück und Leistungen je Vorgang, nach `sort_order`.
 *
 * Preise kommen aus der Datenbank, nicht als Konstante aus dem Frontend – dasselbe
 * Argument wie beim Buchungshorizont (E30). Ohne `hotel_id`-Filter, weil es genau ein
 * Hotel gibt; `search_availability` nimmt dieselbe Abkürzung.
 */
export async function fetchServices(): Promise<ServiceRow[]> {
    const { data, error } = await supabase
        .from('services')
        .select('id, code, name, description, charge_basis, amount_cents, child_amount_cents, currency, sort_order')
        .order('sort_order');
    if (error) throw new Error(error.message);
    return data;
}

/** Preis und Restbestand je Kategorie für Zeitraum und Belegung. */
export async function searchAvailability(search: AvailabilitySearch): Promise<RoomAvailability[]> {
    // Ohne generierte Typen (V8) kennt der Client die Funktion nicht, `data` wäre `any`.
    const response: { data: unknown; error: { message: string } | null } = await supabase.rpc('search_availability', {
        p_check_in: search.checkIn,
        p_check_out: search.checkOut,
        p_adults: search.adults,
        p_children: search.children,
    });
    const { data, error } = response;
    if (error) throw new Error(error.message);
    return data as RoomAvailability[];
}

/** Zeitraum und Belegung für `availability_calendar` – `to` ist exklusiv, wie überall (E8). */
export type CalendarSearch = {
    from: string;
    to: string;
    adults: number;
    children: number;
};

/** Eine Zeile je Nacht im Zeitraum, mit dem für Gäste maskierten Grund (E24, E28). */
export async function fetchAvailabilityCalendar(search: CalendarSearch): Promise<AvailabilityNightRow[]> {
    // Ohne `unknown`-Umweg wären `rooms_free` und `unavailable_reason` hier nie NULL –
    // so beschreibt der Generator Rückgaben von Funktionen.
    const response: { data: unknown; error: { message: string } | null } = await supabase.rpc('availability_calendar', {
        p_from: search.from,
        p_to: search.to,
        p_adults: search.adults,
        p_children: search.children,
    });
    const { data, error } = response;
    if (error) throw new Error(error.message);
    return data as AvailabilityNightRow[];
}

/** Die Nächte als Nachschlagetabelle für die Tagesregeln – unbekannte Gründe werden zu `nicht_buchbar`. */
export function buildNightAvailability(rows: readonly AvailabilityNightRow[]): NightAvailability {
    return new Map(
        rows.map((row: AvailabilityNightRow): [string, NightStatus] => [
            row.night,
            {
                available: row.is_available,
                reason: row.is_available ? null : row.unavailable_reason !== null && isUnavailableReason(row.unavailable_reason) ? row.unavailable_reason : 'nicht_buchbar',
            },
        ]),
    );
}

/**
 * Baut die Karten aus den Kategorien und ergänzt – falls vorhanden – die Verfügbarkeit.
 *
 * Die Kategorien geben die Reihenfolge vor, damit die Liste beim Wählen eines Zeitraums
 * nicht umspringt.
 */
export function buildRoomCards(details: readonly RoomTypeDetail[], availability: readonly RoomAvailability[] | null): RoomCard[] {
    const availabilityBySlug = new Map<string, RoomAvailability>((availability ?? []).map((room: RoomAvailability): [string, RoomAvailability] => [room.slug, room]));

    return details.map((detail: RoomTypeDetail): RoomCard => {
        const image = pickImage(detail.room_type_images);
        const room = availabilityBySlug.get(detail.slug);

        return {
            roomTypeId: detail.id,
            slug: detail.slug,
            name: detail.name,
            description: detail.description,
            imageUrl: image === null ? null : getRoomImageUrl(image.storage_path),
            imageAlt: image?.alt_text ?? '',
            maxOccupancy: detail.max_occupancy,
            availability:
                room === undefined
                    ? null
                    : {
                          priceLabel: room.total_amount_cents === null ? null : formatPrice(room.total_amount_cents, room.currency),
                          amountCents: room.total_amount_cents,
                          currency: room.currency,
                          nights: room.nights,
                          roomsFree: room.rooms_free,
                          isBookable: room.is_bookable,
                          unavailableReason: room.unavailable_reason !== null && isUnavailableReason(room.unavailable_reason) ? room.unavailable_reason : null,
                      },
        };
    });
}

/** Öffentliche URL im Bucket – reine Zeichenkette, keine Anfrage. */
function getRoomImageUrl(storagePath: string): string {
    return supabase.storage.from(ROOM_IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Erstes Bild nach `sort_order` – Kategorien ohne Bild sind ein vorgesehener Fall. */
function pickImage(images: readonly RoomTypeImage[]): RoomTypeImage | null {
    if (images.length === 0) return null;
    return [...images].sort((a: RoomTypeImage, b: RoomTypeImage): number => a.sort_order - b.sort_order)[0] ?? null;
}
