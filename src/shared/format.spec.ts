import { describe, expect, it } from 'vitest';
import { formatAdults, formatChildren, formatDate, formatGuests, formatNights, formatPrice, formatStayDate } from './format';

describe('formatPrice', () => {
    it('zeigt volle Euro ohne Nachkommastellen, das Symbol hinter der Zahl', () => {
        expect(formatPrice(73200, 'EUR')).toBe('732€');
    });

    it('zeigt angebrochene Euro immer mit zwei Nachkommastellen', () => {
        expect(formatPrice(850, 'EUR')).toBe('8,50€');
    });

    it('trennt Tausender mit Punkt', () => {
        expect(formatPrice(146400, 'EUR')).toBe('1.464€');
        expect(formatPrice(146450, 'EUR')).toBe('1.464,50€');
    });

    it('zeigt 0 ct als 0€', () => {
        expect(formatPrice(0, 'EUR')).toBe('0€');
    });

    it('nennt Währungen ohne eigenes Symbol mit ihrem ISO-Code', () => {
        expect(formatPrice(1999, 'CHF')).toBe('19,99 CHF');
    });
});

describe('formatDate', () => {
    it('füllt Tag und Monat auf zwei Stellen auf', () => {
        expect(formatDate(new Date(2026, 5, 3))).toBe('03.06.2026');
    });
});

describe('formatStayDate', () => {
    it('ergänzt Präposition und Uhrzeit ohne Sekunden', () => {
        expect(formatStayDate(new Date(2026, 5, 13), 'ab', '14:00:00')).toBe('13.06.2026 ab 14:00 Uhr');
    });

    it('zeigt ohne Uhrzeit nur das Datum', () => {
        expect(formatStayDate(new Date(2026, 5, 13), 'bis', null)).toBe('13.06.2026');
    });

    it('meldet ein fehlendes Datum als „noch offen"', () => {
        expect(formatStayDate(null, 'ab', '14:00:00')).toBe('noch offen');
    });
});

describe('formatAdults / formatChildren', () => {
    it('unterscheidet Einzahl und Mehrzahl', () => {
        expect(formatAdults(1)).toBe('1 Erwachsener');
        expect(formatAdults(2)).toBe('2 Erwachsene');
        expect(formatChildren(1)).toBe('1 Kind');
        expect(formatChildren(3)).toBe('3 Kinder');
    });
});

describe('formatGuests', () => {
    it('lässt die Kinder weg, wenn keine dabei sind', () => {
        expect(formatGuests(2, 0)).toBe('2 Erwachsene');
    });

    it('hängt die Kinder mit Komma an', () => {
        expect(formatGuests(1, 1)).toBe('1 Erwachsener, 1 Kind');
        expect(formatGuests(2, 3)).toBe('2 Erwachsene, 3 Kinder');
    });
});

describe('formatNights', () => {
    it('unterscheidet Einzahl und Mehrzahl', () => {
        expect(formatNights(1)).toBe('1 Nacht');
        expect(formatNights(4)).toBe('4 Nächte');
    });
});
