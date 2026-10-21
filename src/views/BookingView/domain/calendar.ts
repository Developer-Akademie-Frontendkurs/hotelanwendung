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
    /** Nicht wählbar, aber auch nicht vorbei – wird durchgestrichen und bekommt einen Tooltip (E24). */
    blocked: boolean;
    /** Warum die Nacht ab diesem Tag nicht buchbar ist – `null`, wenn sie es ist. */
    blockReason: UnavailableReason | null;
};

/** Alles, wonach ein Tag wählbar ist oder nicht. `today` kommt von außen, damit es testbar bleibt. */
export type CalendarRules = {
    today: Date;
    /** `hotels.booking_horizon_days` (E30) – `null`, solange das Hotel nicht geladen ist: dann ohne Grenze. */
    horizonDays: number | null;
    /**
     * `null` heißt: keine Daten – noch keine Belegung gewählt (V16.7) oder Laden fehlgeschlagen.
     * Dann sperrt nur das Datum; verbindlich prüft ohnehin `create_booking` (E24: Komfort,
     * keine Garantie).
     */
    nights: NightAvailability | null;
};

/** Was das Monatsraster braucht. */
export type CalendarMonth = {
    year: number;
    /** 0 = Januar, wie bei `Date`. */
    month: number;
    checkIn: Date | null;
    checkOut: Date | null;
    rules: CalendarRules;
};

const MS_PER_DAY = 86_400_000;

/** 6 Wochen à 7 Tage: genug für jeden Monat, und das Raster springt beim Blättern nicht. */
const CALENDAR_CELLS = 42;

/**
 * Raster eines Monats, beginnend am Montag der ersten Woche – Tage aus Vor- und
 * Folgemonat füllen die erste und letzte Zeile auf.
 */
export function buildDays({ year, month, checkIn, checkOut, rules }: CalendarMonth): DayCell[] {
    const startOfToday = stripTime(rules.today);
    // Steht die Anreise, aber noch keine Abreise, ist jeder spätere Tag ein Kandidat für
    // die Abreise – und bleibt zugleich ein möglicher neuer Anreisetag.
    const awaitingCheckOut = checkIn !== null && checkOut === null;
    const firstOfMonth = new Date(year, month, 1);
    // `getDay()` zählt ab Sonntag (0) – so wird der Montag zur 0.
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

/**
 * Warum die Nacht, die an `night` beginnt, nicht buchbar ist – `null`, wenn sie es ist.
 *
 * Vergangenheit und Horizont stehen vor den Daten aus der Datenbank: Was zeitlich
 * unmöglich ist, soll nicht als „nicht buchbar" erscheinen (dieselbe Reihenfolge wie in
 * `availability_calendar`).
 */
export function getNightBlockReason(night: Date, rules: CalendarRules): UnavailableReason | null {
    const today = stripTime(rules.today);
    if (night < today) return 'vergangenheit';
    if (rules.horizonDays !== null && night >= addDays(today, rules.horizonDays)) return 'ausserhalb_horizont';

    const status = rules.nights?.get(toISODate(night));
    if (status === undefined || status.available) return null;
    return status.reason ?? 'nicht_buchbar';
}

/** Anreisetag: Die Nacht, die an diesem Tag beginnt, muss frei sein (E29). */
export function isSelectableAsCheckIn(date: Date, rules: CalendarRules): boolean {
    return getNightBlockReason(date, rules) === null;
}

/**
 * Abreisetag: Jede Nacht von der Anreise bis zur Nacht VOR diesem Tag muss frei sein.
 *
 * Die Nacht, die am Abreisetag beginnt, zählt nicht – ein als Nacht ausgebuchter Tag ist
 * als Abreisetag völlig legitim, und genau davon leben Anschlussbuchungen (E8, E29).
 * Geprüft wird die ganze Kette, nicht nur die Vornacht: Ein Zeitraum über eine volle
 * Nacht hinweg ist nicht buchbar, auch wenn die letzte Nacht frei ist.
 */
export function isSelectableAsCheckOut(date: Date, checkIn: Date, rules: CalendarRules): boolean {
    if (date <= checkIn) return false;
    for (let night = stripTime(checkIn); night < date; night = addDays(night, 1)) {
        if (getNightBlockReason(night, rules) !== null) return false;
    }
    return true;
}

/** Zurückblättern höchstens bis zum laufenden Monat. */
export function canGoPrev(year: number, month: number, rules: CalendarRules): boolean {
    const today = stripTime(rules.today);
    return new Date(year, month, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
}

/**
 * Vorwärts höchstens bis zum Monat mit dem letzten wählbaren Tag (E30, V14). Das ist der
 * Abreisetag nach der letzten buchbaren Nacht – deshalb `<=` und nicht `<`.
 */
export function canGoNext(year: number, month: number, rules: CalendarRules): boolean {
    if (rules.horizonDays === null) return true;
    return new Date(year, month + 1, 1) <= addDays(stripTime(rules.today), rules.horizonDays);
}

/** Lokale Kalendertage, nicht 24-Stunden-Schritte – die Zeitumstellung soll kein Datum verschieben. */
export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
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
