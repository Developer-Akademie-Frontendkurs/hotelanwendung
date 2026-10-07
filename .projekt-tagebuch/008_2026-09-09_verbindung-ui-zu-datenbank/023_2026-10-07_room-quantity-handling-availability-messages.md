[← Vorheriger Commit](022_2026-10-07_booking-codes-and-types.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): refactor room quantity handling and unify room availability messages

- **Commit:** `90116db`
- **Datum:** 2026-10-07
- **Autor:** Oliver Jung

## Worum geht es?

Die letzten beiden Punkte aus Gruppe C des Reviews – beide drehen sich um **Duplikate**:

| Punkt  | Problem                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| **C4** | `formatRoomsFree` gibt es zweimal – in `roomQuantity.ts` und in `Booking.ts`, mit **unterschiedlichem** Text |
| **C5** | `getServiceStepHtml` und `getQuantityStepHtml` bauen fast denselben `−`/`+`-Knopf                            |

```text
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |  4 +-
 src/views/BookingView/Booking.ts                   | 76 +++++++++++++---------
 src/views/BookingView/roomQuantity.spec.ts         |  9 ++-
 src/views/BookingView/roomQuantity.ts              | 15 ++++-
 4 files changed, 66 insertions(+), 38 deletions(-)
```

Wie die Commits 020 und 021 verändert auch dieser **kein sichtbares Verhalten**: Alle Texte und alle Knöpfe sehen danach genauso aus wie vorher.

## Die Änderungen im Detail

### 1. Zwei Funktionen mit gleichem Namen, aber verschiedenem Zweck (C4)

Vor dem Commit gab es zwei Funktionen namens `formatRoomsFree`. Beide waren **modul-privat** (nicht exportiert), deshalb gab es keinen Namenskonflikt – aber sie lieferten etwas anderes:

```ts
// roomQuantity.ts
function formatRoomsFree(roomsFree: number): string {
    return roomsFree === 1 ? 'ist nur noch 1 Zimmer' : `sind nur noch ${roomsFree.toString()} Zimmer`;
}

// Booking.ts
function formatRoomsFree(roomsFree: number): string {
    return roomsFree === 1 ? 'noch 1 Zimmer frei' : `noch ${roomsFree.toString()} Zimmer frei`;
}
```

