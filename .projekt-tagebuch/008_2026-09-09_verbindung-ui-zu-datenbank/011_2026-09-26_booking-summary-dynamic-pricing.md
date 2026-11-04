[← Vorheriger Commit](010_2026-09-26_enhance-address-form-validation.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): implement booking summary with dynamic pricing and validation

- **Commit:** `2900cdf`
- **Datum:** 2026-09-26
- **Autor:** Oliver Jung

## Worum geht es?

Seit Branch 007 stand rechts neben dem Formular eine Zusammenfassung „Ihre Buchung" – als **Figma-Attrappe** mit „Double Suite", „732 €" und einer erfundenen Hoteladresse. Dieser Commit ersetzt jede dieser Zahlen durch echte Werte.

```text
 docs/datenbank/umsetzungsplan.md           |  17 ++
 src/views/BookingView/Booking.ts           | 339 +++++++++++++++++++++++++----
 src/views/BookingView/hotel.interface.ts   |  11 +
 src/views/BookingView/room.interface.ts    |   3 +
 src/views/BookingView/roomQuantity.spec.ts |   2 +-
 src/views/BookingView/summary.spec.ts      |  88 ++++++++
 src/views/BookingView/summary.ts           | 110 ++++++++++
 7 files changed, 522 insertions(+), 48 deletions(-)
```

Der Nachtrag im Umsetzungsplan listet, woher die Daten jetzt kommen:

```markdown
- **Hoteladresse und Uhrzeiten** kommen aus `hotels` (`check_in_time`/`check_out_time`), Zeitraum,
  Zimmer, Frühstück und Leistungen aus `bookingState`, die Preise aus `search_availability`.
```

## Die Änderungen im Detail

### 1. Die Attrappe verschwindet

Aus dem Markup fliegen die festen Werte heraus – übrig bleibt ein **Gerüst** mit leeren Containern:

```diff
-                <div class="flex flex-col gap-4">
-                    <address class="not-italic font-antic-didone text-16 leading-tight text-purple-haze-dark">
-                        Karawanken Hof<br>
-                        Kadischen Allee 3<br>
-                        A - 3459 Villach
-                    </address>
-                    <hr class="border-t-[0.5px] border-purple-haze/45">
-                </div>
+            <div id="booking-summary" class="…">
+                <h2 id="booking-summary-title" tabindex="-1" class="… focus:outline-none">Ihre Buchung</h2>
 
-                <div class="flex items-center gap-4">
-                    <div class="shrink-0 w-24 h-18 rounded-[0.6875rem] bg-purple-haze-dark"></div>
-                    …
-                        <span class="font-playfair-display font-medium">Double Suite</span>
-                    …
+                <div id="booking-summary-order" class="flex flex-col gap-5"></div>
```

```diff
                         <span>Gesamtsumme</span>
-                        <span>732€</span>
+                        <span data-summary-total aria-live="polite">–</span>
```

Das `tabindex="-1"` an der Überschrift ist kein Versehen – dazu unten mehr.

### 2. Die Rechenlogik in `summary.ts`

Wie schon bei `breakfast.ts` und `services.ts` liegt die Logik in einer eigenen Datei mit reinen Funktionen. Der Einleitungskommentar enthält den wichtigsten Satz des Commits:

```ts
/**
 * Wie `breakfast.ts` und `services.ts` eine **Bequemlichkeit, keine zweite Wahrheit**:
 * Verbindlich rechnet `create_booking`. Was hier steht, ist die Zahl, die der Gast vor
 * dem Absenden sieht – und genau deshalb steckt jede sichtbare Zeile auch in der Summe (V16).
 */
```

Eine Bestellzeile ist ein kleines, klar typisiertes Objekt:

```ts
export type OrderLineKind = 'room' | 'breakfast' | 'service';

export interface OrderLine {
    kind: OrderLineKind;
    /** `room_type_id`, `services.code` bzw. `BREAKFAST` – damit das Entfernen-Kreuz weiß, was es entfernt. */
    id: string;
    name: string;
    quantity: number;
    /** `null`, solange kein Zeitraum gewählt ist: ohne Nächte gibt es keinen Preis. */
    amountCents: number | null;
    currency: string;
}
```

`buildOrderLines` baut die Zeilen **in der Reihenfolge der Seite**: erst die Zimmer (in der Reihenfolge der Karten), dann das Frühstück, dann die Leistungen:

