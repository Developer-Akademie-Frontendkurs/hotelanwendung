[← Vorheriger Commit](../012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen/001_2026-11-18_create-test-folder-per-view.md) · [↑ Branch-Übersicht](../013_2026-11-18_calendar-unavailable-days.md) · [📓 Index](../000_index.md)

# feat: nicht buchbare tage im calender nicht wählbar

- **Commit:** `6bd36f6`
- **Datum:** 2026-11-18
- **Autor:** Oliver Jung

## Worum geht es?

Der Kalender der Buchungsseite unterscheidet jetzt sichtbar zwischen Tagen, die **die Datenbank ablehnt** (ausgebucht, kein Preis, Gruppe zu groß …), und Tagen, die aus anderen Gründen nicht anklickbar sind. Außerdem bleibt er gesperrt, bis die Gästezahl gewählt und die Verfügbarkeit geladen ist.

```text
 src/views/BookingView/Booking.ts                   | 33 +++++++++++--
 src/views/BookingView/booking.css                  |  7 +++
 src/views/BookingView/domain/calendar.spec.ts      | 51 ++++++++++++++++----
 src/views/BookingView/domain/calendar.ts           | 13 +++++-
 .../BookingView/templates/calendar.template.ts     | 10 ++--
 supabase/seed.sql                                  | 54 ++++++++++++++++++++--
 6 files changed, 145 insertions(+), 23 deletions(-)
```

Der Commit berührt alle Schichten der Buchungsseite – und zeigt dabei schön, wofür die Aufteilung aus dem Branch `verbindung-ui-zu-datenbank` gut ist:

| Schicht   | Datei                            | Aufgabe in diesem Commit                                      |
| --------- | -------------------------------- | ------------------------------------------------------------- |
| Fachlogik | `domain/calendar.ts`             | entscheidet je Tag: wählbar? gesperrt? **nicht buchbar?**     |
| Tests     | `domain/calendar.spec.ts`        | beschreibt diese Entscheidungen in Beispielen                 |
| View      | `Booking.ts`                     | kennt Ladezustand und Gästezahl, liefert `locked` und Hinweis |
| Template  | `templates/calendar.template.ts` | setzt aus fertigen Werten Klassen und Hinweis-Element         |
| Styling   | `booking.css`                    | zeichnet die Diagonale                                        |
| Datenbank | `supabase/seed.sql`              | liefert lokale Buchungen, damit es etwas zu sehen gibt        |

## Die Änderungen im Detail

### 1. Fachlogik: `unavailable` und `locked`

Datei: `src/views/BookingView/domain/calendar.ts`

Zwei Typen bekommen je ein neues Feld:

```diff
 export type DayCell = {
     …
     selectable: boolean;
     blocked: boolean;
+    unavailable: boolean;
     blockReason: UnavailableReason | null;
 };

 export type CalendarRules = {
     today: Date;
     horizonDays: number | null;
     nights: NightAvailability | null;
+    locked: boolean;
 };
```

`DayCell` ist das Ergebnis (eine Zelle im Kalendergitter), `CalendarRules` die Eingabe (was der Kalender über heute, Horizont und Nächte weiß). `locked` ist eine Eingabe, `unavailable` ein Ergebnis.

In `buildDays()`, der Funktion, die die 42 Zellen eines Monats berechnet, ändern sich drei Zeilen:

```diff
         const isPast = date < startOfToday;
-        const selectable = isSelectableAsCheckIn(date, rules) || (awaitingCheckOut && isSelectableAsCheckOut(date, checkIn, rules));
+        const selectable = !rules.locked && (isSelectableAsCheckIn(date, rules) || (awaitingCheckOut && isSelectableAsCheckOut(date, checkIn, rules)));
+        const blockReason = getNightBlockReason(date, rules);

         cells.push({
             …
             selectable,
             blocked: !selectable && !isPast,
-            blockReason: getNightBlockReason(date, rules),
+            unavailable: !selectable && !rules.locked && isUnavailableNight(blockReason),
+            blockReason,
         });
```

Und eine neue Hilfsfunktion:

```ts
/** Only nights the database refuses are struck through, not past or out-of-horizon days. */
function isUnavailableNight(reason: UnavailableReason | null): boolean {
    return reason !== null && reason !== 'vergangenheit' && reason !== 'ausserhalb_horizont';
}
```

