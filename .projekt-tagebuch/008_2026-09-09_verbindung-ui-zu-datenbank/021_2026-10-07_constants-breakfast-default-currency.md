[← Vorheriger Commit](020_2026-10-07_standardize-variable-names.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): replace magic strings with constants for breakfast and default currency

- **Commit:** `5a632fc`
- **Datum:** 2026-10-07
- **Autor:** Oliver Jung

## Worum geht es?

Review-Punkt **B4**: _„Magic Strings durch Konstanten ersetzen: `export const BREAKFAST = 'BREAKFAST'`, analog zu `CHILD_BED`; den `'EUR'`-Fallback zentral ablegen."_

Ein **Magic String** ist ein Textwert mit fachlicher Bedeutung, der an mehreren Stellen wörtlich im Code steht. `'BREAKFAST'` stand zum Beispiel in `Booking.ts` (dreimal), in `summary.ts` und in den Tests. Vertippt man sich an einer Stelle (`'BREAKFST'`), merkt das weder TypeScript noch ESLint – der Vergleich ist einfach immer `false`.

```text
 .../reviews/2026-09-30_verbindung-ui-zu-datenbank.md |  2 +-
 src/views/BookingView/Booking.ts                     | 20 ++++++++++++--------
 src/views/BookingView/services.spec.ts               |  4 ++--
 src/views/BookingView/services.ts                    |  3 +++
 src/views/BookingView/summary.spec.ts                |  4 ++--
 src/views/BookingView/summary.ts                     |  9 ++++++---
 6 files changed, 26 insertions(+), 16 deletions(-)
```

## Die Änderungen im Detail

### 1. `BREAKFAST` neben `CHILD_BED` in `services.ts`

Für das Kinderbett gab es die Konstante schon seit Commit 008. Das Frühstück bekommt jetzt dasselbe – an derselben Stelle:

```ts
/** Der Code des Kinderbetts – die einzige Leistung mit Menge (E49). */
export const CHILD_BED = 'CHILD_BED';

/** Der Code des Frühstücks in `services` – es läuft je Person und Nacht, nicht als Leistung je Vorgang. */
export const BREAKFAST = 'BREAKFAST';
```

Weil die Konstante mit `const` und einem String-Literal angelegt wird, ist ihr Typ nicht `string`, sondern das Literal `'BREAKFAST'`. Das spielt hier noch keine große Rolle, macht sie aber in späteren Union-Typen verwendbar.

Alle Vorkommen werden ersetzt – in der View:

```diff
-        return this.getServiceRowShellHtml('BREAKFAST', 'booking-breakfast', `${service.name} für alle Gäste`, …);
+        return this.getServiceRowShellHtml(BREAKFAST, 'booking-breakfast', `${service.name} für alle Gäste`, …);
```

```diff
-            this.breakfastService = buildBreakfastService(serviceRows.find((row: ServiceRow): boolean => row.code === 'BREAKFAST') ?? null);
+            this.breakfastService = buildBreakfastService(serviceRows.find((row: ServiceRow): boolean => row.code === BREAKFAST) ?? null);
```

in der Zusammenfassung:

```diff
         lines.push({
             kind: 'breakfast',
-            id: 'BREAKFAST',
+            id: BREAKFAST,
```

und in den Tests:

```diff
-const rows = [row('MASSAGE', 'per_stay', 7500, 60), row('BREAKFAST', 'per_person_night', 1700, 10), …];
+const rows = [row('MASSAGE', 'per_stay', 7500, 60), row(BREAKFAST, 'per_person_night', 1700, 10), …];
```

Dass auch die **Tests** die Konstante verwenden, ist eine bewusste Entscheidung: Sie testen das Verhalten des Codes, nicht die Schreibweise des Strings. Ändert sich der Code einmal in der Datenbank, muss man ihn nur an einer Stelle anpassen. `'MASSAGE'` und `'GARAGE'` bleiben dagegen Strings – für sie gibt es im Code keine Sonderbehandlung, also auch keine Konstante.

### 2. `DEFAULT_CURRENCY` in `summary.ts`

Der Rückfall auf Euro stand an drei Stellen als `?? 'EUR'`:

```ts
/** Rückfall, solange keine Zeile eine Währung mitbringt – das Hotel rechnet in Euro. */
export const DEFAULT_CURRENCY = 'EUR';
```

```diff
-            currency: room.availability?.currency ?? 'EUR',
+            currency: room.availability?.currency ?? DEFAULT_CURRENCY,
```

```diff
-            totalEl.textContent = total === null ? '–' : formatPrice(total, lines[0]?.currency ?? 'EUR');
+            totalEl.textContent = total === null ? '–' : formatPrice(total, lines[0]?.currency ?? DEFAULT_CURRENCY);
```

```diff
-        const currency = created.bookings[0]?.currency ?? 'EUR';
+        const currency = created.bookings[0]?.currency ?? DEFAULT_CURRENCY;
```

Der Kommentar an der Konstante erklärt, **wann** sie greift: nur solange keine Zeile eine eigene Währung liefert. Die eigentliche Währung kommt aus der Datenbank.

### 3. `formatPrice` – Symbole als Tabelle statt als Vergleich

```diff
+/** Währungen mit eigenem Symbol – alle anderen erscheinen mit ihrem ISO-Code. */
+const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { EUR: '€' };
+
 function formatPrice(cents: number, currency: string): string {
     const digits = cents % 100 === 0 ? 0 : 2;
     const amount = new Intl.NumberFormat('de-AT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
-    return currency === 'EUR' ? `${amount}€` : `${amount} ${currency}`;
+    const symbol = CURRENCY_SYMBOLS[currency];
+    return symbol === undefined ? `${amount} ${currency}` : `${amount}${symbol}`;
 }
```

Statt eines festen Vergleichs `currency === 'EUR'` gibt es jetzt eine **Nachschlagetabelle**. Soll später auch der Schweizer Franken ein Kürzel bekommen, kommt eine Zeile in die Tabelle (`CHF: 'Fr.'`) – an der Funktion ändert sich nichts. Das Muster „Daten statt Verzweigungen" taucht im nächsten Commit noch größer auf.

Warum nicht einfach `Intl.NumberFormat` mit `style: 'currency'`? Der Kommentar über der Funktion beantwortet das, seit es sie gibt: Das Design will `732€` (Zahl vor dem Symbol, ohne Leerzeichen), `de-AT` stellt das Symbol aber voran.

## Was wurde erreicht?

Fachliche Codes und der Währungs-Rückfall stehen je an genau einer Stelle. Ein Tippfehler in `BREAKFAST` ist jetzt ein Compilerfehler („Cannot find name") statt eines stillen `false`.

| Technik                               | Wozu                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| Konstante statt Magic String          | Tippfehler werden zu Compilerfehlern, Änderung an einer Stelle |
| Konstante neben verwandten Konstanten | `BREAKFAST` liegt da, wo man `CHILD_BED` schon findet          |
| Tests nutzen dieselbe Konstante       | Tests prüfen Verhalten, nicht Schreibweise                     |
| Nachschlagetabelle statt `if`         | neue Fälle per Datenzeile statt per Codeänderung               |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](022_2026-10-07_booking-codes-and-types.md)
