/**
 * Laedt die Zimmerbilder in den Storage-Bucket `room-images` (E19).
 *
 * Warum ein Skript und keine Migration: SQL kann keine Binaerdateien hochladen. Die
 * Zeilen in `room_type_images` kommen aus `seed.sql`, die Dateien von hier.
 *
 * Aufruf:  node supabase/scripts/seed-storage.mjs
 * Braucht: laufende lokale Instanz (`pnpm db:start`) und SUPABASE_SERVICE_ROLE_KEY
 *          in `.env` - der Bucket ist oeffentlich LESBAR, aber schreiben darf nur
 *          `is_staff()`, und das ist in v1 niemand (E35).
 *
 * Idempotent: `upsert: true`, damit ein zweiter Aufruf nichts kaputt macht.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUCKET = 'room-images';

// Muss zu den `storage_path`-Werten in supabase/seed.sql passen.
const IMAGES = [
    { file: 'src/assets/img/double-suite.jpg', storagePath: 'double-suite.jpg' },
    { file: 'src/assets/img/double-premium.jpg', storagePath: 'double-premium.jpg' },
];

/** Minimaler .env-Leser - das Repo hat bewusst keine dotenv-Abhaengigkeit. */
async function readEnvFile() {
    const raw = await readFile(join(REPO_ROOT, '.env'), 'utf8');
    const entries = raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const index = line.indexOf('=');
            return [line.slice(0, index), line.slice(index + 1)];
        });
    return Object.fromEntries(entries);
}

function requireEnv(env, name) {
    const value = env[name];
    if (!value || value.startsWith('<')) {
        throw new Error(`${name} fehlt in .env. Muster: .env.example, Werte aus \`pnpm db:start\`.`);
    }
    return value;
}

const env = await readEnvFile();
const client = createClient(requireEnv(env, 'VITE_SUPABASE_URL'), requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
});

let failed = false;

for (const image of IMAGES) {
    const body = await readFile(join(REPO_ROOT, image.file));
    const { error } = await client.storage.from(BUCKET).upload(image.storagePath, body, {
        contentType: 'image/jpeg',
        upsert: true,
    });

    if (error) {
        failed = true;
        console.error(`FEHLER ${image.storagePath}: ${error.message}`);
    } else {
        console.log(`hochgeladen  ${image.file} -> ${BUCKET}/${image.storagePath}`);
    }
}

if (failed) {
    process.exitCode = 1;
}
