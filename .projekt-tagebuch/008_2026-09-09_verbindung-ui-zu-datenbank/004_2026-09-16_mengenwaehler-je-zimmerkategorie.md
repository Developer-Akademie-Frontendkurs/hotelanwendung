[← Vorheriger Commit](003_2026-09-16_update-comments-for-database-integration.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): Mengenwähler je Zimmerkategorie

- **Commit:** `2e05149`
- **Datum:** 2026-09-16
- **Autor:** Oliver Jung

## Worum geht es?

Bis hierher konnte man auf der Buchungsseite Zimmerkategorien **ansehen**, aber nicht **auswählen**. Die Bestandsaufnahme im Umsetzungsplan hatte das als Lücke notiert: „Keine Zimmerauswahl – `room_type_id` landet nirgends". Dieser Commit schließt sie – noch ohne Datenbankänderung, rein im Frontend.

```text
 docs/datenbank/umsetzungsplan.md        |  15 +++
 src/shared/state/bookingState.ts        |  33 ++++++
 src/views/BookingView/Booking.ts        | 177 +++++++++++++++++++++++++++++++-
 src/views/BookingView/booking.css       |  11 ++
 src/views/BookingView/room.interface.ts |   3 +
 src/views/BookingView/roomQuantity.ts   | 127 +++++++++++++++++++++++
 6 files changed, 363 insertions(+), 3 deletions(-)
```

Jede buchbare Kategorie bekommt einen Mengenwähler aus `−`, einem Zahlenfeld und `+`. Die gewählten Mengen landen im zentralen `bookingState`, und die Regeln dafür (Obergrenzen, Hinweistexte, Abgleich nach neuer Suche) liegen als **reine Funktionen** in einer eigenen Datei.

Eine Besonderheit, die im Plan als Nachtrag festgehalten ist: Der Commit weicht von der geplanten Reihenfolge ab. Er setzt einen Punkt aus Phase 9b um, **bevor** die Phasen 7b, 8 und 9 gebaut sind – und begründet, warum das geht.

## Die Änderungen im Detail

### 1. Nachtrag im Umsetzungsplan: Abweichung ist erlaubt, wenn man sie aufschreibt

```markdown
> **Nachtrag 2026-09-16 — Mengenwähler vorgezogen (Grilling-Runde 9).** Der Mengenwähler aus
> Phase 9b, Punkt 1 ist **vor** den Commits 1–4 umgesetzt worden, als eigener Commit auf demselben
> Branch. Er ist ohne Migration, Typen und Service-Schicht lauffähig, und die Commits 3 und 4
> fassen sein Markup nicht an. …
>
> Die Obergrenze bleibt bei **8** Zimmern (`MAX_ROOMS_PER_BOOKING` in
> `src/views/BookingView/roomQuantity.ts`) — eine abweichende Zahl in der Oberfläche wurde
> erwogen und verworfen, weil der Gast die Ablehnung sonst erst beim Absenden erfährt. Mit dem
> Minimalseed (8 Zimmer in 3 Kategorien, V4) kann die Grenze nie greifen; sie ist trotzdem
> umgesetzt, weil der Seed nicht die Regel ist.
```

Zwei Sätze daraus sind für Lernende besonders wertvoll:

- **„Er ist ohne Migration, Typen und Service-Schicht lauffähig."** Das ist die Bedingung, unter der man einen Plan umstellen darf: Der vorgezogene Schritt darf nicht von etwas abhängen, das noch fehlt.
- **„…weil der Seed nicht die Regel ist."** Mit acht Zimmern im Testdatenbestand kann die Grenze von acht Zimmern pro Buchung nie überschritten werden. Man könnte sie also weglassen, ohne dass es auffällt. Genau das wäre falsch: Testdaten beschreiben einen Zustand, keine Regel.

### 2. `bookingState` bekommt Zimmermengen

Datei `src/shared/state/bookingState.ts`:

