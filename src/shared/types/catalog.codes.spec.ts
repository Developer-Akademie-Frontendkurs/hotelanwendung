import { describe, expect, it } from 'vitest';
import { ROOM_FEATURE_CODES, isRoomFeatureCode } from './catalog.codes';

describe('isRoomFeatureCode', () => {
    it('erkennt alle bekannten Codes', () => {
        expect(ROOM_FEATURE_CODES.every((code) => isRoomFeatureCode(code))).toBe(true);
    });

    it('lehnt unbekannte und falsch geschriebene Codes ab', () => {
        expect(isRoomFeatureCode('SAUNA')).toBe(false);
        expect(isRoomFeatureCode('bed')).toBe(false);
        expect(isRoomFeatureCode('')).toBe(false);
    });
});
