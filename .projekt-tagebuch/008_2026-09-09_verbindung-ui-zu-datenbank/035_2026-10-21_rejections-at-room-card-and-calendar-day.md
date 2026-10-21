[← Vorheriger Commit](034_2026-10-21_selection-bar-below-room-list.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): show rejections at room card and calendar day (F5)

- **Commit:** `006ce87`
- **Datum:** 2026-10-21
- **Autor:** Oliver Jung

## Worum geht es?

Review-Punkt **F5** bzw. Punkt 8 von Phase 9b. Zwischen dem Moment, in dem der Gast die Verfügbarkeit sieht, und dem Klick auf „Buchen" können Minuten vergehen. Bucht in der Zeit jemand anderes das letzte Zimmer, lehnt `create_booking` ab. Bisher stand der Hinweis darauf nur **am Buchen-Knopf** – ganz unten, weit weg vom eigentlichen Problem.

Jetzt erscheint er zusätzlich **dort, wo das Problem liegt**:

- an der **Zimmerkarte** der abgelehnten Kategorie,
- am **Kalendertag** der abgelehnten Nacht (roter Rahmen, Tooltip) und als Satz über „weiter",
- der Kalender springt in den Monat dieser Nacht,
- Kalender und Zimmerliste werden neu geladen.

```text
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |  2 +-
 src/views/BookingView/Booking.ts                   | 45 ++++++++++++++++++++--
 src/views/BookingView/messages.spec.ts             | 23 ++++++++++-
 src/views/BookingView/messages.ts                  | 23 +++++++++++
 .../BookingView/templates/calendar.template.ts     | 10 +++--
 src/views/BookingView/templates/rooms.template.ts  |  3 ++
 6 files changed, 98 insertions(+), 8 deletions(-)
```

Die Commit-Message nennt auch hier, wie getestet wurde: Im Browser wurde **nach** der Auswahl eine Nacht über `room_blocks` gesperrt und dann gebucht – die Ablehnung erschien an Karte und Kalender, eine Buchung entstand nicht. So prüft man einen Fall, den man im normalen Klicken kaum herbeiführen kann.

## Die Änderungen im Detail

### 1. Welche Ablehnungen gehören an Karte und Kalender?

Datei: `src/views/BookingView/messages.ts`

Nicht jede Ablehnung hat einen Ort. Eine ungültige Adresse betrifft das Formular, nicht den Kalender. Deshalb bekommt nur die Gruppe „Verfügbarkeit hat sich geändert" zusätzliche Hinweise:

```ts
/** Ablehnungen, die heißen: Die Verfügbarkeit hat sich zwischen Anzeige und Buchen geändert. */
const AVAILABILITY_REJECTIONS: ReadonlySet<RejectionCode> = new Set<RejectionCode>(['nicht_buchbar', 'ausgebucht', 'kein_preis', 'zu_klein']);

/** Die Hinweise am Ort des Problems (Phase 9b, Punkt 8) – zusätzlich zur Meldung am Buchen-Knopf. */
export type RejectionHints = {
    /** An der Zimmerkarte der abgelehnten Kategorie. */
    room: string;
    /** Unter dem Kalender – nur, wenn die Datenbank eine Nacht nennt. */
    calendar: string | null;
};

/**
 * `null` für Ablehnungen, die nichts mit Karte und Kalender zu tun haben (Adresse,
 * Leistungen, Belegung) – die stehen nur am Buchen-Knopf.
 */
export function getRejectionHints(code: RejectionCode | null, night: string | null): RejectionHints | null {
    if (code === null || !AVAILABILITY_REJECTIONS.has(code)) return null;
    return {
        room: night === null ? 'Nicht mehr buchbar – bitte prüfen Sie Ihre Auswahl.' : `Für die Nacht vom ${night} nicht mehr buchbar.`,
        calendar: night === null ? null : `Die Nacht vom ${night} ist nicht mehr buchbar – bitte prüfen Sie Ihren Zeitraum.`,
    };
}
```

