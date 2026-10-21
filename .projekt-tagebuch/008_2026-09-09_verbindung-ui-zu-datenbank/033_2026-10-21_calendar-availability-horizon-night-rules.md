[← Vorheriger Commit](032_2026-10-21_generated-database-types-posts-service.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): calendar availability, horizon and night rules (F3)

- **Commit:** `8276f2b`
- **Datum:** 2026-10-21
- **Autor:** Oliver Jung

## Worum geht es?

Review-Punkt **F3** bzw. Phase 9 des Umsetzungsplans. Bis hierher kannte der Kalender nur eine Regel: `selectable: !isPast` – alles ab heute war wählbar, auch ausgebuchte Nächte, und man konnte beliebig weit in die Zukunft blättern. Jetzt fragt der Kalender die Datenbankfunktion `availability_calendar` und setzt drei Entscheidungen um:

| Entscheidung | Inhalt                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| `E29`        | Anreisetag: Die Nacht ab diesem Tag muss frei sein. Abreisetag: alle Nächte **davor** frei. |
| `E30`, `V14` | Blättern endet am Buchungshorizont (`hotels.booking_horizon_days`)                          |
| `E24`, `E28` | Gesperrte Tage durchgestrichen, mit Tooltip – Gäste sehen einen maskierten Grund            |

```text
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |   4 +-
 src/shared/services/catalog.service.spec.ts        |  37 +++++-
 src/shared/services/catalog.service.ts             |  44 ++++++-
 src/shared/types/catalog.types.ts                  |  30 ++++-
 src/views/BookingView/Booking.ts                   | 140 +++++++++++++++++----
 src/views/BookingView/domain/calendar.spec.ts      | 135 +++++++++++++++++++-
 src/views/BookingView/domain/calendar.ts           |  94 +++++++++++++-
 src/views/BookingView/messages.spec.ts             |  13 +-
 src/views/BookingView/messages.ts                  |  19 +++
 .../BookingView/templates/calendar.template.ts     |  23 +++-
 10 files changed, 497 insertions(+), 42 deletions(-)
```

Hier zahlt sich die Vorarbeit aus Gruppe D aus: Jede Schicht hat ihren Platz – Service lädt, `domain/calendar.ts` entscheidet, `Booking.ts` koordiniert, das Template zeichnet.

## Die Änderungen im Detail

### 1. Service: Verfügbarkeit je Nacht laden

Datei: `src/shared/services/catalog.service.ts`

```ts
/** Eine Zeile je Nacht im Zeitraum, mit dem für Gäste maskierten Grund (E24, E28). */
export async function fetchAvailabilityCalendar(search: CalendarSearch): Promise<AvailabilityNightRow[]> {
    // Ohne `unknown`-Umweg wären `rooms_free` und `unavailable_reason` hier nie NULL –
    // so beschreibt der Generator Rückgaben von Funktionen.
    const response: { data: unknown; error: { message: string } | null } = await supabase.rpc('availability_calendar', {
        p_from: search.from,
        p_to: search.to,
        p_adults: search.adults,
        p_children: search.children,
    });
    const { data, error } = response;
    if (error) throw new Error(error.message);
    return data as AvailabilityNightRow[];
}
```

Dieselbe Einsicht wie in Commit 032: Für Funktionsrückgaben behauptet der Generator „nie `null`". Deshalb wird die Antwort bewusst als `unknown` gelesen und gegen einen **handgeschriebenen** Typ `AvailabilityNightRow` gelegt.

Die Zeilen werden anschließend in eine **Nachschlagetabelle** (`Map`) umgebaut – der Kalender fragt später „Was ist mit der Nacht vom 2026-10-24?", und eine `Map` beantwortet das ohne Suche:

```ts
/** Die Nächte als Nachschlagetabelle für die Tagesregeln – unbekannte Gründe werden zu `nicht_buchbar`. */
export function buildNightAvailability(rows: readonly AvailabilityNightRow[]): NightAvailability {
    return new Map(
        rows.map((row: AvailabilityNightRow): [string, NightStatus] => [
            row.night,
            {
                available: row.is_available,
                reason: row.is_available ? null : row.unavailable_reason !== null && isUnavailableReason(row.unavailable_reason) ? row.unavailable_reason : 'nicht_buchbar',
            },
        ]),
    );
}
```

Unbekannte Gründe aus der Datenbank werden an der Grenze zu `nicht_buchbar` – dasselbe Prinzip wie bei den Ablehnungscodes in Commit 022: **Daten von außen einmal prüfen, danach nur noch mit gültigen Werten arbeiten.**

