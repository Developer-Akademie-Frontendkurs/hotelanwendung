[← Vorheriger Commit](004_2026-07-29_update-project-diary-booking-view.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md) · [📓 Index](../000_index.md)

# feat: enhance routing and layout by adding header configurations for different views

- **Commit:** `ba71962`
- **Datum:** 2026-08-05
- **Autor:** Oliver Jung

## Worum geht es?

Bisher steckte der komplette Header – Logo, Navigation, Sterne und die Überschrift „Luxus in den Alpen" – **fest verdrahtet** im `MainLayout`. Das war so lange in Ordnung, wie es nur die Startseite gab. Aber: Auf `/about` oder `/posts` stand dadurch ebenfalls „Luxus in den Alpen", und für die Buchungsseite braucht es einen ganz anderen Header (Fortschrittsanzeige statt Bühne).

Dieser Commit löst das Problem, indem der Header **aus dem Layout herausgelöst** und **konfigurierbar** gemacht wird:

1. Ein neuer Typ `HeaderConfig` beschreibt, **was** ein Header anzeigen soll – als **Union** aus zwei Varianten (`page` und `booking`).
2. Eine neue Klasse `MainHeader` erzeugt aus so einer Konfiguration das passende HTML.
3. Der `Route`-Typ bekommt ein optionales Feld `header`, sodass **jede Route ihren eigenen Header** mitbringen kann.
4. Der Router baut den Header und reicht ihn als HTML-String an das `MainLayout` weiter.
5. `MainLayout` enthält jetzt **keinen** Header-Markup mehr, sondern setzt nur noch ein, was es bekommt.

Betroffene Dateien:

- `src/views/LayoutViews/header.types.ts` – **neu**: die Typen der Header-Konfiguration
- `src/views/LayoutViews/MainHeader.ts` – **neu**: die Header-Klasse und drei fertige Konfigurationen
- `src/views/LayoutViews/MainLayout.ts` – Header entfernt, nimmt jetzt HTML entgegen
- `src/router/router.interface.ts` – `header?: HeaderConfig` an den Route-Typen
- `src/router/router.ts` – baut den Header und übergibt ihn ans Layout
- `src/main.ts` – hängt die Konfigurationen an die Routen

## 1. Die Konfiguration als „Discriminated Union"

Der Kern des Commits ist diese kleine Typdatei:

```ts
export type PageHeaderConfig = {
    variant: 'page';
    title: string;
    subtitle: string;
    backgroundImage: string;
    withStars: boolean;
    fullHeight: boolean;
};

export type BookingHeaderConfig = {
    variant: 'booking';
    activeStep: 1 | 2 | 3;
};

export type HeaderConfig = PageHeaderConfig | BookingHeaderConfig;
```

