[← Vorheriger Commit](024_2026-10-07_project-diary-update.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): integrate formatting functions and refactor calendar logic for improved date handling

- **Commit:** `bda4028`
- **Datum:** 2026-10-14
- **Autor:** Oliver Jung

## Worum geht es?

Mit diesem Commit beginnt die Arbeit an **Gruppe D** des Reviews aus Commit 016: „Trennung von Design, Datenfluss und Logik". Das Ziel dieser Gruppe steht im Review-Dokument in einem Satz:

> Die View orchestriert nur noch. Templates sind reine Funktionen (Daten rein, String raus), die Fachlogik bleibt rein und getestet, Supabase wird nur noch in `services/` angesprochen.

`Booking.ts` ist zu diesem Zeitpunkt über 2000 Zeilen lang. Ganz unten in der Datei standen lose Hilfsfunktionen, die mit der View eigentlich nichts zu tun haben: Preise formatieren, Datumswerte umrechnen, den Kalender aufbauen. Dieser Commit erledigt die ersten beiden Punkte der Gruppe:

| Punkt  | Aufgabe                                                                                |
| ------ | -------------------------------------------------------------------------------------- |
| **D1** | Formatierer nach `src/shared/format.ts` verschieben, Tests schreiben                   |
| **D2** | Kalenderfunktionen nach `domain/calendar.ts` verschieben, `today` als Parameter, Tests |

```text
 ...-16_zimmer-anzahl-und-fruehstueck-integriert.md |   2 +-
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |   6 +-
 src/shared/format.spec.ts                          |  72 +++++++++++++
 src/shared/format.ts                               |  50 +++++++++
 src/views/BookingView/Booking.ts                   | 118 ++-------------------
 src/views/BookingView/domain/calendar.spec.ts      | 110 +++++++++++++++++++
 src/views/BookingView/domain/calendar.ts           |  88 +++++++++++++++
 7 files changed, 332 insertions(+), 114 deletions(-)
```

Die Bilanz ist typisch für ein gutes Refactoring: `Booking.ts` verliert rund 100 Zeilen, dafür entstehen zwei kleine Module **und** 182 Zeilen Tests. Das sichtbare Verhalten der Seite ändert sich nicht – mit einer kleinen, bewussten Ausnahme beim Tausendertrenner (siehe unten).

## Die Änderungen im Detail

### 1. `src/shared/format.ts` – Formatierer für die ganze Anwendung (D1)

Warum `shared/` und nicht `BookingView/`? Preise, Datumswerte und „2 Erwachsene" sind nicht buchungsspezifisch – eine spätere Admin-Übersicht braucht genau dieselben Texte. Was mehrere Seiten brauchen können, gehört nicht in den Ordner einer View.

Die Funktionen ziehen fast unverändert um. Neu ist eine Aufteilung von `formatStayDate`, die eine unschöne Aufrufform beseitigt:

```ts
/** „13.06.2026" – Tag und Monat immer zweistellig. */
export function formatDate(date: Date): string {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString()}`;
}

