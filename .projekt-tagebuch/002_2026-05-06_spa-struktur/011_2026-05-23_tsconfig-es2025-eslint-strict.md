[← Vorheriger Commit](010_2026-05-21_default-param-abstractview.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# TypeScript auf ES2025, strengeres ESLint

- **Commit:** `4e0d29b`
- **Datum:** 2026-05-23
- **Autor:** Oliver Jung

## Worum geht es?

Die Qualitätsanforderungen werden angehoben. TypeScript wird auf das neuere Sprachziel **ES2025** gestellt, und ESLint nutzt für den Quellcode die **strengsten typbasierten Regeln** (`strictTypeChecked`). Damit findet der Linter mehr potenzielle Fehler, etwa unsichere Typumwandlungen.

## Die Änderungen im Detail

### `tsconfig.json` – ES2025

```diff
-        "target": "es2023",
+        "target": "es2025",
         "module": "esnext",
-        "lib": ["ES2023", "DOM", "DOM.Iterable"],
+        "lib": ["ES2025", "DOM", "DOM.Iterable"],
```

`target` bestimmt, auf welche JavaScript-Version kompiliert wird; `lib` legt fest, welche eingebauten Typdefinitionen (z.B. neuere Array-Methoden) verfügbar sind.

### `eslint.config.ts` – typbasierte Strenge

Für alle TypeScript-Dateien unter `src/` wird die Regelmenge `strictTypeChecked` aktiviert. Diese benötigt Typinformationen (`parserOptions.project`). Zusätzlich wird ein expliziter Rückgabetyp für Funktionen erzwungen.

```diff
-    tseslint.configs.recommended,
+    {
+        files: ['src/**/*.{ts,mts,cts}'],
+        extends: tseslint.configs.strictTypeChecked,
+        languageOptions: {
+            parserOptions: {
+                project: true,
+                tsconfigRootDir: new URL('.', import.meta.url).pathname,
+            },
+        },
+        rules: {
+            '@typescript-eslint/explicit-function-return-type': 'error',
+        },
+    },
```

Für CSS werden zwei Regeln gezielt abgeschaltet, weil sie mit dem Tailwind-Setup kollidieren würden.

```diff
+        rules: {
+            'css/no-unmatchable-selectors': 'off',
+            'css/no-duplicate-keyframe-selectors': 'off',
+        },
```

## Was wurde erreicht?

Der Code wird strenger geprüft. Das erhöht zwar kurzfristig den Aufwand (mehr Linter-Meldungen), führt aber langfristig zu robusterem, typsicherem Code – ein guter Anlass für das anschließende Router-Refactoring.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](012_2026-05-27_router-class-refactor.md)