Zum Verständnis lohnt ein Blick auf die Gründe, die `getNightBlockReason()` liefern kann. Sie stammen aus `UNAVAILABLE_REASONS` in `src/shared/types/booking.codes.ts`:

```ts
export const UNAVAILABLE_REASONS = ['nicht_buchbar', 'vergangenheit', 'ausserhalb_horizont', 'ausgebucht', 'kein_preis', 'zu_klein'] as const;
```

Zwei davon berechnet das Frontend selbst (`vergangenheit`, `ausserhalb_horizont`), die übrigen kommen aus der Datenbankfunktion `availability_calendar`. `isUnavailableNight()` filtert genau die beiden Frontend-Gründe heraus. Damit gilt für eine Zelle:

| Zustand                                    | `selectable` | `blocked` | `unavailable` | Darstellung              |
| ------------------------------------------ | ------------ | --------- | ------------- | ------------------------ |
| freie Nacht                                | ✔            | –         | –             | normal, anklickbar       |
| vergangener Tag                            | –            | –         | –             | blass, `disabled`        |
| hinter dem Buchungshorizont                | –            | ✔         | –             | blass, nicht anklickbar  |
| Datenbank lehnt die Nacht ab               | –            | ✔         | ✔             | blass **mit Diagonale**  |
| abgelehnte Nacht, aber gültige **Abreise** | ✔            | –         | –             | normal, anklickbar       |
| Kalender gesperrt (`locked`)               | –            | ✔         | –             | blass, nichts gestrichen |

Die vorletzte Zeile ist der feine Punkt: Ist die Nacht vom 15. auf den 16. ausgebucht, kann man am 15. trotzdem **abreisen** – man übernachtet ja nicht mehr. Deshalb hängt `unavailable` an `!selectable`: Was gerade wählbar ist, wird nie gestrichen.

Und warum `!rules.locked`? Solange der Kalender gesperrt ist, kennt er die Verfügbarkeit für die (noch unbekannte) Gruppe nicht. Streichungen aus einer alten Abfrage würden dann etwas Falsches behaupten.

### 2. Tests: die Regeln als Beispiele

Datei: `src/views/BookingView/domain/calendar.spec.ts`

Alle bestehenden `CalendarRules`-Objekte bekommen `locked: false` – sonst meldet TypeScript ein fehlendes Pflichtfeld. Die Testfälle selbst werden präziser. Das Beispiel zur Entscheidung E29 legt fest: Nächte am 12., 13., 14. frei, am 15. voll.

```diff
     it('streicht die volle Nacht als Anreisetag durch und nennt den Grund', () => {
-        expect(findCell(buildDays(month), day(15))).toMatchObject({ selectable: false, blocked: true, blockReason: 'nicht_buchbar' });
+        expect(findCell(buildDays(month), day(15))).toMatchObject({ selectable: false, blocked: true, unavailable: true, blockReason: 'nicht_buchbar' });
     });

-    it('macht denselben Tag wählbar, sobald eine Anreise davor steht', () => {
-        expect(findCell(buildDays({ ...month, checkIn: day(12) }), day(15))).toMatchObject({ selectable: true, blocked: false });
+    it('macht denselben Tag als Abreise wählbar und streicht ihn nicht durch, sobald eine Anreise davor steht', () => {
+        expect(findCell(buildDays({ ...month, checkIn: day(12) }), day(15))).toMatchObject({ selectable: true, blocked: false, unavailable: false });
     });
```

```diff
-    it('streicht Tage jenseits des Horizonts durch', () => {
+    it('sperrt Tage jenseits des Horizonts, ohne sie durchzustreichen', () => {
         const july: CalendarMonth = { ...month, month: 6 };
-        expect(findCell(buildDays(july), new Date(2026, 6, 20))).toMatchObject({ blocked: true, blockReason: 'ausserhalb_horizont' });
+        expect(findCell(buildDays(july), new Date(2026, 6, 20))).toMatchObject({ blocked: true, unavailable: false, blockReason: 'ausserhalb_horizont' });
```

Am Testnamen „streicht Tage jenseits des Horizonts durch" → „sperrt …, ohne sie durchzustreichen" sieht man: Die **Tests dokumentieren die Verhaltensänderung**. Wer später wissen will, warum Horizont-Tage nicht gestrichen sind, findet die Antwort hier.

Neu ist ein Fall mit zwei vollen Nächten hintereinander:

