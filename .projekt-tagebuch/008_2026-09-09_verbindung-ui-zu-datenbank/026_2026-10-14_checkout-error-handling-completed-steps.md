[← Vorheriger Commit](025_2026-10-14_formatting-functions-calendar-logic.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(validation): implement checkout error handling and completed steps logic

- **Commit:** `7a4169b`
- **Datum:** 2026-10-14
- **Autor:** Oliver Jung

## Worum geht es?

Review-Punkt **D3**: Die Regeln „Was fehlt noch vor dem Buchen?" und „Welche Schritte im Header sind erledigt?" ziehen aus der View in ein eigenes Modul `domain/validation.ts`. Der Review-Punkt enthält einen wichtigen Zusatz:

> Beide stützen sich auf `getMissingBeds() === 0`, **nicht** auf den Anzeigetext `getCapacityText() === ''`.

Genau darum geht es didaktisch in diesem Commit: **Logik darf nicht an Anzeigetexten hängen.**

```text
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |   3 +-
 src/shared/state/bookingState.ts                   |   4 +-
 src/shared/types/booking.types.ts                  |  11 +++
 src/views/BookingView/Booking.ts                   |  74 ++++-----------
 src/views/BookingView/domain/validation.spec.ts    | 102 +++++++++++++++++++++
 src/views/BookingView/domain/validation.ts         |  52 +++++++++++
 src/views/BookingView/roomQuantity.ts              |   6 ++
 src/views/LayoutViews/MainHeader.ts                |   3 +-
 8 files changed, 196 insertions(+), 59 deletions(-)
```

Nebenbei enthält der Commit eine Reihe von Tailwind-Klassen-Umschreibungen in `Booking.ts`, die nicht zum Thema gehören – und von denen drei das Markup **beschädigt** haben (Abschnitt 5).

## Die Änderungen im Detail

### 1. Das Problem: Logik, die Texte vergleicht

Vorher lagen beide Regeln als Methoden in der View:

```ts
private getCheckoutError(draft: BookingDraft, invalid: readonly InvalidField[]): string | null {
    if (draft.checkIn === null || draft.checkOut === null) return 'Bitte wählen Sie zuerst Ihren Zeitraum.';
    if (draft.adults === null) return 'Bitte wählen Sie die Anzahl der Gäste.';
    if (draft.positions.length === 0) return 'Bitte wählen Sie mindestens ein Zimmer.';

    const capacity = this.getMissingBedsNotice();
    if (capacity !== '') return capacity;

    return invalid.length === 0 ? null : FORM_INCOMPLETE;
}
```

Und der Aufrufer musste anhand des **Textes** entscheiden, ob das Problem im Formular liegt:

```ts
const message = this.getCheckoutError(draft, invalid);
this.markInvalidFields(invalid, message === FORM_INCOMPLETE);
```

Zwei Stellen hängen hier an Zeichenketten, die eigentlich nur für Menschen gedacht sind:

- `capacity !== ''` – „es fehlen Betten" wurde daran erkannt, dass ein **Hinweistext** nicht leer ist.
- `message === FORM_INCOMPLETE` – „das Problem liegt im Formular" wurde daran erkannt, dass die Meldung **wörtlich** einem bestimmten Satz entspricht.

Ändert jemand den Wortlaut eines Hinweises oder liefert die Bettenprüfung einmal in einem Grenzfall einen leeren Text, bricht still die Logik – ohne Compilerfehler.

### 2. Die Lösung: `domain/validation.ts` mit strukturiertem Ergebnis

Statt eines Strings liefert `getCheckoutError` jetzt ein Objekt mit dem **Bereich** der Seite und der Meldung:

```ts
/** Bereich der Seite, in dem das Problem liegt – die View entscheidet daran, wohin sie springt. */
export type CheckoutSection = 'dates' | 'guests' | 'rooms' | 'form';

export type CheckoutError = {
    section: CheckoutSection;
    message: string;
};

export function getCheckoutError(draft: BookingDraft, rooms: readonly RoomCard[]): CheckoutError | null {
    if (draft.checkIn === null || draft.checkOut === null) return { section: 'dates', message: 'Bitte wählen Sie zuerst Ihren Zeitraum.' };
    if (draft.adults === null) return { section: 'guests', message: 'Bitte wählen Sie die Anzahl der Gäste.' };
    if (draft.positions.length === 0) return { section: 'rooms', message: 'Bitte wählen Sie mindestens ein Zimmer.' };

    const missingBeds = getDraftMissingBeds(draft, rooms);
    if (missingBeds !== null && missingBeds > 0) return { section: 'rooms', message: formatMissingBedsNotice(missingBeds) };

    if (getInvalidFields(draft).length > 0) return { section: 'form', message: 'Bitte tragen Sie alle notwendigen Informationen ein.' };
    return null;
}
```

Die View entscheidet jetzt anhand eines Union-Typs, nicht anhand eines Satzes:

```diff
-        const message = this.getCheckoutError(draft, invalid);
+        const checkoutError = getCheckoutError(draft, this.rooms);
         // In das Formular springen nur, wenn dort auch das Problem liegt – nicht, wenn
         // noch das Zimmer fehlt.
-        this.markInvalidFields(invalid, message === FORM_INCOMPLETE);
-        this.showCheckoutError(message);
-        if (message !== null || checkIn === null || …) return;
+        this.markInvalidFields(invalid, checkoutError?.section === 'form');
+        this.showCheckoutError(checkoutError?.message ?? null);
+        if (checkoutError !== null || checkIn === null || …) return;
```

Die Konstante `FORM_INCOMPLETE` fällt weg – sie existierte nur, damit man auf sie vergleichen konnte. Ein Tippfehler in `'from'` statt `'form'` wäre jetzt ein Compilerfehler; ein geänderter Wortlaut der Meldung bricht nichts mehr.

Das ist dasselbe Prinzip wie bei den Ablehnungs-Codes aus Commit 022: **Für die Maschine ein Code, für den Menschen ein Text** – und die Logik prüft nur den Code.

### 3. Die Bettenprüfung über die Zahl, nicht über den Text

Der Hinweistext zu fehlenden Betten stand vorher in der View. Er zieht als eigene Funktion nach `roomQuantity.ts`, gleich neben `getMissingBeds`:

```ts
/** Hinweis unter der Zimmerliste, solange Betten fehlen – leer, wenn alle Gäste eins haben. */
export function formatMissingBedsNotice(missingBeds: number): string {
    if (missingBeds === 0) return '';
    return missingBeds === 1 ? 'Noch 1 Person ohne Bett – bitte ein weiteres Zimmer wählen.' : `Noch ${missingBeds.toString()} Personen ohne Bett – bitte weitere Zimmer wählen.`;
}
```

Damit gibt es eine klare Trennung: `getMissingBeds` liefert die **Zahl** (für Entscheidungen), `formatMissingBedsNotice` macht daraus den **Text** (für die Anzeige). Die Validierung nutzt nur die Zahl, über eine kleine Hilfsfunktion:

```ts
/**
 * Fehlende Betten für die Gäste des Entwurfs – `null`, solange die Zahl der Erwachsenen
 * offen ist: Dann lässt sich nicht sagen, ob die Betten reichen.
 */
function getDraftMissingBeds(draft: BookingDraft, rooms: readonly RoomCard[]): number | null {
    if (draft.adults === null) return null;

    const quantities: RoomQuantities = Object.fromEntries(draft.positions.map(({ roomTypeId, rooms: count }): [string, number] => [roomTypeId, count]));
    return getMissingBeds(quantities, rooms, draft.adults + draft.children);
}
```

Bemerkenswert: Die Funktion rechnet aus dem **Entwurf** (`draft.positions`), nicht aus dem Store. Sie wandelt die Positionsliste zurück in die Mengen-Map, die `getMissingBeds` erwartet. So kennt `validation.ts` den Store nicht – die Regel aus `CLAUDE.md` „die Fachlogik importiert nichts aus `bookingState`" bleibt gewahrt.

### 4. `getCompletedSteps` – dieselben Regeln für den Header

Auch die Header-Schritte aus Commit 014 bekommen eine reine Funktion:

```ts
/**
 * Welche Schritte im Header erledigt sind – mit denselben Bedingungen, die
 * `getCheckoutError` vor dem Buchen prüft. Die Schritte hängen nicht voneinander ab:
 * Wer zuerst das Formular ausfüllt, sieht Schritt 3 schon als erledigt.
 */
export function getCompletedSteps(draft: BookingDraft, rooms: readonly RoomCard[]): BookingStep[] {
    const steps: BookingStep[] = [];
    if (draft.checkIn !== null && draft.checkOut !== null && draft.adults !== null) steps.push(1);
    if (draft.positions.length > 0 && getDraftMissingBeds(draft, rooms) === 0) steps.push(2);
    if (getInvalidFields(draft).length === 0) steps.push(3);
    return steps;
}
```

Die View-Methode schrumpft auf einen Einzeiler:

```diff
-        const draft = this.getBookingDraft();
-        const steps: BookingStep[] = [];
-        if (draft.checkIn !== null && draft.checkOut !== null && draft.adults !== null) steps.push(1);
-        if (draft.positions.length > 0 && this.getMissingBedsNotice() === '') steps.push(2);
-        if (getInvalidFields(draft).length === 0) steps.push(3);
-
-        bookingState.setCompletedSteps(steps);
+        bookingState.setCompletedSteps(getCompletedSteps(this.getBookingDraft(), this.rooms));
```

Auch hier wurde `this.getMissingBedsNotice() === ''` (Textvergleich) durch `getDraftMissingBeds(…) === 0` (Zahlvergleich) ersetzt. Und ein feiner Unterschied: `getDraftMissingBeds` liefert `null`, solange die Erwachsenen fehlen – `null === 0` ist `false`, also gilt Schritt 2 dann **nicht** als erledigt. Ein eigener Test sichert das ab:

```ts
it('meldet Schritt 2 nicht, solange die Erwachsenen offen sind', () => {
    expect(getCompletedSteps(draft({ adults: null }), ROOMS)).not.toContain(2);
});
```

### 5. Die Typen ziehen nach `booking.types.ts`

`validation.ts` braucht `BookingDraft` und `BookingStep`. Beide lagen bisher an Stellen, aus denen die Fachlogik nicht importieren soll – `BookingDraft` als lokaler Typ in `Booking.ts`, `BookingStep` in `bookingState.ts`. Sie ziehen in die gemeinsame Typdatei:

```ts
/** Stand der Buchung während der Eingabe – was noch fehlt, ist `null`. */
export type BookingDraft = Omit<BookingRequest, 'checkIn' | 'checkOut' | 'adults'> & {
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
    adults: number | null;
};

/** Die Schritte im Header: 1 = Zeitraum und Gäste, 2 = Zimmer, 3 = Kontaktdaten. */
export type BookingStep = 1 | 2 | 3;
```

`MainHeader.ts` und `bookingState.ts` importieren `BookingStep` jetzt von dort. Das ist die Regel aus Commit 022: Typen, die mehrere Schichten nutzen, gehören nach `shared/types/`.

### 6. Die Tests

`validation.spec.ts` baut einen vollständigen Entwurf und verändert pro Test genau ein Feld – ein verbreitetes Muster für Validierungstests:

```ts
/** Ein vollständiger Entwurf: 2 Erwachsene im Doppelzimmer, Formular ausgefüllt. */
function draft(overrides: Partial<BookingDraft> = {}): BookingDraft {
    return {
        checkIn: '2026-06-12',
        // …
        ...overrides,
    };
}

it('meldet fehlende Betten – Kinder zählen mit', () => {
    expect(getCheckoutError(draft({ children: 1 }), ROOMS)).toEqual({ section: 'rooms', message: 'Noch 1 Person ohne Bett – bitte ein weiteres Zimmer wählen.' });
});

it('zählt die Betten über mehrere Kategorien zusammen', () => {
    const positions = [
        { roomTypeId: 'double', rooms: 1 },
        { roomTypeId: 'single', rooms: 1 },
    ];
    expect(getCheckoutError(draft({ children: 1, positions }), ROOMS)).toBeNull();
});
```

Der Test „fragt zuerst nach dem Zeitraum" lässt bewusst **alles** fehlen und prüft, dass trotzdem nur der Zeitraum gemeldet wird. Damit ist die **Reihenfolge** der Prüfungen festgehalten – der Kommentar im Code („in der Reihenfolge der Seite, damit der Gast von oben nach unten arbeiten kann") wird so zu einer prüfbaren Aussage.

