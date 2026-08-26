[← Vorheriger Commit](006_2026-08-05_add-booking-header-to-routing.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md) · [📓 Index](../000_index.md)

# feat: implement booking state management and enhance header with step tracking

- **Commit:** `050fe4e`
- **Datum:** 2026-08-08
- **Autor:** Oliver Jung

## Worum geht es?

Nach dem letzten Commit gab es ein Problem, das sich nicht mit ein paar Zeilen lösen lässt: Der **Kalender** kennt den gewählten Zeitraum, der **Header** soll ihn anzeigen – aber die beiden wissen nichts voneinander. Sie sind keine Geschwister im selben Baum, sondern liegen an ganz verschiedenen Stellen: Der Header gehört zum Layout und wird vom Router gebaut, der Kalender ist eine View und wird danach in `#content` gerendert.

Dieser Commit führt deshalb einen **geteilten Zustand** ein – ein eigenes kleines Modul, das den Buchungszeitraum hält und alle Interessenten benachrichtigt, wenn er sich ändert. Das ist der Punkt, an dem aus einzelnen Views eine **Anwendung** wird.

Konkret passiert Folgendes:

1. Ein neues Modul `bookingState` speichert Anreise- und Abreisedatum **außerhalb** der Views und bietet ein `subscribe`-Abo an (**Observer-Muster**).
2. Die `BookingView` gibt ihre eigenen Felder `checkIn`/`checkOut` auf und arbeitet nur noch über dieses Modul.
3. Der `MainHeader` abonniert den Zustand und zeichnet seine Schritt-Anzeige neu, sobald sich etwas ändert.
4. Die Schritte kennen jetzt **drei** Zustände (`pending`, `current`, `done`) statt nur „erledigt / nicht erledigt", inklusive Verbindungslinien.
5. Der Router bekommt einen **Aufräum-Schritt**: Beim Seitenwechsel wird der alte Header sauber abgemeldet (`destroy()`).

Betroffene Dateien:

- `src/shared/state/bookingState.ts` – **neu**: der geteilte Zustand
- `src/views/BookingView/Booking.ts` – nutzt den geteilten Zustand statt eigener Felder
- `src/views/LayoutViews/MainHeader.ts` – Abo, Neu-Rendern, `destroy()`, dreistufige Schritt-Optik
- `src/views/LayoutViews/header.types.ts` – neuer Typ `StepState`
- `src/router/router.ts` – Lebenszyklus des Headers (`afterRender` und `destroy`)

## 1. Das Problem: Zustand im falschen Besitz

Bis jetzt lagen die Daten in der View:

```ts
export class BookingView extends AbstractView {
    private checkIn: Date | null = null;
    private checkOut: Date | null = null;
}
```

Das ist völlig richtig, **solange nur die View selbst** diese Daten braucht. `private` heißt aber genau das: Niemand sonst kommt heran. Sobald ein zweiter Teil der Anwendung dieselbe Information benötigt, gibt es drei Auswege:

- Die Felder öffentlich machen und irgendwo eine Referenz auf die View herumreichen – schnell unübersichtlich.
- Die Daten über Custom-Events durch das DOM schicken – funktioniert, aber der Zustand hat dann kein Zuhause.
- Den Zustand **aus beiden Views herausziehen** und an eine dritte, neutrale Stelle legen – der Weg dieses Commits.

## 2. Das Zustandsmodul

```ts
export type BookingStep = 1 | 2 | 3;

export type BookingDates = {
    checkIn: Date | null;
    checkOut: Date | null;
};

type Listener = () => void;

let checkIn: Date | null = null;
let checkOut: Date | null = null;

const listeners = new Set<Listener>();
```

Auffällig: Hier gibt es **keine Klasse**. `checkIn` und `checkOut` sind schlicht Variablen auf **Modulebene**. Das genügt, weil ES-Module in JavaScript **einmalig** ausgewertet werden: Egal wie oft `bookingState` irgendwo importiert wird – die Variablen existieren nur ein einziges Mal. Man bekommt einen Singleton geschenkt, ohne ihn zu bauen.

