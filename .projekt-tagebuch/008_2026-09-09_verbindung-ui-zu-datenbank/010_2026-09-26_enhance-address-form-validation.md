[← Vorheriger Commit](009_2026-09-26_customer-address-management.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): enhance address form with sample values and validation improvements

- **Commit:** `b0f9c76`
- **Datum:** 2026-09-26
- **Autor:** Oliver Jung

## Worum geht es?

Ein kleiner Nachschliff am Adressformular aus Commit 009 – drei Verbesserungen, die man erst bemerkt, wenn man das Formular tatsächlich benutzt:

```text
 docs/datenbank/umsetzungsplan.md | 24 +++++++++++++++++-
 src/views/BookingView/Booking.ts | 53 ++++++++++++++++++++++++++++------------
 2 files changed, 61 insertions(+), 16 deletions(-)
```

1. Die **Platzhalter** sehen nicht mehr aus wie ausgefüllte Werte.
2. Wohn- und Rechnungsadresse bekommen **unterschiedliche** Beispiele.
3. Nach einem fehlgeschlagenen Absenden springt der **Fokus** ins erste fehlerhafte Feld.

## Die Änderungen im Detail

### 1. Graue Platzhalter statt Schriftfarbe

```diff
                     placeholder="${sample}"
                     ${required ? 'aria-required="true"' : ''}
-                    class="${FIELD_CLASSES} placeholder:text-purple-haze-dark"
+                    class="${FIELD_CLASSES} placeholder:text-gray-500"
```

Eine Zeile, aber ein echtes Usability-Problem. Der Figma-Entwurf zeigte das Formular mit Beispielwerten in der normalen Schriftfarbe – als Mockup sinnvoll, als echte Seite irreführend. Der Nachtrag im Umsetzungsplan sagt es so: _„Mit den Figma-Werten in Eingabefarbe sah ein leeres Formular ausgefüllt aus."_

Tailwinds `placeholder:`-Variante erzeugt CSS für das Pseudo-Element `::placeholder`:

```css
.placeholder\:text-gray-500::placeholder {
    color: var(--color-gray-500);
}
```

Der Kommentar an der Methode fasst beide Regeln zusammen:

```ts
/**
 * Das Beispiel steht als `placeholder` im Feld, nicht als `value` – die Eingabe bleibt
 * leer, und der Gast muss nichts löschen. Grau statt in der Schriftfarbe der Eingabe,
 * damit ein leeres Feld nicht wie ein ausgefülltes aussieht.
 */
```

### 2. Neue, erkennbar erfundene Beispielwerte

Aus „Maxime Musterfrau, Musterstraße 67, 9872 Villach" wird:

```ts
type AddressSample = {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
};

// Beispielwerte für die Platzhalter: kurz genug für die schmalen Felder (PLZ, Hausnummer)
// und erkennbar erfunden (`beispiel.at`, „Beispiel GmbH").
const RESIDENCE_SAMPLE: AddressSample = { street: 'Hauptplatz', houseNumber: '12a', postalCode: '9500', city: 'Villach' };
const BILLING_SAMPLE: AddressSample = { street: 'Ringstraße', houseNumber: '5', postalCode: '1010', city: 'Wien' };
```

```diff
-                        ${this.getBillingFieldHtml('vorname', 'Vorname', 'Maxime', 'given-name', 'text', 'w-full')}
-                        ${this.getBillingFieldHtml('nachname', 'Nachname', 'Musterfrau', 'family-name', 'text', 'w-full')}
+                        ${this.getBillingFieldHtml('vorname', 'Vorname', 'Maria', 'given-name', 'text', 'w-full')}
+                        ${this.getBillingFieldHtml('nachname', 'Nachname', 'Huber', 'family-name', 'text', 'w-full')}
```

```diff
-                        ${this.getBillingFieldHtml('email', 'E-Mail', 'maxime@musterfrau.at', 'email', 'email', 'w-full')}
+                        ${this.getBillingFieldHtml('email', 'E-Mail', 'maria.huber@beispiel.at', 'email', 'email', 'w-full')}
```