```ts
export function buildOrderLines(input: OrderInput): OrderLine[] {
    const lines: OrderLine[] = [];

    for (const room of input.rooms) {
        const quantity = input.quantities[room.roomTypeId] ?? 0;
        if (quantity === 0) continue;

        // `total_amount_cents` aus `search_availability` ist der Preis EINES Zimmers für
        // den ganzen Zeitraum.
        const perRoom = room.availability?.amountCents ?? null;
        lines.push({
            kind: 'room',
            id: room.roomTypeId,
            name: room.name,
            quantity,
            amountCents: perRoom === null ? null : quantity * perRoom,
            currency: room.availability?.currency ?? 'EUR',
        });
    }

    // … Frühstück, Leistungen …

    return lines;
}
```

Und die Gesamtsumme folgt einer strengen Regel:

```ts
/**
 * Summe aller Zeilen – oder `null`, wenn eine davon keinen Preis hat.
 *
 * Eine Summe, in der eine sichtbare Zeile fehlt, wäre ein Rechenfehler vor den Augen
 * des Gastes. Ohne Zeilen gibt es ebenfalls keine Summe: „0 €" sähe aus wie ein Angebot.
 */
export function getOrderTotalCents(lines: readonly OrderLine[]): number | null {
    if (lines.length === 0) return null;

    let total = 0;
    for (const line of lines) {
        if (line.amountCents === null) return null;
        total += line.amountCents;
    }
    return total;
}
```

Hier zeigt sich wieder, wie wichtig die Unterscheidung zwischen `null` und `0` ist: `null` heißt „noch nicht berechenbar", `0` heißt „kostet nichts". Eine Summe über Zeilen, von denen eine `null` ist, wäre eine **Teilsumme**, die sich als Gesamtsumme ausgibt. Stattdessen zeigt die Seite dann „–".

Damit die Zimmerzeile rechnen kann, bekommt `RoomCardAvailability` den Preis als Zahl (bisher gab es nur das formatierte Label):

```diff
 export interface RoomCardAvailability {
     priceLabel: string | null;
+    /** Preis EINES Zimmers für den ganzen Zeitraum – die Zusammenfassung rechnet damit weiter. */
+    amountCents: number | null;
+    currency: string;
     nights: number;
```

Eine gute Faustregel steckt darin: **Rechne mit Zahlen, formatiere erst beim Anzeigen.** Ein Label wie „366€" kann man nicht zurück in eine Zahl verwandeln, ohne zu parsen.

### 3. `summary.spec.ts`: acht Tests für die Rechenregeln

```ts
describe('buildOrderLines', () => {
    it('rechnet Zimmer als Menge × Preis je Zimmer für den Zeitraum', () => {
        expect(buildOrderLines(input())).toEqual([{ kind: 'room', id: 'suite', name: 'suite', quantity: 2, amountCents: 73200, currency: 'EUR' }]);
    });

    it('folgt der Reihenfolge der Karten, nicht der Auswahl', () => {
        const lines = buildOrderLines(input({ quantities: { premium: 1, suite: 1 } }));
        expect(lines.map((line) => line.id)).toEqual(['suite', 'premium']);
    });

    it('lässt Preise ohne Zeitraum offen – außer bei Leistungen, die keine Nächte brauchen', () => {
        // …
        expect(lines.map((line) => [line.id, line.amountCents])).toEqual([
            ['suite', null],
            ['BREAKFAST', null],
            ['GARAGE', null],
            ['MASSAGE', 7500],
        ]);
    });
});

describe('getOrderTotalCents', () => {
    it('gibt keine Summe, sobald eine Zeile keinen Preis hat', () => {
        expect(getOrderTotalCents(buildOrderLines(input({ nights: null, rooms: [room('suite', null)] })))).toBeNull();
    });
});
```

Die Hilfsfunktion `input(overrides: Partial<OrderInput> = {})` ist ein bewährtes Test-Muster: ein vollständiger Standard-Eingabewert, von dem jeder Test nur das überschreibt, was ihn interessiert. `Partial<T>` macht dabei alle Felder optional.

### 4. Hoteldaten aus der Datenbank

Die neue Datei `src/views/BookingView/hotel.interface.ts`:

```ts
/** Die Stammdaten aus `hotels`, die die Zusammenfassung braucht (genau eine Zeile, E14). */
export interface HotelRow {
    name: string;
    address_line1: string | null;
    postal_code: string | null;
    city: string | null;
    country_code: string | null;
    /** `time` kommt über PostgREST als `"14:00:00"`. */
    check_in_time: string;
    check_out_time: string;
}
```