Weil die Variablen nicht exportiert werden, kommt von außen auch niemand direkt an sie heran. Der Zugriff läuft ausschließlich über die exportierten Funktionen – eine **Kapselung durch Modulgrenzen** statt durch `private`.

### Lesen und Schreiben

```ts
function getDates(): BookingDates {
    return { checkIn, checkOut };
}

function setDates(nextCheckIn: Date | null, nextCheckOut: Date | null): void {
    checkIn = nextCheckIn;
    checkOut = nextCheckOut;
    notify();
}

function reset(): void {
    setDates(null, null);
}
```

Wichtig ist, dass **jede** Änderung durch `setDates()` läuft. Nur so ist sichergestellt, dass `notify()` auch wirklich aufgerufen wird. Würde man die Variablen direkt exportieren und von außen zuweisen, ginge die Benachrichtigung verloren – ein klassischer Grund für „die Anzeige aktualisiert sich manchmal nicht".

`getDates()` gibt bewusst ein **neues Objekt** zurück (`{ checkIn, checkOut }` ist Kurzschreibweise für `{ checkIn: checkIn, checkOut: checkOut }`). Wer daran herumschraubt, verändert nicht den echten Zustand.

### Das Abo: `subscribe`

```ts
function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    return (): void => {
        listeners.delete(listener);
    };
}

function notify(): void {
    listeners.forEach((listener: Listener): void => {
        listener();
    });
}
```

Das ist das **Observer-Muster** (auch Publish/Subscribe genannt) in seiner kleinstmöglichen Form:

- Interessenten melden eine Funktion an (`subscribe`).
- Bei jeder Änderung ruft `notify()` alle angemeldeten Funktionen auf.
- Das Zustandsmodul weiß dabei **nicht**, wer zuhört – es kennt weder Header noch View. Diese Richtung der Abhängigkeit ist der eigentliche Trick: Die Views hängen vom Zustand ab, der Zustand von niemandem.

Zwei Details lohnen genauere Betrachtung:

**Warum ein `Set` und kein Array?** Ein `Set` speichert jeden Eintrag nur einmal. Meldet sich derselbe Listener versehentlich zweimal an, wird er trotzdem nur einmal aufgerufen. Außerdem ist `delete()` direkt vorhanden, während man bei einem Array erst den Index suchen müsste.

**Warum gibt `subscribe` eine Funktion zurück?** Das ist die **Abmelde-Funktion**. Der Aufrufer muss sich seinen Listener nicht merken, um ihn später wieder loszuwerden – er hebt einfach den Rückgabewert auf und ruft ihn auf, wenn er fertig ist:

```ts
const unsubscribe = bookingState.subscribe(() => {
    /* … */
});
// später:
unsubscribe();
```

Dass die zurückgegebene Pfeilfunktion nach dem Ende von `subscribe` noch auf `listener` zugreifen kann, ist eine **Closure**: Eine Funktion behält Zugriff auf die Variablen der Umgebung, in der sie erzeugt wurde. Dieses „subscribe gibt unsubscribe zurück" ist ein weit verbreitetes Muster – man findet es unter anderem in Redux, Zustand und Svelte-Stores.

### Fachwissen an einer Stelle

```ts
function isStepComplete(step: BookingStep): boolean {
    if (step === 1) {
        return checkIn !== null && checkOut !== null;
    }

    // Step 2 (Zimmerauswahl) und Step 3 (persönliche Daten) haben noch keine View.
    // Sobald sie existieren, kommt ihre Abschluss-Bedingung hier dazu.
    return false;
}
```

Die Frage „ist Schritt 1 abgeschlossen?" wird **im Zustandsmodul** beantwortet, nicht im Header. Der Header soll darstellen, nicht entscheiden. Wenn später die Zimmerauswahl dazukommt, wird genau diese eine Funktion erweitert – die Header-Optik bleibt unangetastet.

### Der Export

```ts
export const bookingState = {
    getDates,
    setDates,
    reset,
    isStepComplete,
    subscribe,
};
```

