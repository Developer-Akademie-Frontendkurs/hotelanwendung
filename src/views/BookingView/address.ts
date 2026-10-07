/**
 * Kontaktdaten, Sitzadresse und optionale Rechnungsadresse (E50, E51).
 *
 * Die Prüfung hier ist eine **Bequemlichkeit, keine zweite Wahrheit** – dasselbe
 * Verhältnis wie bei `breakfast.ts`: Verbindlich prüft `create_booking`
 * (`ungueltige_adresse`). Was hier steht, sorgt nur dafür, dass der Gast den Fehler
 * am Feld sieht und nicht erst nach dem Absenden.
 */

import type { Address, BillingAddress, CustomerDetails } from '../../shared/types/booking.types';

/** Die Länder aus `is_supported_country()` – Reihenfolge wie im Auswahlfeld. */
export const COUNTRIES = [
    { code: 'AT', label: 'Österreich' },
    { code: 'DE', label: 'Deutschland' },
    { code: 'CH', label: 'Schweiz' },
    { code: 'IT', label: 'Italien' },
    { code: 'SI', label: 'Slowenien' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];

export const DEFAULT_COUNTRY: CountryCode = 'AT';

/** Ein Feld, das fehlt oder ungültig ist – `<Gruppe>.<Feld>`. */
export type InvalidField = `customer.${'firstName' | 'lastName' | 'email'}` | `${'residence' | 'billing'}.${'street' | 'houseNumber' | 'postalCode' | 'city' | 'countryCode'}`;

const ADDRESS_FIELDS = ['street', 'houseNumber', 'postalCode', 'city'] as const;

export function isCountryCode(value: string): value is CountryCode {
    return COUNTRIES.some((country: (typeof COUNTRIES)[number]): boolean => country.code === value);
}

/** Unbekannte Codes erscheinen so, wie sie sind – ein Land ohne Namen ist besser als keins. */
export function getCountryLabel(code: string): string {
    return COUNTRIES.find((country: (typeof COUNTRIES)[number]): boolean => country.code === code)?.label ?? code;
}

/**
 * Welche Felder noch fehlen – leer heißt: alles da.
 *
 * Die E-Mail wird nur grob geprüft (ein `@` mit etwas davor und danach), genau wie in
 * `create_booking`. Ob sie ankommt, weiß erst die Bestätigungsmail.
 */
export function getInvalidFields(details: CustomerDetails): InvalidField[] {
    const invalid: InvalidField[] = [];
    const { customer, residence, billing } = details;

    if (isBlank(customer.firstName)) invalid.push('customer.firstName');
    if (isBlank(customer.lastName)) invalid.push('customer.lastName');
    if (!/^[^\s@]+@[^\s@]+$/.test(customer.email.trim())) invalid.push('customer.email');

    for (const field of ADDRESS_FIELDS) {
        if (isBlank(residence[field])) invalid.push(`residence.${field}`);
    }
    if (!isCountryCode(residence.countryCode)) invalid.push('residence.countryCode');

    if (billing !== null) {
        for (const field of ADDRESS_FIELDS) {
            if (isBlank(billing[field])) invalid.push(`billing.${field}`);
        }
        if (!isCountryCode(billing.countryCode)) invalid.push('billing.countryCode');
    }

    return invalid;
}

/** Zeilen für die Zusammenfassung – Firma zuerst, fehlende Teile fallen weg. */
export function formatAddressLines(address: Address | BillingAddress): string[] {
    const company = 'company' in address ? address.company : null;
    const lines = [
        company ?? '',
        `${address.street.trim()} ${address.houseNumber.trim()}`,
        `${address.postalCode.trim()} ${address.city.trim()}`,
        getCountryLabel(address.countryCode),
    ];
    return lines.map((line: string): string => line.trim()).filter((line: string): boolean => line !== '');
}

/** Leerer Text wird zu `null` – für die optionalen Felder. */
export function emptyToNull(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function isBlank(value: string): boolean {
    return value.trim() === '';
}