Geladen wird parallel zum Rest – und ein Fehler ist hier **nicht** fatal:

```ts
/** Die eine Zeile aus `hotels` (E14). */
private async loadHotel(): Promise<void> {
    const { data, error } = await supabase.from('hotels').select('name, address_line1, postal_code, city, country_code, check_in_time, check_out_time').limit(1).maybeSingle();
    if (error) return;

    this.hotel = data;
    this.renderSummary();
}
```

Der Kommentar am Feld erklärt die Abwägung: _„`null`, solange nicht geladen – dann fehlen nur diese Angaben, die Buchung selbst hängt nicht daran."_ Nicht jeder Ladefehler muss die ganze Seite blockieren.

Die Uhrzeit wird für die Anzeige gekürzt:

```ts
/** „13.06.2026 ab 14:00 Uhr" wie im Entwurf – ohne geladene Hotelzeile nur das Datum. */
function formatStayDate(date: Date | null, preposition: string, time: string | null): string {
    if (date === null) return 'noch offen';

    const day = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString()}`;
    // `time` kommt als "14:00:00" – die Sekunden interessieren niemanden.
    return time === null ? day : `${day} ${preposition} ${time.slice(0, 5)} Uhr`;
}
```

`padStart(2, '0')` macht aus `6` ein `'06'`. Und `getMonth() + 1` ist die klassische JavaScript-Falle: Monate zählen bei `Date` ab **0**.

### 5. `renderSummary()`: hier ist Neuaufbau erlaubt

In Commit 004 wurde für die Zimmerliste ausdrücklich **kein** Neuaufbau per `innerHTML` gemacht, um den Fokus nicht zu verlieren. Hier ist es anders – und der Kommentar sagt warum:

```ts
/**
 * Baut den veränderlichen Teil von „Ihre Buchung" neu auf.
 *
 * Ein kompletter Neuaufbau ist hier unbedenklich – anders als in der Zimmerliste gibt
 * es in der Zusammenfassung kein Feld, in dem gerade getippt wird.
 */
private renderSummary(): void {
    // Kein Destroy-Hook: Nach einem Seitenwechsel meldet sich die View hier selbst ab.
    if (this.summaryEl?.isConnected !== true) {
        this.unsubscribeSummary?.();
        this.unsubscribeSummary = null;
        return;
    }
    // …
    orderEl.innerHTML = /*html*/ `
        ${this.getHotelAddressHtml()}
        ${this.getSummaryRoomsHtml()}
        <div class="flex flex-col gap-6 768:gap-10">
            ${this.getStayHtml()}
            ${lines.length === 0 ? '' : /*html*/ `<div class="flex flex-col gap-4">${lines.map((line: OrderLine): string => this.getOrderRowHtml(line)).join('')}</div>`}
        </div>
    `;
    // …
}
```

Die Wahl der Technik hängt vom **Inhalt** ab, nicht von einer allgemeinen Regel: Wo getippt wird, gezielte Updates; wo nur angezeigt wird, einfacher Neuaufbau.

Die Zusammenfassung meldet sich bei `bookingState.subscribe` an und wird zusätzlich nach jedem `renderRooms()` neu gezeichnet – weil sich Preise oder Belegung ändern können, _„ohne dass sich in `bookingState` etwas rührt"_. Die Gästezahl liegt ja in der View, nicht im Zustand.

### 6. Entfernen per Kreuz – mit Fokus-Management

Jede Bestellzeile bekommt einen echten `<button>` um das bisher nur dekorative Kreuz-Icon:

```ts
<button
    type="button"
    data-summary-remove="${line.kind}"
    data-summary-id="${line.id}"
    aria-label="${line.name} entfernen"
    class="…"
