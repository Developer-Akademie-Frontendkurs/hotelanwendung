import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY fehlen. Lege eine .env nach dem Muster von .env.example an und starte die Datenbank mit `pnpm db:start`.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