Außerdem lädt `fetchHotel` jetzt zusätzlich `booking_horizon_days`, und `HotelRow` bekommt die Spalte im `Pick` dazu.

### 2. Die Tagesregeln als reine Funktionen

Datei: `src/views/BookingView/domain/calendar.ts`

Alles, wonach ein Tag wählbar ist, wird in einem Objekt gebündelt:

```ts
/** Alles, wonach ein Tag wählbar ist oder nicht. `today` kommt von außen, damit es testbar bleibt. */
export type CalendarRules = {
    today: Date;
    /** `hotels.booking_horizon_days` (E30) – `null`, solange das Hotel nicht geladen ist: dann ohne Grenze. */
    horizonDays: number | null;
    /**
     * `null` heißt: keine Daten – noch keine Belegung gewählt (V16.7) oder Laden fehlgeschlagen.
     * Dann sperrt nur das Datum; verbindlich prüft ohnehin `create_booking` (E24: Komfort,
     * keine Garantie).
     */
    nights: NightAvailability | null;
};
```

Die zentrale Funktion beantwortet: Warum ist die Nacht ab diesem Tag nicht buchbar?

```ts
export function getNightBlockReason(night: Date, rules: CalendarRules): UnavailableReason | null {
    const today = stripTime(rules.today);
    if (night < today) return 'vergangenheit';
    if (rules.horizonDays !== null && night >= addDays(today, rules.horizonDays)) return 'ausserhalb_horizont';

    const status = rules.nights?.get(toISODate(night));
    if (status === undefined || status.available) return null;
    return status.reason ?? 'nicht_buchbar';
}
```

Daraus folgen die beiden Regeln aus `E29`. Der Kommentar zur Abreise ist der fachliche Kern des Commits:

```ts
/** Anreisetag: Die Nacht, die an diesem Tag beginnt, muss frei sein (E29). */
export function isSelectableAsCheckIn(date: Date, rules: CalendarRules): boolean {
    return getNightBlockReason(date, rules) === null;
}

/**
 * Abreisetag: Jede Nacht von der Anreise bis zur Nacht VOR diesem Tag muss frei sein.
 *
 * Die Nacht, die am Abreisetag beginnt, zählt nicht – ein als Nacht ausgebuchter Tag ist
 * als Abreisetag völlig legitim, und genau davon leben Anschlussbuchungen (E8, E29).
 * Geprüft wird die ganze Kette, nicht nur die Vornacht: Ein Zeitraum über eine volle
 * Nacht hinweg ist nicht buchbar, auch wenn die letzte Nacht frei ist.
 */
export function isSelectableAsCheckOut(date: Date, checkIn: Date, rules: CalendarRules): boolean {
    if (date <= checkIn) return false;
    for (let night = stripTime(checkIn); night < date; night = addDays(night, 1)) {
        if (getNightBlockReason(night, rules) !== null) return false;
    }
    return true;
}
```

Ein Beispiel macht es greifbar: Die Nacht vom 15. auf den 16. ist ausgebucht.

| Tag | als Anreise | als Abreise (Anreise am 12.)                 |
| --- | ----------- | -------------------------------------------- |
| 15. | gesperrt    | **erlaubt** – Nächte 12., 13., 14. sind frei |
| 17. | erlaubt     | gesperrt – die Kette läuft über den 15.      |

Hotels vergeben Zimmer **pro Nacht**, nicht pro Tag. Wer am 15. abreist, belegt die Nacht ab dem 15. nicht mehr – deshalb kann am selben Tag jemand anderes anreisen.

Auch das Blättern wird zur reinen Funktion:

```ts
/**
 * Vorwärts höchstens bis zum Monat mit dem letzten wählbaren Tag (E30, V14). Das ist der
 * Abreisetag nach der letzten buchbaren Nacht – deshalb `<=` und nicht `<`.
 */
export function canGoNext(year: number, month: number, rules: CalendarRules): boolean {
    if (rules.horizonDays === null) return true;
    return new Date(year, month + 1, 1) <= addDays(stripTime(rules.today), rules.horizonDays);
}

/** Lokale Kalendertage, nicht 24-Stunden-Schritte – die Zeitumstellung soll kein Datum verschieben. */
export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
```

Der Kommentar an `addDays` verdient einen Hinweis: `datum.getTime() + 86_400_000` sieht harmlos aus, ergibt aber an den Tagen der Zeitumstellung (23 bzw. 25 Stunden) einen falschen Tag. `new Date(y, m, d + n)` rechnet in Kalendertagen und lässt JavaScript Monats- und Jahreswechsel selbst erledigen.

`buildDays` bekommt statt `today` jetzt die ganzen `rules` und berechnet für jede Zelle zusätzlich `blocked` und `blockReason`:

