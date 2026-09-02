import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';
import { createFixture, type Fixture } from './helpers/fixtures';

/**
 * RLS auf den Stammdaten (E13, V3).
 *
 * Diese Tests gehoeren nicht zu den sechs aus E34, kosten aber je zwei Zeilen — und
 * sie pruefen die Eigenschaft, die am leisesten ausfaellt: eine fehlende Policy
 * merkt man nicht, weil alles funktioniert. Nur zu viel ist sichtbar.
 *
 * Entscheidend ist, dass hier der `anonClient` benutzt wird. Mit dem Service-Role-Key
 * ist jeder dieser Tests gruen, weil er RLS umgeht — mit nur einem Client testet man
 * RLS nie.
 */
describe('RLS: Stammdaten', () => {
    let fixture: Fixture;

    beforeAll(async () => {
        fixture = await createFixture({ roomCount: 1 });
    });

    afterAll(async () => {
        await fixture.cleanup();
    });

    it('Gast darf hotels lesen (Impressumsdaten sind oeffentlich)', async () => {
        const { data, error } = await anonClient.from('hotels').select('name').eq('id', fixture.hotelId);
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
    });

    it('Gast darf aktive room_types lesen', async () => {
        const { data, error } = await anonClient.from('room_types').select('name').eq('id', fixture.roomTypeId);
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
    });

    it('Gast sieht archivierte room_types NICHT (E22)', async () => {
        await serviceClient
            .from('room_types')
            .update({ archived_at: new Date('2027-01-01').toISOString() })
            .eq('id', fixture.roomTypeId);

        const { data, error } = await anonClient.from('room_types').select('name').eq('id', fixture.roomTypeId);
        expect(error).toBeNull();
        expect(data).toHaveLength(0);

        await serviceClient.from('room_types').update({ archived_at: null }).eq('id', fixture.roomTypeId);
    });

    it('Gast bekommt bei rooms 0 Zeilen — keinen Fehler', async () => {
        // Der Unterschied ist wichtig: RLS filtert, es blockt nicht. Ein Fehler
        // wuerde verraten, dass die Tabelle existiert und Zeilen enthaelt.
        const { data, error } = await anonClient.from('rooms').select('room_number');
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('Gast bekommt bei room_blocks 0 Zeilen', async () => {
        const { data, error } = await anonClient.from('room_blocks').select('reason');
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('Gast darf nicht in hotels schreiben', async () => {
        const { error } = await anonClient.from('hotels').insert({
            name: 'Fremdes Hotel',
            check_in_time: '15:00',
            check_out_time: '11:00',
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501'); // insufficient_privilege
    });

    it('Gast darf keine Sperrung anlegen', async () => {
        const { error } = await anonClient.from('room_blocks').insert({
            room_id: fixture.roomIds[0],
            starts_on: '2027-08-01',
            ends_on: '2027-08-05',
            reason: 'eigenbelegung',
        });
        expect(error).not.toBeNull();
    });

    it('alt_text ist NOT NULL — Barrierefreiheit ist nicht optional (E19)', async () => {
        const { error } = await serviceClient.from('room_type_images').insert({
            room_type_id: fixture.roomTypeId,
            storage_path: 'ohne-alt.jpg',
            alt_text: null,
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23502'); // not_null_violation
    });
});
