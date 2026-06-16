[← Vorheriger Commit](001_2026-04-29_install-vite.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [📓 Index](../000_index.md)

# Projekt mit TypeScript, Tailwind CSS und ESLint initialisieren

- **Commit:** `b9ab61f`
- **Datum:** 2026-04-29
- **Autor:** Oliver Jung

## Worum geht es?

Das Grundgerüst wird mit drei Bausteinen erweitert: **Tailwind CSS** für das Styling, **ESLint** für die Code-Qualität und eine Vite-Konfiguration, die Tailwind einbindet. Zusätzlich erhält `main.ts` ersten Beispiel-Code.

## Die Änderungen im Detail

### `vite.config.ts` – Tailwind als Vite-Plugin

Tailwind CSS v4 wird über ein offizielles Vite-Plugin eingebunden. Dadurch muss keine separate PostCSS-Konfiguration gepflegt werden.

```ts
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
	],
});
```

### `src/style.css` – Tailwind importieren

In Tailwind v4 genügt ein einziger `@import`, um das komplette Framework zu laden.

```css
@import "tailwindcss";
```

### `src/main.ts` – erster Beispiel-Code

Hier wird die Stildatei importiert und ein kleines Beispiel geschrieben. Achtung: Dieser Code enthält absichtlich einen Typfehler (`text` ist eine Zahl, bekommt aber einen String zugewiesen) – er dient nur als Platzhalter und wird später ersetzt.

```ts
import './style.css'

let text = 5;
text = 'test';

console.log(text)
```

### `eslint.config.ts` – Linting für viele Dateitypen

ESLint wird im modernen „Flat Config"-Format konfiguriert. Bemerkenswert: Es werden nicht nur JavaScript/TypeScript geprüft, sondern auch JSON, Markdown und CSS.

```ts
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  { files: ["**/*.json"], plugins: { json }, language: "json/json", extends: ["json/recommended"] },
  { files: ["**/*.md"], plugins: { markdown }, language: "markdown/commonmark", extends: ["markdown/recommended"] },
  { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
]);
```

## Was wurde erreicht?

Das Projekt verfügt nun über Styling (Tailwind), automatische Code-Prüfung (ESLint) und ist über Vite vollständig aufgesetzt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [Nächster Commit →](003_2026-04-29_enhance-eslint-prettier-typescript.md)