### 7. Beifang: Tailwind-Klassen umgeschrieben – drei davon kaputt

Im Diff von `Booking.ts` stecken neben D3 Änderungen an Klassennamen, die mit der Validierung nichts zu tun haben. Tailwind v4 kennt für viele Arbitrary Values (`w-[1.625rem]`) inzwischen kanonische Klassen (`w-6.5`), und Editor-Erweiterungen bieten an, sie automatisch umzuschreiben. Die meisten Umschreibungen sind korrekt:

```diff
-    <svg class="w-6 h-6 768:w-[1.625rem] 768:h-[1.625rem]" …>
+    <svg class="w-6 h-6 768:w-6.5 768:h-6.5" …>
```

```diff
-            <div class="w-full 992:max-w-[31.0625rem] flex flex-col gap-5">
+            <div class="w-full 992:max-w-124.25 flex flex-col gap-5">
```

```diff
-                <div class="absolute inset-0 bg-gradient-to-b from-transparent …"></div>
+                <div class="absolute inset-0 bg-linear-to-b from-transparent …"></div>
```

(`bg-gradient-to-b` heißt in Tailwind v4 `bg-linear-to-b`; 1 Einheit = 0,25 rem, also `1.625rem` = `6.5`.)

Drei Stellen sind dabei aber **beschädigt** worden:

