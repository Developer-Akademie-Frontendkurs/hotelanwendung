[← Vorheriger Commit](013_2026-09-26_project-diary.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): implement booking steps management and UI updates

- **Commit:** `4ff5149`
- **Datum:** 2026-09-26
- **Autor:** Oliver Jung

## Worum geht es?

Im Kopf der Buchungsseite stehen drei Schritte: **Datum & Gäste**, **Zimmerauswahl**, **persönliche Daten**. Sie sollen zeigen, wie weit der Gast ist. Zum Stand von Commit 012 taten sie das nicht mehr – und dieser Commit repariert das. Damit verschwindet auch das vorletzte TODO aus dem Arbeitsblock in `Booking.ts` („Buchungssteps verknüpfen").

```text
 src/shared/state/bookingState.ts      | 32 +++++++++++---
 src/views/BookingView/Booking.ts      | 36 +++++++++++++---
 src/views/LayoutViews/MainHeader.ts   | 80 ++++++++++++++++++++++++-----------
 src/views/LayoutViews/header.types.ts |  3 --
 4 files changed, 112 insertions(+), 39 deletions(-)
```

### Warum die Steps nicht mehr funktionierten

Die Steps stammen aus einer Zeit, in der die Buchung als **mehrseitiger Ablauf** gedacht war: eine Seite pro Schritt. Dafür reichte eine einfache Logik:

```ts
// bookingState.ts – vorher
function isStepComplete(step: BookingStep): boolean {
    if (step === 1) {
        return checkIn !== null && checkOut !== null;
    }

    // Step 2 (Zimmerauswahl) und Step 3 (persönliche Daten) haben noch keine View.
    // Sobald sie existieren, kommt ihre Abschluss-Bedingung hier dazu.
    return false;
}
```

```ts
// MainHeader.ts – vorher
export const bookingHeader: HeaderConfig = {
    variant: 'booking',
    activeStep: 1,
};
```

Im Laufe des Branches sind aber alle drei Schritte **auf einer Seite** gelandet: Kalender und Belegung oben, Zimmerkarten darunter, Formular und Zusammenfassung ganz unten. Die „eigenen Views" für Schritt 2 und 3, auf die der Kommentar wartete, wird es nie geben. Die Folgen:

- Schritt 1 galt schon als erledigt, sobald ein Zeitraum gewählt war – obwohl ohne Erwachsenenzahl gar nicht gesucht wird (Commit 005).
- Schritt 2 und 3 waren **immer** `false`.
- Der aktuelle Schritt war **fest** `1` – egal, wie weit der Gast schon war.

Ein schönes Beispiel dafür, wie eine Annahme („eine Seite pro Schritt") still veraltet: Kein Test schlug fehl, keine Fehlermeldung erschien. Die Anzeige war einfach nur falsch.

## Die Änderungen im Detail

### 1. `bookingState.ts` – erledigte Schritte speichern statt berechnen

Die zentrale Frage: **Wer weiß, ob ein Schritt erledigt ist?** Für Schritt 1 könnte der Zustand es noch selbst prüfen (Datum liegt ja in `bookingState`). Für Schritt 2 braucht man aber die Bettenzahl der Kategorien, für Schritt 3 die Formularwerte – beides kennt nur die `BookingView`. Deshalb dreht der Commit die Verantwortung um: Die View **meldet**, der Zustand **speichert**.

```ts
export const BOOKING_STEP_ORDER: readonly BookingStep[] = [1, 2, 3];

// Welche Schritte erledigt sind, meldet die BookingView: Die Bedingungen hängen an Daten,
// die nur sie kennt (Belegung, Bettenzahl der Kategorien, Formular).
let completedSteps: ReadonlySet<BookingStep> = new Set();
```

Ein `Set` passt hier besser als ein Array: Die Frage „ist Schritt X dabei?" beantwortet `has()` direkt, und doppelte Einträge sind von vornherein ausgeschlossen. `ReadonlySet` sorgt dafür, dass niemand das Set von außen verändert – ersetzt wird es nur als Ganzes.

`isStepComplete` schrumpft auf eine Zeile:

```diff
 function isStepComplete(step: BookingStep): boolean {
-    if (step === 1) {
-        return checkIn !== null && checkOut !== null;
-    }
-
-    // Step 2 (Zimmerauswahl) und Step 3 (persönliche Daten) haben noch keine View.
-    // Sobald sie existieren, kommt ihre Abschluss-Bedingung hier dazu.
-    return false;
+    return completedSteps.has(step);
 }
```

#### Die Bremse gegen die Endlosschleife

Die neue Setter-Funktion enthält eine Prüfung, die leicht zu übersehen ist, aber entscheidend:

```ts
/**
 * Nur bei einer echten Änderung benachrichtigen – die View ruft das auch aus einem
 * eigenen `subscribe` heraus auf, ohne diese Bremse gäbe es eine Endlosschleife.
 */
function setCompletedSteps(steps: readonly BookingStep[]): void {
    const next = new Set(steps);
    const unchanged = next.size === completedSteps.size && steps.every((step: BookingStep): boolean => completedSteps.has(step));
    if (unchanged) return;

    completedSteps = next;
    notify();
}
```

Warum wäre es sonst eine Endlosschleife? Der Ablauf ohne die Prüfung:

1. Irgendetwas ändert sich in `bookingState` → `notify()` ruft alle Listener auf.
2. Einer davon ist der Listener der `BookingView` → er ruft `updateBookingSteps()` auf.
3. Das ruft `setCompletedSteps(...)` → `notify()` → wieder Schritt 2 → …

Mit der Gleichheitsprüfung endet der Kreis beim zweiten Durchlauf: Die Schritte sind dieselben wie eben, also wird **nicht** erneut benachrichtigt. Das ist ein allgemeines Muster bei Beobachter-Mustern (Observer): **Nur echte Änderungen melden.** Frameworks wie Angular (Signals) oder React (`setState` mit gleichem Wert) machen diese Prüfung intern – bei einem selbstgeschriebenen Store muss man selbst daran denken.

#### Der aktuelle Schritt wird abgeleitet

Statt `activeStep: 1` fest in die Konfiguration zu schreiben, ergibt sich der aktuelle Schritt jetzt aus den erledigten:

```ts
/** Der fällige Schritt ist der erste, der noch nicht erledigt ist – `null`, wenn alles erledigt ist. */
function getCurrentStep(): BookingStep | null {
    return BOOKING_STEP_ORDER.find((step: BookingStep): boolean => !completedSteps.has(step)) ?? null;
}
```

Das ist das Prinzip **„abgeleiteter Zustand"**: Was sich aus vorhandenen Daten berechnen lässt, speichert man nicht zusätzlich – sonst können beide Werte auseinanderlaufen. `find()` liefert `undefined`, wenn nichts gefunden wird; `?? null` macht daraus ein explizites „alles erledigt".

Zum Schluss: `reset()` leert auch die Schritte, und beide neuen Funktionen werden exportiert.

```diff
 function reset(): void {
     roomQuantities = {};
     breakfast = false;
     services = {};
+    completedSteps = new Set();
     setDates(null, null);
 }
```

```diff
     isStepComplete,
+    setCompletedSteps,
+    getCurrentStep,
     subscribe,
```

### 2. `header.types.ts` – `activeStep` fällt weg

Weil der aktuelle Schritt jetzt aus dem Zustand kommt, hat die Header-Konfiguration nichts mehr dazu zu sagen:

```diff
-import type { BookingStep } from '../../shared/state/bookingState';
-
 export type StepState = 'pending' | 'current' | 'done';
 …
 export type BookingHeaderConfig = {
     variant: 'booking';
-    activeStep: BookingStep;
 };
```

Der Import fällt gleich mit weg – bei `noUnusedLocals` in der `tsconfig.json` würde TypeScript ihn sonst als Fehler melden.

### 3. `Booking.ts` – die View meldet ihren Stand

#### Dieselben Bedingungen wie beim Buchen

Die neue Methode ist bewusst kurz, weil sie nichts Neues erfindet:

```ts
/**
 * Meldet dem Header, welche Buchungsschritte erledigt sind – mit denselben Bedingungen,
 * die `getCheckoutError` vor dem Buchen prüft:
 * 1 = Zeitraum und Erwachsene, 2 = Zimmer mit genug Betten, 3 = Formular vollständig.
 */
private updateBookingSteps(): void {
    // Nach einem Seitenwechsel nichts mehr melden – der Zustand gehört dann nicht mehr dieser View.
    if (this.summaryEl?.isConnected !== true) return;

    const draft = this.getBookingDraft();
    const steps: BookingStep[] = [];
    if (draft.checkIn !== null && draft.checkOut !== null && draft.adults !== null) steps.push(1);
    if (draft.positions.length > 0 && this.getCapacityText() === '') steps.push(2);
    if (getInvalidFields(draft).length === 0) steps.push(3);

    bookingState.setCompletedSteps(steps);
}
```

Der wichtigste Punkt steht im Kommentar: **dieselben Bedingungen**, die `getCheckoutError` vor dem Absenden prüft. Die Methode verwendet deshalb vorhandene Bausteine wieder – `getBookingDraft()`, `getCapacityText()` (leer bedeutet: genug Betten für alle Gäste) und `getInvalidFields()` aus Commit 009. So kann der Header nie einen Schritt als erledigt zeigen, an dem der Buchen-Knopf dann doch scheitert.

Beachte außerdem: Die Schritte werden **unabhängig voneinander** geprüft. Wer das Formular zuerst ausfüllt, sieht Schritt 3 als erledigt, auch wenn Schritt 1 noch offen ist. Der „aktuelle" Schritt ist dann trotzdem 1 – weil `getCurrentStep()` den ersten offenen nimmt.

#### Der Guard `isConnected`

```ts
if (this.summaryEl?.isConnected !== true) return;
```

`isConnected` ist eine DOM-Eigenschaft, die angibt, ob ein Element noch im Dokument hängt. Nach einem Seitenwechsel ersetzt der Router den Inhalt, das alte `summaryEl` ist dann „abgehängt". Ohne diesen Guard könnte ein verspäteter Aufruf (etwa aus einem noch laufenden Listener) Schritte einer Seite melden, die gar nicht mehr angezeigt wird. Der Vergleich mit `!== true` fängt beide Fälle in einem ab: `summaryEl` ist `null` (dann ergibt `?.` `undefined`) oder das Element ist nicht mehr verbunden (`false`).

#### Wo `updateBookingSteps()` aufgerufen wird

Die Methode muss überall laufen, wo sich eine der drei Bedingungen ändern kann:

```diff
         this.unsubscribeSummary = bookingState.subscribe((): void => {
             this.renderSummary();
+            this.updateBookingSteps();
         });
         this.renderSummary();
+        this.updateBookingSteps();
```

```diff
         this.guests[field] = target.value === '' ? null : Number(target.value);
         this.renderGuestsNotice();
+        this.updateBookingSteps();
```

```diff
             (event.target as HTMLElement).removeAttribute('aria-invalid');
             this.renderCustomerSummary();
+            this.updateBookingSteps();
         });
         form.addEventListener('change', (event: Event): void => {
             …
             this.renderCustomerSummary();
+            this.updateBookingSteps();
         });
```

| Aufrufstelle              | deckt ab                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| `afterRender`             | Anfangszustand beim Betreten der Seite                             |
| `bookingState.subscribe`  | Datum, Zimmermengen, Frühstück, Zusatzleistungen                   |
| Gästeänderung             | Erwachsene/Kinder – liegen in der View, nicht in `bookingState`    |
| Formular `input`/`change` | Adressfelder und die Checkbox für die abweichende Rechnungsadresse |

Die Gästezahl ist der Grund, warum der `subscribe`-Aufruf allein nicht reicht: Sie liegt in `this.guests` und löst kein `notify()` aus.

Der `subscribe`-Aufruf ist übrigens genau die Stelle, an der ohne die Bremse in `setCompletedSteps` die Endlosschleife entstünde.

#### Sprungziele und `scroll-mt`

Die drei Bereiche bekommen `id`s, damit der Header zu ihnen springen kann:

```diff
-                <div class="w-full max-w-300 mx-auto bg-eggshell …">
+                <div id="booking-dates" class="${STEP_TARGET_CLASSES} w-full max-w-300 mx-auto bg-eggshell …">
 …
-                <div id="booking-rooms" class="w-full max-w-212 mx-auto mt-10 768:mt-16"></div>
+                <div id="booking-rooms" class="${STEP_TARGET_CLASSES} w-full max-w-212 mx-auto mt-10 768:mt-16"></div>
 …
-            <section class="bg-purple-haze-light px-3 py-10 768:py-16">
+            <section id="booking-details" class="${STEP_TARGET_CLASSES} bg-purple-haze-light px-3 py-10 768:py-16">
```

```ts
// Sprungziele der Steps im Sticky-Header: Abstand nach oben, damit der Header den
// Anfang des Bereichs nicht verdeckt (mobil ist er zweizeilig und höher).
const STEP_TARGET_CLASSES = 'scroll-mt-40 768:scroll-mt-28';
```

`scroll-mt-*` ist die Tailwind-Utility für die CSS-Eigenschaft `scroll-margin-top`. Sie sagt dem Browser: „Wenn du zu diesem Element scrollst, lass oben so viel Platz." In reinem CSS:

```css
#booking-dates {
    scroll-margin-top: 10rem; /* scroll-mt-40 */
}

@media (width >= 768px) {
    #booking-dates {
        scroll-margin-top: 7rem; /* 768:scroll-mt-28 */
    }
}
```

Ohne diesen Abstand würde der Bereich exakt an die Oberkante des Fensters scrollen – und dort liegt jetzt der Sticky-Header darüber. Mobil ist der Abstand größer, weil der Header dort zweizeilig ist (Logo über den Steps). Die Klassen stehen in **einer** Konstante, damit alle drei Ziele garantiert denselben Abstand haben.

### 4. `MainHeader.ts` – sticky Header mit anklickbaren Steps

#### Der Status kommt aus dem Zustand

```diff
-function getStepState(step: BookingStep, activeStep: BookingStep): StepState {
+function getStepState(step: BookingStep): StepState {
     if (bookingState.isStepComplete(step)) {
         return 'done';
     }

-    return step === activeStep ? 'current' : 'pending';
+    return step === bookingState.getCurrentStep() ? 'current' : 'pending';
 }
```

```diff
 export const bookingHeader: HeaderConfig = {
     variant: 'booking',
-    activeStep: 1,
 };
```

Der Parameter `activeStep` verschwindet dadurch aus der ganzen Aufrufkette (`getBookingHeaderHtml`, `renderSteps`, `getBookingStepsHtml`).

#### Sticky statt darunter hängend

Vorher hingen die Steps **absolut positioniert unter** dem Header (`absolute -bottom-11`) und waren unterhalb von 456 px ganz ausgeblendet (`hidden 456:block`). Beim Scrollen verschwanden sie mit dem Header nach oben – auf einer Seite, die inzwischen sehr lang ist, also genau dann, wenn man sie bräuchte.

```diff
-            <header class="relative w-full bg-cover bg-center mb-0 456:mb-10" style="…">
-                <div class="w-full bg-eggshell/65">
-                    <div class="w-full max-w-360 mx-auto flex flex-col 768:flex-row 768:items-center gap-y-6 768:gap-x-24 px-4 pt-4 pb-6">
-                        <a href="/" data-link><img src="${logo}" alt="Karawanken Hof Logo"></a>
-                    </div>
-                    <div class="hidden 456:block absolute -bottom-11 w-full">
-                        <ol id="booking-steps" class="w-full max-w-120 flex mx-auto">
-                            ${this.getBookingStepsHtml(config.activeStep)}
-                        </ol>
+            <header class="sticky top-0 z-40 w-full bg-cover bg-center shadow-md" style="…">
+                <div class="w-full bg-eggshell/85 backdrop-blur-sm">
+                    <div class="w-full max-w-360 mx-auto flex flex-col 768:flex-row items-center gap-y-3 768:gap-x-12 px-4 py-3">
+                        <a href="/" data-link class="shrink-0"><img src="${logo}" alt="Karawanken Hof Logo" class="h-12 768:h-16 w-auto"></a>
+                        <nav aria-label="Buchungsschritte" class="w-full 768:flex-1">
+                            <ol id="booking-steps" class="w-full max-w-120 flex mx-auto">
+                                ${this.getBookingStepsHtml()}
+                            </ol>
+                        </nav>
                     </div>
```

Die Klassen im Einzelnen:

| Klasse                 | Wirkung                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `sticky top-0`         | Header scrollt mit, bis er oben anstößt, und bleibt dann stehen            |
| `z-40`                 | liegt über dem Seiteninhalt                                                |
| `shadow-md`            | Schatten trennt ihn optisch vom darunter durchscrollenden Inhalt           |
| `bg-eggshell/85`       | deckender als vorher (`/65`), damit Text darunter nicht durchscheint       |
| `backdrop-blur-sm`     | verwischt, was hinter dem Header liegt – der Rest Transparenz stört nicht  |
| `h-12 768:h-16`        | Logo mobil kleiner, damit der zweizeilige Header nicht zu viel Platz nimmt |
| `<nav aria-label="…">` | Screenreader erkennen die Steps als eigene Navigation                      |

Der Kommentar über der Methode nennt den Grund, warum die Steps **in** den Header gezogen wurden: Wären sie weiterhin darunter gehängt, würden sie beim Scrollen ohne eigenen Hintergrund über dem Inhalt schweben.

#### Jeder Step ist ein Link

```diff
-                <span class="w-6 h-6 rounded-full border-2 transition-colors ${STEP_CIRCLE_CLASSES[state]}"></span>
-                <span class="font-lato text-16 transition-colors ${STEP_LABEL_CLASSES[state]}">${label}</span>
+                <a href="#${definition.targetId}" data-step-target="${definition.targetId}" class="group flex flex-col items-center gap-y-2 rounded-md focus-visible:outline-2 focus-visible:outline-purple-haze">
+                    <span class="w-6 h-6 rounded-full border-2 transition-colors ${STEP_CIRCLE_CLASSES[state]}"></span>
+                    <span class="font-lato text-14 456:text-16 text-center leading-tight transition-colors group-hover:underline ${STEP_LABEL_CLASSES[state]}">${definition.label}</span>
+                </a>
```

Dafür bekommt jede Step-Definition das Ziel mit:

```ts
const BOOKING_STEPS: readonly BookingStepDefinition[] = [
    { step: 1, label: 'Datum & Gäste', targetId: 'booking-dates' },
    { step: 2, label: 'Zimmerauswahl', targetId: 'booking-rooms' },
    { step: 3, label: 'persönliche Daten', targetId: 'booking-details' },
];
```

Warum ein echtes `<a href="#…">` und kein `<button>` oder `<span>` mit Klick-Handler? Ein Link ist per Tastatur erreichbar (Tab), wird von Screenreadern als Link angesagt und funktioniert als Anker sogar ohne JavaScript. `focus-visible:outline-*` zeigt einen Fokusrahmen nur bei Tastaturbedienung, nicht bei Mausklick. `group` / `group-hover:underline` unterstreicht das Label, wenn die Maus über dem **ganzen** Link (Kreis + Text) steht.

#### Warum der Klick trotzdem abgefangen wird

Hier steckt die interessanteste Stelle des Commits. Eigentlich könnte der Browser den Sprung zu `#booking-rooms` selbst erledigen. Das Problem ist der **selbstgeschriebene Router**:

1. Ein nativer Sprung zu einem `#hash` erzeugt einen neuen History-Eintrag und löst ein `popstate`-Ereignis aus.
2. Der Router lauscht auf `popstate` (für Vor/Zurück im Browser) und rendert daraufhin die Seite **neu**.
3. Beim Neu-Rendern wird der alte Header zerstört – und dessen `destroy()` setzt die Buchung zurück.

Ein Klick auf „Zimmerauswahl" würde also alle Eingaben löschen. Deshalb scrollt der Header selbst:

```ts
/**
 * Scrollt selbst, statt den Browser dem `#hash` folgen zu lassen: Ein Sprung zum Anker
 * löst `popstate` aus, und darauf baut der Router die Seite neu auf – samt
 * zurückgesetzter Buchung. Den Abstand zum Sticky-Header regelt `scroll-mt-*` am Ziel.
 */
private handleStepClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-step-target]');
    if (!link) return;

    event.preventDefault();
    const target = document.getElementById(link.dataset.stepTarget ?? '');
    if (!target) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}
