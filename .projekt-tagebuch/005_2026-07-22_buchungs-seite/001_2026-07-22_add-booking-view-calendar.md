[← Vorheriger Commit](../004_2026-06-10_startseite-erstellen/015_2026-07-22_add-responsive-styles-activities-section.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md) · [📓 Index](../000_index.md)

# feat: add booking view and integrate calendar functionality

- **Commit:** `83fcc6e`
- **Datum:** 2026-07-22
- **Autor:** Oliver Jung

## Worum geht es?

Die Anwendung bekommt eine neue Seite unter der Route `/buchung`: eine **Buchungsseite mit interaktivem Kalender**. Gäste können darin einen **Anreise-** und einen **Abreisetag** auswählen; die Tage dazwischen werden als gewählter Zeitraum hervorgehoben. Der Kalender ist komplett selbst gebaut – **ohne Kalender-Bibliothek**, nur mit TypeScript, dem DOM und dem eingebauten `Date`-Objekt.

Damit ist es die erste wirklich **interaktive** View des Projekts. Bisher lieferten die Ansichten im Wesentlichen statisches HTML aus. Ein Kalender muss dagegen auf Klicks reagieren (Tag wählen, Monat wechseln) und sich danach neu zeichnen. Genau dafür wird der View-Lebenszyklus um einen zusätzlichen Schritt erweitert.

Betroffen sind fünf bestehende und zwei neue Dateien:

- `src/router/router.interface.ts`, `src/router/router.ts`, `src/views/AbstractView.ts` – Erweiterung des Lebenszyklus um `afterRender`
- `src/main.ts` – Registrierung der neuen Route `/buchung`
- `src/views/BookingView/Booking.ts` (neu) – die eigentliche Kalender-View
- `src/views/BookingView/booking.css` (neu) – ergänzende Stile für die Kalenderzellen

## 1. Der View-Lebenszyklus bekommt einen `afterRender`-Schritt

Das ist die wichtigste strukturelle Änderung. Bisher lief das Rendern einer View so ab: View erzeugen → `onInit()` (Daten laden) → `getHtml()` (HTML-String) → dieser String wird in den Container geschrieben. Ein Problem dabei: Event-Listener kann man erst sinnvoll setzen, **nachdem** das HTML tatsächlich im DOM steht – vorher existieren die Elemente ja noch gar nicht.

Die Lösung ist eine neue Methode `afterRender()`, die genau nach dem Einfügen ins DOM aufgerufen wird.

Zuerst wird sie im **Vertrag** (der `ViewInstance`-Typ, den jede View erfüllen muss) ergänzt:

```diff
 export type ViewInstance = {
     setTitle: (title: string) => void;
     onInit: () => Promise<void>;
     getHtml: () => Promise<string>;
+    afterRender: () => Promise<void>;
 };
```

Die gemeinsame Basisklasse `AbstractView` bekommt eine leere Standard-Implementierung. Dadurch müssen bestehende Views (Home, Posts, About …) **nicht** angefasst werden – sie „erben" einfach eine leere `afterRender`-Methode, die nichts tut:

```diff
     async getHtml(): Promise<string> {
         return ``;
     }
+
+    async afterRender(): Promise<void> {}
 }
```

Im **Router** wird der bisher auskommentierte Aufruf schließlich aktiviert. Er läuft direkt nachdem das HTML in den Container geschrieben wurde:

```diff
         const view: ViewInstance = match.route.kind === 'dynamic' ? new match.route.view(this.getParams(match)) : new match.route.view();
         await view.onInit();
         contentContainer.innerHTML = await view.getHtml();
-        // await view.afterRender();
+        await view.afterRender();
```

Für Lernende ist das ein gutes Beispiel für ein **Lifecycle-Hook-Muster**, wie es auch Frameworks wie Angular kennen (dort z.B. `ngAfterViewInit`): Das Framework/der Router ruft zu definierten Zeitpunkten Methoden der Komponente auf, und die Komponente hängt sich dort mit ihrer Logik ein.

## 2. Die neue Route `/buchung`

In `src/main.ts` wird die `BookingView` importiert und als statische Route registriert:

```diff
+import { BookingView } from './views/BookingView/Booking';
```

```diff
+    {
+        path: '/buchung',
+        kind: 'static',
+        view: BookingView,
+    },
```

Ab jetzt zeigt der Router beim Aufruf von `/buchung` die Buchungsseite an.

