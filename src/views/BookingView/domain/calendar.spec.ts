import { describe, expect, it } from 'vitest';
import type { NightAvailability, NightStatus } from '../../../shared/types/catalog.types';
import {
    addDays,
    buildDays,
    canGoNext,
    canGoPrev,
    countNights,
    getNightBlockReason,
    isSameDay,
    isSelectableAsCheckIn,
    isSelectableAsCheckOut,
    parseISODate,
    stripTime,
    toISODate,
    type CalendarMonth,
    type CalendarRules,
    type DayCell,
} from './calendar';

// Juni 2026 beginnt an einem Montag, Oktober 2026 an einem Donnerstag.
const TODAY = new Date(2026, 5, 10);
const NO_DATA: CalendarRules = { today: TODAY, horizonDays: null, nights: null };
const JUNE: CalendarMonth = { year: 2026, month: 5, checkIn: null, checkOut: null, rules: NO_DATA };

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
        const cells = buildDays({ ...JUNE, rules: { ...NO_DATA, today: new Date(2026, 5, 10, 18, 30) } });
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

/** Nächte ab heute: `true` = frei. Index 0 ist die Nacht, die heute beginnt. */
function nightsFrom(today: Date, free: readonly boolean[]): NightAvailability {
    return new Map(
        free.map((available: boolean, offset: number): [string, NightStatus] => [toISODate(addDays(today, offset)), { available, reason: available ? null : 'nicht_buchbar' }]),
    );
}

/** Wie das Beispiel in E29: Nächte am 12., 13., 14. frei, die Nacht am 15. voll. */
const E29_RULES: CalendarRules = { today: new Date(2026, 5, 12), horizonDays: 30, nights: nightsFrom(new Date(2026, 5, 12), [true, true, true, false, true]) };
const day = (date: number): Date => new Date(2026, 5, date);

describe('Tagesregeln (E29)', () => {
    it('sperrt eine volle Nacht als Anreisetag …', () => {
        expect(isSelectableAsCheckIn(day(15), E29_RULES)).toBe(false);
    });

    it('… und lässt denselben Tag als Abreisetag zu – die Anschlussbuchung (Fertig-Kriterium Phase 9)', () => {
        expect(isSelectableAsCheckOut(day(15), day(12), E29_RULES)).toBe(true);
    });

    it('lässt keinen Zeitraum über eine volle Nacht hinweg zu', () => {
        expect(isSelectableAsCheckOut(day(17), day(12), E29_RULES)).toBe(false);
        expect(isSelectableAsCheckOut(day(16), day(14), E29_RULES)).toBe(false);
    });

    it('verlangt eine Abreise nach der Anreise', () => {
        expect(isSelectableAsCheckOut(day(12), day(12), E29_RULES)).toBe(false);
        expect(isSelectableAsCheckOut(day(11), day(12), E29_RULES)).toBe(false);
    });

    it('lässt ohne Daten alles zu, was nicht vorbei ist – verbindlich prüft create_booking', () => {
        expect(isSelectableAsCheckIn(day(15), { ...E29_RULES, nights: null })).toBe(true);
        expect(isSelectableAsCheckIn(day(11), { ...E29_RULES, nights: null })).toBe(false);
    });
});

describe('getNightBlockReason', () => {
    it('nennt Vergangenheit und Horizont vor den Daten der Datenbank', () => {
        expect(getNightBlockReason(day(11), E29_RULES)).toBe('vergangenheit');
        // 30 Tage ab dem 12. Juni: die letzte buchbare Nacht beginnt am 11. Juli.
        expect(getNightBlockReason(new Date(2026, 6, 11), E29_RULES)).toBeNull();
        expect(getNightBlockReason(new Date(2026, 6, 12), E29_RULES)).toBe('ausserhalb_horizont');
    });

    it('übernimmt den Grund der Nacht, ohne Grund nicht_buchbar', () => {
        const nights: NightAvailability = new Map([
            [toISODate(day(13)), { available: false, reason: 'ausgebucht' }],
            [toISODate(day(14)), { available: false, reason: null }],
        ]);
        expect(getNightBlockReason(day(13), { ...E29_RULES, nights })).toBe('ausgebucht');
        expect(getNightBlockReason(day(14), { ...E29_RULES, nights })).toBe('nicht_buchbar');
        expect(getNightBlockReason(day(12), { ...E29_RULES, nights })).toBeNull();
    });

    it('lässt den Abreisetag nach der letzten Horizontnacht zu', () => {
        expect(isSelectableAsCheckOut(new Date(2026, 6, 12), new Date(2026, 6, 10), { ...E29_RULES, nights: null })).toBe(true);
        expect(isSelectableAsCheckOut(new Date(2026, 6, 13), new Date(2026, 6, 10), { ...E29_RULES, nights: null })).toBe(false);
    });
});

describe('buildDays mit Verfügbarkeit', () => {
    const month: CalendarMonth = { year: 2026, month: 5, checkIn: null, checkOut: null, rules: E29_RULES };

    it('streicht die volle Nacht als Anreisetag durch und nennt den Grund', () => {
        expect(findCell(buildDays(month), day(15))).toMatchObject({ selectable: false, blocked: true, blockReason: 'nicht_buchbar' });
    });

    it('macht denselben Tag wählbar, sobald eine Anreise davor steht', () => {
        expect(findCell(buildDays({ ...month, checkIn: day(12) }), day(15))).toMatchObject({ selectable: true, blocked: false });
    });

    it('lässt Tage hinter der Lücke als neue Anreise wählbar', () => {
        expect(findCell(buildDays({ ...month, checkIn: day(12) }), day(16))).toMatchObject({ selectable: true, blocked: false });
    });

    it('streicht Vergangenes nicht durch – es ist einfach vorbei', () => {
        expect(findCell(buildDays(month), day(11))).toMatchObject({ selectable: false, blocked: false, isPast: true });
    });

    it('streicht Tage jenseits des Horizonts durch', () => {
        const july: CalendarMonth = { ...month, month: 6 };
        expect(findCell(buildDays(july), new Date(2026, 6, 20))).toMatchObject({ blocked: true, blockReason: 'ausserhalb_horizont' });
    });
});

describe('canGoPrev / canGoNext (E30)', () => {
    const rules: CalendarRules = { today: new Date(2026, 5, 12), horizonDays: 365, nights: null };

    it('blättert nicht vor den laufenden Monat zurück', () => {
        expect(canGoPrev(2026, 5, rules)).toBe(false);
        expect(canGoPrev(2026, 6, rules)).toBe(true);
    });

    it('blättert bis zum Monat mit dem letzten wählbaren Tag, nicht darüber hinaus', () => {
        // 365 Tage ab dem 12.06.2026: letzter Abreisetag 12.06.2027.
        expect(canGoNext(2027, 4, rules)).toBe(true);
        expect(canGoNext(2027, 5, rules)).toBe(false);
    });

    it('zeigt den Monat, in dem nur noch der Abreisetag liegt', () => {
        // Horizont endet genau am Monatsersten: Der 01.07. ist noch Abreisetag.
        expect(canGoNext(2026, 5, { ...rules, horizonDays: 19 })).toBe(true);
        expect(canGoNext(2026, 5, { ...rules, horizonDays: 18 })).toBe(false);
    });

    it('kennt ohne geladenes Hotel keine Grenze', () => {
        expect(canGoNext(2040, 0, { ...rules, horizonDays: null })).toBe(true);
    });
});
