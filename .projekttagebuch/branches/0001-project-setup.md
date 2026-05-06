# Branch-Diary: project-setup

- Branch: project-setup
- Nummer: 0001
- Erstellt am: 29.04.2026
- Letzter dokumentierter Stand: 06.05.2026 um 17:31 Uhr

## Ziel des Branches

Grundlegendes Frontend-Projekt mit Vite und TypeScript aufsetzen und die Entwicklungsqualität durch Linting, Formatting und Type-Checks absichern.

## Commit-Überblick

- 5a6d664: install vite
- b1535ef: feat: initialize project with TypeScript, Tailwind CSS, and ESLint configuration
- abaacc7: feat: enhance project setup with ESLint, Prettier, and TypeScript configurations
- a19a976: feat: update index.html header color and enhance vite.config.ts with server settings
- 9aa5e98: feat: update project documentation and enhance ESLint configuration to ignore node_modules
- a1f4a3c: feat: integrate Supabase client and update project configuration

## Dokumentierte Sessions

- [2026-04-29-21-06](../sessions/0001-project-setup/2026-04-29-21-06.md)
- [2026-05-06-17-31](../sessions/0001-project-setup/2026-05-06-17-31.md)

## Einträge

## 29.04.2026 um 21:31 Uhr

### Commit-Bezug

- `abaacc7..a19a976`

### Änderungen

- `index.html`: Tailwind-Farbe der Überschrift von `bg-amber-500` auf `bg-yellow-500` geändert
- `vite.config.ts`: `server.open: true` ergänzt, damit der Browser beim Start von Vite automatisch geöffnet wird

### Relevante Codeausschnitte

#### Diff zur Änderung

- [index.html](../../index.html)

```diff
-            <h1 class="bg-amber-500 text-3xl">Unsere Hotelanwendung</h1>
+            <h1 class="bg-yellow-500 text-3xl">Unsere Hotelanwendung</h1>
```

- [vite.config.ts](../../vite.config.ts)

```diff
 export default defineConfig({
     plugins: [tailwindcss(), checker({ typescript: true })],
+    server: {
+        open: true,
+    },
 });
```

### Erklärung

Zwei kleine Konfigurationsanpassungen: Die Header-Farbe wurde von `amber-500` auf `yellow-500` korrigiert – beide Werte liegen nah beieinander, `yellow-500` entspricht eher dem gewünschten Gelb-Ton in Tailwind. Die `server.open`-Option in der Vite-Konfiguration sorgt dafür, dass beim Ausführen von `pnpm run dev` der Browser automatisch geöffnet wird, was den Entwicklungsstart beschleunigt.

---

## 06.05.2026 um 17:31 Uhr

### Commit-Bezug

- `a19a976..a1f4a3c`

### Änderungen

- `eslint.config.ts`: `node_modules/**` in die `ignores`-Liste aufgenommen
- `.env`: Neue Datei mit Supabase-URL und publishable API-Key als Vite-Umgebungsvariablen angelegt
- `src/main.ts`: Supabase-Client initialisiert; vorheriger TypeScript-Beispielcode entfernt
- `tsconfig.json`: `skipLibCheck` auf `true` gesetzt, um Typchecks in Bibliotheken zu überspringen
- `.prettierrc`: `printWidth` von `120` auf `180` erhöht
- `package.json` / `pnpm-lock.yaml`: `@supabase/supabase-js` als Dependency und `vitest` als DevDependency hinzugefügt

### Relevante Codeausschnitte

#### Diff zur Änderung

- [src/main.ts](../../src/main.ts)

```diff
 import './style.css';
+import { createClient } from '@supabase/supabase-js';

-let text = 5;
-console.log(text);
-text = 'Hello, TypeScript!';
+const supabase = createClient(
+    import.meta.env.VITE_SUPABASE_URL,
+    import.meta.env.VITE_SUPABASE_API_KEY,
+);
```

- [tsconfig.json](../../tsconfig.json)

```diff
-        "skipLibCheck": false,
+        "skipLibCheck": true,
```

### Erklärung

Zentrales Thema dieser Session ist die Anbindung an Supabase als Backend-as-a-Service. Der Supabase-Client wird über Umgebungsvariablen initialisiert, die in einer neu angelegten `.env`-Datei hinterlegt sind. Der bisherige TypeScript-Demokode in `main.ts` wurde dabei ersetzt. Ergänzend wurden `skipLibCheck: true`, eine erhöhte `printWidth` in Prettier sowie erweiterte ESLint-Ignores gesetzt. Mit `vitest` wurde das Test-Framework als DevDependency vorbereitet.

### Verknüpfte Session

- [2026-05-06-17-31](../sessions/0001-project-setup/2026-05-06-17-31.md)