```diff
-                <span class="… w-10 h-10 768:w-[2.625rem] 768:h-[2.625rem] rounded-full …">
+                <span class="… w-10 h-10 768:w-10.5-[2.625rem] rounded-full …">
```

```diff
-            <div class="relative shrink-0 768:w-76 aspect-[304/321]">
+            <div class="relative shrink-0 768:w-76 aspect-304/321
```

```diff
-                <h3 class="… leading-tight text-eggshell break-words">${escapeHtml(room.name)}</h3>
+                <h3 class="… leading-tight text-eggshell wrap-break-wordword">${escapeHtml(room.name)}</h3>
```

- Beim Gäste-Icon ist aus zwei Klassen eine ungültige geworden (`768:w-10.5-[2.625rem]`), die Höhe `768:h-…` fehlt ganz.
- Beim Zimmerbild fehlt das schließende `">`. Das `class`-Attribut läuft damit weiter bis zum nächsten `"` im Template – der Browser verschluckt das Bild und das nächste `<div>` als Teil des Attributs. Die Folge: Die Zimmerkarte lag als Overlay über dem Kalender.
- Beim Zimmernamen ist das Wortende verdoppelt (`wrap-break-wordword`) – eine Klasse, die es nicht gibt.

**Warum hat das niemand gemerkt?** Weil das HTML in **Template-Strings** steckt. Für TypeScript ist `` `<div class="…` `` einfach ein String – ob er gültiges HTML ergibt, prüfen weder `tsc` noch ESLint noch die Unit-Tests (die testen die Fachlogik, nicht die Templates). Der Fehler zeigt sich nur im Browser. Behoben wurde er im nächsten Commit (027).

