[← Vorheriger Commit](005_2026-04-29_update-docs-eslint-ignore-node-modules.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [📓 Index](../000_index.md)

# Supabase-Client integrieren

- **Commit:** `25c228d`
- **Datum:** 2026-05-06
- **Autor:** Oliver Jung

## Worum geht es?

Das Projekt bekommt sein **Backend**: **Supabase**. Supabase stellt eine Datenbank und eine API bereit. Hier wird das Client-Paket installiert und ein erster Supabase-Client in `main.ts` erzeugt. Zugangsdaten werden über Umgebungsvariablen (`import.meta.env`) eingebunden, damit keine Geheimnisse fest im Code stehen.

## Die Änderungen im Detail

### `package.json` – neue Abhängigkeiten

Es werden zwei Pakete hinzugefügt: `@supabase/supabase-js` (der Client) und `vitest` (das Test-Framework, das erst später genutzt wird).

```diff
         "vite-plugin-checker": "^0.13.0"
+        "vite-plugin-checker": "^0.13.0",
+        "vitest": "^4.1.5"
     },
     "dependencies": {
+        "@supabase/supabase-js": "^2.105.2",
         "@tailwindcss/vite": "^4.2.4",
         "tailwindcss": "^4.2.4"
     }
```

### `src/main.ts` – Supabase-Client erzeugen

Der Beispiel-Code wird durch die Erzeugung des Supabase-Clients ersetzt. Die URL und der API-Key kommen aus Umgebungsvariablen.

```diff
 import './style.css';
+import { createClient } from '@supabase/supabase-js';

-let text = 5;
-
-console.log(text);
-
-text = 'Hello, TypeScript!';
+// eslint-disable-next-line prettier/prettier
+const supabase = createClient(import.meta.env.VITE_SUPABASE_URL,
+    import.meta.env.VITE_SUPABASE_API_KEY,
+);
```

Die eigentlichen Werte stehen in einer `.env`-Datei (die nicht eingecheckt wird).

### `tsconfig.json` – `skipLibCheck`

Damit die Typprüfung nicht über die mitgelieferten Typdefinitionen von Supabase stolpert, wird `skipLibCheck` aktiviert. Das beschleunigt zusätzlich den Build.

```diff
-        "skipLibCheck": false,
+        "skipLibCheck": true,
```

## Was wurde erreicht?

Die Anwendung kann nun grundsätzlich mit Supabase kommunizieren. Die Anbindung ist vorbereitet, die konkrete Nutzung folgt im SPA-Branch.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [Nächster Commit →](007_2026-05-06_session-entry-supabase.md)
