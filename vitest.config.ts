import { defineConfig } from 'vitest/config';

/**
 * Unit-Tests (E34).
 *
 * Dieser Lauf muss **ohne Docker** durchlaufen — sonst schlaegt er bei jedem fehl, der nur
 * das Frontend ansieht. Die Datenbanktests liegen deshalb bewusst ausserhalb und laufen
 * ueber `pnpm test:db` (siehe `vitest.db.config.ts`).
 */
export default defineConfig({
    test: {
        include: ['src/**/*.spec.ts'],
    },
});