/** „13.06.2026 ab 14:00 Uhr" wie im Entwurf – ohne geladene Hotelzeile nur das Datum. */
export function formatStayDate(date: Date | null, preposition: string, time: string | null): string {
    if (date === null) return 'noch offen';

    const day = formatDate(date);
    // `time` kommt als "14:00:00" – die Sekunden interessieren niemanden.
    return time === null ? day : `${day} ${preposition} ${time.slice(0, 5)} Uhr`;
}
```

Vorher gab es nur `formatStayDate`. Wer ein reines Datum wollte, musste die Funktion mit Platzhalter-Argumenten aufrufen:

```diff
-        const night = rejection.date === null ? null : formatStayDate(parseISODate(rejection.date), '', null);
+        const night = rejection.date === null ? null : formatDate(parseISODate(rejection.date));
```

```diff
-        const stay = `${formatStayDate(parseISODate(booking.checkIn), '', null)} – ${formatStayDate(parseISODate(booking.checkOut), '', null)}`;
+        const stay = `${formatDate(parseISODate(booking.checkIn))} – ${formatDate(parseISODate(booking.checkOut))}`;
```

Ein Aufruf mit `'', null` ist ein Warnsignal: Die Funktion macht offenbar zwei Dinge, und der Aufrufer braucht nur eines davon. Die Lösung ist, das kleinere Ding als eigene Funktion herauszuziehen – `formatStayDate` nutzt `formatDate` jetzt selbst.

Dasselbe Muster bei den Gästen. Der Text „1 Erwachsener / 2 Erwachsene" stand vorher an **drei** Stellen: in `formatGuests` und in den beiden Funktionen, die die Auswahllisten bauen. Jetzt gibt es dafür je eine Funktion:

```ts
export function formatAdults(adults: number): string {
    return adults === 1 ? '1 Erwachsener' : `${adults.toString()} Erwachsene`;
}

export function formatChildren(children: number): string {
    return children === 1 ? '1 Kind' : `${children.toString()} Kinder`;
}

/** „2 Erwachsene, 1 Kind" – ohne Kinder nur die Erwachsenen. */
export function formatGuests(adults: number, children: number): string {
    const adultText = formatAdults(adults);
    return children === 0 ? adultText : `${adultText}, ${formatChildren(children)}`;
}
```

```diff
 function buildAdultOptions(): readonly GuestOption[] {
     return Array.from({ length: MAX_ADULTS }, (_unused: unknown, index: number): GuestOption => {
         const value = index + 1;
-        return { value, label: value === 1 ? '1 Erwachsener' : `${value.toString()} Erwachsene` };
+        return { value, label: formatAdults(value) };
     });
 }
