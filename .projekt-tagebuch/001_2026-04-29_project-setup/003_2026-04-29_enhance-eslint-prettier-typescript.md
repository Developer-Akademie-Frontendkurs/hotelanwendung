[← Vorheriger Commit](002_2026-04-29_initialize-project-typescript-tailwind-eslint.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [📓 Index](../000_index.md)

# ESLint, Prettier und TypeScript-Konfiguration ausbauen

- **Commit:** `129a877`
- **Datum:** 2026-04-29
- **Autor:** Oliver Jung

## Worum geht es?

Die Code-Qualität wird durch **Prettier** (automatische Formatierung) ergänzt und die Konfigurationen werden verfeinert. Außerdem wird der Vite-Build um eine Typprüfung im laufenden Betrieb erweitert.

## Die Änderungen im Detail

### `.prettierrc` – einheitliche Formatierung

Prettier sorgt dafür, dass der gesamte Code einem festen Stil folgt. Wichtige Einstellungen sind hier u.a. einfache Anführungszeichen, abschließende Kommas und eine Einrückung von vier Leerzeichen.

```json
{
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 120,
    "tabWidth": 4,
    "useTabs": false,
    "endOfLine": "lf"
}
```

### `vite.config.ts` – Typprüfung zur Laufzeit

Mit `vite-plugin-checker` werden Typfehler bereits während der Entwicklung im Browser und Terminal angezeigt – man muss nicht erst den Build abwarten.

```diff
-import tailwindcss from "@tailwindcss/vite";
-import { defineConfig } from "vite";
+import tailwindcss from '@tailwindcss/vite';
+import { defineConfig } from 'vite';
+import checker from 'vite-plugin-checker';

 export default defineConfig({
-	plugins: [
-		tailwindcss(),
-	],
+    plugins: [tailwindcss(), checker({ typescript: true })],
 });
```

### `src/main.ts` – Anpassung an die Regeln

Der Beispiel-Code wird leicht umgestellt, sodass er den neuen Formatierungsregeln entspricht (Semikolons, Quote-Stil).

```diff
-import './style.css'
+import './style.css';

 let text = 5;
-text = 'test';

-console.log(text)
+console.log(text);
+
+text = 'Hello, TypeScript!';
```

## Was wurde erreicht?

Das Projekt hat jetzt eine vollständige Qualitäts-Pipeline: ESLint findet Fehler, Prettier formatiert automatisch und der Vite-Checker meldet Typfehler sofort.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [Nächster Commit →](004_2026-04-29_index-header-color-vite-server.md)