```diff
-            selectable: !isPast,
+            selectable,
+            blocked: !selectable && !isPast,
+            blockReason: getNightBlockReason(date, rules),
```

Wichtig ist die Unterscheidung: **Vergangene** Tage sind nicht wählbar, werden aber nicht durchgestrichen – sie sind einfach vorbei. Durchgestrichen wird nur, was in der Zukunft liegt und trotzdem gesperrt ist.

### 3. In der View: einmal laden, dann aus dem Speicher

Datei: `src/views/BookingView/Booking.ts`

Die Verfügbarkeit hängt an der Belegung (Erwachsene/Kinder). Statt bei jedem Monatswechsel neu zu fragen, lädt die View **den ganzen Horizont einmal je Belegung** und merkt sich das Ergebnis (`V14`):

```ts
private async loadCalendar(): Promise<void> {
    const { adults, children } = bookingState.getGuests();
    const requestId = ++this.calendarRequestId;
    const isStale = (): boolean => requestId !== this.calendarRequestId || !this.isDisplayed();

    // Ohne Belegung keine Verfügbarkeit: Eine geratene Belegung sperrte Tage, die für
    // die echte frei sind (V16.7).
    if (adults === null) {
        this.nights = null;
        this.renderCalendar();
        return;
    }

    const key = `${adults.toString()}-${(children ?? 0).toString()}`;
    const cached = this.calendarCache.get(key);
    if (cached !== undefined) {
        this.nights = cached;
        this.renderCalendar();
        return;
    }

    await this.hotelLoaded;
    if (isStale()) return;
    // …
    try {
        const rows = await fetchAvailabilityCalendar({ from: toISODate(this.today), to: toISODate(addDays(this.today, horizonDays)), adults, children: children ?? 0 });
        if (isStale()) return;
        this.nights = buildNightAvailability(rows);
        this.calendarCache.set(key, this.nights);
    } catch (error: unknown) {
        if (isStale()) return;
        // Der Kalender bleibt bedienbar, nur ohne Sperren – verbindlich prüft ohnehin
        // `create_booking` (E24: Komfort, keine Garantie).
        console.error('Verfügbarkeit für den Kalender konnte nicht geladen werden:', error);
        this.nights = null;
    }
    this.renderCalendar();
}
```

Drei Muster in einer Methode:

- **Cache mit Schlüssel** – `"2-1"` für zwei Erwachsene, ein Kind. Wechselt der Gast zurück zu einer schon geladenen Belegung, gibt es keinen Request.
- **Request-ID gegen veraltete Antworten** – dasselbe Muster wie `roomsRequestId` aus Commit 019. Wählt der Gast schnell hintereinander zwei Belegungen, wird die Antwort für die erste verworfen.
- **Warten auf eine andere Promise** – `this.hotelLoaded` ist die Promise von `loadHotel()`. Erst mit dem Hotel steht der Horizont fest:

```diff
-        void this.loadHotel();
+        this.hotelLoaded = this.loadHotel();
```

Und eine bewusste **Fehlerstrategie**: Scheitert das Laden, bleibt der Kalender bedienbar, nur ohne Sperren. Die Datenbank prüft beim Buchen ohnehin verbindlich – der Kalender ist Komfort, keine Garantie.

Nach einer Ablehnung beim Buchen wird der Cache geleert, sonst würde der Kalender weiter die alten, inzwischen falschen Nächte anbieten:

```diff
+            this.calendarCache.clear();
+            void this.loadCalendar();
             void this.loadRooms();
```

Beim Klick entscheidet jetzt die Regel, ob ein Tag Abreise oder neue Anreise wird:

```diff
-        if (checkIn === null || checkOut !== null || date <= checkIn) {
-            bookingState.setDates(date, null);
-        } else {
+        // Abreise nur, wenn alle Nächte dazwischen frei sind (E29); sonst beginnt mit diesem
+        // Tag ein neuer Zeitraum – geklickt werden kann er nur, wenn er als Anreise taugt.
+        if (checkIn !== null && checkOut === null && isSelectableAsCheckOut(date, checkIn, this.getCalendarRules())) {
             bookingState.setDates(checkIn, date);
+        } else {
+            bookingState.setDates(date, null);
         }
```

Die alte private Methode `canGoPrev()` verschwindet aus der View; `changeMonth` nutzt die reinen Funktionen `canGoPrev`/`canGoNext` aus `domain/calendar.ts`.

### 4. Template: durchgestrichen, mit Tooltip – und `aria-disabled`

Datei: `src/views/BookingView/templates/calendar.template.ts`