```ts
/**
 * Gewählte Zimmer je Kategorie, geschlüsselt nach `room_type_id`.
 *
 * Der Schlüssel ist bewusst die UUID und nicht der sprechendere `slug`: die Positionen
 * in `create_booking` (`p_positions`) verlangen genau diese ID.
 */
export type RoomQuantities = Readonly<Record<string, number>>;

let roomQuantities: Record<string, number> = {};
```

Warum die UUID und nicht der lesbare `slug` (`doppelzimmer`)? Weil die Datenbankfunktion, die die Mengen irgendwann verarbeitet, mit IDs arbeitet. Wer hier den `slug` nähme, müsste später an der Grenze zur Datenbank umschlüsseln – eine zusätzliche Stelle, an der etwas schiefgehen kann.

Die neuen Zugriffsfunktionen:

```ts
function getRoomQuantities(): RoomQuantities {
    return { ...roomQuantities };
}

function getRoomQuantity(roomTypeId: string): number {
    return roomQuantities[roomTypeId] ?? 0;
}

function setRoomQuantity(roomTypeId: string, rooms: number): void {
    setRoomQuantities({ ...roomQuantities, [roomTypeId]: rooms });
}

function setRoomQuantities(next: RoomQuantities): void {
    // Mengen von 0 fallen heraus, statt als `0` stehen zu bleiben: sonst wandern leere
    // Positionen bis in `create_booking` mit.
    roomQuantities = Object.fromEntries(Object.entries(next).filter(([, rooms]: [string, number]): boolean => rooms > 0));
    notify();
}
```

Drei Techniken auf engem Raum:

- **`{ ...roomQuantities }` beim Lesen** gibt eine **Kopie** heraus. Wer das Ergebnis verändert, verändert nicht versehentlich den Zustand – der ist nur über `set…` erreichbar, und nur dort wird `notify()` aufgerufen.
- **`?? 0`** – eine nicht gewählte Kategorie hat keinen Eintrag, also `undefined`. Wegen `noUncheckedIndexedAccess` in der `tsconfig.json` ist der Rückgabetyp von `roomQuantities[id]` tatsächlich `number | undefined`, und TypeScript zwingt zu dieser Behandlung.
- **`Object.entries` → `filter` → `Object.fromEntries`** ist das Standard-Idiom, um ein Objekt zu filtern. Hier fliegen alle Nullen heraus: „kein Eintrag" und „0 Zimmer" sollen dasselbe bedeuten, damit später keine leere Position in der Buchung landet.

### 3. Die Regeln als eigene Datei: `roomQuantity.ts`

Die neue Datei `src/views/BookingView/roomQuantity.ts` enthält **keine** DOM-Zugriffe und kein `this` – nur Funktionen, die Werte bekommen und Werte zurückgeben. Das ist der im Plan beschlossene Punkt `V16`: Tests für das Frontend sind vertagt, aber die Logik wird so geschnitten, dass sie später ohne Umbau testbar ist.

```ts
export const MAX_ROOMS_PER_BOOKING = 8;

export type QuantityLimit = 'none' | 'roomsFree' | 'total';

export function getTotalRooms(quantities: RoomQuantities): number {
    return Object.values(quantities).reduce((sum: number, rooms: number): number => sum + rooms, 0);
}

export function getRoomMax(roomsFree: number | null, otherRooms: number): number {
    return Math.max(0, Math.min(roomsFree ?? 0, MAX_ROOMS_PER_BOOKING - otherRooms));
}
```

`getRoomMax` beantwortet die Frage „wie viele Zimmer darf ich in **dieser** Karte höchstens wählen?". Es gibt zwei Grenzen, und die kleinere gewinnt:

1. `roomsFree` – wie viele Zimmer dieser Kategorie im Zeitraum frei sind (kommt aus `search_availability`),
2. `MAX_ROOMS_PER_BOOKING - otherRooms` – wie viel vom Gesamtkontingent von 8 noch übrig ist, nachdem man in **anderen** Karten schon gewählt hat.