Der Review-Punkt lautete „Zusammenführen". Beim genauen Hinsehen zeigt sich aber: Das sind **keine** Duplikate, sondern zwei verschiedene Funktionen, die zufällig gleich heißen. Die erste liefert einen **Satzteil mit Verb** für Hinweise („Für diesen Zeitraum _sind nur noch 2 Zimmer_ frei."), die zweite eine **kurze Angabe** für die Zimmerkarte („_noch 2 Zimmer frei_ · 3 Nächte"). Sie zu einer Funktion zu verschmelzen, hätte einen der beiden Texte kaputtgemacht.

Die Lösung: Beide ziehen in **dieselbe Datei**, bekommen aber **ehrliche Namen** – genau nach der Regel aus Commit 020 („passt kein ehrlicher Name, ist meist der Zuschnitt falsch"):

```diff
-function formatRoomsFree(roomsFree: number): string {
+/**
+ * Freie Zimmer als Satzteil mit Verb – für Hinweise wie „Für diesen Zeitraum sind nur noch 2 Zimmer frei."
+ * Das Verb steht mit drin, weil es an der Zahl hängt (ist/sind).
+ */
+function formatRoomsLeftClause(roomsFree: number): string {
     return roomsFree === 1 ? 'ist nur noch 1 Zimmer' : `sind nur noch ${roomsFree.toString()} Zimmer`;
 }

+/** Freie Zimmer als kurze Angabe für die Zimmerkarte, z. B. „noch 2 Zimmer frei · 3 Nächte". */
+export function formatRoomsFreeLabel(roomsFree: number): string {
+    return roomsFree === 1 ? 'noch 1 Zimmer frei' : `noch ${roomsFree.toString()} Zimmer frei`;
+}
```

Der Kommentar an `formatRoomsLeftClause` beantwortet eine Frage, die man sich beim Lesen sofort stellt: Warum steckt das Verb in der Funktion? Weil es von der Zahl abhängt – „1 Zimmer **ist**", „2 Zimmer **sind**". Würde der Aufrufer das Verb selbst schreiben, müsste er die Fallunterscheidung wiederholen.

Die beiden Aufrufer in `roomQuantity.ts` werden umbenannt:

```diff
             return roomsFree === null || roomsFree === 0
                 ? 'Für diesen Zeitraum sind keine Zimmer dieser Kategorie frei.'
-                : `Für diesen Zeitraum ${formatRoomsFree(roomsFree)} frei.`;
+                : `Für diesen Zeitraum ${formatRoomsLeftClause(roomsFree)} frei.`;
```

```diff
                 clamped.limitedBy === 'roomsFree'
-                    ? `Von ${room.name} ${formatRoomsFree(clamped.value)} frei.`
+                    ? `Von ${room.name} ${formatRoomsLeftClause(clamped.value)} frei.`
                     : `${room.name} wurde auf ${clamped.value.toString()} Zimmer verringert.`,
```

In `Booking.ts` fällt die eigene Kopie weg, stattdessen wird die exportierte Funktion importiert:

```diff
-function formatRoomsFree(roomsFree: number): string {
-    return roomsFree === 1 ? 'noch 1 Zimmer frei' : `noch ${roomsFree.toString()} Zimmer frei`;
-}
```

```diff
-    const roomsFree = availability.roomsFree === null ? '' : `${formatRoomsFree(availability.roomsFree)} · `;
+    const roomsFree = availability.roomsFree === null ? '' : `${formatRoomsFreeLabel(availability.roomsFree)} · `;
```

Weil `formatRoomsFreeLabel` jetzt in einer reinen Logikdatei liegt und exportiert ist, lässt sie sich testen – was in `Booking.ts` nicht ging:

```ts
describe('formatRoomsFreeLabel', () => {
    it('unterscheidet ein und mehrere Zimmer', () => {
        expect(formatRoomsFreeLabel(1)).toBe('noch 1 Zimmer frei');
        expect(formatRoomsFreeLabel(3)).toBe('noch 3 Zimmer frei');
    });
});
```

Im Review-Dokument wird festgehalten, dass der Punkt **anders** umgesetzt wurde als vorgeschlagen:

```markdown
- [x] C4: `formatRoomsFree` gibt es doppelt mit unterschiedlichem Text (…). Zusammenführen. Umgesetzt: beide in `roomQuantity.ts` mit Namen, die ihren Zweck sagen (`formatRoomsLeftClause` für Sätze, `formatRoomsFreeLabel` für die Karte); Texte unverändert.
```

Für Lernende ein wichtiger Punkt: Ein Review-Befund ist ein **Hinweis**, keine Anweisung. „Zusammenführen" war die erste Vermutung des Reviews; die genauere Untersuchung ergab „gleicher Name, verschiedene Aufgaben". Die richtige Reaktion ist, das Problem hinter dem Befund zu lösen (Verwechslungsgefahr) und die Abweichung zu begründen.

### 2. Ein gemeinsamer Schritt-Knopf (C5)

Die beiden Methoden für die `−`/`+`-Knöpfe – einmal für die Zimmeranzahl, einmal für das Kinderbett – unterschieden sich nur in den `data-*`-Attributen und dem `aria-label`. Das Markup mit der langen Tailwind-Klassenliste war zweimal identisch vorhanden:

```diff
-    private getQuantityStepHtml(room: RoomCard, step: number, ariaLabel: string, glyph: string, disabled: boolean): string {
-        return /*html*/ `
-            <button
-                type="button"
-                data-room-step="${step.toString()}"
-                data-room-type="${escapeHtml(room.roomTypeId)}"
-                aria-label="${escapeHtml(ariaLabel)}"
-                ${disabled ? 'disabled' : ''}
-                class="shrink-0 flex items-center justify-center w-9 h-9 … "
-            >${glyph}</button>
-        `;
+    private getQuantityStepHtml(room: RoomCard, step: Step, disabled: boolean): string {
+        const ariaLabel = `${step > 0 ? 'Ein Zimmer mehr' : 'Ein Zimmer weniger'} – ${room.name}`;
+        return getStepButtonHtml(step, { 'data-room-step': step.toString(), 'data-room-type': room.roomTypeId }, ariaLabel, disabled);
     }
```

```diff
-    private getServiceStepHtml(service: ExtraService, step: number, glyph: string, disabled: boolean): string {
+    private getServiceStepHtml(service: ExtraService, step: Step, disabled: boolean): string {
         const ariaLabel = `${service.name}: ${step > 0 ? 'eines mehr' : 'eines weniger'}`;
-        return /*html*/ `
-            <button
-                …
-            >${glyph}</button>
-        `;
+        return getStepButtonHtml(step, { 'data-service-step': step.toString(), 'data-service-code': service.code }, ariaLabel, disabled);
     }
```

Die gemeinsame Funktion steht als **freie Funktion** außerhalb der Klasse – sie braucht kein `this`, also gehört sie nicht in die Klasse:

```ts
/**
 * Runder `−`/`+`-Knopf der Mengenwähler – für Zimmer und Kinderbett derselbe.
 *
 * Welche Menge er ändert, sagen allein die `data-*`-Attribute; ihre Werte werden hier escapt.
 */
function getStepButtonHtml(step: Step, dataAttributes: Readonly<Record<string, string>>, ariaLabel: string, disabled: boolean): string {
    const attributes = Object.entries(dataAttributes)
        .map(([name, value]: [string, string]): string => `${name}="${escapeHtml(value)}"`)
        .join(' ');
    return /*html*/ `
        <button
            type="button"
            ${attributes}
            aria-label="${escapeHtml(ariaLabel)}"
            ${disabled ? 'disabled' : ''}
            class="shrink-0 flex items-center justify-center w-9 h-9 456:w-10 456:h-10 rounded-full bg-purple-haze font-antic-didone text-24 leading-none text-white cursor-pointer transition-colors hover:bg-purple-haze-dark focus:outline-none focus:ring-2 focus:ring-purple-haze/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-haze"
        >${step > 0 ? '+' : '&minus;'}</button>
    `;
}
```

Drei Details sind lehrreich:

**Die `data-*`-Attribute als Objekt.** Statt für jede Variante eigene Parameter (`roomTypeId`, `serviceCode` …) vorzusehen, nimmt die Funktion ein beliebiges Objekt `{ name: wert }` entgegen und baut daraus die Attribute. So bleibt sie unabhängig davon, **was** der Knopf steuert – die Click-Handler (`handleRoomsClick`) lesen die Attribute wie bisher aus.

**Escapen an einer Stelle.** Vorher musste jede der beiden Methoden selbst daran denken, `room.roomTypeId` bzw. `service.code` durch `escapeHtml()` zu schicken. Jetzt escapt die gemeinsame Funktion **alle** Attributwerte. Die Aufrufer übergeben Rohwerte – das entspricht der Regel aus Commit 018: „Funktionen, die Markup bauen, escapen ihre Text-Parameter selbst". Die Attribut-**Namen** werden nicht escapt; sie stehen wörtlich im Quelltext und kommen nie von außen.

**Das Zeichen folgt aus der Richtung.** Der Parameter `glyph` (`'&minus;'` oder `'+'`) fällt weg. Er war redundant: Ein Knopf mit `step = -1` und `glyph = '+'` wäre ein Widerspruch gewesen, den der alte Code zugelassen hätte. Jetzt leitet die Funktion das Zeichen aus `step` ab.

### 3. Ein enger Typ für die Richtung

Damit `step` nur noch `-1` oder `1` sein kann, gibt es einen kleinen Literal-Typ:

```ts
/** Richtung eines Schritt-Knopfs im Mengenwähler. */
type Step = -1 | 1;
```

Vorher war `step: number` – auch `0`, `2` oder `0.5` wären durchgegangen. Mit `Step` ist ein Aufruf wie `getQuantityStepHtml(room, 2, false)` ein Compilerfehler. Das ist dasselbe Prinzip wie bei `RejectionCode` im vorherigen Commit, nur mit Zahlen statt Strings: **Ungültige Werte gar nicht erst darstellbar machen.**

Die Aufrufe werden dadurch kürzer und lesbarer:

```diff
-                        ${this.getQuantityStepHtml(room, -1, `Ein Zimmer weniger – ${room.name}`, '&minus;', quantity === 0)}
+                        ${this.getQuantityStepHtml(room, -1, quantity === 0)}
```

```diff
-                        ${this.getServiceStepHtml(service, -1, '&minus;', quantity === 0)}
+                        ${this.getServiceStepHtml(service, -1, quantity === 0)}
```

Das `aria-label` für die Zimmerknöpfe wird jetzt in `getQuantityStepHtml` gebaut statt beim Aufrufer – so wie es `getServiceStepHtml` schon vorher tat. Beide Methoden folgen damit demselben Aufbau.

## Was wurde erreicht?

Mit diesem Commit ist **Gruppe C des Reviews vollständig abgehakt** (Gruppen A und B schon vorher). Offen bleiben Gruppe D (Aufteilung von `Booking.ts` in Templates, Fachlogik und Services – die Datei hat über 2000 Zeilen), Gruppe E (weitere Tests) und F (offene Punkte aus dem Umsetzungsplan).

| Technik                                          | Wozu                                                        |
| ------------------------------------------------ | ----------------------------------------------------------- |
| Ehrliche Namen statt erzwungener Zusammenführung | gleicher Name, verschiedene Aufgaben – jetzt unterscheidbar |
| Funktion in die Logikdatei verschieben           | exportierbar und testbar statt in der View versteckt        |
| Gemeinsame Template-Funktion                     | lange Klassenliste und Markup nur noch einmal               |
| Attribute als Objekt übergeben                   | eine Funktion für verschiedene `data-*`-Kombinationen       |
| Escapen in der Funktion, die Markup baut         | Aufrufer können es nicht vergessen                          |
| Literal-Typ `-1 \| 1`                            | ungültige Richtungen sind ein Compilerfehler                |
| Redundante Parameter streichen                   | `glyph` und `step` können sich nicht mehr widersprechen     |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