Alles wird als **ein** Objekt exportiert. Das liest sich am Aufrufort selbsterklärend (`bookingState.getDates()` statt eines nackten `getDates()`) und macht auf einen Blick sichtbar, was die öffentliche Schnittstelle des Moduls ist.

## 3. Die `BookingView` gibt den Zustand ab

In der View verschwinden die beiden Felder:

```diff
     private displayedMonth: number;
-    private checkIn: Date | null = null;
-    private checkOut: Date | null = null;
     private calendarEl: HTMLElement | null = null;
```

Gelesen wird ab jetzt am Anfang der jeweiligen Methode:

```diff
     private buildDays(): DayCell[] {
         const year = this.displayedYear;
         const month = this.displayedMonth;
+        const { checkIn, checkOut } = bookingState.getDates();
```

```diff
-                isStart: this.checkIn !== null && isSameDay(date, this.checkIn),
-                isEnd: this.checkOut !== null && isSameDay(date, this.checkOut),
-                inRange: this.checkIn !== null && this.checkOut !== null && date > this.checkIn && date < this.checkOut,
+                isStart: checkIn !== null && isSameDay(date, checkIn),
+                isEnd: checkOut !== null && isSameDay(date, checkOut),
+                inRange: checkIn !== null && checkOut !== null && date > checkIn && date < checkOut,
```

`const { checkIn, checkOut } = bookingState.getDates();` ist eine **Destrukturierung**: Aus dem zurückgegebenen Objekt werden zwei lokale Konstanten gezogen. Das spart nicht nur Tipparbeit – es hilft auch TypeScript. Nach `if (checkIn !== null)` weiß der Compiler, dass `checkIn` ab hier ein `Date` ist. Bei einem Objektzugriff wie `state.checkIn` würde diese Verengung schnell wieder verloren gehen, weil sich der Objektinhalt zwischendurch theoretisch ändern könnte.

Geschrieben wird über `setDates`:

```diff
     private selectDate(iso: string): void {
         const date = parseISODate(iso);
-        if (this.checkIn === null || this.checkOut !== null || date <= this.checkIn) {
-            this.checkIn = date;
-            this.checkOut = null;
+        const { checkIn, checkOut } = bookingState.getDates();
+
+        if (checkIn === null || checkOut !== null || date <= checkIn) {
+            bookingState.setDates(date, null);
         } else {
-            this.checkOut = date;
+            bookingState.setDates(checkIn, date);
         }
         this.renderCalendar();
     }
```

Die **Logik** ist unverändert – nur der Ort der Daten hat sich geändert. Bemerkenswert: `this.renderCalendar()` bleibt trotzdem stehen. Die View könnte sich theoretisch auch selbst abonnieren, ruft ihr Neu-Zeichnen aber direkt auf, weil sie die Änderung ja selbst ausgelöst hat. Der `notify()`-Aufruf in `setDates` ist für die **anderen** Zuhörer da – hier also für den Header.

## 4. Der Header hört zu

### Anmelden in `afterRender`

```ts
async afterRender(): Promise<void> {
    if (this.config.variant !== 'booking') return;

    this.unsubscribe = bookingState.subscribe((): void => {
        this.renderSteps();
    });
}
```

Der `afterRender`-Haken aus `AbstractView` – im ersten Commit dieses Branches für den Kalender eingeführt – wird nun auch vom Header genutzt. Der frühe Ausstieg (`if … return`) sorgt dafür, dass sich nur der Buchungs-Header abonniert; ein Seiten-Header hat nichts zu aktualisieren.

Die Abmelde-Funktion wird in `this.unsubscribe` aufgehoben.

### Abmelden in `destroy`

```ts
/**
 * Räumt den Header ab, bevor der Router das Layout neu aufbaut.
 * Reihenfolge ist wichtig: erst abmelden, dann zurücksetzen – so erreicht die
 * Reset-Benachrichtigung diesen Header nicht mehr. Mehrfachaufrufe sind unschädlich.
 */
destroy(): void {
    if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
    }

    if (this.config.variant === 'booking') {
        bookingState.reset();
    }
}
```

