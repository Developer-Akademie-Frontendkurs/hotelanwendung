/**
 * Codes, die die Datenbank vorgibt – deutsch, weil sie so in den SQL-Funktionen stehen.
 *
 * Aus der Datenbank kommen sie als beliebiger Text. Erst `isUnavailableReason()` bzw.
 * `isRejectionCode()` an der Grenze macht daraus den engen Typ; ab dort darf der Code
 * dem Typ vertrauen. Kommt ein neuer Code dazu, gehört er hier in die Liste – die
 * Texttabellen in `messages.ts` melden dann per Compilerfehler, wo der Satz fehlt.
 */

/** Gründe aus `search_availability` (`unavailable_reason`), für Gäste per `mask_reason` vergröbert (E28). */
export const UNAVAILABLE_REASONS = ['nicht_buchbar', 'vergangenheit', 'ausserhalb_horizont', 'ausgebucht', 'kein_preis', 'zu_klein'] as const;

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

/** Codes aus `reject_booking` (E31): die Gründe der Verfügbarkeit plus die Prüfungen von `create_booking`. */
export const REJECTION_CODES = [
    ...UNAVAILABLE_REASONS,
    'ungueltiger_zeitraum',
    'kategorie_unbekannt',
    'ungueltige_belegung',
    'ungueltige_leistung',
    'leistung_unbekannt',
    'ungueltige_adresse',
] as const;

export type RejectionCode = (typeof REJECTION_CODES)[number];

export function isUnavailableReason(value: string): value is UnavailableReason {
    return (UNAVAILABLE_REASONS as readonly string[]).includes(value);
}

export function isRejectionCode(value: string): value is RejectionCode {
    return (REJECTION_CODES as readonly string[]).includes(value);
}
