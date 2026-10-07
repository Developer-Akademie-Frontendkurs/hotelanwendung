import type { RoomQuantities } from '../../shared/types/booking.types';
import { RoomCard } from './room.interface';

/**
 * Obergrenze eines Buchungsvorgangs.
 *
 * Dieselbe Zahl prüft später `create_booking` verbindlich — siehe
 * `docs/datenbank/umsetzungsplan.md`, Phase 7b/Commit 2, Punkt 3. Weicht eine der beiden
 * Stellen ab, lässt die Oberfläche eine Menge wählen, die die Datenbank ablehnt: der Gast
 * erfährt das dann erst beim Absenden.
 */
export const MAX_ROOMS_PER_BOOKING = 8;

/** Welche Grenze eine Eingabe gekappt hat — entscheidet über den Hinweistext. */
export type QuantityLimit = 'none' | 'roomsFree' | 'total' | 'adults';

export type ClampedQuantity = {
    value: number;
    limitedBy: QuantityLimit;
};

/** Ergebnis der Abgleichs-Regel nach einer neuen Suche. */
export type ReconciledQuantities = {
    quantities: RoomQuantities;
    /** Ein Satz über der Liste, sobald sich etwas geändert hat — sonst `null`. */
    notice: string | null;
};

export function getTotalRooms(quantities: RoomQuantities): number {
    return Object.values(quantities).reduce((sum: number, rooms: number): number => sum + rooms, 0);
}

/**
 * Zimmergrenze des Vorgangs: 8 (E44) — und nie mehr Zimmer als Erwachsene, denn jedes
 * Zimmer braucht einen (E48). Ohne gewählte Erwachsenenzahl gilt nur die 8.
 */
export function getRoomLimit(adults: number | null): number {
    return adults === null ? MAX_ROOMS_PER_BOOKING : Math.min(MAX_ROOMS_PER_BOOKING, adults);
}

/**
 * Höchstmenge einer Karte: das Kleinere aus freien Zimmern der Kategorie und dem Rest
 * bis zur Zimmergrenze des Vorgangs.
 *
 * `roomsFree` ist `null`, wenn `search_availability` den Restbestand unterdrückt
 * (nicht buchbare Kategorie) — dann ist nichts wählbar.
 */
export function getRoomMax(roomsFree: number | null, otherRooms: number, roomLimit: number = MAX_ROOMS_PER_BOOKING): number {
    return Math.max(0, Math.min(roomsFree ?? 0, roomLimit - otherRooms));
}

/**
 * Macht aus dem Feldinhalt eine Menge.
 *
 * `type="number"` liefert bei gelöschtem Inhalt `''` und erlaubt Kommazahlen und
 * Vorzeichen — `min`/`max` sind dabei nur Hinweise. Verbindlich ist diese Funktion.
 */