Zwei Details sind bemerkenswert:

- **`beispiel.at`** statt `musterfrau.at`: Eine Domain, die niemand für echt hält. (Im internationalen Kontext gibt es dafür sogar reservierte Domains wie `example.com`.)
- Die Methode `getAddressFieldsHtml` bekommt die Beispiele jetzt als **Parameter**. Die Begründung: _„Die Beispiele unterscheiden sich, damit die beiden Blöcke nicht wie eine Kopie wirken."_

```diff
-    private getAddressFieldsHtml(prefix: string, autocompleteSection: string): string {
+    private getAddressFieldsHtml(prefix: string, autocompleteSection: string, sample: AddressSample): string {
         return /*html*/ `
-            ${this.getBillingFieldHtml(`${prefix}strasse`, 'Straße', 'Musterstraße', `${autocompleteSection}address-line1`, 'text', 'w-full')}
+            ${this.getBillingFieldHtml(`${prefix}strasse`, 'Straße', sample.street, `${autocompleteSection}address-line1`, 'text', 'w-full')}
```

Warum nicht einfach „Ihr Vorname" als Platzhalter? Auch das steht im Nachtrag: _„‚Ihr Vorname' o. ä. hätte nur die Beschriftung wiederholt und wäre in den schmalen Feldern abgeschnitten worden."_

### 3. Fokus ins erste ungültige Feld

```diff
                 element.removeAttribute('aria-invalid');
             }
         }
+
+        // In das erste ungültige Feld springen (Phase 9b, Punkt 7) – in Formularreihenfolge,
+        // nicht in der von `FIELD_NAMES`.
+        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
     }
```

Ein kleiner, aber durchdachter Trick: Statt über die Liste `FIELD_NAMES` zu laufen (deren Reihenfolge von der Objektdefinition abhängt), fragt der Code den **DOM**: `querySelector` liefert immer das **erste passende Element in Dokumentreihenfolge**. So landet der Fokus garantiert im obersten fehlerhaften Feld, egal wie `FIELD_NAMES` sortiert ist.

Für Tastatur- und Screenreader-Nutzer ist das mehr als Komfort: Ohne Fokussprung wüssten sie nach dem Klick auf „zahlungspflichtig buchen" nicht, wo sie weitermachen sollen.

### 4. Der Umsetzungsplan zieht nach

Punkt 7 von Phase 9b wird präzisiert – die Pflichtfelder beziehen sich jetzt auf die **Wohnadresse** (`E51`), nicht mehr auf eine Rechnungsadresse:

```diff
-   Straße, Hausnummer, PLZ, Ort, Land (wegen `billing_address_id not null`). Telefon bleibt optional.
+   Straße, Hausnummer, PLZ, Ort, Land der **Wohnadresse** (E51). Die Rechnungsadresse ist optional,
+   aber wenn die Checkbox an ist, gilt für sie dasselbe (Firma bleibt optional). Telefon bleibt optional.
```

Und ein Nachtrag fasst den Stand von Commit 009 und 010 zusammen – mit dem ehrlichen Schlusssatz: _„Gebucht wird weiterhin nicht (Punkt 8)."_

## Was wurde erreicht?

Das Formular erklärt sich besser: Leere Felder sehen leer aus, die beiden Adressblöcke sind unterscheidbar, und nach einem Fehler weiß der Gast sofort, wo er weitermachen muss.

| Technik                                        | Wozu                                                           |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `placeholder:`-Variante mit gedämpfter Farbe   | Beispiel und Eingabe sind optisch unterscheidbar               |
| Erkennbar erfundene Beispieldaten              | niemand hält den Platzhalter für echte Daten                   |
| Beispiele als Parameter                        | wiederverwendete Bausteine mit unterschiedlichem Inhalt        |
| `querySelector` für „erstes in Dokumentreihenfolge" | Fokussprung unabhängig von der Reihenfolge im Code        |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](011_2026-09-26_booking-summary-dynamic-pricing.md)