## 3. Die `BookingView` – der Kalender

Die neue Datei `src/views/BookingView/Booking.ts` enthält die komplette Logik. Schauen wir sie in verdaulichen Häppchen an.

### Typen und Konstanten

Zwei kleine Hilfstypen beschreiben die Daten. `DayCell` ist ein einzelnes Kästchen im Kalender mit allen Zustands-Flags, die für die Darstellung wichtig sind. `Booking` fasst das Endergebnis zusammen (An-/Abreise plus Nächte):

```ts
type DayCell = {
    date: Date;
    inCurrentMonth: boolean;
    isPast: boolean;
    isToday: boolean;
    isStart: boolean;
    isEnd: boolean;
    inRange: boolean;
    selectable: boolean;
};

type Booking = {
    checkIn: string;
    checkOut: string;
    nights: number;
};

const WEEKDAYS: readonly string[] = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const MONTHS: readonly string[] = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const MS_PER_DAY = 86_400_000;
```

Gut zu sehen: Ein Tag wird über seinen **Zustand** beschrieben (ist er in der Vergangenheit? ist er der Anreisetag? liegt er im gewählten Zeitraum?). Aus diesen Flags leitet sich später rein die Optik ab – ein sauberer Weg, Daten und Darstellung zu trennen.

### Der Zustand der View

Die Klasse merkt sich in Feldern, was der Nutzer gerade sieht und ausgewählt hat:

```ts
export class BookingView extends AbstractView {
    private readonly today: Date;
    private displayedYear: number;
    private displayedMonth: number;
    private checkIn: Date | null = null;
    private checkOut: Date | null = null;
    private calendarEl: HTMLElement | null = null;

    constructor() {
        super();
        this.setTitle('Buchung');
        this.today = stripTime(new Date());
        this.displayedYear = this.today.getFullYear();
        this.displayedMonth = this.today.getMonth();
    }
```

`today` wird über die Hilfsfunktion `stripTime` auf Mitternacht „normalisiert". Das ist wichtig, damit Datumsvergleiche (z.B. „liegt dieser Tag in der Vergangenheit?") nicht durch die Uhrzeit verfälscht werden.

### `getHtml` liefert nur die Hülle, `afterRender` füllt sie

`getHtml()` gibt bewusst nur einen leeren Container zurück. Der eigentliche Kalenderinhalt wird erst in `afterRender()` erzeugt – also dann, wenn das Element im DOM existiert:

```ts
async getHtml(): Promise<string> {
    return /*html*/ `
        <section class="px-3 py-10 768:py-16">
            <div class="w-full max-w-300 mx-auto bg-eggshell rounded-3xl shadow-pic p-4 456:p-6 768:p-10">
                <div id="booking-calendar"></div>
            </div>
        </section>
    `;
}

async afterRender(): Promise<void> {
    this.calendarEl = document.getElementById('booking-calendar');
    if (!this.calendarEl) return;
    this.calendarEl.addEventListener('click', (event: MouseEvent): void => {
        this.handleClick(event);
    });
    this.renderCalendar();
}
```

Zwei didaktisch wertvolle Punkte:

- **Hier wird der neue Lebenszyklus genutzt:** `afterRender` greift sich das Container-Element und registriert genau **einen** Klick-Listener darauf.
- Das ist **Event-Delegation**: Statt an jeden einzelnen Tag-Button einen eigenen Listener zu hängen, hört ein einziger Listener auf dem Eltern-Element. Das ist nicht nur effizienter, sondern auch robust gegenüber dem ständigen Neuaufbau des Inhalts (siehe unten `renderCalendar`).

### Neu zeichnen statt punktuell ändern

Der Kalender folgt einem einfachen, gut nachvollziehbaren Prinzip: Bei jeder Änderung wird der komplette Inhalt neu aufgebaut.

```ts
private renderCalendar(): void {
    if (!this.calendarEl) return;
    this.calendarEl.innerHTML = this.getHeaderHtml() + this.getGridHtml() + this.getFooterHtml();
}
```

Weil der Klick-Listener auf dem gleichbleibenden Container hängt (Event-Delegation), überlebt er dieses Überschreiben – man muss ihn also nicht bei jedem Neuzeichnen erneut setzen.

### Das Tage-Raster berechnen