```ts
it('streicht nach der Anreise die volle Nacht hinter dem ersten gesperrten Tag wieder durch', () => {
    const rules: CalendarRules = { ...E29_RULES, nights: nightsFrom(day(12), [true, true, true, false, false, true]) };
    const cells = buildDays({ ...month, checkIn: day(12), rules });
    expect(findCell(cells, day(15))).toMatchObject({ selectable: true, unavailable: false });
    expect(findCell(cells, day(16))).toMatchObject({ selectable: false, unavailable: true });
});
```

Anreise am 12.: Der 15. ist als Abreise erlaubt (12.–14. frei). Der 16. nicht, denn dafür müsste man die volle Nacht vom 15. buchen – und als Anreise taugt er auch nicht, weil die Nacht vom 16. voll ist. Also: gestrichen.

Und ein neuer Block für den gesperrten Kalender:

```ts
describe('buildDays im gesperrten Kalender', () => {
    const month: CalendarMonth = { year: 2026, month: 5, checkIn: null, checkOut: null, rules: { ...E29_RULES, locked: true } };

    it('lässt keinen Tag wählen', () => {
        expect(buildDays(month).some((cell: DayCell): boolean => cell.selectable)).toBe(false);
    });

    it('streicht keinen Tag durch, auch keine volle Nacht', () => {
        expect(buildDays(month).some((cell: DayCell): boolean => cell.unavailable)).toBe(false);
    });

    it('sperrt kommende Tage, Vergangenes bleibt einfach vorbei', () => {
        expect(findCell(buildDays(month), day(13))).toMatchObject({ blocked: true });
        expect(findCell(buildDays(month), day(11))).toMatchObject({ blocked: false, isPast: true });
    });

    it('lässt auch nach gewählter Anreise keine Abreise zu', () => {
        expect(findCell(buildDays({ ...month, checkIn: day(12) }), day(14)).selectable).toBe(false);
    });
});
```

`some()` prüft „gibt es **irgendeine** Zelle, für die …" – ein knapper Weg, eine Aussage über alle 42 Zellen auf einmal zu testen.

### 3. View: Ladezustand und Hinweistext

Datei: `src/views/BookingView/Booking.ts`

Ein neues Feld merkt sich, ob gerade geladen wird:

```diff
     private readonly calendarCache = new Map<string, NightAvailability>();
     private calendarRequestId = 0;
+    private calendarLoading = false;
```

In `loadCalendar()` wird es an jeder Ausstiegsstelle gesetzt. Die wichtigste Änderung steht vor dem Netzwerkaufruf:

```diff
         const cached = this.calendarCache.get(key);
         if (cached !== undefined) {
             this.nights = cached;
+            this.calendarLoading = false;
             this.renderCalendar();
             return;
         }

+        this.nights = null;
+        this.calendarLoading = true;
+        this.renderCalendar();
+
         await this.hotelLoaded;
         if (isStale()) return;
         const horizonDays = this.hotel?.booking_horizon_days;
-        if (horizonDays === undefined) return;
+        if (horizonDays === undefined) {
+            // Without the hotel there is no horizon to load – unlock, create_booking still checks on submit.
+            this.calendarLoading = false;
+            this.renderCalendar();
+            return;
+        }
```

Vorher zeigte der Kalender während des Ladens die Daten der **vorigen** Gästezahl weiter an. Wer von 2 auf 6 Erwachsene wechselte, sah kurz Nächte als frei, die für sechs Personen gar nicht frei sind. Jetzt wird `nights` geleert und der Kalender sofort im Ladezustand gezeichnet. Ein Treffer im Cache überspringt das, weil dann keine Wartezeit entsteht.

Auch der Fehlerfall ist bedacht: Konnte das Hotel nicht geladen werden, wird der Kalender **entsperrt** statt für immer auf „lädt …" zu stehen. Der Kommentar nennt den Grund: Die endgültige Prüfung macht ohnehin `create_booking` beim Absenden.

Aus Ladezustand und Gästezahl entstehen Hinweis und Sperre:

```ts
private getCalendarRules(): CalendarRules {
    return { today: this.today, horizonDays: this.hotel?.booking_horizon_days ?? null, nights: this.nights, locked: this.getCalendarNotice() !== null };
}

private getCalendarNotice(): string | null {
    if (bookingState.getGuests().adults === null) return 'Bitte zuerst die Anzahl der Erwachsenen wählen.';
    if (this.calendarLoading) return 'Verfügbarkeit wird geladen …';
    return null;
}
```