>${ICON_REMOVE}</button>
```

Und der Klick-Handler kümmert sich um ein Detail, das oft vergessen wird:

```ts
private handleSummaryClick(event: MouseEvent): void {
    // …
    switch (button.dataset.summaryRemove) {
        case 'room':
            // Direkt statt über `setRoomQuantity()`: Entfernen muss auch gehen, wenn die
            // Kategorie gerade keine Verfügbarkeit hat (Zeitraum zurückgesetzt).
            bookingState.setRoomQuantity(id, 0);
            // …
            break;
        case 'breakfast':
            bookingState.setBreakfast(false);
            // …
            break;
        case 'service':
            this.setServiceQuantity(id, 0);
            break;
        default:
            return;
    }

    // Der geklickte Knopf ist mit seiner Zeile verschwunden – der Fokus soll nicht ins
    // Leere fallen.
    document.getElementById('booking-summary-title')?.focus();
}
```

Wenn ein fokussiertes Element aus dem DOM entfernt wird, landet der Fokus beim `<body>` – Tastaturnutzer müssten von ganz oben neu anfangen. Deshalb wird der Fokus auf die Überschrift gesetzt. Damit eine Überschrift überhaupt fokussierbar ist, braucht sie **`tabindex="-1"`**: fokussierbar per Skript, aber nicht Teil der Tab-Reihenfolge.

### 7. Validierung mit einem Satz je Fall

Bisher gab es nur eine Fehlermeldung. Jetzt sagt die Seite genau, was fehlt – in der Reihenfolge, in der der Gast die Seite von oben nach unten ausfüllt:

```ts
/**
 * Was vor dem Buchen noch fehlt (Phase 9b, Punkt 7) – in der Reihenfolge der Seite,
 * damit der Gast von oben nach unten arbeiten kann. `null` heißt: alles da.
 */
private getCheckoutError(draft: BookingDraft, invalid: readonly InvalidField[]): string | null {
    if (draft.checkIn === null || draft.checkOut === null) return 'Bitte wählen Sie zuerst Ihren Zeitraum.';
    if (draft.adults === null) return 'Bitte wählen Sie die Anzahl der Gäste.';
    if (draft.positions.length === 0) return 'Bitte wählen Sie mindestens ein Zimmer.';

    const capacity = this.getCapacityText();
    if (capacity !== '') return capacity;

    return invalid.length === 0 ? null : FORM_INCOMPLETE;
}
```

Und der Fokussprung aus Commit 010 wird verfeinert:

```diff
-        this.markInvalidFields(invalid);
+        const message = this.getCheckoutError(draft, invalid);
+        // In das Formular springen nur, wenn dort auch das Problem liegt – nicht, wenn
+        // noch das Zimmer fehlt.
+        this.markInvalidFields(invalid, message === FORM_INCOMPLETE);
```

Fehlt noch das Zimmer, wäre ein Sprung ins leere Namensfeld verwirrend – der Gast muss erst weiter oben etwas tun.

### 8. Kleine Aufräumarbeit: `countNights`

Die Nächte-Berechnung stand an mehreren Stellen inline. Sie wird zu einer Funktion:

```ts
/** Nächte zwischen An- und Abreise – `null`, solange der Zeitraum nicht vollständig ist. */
function countNights(checkIn: Date | null, checkOut: Date | null): number | null {
    if (checkIn === null || checkOut === null) return null;
    return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}
```

```diff
-            nights: checkIn === null || checkOut === null ? null : Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY),
+            nights: countNights(checkIn, checkOut),
```

`Math.round` statt `Math.floor` ist hier wichtig: An Tagen mit Zeitumstellung hat ein Tag 23 oder 25 Stunden, und die Division ergäbe z.B. `1.958` statt `2`.

## Was wurde erreicht?

Die letzte Figma-Attrappe der Buchungsseite ist weg. Die Zusammenfassung zeigt echte Hoteldaten, echte Zimmer, echte Preise und eine Summe, die niemals eine versteckte Teilsumme ist. Der Gast kann Positionen direkt in der Zusammenfassung entfernen, und die Validierung sagt ihm Schritt für Schritt, was noch fehlt.

| Technik                                        | Wozu                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Mit Zahlen rechnen, erst beim Anzeigen formatieren | Werte bleiben weiterverarbeitbar                              |
| `null`-Summe statt Teilsumme                   | keine falsche Gesamtsumme vor den Augen des Gastes                |
| Test-Helfer mit `Partial<T>`-Overrides         | kurze, fokussierte Testfälle                                      |
| Neuaufbau vs. gezieltes Update nach Inhalt     | Einfachheit, wo möglich; Fokuserhalt, wo nötig                    |
| `tabindex="-1"` + `focus()` nach Entfernen     | Fokus fällt nicht ins Leere                                       |
| Fehlermeldungen in Seitenreihenfolge           | der Gast arbeitet von oben nach unten                             |
| Nicht-fatale Ladefehler                        | fehlende Hoteldaten blockieren nicht die Buchung                  |

Der Nachtrag im Plan endet – noch – mit: _„Gebucht wird weiterhin nicht (Punkte 8–9)."_ Das ändert der nächste Commit.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](012_2026-09-26_booking-creation-modal-confirmation.md)