export function normalizeQuantityInput(raw: string): number {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

/** Kappt einen Wunschwert und sagt, welche Grenze gegriffen hat. */
export function clampQuantity(desired: number, roomsFree: number | null, otherRooms: number, roomLimit: number = MAX_ROOMS_PER_BOOKING): ClampedQuantity {
    const max = getRoomMax(roomsFree, otherRooms, roomLimit);
    if (desired <= max) return { value: Math.max(0, desired), limitedBy: 'none' };

    // Bei Gleichstand gilt `rooms_free`: das ist eine Tatsache der Verfügbarkeit,
    // die Zimmergrenze dagegen unsere Regel.
    if ((roomsFree ?? 0) <= roomLimit - otherRooms) return { value: max, limitedBy: 'roomsFree' };
    return { value: max, limitedBy: roomLimit < MAX_ROOMS_PER_BOOKING ? 'adults' : 'total' };
}

/** Der Satz unter dem Feld, sobald eine Eingabe gekappt wurde. */
export function getLimitMessage(limit: QuantityLimit, roomsFree: number | null, roomLimit: number = MAX_ROOMS_PER_BOOKING): string | null {
    switch (limit) {
        case 'none':
            return null;
        case 'total':
            return `Mehr als ${MAX_ROOMS_PER_BOOKING.toString()} Zimmer können nicht in einem Vorgang gebucht werden. Bitte kontaktieren Sie uns für Gruppenbuchungen.`;
        case 'adults':
            return roomLimit === 1
                ? 'Jedes Zimmer braucht mindestens einen Erwachsenen – mit 1 Erwachsenen ist 1 Zimmer möglich.'
                : `Jedes Zimmer braucht mindestens einen Erwachsenen – mit ${roomLimit.toString()} Erwachsenen sind höchstens ${roomLimit.toString()} Zimmer möglich.`;
        case 'roomsFree':
            return roomsFree === null || roomsFree === 0
                ? 'Für diesen Zeitraum sind keine Zimmer dieser Kategorie frei.'
                : `Für diesen Zeitraum ${formatRoomsLeftClause(roomsFree)} frei.`;
    }
}

/**
 * Gleicht die gewählten Mengen mit einem neuen Suchergebnis ab (V16.6).
 *
 * Der Zeitraum ist die teurere Entscheidung des Gastes, die Menge die billigere — also
 * fällt die billigere: der Zeitraum bleibt, Mengen sinken auf das, was noch geht.
 *
 * Ohne Verfügbarkeit (`availability === null`, also ohne vollständigen Zeitraum) gibt es
 * keine Grenze, gegen die sich prüfen ließe. Die Menge bleibt dann unangetastet, statt
 * kommentarlos zu verschwinden, während gar kein Feld sichtbar ist.
 */
export function reconcileQuantities(quantities: RoomQuantities, rooms: readonly RoomCard[], roomLimit: number = MAX_ROOMS_PER_BOOKING): ReconciledQuantities {
    const next: Record<string, number> = {};
    const reasons: string[] = [];

    // Die Reihenfolge der Karten gibt die Reihenfolge der Hinweise vor, damit der Text zu
    // der Liste passt, die der Gast vor sich hat.
    for (const room of rooms) {
        const wanted = quantities[room.roomTypeId] ?? 0;
        if (wanted === 0) continue;

        const availability = room.availability;
        if (availability === null) {
            next[room.roomTypeId] = wanted;
            continue;
        }

        if (!availability.isBookable) {
            reasons.push(`${room.name} ist für diesen Zeitraum nicht buchbar.`);
            continue;
        }

        const clamped = clampQuantity(wanted, availability.roomsFree, getTotalRooms(next), roomLimit);
        if (clamped.value > 0) next[room.roomTypeId] = clamped.value;
        if (clamped.value < wanted) {
            reasons.push(
                clamped.limitedBy === 'roomsFree'
                    ? `Von ${room.name} ${formatRoomsLeftClause(clamped.value)} frei.`
                    : `${room.name} wurde auf ${clamped.value.toString()} Zimmer verringert.`,
            );
        }
    }

    return { quantities: next, notice: reasons.length === 0 ? null : `Ihre Auswahl wurde angepasst: ${reasons.join(' ')}` };
}

/**
 * Freie Zimmer als Satzteil mit Verb – für Hinweise wie „Für diesen Zeitraum sind nur noch 2 Zimmer frei."
 * Das Verb steht mit drin, weil es an der Zahl hängt (ist/sind).
 */
function formatRoomsLeftClause(roomsFree: number): string {
    return roomsFree === 1 ? 'ist nur noch 1 Zimmer' : `sind nur noch ${roomsFree.toString()} Zimmer`;
}

/** Freie Zimmer als kurze Angabe für die Zimmerkarte, z. B. „noch 2 Zimmer frei · 3 Nächte". */
export function formatRoomsFreeLabel(roomsFree: number): string {
    return roomsFree === 1 ? 'noch 1 Zimmer frei' : `noch ${roomsFree.toString()} Zimmer frei`;
}

/**
 * Wie viele Personen in der Auswahl noch kein Bett haben (E48).
 *
 * Die Belegung ist eine Gesamtzahl: Die gewählten Zimmer müssen ZUSAMMEN reichen.
 * Dieselbe Rechnung macht `create_booking` verbindlich (Summe aus Zimmer ×
 * `max_occupancy`); hier ist sie nur der Hinweis, bevor der Gast absendet.
 */
export function getMissingBeds(quantities: RoomQuantities, rooms: readonly RoomCard[], persons: number): number {
    const beds = rooms.reduce((sum: number, room: RoomCard): number => sum + (quantities[room.roomTypeId] ?? 0) * room.maxOccupancy, 0);
    return Math.max(0, persons - beds);
}
