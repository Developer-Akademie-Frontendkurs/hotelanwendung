[← Vorheriger Commit](037_2026-10-28_bring-implementation-plan-up-to-date.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): accessibility of form errors, calendar days and live regions (G1–G4)

- **Commit:** `b511828`
- **Datum:** 2026-10-28
- **Autor:** Oliver Jung

## Worum geht es?

Die letzte Gruppe des Reviews: **G – Barrierefreiheit**. Die Buchungsseite funktioniert mit Maus und Augen. Mit einem **Screenreader** (z. B. NVDA, VoiceOver) oder nur mit der **Tastatur** hatte sie vier Schwächen:

| Punkt  | Problem                                                                                    | Lösung                                                    |
| ------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **G1** | Ein ungültiges Feld meldete nur „ungültig" – aber nicht, **was** fehlt                     | Fehlerzeile je Feld, verknüpft per `aria-describedby`     |
| **G2** | Das „ד zum Zurücksetzen war ein `span role="button"` **innerhalb** eines `<button>`        | eigener `<button>` neben dem Tag                          |
| **G3** | Ein Kalendertag wurde als „MI 03" vorgelesen, Anreise/Abreise nur über die Farbe erkennbar | `aria-label` mit vollem Datum und Zustand, `aria-pressed` |
| **G4** | Zu viele `aria-live`-Regionen: ein Klick auf `+` löste mehrere Ansagen aus                 | überflüssige `aria-live` entfernt                         |

```text
 .../2026-09-30_verbindung-ui-zu-datenbank.md       | 10 +++--
 src/shared/format.spec.ts                          | 12 ++++-
 src/shared/format.ts                               |  8 ++++
 src/views/BookingView/Booking.ts                   | 52 +++++++++++++++++-----
 src/views/BookingView/address.spec.ts              | 23 +++++++++-
 src/views/BookingView/address.ts                   | 25 +++++++++++
 src/views/BookingView/booking.css                  |  3 +-
 .../BookingView/templates/calendar.template.ts     | 36 +++++++++------
 .../BookingView/templates/checkout.template.ts     | 19 ++++++--
 src/views/BookingView/templates/rooms.template.ts  | 14 ++++--
 10 files changed, 164 insertions(+), 38 deletions(-)
```

Bemerkenswert ist der letzte Satz der Commit-Message:

```text
Not yet checked in a browser: no Chromium available in the sandbox.
```

Lint, 214 Tests und Build sind grün – aber Barrierefreiheit lässt sich mit Unit-Tests nur zum Teil prüfen. Ob ein Screenreader die Fehlerzeile wirklich vorliest, zeigt erst der Browser. Der Commit verschweigt das nicht, sondern schreibt es ausdrücklich hinein (auch im Review-Dokument). **Was nicht geprüft wurde, sagt man.**

## Die Änderungen im Detail

### 1. G1 – Fehlerzeilen je Feld

#### Die Texte: eine `Record`-Tabelle

Datei: `src/views/BookingView/address.ts`

Für jedes Feld, das `getInvalidFields()` melden kann, gibt es einen eigenen Satz:

```ts
const FIELD_ERROR_TEXTS: Record<InvalidField, string> = {
    'customer.firstName': 'Bitte geben Sie Ihren Vornamen ein.',
    'customer.lastName': 'Bitte geben Sie Ihren Nachnamen ein.',
    'customer.email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein, z. B. maria.huber@beispiel.at.',
    'residence.street': 'Bitte geben Sie Ihre Straße ein.',
    // …
    'billing.street': 'Bitte geben Sie die Straße der Rechnungsadresse ein.',
    // …
    'billing.countryCode': 'Bitte wählen Sie das Land der Rechnungsadresse.',
};

export function getFieldErrorText(field: InvalidField): string {
    return FIELD_ERROR_TEXTS[field];
}
```

Dasselbe Muster wie bei den Ablehnungscodes (Commit 022): `Record<InvalidField, string>` zwingt den Compiler, für **jeden** Wert des Union-Typs `InvalidField` einen Text zu verlangen. Kommt später ein Feld dazu, fehlt sein Text als Compilerfehler – nicht erst als leere Zeile im Browser.