`buildDays()` ist das Herzstück. Es berechnet, welche Kästchen der Kalender zeigt – inklusive der „Auffüll-Tage" am Monatsanfang, damit der Erste am richtigen Wochentag beginnt:

```ts
private buildDays(): DayCell[] {
    const year = this.displayedYear;
    const month = this.displayedMonth;

    const firstOfMonth = new Date(year, month, 1);
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

    const cells: DayCell[] = [];
    for (let i = 0; i < totalCells; i++) {
        const date = new Date(year, month, 1 - leading + i);
        const inCurrentMonth = date.getMonth() === month;
        const isPast = date < this.today;

        cells.push({
            date,
            inCurrentMonth,
            isPast,
            isToday: isSameDay(date, this.today),
            isStart: this.checkIn !== null && isSameDay(date, this.checkIn),
            isEnd: this.checkOut !== null && isSameDay(date, this.checkOut),
            inRange: this.checkIn !== null && this.checkOut !== null && date > this.checkIn && date < this.checkOut,
            selectable: inCurrentMonth && !isPast,
        });
    }
    return cells;
}
```

Ein paar clevere Standard-Tricks mit `Date`, die man sich merken sollte:

- `(firstOfMonth.getDay() + 6) % 7` rechnet den Wochentag von „Sonntag = 0" auf „Montag = 0" um – passend zur deutschen Wochendarstellung (Mo–So).
- `new Date(year, month + 1, 0).getDate()` liefert die **Anzahl der Tage im Monat**: Der „0. Tag" des Folgemonats ist der letzte Tag des aktuellen Monats.
- `new Date(year, month, 1 - leading + i)` erzeugt fortlaufende Tage; negative bzw. über den Monat hinausgehende Werte rechnet `Date` automatisch korrekt um.

### Zeitraum-Auswahl: Klick-Logik

`handleClick` wertet aus, worauf geklickt wurde. Über `closest('[data-action]')` bzw. `closest('[data-date]')` findet es heraus, ob ein Steuer-Button (vor/zurück, zurücksetzen, absenden) oder ein Tag getroffen wurde:

```ts
private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (actionEl) {
        switch (actionEl.dataset.action) {
            case 'prev':  this.changeMonth(-1); return;
            case 'next':  this.changeMonth(1);  return;
            case 'clear': this.clearSelection(); return;
            case 'submit': this.submit(); return;
            default: return;
        }
    }

    const dayEl = target.closest<HTMLElement>('[data-date]');
    const iso = dayEl?.dataset.date;
    if (dayEl && !dayEl.hasAttribute('disabled') && iso) {
        this.selectDate(iso);
    }
}
```

Die eigentliche Auswahl-Regel steckt in `selectDate`. Sie sorgt dafür, dass zuerst die Anreise und dann die Abreise gesetzt wird – und dass ein früher liegender zweiter Klick die Auswahl sinnvoll „neu startet":

```ts
private selectDate(iso: string): void {
    const date = parseISODate(iso);
    if (this.checkIn === null || this.checkOut !== null || date <= this.checkIn) {
        this.checkIn = date;
        this.checkOut = null;
    } else {
        this.checkOut = date;
    }
    this.renderCalendar();
}
```

In Worten: Gibt es noch keine Anreise, ist bereits ein vollständiger Zeitraum gewählt, oder liegt der neue Klick vor/auf der Anreise, dann wird der Tag zur **neuen Anreise** (und die Abreise zurückgesetzt). Andernfalls ist es die **Abreise**.

### Monatsnavigation mit Sperre der Vergangenheit

`changeMonth` und `canGoPrev` verhindern, dass man in bereits vergangene Monate blättert:

```ts
private changeMonth(delta: number): void {
    const target = new Date(this.displayedYear, this.displayedMonth + delta, 1);
    const firstOfCurrentMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    if (target < firstOfCurrentMonth) return;

    this.displayedYear = target.getFullYear();
    this.displayedMonth = target.getMonth();
    this.renderCalendar();
}
```

Der „Zurück"-Button wird im Header entsprechend deaktiviert (`disabled` plus abgeschwächte Optik), wenn `canGoPrev()` `false` liefert.

### Optik aus Zustand ableiten

`getCellStateClass` übersetzt die Flags eines `DayCell` in Tailwind-Klassen – hier entscheidet sich, wie ein Tag aussieht (Anreise/Abreise kräftig, Zeitraum dazwischen hell, gesperrte Tage blass):