```

### 2. Eine kleine Verhaltensänderung: `de-DE` statt `de-AT`

Beim Umzug von `formatPrice` hat sich **eine** Sache bewusst geändert – das Locale für `Intl.NumberFormat`:

```diff
-    const amount = new Intl.NumberFormat('de-AT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
+    const amount = new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
```

Der neue Kommentar erklärt, warum:

```ts
/**
 * Zahl vor dem Symbol wie im Design ("732€") – `style: 'currency'` würde das € voranstellen.
 *
 * Bewusst `de-DE` statt `de-AT`: Österreich trennt Tausender laut Unicode-Standard (CLDR)
 * mit einem geschützten Leerzeichen („1 464"), gewünscht ist der Punkt („1.464").
 * …
 */
```

Für ein Hotel in Kärnten wirkt `de-AT` auf den ersten Blick richtiger. Der Unterschied zeigt sich aber erst ab vierstelligen Beträgen – bei Preisen unter 1000 € sehen beide Locales gleich aus. Genau diesen Fall hält jetzt ein **Test** fest:

```ts
it('trennt Tausender mit Punkt', () => {
    expect(formatPrice(146400, 'EUR')).toBe('1.464€');
    expect(formatPrice(146450, 'EUR')).toBe('1.464,50€');
});
```

Das ist ein schönes Beispiel dafür, was Tests über das Absichern hinaus leisten: Wer einen Test schreibt, muss das **erwartete** Ergebnis ausdrücklich aufschreiben – und sieht dabei, wenn das tatsächliche davon abweicht. Ohne einen Testfall mit vierstelligem Betrag fällt so ein Leerzeichen leicht erst bei der ersten teuren Buchung auf.

### 3. `domain/calendar.ts` – der Kalender ohne Store und ohne „heute" (D2)

Die Kalenderlogik war eine Methode der View:

```ts
private buildDays(): DayCell[] {
    const year = this.displayedYear;
    const month = this.displayedMonth;
    const { checkIn, checkOut } = bookingState.getDates();
    // …
        const isPast = date < this.today;
```

Sie las drei Dinge aus ihrer Umgebung: den angezeigten Monat (`this`), die gewählten Daten (`bookingState`) und das heutige Datum (`this.today`). Das macht sie praktisch untestbar – ein Test müsste eine ganze View bauen und den Store befüllen, und das Ergebnis hinge vom Tag ab, an dem der Test läuft.

In `domain/calendar.ts` bekommt die Funktion **alles als Parameter**:

```ts
/** Was das Monatsraster braucht – `today` kommt von außen, damit es testbar bleibt. */
export type CalendarMonth = {
    year: number;
    /** 0 = Januar, wie bei `Date`. */
    month: number;
    checkIn: Date | null;
    checkOut: Date | null;
    today: Date;
};

/** 6 Wochen à 7 Tage: genug für jeden Monat, und das Raster springt beim Blättern nicht. */
const CALENDAR_CELLS = 42;

export function buildDays({ year, month, checkIn, checkOut, today }: CalendarMonth): DayCell[] {
    const startOfToday = stripTime(today);
    const firstOfMonth = new Date(year, month, 1);
    // `getDay()` zählt ab Sonntag (0) – so wird der Montag zur 0.
    const leading = (firstOfMonth.getDay() + 6) % 7;
    // …
}
```

Damit ist `buildDays` eine **reine Funktion**: Gleiche Eingabe, gleiche Ausgabe, keine Seiteneffekte. Die View übergibt ihren Zustand beim Aufruf:

```diff
     private getGridHtml(): string {
-        const cells = this.buildDays();
+        const { checkIn, checkOut } = bookingState.getDates();
+        const cells = buildDays({ year: this.displayedYear, month: this.displayedMonth, checkIn, checkOut, today: this.today });
```

Warum ein **Objekt** statt fünf einzelner Parameter? Bei `buildDays(2026, 5, null, null, today)` müsste man beim Lesen nachschlagen, welche Zahl Jahr und welche Monat ist – und ob `null, null` Anreise/Abreise oder etwas anderes bedeutet. Mit benannten Feldern ist der Aufruf selbsterklärend.

Nebenbei sind aus der Magic Number `totalCells = 42` eine benannte Konstante mit Begründung und aus `(… + 6) % 7` ein kommentierter Ausdruck geworden.

Auch die Datums-Hilfsfunktionen ziehen mit um – und bekommen Kommentare, die eine klassische JavaScript-Falle benennen:

```ts
/** „2026-06-13" in lokaler Zeit – `toISOString()` rechnet nach UTC um und läge nachts einen Tag daneben. */
export function toISODate(date: Date): string { … }

/** Gegenstück zu `toISODate` – `new Date('2026-06-13')` läse das Datum als UTC. */
export function parseISODate(iso: string): Date { … }
```

Und `countNights` erklärt jetzt, warum es rundet:

```ts
/**
 * Nächte zwischen An- und Abreise – `null`, solange der Zeitraum nicht vollständig ist.
 *
 * Gerundet, weil ein Tag bei der Zeitumstellung 23 oder 25 Stunden hat.
 */
export function countNights(checkIn: Date | null, checkOut: Date | null): number | null {
    if (checkIn === null || checkOut === null) return null;
    return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}
```

### 4. Die Tests

`calendar.spec.ts` prüft genau die Fälle, an denen Kalenderlogik typischerweise bricht:

```ts
// Juni 2026 beginnt an einem Montag, Oktober 2026 an einem Donnerstag.
const JUNE: CalendarMonth = { year: 2026, month: 5, checkIn: null, checkOut: null, today: new Date(2026, 5, 10) };

it('beginnt am Montag der ersten Woche', () => {
    expect(toISODate(buildDays(JUNE)[0]?.date ?? new Date(0))).toBe('2026-06-01');
    expect(toISODate(buildDays({ ...JUNE, month: 9 })[0]?.date ?? new Date(0))).toBe('2026-09-28');
});

it('ignoriert die Uhrzeit von today', () => {
    const cells = buildDays({ ...JUNE, today: new Date(2026, 5, 10, 18, 30) });
    expect(findCell(cells, new Date(2026, 5, 10))).toMatchObject({ isPast: false, isToday: true });
});

it('zählt über die Zeitumstellung volle Nächte', () => {
    expect(countNights(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2);
    expect(countNights(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
});
```

Drei Details lohnen den Blick:

- **Die Testmonate sind gezielt gewählt.** Juni 2026 beginnt an einem Montag (keine Tage aus dem Vormonat), Oktober 2026 an einem Donnerstag (drei Tage aus dem September). Beide Randfälle werden mit einem Monat abgedeckt. Der Kommentar oben sagt das, damit niemand später den Monat „aufräumt".
- **„heute" um 18:30 Uhr.** Vorher hat die View `this.today` schon ohne Uhrzeit gespeichert, `buildDays` hat sich darauf verlassen. Jetzt schneidet die Funktion die Uhrzeit selbst ab (`stripTime(today)`) – sonst wäre der heutige Tag (Mitternacht) kleiner als „jetzt" und damit `isPast`, sobald ein Aufrufer `new Date()` übergibt. Eine reine Funktion sollte nicht davon abhängen, dass der Aufrufer ihre Eingaben vorbereitet; der Test hält das fest.
- **Zeitumstellung.** Ende März und Ende Oktober 2026 hat ein Tag 23 bzw. 25 Stunden. Der Test hält fest, dass `Math.round` das auffängt.

### 5. Abhaken im Review-Dokument

Beide Punkte werden mit einer Notiz abgehakt, **wie** sie umgesetzt wurden – inklusive der Abweichungen vom Vorschlag:

```diff
-- [ ] D1: Die Formatierer (`Booking.ts:1980–2073`) nach `src/shared/format.ts` verschieben und Tests dafür schreiben.
+- [x] D1: … Umgesetzt mit `format.spec.ts`; zusätzlich `formatDate` (statt `formatStayDate(…, '', null)`) sowie `formatAdults`/`formatChildren`, die auch die Gäste-Auswahl nutzt. …
-- [ ] D2: Die Kalenderfunktionen (…) nach `domain/calendar.ts` verschieben. `buildDays` bekommt `today` als Parameter. Tests schreiben.
+- [x] D2: … `buildDays` bekommt ein Objekt (`year`, `month`, `checkIn`, `checkOut`, `today`) und liest nichts mehr aus dem Store.
```

Außerdem bekommt der Ordner-Plan im Review-Dokument eine Sprachkennung (` ```text `), und in der Tagebuch-Datei 006 werden eckige Klammern escapt (`\[Preisänderung\]`) – beides Markdown-Formatierungskorrekturen, vermutlich von einem Formatter oder Linter beim Speichern.

## Was wurde erreicht?

| Technik                                             | Wozu                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Hilfsfunktionen aus der View in eigene Module       | `Booking.ts` wird kürzer, die Funktionen werden wiederverwendbar    |
| `shared/` vs. `BookingView/domain/`                 | Allgemeines und Buchungsspezifisches getrennt                       |
| Abhängigkeiten als Parameter (`today`, `checkIn` …) | reine Funktion, testbar ohne View, Store und Systemuhr              |
| Parameter-Objekt statt Positionsparametern          | Aufrufe lesbar ohne Nachschlagen                                    |
| Kleinere Funktion herausziehen (`formatDate`)       | keine Aufrufe mit Platzhalter-Argumenten mehr                       |
| Tests mit gezielt gewählten Randfällen              | Monatsanfang, Uhrzeit, Zeitumstellung, Tausendertrenner abgesichert |

Offen in Gruppe D sind danach noch D3 (Validierung) bis D8 (Templates auslagern).

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](026_2026-10-14_checkout-error-handling-completed-steps.md)
