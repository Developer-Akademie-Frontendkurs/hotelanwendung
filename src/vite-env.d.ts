/// <reference types="vite/client" />

/**
 * Typisierung der Umgebungsvariablen (E35).
 *
 * Nur `VITE_`-Variablen sind hier deklariert — sie sind die einzigen, die Vite in den
 * Browser buendelt. `SUPABASE_SERVICE_ROLE_KEY` fehlt hier absichtlich: Er wird nur in
 * Node-Kontexten (Seeds, `pnpm test:db`) ueber `process.env` gelesen und darf im
 * Frontend-Code nicht einmal typisiert erreichbar sein.
 */
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
