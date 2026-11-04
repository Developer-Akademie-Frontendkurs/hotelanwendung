import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY fehlen. Lege eine .env nach dem Muster von .env.example an und starte die Datenbank mit `pnpm db:start`.');
}

// Typisiert mit den generierten Typen (V8): Benennt eine Migration eine Spalte um, wird
// das nach `pnpm db:types` hier zum Typfehler statt im Browser zu `undefined`.
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey);
