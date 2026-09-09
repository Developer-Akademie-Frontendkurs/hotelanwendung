import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Datenbanktests (E34) — brauchen eine laufende lokale Instanz (`pnpm db:start`).
 *
 * Das leere Praefix in `loadEnv` laedt **alle** Variablen aus `.env`, nicht nur die mit
 * `VITE_`. Genau deshalb ist das hier und nicht in `vite.config.ts`: Der Service-Role-Key
 * wird fuer Fixtures gebraucht, darf aber nie in einen Browser-Bundle geraten (E35).
 */
const env = loadEnv('', process.cwd(), '');

export default defineConfig({
    test: {
        include: ['supabase/tests/**/*.spec.ts'],
        env,
        // Fixtures teilen sich eine Datenbank; parallele Dateien wuerden sich
        // gegenseitig die Kapazitaetsrechnung verfaelschen.
        fileParallelism: false,
        testTimeout: 20_000,
    },
});
