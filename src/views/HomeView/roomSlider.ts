export type SlideStep = -1 | 1;

/** Moves `index` by `step` and wraps around at both ends. */
export function getWrappedIndex(index: number, step: SlideStep, count: number): number {
    if (count <= 0) return 0;
    return (((index + step) % count) + count) % count;
}

export function isSlideStep(value: number): value is SlideStep {
    return value === -1 || value === 1;
}