Warum steht bei der Rechnungsadresse „der Rechnungsadresse" dabei? Sehende Nutzer erkennen am Layout, in welchem Abschnitt ein Feld steht. Ein Screenreader liest nur das Feld und seine Beschreibung vor – „Bitte geben Sie Ihre Straße ein" wäre bei zwei Adressformularen mehrdeutig.

Die Tests prüfen genau diese beiden Eigenschaften – Vollständigkeit und Eindeutigkeit:

```ts
it('hat für jedes Feld, das getInvalidFields melden kann, einen eigenen Satz', () => {
    const everything = getInvalidFields(
        details({
            customer: { firstName: '', lastName: '', email: '', phone: null },
            residence: { street: '', houseNumber: '', postalCode: '', city: '', countryCode: 'XX' },
            billing: { company: null, street: '', houseNumber: '', postalCode: '', city: '', countryCode: 'XX' },
        }),
    );
    const texts = everything.map(getFieldErrorText);

    expect(everything).toHaveLength(13);
    expect(new Set(texts).size).toBe(texts.length);
});
```

Der Trick mit `new Set(texts).size`: Ein `Set` entfernt Duplikate. Ist es genauso groß wie das Array, sind alle Texte verschieden.

#### Das Markup: Fehlerzeile mit `id`

Datei: `src/views/BookingView/templates/checkout.template.ts`

```ts
function getFieldErrorHtml(id: string): string {
    return /*html*/ `<p id="booking-${id}-error" class="empty:hidden mt-1 font-antic-didone text-14 leading-tight text-red-600"></p>`;
}
```

Jedes Pflichtfeld verweist per `aria-describedby` auf seine Fehlerzeile:

```diff
                 placeholder="${escapeHtml(sample)}"
-                ${required ? 'aria-required="true"' : ''}
+                ${required ? `aria-required="true" aria-describedby="booking-${id}-error"` : ''}
                 class="${FIELD_CLASSES} placeholder:text-gray-500"
             />
+            ${required ? getFieldErrorHtml(id) : ''}
```

