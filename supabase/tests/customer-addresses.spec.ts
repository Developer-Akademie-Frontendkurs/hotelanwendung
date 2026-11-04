import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';
import { createFixture, isoDay, type Fixture } from './helpers/fixtures';

/**
 * Sitz- und Rechnungsadresse (E50, E51).
 *
 * Gebucht wird wie in `create-booking.spec.ts` mit dem `anonClient` – Adressen entstehen
 * ausschließlich in create_booking. Geprüft und manipuliert wird mit dem `serviceClient`:
 * Er umgeht RLS, aber nicht den Trigger und nicht die Fremdschlüssel. Genau das ist der
 * Punkt – beides soll auch gegen das Personal halten.
 */

type BookingResult = {
    bookings: { id: string }[];
    residence_address_id: string;
    billing_address_id: string | null;
};

type AddressRow = {
    id: string;
    kind: 'residence' | 'billing';
    company: string | null;
    street: string;
    country_code: string;
    archived_at: string | null;
};

type RpcError = { code?: string; details?: string | null; message: string } | null;

const RESIDENCE = { p_street: 'Teststraße', p_house_number: '1', p_postal_code: '9500', p_city: 'Villach', p_country_code: 'AT' } as const;
const BILLING = {
    p_billing_company: 'Beispiel GmbH',
    p_billing_street: 'Ringstraße',
    p_billing_house_number: '5',
    p_billing_postal_code: '1010',
    p_billing_city: 'Wien',
    p_billing_country_code: 'AT',
} as const;

let fixture: Fixture;
/** Jede Buchung bekommt ihre eigene Nacht – so nimmt kein Fall dem anderen ein Zimmer weg. */
let nextNight = 5;

/**
 * Eindeutig je Lauf über die ID der Fixture-Kategorie.
 *
 * Aufräumen lassen sich die Kunden nicht: `booking_events` ist nur anhängbar (E12), auch
 * für `service_role` – und solange ein Ereignis an der Buchung hängt, halten Buchung,
 * Adressen und Kunde (ON DELETE RESTRICT, E22). Das gilt für alle Datenbanktests mit
 * Buchungen; sauber wird die lokale Datenbank nur mit einem Reset.
 */
function email(label: string): string {
    return `adresse.${label}.${fixture.roomTypeId.slice(0, 8)}@muster.test`;
}

async function book(mail: string, overrides: Record<string, unknown> = {}): Promise<{ data: BookingResult | null; error: RpcError }> {
    const night = nextNight;
    nextNight += 1;
    const { data, error } = await anonClient.rpc('create_booking', {
        p_check_in: isoDay(night),
        p_check_out: isoDay(night + 1),
        p_positions: [{ room_type_id: fixture.roomTypeId, rooms: 1 }],
        p_adults: 2,
        p_email: mail,
        p_first_name: 'Anna',
        p_last_name: 'Beispiel',
        ...RESIDENCE,
        ...overrides,
    });
    return { data: data as BookingResult | null, error: error as RpcError };
}

/** Bucht und erwartet Erfolg. */
async function bookOk(mail: string, overrides: Record<string, unknown> = {}): Promise<BookingResult> {
    const { data, error } = await book(mail, overrides);
    expect(error).toBeNull();
    if (data === null) throw new Error('create_booking ohne Ergebnis');
    return data;
}

/** Bucht und liefert den Code der Ablehnung aus dem DETAIL-JSON (E31). */
async function rejectionCode(mail: string, overrides: Record<string, unknown>): Promise<string> {
    const { error } = await book(mail, overrides);
    expect(error?.code).toBe('P0001');
    return (JSON.parse(error?.details ?? '{}') as { code: string }).code;
}

async function customerId(mail: string): Promise<string | null> {
    const { data } = await serviceClient.from('customers').select('id').eq('email_normalized', mail.toLowerCase()).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
}

async function addressesOf(mail: string): Promise<AddressRow[]> {
    const id = await customerId(mail);
    if (id === null) return [];
    const { data, error } = await serviceClient.from('customer_addresses').select('id, kind, company, street, country_code, archived_at').eq('customer_id', id).order('created_at');
    expect(error).toBeNull();
    return data as AddressRow[];
}

beforeAll(async () => {
    fixture = await createFixture({ roomCount: 3, maxOccupancy: 2, withRatePlan: true });
    const { error } = await serviceClient.from('room_type_rates').insert({
        room_type_id: fixture.roomTypeId,
        rate_plan_id: fixture.ratePlanId,
        valid_from: isoDay(0),
        valid_to: isoDay(60),
        amount_cents: 10000,
    });
    expect(error).toBeNull();
});

afterAll(async () => {
    // Räumt ab, was ohne Buchung ist (Preise); Kategorie und Hotel halten die Buchungen fest.
    await fixture.cleanup();
});