Das äußere `Math.max(0, …)` verhindert negative Werte, falls die anderen Karten zusammen schon über 8 liegen.

Welche der beiden Grenzen gegriffen hat, ist nicht egal – davon hängt der Hinweistext ab:

```ts
export function clampQuantity(desired: number, roomsFree: number | null, otherRooms: number): ClampedQuantity {
    const max = getRoomMax(roomsFree, otherRooms);
    if (desired <= max) return { value: Math.max(0, desired), limitedBy: 'none' };

    // Bei Gleichstand gilt `rooms_free`: das ist eine Tatsache der Verfügbarkeit,
    // die Gesamtgrenze dagegen unsere Regel.
    return { value: max, limitedBy: (roomsFree ?? 0) <= MAX_ROOMS_PER_BOOKING - otherRooms ? 'roomsFree' : 'total' };
}

export function getLimitMessage(limit: QuantityLimit, roomsFree: number | null): string | null {
    switch (limit) {
        case 'none':
            return null;
        case 'total':
            return `Mehr als ${MAX_ROOMS_PER_BOOKING.toString()} Zimmer können nicht in einem Vorgang gebucht werden. Bitte kontaktieren Sie uns für Gruppenbuchungen.`;
        case 'roomsFree':
            return roomsFree === null || roomsFree === 0
                ? 'Für diesen Zeitraum sind keine Zimmer dieser Kategorie frei.'
                : `Für diesen Zeitraum ${formatRoomsFree(roomsFree)} frei.`;
    }
}
```

Der `switch` über einen String-Literal-Typ ohne `default`-Zweig ist ein bewährtes Muster: Kommt später ein vierter Wert zu `QuantityLimit` hinzu, meldet TypeScript, dass die Funktion nicht mehr in jedem Fall einen Wert zurückgibt.

Auch das Einlesen des Zahlenfeldes ist eine eigene Funktion – mit einer Begründung, die viele Anfänger überrascht:

```ts
/**
 * `type="number"` liefert bei gelöschtem Inhalt `''` und erlaubt Kommazahlen und
 * Vorzeichen — `min`/`max` sind dabei nur Hinweise. Verbindlich ist diese Funktion.
 */
export function normalizeQuantityInput(raw: string): number {
    const parsed = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}
```

`<input type="number" min="0" max="3">` hindert niemanden daran, `-7` oder `2,5` einzutippen. Die Attribute steuern nur die Pfeiltasten und die Formularvalidierung beim Absenden. **HTML-Attribute sind Hinweise, keine Prüfungen.**

### 4. Abgleich nach einer neuen Suche (`V16.6`)

Was passiert, wenn der Gast drei Doppelzimmer wählt und danach den Zeitraum ändert – und im neuen Zeitraum nur noch zwei frei sind?

```ts
/**
 * Der Zeitraum ist die teurere Entscheidung des Gastes, die Menge die billigere — also
 * fällt die billigere: der Zeitraum bleibt, Mengen sinken auf das, was noch geht.
 */
export function reconcileQuantities(quantities: RoomQuantities, rooms: readonly RoomCard[]): ReconciledQuantities {
    const next: Record<string, number> = {};
    const reasons: string[] = [];

    for (const room of rooms) {
        const wanted = quantities[room.roomTypeId] ?? 0;
        if (wanted === 0) continue;

        const availability = room.availability;
        if (availability === null) {
            next[room.roomTypeId] = wanted;
            continue;
        }

        if (!availability.isBookable) {
            reasons.push(`${room.name} ist für diesen Zeitraum nicht buchbar.`);
            continue;
        }

        const clamped = clampQuantity(wanted, availability.roomsFree, getTotalRooms(next));
        if (clamped.value > 0) next[room.roomTypeId] = clamped.value;
        if (clamped.value < wanted) {
            reasons.push(/* … */);
        }
    }

    return { quantities: next, notice: reasons.length === 0 ? null : `Ihre Auswahl wurde angepasst: ${reasons.join(' ')}` };
}
```

