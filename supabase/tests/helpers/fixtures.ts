import { serviceClient } from './clients';

/**
 * Fixtures legen die Tests selbst an (E34) — nicht der Seed.
 *
 * Der Seed ist minimal (V4) und soll es bleiben: Ein Seed, der alle Testfaelle
 * enthaelt, wird mit jedem neuen Test groesser, und irgendwann testen die Tests
 * gegen Daten, die niemand mehr versteht. Jeder Test baut seine Welt selbst und
 * raeumt sie wieder ab.
 *
 * Jede Fixture bekommt ein eigenes Hotel. Das ist grosszuegig, aber es macht Tests
 * voneinander unabhaengig — und Kapazitaetsrechnungen (ab Phase 5) sind nur dann
 * aussagekraeftig, wenn kein fremdes Zimmer mitzaehlt.
 */

export type Fixture = {
    hotelId: string;
    roomTypeId: string;
    roomIds: string[];
    /** Nur gesetzt, wenn `withRatePlan` angefordert wurde. */
    ratePlanId?: string;
    cleanup: () => Promise<void>;
};

/** Datum als ISO-Tag, `offsetDays` Tage nach heute (UTC — wie der Datenbankcontainer). */
export function isoDay(offsetDays: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

let counter = 0;

function uniqueSuffix(): string {
    counter += 1;
    return `${String(counter).padStart(3, '0')}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Legt Hotel + eine Kategorie + `roomCount` Zimmer an. */
export async function createFixture(options: { roomCount?: number; maxOccupancy?: number; withRatePlan?: boolean } = {}): Promise<Fixture> {
    const roomCount = options.roomCount ?? 1;
    const suffix = uniqueSuffix();

    const { data: hotel, error: hotelError } = await serviceClient
        .from('hotels')
        .insert({
            name: `Testhotel ${suffix}`,
            check_in_time: '15:00',
            check_out_time: '11:00',
            booking_horizon_days: 365,
        })
        .select('id')
        .single();
    if (hotelError) throw new Error(`Fixture: hotels — ${hotelError.message}`);
    const hotelId = hotel.id as string;

    const { data: roomType, error: roomTypeError } = await serviceClient
        .from('room_types')
        .insert({
            hotel_id: hotelId,
            name: `Testkategorie ${suffix}`,
            slug: `testkategorie-${suffix}`,
            max_occupancy: options.maxOccupancy ?? 2,
        })
        .select('id')
        .single();
    if (roomTypeError) throw new Error(`Fixture: room_types — ${roomTypeError.message}`);
    const roomTypeId = roomType.id as string;

    const roomIds: string[] = [];
    if (roomCount > 0) {
        const rows = Array.from({ length: roomCount }, (_, index) => ({
            hotel_id: hotelId,
            room_type_id: roomTypeId,
            room_number: `T${suffix}-${String(index + 1)}`,
        }));
        const { data: rooms, error: roomsError } = await serviceClient.from('rooms').insert(rows).select('id');
        if (roomsError) throw new Error(`Fixture: rooms — ${roomsError.message}`);
        roomIds.push(...(rooms as { id: string }[]).map((room) => room.id));
    }

    let ratePlanId: string | undefined;
    if (options.withRatePlan) {
        const { data: ratePlan, error: ratePlanError } = await serviceClient
            .from('rate_plans')
            .insert({ hotel_id: hotelId, code: 'STANDARD', name: 'Standardtarif', is_default: true })
            .select('id')
            .single();
        if (ratePlanError) throw new Error(`Fixture: rate_plans — ${ratePlanError.message}`);
        ratePlanId = ratePlan.id as string;
    }

    // Abbau in umgekehrter Reihenfolge: ON DELETE RESTRICT (E22) laesst nichts
    // anderes zu — und genau das ist der Sinn der Entscheidung.
    const cleanup = async (): Promise<void> => {
        await serviceClient
            .from('room_blocks')
            .delete()
            .in('room_id', roomIds.length > 0 ? roomIds : ['00000000-0000-0000-0000-000000000000']);
        await serviceClient.from('room_type_rates').delete().eq('room_type_id', roomTypeId);
        await serviceClient.from('rooms').delete().eq('room_type_id', roomTypeId);
        await serviceClient.from('room_type_images').delete().eq('room_type_id', roomTypeId);
        await serviceClient.from('room_types').delete().eq('id', roomTypeId);
        if (ratePlanId !== undefined) {
            await serviceClient.from('rate_plans').delete().eq('id', ratePlanId);
        }
        await serviceClient.from('hotels').delete().eq('id', hotelId);
    };

    return ratePlanId === undefined ? { hotelId, roomTypeId, roomIds, cleanup } : { hotelId, roomTypeId, roomIds, ratePlanId, cleanup };
}