Ein `Set` ist hier die passende Datenstruktur: Die Frage ist nur „gehört dieser Code dazu?", und `has()` beantwortet sie direkt. Der Typ `ReadonlySet<RejectionCode>` sorgt dafür, dass niemand versehentlich einen Tippfehler wie `'ausgebucht '` hineinschreibt – der Compiler kennt alle gültigen Codes.

Die Tests prüfen beide Seiten der Grenze:

```ts
it.each(['nicht_buchbar', 'ausgebucht', 'kein_preis', 'zu_klein'] as const)('zeigt bei %s Hinweise an Karte und Kalender', (code) => {
    expect(getRejectionHints(code, '30.10.2026')).toEqual({
        room: 'Für die Nacht vom 30.10.2026 nicht mehr buchbar.',
        calendar: 'Die Nacht vom 30.10.2026 ist nicht mehr buchbar – bitte prüfen Sie Ihren Zeitraum.',
    });
});

it.each(['ungueltige_adresse', 'ungueltige_leistung', 'ungueltige_belegung', 'vergangenheit'] as const)('lässt %s nur am Buchen-Knopf stehen', (code) => {
    expect(getRejectionHints(code, '30.10.2026')).toBeNull();
});
```

`as const` macht aus dem Array eine Liste von **Literal-Typen** – so passt jeder Wert zum Parameter `RejectionCode` statt nur zu `string`.

### 2. Die View merkt sich die Ablehnung

Datei: `src/views/BookingView/Booking.ts`

Ein neues Feld hält die letzte Ablehnung fest – mit genau den Angaben, die Karte und Kalender brauchen:

```ts
// Die letzte Ablehnung aus `create_booking`, am Ort des Problems angezeigt (Phase 9b,
// Punkt 8): an der Zimmerkarte und am Kalendertag. Weg, sobald Zeitraum oder Belegung
// sich ändern – dann gilt die Aussage nicht mehr.
private rejection: { roomTypeId: string | null; night: Date | null; roomHint: string; calendarHint: string | null } | null = null;
```

Gesetzt wird es direkt nach der Ablehnung, **bevor** Kalender und Zimmerliste neu laden:

```diff
         if (!result.ok) {
             this.setSubmitting(false);
             this.showCheckoutError(this.getRejectionText(result.error));
+            this.rememberRejection(result.error);
             …
             this.calendarCache.clear();
             void this.loadCalendar();
             void this.loadRooms();
```

```ts
private rememberRejection(rejection: BookingRejection): void {
    const night = rejection.date === null ? null : parseISODate(rejection.date);
    const hints = getRejectionHints(rejection.code, night === null ? null : formatDate(night));
    this.rejection = hints === null ? null : { roomTypeId: rejection.roomTypeId, night, roomHint: hints.room, calendarHint: hints.calendar };

    if (this.rejection !== null && night !== null) {
        this.displayedYear = night.getFullYear();
        this.displayedMonth = night.getMonth();
    }
}
```

Die Reihenfolge ist gewollt: `rememberRejection` rendert selbst nichts. Angezeigt wird der Hinweis durch das **Neuladen**, das unmittelbar folgt – Kalender und Liste zeichnen sich ohnehin neu und lesen dabei `this.rejection`. Der Monatssprung sorgt dafür, dass die markierte Nacht auch auf dem sichtbaren Kalenderblatt liegt.

