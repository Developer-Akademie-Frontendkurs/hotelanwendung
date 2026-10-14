/** Währungen mit eigenem Symbol – alle anderen erscheinen mit ihrem ISO-Code. */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { EUR: '€' };

/**
 * Zahl vor dem Symbol wie im Design ("732€") – `style: 'currency'` würde das € voranstellen.
 *
 * Bewusst `de-DE` statt `de-AT`: Österreich trennt Tausender laut Unicode-Standard (CLDR)
 * mit einem geschützten Leerzeichen („1 464"), gewünscht ist der Punkt („1.464").
 *
 * Volle Euro bleiben ohne Nachkommastellen, alles andere bekommt genau zwei: Sonst
 * stünde der Kinderpreis von 850 ct als „8,5€" da – als Betrag gelesen ein Tippfehler.
 */
export function formatPrice(cents: number, currency: string): string {
    const digits = cents % 100 === 0 ? 0 : 2;
    const amount = new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
    const symbol = CURRENCY_SYMBOLS[currency];
    return symbol === undefined ? `${amount} ${currency}` : `${amount}${symbol}`;
}

/** „13.06.2026" – Tag und Monat immer zweistellig. */
export function formatDate(date: Date): string {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString()}`;
}

/** „13.06.2026 ab 14:00 Uhr" wie im Entwurf – ohne geladene Hotelzeile nur das Datum. */
export function formatStayDate(date: Date | null, preposition: string, time: string | null): string {
    if (date === null) return 'noch offen';

    const day = formatDate(date);
    // `time` kommt als "14:00:00" – die Sekunden interessieren niemanden.
    return time === null ? day : `${day} ${preposition} ${time.slice(0, 5)} Uhr`;
}

export function formatAdults(adults: number): string {
    return adults === 1 ? '1 Erwachsener' : `${adults.toString()} Erwachsene`;
}

export function formatChildren(children: number): string {
    return children === 1 ? '1 Kind' : `${children.toString()} Kinder`;
}

/** „2 Erwachsene, 1 Kind" – ohne Kinder nur die Erwachsenen. */
export function formatGuests(adults: number, children: number): string {
    const adultText = formatAdults(adults);
    return children === 0 ? adultText : `${adultText}, ${formatChildren(children)}`;
}

export function formatNights(nights: number): string {
    return nights === 1 ? '1 Nacht' : `${nights.toString()} Nächte`;
}
