import type { UnavailableReason } from '../../../shared/types/booking.codes';
import type { NightAvailability } from '../../../shared/types/catalog.types';

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
    blocked: boolean;
    blockReason: UnavailableReason | null;
};

export type CalendarRules = {
    today: Date;
    horizonDays: number | null;
    nights: NightAvailability | null;
};

export type CalendarMonth = {
    year: number;
    month: number;
    checkIn: Date | null;
    checkOut: Date | null;
    rules: CalendarRules;
};

const MS_PER_DAY = 86_400_000;
const CALENDAR_CELLS = 42;

export function buildDays({ year, month, checkIn, checkOut, rules }: CalendarMonth): DayCell[] {
    const startOfToday = stripTime(rules.today);
    const awaitingCheckOut = checkIn !== null && checkOut === null;
    const firstOfMonth = new Date(year, month, 1);
    const leading = (firstOfMonth.getDay() + 6) % 7;

    const cells: DayCell[] = [];
    for (let i = 0; i < CALENDAR_CELLS; i++) {
        const date = new Date(year, month, 1 - leading + i);
        const isPast = date < startOfToday;
        const selectable = isSelectableAsCheckIn(date, rules) || (awaitingCheckOut && isSelectableAsCheckOut(date, checkIn, rules));

        cells.push({
            date,
            inCurrentMonth: date.getMonth() === month,
            isPast,
            isToday: isSameDay(date, startOfToday),
            isStart: checkIn !== null && isSameDay(date, checkIn),
            isEnd: checkOut !== null && isSameDay(date, checkOut),
            inRange: checkIn !== null && checkOut !== null && date > checkIn && date < checkOut,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            selectable,
            blocked: !selectable && !isPast,
            blockReason: getNightBlockReason(date, rules),
        });
    }
    return cells;
}

export function getNightBlockReason(night: Date, rules: CalendarRules): UnavailableReason | null {
    const today = stripTime(rules.today);
    if (night < today) return 'vergangenheit';
    if (rules.horizonDays !== null && night >= addDays(today, rules.horizonDays)) return 'ausserhalb_horizont';

    const status = rules.nights?.get(toISODate(night));
    if (status === undefined || status.available) return null;
    return status.reason ?? 'nicht_buchbar';
}

export function isSelectableAsCheckIn(date: Date, rules: CalendarRules): boolean {
    return getNightBlockReason(date, rules) === null;
}

export function isSelectableAsCheckOut(date: Date, checkIn: Date, rules: CalendarRules): boolean {
    if (date <= checkIn) return false;
    for (let night = stripTime(checkIn); night < date; night = addDays(night, 1)) {
        if (getNightBlockReason(night, rules) !== null) return false;
    }
    return true;
}

export function canGoPrev(year: number, month: number, rules: CalendarRules): boolean {
    const today = stripTime(rules.today);
    return new Date(year, month, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
}

export function canGoNext(year: number, month: number, rules: CalendarRules): boolean {
    if (rules.horizonDays === null) return true;
    return new Date(year, month + 1, 1) <= addDays(stripTime(rules.today), rules.horizonDays);
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

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

export function toISODate(date: Date): string {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
    const [year, month, day] = iso.split('-').map((part: string): number => Number(part));
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