Der Trick: `locked` wird nicht separat gepflegt, sondern **abgeleitet** – gesperrt ist der Kalender genau dann, wenn es einen Hinweis gibt. So können Text und Sperre nie auseinanderlaufen.

Der Hinweis wird bei jedem Zeichnen gesetzt – per `textContent`, nicht per `innerHTML`:

```diff
     private renderCalendar(): void {
         if (!this.calendarEl) return;
         this.calendarEl.innerHTML = this.getCalendarHeaderHtml() + this.getCalendarGridHtml() + this.getCalendarFooterHtml();
+
+        const noticeEl = document.querySelector<HTMLElement>('[data-calendar-notice]');
+        if (noticeEl) noticeEl.textContent = this.getCalendarNotice() ?? '';
     }
```

Für den Screenreader bekommt jede gestrichene Zelle zusätzlich die Ansage „nicht buchbar":

```diff
         if (cell.isToday) parts.push('heute');
+        if (cell.unavailable) parts.push('nicht buchbar');
         return parts.join(', ');
```

Eine kleine Korrektur betrifft den Mauszeiger: Anreise, Abreise und die Tage dazwischen hatten fest `cursor-pointer`. Im gesperrten Kalender wären sie aber nicht klickbar. Jetzt richtet sich der Zeiger nach `selectable`:

```diff
     private getCellStateClass(cell: DayCell): string {
+        const cursor = cell.selectable ? 'cursor-pointer' : 'cursor-not-allowed';
         if (cell.isStart || cell.isEnd) {
-            return 'bg-purple-haze/65 text-white cursor-pointer';
+            return `bg-purple-haze/65 text-white ${cursor}`;
         }
         if (cell.inRange) {
-            return 'bg-purple-haze/35 text-purple-haze-dark cursor-pointer';
+            return `bg-purple-haze/35 text-purple-haze-dark ${cursor}`;
         }
```

### 4. Template: Hinweis-Element und Klasse statt Durchstreichen

Datei: `src/views/BookingView/templates/calendar.template.ts`

Über dem Kalender kommt ein Absatz für den Hinweis dazu:

```html
<p data-calendar-notice aria-live="polite" class="font-antic-didone text-16 leading-tight text-purple-haze-dark text-center empty:hidden mb-6 768:mb-8"></p>
```

- `aria-live="polite"` lässt Screenreader den Text vorlesen, sobald er sich ändert – ohne den Nutzer zu unterbrechen.
- `empty:hidden` ist Tailwinds Variante für die CSS-Pseudoklasse `:empty`: Ist der Absatz leer, wird er ausgeblendet und nimmt keinen Platz (samt `mb-6`) ein.

Bei den Tageszellen wird das bisherige Durchstreichen des Textes ersetzt:

```diff
-    const strike = cell.blocked ? ' line-through decoration-purple-haze/70' : '';
-
     return /*html*/ `
         <div class="relative">
             <button
                 …
-                class="w-full flex flex-col … ${cell.stateClass} ${cell.flagged ? 'ring-2 ring-red-600' : ''}"
+                class="w-full flex flex-col … ${cell.stateClass} ${cell.unavailable ? 'booking__day--unavailable' : ''} ${cell.flagged ? 'ring-2 ring-red-600' : ''}"
             >
