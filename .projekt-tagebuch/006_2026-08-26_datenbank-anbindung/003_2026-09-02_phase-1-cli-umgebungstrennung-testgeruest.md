[← Vorheriger Commit](002_2026-09-02_runde-6-und-vorgehensentscheidungen.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(db): Phase 1 - Supabase-CLI, Umgebungstrennung, Testgeruest

- **Commit:** `cdb1af7`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Der erste Commit mit Code. Ziel der Phase 1: **Schema als Code, lokal reproduzierbar** – und zwar ohne die bestehende Cloud-Instanz anzufassen (`V2`).

Bis hierher lief die Anwendung gegen eine Supabase-Datenbank in der Cloud, deren Struktur nur dort existierte. Wer das Projekt klonte, bekam den Code, aber nicht die Tabellen. Nach dieser Phase gilt: Ein `pnpm db:reset` baut die komplette Datenbank aus Dateien im Repository neu auf.

```text
 .env                              |   2 -
 .env.example                      |  14 ++
 .gitignore                        |  10 +
 eslint.config.ts                  |   8 +
 package.json                      |   8 +
 src/shared/services/supabase.ts   |   9 +-
 src/vite-env.d.ts                 |  18 ++
 supabase/config.toml              | 413 ++++++++++++++++++++++++++++++++++++++
 supabase/seed.sql                 |   8 +
 supabase/tests/helpers/clients.ts |  28 +++
 supabase/tests/smoke.spec.ts      |  27 +++
 vitest.config.ts                  |  14 ++
 vitest.db.config.ts               |  22 ++
 13 files changed, 578 insertions(+), 3 deletions(-)
```

Noch keine einzige Tabelle – aber alles, was nötig ist, um im nächsten Commit welche anzulegen.

## 1. Die Supabase-CLI als Dev-Dependency

```diff
     "devDependencies": {
         "globals": "^17.5.0",
         "jiti": "^2.6.1",
         "prettier": "3.8.3",
+        "supabase": "^2.116.0",
         "typescript": "~6.0.2",
```

Bewusst **nicht global** installiert (`npm i -g supabase`). Der Grund ist derselbe wie bei jeder anderen Abhängigkeit: Eine global installierte CLI hat auf jeder Maschine eine andere Version, und Migrationswerkzeuge sind versionsempfindlich. Als Dev-Dependency steht die Version in `package.json` und `pnpm-lock.yaml` – alle im Team arbeiten mit derselben.

Dazu die neuen Skripte:

```diff
     "scripts": {
         "dev": "vite",
         "build": "tsc && vite build",
         "preview": "vite preview",
         "test": "vitest",
+        "test:db": "vitest run --config vitest.db.config.ts",
+        "db:start": "supabase start",
+        "db:stop": "supabase stop",
+        "db:reset": "supabase db reset",
+        "db:diff": "supabase db diff",
+        "db:types": "supabase gen types typescript --local > src/shared/types/database.types.ts",
         "lint": "eslint .",
```

Was diese Befehle tun:

| Skript     | Wirkung                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| `db:start` | startet eine komplette Supabase-Umgebung in Docker (Postgres, PostgREST, Storage, …) |
| `db:stop`  | fährt sie herunter                                                                   |
| `db:reset` | **löscht** die lokale Datenbank und spielt alle Migrationen + `seed.sql` neu ein     |
| `db:diff`  | vergleicht den Ist-Zustand mit den Migrationen und schreibt die Differenz als SQL    |
| `db:types` | erzeugt TypeScript-Typen aus dem Schema                                              |

`db:reset` ist dabei der wichtigste. Er ist der Beweis, dass das Schema wirklich als Code existiert: Was ein Reset nicht wiederherstellt, ist verloren.

Außerdem wird der Paketmanager festgenagelt:

```diff
     "type": "module",
+    "packageManager": "pnpm@10.33.2",
```

Die Commit-Message erklärt, warum das nötig wurde:

```text
packageManager auf pnpm@10.33.2 gepinnt - node_modules wurde damit gebaut,
Corepack loeste sonst auf 11.x auf und wollte node_modules neu installieren.
```

Ein typischer Werkzeug-Stolperstein: Corepack liest das Feld `packageManager` und benutzt genau die dort genannte Version. Fehlt das Feld, nimmt es die neueste – und die legt `node_modules` anders an.

## 2. Umgebungstrennung: die `.env` verlässt Git

Der auffälligste Teil des Diffs sind zwei Zeilen, die **verschwinden**:

```diff
--- a/.env
+++ /dev/null
@@ -1,2 +0,0 @@
-…
```

Die `.env` war bisher in Git eingecheckt. Sie wird mit `git rm --cached .env` aus dem Index genommen – die Datei bleibt lokal bestehen, ist aber nicht mehr Teil des Repositorys. Dazu passende Regeln in `.gitignore`:

```gitignore
# Umgebung (E35) - nur .env.example gehoert ins Repo
.env
.env.*
!.env.example

# Supabase CLI
supabase/.temp
supabase/.branches
.pnpm-store
```

Die Reihenfolge dieser drei Zeilen ist bedeutungstragend. `.env.*` schließt alle Varianten aus (`.env.local`, `.env.production`), und `!.env.example` nimmt eine davon wieder herein. Das Ausrufezeichen ist in `.gitignore` die Negation – und sie muss **nach** dem allgemeineren Muster stehen, sonst wirkt sie nicht.

An die Stelle der `.env` tritt eine Vorlage:

```ini
# Lokale Supabase-Instanz (E35).
#
# Diese Werte sind KEINE Geheimnisse: `supabase start` erzeugt aus einem festen
# JWT-Secret auf jeder Maschine dieselben lokalen Demo-Keys. Der Schutz ist RLS
# (E13), nicht die Verborgenheit des Keys.
#
# Einrichten:  cp .env.example .env && pnpm db:start && pnpm dev
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

# Nur fuer `pnpm test:db` und Seeds. BEWUSST OHNE `VITE_`-PRAEFIX:
# Vite buendelt jede VITE_-Variable in den Browser, und dieser Key umgeht RLS
# vollstaendig. Er gehoert nach `.env` (gitignored), niemals ins Frontend.
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

Hier stehen **echte Schlüssel** in einer eingecheckten Datei – und das ist kein Versehen. Die lokale Supabase-Instanz erzeugt ihre Keys aus einem festen JWT-Secret, sie sind auf jeder Maschine identisch und für niemanden von außen erreichbar (`127.0.0.1`). Der Gewinn: Ein neuer Teilnehmer braucht drei Befehle und keine Zugangsdaten von jemandem.

Die dritte Variable ist die entscheidende Lektion (`E35`). Sie trägt **absichtlich kein** `VITE_`-Präfix:

- Vite bündelt jede Variable mit `VITE_`-Präfix in das JavaScript, das an den Browser ausgeliefert wird.
- Der `service_role`-Key umgeht Row Level Security vollständig.
- Ein `VITE_SUPABASE_SERVICE_ROLE_KEY` wäre also ein Generalschlüssel für jeden Besucher.

Die Namensregel macht diesen Fehler unmöglich, statt ihn zu verbieten.

## 3. Der Supabase-Client liest jetzt die Umgebung

```diff
 import { createClient } from '@supabase/supabase-js';

-export const supabase = createClient('https://halbtcgvbacahayzrpip.supabase.co', 'sb_publishable_t5RFGtubMn_HolY1nDd5jg_TSfjbsju');
+const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL;
+const supabasePublishableKey: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
+
+if (!supabaseUrl || !supabasePublishableKey) {
+    throw new Error('VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY fehlen. Lege eine .env nach dem Muster von .env.example an und starte die Datenbank mit `pnpm db:start`.');
+}
+
+export const supabase = createClient(supabaseUrl, supabasePublishableKey);
```

Zwei Dinge sind hier lehrreich.

Erstens: `import.meta.env` ist Vites Zugang zu Umgebungsvariablen – nicht `process.env`, das es im Browser nicht gibt. Die Werte werden beim **Build** eingesetzt, nicht zur Laufzeit gelesen.

Zweitens – und das ist der wichtigere Teil – die Fehlermeldung. Sie sagt nicht „missing env var", sondern nennt die **Handlungsanweisung**: Datei anlegen, Muster benutzen, Datenbank starten. Fehlermeldungen sind Benutzeroberfläche für Entwickler. Wer eine Fehlermeldung schreibt, in der schon die Lösung steht, spart der nächsten Person zehn Minuten Suche.

Ohne die Prüfung würde der Client mit `undefined` erzeugt und irgendwann später mit einer nichtssagenden Netzwerkmeldung scheitern – weit entfernt von der eigentlichen Ursache. **Fehler dort melden, wo sie entstehen, nicht dort, wo sie sich auswirken.**

## 4. Typisierung als zweite Sicherung

Neu ist `src/vite-env.d.ts`:

```ts
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
```

Eine `.d.ts`-Datei enthält nur Typinformationen, keinen ausführbaren Code. Sie erklärt TypeScript, welche Felder `import.meta.env` hat.

Das Elegante daran: Diese Datei ist gleichzeitig eine **zweite Verteidigungslinie**. Schreibt jemand im Frontend-Code

```ts
const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
```

dann ist das ein **Typfehler** – die Eigenschaft ist nicht deklariert. Der Compiler stoppt also, was die Namensregel schon verhindert hatte. Zwei unabhängige Sicherungen für denselben Fehler, und beide kosten fast nichts.

## 5. Zwei Test-Konfigurationen, zwei Zwecke

Bisher gab es genau eine Testdatei (`src/_testing-spike/math.spec.ts`) und keine Vitest-Konfiguration. Jetzt gibt es zwei Konfigurationen, und die Trennung ist der eigentliche Inhalt.

**`vitest.config.ts` – der Standardlauf:**

```ts
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
```

**`vitest.db.config.ts` – der Datenbanklauf:**

```ts
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
```

Drei Details verdienen Aufmerksamkeit:

**Das leere Präfix in `loadEnv('', process.cwd(), '')`.** Der dritte Parameter ist das Präfix-Filter. Normalerweise lädt Vite nur `VITE_*`-Variablen; ein leerer String lädt alles. Genau deshalb steht diese Zeile in einer _separaten_ Datei, die nie in einen Browser-Build einfließt.

**`fileParallelism: false`.** Vitest führt Testdateien standardmäßig parallel aus – bei Datenbanktests wäre das fatal. Alle Dateien teilen sich **eine** Datenbank. Wenn Datei A drei Zimmer anlegt und Datei B gleichzeitig eine Buchung macht, stimmt in beiden die Kapazitätsrechnung nicht mehr. Datenbanktests haben **geteilten Zustand**, und geteilter Zustand verträgt keine Parallelität ohne echte Isolation.

**`testTimeout: 20_000`.** Statt der üblichen 5 Sekunden. Jeder Test spricht über HTTP mit PostgREST und legt vorher Testdaten an – das dauert länger als eine reine Funktionsprüfung.

## 6. Zwei Clients, zwei Rollen

Die wichtigste neue Datei ist `supabase/tests/helpers/clients.ts`:

```ts
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
```

Dieser Satz aus dem Kommentar ist der Kern der ganzen Testarchitektur:

> **Mit nur einem Client testet man RLS nie.**

Row Level Security wirkt **rollenabhängig**. Der `service_role`-Key umgeht sie vollständig. Ein Test, der nur diesen Client benutzt, ist immer grün – auch wenn jede Policy fehlt. Erst der Gegensatz zweier Clients macht die Aussage prüfbar: Was der Service-Client sieht und der anonyme Client nicht sieht, ist der Schutz.

Kleines Detail mit Wirkung: `persistSession: false`. In einem Node-Prozess gibt es keinen `localStorage`, und eine gespeicherte Sitzung würde zwischen Testläufen übrig bleiben. Testclients sollen **zustandslos** sein.

Und noch eines: `value.startsWith('<')` fängt den Fall ab, dass jemand die Platzhalter aus einer Vorlage (`<dein-key-hier>`) nicht ersetzt hat. Eine gesetzte, aber unsinnige Variable ist schwerer zu finden als eine fehlende.

## 7. Ein Rauchtest für das Testgerüst selbst

```ts
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
```

Ein Test, der eine Funktion aufruft, die es **nicht gibt**, und trotzdem grün ist – auf den ersten Blick verwirrend. Die Erklärung steht im Kommentar: Geprüft wird nicht die Funktion, sondern die **Erreichbarkeit**. Kommt eine Antwort mit „Funktion nicht gefunden", ist die Verbindung in Ordnung. Kommt `fetch failed`, läuft Docker nicht.

Solche Rauchtests („smoke tests") sind billige Diagnosehilfen. Wenn später fünf Tests rot sind, sagt der Rauchtest sofort, ob es an der Fachlogik oder an der Umgebung liegt.

Der dritte Test ist noch simpler und dennoch nützlich: Wären beide Keys identisch (etwa durch Copy-Paste in der `.env`), wären alle RLS-Tests wertlos – und zwar unbemerkt grün.

## 8. Kleinigkeiten am Rand

**Ein Platzhalter-Seed.** `supabase/seed.sql` enthält nur Kommentare:

```sql
-- Seed der lokalen Entwicklungsdatenbank (V4, Minimalseed).
--
-- Laeuft bei jedem `pnpm db:reset` nach allen Migrationen. Inhalt kommt in Phase 2/3:
-- 1 Hotel (booking_horizon_days = 365), 3 Kategorien, 8 Zimmer, Rate-Plan STANDARD,
-- 12 Monate Preise, NULL Buchungen.
--
-- Absichtlich klein: Buchungen entstehen beim Durchklicken und beweisen damit, dass
-- create_booking laeuft. Tests legen ihre Fixtures selbst an (E34), nicht der Seed.
```

Eine leere Datei mit dem Plan darin ist besser als keine Datei: Sie zeigt, dass die Stelle vorgesehen ist, und beantwortet die Frage „wo kommen die Testdaten hin?" schon vor der ersten Zeile.

**ESLint für die neuen Bereiche.** Die Testdateien und Konfigurationsdateien liegen außerhalb von `src/` und damit außerhalb der `include`-Liste in `tsconfig.json`:

```diff
+    {
+        // Datenbanktests und Konfigurationsdateien liegen ausserhalb von `src` und damit
+        // ausserhalb der `include`-Liste in tsconfig.json. Sie werden deshalb ohne
+        // Typinformation gelintet — geparst werden muessen sie trotzdem als TypeScript,
+        // sonst scheitert ESLint schon an `import type`.
+        files: ['supabase/tests/**/*.{ts,mts,cts}', '*.config.{ts,mts,cts}'],
+        extends: tseslint.configs.recommended,
+    },
```

Der Unterschied zwischen `recommended` und dem im Projekt sonst genutzten `strictTypeChecked`: Letzteres braucht Typinformation vom Compiler, und die gibt es nur für Dateien, die in der `tsconfig.json` stehen. `recommended` arbeitet ohne – ausreichend, um `import type` überhaupt parsen zu können.

**`supabase/config.toml`.** 413 Zeilen, erzeugt von `supabase init`. Konfiguriert alle lokalen Dienste (Datenbank auf Port 54322, API auf 54321, Studio, Auth, Storage …). Angepasst wurden nur `project_id` und die `site_url` auf den Vite-Dev-Server.

## Was wurde erreicht?

Das Abschlusskriterium der Phase 1 lautete:

```markdown
**Fertig, wenn:** `pnpm db:reset` fehlerfrei durchläuft, `pnpm dev` gegen die lokale Instanz
funktioniert und `pnpm test` ohne laufendes Docker grün ist.
```

Alle drei sind erfüllt. Konkret:

- Das Schema ist ab jetzt **Code im Repository**, nicht Zustand in einer Cloud.
- Die Entwicklung läuft gegen `127.0.0.1` – Änderungen können nichts kaputt machen, was jemand anderes benutzt.
- Zugangsdaten sind aus dem Code und aus Git verschwunden; die Vorlage macht den Einstieg trotzdem einfach.
- Der gefährlichste denkbare Fehler (Service-Key im Browser) ist durch Namensregel **und** Typisierung abgesichert.
- Zwei getrennte Testläufe: einer für alle, einer für die Datenbank.
- Der Preis: Docker ist ab jetzt Projektvoraussetzung.

Es gibt noch keine einzige Tabelle. Aber alles ist bereit, sie anzulegen – und zwar so, dass jede Änderung reproduzierbar und überprüfbar ist.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](004_2026-09-02_phase-2-stammdaten-rls-seed.md)
