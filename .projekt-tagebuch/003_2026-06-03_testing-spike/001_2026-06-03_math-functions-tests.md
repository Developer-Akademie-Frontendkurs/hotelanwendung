[← Vorheriger Commit](../002_2026-05-06_spa-struktur/013_2026-06-03_named-exports-views.md) · [↑ Branch-Übersicht](../003_2026-06-03_testing-spike.md) · [📓 Index](../000_index.md)

# Mathe-Funktionen und Tests für Addition/Subtraktion

- **Commit:** `cc88b4d`
- **Datum:** 2026-06-03
- **Autor:** Oliver Jung

## Worum geht es?

Erste Schritte mit automatisierten Tests. Es entstehen zwei kleine Funktionen (`add`, `subtract`) und passende Tests mit **Vitest**. Anhand dieses übersichtlichen Beispiels lässt sich das grundlegende Vorgehen beim Testen gut üben.

## Die Änderungen im Detail

### `package.json` – Test-Skript

Ab jetzt lassen sich Tests bequem mit `npm test` starten.

```diff
         "preview": "vite preview",
+        "test": "vitest",
         "lint": "eslint .",
```

### `src/_testing-spike/math.ts` – die zu testenden Funktionen

```ts
export function add(numbers: number[]): number {
    let sum = 0;
    for (const number of numbers) {
        sum += number;
    }
    return sum;
}

export function subtract(a: number, b: number): number {
    return a - b;
}
```

### `src/_testing-spike/math.spec.ts` – die Tests

Die Tests folgen dem Muster **Arrange – Act – Assert** (Vorbereiten, Ausführen, Prüfen). `describe` gruppiert zusammengehörige Tests, `it` beschreibt einen Einzelfall, `expect(...).toBe(...)` prüft das Ergebnis.

```ts
import { describe, it, expect } from 'vitest';
import { add, subtract } from './math';

describe('add()', () => {
    it('it should summarize all numbers in an array', () => {
        // Arrange
        const numbers = [1, 2, 3];

        // Act
        const sum = add(numbers);

        // Assert
        const expectedResult = numbers.reduce((preValue, curValue) => preValue + curValue, 0);
        expect(sum).toBe(expectedResult);
    });
});

describe('subtract()', () => {
    it('should substract a number from another', () => {
        const a = 10;
        const b = 5;
        const result = subtract(a, b);
        expect(result).toBe(5);
    });
});
```

Beim `add`-Test wird das erwartete Ergebnis bewusst über `reduce` berechnet, statt eine feste Zahl hinzuschreiben. Der `subtract`-Test verwendet dagegen noch den fest verdrahteten Wert `5` – genau das verbessert der nächste Commit.

## Was wurde erreicht?

Das Test-Framework ist eingerichtet und an einem einfachen Beispiel erprobt. Damit ist das Fundament für testgetriebenes Arbeiten gelegt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../003_2026-06-03_testing-spike.md) · [Nächster Commit →](002_2026-06-10_fix-subtraction-test-dynamic-values.md)