-                <span class="… tracking-wide${strike}">${escapeHtml(cell.weekday)}</span>
-                <span class="font-antic-didone … leading-none${strike}">${escapeHtml(cell.day)}</span>
+                <span class="… tracking-wide">${escapeHtml(cell.weekday)}</span>
+                <span class="font-antic-didone … leading-none">${escapeHtml(cell.day)}</span>
```

Die Bedingung wechselt von `cell.blocked` zu `cell.unavailable` – das ist die eigentliche Verhaltensänderung. Das Template entscheidet nichts selbst, es übersetzt nur ein fertiges Feld in eine Klasse (so wie es `CLAUDE.md` für die Templates verlangt).

### 5. CSS: eine Diagonale aus einem Farbverlauf

Datei: `src/views/BookingView/booking.css`

```css
/* Diagonal from top left to bottom right; currentColor keeps it white on today's filled cell. */
.booking__day--unavailable {
    background-image: linear-gradient(to top right, transparent calc(50% - 1.25px), currentColor calc(50% - 0.5px), currentColor calc(50% + 0.5px), transparent calc(50% + 1.25px));
    background-origin: border-box;
    background-repeat: no-repeat;
}
```

Wie entsteht aus einem **Farbverlauf** eine **Linie**? Der Verlauf läuft von links unten nach rechts oben (`to top right`). Er ist fast überall `transparent` – nur in einem schmalen Band um die Mitte (50 %) hat er die Textfarbe. Die Farbstopps senkrecht zur Verlaufsrichtung bilden genau die Diagonale von links oben nach rechts unten. Die kleinen Übergänge (`1.25px` außen, `0.5px` innen) glätten die Kanten.

Zwei Details:

- **`currentColor`** übernimmt die Textfarbe der Zelle. Auf der violett gefüllten „Heute"-Zelle mit weißem Text wird auch der Strich weiß – ohne eigene Regel.
- **`background-origin: border-box`** lässt den Verlauf schon am Rand beginnen. Sonst endete die Diagonale am Innenabstand und träfe die Ecken nicht.

Dafür reicht keine Tailwind-Utility – genau der Fall, für den das Projekt ergänzende CSS-Dateien pro View vorsieht.

### 6. Seed: Buchungen, damit es etwas zu sehen gibt

Datei: `supabase/seed.sql`

```sql
-- 1. Alle 8 Zimmer in den Naechten +14 und +15: fuer jede Belegung "nicht buchbar".
-- 2. Alle 3 Suiten in der Nacht +21: bleibt frei, weil die Gruppe in die anderen
--    Kategorien passt - eine volle Kategorie sperrt keinen Tag. Erst ab 12
--    Erwachsenen (mehr, als die Oberflaeche anbietet) passt sie nicht mehr.
select public.create_booking(
    p_check_in => current_date + 14,
    p_check_out => current_date + 16,
    p_positions => '[
        {"room_type_id": "00000000-0000-4000-8000-000000000101", "rooms": 3},
        {"room_type_id": "00000000-0000-4000-8000-000000000102", "rooms": 3},
        {"room_type_id": "00000000-0000-4000-8000-000000000103", "rooms": 2}
    ]'::jsonb,
    p_adults => 8,
    p_email => 'reisegruppe@example.com',
    …
);
```

Drei Entscheidungen stecken darin:

- **`current_date + 14`** statt eines festen Datums: Ein Seed mit `'2026-12-01'` wäre nach diesem Tag wertlos. Relativ zum Tag des Resets liegen die Buchungen immer in der Zukunft.
- **`create_booking` statt `INSERT`**: Die Funktion legt Nächte, Preise und die Zimmerzuteilung genau so an wie bei einem echten Gast. Ein handgeschriebenes `INSERT` könnte davon abweichen – und der Seed würde einen Zustand erzeugen, den es in Wirklichkeit nie gibt.
- **Zwei Fälle statt einem**: Die zweite Buchung belegt nur die Suiten. Sie zeigt den **Gegenfall** – eine volle Kategorie macht einen Tag noch nicht „nicht buchbar", solange die Gruppe in andere Zimmer passt. Gute Testdaten decken nicht nur den Treffer, sondern auch den Fast-Treffer ab.

Der Kopfkommentar des Seeds wird entsprechend angepasst („NULL Buchungen" → „zwei Buchungen fuer den Kalender"). Die Entscheidung E34 bleibt dabei unberührt: Automatisierte Tests legen ihre Daten weiterhin selbst an und verlassen sich nicht auf den Seed.

## Prüfung

Auf dem Stand dieses Commits:

```bash
pnpm vitest run src/views   # 9 Testdateien, 132 Tests – alle grün
pnpm exec tsc --noEmit      # keine Ausgabe, Exit-Code 0
```

## Was wurde erreicht?

Der Kalender zeigt jetzt ehrlich, was er weiß: Nur Nächte, die die Datenbank für die gewählte Gruppe ablehnt, bekommen eine Diagonale und die Ansage „nicht buchbar". Vergangenes und Tage hinter dem Horizont sind nur blass. Ohne Gästezahl und während des Ladens ist der Kalender gesperrt und sagt in einem Satz, warum. Die Regeln dafür stecken in der reinen Fachlogik und sind durch Tests beschrieben, und dank der Seed-Buchungen lässt sich alles lokal nach jedem `pnpm db:reset` nachstellen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../013_2026-11-18_calendar-unavailable-days.md) · [Nächster Commit →](../014_2026-11-25_room-slider/001_2026-11-25_update-supabase-dependency.md)
