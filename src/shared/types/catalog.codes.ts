/**
 * Amenity codes from `room_type_features.code`. The database returns arbitrary text;
 * `isRoomFeatureCode()` narrows it at the boundary. A new code also needs an icon in
 * `roomFeatureIcons.ts` – the compiler reports the missing entry.
 */
export const ROOM_FEATURE_CODES = ['BED', 'BATHROOM', 'AIR_CONDITIONING', 'GYM'] as const;

export type RoomFeatureCode = (typeof ROOM_FEATURE_CODES)[number];

export function isRoomFeatureCode(value: string): value is RoomFeatureCode {
    return (ROOM_FEATURE_CODES as readonly string[]).includes(value);
}
