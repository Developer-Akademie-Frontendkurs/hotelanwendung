export type DayCell = {
    date: Date;
    inCurrentMonth: boolean;
    isPast: boolean;
    isToday: boolean;
    isStart: boolean;
    isEnd: boolean;
    inRange: boolean;
    isWeekend: boolean;
    selectable: boolean;
};

/** Was das Monatsraster braucht – `today` kommt von außen, damit es testbar bleibt. */
export type CalendarMonth = {
    year: number;
    /** 0 = Januar, wie bei `Date`. */
    month: number;
    checkIn: Date | null;
    checkOut: Date | null;
    today: Date;
};

const MS_PER_DAY = 86_400_000;

/** 6 Wochen à 7 Tage: genug für jeden Monat, und das Raster springt beim Blättern nicht. */
const CALENDAR_CELLS = 42;

/**
 * Raster eines Monats, beginnend am Montag der ersten Woche – Tage aus Vor- und
 * Folgemonat füllen die erste und letzte Zeile auf.
 */
export function buildDays({ year, month, checkIn, checkOut, today }: CalendarMonth): DayCell[] {
    const startOfToday = stripTime(today);
    const firstOfMonth = new Date(year, month, 1);
    // `getDay()` zählt ab Sonntag (0) – so wird der Montag zur 0.
    const leading = (firstOfMonth.getDay() + 6) % 7;

    const cells: DayCell[] = [];
    for (let i = 0; i < CALENDAR_CELLS; i++) {
        const date = new Date(year, month, 1 - leading + i);
        const isPast = date < startOfToday;

        cells.push({
            date,
            inCurrentMonth: date.getMonth() === month,
            isPast,
            isToday: isSameDay(date, startOfToday),
            isStart: checkIn !== null && isSameDay(date, checkIn),
            isEnd: checkOut !== null && isSameDay(date, checkOut),
            inRange: checkIn !== null && checkOut !== null && date > checkIn && date < checkOut,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            selectable: !isPast,
        });
    }
    return cells;
}

/**
 * Nächte zwischen An- und Abreise – `null`, solange der Zeitraum nicht vollständig ist.
 *
 * Gerundet, weil ein Tag bei der Zeitumstellung 23 oder 25 Stunden hat.
 */
export function countNights(checkIn: Date | null, checkOut: Date | null): number | null {
    if (checkIn === null || checkOut === null) return null;
    return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

export function stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** „2026-06-13" in lokaler Zeit – `toISOString()` rechnet nach UTC um und läge nachts einen Tag daneben. */
export function toISODate(date: Date): string {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Gegenstück zu `toISODate` – `new Date('2026-06-13')` läse das Datum als UTC. */
export function parseISODate(iso: string): Date {
    const [year, month, day] = iso.split('-').map((part: string): number => Number(part));
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