Ein kleiner Schönheitsfehler im Diff: Die neue Methode samt JSDoc wurde **zwischen** den Kommentar von `getRejectionText` und die Methode selbst eingefügt. Dadurch steht jetzt der alte Kommentar („Ablehnung aus `create_booking` als Satz mit Kategorie und Nacht …") über dem Kommentar von `rememberRejection`, und `getRejectionText` hat keinen mehr. Kein Linter bemerkt so etwas – beim Einfügen neuer Methoden lohnt ein Blick darauf, welcher Kommentar zu welcher Methode gehört.

### 3. Der Hinweis verschwindet, wenn er nicht mehr stimmt

Ändert der Gast Zeitraum oder Belegung, ist die Aussage „die Nacht vom 30.10. ist nicht mehr buchbar" für seine neue Auswahl nicht mehr zutreffend. Deshalb setzen alle drei Eingabewege den Zustand zurück:

```diff
     private selectDate(iso: string): void {
+        this.rejection = null;
 …
     private clearSelection(): void {
+        this.rejection = null;
 …
+        this.rejection = null;
         // Gleicht die Kinderbetten gleich mit ab (siehe `setGuests`).
         bookingState.setGuests({ … });
```

Für Lernende: Bei jedem Zustand, den man anzeigt, gehört die Frage dazu, **wann er ungültig wird**. Ein Hinweis, der stehen bleibt, obwohl er nicht mehr stimmt, verwirrt mehr als gar keiner.

Bemerkenswert ist auch, **wo** dieser Zustand liegt: in der View, nicht im `bookingState`. Die Ablehnung ist kein Teil des Buchungsentwurfs, sondern eine Rückmeldung an genau diese Seite – und verschwindet mit ihr.

### 4. Zimmerkarte

```diff
             availabilityHtml: getAvailabilityHtml(room.availability),
+            rejectionHint: this.rejection !== null && this.rejection.roomTypeId === room.roomTypeId ? this.rejection.roomHint : null,
         });
```

Das Template zeigt den Satz in Rot, wenn es einen gibt – escapt, weil Text:

```diff
                 ${view.availabilityHtml}
+                ${view.rejectionHint === null ? '' : /*html*/ `<p class="font-antic-didone text-16 leading-tight text-red-600">${escapeHtml(view.rejectionHint)}</p>`}
```

### 5. Kalendertag und Kalenderfuß

Die View berechnet zwei neue Werte je Tag – ob er markiert wird und welcher Tooltip gilt:

```ts
/** Die abgelehnte Nacht nennt ihre Ablehnung, alle anderen gesperrten Tage ihren Grund. */
private getDayTooltip(cell: DayCell): string | null {
    const calendarHint = this.rejection?.calendarHint ?? null;
    if (calendarHint !== null && this.isRejectedNight(cell.date)) return calendarHint;
    return cell.blocked && cell.blockReason !== null ? formatBlockedNight(formatDate(cell.date), cell.blockReason) : null;
}

private isRejectedNight(date: Date): boolean {
    const night = this.rejection?.night ?? null;
    return night !== null && isSameDay(night, date);
}
```

Im Template wird aus `flagged` ein roter Ring; der Fuß bekommt einen optionalen Satz über dem „weiter"-Knopf:

```diff
-            class="… transition-colors ${cell.stateClass}"
+            class="… transition-colors ${cell.stateClass} ${cell.flagged ? 'ring-2 ring-red-600' : ''}"
```

```diff
-export function getCalendarFooterHtml(canContinue: boolean): string {
+/** `rejectionHint`: nach einer Ablehnung die betroffene Nacht, über dem Knopf. */
+export function getCalendarFooterHtml(canContinue: boolean, rejectionHint: string | null): string {
     return /*html*/ `
+        ${rejectionHint === null ? '' : /*html*/ `<p class="mt-6 768:mt-8 font-antic-didone text-16 leading-tight text-red-600 text-center">${escapeHtml(rejectionHint)}</p>`}
```

Ein Tooltip allein reicht nicht: Auf Touch-Geräten gibt es kein „Darüberfahren", und Screenreader lesen `title` nicht zuverlässig vor. Deshalb steht dieselbe Information zusätzlich als sichtbarer Satz unter dem Kalender.

## Was wurde erreicht?

Eine abgelehnte Buchung führt den Gast jetzt an die Stelle, an der er etwas ändern muss – statt ihn mit einer Meldung am Seitenende allein zu lassen. Mit F3, F4 und F5 sind die **inhaltlichen Punkte aus Gruppe F** erledigt; im Review-Dokument offen bleiben F6 (den Umsetzungsplan auf den aktuellen Stand bringen) und Gruppe G (Barrierefreiheit).

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
