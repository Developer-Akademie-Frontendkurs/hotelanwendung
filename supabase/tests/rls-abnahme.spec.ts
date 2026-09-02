import { describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';

const SEED_HOTEL = '00000000-0000-4000-8000-000000000001';
const SEED_KATEGORIEN = ['00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103'];

/**
 * Phase 7 — die Abnahme.
 *
 * RLS ist seit Phase 2 aktiv (V3), jede Tabelle hat ihre Policies in derselben
 * Migration bekommen, in der sie entstand. Hier wird nichts mehr eingeschaltet,
 * hier wird geprüft — und zwar so, dass die Prüfung auch für Tabellen gilt, die
 * es heute noch nicht gibt.
 */
describe('rls_audit: Vollständigkeit (E13)', () => {
    it('meldet keinen einzigen Befund', async () => {
        const { data, error } = await serviceClient.rpc('rls_audit');
        expect(error).toBeNull();

        // Die Ausgabe im Fehlerfall ist wichtiger als die Zusicherung: Wer diesen
        // Test rot sieht, soll sofort lesen können, welche Tabelle die Policy fehlt.
        expect(data, JSON.stringify(data, null, 2)).toHaveLength(0);
    });

    it('ist für den Gast nicht aufrufbar', async () => {
        // Die Prüfung nennt Tabellennamen, Policy-Namen und Rechte. Das ist eine
        // Landkarte des Schutzes und gehört nicht in den Browser.
        const { error } = await anonClient.rpc('rls_audit');
        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501');
    });
});

/**
 * Das „Fertig, wenn" der Phase, als Verhalten statt als Katalogabfrage. Beides
 * zusammen: die Katalogprüfung sagt, dass die Regeln da sind, dieser Teil sagt,
 * dass sie wirken.
 */
describe('Verhalten des anonymen Clients', () => {
    it('bekommt bei bookings 0 Zeilen — und KEINEN Fehler', async () => {
        // Der Unterschied ist die ganze Idee von RLS: Es filtert, es blockt nicht.
        // Ein Fehler würde verraten, dass es Buchungen gibt.
        const { data, error } = await anonClient.from('bookings').select('*');
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('darf nicht direkt in bookings schreiben', async () => {
        const { error } = await anonClient.from('bookings').insert({
            customer_id: '00000000-0000-4000-8000-0000000000aa',
            room_type_id: SEED_KATEGORIEN[0],
            rate_plan_id: '00000000-0000-4000-8000-000000000201',
            check_in: '2035-01-01',
            check_out: '2035-01-03',
            adults: 1,
            total_amount_cents: 1,
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501');
    });

    it('sieht die öffentlichen Stammdaten — die Sperre ist gezielt, nicht pauschal', async () => {
        // Gegenprobe zu allem darüber. Eine Datenbank, in der der Gast NICHTS sieht,
        // wäre trivial sicher und für eine Hotelseite nutzlos.
        //
        // Gefiltert auf das Seed-Hotel: Andere Testdateien legen eigene Hotels mit
        // eigenen Kategorien an, und eine feste Zahl über den Gesamtbestand wäre nur
        // so lange richtig, bis jemand einen Test hinzufügt.
        const hotels = await anonClient.from('hotels').select('name').eq('id', SEED_HOTEL);
        const kategorien = await anonClient.from('room_types').select('slug').eq('hotel_id', SEED_HOTEL);
        const preise = await anonClient.from('room_type_rates').select('amount_cents').limit(1);
        const bilder = await anonClient.from('room_type_images').select('alt_text').in('room_type_id', SEED_KATEGORIEN);

        expect(hotels.error).toBeNull();
        expect(hotels.data).toHaveLength(1);
        expect(kategorien.data).toHaveLength(3);
        expect(preise.data).toHaveLength(1);
        expect(bilder.data).toHaveLength(2);
    });

    it('darf die drei öffentlichen Funktionen aufrufen — und sonst keine', async () => {
        // Jede Funktion wird mit ihrer ECHTEN Signatur aufgerufen. Ein Aufruf mit
        // leeren Argumenten liefert PGRST202 ("keine passende Funktion") — und dieser
        // Test wäre dann grün, ohne je ein Recht geprüft zu haben.
        const oeffentlich: Record<string, Record<string, unknown>> = {
            availability_calendar: { p_from: '2035-01-01', p_to: '2035-01-02', p_adults: 2 },
            search_availability: { p_check_in: '2035-01-01', p_check_out: '2035-01-03', p_adults: 2 },
            // Absichtlich mit ungültigem Zeitraum: Der Aufruf soll fachlich scheitern
            // (P0001), nicht an den Rechten — und keine echte Buchung anlegen.
            create_booking: {
                p_check_in: '2035-01-03',
                p_check_out: '2035-01-01',
                p_room_type_id: SEED_KATEGORIEN[0],
                p_adults: 2,
                p_email: 'rechtepruefung@muster.test',
                p_first_name: 'Test',
                p_last_name: 'Test',
            },
        };
        const intern: Record<string, Record<string, unknown>> = {
            availability_nights: { p_hotel_id: SEED_HOTEL, p_from: '2035-01-01', p_to: '2035-01-02', p_adults: 2 },
            find_rate_gaps: { tage: 30 },
            reject_booking: { p_code: 'ausgebucht' },
            rls_audit: {},
        };

        for (const [name, args] of Object.entries(oeffentlich)) {
            const { error } = await anonClient.rpc(name, args);
            expect(error?.code, `${name} sollte für anon erlaubt sein`).not.toBe('42501');
            expect(error?.code, `${name} muss für anon auffindbar sein`).not.toBe('PGRST202');
        }

        for (const [name, args] of Object.entries(intern)) {
            const { error } = await anonClient.rpc(name, args);
            expect(error?.code, `${name} darf für anon NICHT erlaubt sein`).toBe('42501');
        }
    });
});