```

Drei Techniken auf einmal:

- **`event.preventDefault()`** verhindert den nativen Sprung – und damit das `popstate`.
- **`scrollIntoView()`** scrollt zum Element und respektiert dabei `scroll-margin-top` (siehe oben). `block: 'start'` richtet den Bereichsanfang oben aus.
- **`prefers-reduced-motion`** ist eine Systemeinstellung für Menschen, denen Animationen Schwindel oder Übelkeit verursachen können. Ist sie aktiv, springt die Seite sofort (`'auto'`) statt weich zu scrollen (`'smooth'`).

#### Event-Delegation am `<ol>`

```ts
// Am `<ol>` statt an den Links: `renderSteps` ersetzt die Links, das `<ol>` bleibt.
document.getElementById('booking-steps')?.addEventListener('click', (event: MouseEvent): void => {
    this.handleStepClick(event);
});
```

`renderSteps()` setzt bei jeder Zustandsänderung `stepsEl.innerHTML` neu – die Links werden also ständig durch neue Elemente ersetzt. Ein Listener direkt an einem Link wäre nach dem ersten Neu-Rendern verloren. Die Lösung heißt **Event-Delegation**: Der Listener sitzt am stabilen Elternelement, Klicks „blubbern" (Event Bubbling) von den Links nach oben, und `closest('a[data-step-target]')` findet heraus, welcher Link gemeint war – auch wenn der Klick eigentlich auf den Kreis oder das Label ging.

## Wie wurde geprüft?

- `tsc` (Typprüfung), `eslint src` und alle 29 Vitest-Tests grün.
- Im Browser (per Playwright) auf 1440 px und 375 px Breite: Step-Status beim Ausfüllen und die Sprungziele – ob der Bereichsanfang jeweils unter dem Sticky-Header sichtbar bleibt.

**Bekannte Kleinigkeiten**, bewusst offen gelassen:

- Auf Desktop sitzen die Steps leicht rechts der Mitte, weil links das Logo Platz beansprucht (`768:flex-1` zentriert im **Restplatz**, nicht auf der ganzen Breite).
- Springt man zur Zimmerauswahl, während die Zimmerliste noch lädt, kann der Sprung zu früh enden – der Bereich wächst erst nach dem Scrollen auf seine volle Höhe.

## Was wurde erreicht?

Die Steps im Header zeigen wieder, was sie versprechen: welcher Schritt erledigt ist, welcher als Nächstes fällig ist – und zwar nach genau den Regeln, nach denen am Ende auch gebucht wird. Außerdem bleiben sie beim Scrollen sichtbar und führen per Klick zum jeweiligen Bereich.

| Technik                                       | Wozu                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| View meldet, Zustand speichert                | Bedingungen dort prüfen, wo die Daten liegen                    |
| Gleichheitsprüfung vor `notify()`             | keine Endlosschleife bei Aufruf aus einem Listener              |
| Abgeleiteter Zustand (`getCurrentStep`)       | aktueller Schritt kann nicht von den erledigten abweichen       |
| Wiederverwendung von `getInvalidFields` u. a. | Header und Buchen-Knopf urteilen gleich                         |
| `isConnected`-Guard                           | keine Meldungen von einer bereits verlassenen Seite             |
| `position: sticky` + `backdrop-blur`          | Fortschritt bleibt sichtbar, Inhalt scheint nicht störend durch |
| `scroll-margin-top` (`scroll-mt-*`)           | Sticky-Header verdeckt das Sprungziel nicht                     |
| `preventDefault` + `scrollIntoView`           | Sprung ohne `popstate`, also ohne Neu-Rendern durch den Router  |
| `prefers-reduced-motion`                      | Barrierefreiheit: keine Animation, wenn der Nutzer das abwählt  |
| Event-Delegation                              | Listener überlebt das Ersetzen der Links                        |

**Was offen bleibt:** Im TODO-Block von `Booking.ts` steht jetzt nur noch die Frage nach Migrationen. Die generierten Typen (`V8`) und die vollständige Service-Schicht für Lesezugriffe fehlen weiterhin. Der Branch ist zum Stand dieses Eintrags **noch nicht in `main` gemergt**.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
