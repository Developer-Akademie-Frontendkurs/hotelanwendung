import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serviceClient } from './helpers/clients';
import { createFixture, type Fixture } from './helpers/fixtures';

/**
 * Test 1 aus E34 — beweist E18.
 *
 * Die Regel "Sperrungen desselben Zimmers duerfen sich nicht ueberlappen" ist ein
 * Exclusion-Constraint, kein Anwendungscode. Ohne diesen Test faellt ein fehlendes
 * Constraint lautlos aus: es wuerde einfach doppelt gesperrt, und die Kapazitaets-
 * rechnung ab Phase 5 waere still falsch.
 */
describe('room_blocks: Ueberlappungsschutz (E18)', () => {
    let fixture: Fixture;
    let roomA: string;
    let roomB: string;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 2 });
        [roomA, roomB] = fixture.roomIds as [string, string];
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    async function block(roomId: string, startsOn: string, endsOn: string) {
        return serviceClient.from('room_blocks').insert({
            room_id: roomId,
            starts_on: startsOn,
            ends_on: endsOn,
            reason: 'renovierung',
        });
    }

    it('nimmt eine erste Sperrung an', async () => {
        const { error } = await block(roomA, '2027-03-10', '2027-03-20');
        expect(error).toBeNull();
    });

    it('LEHNT eine ueberlappende Sperrung desselben Zimmers AB', async () => {
        const { error } = await block(roomA, '2027-03-15', '2027-03-25');

        // Der Fehler IST das erwartete Ergebnis. 23P01 = exclusion_violation.
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23P01');
    });

    it('erlaubt dieselbe Ueberlappung fuer ein ANDERES Zimmer', async () => {
        // Beweist, dass der Constraint auf das Zimmer bezogen ist und nicht global
        // sperrt — sonst waere er zwar sicher, aber unbenutzbar.
        const { error } = await block(roomB, '2027-03-15', '2027-03-25');
        expect(error).toBeNull();
    });

    it('erlaubt eine Anschlusssperrung: Ende = Beginn der naechsten', async () => {
        // Halb-offene Intervalle (E8). Waere `period` geschlossen, wuerde hier der
        // Constraint zuschlagen — und im Betrieb liesse sich kein Zimmer ohne
        // Ein-Tag-Luecke durchsperren.
        const { error } = await block(roomA, '2027-03-20', '2027-03-25');
        expect(error).toBeNull();
    });

    it('LEHNT ends_on <= starts_on AB', async () => {
        const { error } = await block(roomA, '2027-05-01', '2027-05-01');
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23514'); // check_violation
    });
});