Das ist ein sehr typisches TypeScript-Muster mit einem eigenen Namen: eine **Discriminated Union** (auf Deutsch etwa „unterscheidbare Vereinigung"). Es besteht aus drei Zutaten:

1. **Mehrere Objekt-Typen**, die unterschiedliche Felder haben.
2. Ein gemeinsames Feld – hier `variant` –, dessen Wert ein **String-Literal** ist (`'page'` bzw. `'booking'`). Dieses Feld heißt **Diskriminante**.
3. Der Union-Typ `A | B`, der beides zusammenfasst.

Der Nutzen zeigt sich beim Auswerten. TypeScript kann aus einer Abfrage auf `variant` ableiten, **welche** Felder gerade existieren:

```ts
async getHtml(): Promise<string> {
    return this.config.variant === 'booking' ? this.getBookingHeaderHtml(this.config) : this.getPageHeaderHtml(this.config);
}
```

Im `true`-Zweig ist `this.config` für TypeScript automatisch ein `BookingHeaderConfig` – deshalb darf es an `getBookingHeaderHtml(config: BookingHeaderConfig)` übergeben werden. Im `false`-Zweig entsprechend ein `PageHeaderConfig`. Man nennt das **Type Narrowing**: Der Typ wird durch die Abfrage „verengt", ganz ohne Typ-Zusicherung (`as`).

Der Vorteil gegenüber einem einzigen Typ mit lauter optionalen Feldern (`title?`, `activeStep?` …): Es ist **unmöglich**, eine ungültige Kombination zu bauen. Ein Buchungs-Header mit `withStars` wird schon vom Compiler abgelehnt, ein Seiten-Header ohne `title` ebenfalls.

## 2. Die fertigen Konfigurationen

Direkt neben der Klasse liegen drei vorbereitete Konfigurationen als exportierte Konstanten:

```ts
export const homeHeader: HeaderConfig = {
    variant: 'page',
    title: 'Luxus in den Alpen',
    subtitle: 'wo sich Fuchs und Hase <br>gute Nacht sagen',
    backgroundImage: mainHeaderBg,
    withStars: true,
    fullHeight: true,
};

export const aboutHeader: HeaderConfig = {
    variant: 'page',
    title: 'Über uns',
    subtitle: 'Erfahren Sie mehr über den Karawanken Hof',
    backgroundImage: mainHeaderBg,
    withStars: false,
    fullHeight: true,
};

export const postsHeader: HeaderConfig = {
    /* Blog – analog zu aboutHeader */
};
```

Damit stehen die Texte **an einer Stelle** statt verstreut im Markup. Wer den Startseiten-Untertitel ändern will, muss nicht mehr durch eine 50-Zeilen-HTML-Zeichenkette scrollen.

## 3. `MainHeader` – eine View, die kein Router-Ziel ist

Die neue Klasse erbt wie alle Views von `AbstractView`, wird aber **nicht** vom Router als Seite aufgerufen. Sie ist ein **Baustein**, den das Layout benutzt:

```ts
export class MainHeader extends AbstractView {
    private readonly config: HeaderConfig;

    constructor(config: HeaderConfig) {
        super();
        this.config = config;
    }
    // …
}
```

Das ist der erste Schritt in Richtung einer **Komponentenschicht**: HTML wird nicht mehr nur pro Seite gebaut, sondern in wiederverwendbare Teile zerlegt. Innerhalb der Klasse ist das Markup zusätzlich in kleine private Methoden aufgeteilt:

- `getPageHeaderHtml()` – die große Bühne mit Titel, Untertitel und optionalen Sternen
- `getMobileNavigationHtml()` – das Burger-Menü
- `getDesktopNavigationHtml()` – die Navigationsleiste ab Breakpoint `768`
- `getBookingHeaderHtml()` / `getBookingStepHtml()` – der schlanke Buchungs-Header mit Schritt-Anzeige

Die Konfiguration wird dabei direkt in Klassen und Markup übersetzt:

```ts
const heightClass: string = config.fullHeight ? 'min-h-screen' : 'min-h-125';
const starsHtml: string = config.withStars ? /*html*/ `<img src="${stars}" alt="Stars">` : '';
```

Ein wichtiges Detail betrifft das Hintergrundbild. Vorher stand es als Tailwind-Klasse im Markup:

```diff
-            <header class="mobile-menu bg-[url('./assets/img/main-header-bg.jpg')] bg-cover bg-center">
+            <header class="mobile-menu bg-cover bg-center" style="background-image: url('${config.backgroundImage}')">
```

Der Grund: Tailwind erzeugt seine Klassen beim **Build**, indem es den Quelltext nach Klassennamen durchsucht. Ein Wert, der erst zur **Laufzeit** aus der Konfiguration kommt, kann dort gar nicht auftauchen. Für dynamische Werte ist deshalb ein `style`-Attribut der richtige Weg – das Bild wird über den Vite-Import (`import mainHeaderBg from '…'`) eingebunden und bekommt so auch im Production-Build den korrekten Pfad.

Der Buchungs-Header ist in diesem Commit noch bewusst einfach gehalten: drei Schritte, die als „erledigt" gelten, sobald ihre Nummer kleiner oder gleich `activeStep` ist.

```ts
private getBookingStepHtml(label: string, step: number, activeStep: number): string {
    const isDone: boolean = step <= activeStep;
    const circleClass: string = isDone ? 'bg-purple-haze border-purple-haze' : 'bg-transparent border-purple-haze';
    // …
}
```

## 4. `MainLayout` nimmt den Header entgegen

Aus dem Layout verschwinden rund 40 Zeilen Header-Markup. Übrig bleibt ein Einschub:

```diff
 export class MainLayout extends AbstractView {
+    private readonly headerHtml: string;
+
+    constructor(headerHtml: string) {
+        super();
+        this.headerHtml = headerHtml;
+    }
+
     async getHtml(): Promise<string> {
         return /*html*/ `
-            <header class="mobile-menu bg-[url('./assets/img/main-header-bg.jpg')] bg-cover bg-center">
-                … 40 Zeilen Header …
-            </header>
+            ${this.headerHtml}

             <div id="content">
```

Das Layout weiß jetzt **nichts mehr** darüber, wie ein Header aussieht – es kennt nur noch seinen Platz. Genau das ist mit „Trennung von Verantwortlichkeiten" gemeint: Das Layout kümmert sich um die Seitenstruktur (Header-Bereich, `#content`, Footer), der Header um sich selbst.

Beachtenswert ist, dass hier **fertiges HTML** durchgereicht wird und nicht die Konfiguration. Das Layout müsste sonst wissen, dass es einen `MainHeader` bauen muss – und wäre wieder an ihn gekoppelt.

## 5. Der Header hängt an der Route

Damit jede Seite ihren Header bekommt, wird er im Router-Typ verankert:

```diff
 export type StaticRoute = {
     path: string;
     kind: 'static';
+    header?: HeaderConfig;
     view: new () => ViewInstance;
 };
```

Das Fragezeichen macht das Feld **optional** – bestehende Routen ohne Header brechen also nicht. In `main.ts` werden die Konfigurationen einfach angehängt:

```diff
     {
         path: '/',
         kind: 'static',
+        header: homeHeader,
         view: HomeView,
     },
```

Und der Router benutzt sie beim Aufbau des Layouts. Dafür muss er die getroffene Route bis zur Layout-Methode durchreichen:

```diff
-        await this.getBaseLayout(locationPath);
+        await this.getBaseLayout(locationPath, match.route);
```

```diff
-    private async getBaseLayout(locationPath: string): Promise<void> {
+    private async getBaseLayout(locationPath: string, route: Route): Promise<void> {
         // …
         } else {
-            this.layoutWrapper.innerHTML = await new MainLayout().getHtml();
+            const headerHtml: string = await new MainHeader(route.header ?? homeHeader).getHtml();
+            this.layoutWrapper.innerHTML = await new MainLayout(headerHtml).getHtml();
         }
```

Interessant ist `route.header ?? homeHeader`. Der **Nullish-Coalescing-Operator** `??` liefert den rechten Wert, wenn der linke `null` oder `undefined` ist. Eine Route ohne eigenen Header bekommt also den Startseiten-Header als Rückfallebene. Wichtig: `??` prüft – anders als `||` – **nur** auf `null`/`undefined`. Bei `||` würden auch `''`, `0` oder `false` den Fallback auslösen, was hier zwar egal wäre, sich aber generell als Gewohnheit lohnt.

Zu diesem Zeitpunkt hat die Route `/buchung` noch **keinen** eigenen Header – sie bekommt also vorerst den Startseiten-Header. Das ändert der nächste Commit.

## Was wurde erreicht?

Der Header ist von einem festen Bestandteil des Layouts zu einer **konfigurierbaren Komponente** geworden:

- Jede Seite kann eigenen Titel, Untertitel, Hintergrund, Höhe und Sterne festlegen – **ohne** Markup zu duplizieren.
- Ein grundsätzlich anderer Header-Typ (die Buchungsstrecke) ist über die Union sauber vorgesehen, statt mit `if`-Verzweigungen im Layout nachgerüstet zu werden.
- Router und Layout kennen nur noch die **Schnittstelle**, nicht die Umsetzung.

Für Lernende sind hier vor allem zwei Dinge mitzunehmen: das Muster der **Discriminated Union** für „mehrere Varianten desselben Bausteins" und die Erkenntnis, dass **Konfiguration** oft die bessere Antwort auf Variantenvielfalt ist als kopiertes Markup.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md) · [Nächster Commit →](006_2026-08-05_add-booking-header-to-routing.md)
