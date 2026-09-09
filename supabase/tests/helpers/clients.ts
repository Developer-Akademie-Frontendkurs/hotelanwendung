import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Zwei Clients, zwei Rollen (E34).
 *
 * - `serviceClient` umgeht RLS und legt Fixtures an. Er steht fuer „das Personal bzw. das
 *   Seed-Skript" und darf alles.
 * - `anonClient` ist der Gast im Browser. Mit ihm — und nur mit ihm — laesst sich pruefen,
 *   ob RLS wirklich schuetzt. Mit nur einem Client testet man RLS nie (E13).
 */

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.startsWith('<')) {
        throw new Error(`${name} fehlt. Lege eine .env nach dem Muster von .env.example an und starte die Datenbank mit \`pnpm db:start\`.`);
    }
    return value;
}

const url = requireEnv('VITE_SUPABASE_URL');

const noPersistedSession = {
    auth: { persistSession: false, autoRefreshToken: false },
} as const;

export const serviceClient: SupabaseClient = createClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), noPersistedSession);

export const anonClient: SupabaseClient = createClient(url, requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'), noPersistedSession);
