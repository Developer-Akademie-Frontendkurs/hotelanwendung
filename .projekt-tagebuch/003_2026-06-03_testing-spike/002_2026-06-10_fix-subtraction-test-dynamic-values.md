[← Vorheriger Commit](001_2026-06-03_math-functions-tests.md) · [↑ Branch-Übersicht](../003_2026-06-03_testing-spike.md) · [📓 Index](../000_index.md)

# Subtraktions-Test auf dynamische Werte umstellen

- **Commit:** `8c5d74d`
- **Datum:** 2026-06-10
- **Autor:** Oliver Jung

## Worum geht es?

Eine kleine, aber lehrreiche Verbesserung am `subtract`-Test. Statt das erwartete Ergebnis fest auf `5` zu setzen, wird es aus den Eingabewerten berechnet (`a - b`). Dadurch bleibt der Test auch dann korrekt, wenn man die Eingabewerte ändert.

## Die Änderungen im Detail

### `src/_testing-spike/math.spec.ts`

```diff
 describe('subtract()', () => {
     it('should substract a number from another', () => {
-        const a = 10;
+        const a = 120;
         const b = 5;

         const result = subtract(a, b);

-        expect(result).toBe(5);
+        expect(result).toBe(a - b);
     });
 });
```

Der didaktische Punkt: Ein fest verdrahteter Erwartungswert (`5`) hätte beim Ändern von `a` auf `120` plötzlich fehlgeschlagen, obwohl die Funktion korrekt ist. Indem man das erwartete Ergebnis aus denselben Eingaben ableitet (`a - b`), beschreibt der Test die **Regel** statt nur einen Einzelwert. Vorsicht: Der erwartete Wert sollte dann unabhängig von der getesteten Funktion berechnet werden, sonst testet man sich „selbst".

## Was wurde erreicht?

Der Test ist robuster und drückt klarer aus, was er prüft. Damit endet der Test-Spike.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../003_2026-06-03_testing-spike.md) · [Nächster Commit →](../004_2026-06-10_startseite-erstellen/001_2026-06-10_custom-font-styles.md)