describe('create_booking: Sitzadresse ist Pflicht (E50, E51)', () => {
    it.each([
        ['ohne Straße', { p_street: null }],
        ['mit Hausnummer nur aus Leerzeichen', { p_house_number: '   ' }],
        ['ohne PLZ', { p_postal_code: '' }],
        ['ohne Ort', { p_city: null }],
        ['ohne Land', { p_country_code: null }],
        ['mit einem Land außerhalb von is_supported_country()', { p_country_code: 'FR' }],
    ])('lehnt %s mit ungueltige_adresse ab', async (_label: string, overrides: Record<string, unknown>) => {
        expect(await rejectionCode(email('pflicht'), overrides)).toBe('ungueltige_adresse');
    });

    it('lehnt ganz ohne Adressparameter mit ungueltige_adresse ab – nicht mit PGRST202', async () => {
        const { error } = await anonClient.rpc('create_booking', {
            p_check_in: isoDay(50),
            p_check_out: isoDay(51),
            p_positions: [{ room_type_id: fixture.roomTypeId, rooms: 1 }],
            p_adults: 1,
            p_email: email('ohne-adresse'),
            p_first_name: 'Anna',
            p_last_name: 'Beispiel',
        });
        expect(error?.code).toBe('P0001');
        expect((JSON.parse(error?.details ?? '{}') as { code: string }).code).toBe('ungueltige_adresse');
    });

    it('legt bei ungueltige_adresse weder Kunde noch Adresse an', async () => {
        const mail = email('verworfen');
        await rejectionCode(mail, { p_city: '' });
        expect(await customerId(mail)).toBeNull();
    });

    it('nimmt Leerzeichen und kleingeschriebenes Land an und speichert sie bereinigt', async () => {
        const mail = email('bereinigt');
        await bookOk(mail, { p_street: '  Teststraße  ', p_country_code: ' at ' });

        const [address] = await addressesOf(mail);
        expect(address).toMatchObject({ kind: 'residence', street: 'Teststraße', country_code: 'AT', company: null, archived_at: null });
    });
});

describe('create_booking: Rechnungsadresse – alles oder nichts (E51)', () => {
    it.each([
        ['nur die Firma', { p_billing_company: 'Beispiel GmbH' }],
        ['nur die Straße', { p_billing_street: 'Ringstraße' }],
        ['ohne Hausnummer', { ...BILLING, p_billing_house_number: '' }],
        ['ohne Ort', { ...BILLING, p_billing_city: null }],
        ['mit einem Land außerhalb von is_supported_country()', { ...BILLING, p_billing_country_code: 'FR' }],
    ])('lehnt eine halbe Rechnungsadresse ab: %s', async (_label: string, overrides: Record<string, unknown>) => {
        expect(await rejectionCode(email('halb'), overrides)).toBe('ungueltige_adresse');
    });

    it('wertet ein Land allein nicht als Rechnungsadresse – das Formular schickt es nur mit', async () => {
        const mail = email('nur-land');
        const result = await bookOk(mail, { p_billing_country_code: 'DE' });

        expect(result.billing_address_id).toBeNull();
        expect((await addressesOf(mail)).map((address) => address.kind)).toEqual(['residence']);
    });

    it('legt eine vollständige Rechnungsadresse samt Firma an und verweist die Buchung darauf', async () => {
        const mail = email('rechnung');
        const result = await bookOk(mail, BILLING);

        const billing = (await addressesOf(mail)).find((address) => address.kind === 'billing');
        expect(billing).toMatchObject({ id: result.billing_address_id, company: 'Beispiel GmbH', street: 'Ringstraße' });

        const { data } = await serviceClient.from('bookings').select('residence_address_id, billing_address_id').eq('id', result.bookings[0]?.id).single();
        expect(data).toEqual({ residence_address_id: result.residence_address_id, billing_address_id: result.billing_address_id });
    });

    it('ohne Rechnungsadresse bleibt billing_address_id leer – Rechnung an die Sitzadresse', async () => {
        const result = await bookOk(email('ohne-rechnung'));
        expect(result.billing_address_id).toBeNull();
    });
});

