import { describe, expect, it } from 'vitest';
import { getWrappedIndex, isSlideStep } from '../roomSlider';

describe('getWrappedIndex', () => {
    it('blättert vor und zurück', () => {
        expect(getWrappedIndex(0, 1, 3)).toBe(1);
        expect(getWrappedIndex(2, -1, 3)).toBe(1);
    });

    it('beginnt nach dem letzten Zimmer wieder beim ersten', () => {
        expect(getWrappedIndex(2, 1, 3)).toBe(0);
    });

    it('springt vom ersten Zimmer zurück auf das letzte', () => {
        expect(getWrappedIndex(0, -1, 3)).toBe(2);
    });

    it('bleibt bei einem oder keinem Zimmer auf 0', () => {
        expect(getWrappedIndex(0, 1, 1)).toBe(0);
        expect(getWrappedIndex(0, -1, 0)).toBe(0);
    });
});

describe('isSlideStep', () => {
    it('akzeptiert nur -1 und 1', () => {
        expect(isSlideStep(1)).toBe(true);
        expect(isSlideStep(-1)).toBe(true);
        expect(isSlideStep(0)).toBe(false);
        expect(isSlideStep(Number.NaN)).toBe(false);
    });
});