So funktioniert `aria-describedby`: Das Attribut enthält die `id` eines anderen Elements. Bekommt das Feld den Fokus, liest der Screenreader zuerst das Label („Straße"), dann den Zustand („ungültig") und dann den **Text des verknüpften Elements** („Bitte geben Sie Ihre Straße ein."). Ohne diese Verknüpfung wüsste ein blinder Nutzer nur, dass etwas falsch ist.

Die Tailwind-Klasse `empty:hidden` entspricht dem CSS-Selektor `:empty { display: none }`. Solange die Zeile keinen Text hat, nimmt sie keinen Platz im Layout ein – es braucht also keine eigene Logik zum Ein- und Ausblenden.

#### Die Logik: `setFieldError`

Datei: `src/views/BookingView/Booking.ts`

Bisher setzte die View nur `aria-invalid`. Jetzt gibt es eine Funktion, die **Markierung und Text gemeinsam** setzt oder aufhebt:

```ts
function setFieldError(field: HTMLElement, message: string | null): void {
    const errorEl = document.getElementById(`${field.id}-error`);
    if (errorEl) errorEl.textContent = message ?? '';
    if (message === null) {
        field.removeAttribute('aria-invalid');
    } else {
        field.setAttribute('aria-invalid', 'true');
    }
}
```

```diff
-            if (invalid.includes(field)) {
-                element.setAttribute('aria-invalid', 'true');
-            } else {
-                element.removeAttribute('aria-invalid');
-            }
+            setFieldError(element, invalid.includes(field) ? getFieldErrorText(field) : null);
```

Und beim Tippen verschwinden beide wieder:

```diff
-            if (event.target instanceof Element) event.target.removeAttribute('aria-invalid');
+            if (event.target instanceof HTMLElement) setFieldError(event.target, null);
```

Zwei Details für Lernende:

- Der Text wird per `textContent` gesetzt, nicht per `innerHTML` – die XSS-Regel aus Commit 018 gilt auch für eigene Texte. `textContent` kann gar kein HTML erzeugen.
- Markierung und Text in **einer** Funktion zu setzen verhindert einen typischen Fehler: dass ein Feld rot bleibt, aber die Zeile schon leer ist (oder umgekehrt). Zwei Dinge, die immer zusammen gelten, ändert man an einer Stelle.

### 2. G2 – Kein Knopf im Knopf

Datei: `src/views/BookingView/templates/calendar.template.ts`

Vorher saß das „ד zum Zurücksetzen als `<span role="button">` **innerhalb** des `<button>` der Tageszelle. Das hat zwei Probleme: Interaktive Elemente dürfen laut HTML-Spezifikation nicht verschachtelt werden, und ein `span` mit `role="button"` ist per Tastatur nicht erreichbar (er hat kein `tabindex` und reagiert nicht auf Enter/Leertaste).

```diff
-        <button
-            type="button"
-            data-date="${escapeHtml(cell.iso)}"
-            …
-        >
-            ${clearButton}
-            <span …>${escapeHtml(cell.weekday)}</span>
-            …
-        </button>
+        <div class="relative">
+            <button
+                type="button"
+                data-date="${escapeHtml(cell.iso)}"
+                aria-label="${escapeHtml(cell.ariaLabel)}"
+                aria-pressed="${cell.pressed ? 'true' : 'false'}"
+                …
+                class="w-full flex flex-col …"
+            >
+                <span …>${escapeHtml(cell.weekday)}</span>
+                …
+            </button>
+            ${clearButton}
+        </div>
```

Der Trick: Ein umschließendes `<div class="relative">` übernimmt die Rolle des Positionierungsrahmens. Der Tagesknopf füllt es mit `w-full`, das „ד liegt als **Geschwister** darüber (`absolute top-0.5 right-0.5`). Optisch ändert sich nichts, im DOM sind es jetzt zwei getrennte Knöpfe:

```ts
const clearButton = cell.withClearButton
    ? /*html*/ `<button type="button" data-action="clear" aria-label="Auswahl zurücksetzen" class="booking__clear absolute top-0.5 right-0.5 px-1 … focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">&times;</button>`
    : '';
```

Damit der Knopf beim Tabben sichtbar wird, bekommt er einen Fokusring – und in `booking.css` dieselbe volle Deckkraft wie beim Hover:

```diff
-.booking__clear:hover {
+.booking__clear:hover,
+.booking__clear:focus-visible {
     opacity: 1;
 }
```

`:focus-visible` greift nur bei Tastaturfokus, nicht beim Mausklick – so bekommen Mausnutzer keinen störenden Rahmen.

### 3. G3 – Kalendertage, die man vorlesen kann

#### Ein langes Datum

Datei: `src/shared/format.ts`

```ts
export function formatLongDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
```

`Intl.DateTimeFormat` ist die eingebaute Datumsformatierung des Browsers – keine Bibliothek nötig. Die Locale `de-DE` statt `de-AT` ist Absicht: Der Kalender zeigt „Januar", und das Österreichische würde „Jänner" vorlesen. Der Test hält genau das fest:

```ts
it('nennt den Januar „Januar", wie der Kalender', () => {
    expect(formatLongDate(new Date(2027, 0, 1))).toBe('Freitag, 1. Januar 2027');
});
```

#### Das Label setzt sich aus Teilen zusammen

Datei: `src/views/BookingView/Booking.ts`

```ts
private getDayAriaLabel(cell: DayCell, label: string | null): string {
    const parts = [formatLongDate(cell.date)];
    if (label !== null) parts.push(label);
    else if (cell.inRange) parts.push('im gewählten Zeitraum');
    if (cell.isToday) parts.push('heute');
    return parts.join(', ');
}
```

Ergebnis z. B.: „Mittwoch, 3. Juni 2026, Anreise, heute". Alles, was Sehende an Farbe und kleiner Schrift ablesen, steht jetzt auch im Text.

Dazu kommt `aria-pressed` an Anreise- und Abreisetag:

```diff
             label,
+            ariaLabel: this.getDayAriaLabel(cell, label),
+            pressed: cell.isStart || cell.isEnd,
             stateClass: this.getCellStateClass(cell),
```

`aria-pressed="true"` macht aus einem Knopf einen **Umschaltknopf** – der Screenreader sagt „gedrückt". So hängt der Zustand „ausgewählt" nicht allein an der lila Hintergrundfarbe.

Und der Sperrgrund gesperrter Tage? Der steht weiter im `title`. Gibt es ein `aria-label`, lesen Screenreader den `title` als zusätzliche **Beschreibung** vor – er muss also nicht ins Label kopiert werden.

### 4. G4 – Weniger Ansagen

`aria-live="polite"` sagt: „Lies diesen Bereich vor, wenn er sich ändert." Das ist nützlich – aber nur, wenn es wenige solcher Bereiche gibt. Vorher löste ein Klick auf `+` beim Kinderbett drei Ansagen aus: die neue Menge, die Preiszeile und die Gesamtsumme.

Entfernt wurde `aria-live` an drei Stellen:

```diff
-                <p data-service-amount="${escapeHtml(view.code)}" aria-live="polite" class="…">${escapeHtml(view.label)}</p>
+                <p data-service-amount="${escapeHtml(view.code)}" class="…">${escapeHtml(view.label)}</p>
```

```diff
-                    <span data-summary-total aria-live="polite">–</span>
+                    <span data-summary-total>–</span>
```

```diff
-            <output id="…" data-service-quantity="…" aria-live="polite" class="…">${view.quantity.toString()}</output>
+            <output id="…" data-service-quantity="…" class="…">${view.quantity.toString()}</output>
```

Beim letzten Fall ist nicht die Ansage weg – nur das **doppelte** Attribut. Das HTML-Element `<output>` hat von sich aus die Rolle `status`, und die ist automatisch eine höfliche Live-Region. Ebenso überflüssig war `aria-live="polite"` neben `role="status"` am Bettenhinweis. Der Kommentar im Template erklärt die Abwägung:

```ts
/**
 * `<output>` ist von sich aus eine Statusregion: Nach `−`/`+` wird die neue Menge
 * vorgelesen. Preiszeile und Gesamtsumme ändern sich mit, sagen aber nichts an – drei
 * Ansagen pro Klick wären Lärm (G4).
 */
```

Für Lernende: Viele ARIA-Attribute sind **schon eingebaut**, wenn man das richtige HTML-Element verwendet (`<button>`, `<output>`, `<dialog>`). Die erste Regel von ARIA lautet deshalb: Nutze natives HTML, wo es geht.

### 5. Review-Dokument

Datei: `docs/reviews/2026-09-30_verbindung-ui-zu-datenbank.md`

Alle vier Punkte werden abgehakt, jeweils mit einem Satz zur Umsetzung, und mit dem offenen Rest:

```diff
-- [ ] G1: Fehlermeldungen pro Feld mit `aria-describedby` verknüpfen, statt nur `aria-invalid` zu setzen.
+- [x] G1: … Umgesetzt: Jedes Pflichtfeld hat eine Fehlerzeile `#booking-<feld>-error` …
 …
+  Lint, 214 Tests und Build sind grün. **Im Browser noch nicht geprüft:** In der Sandbox (Ubuntu
+  26.04, arm64) gibt es weder Chrome noch ein Playwright-Chromium. Das Prüfskript für G1–G4 liegt bereit.
```

## Was wurde erreicht?

Formular und Kalender sind jetzt mit Screenreader und Tastatur bedienbar: Fehler sagen, was fehlt, Kalendertage nennen ihr Datum und ihren Zustand, das „ד ist ein echter Knopf, und ein Klick löst nur noch eine Ansage aus. Damit sind im Review-Dokument **alle Gruppen A bis G abgehakt** – mit dem ausdrücklichen Vorbehalt, dass die Prüfung im Browser noch aussteht.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](039_2026-11-04_refactor-booking-templates-remove-comments.md)