Das ist die wichtigste Stelle des Commits, wenn es um **Fehlervermeidung** geht. Ohne Abmelden entstünde ein **Speicherleck** (memory leak): Bei jedem Wechsel auf `/buchung` käme ein neuer Listener ins `Set`, die alten blieben für immer drin. Sie würden weiterhin bei jeder Änderung aufgerufen – und mit ihnen würden die alten Header-Objekte im Speicher gehalten, obwohl deren HTML längst aus dem DOM entfernt ist. Solche Fehler äußern sich zunächst gar nicht und später als schleichend langsamer werdende Anwendung.

Die im Kommentar erwähnte **Reihenfolge** ist ebenfalls kein Zufall: `bookingState.reset()` ruft intern `setDates(null, null)` und damit `notify()` auf. Stünde das Zurücksetzen vor dem Abmelden, würde dieser Header noch einmal benachrichtigt und versuchte zu rendern – für ein DOM-Element, das gleich verschwindet.

Dass `destroy()` **mehrfach aufrufbar** ist, ohne Schaden anzurichten (`if (this.unsubscribe)` fängt den zweiten Aufruf ab), nennt man **idempotent**. Bei Aufräum-Funktionen ist das eine sehr sinnvolle Eigenschaft, weil man selten sicher weiß, ob sie nicht doch zweimal ausgelöst werden.

### Gezielt neu zeichnen

```ts
/** Ersetzt nur die Steps – dieselbe Funktion für Erst-Render und Neu-Render nach einer Zustandsänderung. */
private renderSteps(): void {
    const stepsEl: HTMLElement | null = document.getElementById('booking-steps');
    if (!stepsEl || this.config.variant !== 'booking') return;

    stepsEl.innerHTML = this.getBookingStepsHtml(this.config.activeStep);
}
```

Es wird nicht der ganze Header neu gebaut, sondern **nur** der Inhalt der `<ol id="booking-steps">`. Das ist schneller und – wichtiger – es zerstört nicht den Rest der Seite. Würde man das gesamte Layout neu schreiben, wären alle Event-Listener darin weg.

