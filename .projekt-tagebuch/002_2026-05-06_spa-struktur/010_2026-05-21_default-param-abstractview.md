[← Vorheriger Commit](009_2026-05-21_session-entry-routing.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Default-Parameter für `AbstractView`-Konstruktor

- **Commit:** `09d629a`
- **Datum:** 2026-05-21
- **Autor:** Oliver Jung

## Worum geht es?

Ein kleiner, aber wichtiger Bugfix. Statische Views (wie `Home`) werden ohne Parameter erzeugt, dynamische Views (wie `SinglePost`) mit einem `params`-Objekt. Damit der Konstruktor der Basisklasse in beiden Fällen funktioniert, bekommt der Parameter einen **Default-Wert** (leeres Objekt).

## Die Änderungen im Detail

### `src/views/AbstractView.ts`

```diff
 export default class {
     params: Record<string, string>;

-    constructor(params: Record<string, string>) {
+    constructor(params: Record<string, string> = {}) {
         this.params = params;
     }
```

Ohne den Default-Wert würde `this.params` bei statischen Views `undefined` sein, und ein späterer Zugriff wie `this.params.id` würde einen Laufzeitfehler auslösen. Mit `= {}` ist `params` immer ein gültiges Objekt.

## Was wurde erreicht?

Statische und dynamische Views nutzen dieselbe Basisklasse, ohne dass es zu Fehlern bei fehlenden Parametern kommt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](011_2026-05-23_tsconfig-es2025-eslint-strict.md)
