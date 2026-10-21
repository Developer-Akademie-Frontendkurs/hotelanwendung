import { describe, expect, it } from 'vitest';
import type { BillingAddress, CustomerDetails } from '../../shared/types/booking.types';
import { emptyToNull, formatAddressLines, getCountryLabel, getInvalidFields, isCountryCode } from './address';

const BILLING: BillingAddress = { company: 'Beispiel GmbH', street: 'Ringstraße', houseNumber: '5', postalCode: '1010', city: 'Wien', countryCode: 'AT' };

/** Ein vollständiges Formular ohne Rechnungsadresse. */
function details(overrides: Partial<CustomerDetails> = {}): CustomerDetails {
    return {
        customer: { firstName: 'Erika', lastName: 'Muster', email: 'erika@beispiel.at', phone: null },
        residence: { street: 'Hauptplatz', houseNumber: '12a', postalCode: '9500', city: 'Villach', countryCode: 'AT' },
        billing: null,
        ...overrides,
    };
}

function withCustomer(customer: Partial<CustomerDetails['customer']>): CustomerDetails {
    const base = details();
    return { ...base, customer: { ...base.customer, ...customer } };
}

function withResidence(residence: Partial<CustomerDetails['residence']>): CustomerDetails {
    const base = details();
    return { ...base, residence: { ...base.residence, ...residence } };
}

describe('getInvalidFields (E50, E51)', () => {
    it('meldet nichts bei einem vollständigen Formular', () => {
        expect(getInvalidFields(details())).toEqual([]);
    });

    it('meldet ein leeres Formular Feld für Feld, in Formularreihenfolge', () => {
        const empty = details({
            customer: { firstName: '', lastName: '', email: '', phone: null },
            residence: { street: '', houseNumber: '', postalCode: '', city: '', countryCode: '' },
        });
        expect(getInvalidFields(empty)).toEqual([
            'customer.firstName',
            'customer.lastName',
            'customer.email',
            'residence.street',
            'residence.houseNumber',
            'residence.postalCode',
            'residence.city',
            'residence.countryCode',
        ]);
    });

    it('zählt Felder mit nur Leerzeichen als leer', () => {
        expect(getInvalidFields(withCustomer({ firstName: '   ' }))).toEqual(['customer.firstName']);
        expect(getInvalidFields(withResidence({ city: '\t ' }))).toEqual(['residence.city']);
    });

    it('verlangt kein Telefon – es ist optional', () => {
        expect(getInvalidFields(withCustomer({ phone: null }))).toEqual([]);
    });

    describe('E-Mail – grob geprüft wie in create_booking', () => {
        it.each(['erika@beispiel.at', 'e@b', '  erika@beispiel.at  '])('akzeptiert „%s“', (email: string) => {
            expect(getInvalidFields(withCustomer({ email }))).toEqual([]);
        });

        it.each(['erika', '@beispiel.at', 'erika@', 'eri ka@beispiel.at', 'erika@@beispiel.at'])('lehnt „%s“ ab', (email: string) => {
            expect(getInvalidFields(withCustomer({ email }))).toEqual(['customer.email']);
        });
    });

    it('akzeptiert nur Länder aus is_supported_country()', () => {
        expect(getInvalidFields(withResidence({ countryCode: 'FR' }))).toEqual(['residence.countryCode']);
        // Kleinschreibung kommt aus dem Auswahlfeld nie – die Datenbank würde sie zwar
        // hochstellen, das Formular schickt sie aber nicht.
        expect(getInvalidFields(withResidence({ countryCode: 'at' }))).toEqual(['residence.countryCode']);
    });

    describe('Rechnungsadresse – nur geprüft, wenn es eine gibt', () => {
        it('lässt eine fehlende Rechnungsadresse durch', () => {
            expect(getInvalidFields(details({ billing: null }))).toEqual([]);
        });

        it('akzeptiert eine vollständige Rechnungsadresse', () => {
            expect(getInvalidFields(details({ billing: BILLING }))).toEqual([]);
        });

        it('verlangt keine Firma', () => {
            expect(getInvalidFields(details({ billing: { ...BILLING, company: null } }))).toEqual([]);
        });

        it('meldet fehlende Felder mit dem Präfix billing', () => {
            const billing: BillingAddress = { ...BILLING, street: '', postalCode: ' ', countryCode: 'XX' };
            expect(getInvalidFields(details({ billing }))).toEqual(['billing.street', 'billing.postalCode', 'billing.countryCode']);
        });

        it('meldet Fehler in Wohn- und Rechnungsadresse zusammen', () => {
            const base = withResidence({ houseNumber: '' });
            expect(getInvalidFields({ ...base, billing: { ...BILLING, city: '' } })).toEqual(['residence.houseNumber', 'billing.city']);
        });
    });
});

describe('isCountryCode / getCountryLabel', () => {
    it('kennt die fünf Länder des Formulars', () => {
        expect(['AT', 'DE', 'CH', 'IT', 'SI'].every(isCountryCode)).toBe(true);
        expect(isCountryCode('FR')).toBe(false);
    });

    it('zeigt unbekannte Codes, wie sie sind', () => {
        expect(getCountryLabel('DE')).toBe('Deutschland');
        expect(getCountryLabel('FR')).toBe('FR');
    });
});

describe('formatAddressLines', () => {
    it('setzt die Firma vor die Anschrift', () => {
        expect(formatAddressLines(BILLING)).toEqual(['Beispiel GmbH', 'Ringstraße 5', '1010 Wien', 'Österreich']);
    });

    it('lässt leere Teile weg – das Land allein bleibt', () => {
        expect(formatAddressLines({ street: '', houseNumber: '', postalCode: '', city: '', countryCode: 'AT' })).toEqual(['Österreich']);
    });
});

describe('emptyToNull', () => {
    it('macht leeren Text zu null und trimmt den Rest', () => {
        expect(emptyToNull('   ')).toBeNull();
        expect(emptyToNull(' +43 660 1 ')).toBe('+43 660 1');
    });
});