```ts
private getCellStateClass(cell: DayCell): string {
    if (cell.isStart || cell.isEnd) return 'bg-purple-haze text-white cursor-pointer';
    if (cell.inRange) return 'bg-purple-haze-light text-purple-haze-dark cursor-pointer';
    if (cell.isToday) return 'bg-purple-haze-dark text-eggshell cursor-pointer';
    if (!cell.selectable) return 'text-purple-haze-dark/30 cursor-not-allowed';
    return 'text-purple-haze-dark hover:bg-purple-haze-light cursor-pointer';
}
```

### Absenden – vorerst nur in die Konsole

`submit` berechnet aus den beiden Daten die Anzahl Nächte und legt ein `Booking`-Objekt an. Das Abschicken an ein Backend ist bewusst noch offen gelassen (`TODO`) – ein ehrlicher Zwischenstand:

```ts
private submit(): void {
    if (this.checkIn === null || this.checkOut === null) return;

    const nights = Math.round((this.checkOut.getTime() - this.checkIn.getTime()) / MS_PER_DAY);
    const booking: Booking = {
        checkIn: toISODate(this.checkIn),
        checkOut: toISODate(this.checkOut),
        nights,
    };

    // TODO: Buchungsdaten später an das Backend senden (fetch / Supabase).
    console.log('Buchungsdaten', booking);
}
```

### Kleine, reine Hilfsfunktionen

Am Ende der Datei stehen vier **reine Funktionen** (keine Seiteneffekte, gleicher Input → gleicher Output). Sie sind gut testbar und halten die Klasse selbst schlank:

```ts
function stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISODate(date: Date): string {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseISODate(iso: string): Date {
    const [year, month, day] = iso.split('-').map((part: string): number => Number(part));
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
```

Der Einsatz von **ISO-Datumsstrings** (`YYYY-MM-DD`) im `data-date`-Attribut ist ein bewährtes Muster: Das Datum lässt sich verlustfrei im HTML ablegen und beim Klick wieder zuverlässig einlesen.

## 4. Ergänzende Stile: `booking.css`

Für Feinheiten, die sich mit Tailwind-Utilities schlecht ausdrücken lassen, gibt es eine kleine begleitende CSS-Datei (die wie schon in Branch 004 direkt in der View importiert wird, damit Vite sie ins Bundle nimmt).

Zwei Dinge werden geregelt: eine über Breakpoints **einheitliche Mindesthöhe** der Tag-Buttons (damit die Zellen nicht springen, je nachdem ob „Anreise"/„Abreise" darin steht) und der Hover-Effekt des „×" zum Zurücksetzen:

```css
/* Kalender-Zellen: gleichmäßige Höhe unabhängig vom Zell-Zustand */
#booking-calendar button[data-date] {
    min-height: 3.75rem;
}

@media (min-width: 28.5rem) {
    #booking-calendar button[data-date] { min-height: 5rem; }
}

@media (min-width: 48rem) {
    #booking-calendar button[data-date] { min-height: 6.25rem; }
}

/* Das "×" zum Zurücksetzen der Anreise soll sich vom Zell-Hintergrund abheben */
.booking__clear {
    opacity: 0.75;
    transition: opacity 0.2s ease;
}

.booking__clear:hover {
    opacity: 1;
}
```

## Was wurde erreicht?

Die Anwendung hat jetzt eine funktionierende, interaktive **Buchungsseite** unter `/buchung`. Fachlich können Gäste einen Aufenthaltszeitraum wählen; technisch ist mehreres bemerkenswert:

- Der **View-Lebenszyklus** wurde sauber um `afterRender` erweitert – ein Hook, der genau dann greift, wenn die DOM-Elemente existieren. Dank leerer Standard-Implementierung in `AbstractView` bleiben alle bestehenden Views unverändert.
- Der Kalender kommt **ohne Bibliothek** aus und zeigt anschaulich, wie man mit `Date`, Zustandsfeldern und „neu zeichnen bei jeder Änderung" eine überschaubare, interaktive UI baut.
- **Event-Delegation** (ein Listener auf dem Container) macht das Ganze robust gegenüber dem ständigen Neuaufbau des Inhalts.

Offen bleibt bewusst die Anbindung an ein Backend – das im Code als `TODO` markierte Absenden der Buchungsdaten ist der natürliche nächste Schritt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md)
