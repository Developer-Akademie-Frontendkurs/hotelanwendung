import { describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';

/**
 * Rauchtest fuer das Testgeruest selbst (Phase 1).
 *
 * Er prueft keine Fachregel, sondern dass beide Clients die laufende Instanz erreichen —
 * ohne diesen Beleg weiss man bei jedem spaeteren roten Test nicht, ob die Regel falsch
 * ist oder nur die Verbindung.
 */
describe('Testgeruest', () => {
    it('erreicht die lokale Instanz mit dem Service-Role-Key', async () => {
        const { error } = await serviceClient.rpc('version');
        // `version` existiert nicht — entscheidend ist, dass PostgREST antwortet und
        // nicht die Verbindung scheitert.
        expect(error?.message).not.toContain('fetch failed');
    });

    it('erreicht die lokale Instanz mit dem anon Key', async () => {
        const { error } = await anonClient.rpc('version');
        expect(error?.message).not.toContain('fetch failed');
    });

    it('unterscheidet die beiden Clients (verschiedene Keys)', () => {
        expect(process.env['SUPABASE_SERVICE_ROLE_KEY']).not.toBe(process.env['VITE_SUPABASE_PUBLISHABLE_KEY']);
    });
});
