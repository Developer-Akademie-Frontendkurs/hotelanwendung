[← Vorheriger Commit](028_2026-10-14_update-project-diary.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# refactor(booking): move markup into templates (D8)

- **Commit:** `24359fa`
- **Datum:** 2026-10-21
- **Autor:** Oliver Jung

## Worum geht es?

Der letzte offene Punkt der Review-Gruppe D: **D8 – die Templates aus `Booking.ts` in eigene Dateien verschieben.** Nach den Commits 025–027 lagen Logik, Datenzugriff und Zustand schon außerhalb der View. Übrig war das Markup: Hunderte Zeilen HTML in Template-Strings, verteilt über die ganze Klasse.

```text
 CLAUDE.md                                          |   5 +-
 src/views/BookingView/Booking.ts                   | 904 ++++-----------------
 .../BookingView/templates/calendar.template.ts     | 179 ++++
 .../BookingView/templates/checkout.template.ts     | 356 ++++++++
 src/views/BookingView/templates/icons.ts           | 111 +++
 src/views/BookingView/templates/rooms.template.ts  | 295 +++++++
 6 files changed, 1113 insertions(+), 737 deletions(-)
```

`Booking.ts` schrumpft von **1870 auf 1304 Zeilen** und enthält kein Markup mehr. Die Reihenfolge der neuen Dateien folgt dem Review-Dokument: erst Icons, dann Kalender, Zimmer, Checkout.

Die Commit-Message nennt auch, wie geprüft wurde – und das ist bei einem reinen Umbau der wichtigste Satz:

> Rendered HTML compared in six states against the previous commit: identical.

Ein **Refactoring** darf das Verhalten nicht ändern. Der ehrlichste Nachweis dafür ist, das Ergebnis vorher und nachher zu vergleichen – hier das fertig gerenderte HTML in sechs Zuständen der Seite.

## Die Regel: Daten rein, HTML raus

Jede Template-Datei beginnt mit demselben Vertrag. Aus `calendar.template.ts`:

```ts
/**
 * Markup für Schritt 1 „Datum & Gäste“ und das Gerüst der Seite.
 *
 * Wie alle Templates der Buchungsseite: Daten rein, HTML raus. Was angezeigt wird,
 * entscheidet `Booking.ts`; hier wird nur noch eingesetzt. Text-Parameter werden escapt,
 * Parameter mit `Html` im Namen sind fertiges Markup und bleiben, wie sie sind.
 */
```

Zwei Regeln stecken darin:

1. **Keine Entscheidungen im Template.** Welche Menge, welches Maximum, welcher Text, welche Zustandsklasse ein Kalendertag bekommt – das rechnet `Booking.ts` aus. Das Template setzt nur ein. Erlaubt sind höchstens Bedingungen wie „Klasse X, wenn `selected`" oder „diesen Teil nur, wenn es einen Hinweis gibt".
2. **Eine Namenskonvention als Sicherheitsregel.** Parameter, deren Name auf `Html` endet (`iconHtml`, `quantityHtml`, `cardsHtml`), sind fertiges Markup und werden **nicht** escapt. Alle anderen sind Text und gehen durch `escapeHtml()`. So sieht man schon an der Signatur, was gefährlich ist.

## Die Änderungen im Detail

### 1. `templates/icons.ts` – reines Markup ohne Werte von außen

Alle Inline-SVGs (Erwachsene, Kind, Ausstattung, Leistungen, Chevrons) wandern als Konstanten in eine Datei:

```ts
/**
 * Icons der Buchungsseite als Inline-SVG statt als Asset: Sie erben `currentColor` und
 * brauchen keinen eigenen Request. Reines Markup – nirgends steckt ein Wert von außen.
 */

export const ADULT_ICON = /*html*/ `
    <svg class="w-6 h-6 768:w-6.5 768:h-6.5" viewBox="0 0 26 26" fill="currentColor" aria-hidden="true">
        <path d="M8.40938 11.0906C7.13646 …" />
    </svg>
`;
```

Der Kommentar `/*html*/` vor dem Template-String ist kein Code, sondern ein Hinweis für Editor-Erweiterungen, den Inhalt als HTML einzufärben.

### 2. Aus Methoden mit Markup werden Aufrufe mit fertigen Werten

Am deutlichsten wird das Muster an der Zimmerkarte. Vorher baute `Booking.ts` das ganze `<article>` selbst:

```diff
     private getRoomCardHtml(room: RoomCard): string {
-        const amenities = ROOM_AMENITIES[room.slug] ?? [];
-        const isBookable = room.availability === null || room.availability.isBookable;
-        …
-        return /*html*/ `
-            <article data-room-card="${escapeHtml(room.roomTypeId)}" class="flex flex-col 768:flex-row overflow-hidden ${isBookable ? '' : 'opacity-60'} ${isSelected ? 'ring-2 ring-purple-haze' : ''}">
-                ${this.getRoomImageHtml(room)}
-                …
-            </article>
-        `;
+        return roomsTemplate.getRoomCardHtml({
+            roomTypeId: room.roomTypeId,
+            bookable: room.availability === null || room.availability.isBookable,
+            selected: bookingState.getRoomQuantity(room.roomTypeId) > 0,
+            imageHtml: roomsTemplate.getRoomImageHtml({ name: room.name, imageUrl: room.imageUrl, imageAlt: room.imageAlt, priceLabel: room.availability?.priceLabel ?? null }),
+            amenities: ROOM_AMENITIES[room.slug] ?? [],
+            description: room.description,
+            quantityHtml: this.getRoomQuantityHtml(room),
+            availabilityHtml: getAvailabilityHtml(room.availability),
+        });
     }
```

Die View fragt den Store (`getRoomQuantity`), entscheidet „buchbar?" und „ausgewählt?" und übergibt **fertige Booleans**. Das Template in `rooms.template.ts` bekommt einen eigenen Typ dafür:

```ts
export type RoomCardView = {
    roomTypeId: string;
    bookable: boolean;
    selected: boolean;
    imageHtml: string;
    amenities: readonly RoomAmenity[];
    description: string | null;
    quantityHtml: string;
    availabilityHtml: string;
};

export function getRoomCardHtml(view: RoomCardView): string {
    // …
    return /*html*/ `
        <article data-room-card="${escapeHtml(view.roomTypeId)}" class="flex flex-col 768:flex-row overflow-hidden ${view.bookable ? '' : 'opacity-60'} ${view.selected ? 'ring-2 ring-purple-haze' : ''}">
            ${view.imageHtml}
            …
        </article>
    `;
}
```

Solche `…View`-Typen heißen in vielen Architekturen **View-Model**: ein Objekt, das genau das enthält, was die Darstellung braucht – nicht mehr (kein ganzes `RoomCard`), nicht weniger (keine Rechnung im Template).

### 3. Der Kalender: aus `DayCell` wird `DayCellView`

Beim Kalender sieht man besonders gut, welche Entscheidungen in der View bleiben. Das Label („Anreise"/„Abreise"), der Wochentag, das zweistellige Datum und die Zustandsklasse werden vorab berechnet:

```diff
-    private getDayCellHtml(cell: DayCell): string {
-        const weekday = WEEKDAYS[(cell.date.getDay() + 6) % 7] ?? '';
-        const stateClass = this.getCellStateClass(cell);
-        let label = '&nbsp;';
+    private getDayCellView(cell: DayCell): calendarTemplate.DayCellView {
+        let label: string | null = null;
         if (cell.isStart) label = 'Anreise';
         else if (cell.isEnd) label = 'Abreise';
-        …
-        return /*html*/ `<button type="button" data-date="${toISODate(cell.date)}" …>…</button>`;
+
+        return {
+            iso: toISODate(cell.date),
+            weekday: WEEKDAYS[(cell.date.getDay() + 6) % 7] ?? '',
+            day: cell.date.getDate().toString().padStart(2, '0'),
+            label,
+            stateClass: this.getCellStateClass(cell),
+            selectable: cell.selectable,
+            withClearButton: cell.isStart,
+        };
     }
```

Ein Detail: Vorher war das Label im Leerfall der String `'&nbsp;'` – also **Markup** in einer Textvariablen. Jetzt ist es `null`, und erst das Template entscheidet, wie „leer" aussieht. Würde man `'&nbsp;'` als Text escapen, stünde im Browser wörtlich `&amp;nbsp;`. Text und Markup sauber zu trennen, verhindert genau solche Fehler.

### 4. Escapen wandert mit – auch für `data-*`-Attribute

Weil Templates ihre Text-Parameter selbst escapen, verschwindet der Import von `escapeHtml` aus `Booking.ts`:

```diff
-import { escapeHtml } from '../../shared/ui/html';
+import { ADULT_ICON, CHILD_ICON, ICON_AIR_CONDITIONING, ICON_BATH, ICON_BED, ICON_GYM, SERVICE_ICONS } from './templates/icons';
+import * as calendarTemplate from './templates/calendar.template';
+import * as roomsTemplate from './templates/rooms.template';
+import * as checkoutTemplate from './templates/checkout.template';
```

Früher wurden Attribute als fertiger String übergeben (`` `data-service-code="${code}"` ``). Jetzt übergibt die View ein Objekt, und das Template baut die Attribute – escapt:

```ts
export type CheckboxView = {
    inputId: string;
    /** Ohne Wert (`''`) entsteht ein leeres Attribut, z. B. `data-breakfast=""`. */
    dataAttributes: Readonly<Record<string, string>>;
    checked: boolean;
    disabled: boolean;
};

function getDataAttributesHtml(attributes: Readonly<Record<string, string>>): string {
    return Object.entries(attributes)
        .map(([name, value]: [string, string]): string => `${name}="${escapeHtml(value)}"`)
        .join(' ');
}
```

Damit gibt es in `Booking.ts` keine Stelle mehr, an der ein Wert ungeprüft in HTML landen könnte.

### 5. Namensraum-Import statt Einzelimporte

```ts
import * as roomsTemplate from './templates/rooms.template';
// …
roomsTemplate.getRoomsNoticeHtml('Zimmer werden geladen …');
```

Mit `import * as` liest man an jedem Aufruf, **woher** eine Funktion kommt. Das ist hier nützlich, weil `Booking.ts` und die Templates teils gleichnamige Funktionen haben (`getRoomCardHtml` als Methode der View und als Template-Funktion). Auch Typen sind über den Namensraum erreichbar, z. B. `roomsTemplate.Step` für die Richtung eines Mengenknopfs (`-1 | 1`).

### 6. `CLAUDE.md` dokumentiert die Aufteilung

```diff
-- Es gibt bislang keine Wiederverwendungs-/Komponentenschicht – jede View baut ihr HTML komplett selbst als String zusammen (inkl. Tailwind-Klassen direkt im Markup).
+- Es gibt keine viewübergreifende Komponentenschicht – jede View baut ihr HTML selbst als String zusammen (inkl. Tailwind-Klassen direkt im Markup).
+- Die `BookingView` trennt Markup und Logik: Ihre Templates liegen unter `src/views/BookingView/templates/` (…) und sind reine Funktionen – Daten rein, HTML raus, höchstens Bedingungen für Klassen oder optionale Teile. … Neues Markup der Buchungsseite gehört in ein Template, nicht in `Booking.ts`; …
```

Auch der XSS-Abschnitt nennt jetzt die Templates als Beispiel für „Funktionen, die Markup entgegennehmen und ihre Text-Parameter selbst escapen".

## Was wurde erreicht?

Mit D8 ist **Gruppe D des Reviews vollständig erledigt**. `Booking.ts` ist von einer Datei, die alles tat, zu einem Koordinator geworden: Sie liest den Store, ruft Services, rechnet Anzeigewerte aus und übergibt sie an Templates.

| Datei                   | Verantwortung                                                     |
| ----------------------- | ----------------------------------------------------------------- |
| `templates/*.ts`        | Markup – Daten rein, HTML raus, Text escapt                       |
| `Booking.ts`            | Entscheidungen: Texte, Mengen, Maxima, Zustandsklassen, Events    |
| `domain/*.ts`, `*.ts`   | reine Fachregeln (Kalender, Validierung, Mengen, Zusammenfassung) |
| `bookingState.ts`       | Zustand des Entwurfs                                              |
| `shared/services/*.ts`  | Datenzugriff                                                      |

Für Lernende: Diese Aufteilung ist im Kern dieselbe, die Frameworks wie Angular erzwingen (Template, Komponente, Service) – nur hier von Hand, ohne Framework.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](030_2026-10-21_tests-addresses-service-store-rules.md)
