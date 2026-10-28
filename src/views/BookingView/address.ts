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

/**
 * Die Zeile unter dem markierten Feld (per `aria-describedby` verknüpft). Die
 * Rechnungsadresse sagt dazu, welche Adresse gemeint ist – vorgelesen fehlt sonst der
 * Abschnitt, in dem das Feld steht.
 */
const FIELD_ERROR_TEXTS: Record<InvalidField, string> = {
    'customer.firstName': 'Bitte geben Sie Ihren Vornamen ein.',
    'customer.lastName': 'Bitte geben Sie Ihren Nachnamen ein.',
    'customer.email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein, z. B. maria.huber@beispiel.at.',
    'residence.street': 'Bitte geben Sie Ihre Straße ein.',
    'residence.houseNumber': 'Bitte geben Sie Ihre Hausnummer ein.',
    'residence.postalCode': 'Bitte geben Sie Ihre PLZ ein.',
    'residence.city': 'Bitte geben Sie Ihren Ort ein.',
    'residence.countryCode': 'Bitte wählen Sie Ihr Land.',
    'billing.street': 'Bitte geben Sie die Straße der Rechnungsadresse ein.',
    'billing.houseNumber': 'Bitte geben Sie die Hausnummer der Rechnungsadresse ein.',
    'billing.postalCode': 'Bitte geben Sie die PLZ der Rechnungsadresse ein.',
    'billing.city': 'Bitte geben Sie den Ort der Rechnungsadresse ein.',
    'billing.countryCode': 'Bitte wählen Sie das Land der Rechnungsadresse.',
};

export function getFieldErrorText(field: InvalidField): string {
    return FIELD_ERROR_TEXTS[field];
}

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