```diff
+    const strike = cell.blocked ? ' line-through decoration-purple-haze/70' : '';
+
     return /*html*/ `
         <button
             type="button"
             data-date="${escapeHtml(cell.iso)}"
-            ${cell.selectable ? '' : 'disabled'}
+            ${cell.selectable ? '' : cell.blocked ? 'aria-disabled="true"' : 'disabled'}
+            ${cell.tooltip === null ? '' : `title="${escapeHtml(cell.tooltip)}"`}
```

Warum `aria-disabled` statt `disabled`? Manche Browser zeigen an deaktivierten Elementen **keinen Tooltip** (`title`). Der Tooltip ist hier aber der ganze Sinn: Der Gast soll erfahren, **warum** der Tag gesperrt ist. `aria-disabled="true"` teilt Screenreadern trotzdem mit, dass der Knopf nicht bedienbar ist. Der Preis dafür: Der Knopf ist technisch klickbar – also muss der Klick-Handler die Sperre selbst beachten:

```diff
-        if (dayEl && !dayEl.hasAttribute('disabled') && iso) {
+        // Gesperrte Tage tragen `aria-disabled` statt `disabled`, damit ihr Tooltip erscheint.
+        if (dayEl && !dayEl.hasAttribute('disabled') && dayEl.getAttribute('aria-disabled') !== 'true' && iso) {
```

Der „Nächster Monat"-Knopf bekommt das Gegenstück zu `prevDisabled`:

```diff
+                ${view.nextDisabled ? 'disabled' : ''}
+                class="text-purple-haze transition-opacity ${view.nextDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'}"
```

### 5. Tooltip-Texte in `messages.ts`

Die Texte stehen – wie alle anderen Datenbank-Codes seit Commit 022 – in einer `Record`-Tabelle. Fehlt ein Code, meldet der Compiler einen Fehler:

```ts
const NIGHT_BLOCKED_TEXTS: Record<UnavailableReason, string> = {
    nicht_buchbar: 'Anreise nicht möglich – für diese Nacht ist keine Buchung möglich.',
    vergangenheit: 'Dieser Tag liegt in der Vergangenheit.',
    ausserhalb_horizont: 'So weit im Voraus nehmen wir noch keine Buchungen an.',
    ausgebucht: 'Anreise nicht möglich – diese Nacht ist ausgebucht.',
    kein_preis: 'Anreise nicht möglich – für diese Nacht ist kein Preis hinterlegt.',
    zu_klein: 'Anreise nicht möglich – für die gewählte Belegung ist in dieser Nacht nichts frei.',
};

/** Der Tooltip eines gesperrten Tages, z. B. „24.10.2026: Anreise nicht möglich – …". */
export function formatBlockedNight(day: string, reason: UnavailableReason): string {
    return `${day}: ${NIGHT_BLOCKED_TEXTS[reason]}`;
}
```

### 6. Tests

`calendar.spec.ts` wächst um 110 Zeilen. Eine Hilfsfunktion baut Nächte aus einer Liste von Booleans, und das Beispiel aus `E29` wird direkt als Testfall formuliert:

```ts
/** Wie das Beispiel in E29: Nächte am 12., 13., 14. frei, die Nacht am 15. voll. */
const E29_RULES: CalendarRules = { today: new Date(2026, 5, 12), horizonDays: 30, nights: nightsFrom(new Date(2026, 5, 12), [true, true, true, false, true]) };

it('sperrt eine volle Nacht als Anreisetag …', () => {
    expect(isSelectableAsCheckIn(day(15), E29_RULES)).toBe(false);
});

it('… und lässt denselben Tag als Abreisetag zu – die Anschlussbuchung (Fertig-Kriterium Phase 9)', () => {
    expect(isSelectableAsCheckOut(day(15), day(12), E29_RULES)).toBe(true);
});
```

Die Grenzfälle des Horizonts sind ebenfalls abgedeckt („zeigt den Monat, in dem nur noch der Abreisetag liegt"). In `catalog.service.spec.ts` prüfen vier neue Tests die `p_*`-Parameter und die Umwandlung in die `Map`, in `messages.spec.ts` u. a., dass jeder Grund einen **eigenen** Text hat.

## Was wurde erreicht?

Der Kalender zeigt nur noch, was tatsächlich buchbar ist – und sagt, warum etwas nicht geht. Laut Review-Dokument wurde das Fertig-Kriterium von Phase 9 im Browser geprüft: Eine gesperrte Nacht sperrt ihr Datum als Anreise, lässt es als Abreise zu, und das Blättern endet am Horizont.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](034_2026-10-21_selection-bar-below-room-list.md)
