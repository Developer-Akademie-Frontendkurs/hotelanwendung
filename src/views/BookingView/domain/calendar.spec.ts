import { describe, expect, it } from 'vitest';
import { buildDays, countNights, isSameDay, parseISODate, stripTime, toISODate, type CalendarMonth, type DayCell } from './calendar';

// Juni 2026 beginnt an einem Montag, Oktober 2026 an einem Donnerstag.
const JUNE: CalendarMonth = { year: 2026, month: 5, checkIn: null, checkOut: null, today: new Date(2026, 5, 10) };

function findCell(cells: DayCell[], date: Date): DayCell {
    const cell = cells.find((candidate: DayCell): boolean => isSameDay(candidate.date, date));
    if (cell === undefined) throw new Error(`Kein Tag ${toISODate(date)} im Raster`);
    return cell;
}

describe('buildDays', () => {
    it('liefert immer 6 volle Wochen', () => {
        expect(buildDays(JUNE)).toHaveLength(42);
        expect(buildDays({ ...JUNE, month: 9 })).toHaveLength(42);
    });

    it('beginnt am Montag der ersten Woche', () => {
        expect(toISODate(buildDays(JUNE)[0]?.date ?? new Date(0))).toBe('2026-06-01');
        expect(toISODate(buildDays({ ...JUNE, month: 9 })[0]?.date ?? new Date(0))).toBe('2026-09-28');
    });

    it('markiert Tage aus Nachbarmonaten', () => {
        const cells = buildDays({ ...JUNE, month: 9 });
        expect(findCell(cells, new Date(2026, 8, 30)).inCurrentMonth).toBe(false);
        expect(findCell(cells, new Date(2026, 9, 1)).inCurrentMonth).toBe(true);
    });

    it('sperrt vergangene Tage, heute bleibt wählbar', () => {
        const cells = buildDays(JUNE);
        expect(findCell(cells, new Date(2026, 5, 9))).toMatchObject({ isPast: true, selectable: false });
        expect(findCell(cells, new Date(2026, 5, 10))).toMatchObject({ isPast: false, isToday: true, selectable: true });
    });

    it('ignoriert die Uhrzeit von today', () => {
        const cells = buildDays({ ...JUNE, today: new Date(2026, 5, 10, 18, 30) });
        expect(findCell(cells, new Date(2026, 5, 10))).toMatchObject({ isPast: false, isToday: true });
    });

    it('markiert An- und Abreise sowie die Nächte dazwischen', () => {
        const cells = buildDays({ ...JUNE, checkIn: new Date(2026, 5, 12), checkOut: new Date(2026, 5, 15) });
        expect(findCell(cells, new Date(2026, 5, 12))).toMatchObject({ isStart: true, inRange: false });
        expect(findCell(cells, new Date(2026, 5, 13))).toMatchObject({ isStart: false, inRange: true });
        expect(findCell(cells, new Date(2026, 5, 15))).toMatchObject({ isEnd: true, inRange: false });
        expect(findCell(cells, new Date(2026, 5, 16)).inRange).toBe(false);
    });

    it('zeigt ohne Abreise keinen Bereich', () => {
        const cells = buildDays({ ...JUNE, checkIn: new Date(2026, 5, 12) });
        expect(cells.some((cell: DayCell): boolean => cell.inRange || cell.isEnd)).toBe(false);
    });

    it('erkennt Samstag und Sonntag als Wochenende', () => {
        const cells = buildDays(JUNE);
        expect(findCell(cells, new Date(2026, 5, 13)).isWeekend).toBe(true);
        expect(findCell(cells, new Date(2026, 5, 14)).isWeekend).toBe(true);
        expect(findCell(cells, new Date(2026, 5, 15)).isWeekend).toBe(false);
    });
});

describe('countNights', () => {
    it('zählt die Nächte zwischen An- und Abreise', () => {
        expect(countNights(new Date(2026, 5, 12), new Date(2026, 5, 16))).toBe(4);
    });

    it('zählt über einen Monatswechsel', () => {
        expect(countNights(new Date(2026, 5, 29), new Date(2026, 6, 2))).toBe(3);
    });

    it('zählt über die Zeitumstellung volle Nächte', () => {
        expect(countNights(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
        expect(countNights(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
    });

    it('liefert null, solange ein Datum fehlt', () => {
        expect(countNights(null, new Date(2026, 5, 16))).toBeNull();
        expect(countNights(new Date(2026, 5, 12), null)).toBeNull();
    });
});

describe('toISODate / parseISODate', () => {
    it('füllt Monat und Tag auf zwei Stellen auf', () => {
        expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('bleibt auch spät abends beim lokalen Tag', () => {
        expect(toISODate(new Date(2026, 5, 13, 23, 59))).toBe('2026-06-13');
    });

    it('liest das Datum als lokale Mitternacht', () => {
        const date = parseISODate('2026-06-13');
        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 5, 13, 0]);
    });

    it('sind zueinander umkehrbar', () => {
        expect(toISODate(parseISODate('2026-12-31'))).toBe('2026-12-31');
    });
});

describe('stripTime / isSameDay', () => {
    it('schneidet die Uhrzeit ab', () => {
        expect(stripTime(new Date(2026, 5, 13, 18, 30)).getTime()).toBe(new Date(2026, 5, 13).getTime());
    });

    it('vergleicht nur den Kalendertag', () => {
        expect(isSameDay(new Date(2026, 5, 13, 1), new Date(2026, 5, 13, 23))).toBe(true);
        expect(isSameDay(new Date(2026, 5, 13), new Date(2026, 5, 14))).toBe(false);
    });
});