Für Lernende zwei Lehren daraus:

1. **Automatische Umschreibungen gehören in einen eigenen Commit.** Hier stecken sie zwischen 52 Zeilen Validierungslogik. Ein eigener Commit „Tailwind-Klassen auf v4-Schreibweise" wäre im Review sofort als „nur Klassennamen – im Browser prüfen" erkennbar gewesen.
2. **Nach Änderungen an Templates im Browser nachsehen.** Bei String-Templates ist der Browser der einzige „Compiler" für das Markup. Eine Suche wie `grep -n 'class="[^"]*$'` findet unvollständige `class`-Attribute auf einer Zeile immerhin schnell.

### 8. Review-Dokument

```diff
-- [ ] D3: `domain/validation.ts` anlegen mit `getCheckoutError(draft, rooms)` und `getCompletedSteps(state)`. …
+- [x] D3: … Umgesetzt mit `validation.spec.ts`: `getCheckoutError(draft, rooms)` liefert `{ section, message }`, die View springt nur bei `section === 'form'` ins Formular (statt Textvergleich mit `FORM_INCOMPLETE`). …
```

## Was wurde erreicht?

| Technik                                               | Wozu                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Strukturiertes Ergebnis `{ section, message }`        | Entscheidungen über einen Union-Typ statt über einen Satz     |
| Zahl (`getMissingBeds`) und Text (`format…`) getrennt | Logik hängt nicht mehr am Wortlaut von Hinweisen              |
| Regeln als reine Funktionen in `domain/`              | Checkout und Header nutzen nachweislich dieselben Bedingungen |
| Gemeinsame Typen in `shared/types/`                   | Fachlogik importiert weder aus der View noch aus dem Store    |
| Test-Fabrik `draft(overrides)`                        | ein vollständiger Fall, pro Test genau eine Abweichung        |

Und eine Warnung: Template-Strings sind für den Compiler unsichtbar. Die beschädigten Klassen aus Abschnitt 7 sind ein Argument für Punkt D8 des Reviews (Templates in eigene Dateien) – und dafür, Änderungen am Markup immer im Browser anzusehen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](027_2026-10-14_catalog-service-booking-state-destroy-hook.md)