Die Designentscheidung steht im Kommentar: Zwei Eingaben widersprechen sich, und eine muss nachgeben. Nachgeben soll die, die der Gast **leichter wiederherstellen** kann. Einen Zeitraum im Kalender neu zu wählen, kostet mehrere Klicks; eine Zimmerzahl anzupassen, einen. Diese Art zu begründen („welche Korrektur kostet den Nutzer weniger?") lässt sich auf viele Formulare übertragen.

Wichtig ist auch der Satz, der zurückkommt: Der Gast wird **informiert**, statt dass sich seine Auswahl still ändert.

### 5. Das Markup in `Booking.ts`

Die Zimmerkarte bekommt ein `data`-Attribut und – wenn etwas gewählt ist – einen Ring:

```diff
-            <article class="flex flex-col 768:flex-row overflow-hidden ${isBookable ? '' : 'opacity-60'}">
+            <article data-room-card="${room.roomTypeId}" class="flex flex-col 768:flex-row overflow-hidden ${isBookable ? '' : 'opacity-60'} ${isSelected ? 'ring-2 ring-purple-haze' : ''}">
```

Der Mengenwähler selbst hat drei Zustände – je nachdem, was man über die Kategorie weiß:

```ts
private getRoomQuantityHtml(room: RoomCard): string {
    const availability = room.availability;

    // Ohne vollständigen Zeitraum kennt niemand `rooms_free`. Ein Feld ohne geprüfte
    // Obergrenze würde eine Menge versprechen, die es nicht geben muss.
    if (availability === null) {
        return /*html*/ `<p class="font-antic-didone text-16 text-purple-haze-dark/70">Bitte zuerst Zeitraum wählen</p>`;
    }

    // Nicht buchbare Kategorien zeigen ihren Grund (Zeile darunter), keinen Wähler.
    if (!availability.isBookable) return '';

    // … `−`-Knopf, <input type="number">, `+`-Knopf, Hinweiszeile
}
```

```html
<input
    id="${inputId}"
    data-room-quantity="${room.roomTypeId}"
    type="number"
    inputmode="numeric"
    min="0"
    max="${max.toString()}"
    step="1"
    value="${quantity.toString()}"
    class="booking__quantity w-16 456:w-20 appearance-none rounded-xl border …"
/>
<p data-room-quantity-notice="${room.roomTypeId}" aria-live="polite" class="…"></p>
```

- **`inputmode="numeric"`** öffnet auf dem Smartphone die Zifferntastatur.
- **`aria-live="polite"`** sorgt dafür, dass ein Screenreader den Hinweis vorliest, sobald er erscheint – ohne den Nutzer mitten im Satz zu unterbrechen.
- **`<label for="…">`** verbindet die Beschriftung „Anzahl Zimmer" mit dem Feld.

Eine bewusste Asymmetrie steckt im `+`-Knopf:

```ts
/**
 * `+` wird nur von `rooms_free` gesperrt, nicht von der Gesamtgrenze: die ist unsere
 * Regel, und ein ausgegrauter Knopf erklärt sie nicht. Der Klick löst stattdessen den
 * Hinweis aus (Q10).
 */
```

Ein deaktivierter Knopf sagt „geht nicht", aber nicht **warum**. Ist die Kategorie ausgebucht, ist das offensichtlich. Ist dagegen die Gesamtgrenze von 8 erreicht, würde der Gast rätseln. Also bleibt der Knopf klickbar, und der Klick erzeugt die Erklärung.

### 6. Ereignisse per Delegation – und kein Neuaufbau beim Tippen

Zwei Listener am Container der Zimmerliste genügen für alle Karten:

```ts
this.roomsEl?.addEventListener('click', (event: MouseEvent): void => {
    this.handleRoomsClick(event);
});
this.roomsEl?.addEventListener('change', (event: Event): void => {
    this.handleQuantityChange(event);
});
```

```ts
/** Geklemmt wird auf `change`, nicht bei jedem Tastendruck: sonst ist „1" auf dem Weg zu „12" nie tippbar. */
private handleQuantityChange(event: Event): void { /* … */ }
```

Der Kommentar beschreibt einen klassischen Fehler: Wer bei jedem `input`-Ereignis auf das Maximum kürzt, macht mehrstellige Eingaben unmöglich, sobald die erste Ziffer allein schon gültig wäre. `change` feuert erst, wenn der Nutzer das Feld verlässt oder Enter drückt.

Und nach einer Änderung wird die Liste **nicht** neu gerendert:

```ts
/**
 * Schreibt Mengen, Maxima, Knopf-Zustände und Hinweise direkt an die vorhandenen
 * Knoten — ohne `renderRooms()`, weil ein Neuaufbau der Liste den Fokus aus dem Feld
 * nimmt, in dem gerade getippt wird.
 */
private updateQuantityUi(notice: { roomTypeId: string; message: string } | null): void {
    // … für jede Karte: Ring umschalten, input.value / input.max setzen,
    //     −/+ deaktivieren, Hinweistext setzen
}
```

Das ist der Preis eines Projekts **ohne Framework**. Wer `innerHTML` neu setzt, zerstört alle Knoten darin – auch das Feld, in dem der Cursor steht. Frameworks wie Angular vergleichen den alten mit dem neuen Zustand und ändern nur, was sich unterscheidet. Hier übernimmt `updateQuantityUi` genau diese Aufgabe von Hand, gezielt über die `data-…`-Attribute.

### 7. Zwei kleinere Anpassungen

Damit die Karte die UUID kennt, lädt die Abfrage sie jetzt mit:

```diff
-                supabase.from('room_types').select('name, slug, description, room_type_images(storage_path, alt_text, sort_order)').order('name'),
+                supabase.from('room_types').select('id, name, slug, description, room_type_images(storage_path, alt_text, sort_order)').order('name'),
```

Und in `booking.css` verschwinden die eingebauten Pfeile des Zahlenfeldes:

```css
/*
    Mengenwähler: die nativen Spinner des Zahlenfeldes weichen den eigenen
    `−`/`+`-Knöpfen. `appearance: none` (Tailwind `appearance-none`) genügt in WebKit
    nicht — dort hängen die Pfeile an Pseudo-Elementen.
*/
.booking__quantity::-webkit-outer-spin-button,
.booking__quantity::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
}
```

Ein gutes Beispiel für die Regel aus der `CLAUDE.md`: Eigene CSS-Dateien gibt es für Fälle, die sich nicht mit Utility-Klassen abbilden lassen – Pseudo-Elemente wie `::-webkit-inner-spin-button` gehören dazu.

## Was wurde erreicht?

Der Gast kann zum ersten Mal **Zimmer auswählen**, und die Auswahl steht dort, wo sie später gebraucht wird: in `bookingState`, geschlüsselt nach `room_type_id`. Die Oberfläche hält sich an dieselbe Obergrenze, die die Datenbank prüfen wird – der Gast erfährt eine Ablehnung also sofort, nicht erst beim Absenden.

| Technik                                     | Wozu                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| Kopie beim Lesen aus dem Zustand            | Änderungen nur über `set…`, nie versehentlich                |
| Nullen aus dem Objekt filtern               | „nicht gewählt" und „0" bedeuten dasselbe                    |
| Reine Funktionen in eigener Datei           | später testbar, ohne Umbau (`V16`)                           |
| Clamp mit Grund (`limitedBy`)               | der Hinweis erklärt, welche Grenze gegriffen hat             |
| Klemmen auf `change`, nicht `input`         | mehrstellige Eingaben bleiben möglich                        |
| Gezielte DOM-Updates statt Neuaufbau        | der Fokus bleibt im Feld                                     |
| `aria-live="polite"`                        | Hinweise erreichen auch Screenreader                         |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](005_2026-09-16_belegung-verpflichtend-kein-suchdefault.md)