describe('create_booking: Wiederverwendung über match_key (E51)', () => {
    it('erkennt dieselbe Sitzadresse trotz Groß-/Kleinschreibung und Leerzeichen', async () => {
        const mail = email('gleich');
        const first = await bookOk(mail);
        const second = await bookOk(mail, { p_street: '  TESTSTRAßE ', p_house_number: ' 1', p_city: 'villach' });

        expect(second.residence_address_id).toBe(first.residence_address_id);
        expect(await addressesOf(mail)).toHaveLength(1);
    });

    it('archiviert beim Umzug die alte Sitzadresse und holt sie beim Zurückziehen wieder', async () => {
        const mail = email('umzug');
        const first = await bookOk(mail);
        const moved = await bookOk(mail, { p_street: 'Hauptplatz', p_house_number: '12a' });
        expect(moved.residence_address_id).not.toBe(first.residence_address_id);

        const afterMove = await addressesOf(mail);
        expect(afterMove.find((address) => address.id === first.residence_address_id)?.archived_at).not.toBeNull();
        expect(afterMove.find((address) => address.id === moved.residence_address_id)?.archived_at).toBeNull();

        const back = await bookOk(mail);
        expect(back.residence_address_id).toBe(first.residence_address_id);

        const afterReturn = await addressesOf(mail);
        // Reaktiviert statt dupliziert – und immer genau eine aktive Sitzadresse.
        expect(afterReturn).toHaveLength(2);
        expect(afterReturn.filter((address) => address.kind === 'residence' && address.archived_at === null).map((address) => address.id)).toEqual([first.residence_address_id]);
    });

    it('verwendet dieselbe Rechnungsadresse wieder und hält verschiedene nebeneinander aktiv', async () => {
        const mail = email('rechnungen');
        const first = await bookOk(mail, BILLING);
        const same = await bookOk(mail, { ...BILLING, p_billing_company: ' beispiel   gmbh ' });
        const other = await bookOk(mail, { ...BILLING, p_billing_company: 'Andere AG' });

        expect(same.billing_address_id).toBe(first.billing_address_id);
        expect(other.billing_address_id).not.toBe(first.billing_address_id);

        const billings = (await addressesOf(mail)).filter((address) => address.kind === 'billing');
        expect(billings).toHaveLength(2);
        expect(billings.every((address) => address.archived_at === null)).toBe(true);
    });

    it('lässt alle Zimmer eines Vorgangs auf dieselben Adressen zeigen', async () => {
        const mail = email('vorgang');
        const result = await bookOk(mail, { ...BILLING, p_positions: [{ room_type_id: fixture.roomTypeId, rooms: 2 }] });
        expect(result.bookings).toHaveLength(2);

        const { data } = await serviceClient
            .from('bookings')
            .select('residence_address_id, billing_address_id')
            .in(
                'id',
                result.bookings.map((booking) => booking.id),
            );
        expect(data).toEqual([
            { residence_address_id: result.residence_address_id, billing_address_id: result.billing_address_id },
            { residence_address_id: result.residence_address_id, billing_address_id: result.billing_address_id },
        ]);
    });
});

describe('Trigger guard_customer_address_update (E43, E51)', () => {
    let used: BookingResult;
    let unused: Fixture;

    beforeAll(async () => {
        used = await bookOk(email('trigger'), BILLING);
        // Eine Adresse, an der keine Buchung hängt – angelegt von der Fixture.
        unused = await createFixture({ roomCount: 0, withCustomer: true });
    });

    afterAll(async () => {
        await unused.cleanup();
    });

    it('verbietet, eine benutzte Sitzadresse inhaltlich zu ändern – auch dem Personal', async () => {
        const { error } = await serviceClient.from('customer_addresses').update({ street: 'Korrigiert' }).eq('id', used.residence_address_id);
        expect(error?.code).toBe('55000');
    });

    it('verbietet, die Firma einer benutzten Rechnungsadresse zu ändern', async () => {
        const { error } = await serviceClient.from('customer_addresses').update({ company: 'Neue GmbH' }).eq('id', used.billing_address_id);
        expect(error?.code).toBe('55000');
    });

    it('erlaubt, eine benutzte Adresse zu archivieren – das ist der Umzug', async () => {
        const { error } = await serviceClient.from('customer_addresses').update({ archived_at: new Date().toISOString() }).eq('id', used.billing_address_id);
        expect(error).toBeNull();
    });

    it('erlaubt, eine noch unbenutzte Adresse zu korrigieren', async () => {
        const { data, error } = await serviceClient.from('customer_addresses').update({ street: 'Korrigiert' }).eq('id', unused.residenceAddressId).select('street').single();
        expect(error).toBeNull();
        expect(data).toEqual({ street: 'Korrigiert' });
    });

    it('lässt den Gast keine Adresse anlegen – Adressen entstehen nur in create_booking', async () => {
        const { error } = await anonClient
            .from('customer_addresses')
            .insert({ customer_id: unused.customerId, kind: 'residence', street: 'X', house_number: '1', postal_code: '1', city: 'X', country_code: 'AT' });
        expect(error).not.toBeNull();
    });
});

describe('Zusammengesetzte Fremdschlüssel: eine Buchung zeigt nur auf Adressen IHRES Kunden (E51)', () => {
    let own: BookingResult;
    let foreign: BookingResult;

    beforeAll(async () => {
        own = await bookOk(email('fk-eigen'));
        foreign = await bookOk(email('fk-fremd'), BILLING);
    });

    it('lehnt die Sitzadresse eines anderen Kunden ab', async () => {
        const { error } = await serviceClient.from('bookings').update({ residence_address_id: foreign.residence_address_id }).eq('id', own.bookings[0]?.id);
        expect(error?.code).toBe('23503');
    });

    it('lehnt die Rechnungsadresse eines anderen Kunden ab', async () => {
        const { error } = await serviceClient.from('bookings').update({ billing_address_id: foreign.billing_address_id }).eq('id', own.bookings[0]?.id);
        expect(error?.code).toBe('23503');
    });

    it('verlangt an einer Buchung eine Sitzadresse', async () => {
        const { error } = await serviceClient.from('bookings').update({ residence_address_id: null }).eq('id', own.bookings[0]?.id);
        expect(error?.code).toBe('23514');
    });
});