Der springende Punkt ist, dass `getBookingStepsHtml()` **sowohl** beim ersten Rendern (in `getBookingHeaderHtml`) **als auch** beim Aktualisieren benutzt wird. Es gibt also nur **eine** Stelle, die weiß, wie ein Schritt aussieht. Zwei getrennte Pfade („einmal so bauen, später so aktualisieren") sind eine der häufigsten Fehlerquellen in handgeschriebener UI.

## 5. Drei Zustände statt zwei

Vorher war ein Schritt entweder „erledigt" oder nicht. Jetzt gibt es einen eigenen Typ:

```ts
export type StepState = 'pending' | 'current' | 'done';
```

Und die Zuordnung von Zustand zu Optik erfolgt über **Nachschlagetabellen** statt über `if`-Ketten:

```ts
const STEP_CIRCLE_CLASSES: Record<StepState, string> = {
    pending: 'bg-transparent border-purple-haze/40',
    current: 'bg-transparent border-purple-haze ring-4 ring-purple-haze/45',
    done: 'bg-purple-haze border-purple-haze',
};

const STEP_LABEL_CLASSES: Record<StepState, string> = {
    pending: 'text-purple-haze/80',
    current: 'text-purple-haze',
    done: 'text-purple-haze-dark',
};
```

`Record<StepState, string>` ist ein sehr nützlicher TypeScript-Hilfstyp: Er verlangt für **jeden** Wert der Union einen Eintrag. Käme später ein vierter Zustand dazu (etwa `'error'`), würde der Compiler beide Tabellen als unvollständig melden – man kann es also nicht vergessen. Der Zugriff ist dann ein simples `STEP_CIRCLE_CLASSES[state]`.

Vergleicht man das mit `getCellStateClass()` im Kalender (Commit 003), sieht man beide Varianten nebeneinander: Dort war eine **Kaskade von `if`-Abfragen** richtig, weil sich mehrere Flags überlagern können und die Reihenfolge über den Vorrang entscheidet. Hier ist es eine **Tabelle**, weil ein Schritt immer genau einen von drei Zuständen hat. Faustregel: sich überlappende Bedingungen → `if`-Kaskade, sich ausschließende Fälle → Nachschlagetabelle.

Der Zustand selbst wird aus dem geteilten Zustand abgeleitet:

```ts
function getStepState(step: BookingStep, activeStep: BookingStep): StepState {
    if (bookingState.isStepComplete(step)) {
        return 'done';
    }

    return step === activeStep ? 'current' : 'pending';
}
```

Auch die Schritt-Definitionen sind nun Daten statt Markup:

```ts
const BOOKING_STEPS: readonly BookingStepDefinition[] = [
    { step: 1, label: 'Datum & Gäste' },
    { step: 2, label: 'Zimmerauswahl' },
    { step: 3, label: 'persönliche Daten' },
];
```

`readonly` verhindert, dass diese Liste versehentlich verändert wird (kein `push`, kein Überschreiben von Einträgen) – bei einer Konstante, die nur gelesen werden soll, ein billiger Schutz.

### Die Verbindungslinie

```ts
private getBookingStepHtml(label: string, state: StepState, previousState: StepState | undefined): string {
    // Die Verbinder-Linie zeigt den zurückgelegten Weg, hängt also am Vorgänger-Step.
    const lineColor: string = previousState === 'done' ? 'bg-purple-haze' : 'bg-purple-haze/45';
    const connector: string =
        previousState === undefined
            ? ''
            : /*html*/ `<span class="absolute top-3 -translate-y-1/2 right-[calc(50%+0.75rem)] w-[calc(100%-1.5rem)] h-0.5 transition-colors ${lineColor}"></span>`;
    const currentAttribute: string = state === 'current' ? ' aria-current="step"' : '';

    return /*html*/ `
        <li class="relative flex flex-1 flex-col items-center gap-y-2"${currentAttribute}>
            ${connector}
            <span class="w-6 h-6 rounded-full border-2 transition-colors ${STEP_CIRCLE_CLASSES[state]}"></span>
            <span class="font-lato text-16 transition-colors ${STEP_LABEL_CLASSES[state]}">${label}</span>
        </li>
    `;
}
```

Ein paar Beobachtungen:

- Die Linie gehört **zum jeweiligen Schritt**, verbindet ihn aber mit seinem Vorgänger. Deshalb bekommt die Methode `previousState` mitgeliefert, und der erste Schritt (`previousState === undefined`) bekommt gar keine Linie.
- `right-[calc(50%+0.75rem)]` und `w-[calc(100%-1.5rem)]` sind Tailwinds **beliebige Werte** in eckigen Klammern. Die Linie beginnt einen Kreisradius (`0.75rem` = halbe Kreisbreite von `w-6`) links des Kreismittelpunkts und ist genau so lang, dass sie am Kreis des Vorgängers endet – sie läuft also sauber **zwischen** den Kreisen statt darunter durch.
- `flex-1` an jedem `<li>` verteilt die drei Schritte gleichmäßig, sodass die Abstände unabhängig von der Beschriftungslänge gleich bleiben.
- `transition-colors` sorgt dafür, dass der Wechsel `pending → done` weich überblendet, statt zu springen. Das ist mehr als Kosmetik: Eine animierte Änderung wird vom Auge als Rückmeldung wahrgenommen („da ist gerade etwas passiert").
- `aria-current="step"` teilt Screenreadern mit, an welcher Stelle des Ablaufs man sich befindet – der passende ARIA-Wert für genau diesen Fall.

## 6. Der Router verwaltet den Lebenszyklus

Damit `afterRender()` und `destroy()` überhaupt aufgerufen werden, muss der Router sich den aktuellen Header merken:

```diff
 export class Router {
     private readonly routes: Route[];
     private readonly layoutWrapper: HTMLElement | null;
+    private currentHeader: MainHeader | null = null;
```

```diff
         } else {
-            const headerHtml: string = await new MainHeader(route.header ?? homeHeader).getHtml();
+            const header: MainHeader = new MainHeader(route.header ?? homeHeader);
+            const headerHtml: string = await header.getHtml();
             this.layoutWrapper.innerHTML = await new MainLayout(headerHtml).getHtml();
+            this.currentHeader = header;
+            await header.afterRender();
         }
```

Die Reihenfolge ist dieselbe wie bei den Views: **erst** HTML ins DOM schreiben, **dann** `afterRender()`. Vorher gäbe es das Element `#booking-steps` noch gar nicht.

Und das Aufräumen:

```diff
     private async getBaseLayout(locationPath: string, route: Route): Promise<void> {
         if (!this.layoutWrapper) {
             throw new Error('Fehler beim Laden der Seite');
-        } else if (locationPath.length > 1 && locationPath.endsWith('/')) {
+        }
+
+        // Vor jedem Layout-Neubau den alten Header abräumen (Abo lösen, Zustand zurücksetzen).
+        // Steht vor allen Zweigen, greift also auch für /admin und den Trailing-Slash-Fall.
+        this.currentHeader?.destroy();
+        this.currentHeader = null;
+
+        if (locationPath.length > 1 && locationPath.endsWith('/')) {
```

Hier wurde bewusst die `else if`-Kette aufgebrochen: Aus `} else if (…)` wird ein eigenständiges `if (…)`, damit das Aufräumen **dazwischen** passen kann. Es steht damit **vor allen** Verzweigungen und läuft deshalb auch dann, wenn als Nächstes das `AdminLayout` gerendert wird oder der Pfad wegen eines Schrägstrichs am Ende korrigiert werden muss.

`this.currentHeader?.destroy()` nutzt den **Optional-Chaining-Operator** `?.`: Ist `currentHeader` gleich `null` (also beim allerersten Seitenaufruf), passiert einfach nichts, statt dass ein Fehler geworfen wird. Ohne `?.` bräuchte es hier eine zusätzliche `if`-Abfrage.

## Der Ablauf im Zusammenspiel

Damit ergibt sich für einen Klick im Kalender folgende Kette:

1. Nutzer klickt auf einen Tag → `BookingView.selectDate()`
2. → `bookingState.setDates(…)` schreibt den neuen Zeitraum
3. → `notify()` ruft alle Listener auf
4. → der Listener des Headers ruft `renderSteps()`
5. → `isStepComplete(1)` ist jetzt `true` (beide Daten gesetzt) → Schritt 1 wird `done`
6. → Kreis und Beschriftung wechseln die Farbe, die Linie zum zweiten Schritt färbt sich ein
7. Parallel dazu zeichnet die View über `renderCalendar()` ihr Raster neu

Weder kennt der Kalender den Header, noch umgekehrt. Beide sprechen nur mit `bookingState`. Genau diese **lose Kopplung** macht es später einfach, einen dritten Zuhörer zu ergänzen – etwa eine Zusammenfassung der gewählten Nächte in der Seitenleiste.

## Was wurde erreicht?

Dieser Commit ist ein Wendepunkt im Projekt:

- Es gibt zum ersten Mal einen **geteilten Zustand** außerhalb der Views, mit klarer Schnittstelle und einem Zuhause unter `src/shared/state/`.
- Das **Observer-Muster** (`subscribe`/`notify`) verbindet Teile der Oberfläche, ohne sie voneinander abhängig zu machen.
- Der View-Lebenszyklus ist um das **Aufräumen** (`destroy`) vollständig geworden – vorher gab es nur `onInit` → `getHtml` → `afterRender`.
- Die Schritt-Anzeige unterscheidet nun sauber zwischen „noch offen", „gerade dran" und „erledigt" und reagiert **live** auf Eingaben.

Für Lernende steckt hier viel drin: Modul-Singletons, Closures, das Zurückgeben von Aufräum-Funktionen, `Record<>`-Tabellen, idempotentes Aufräumen und – vielleicht am wichtigsten – die Einsicht, dass die Frage „**wem gehören diese Daten?**" oft wichtiger ist als die Frage, wie man sie darstellt.

Offen bleibt weiterhin die Anbindung an Supabase sowie die Schritte 2 und 3 der Buchungsstrecke; `isStepComplete()` liefert für sie bewusst noch `false`.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md) · [Nächster Commit →](008_2026-08-08_update-project-diary-booking-page.md)
