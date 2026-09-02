import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';
import { createFixture, isoDay, type Fixture } from './helpers/fixtures';

/**
 * Test 2 aus E34 — beweist E5 — plus die Prüffunktion aus E25.
 *
 * Zwei widersprechende Preise für dieselbe Nacht wären ein Fehler, den niemand
 * bemerkt: Die Suche nähme irgendeinen der beiden, und welchen, entschiede die
 * Sortierreihenfolge. Deshalb ist es ein Constraint und keine Regel im Anwendungscode.
 */
describe('room_type_rates: Überlappungsschutz (E5)', () => {
    let fixture: Fixture;
    let ratePlanId: string;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, withRatePlan: true });
        ratePlanId = fixture.ratePlanId as string;
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    async function rate(validFrom: string, validTo: string, amountCents = 12000, planId = ratePlanId) {
        return serviceClient.from('room_type_rates').insert({
            room_type_id: fixture.roomTypeId,
            rate_plan_id: planId,
            valid_from: validFrom,
            valid_to: validTo,
            amount_cents: amountCents,
        });
    }

    it('nimmt einen ersten Saisonzeitraum an', async () => {
        const { error } = await rate('2028-01-01', '2028-02-01');
        expect(error).toBeNull();
    });

    it('LEHNT einen überlappenden Zeitraum derselben Kategorie und desselben Tarifs AB', async () => {
        const { error } = await rate('2028-01-15', '2028-03-01');
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23P01'); // exclusion_violation
    });

    it('erlaubt einen Anschlusszeitraum: valid_to = valid_from des nächsten', async () => {
        // Der halb-offene Bereich (E8) macht lückenlose Saisonketten möglich. Wäre er
        // geschlossen, müsste zwischen zwei Saisons ein Tag Abstand liegen — und der
        // wäre dann preislos und damit nicht buchbar (E25).
        const { error } = await rate('2028-02-01', '2028-03-01');
        expect(error).toBeNull();
    });

    it('LEHNT amount_cents = 0 AB — ein Preis von null ist ein Versehen (E25)', async () => {
        const { error } = await rate('2028-06-01', '2028-07-01', 0);
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514'); // check_violation
    });
});

describe('find_rate_gaps (E25)', () => {
    let fixture: Fixture;

    // Fenster: heute .. heute+40, mit einem absichtlichen Loch von Tag 10 bis Tag 17.
    const HORIZON = 40;
    const GAP_START = isoDay(10);
    const GAP_END = isoDay(17);

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1, withRatePlan: true });

        // Zwei Blöcke links und rechts des Lochs — der Rest des Fensters ist gedeckt.
        const { error } = await serviceClient.from('room_type_rates').insert([
            {
                room_type_id: fixture.roomTypeId,
                rate_plan_id: fixture.ratePlanId,
                valid_from: isoDay(0),
                valid_to: GAP_START,
                amount_cents: 11000,
            },
            {
                room_type_id: fixture.roomTypeId,
                rate_plan_id: fixture.ratePlanId,
                valid_from: GAP_END,
                valid_to: isoDay(HORIZON + 5),
                amount_cents: 11000,
            },
        ]);
        expect(error).toBeNull();
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('findet die absichtlich gerissene Lücke mit exakten Grenzen', async () => {
        const { data, error } = await serviceClient.rpc('find_rate_gaps', { tage: HORIZON });
        expect(error).toBeNull();

        const own = (data as { room_type_id: string; gap_start: string; gap_end: string; nights: number }[]).filter((row) => row.room_type_id === fixture.roomTypeId);

        expect(own).toHaveLength(1);
        expect(own[0]?.gap_start).toBe(GAP_START);
        // gap_end ist halb-offen: der erste Tag MIT Preis.
        expect(own[0]?.gap_end).toBe(GAP_END);
        expect(own[0]?.nights).toBe(7);
    });

    it('meldet für den gedeckten Seed-Bestand keine Lücke', async () => {
        // Der Gegentest zum vorigen: eine Prüffunktion, die immer etwas findet, ist
        // so wertlos wie eine, die nie etwas findet.
        const { data, error } = await serviceClient.rpc('find_rate_gaps', { tage: 365 });
        expect(error).toBeNull();

        const seedHotel = (data as { hotel_id: string }[]).filter((row) => row.hotel_id === '00000000-0000-4000-8000-000000000001');
        expect(seedHotel).toHaveLength(0);
    });

    it('ist für den Gast nicht aufrufbar', async () => {
        // Kein is_staff()-Wachposten in der Funktion, sondern das EXECUTE-Recht:
        // ein Wachposten würde in v1 auch den Service-Role-Key abweisen (E13/E35).
        const { error } = await anonClient.rpc('find_rate_gaps', { tage: 30 });
        expect(error).not.toBeNull();
        // Auf den Code festgenagelt, damit der Test nicht aus dem falschen Grund grün
        // wird — etwa weil die Funktion umbenannt wurde und PostgREST 404 liefert.
        expect(error?.code).toBe('42501'); // permission denied for function
    });

    it('lässt den Gast die Preise selbst aber lesen', async () => {
        // Preise sind öffentlich (sie stehen auf der Kategorieseite) — nur die
        // Auskunft darüber, wo welche fehlen, ist es nicht (E28).
        const { data, error } = await anonClient.from('room_type_rates').select('amount_cents').limit(1);
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
    });
});
