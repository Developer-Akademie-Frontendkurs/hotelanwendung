[← Vorheriger Commit](038_2026-10-28_accessibility-form-errors-calendar-live-regions.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# Refactor BookingView templates: Remove unnecessary comments and clean up code

- **Commit:** `2097ae2`
- **Datum:** 2026-11-04
- **Autor:** Oliver Jung

## Worum geht es?

Ein Aufräum-Commit mit einer neuen Regel im Hintergrund. In `CLAUDE.md` kommt ein Abschnitt dazu, der festlegt, wie Kommentare künftig aussehen sollen:

```markdown
## Kommentare und Dokumentation

- halte dich in Kommentaren stets so kurz wie möglich
- Schreibe keine Kommentare oder Dokumentationen für Variablen (Einzelne Ausnahmen sind erlaubt)
- Schreibe Kommentare und Dokumentionen stets in Englisch
```

Der Rest des Commits wendet die ersten beiden Regeln rückwirkend an: **Rund 670 Zeilen Kommentare** verschwinden aus der Buchungsseite, den Templates, den Fachlogik-Dateien und dem Header. Dazu werden die beiden Posts-Views gelöscht.

```text
 CLAUDE.md                                          |   6 +
 src/index.html                                     |   7 -
 src/views/AbstractView.ts                          |   5 -
 src/views/BookingView/Booking.ts                   | 226 +--------------------
 src/views/BookingView/address.ts                   |  25 ---
 src/views/BookingView/booking.css                  |   7 -
 src/views/BookingView/breakfast.ts                 |  29 ---
 src/views/BookingView/domain/calendar.ts           |  49 -----
 src/views/BookingView/domain/draft.ts              |   5 -
 src/views/BookingView/domain/validation.ts         |  16 --
 src/views/BookingView/messages.ts                  |  26 ---
 src/views/BookingView/roomQuantity.ts              |  57 ------
 src/views/BookingView/services.ts                  |  33 ---
 src/views/BookingView/summary.ts                   |  32 ---
 .../BookingView/templates/calendar.template.ts     |  32 ---
 .../BookingView/templates/checkout.template.ts     |  59 ------
 src/views/BookingView/templates/icons.ts           |  10 -
 src/views/BookingView/templates/rooms.template.ts  |  52 -----
 src/views/LayoutViews/MainHeader.ts                |  16 --
 src/views/PostsView/Posts.ts                       |  48 -----
 src/views/PostsView/SinglePostView/SinglePost.ts   |  48 -----
 21 files changed, 17 insertions(+), 771 deletions(-)
```

Die Bilanz – 17 Zeilen hinzu, 771 weg – zeigt schon, dass hier fast nur gelöscht wird.

## Die Änderungen im Detail

### 1. Kommentare entfernt – was genau verschwindet

Fast alle Änderungen sind gelöschte Kommentarzeilen. Ein Beispiel aus `src/views/BookingView/roomQuantity.ts`:

```diff
-/**
- * Obergrenze eines Buchungsvorgangs.
- *
- * Dieselbe Zahl prüft später `create_booking` verbindlich — siehe
- * `docs/datenbank/umsetzungsplan.md`, Phase 7b/Commit 2, Punkt 3. Weicht eine der beiden
- * Stellen ab, lässt die Oberfläche eine Menge wählen, die die Datenbank ablehnt: der Gast
- * erfährt das dann erst beim Absenden.
- */
 export const MAX_ROOMS_PER_BOOKING = 8;

-/** Welche Grenze eine Eingabe gekappt hat — entscheidet über den Hinweistext. */
 export type QuantityLimit = 'none' | 'roomsFree' | 'total' | 'adults';
```

Aus `src/views/BookingView/templates/rooms.template.ts` verschwindet der Dateikopf, der das Template-Prinzip aus Commit 029 erklärte:

```diff
-/**
- * Markup für Schritt 2 „Zimmerauswahl“: Zimmerkarten, Mengenwähler und Zusatzleistungen.
- *
- * Daten rein, HTML raus – welche Menge, welches Maximum, welcher Hinweistext, rechnet
- * `Booking.ts` aus. Text-Parameter werden hier escapt, Parameter mit `Html` im Namen sind
- * fertiges Markup.
- */
-
 import { escapeHtml } from '../../../shared/ui/html';
```

Und aus `src/views/LayoutViews/MainHeader.ts` die Begründung, warum die Sprungmarken selbst scrollen:

```diff
-    /**
-     * Scrollt selbst, statt den Browser dem `#hash` folgen zu lassen: Ein Sprung zum Anker
-     * löst `popstate` aus, und darauf baut der Router die Seite neu auf – samt
-     * zurückgesetzter Buchung.
-     */
     private handleStepClick(event: MouseEvent): void {
```

Ebenso entfernt: der HTML-Kommentar über der Content-Security-Policy in `src/index.html`, die Erklärung von `destroy()` in `AbstractView.ts`, die CSS-Kommentare in `booking.css` und die Feldkommentare in der `BookingView` (z. B. warum `submitting` Doppelklicks abfängt).

#### Zum Nachdenken: Welche Kommentare sind „unnötig"?

Die neue Regel ist ein legitimer Stil – viele Teams bevorzugen knappen Code ohne erzählende Kommentare. Für Lernende lohnt trotzdem ein genauer Blick, **welche Art** von Kommentar hier verschwindet. Man kann grob zwei Sorten unterscheiden:

| Sorte                          | Beispiel                                                                  | Ohne Kommentar ablesbar?                 |
| ------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------- |
| **Was** der Code tut           | „Welche Grenze eine Eingabe gekappt hat"                                  | ja – der Typname `QuantityLimit` sagt es |
| **Warum** der Code so aussieht | „Ein Sprung zum Anker löst `popstate` aus … samt zurückgesetzter Buchung" | nein – das steht nirgends im Code        |

Die erste Sorte ist tatsächlich oft überflüssig, wenn die Namen gut sind (siehe Regel B3 aus Commit 020). Die zweite Sorte bewahrt Wissen, das man sonst nur durch einen Fehler wiederentdeckt: Wer `handleStepClick` „vereinfacht" und den Browser dem `#hash` folgen lässt, setzt ohne den Kommentar die Buchung zurück. Ein Teil dieses Wissens steht zum Glück auch in `CLAUDE.md`, im Umsetzungsplan und in diesem Tagebuch – im Code selbst ist es jetzt nicht mehr.

Ein weiterer Punkt: Die gelöschten Kommentare waren auf Deutsch, die neue Regel verlangt Englisch. Sie wurden aber nicht übersetzt, sondern entfernt; die verbleibenden Kommentare (etwa im `getDayCellHtml`-Template oder in `Booking.ts`) sind weiterhin deutsch.

### 2. Felder der `BookingView` neu gruppiert

Datei: `src/views/BookingView/Booking.ts`

Die einzige Änderung, die nicht nur löscht: Mit den Kommentaren verschwanden die „Abstandshalter" zwischen den Feldern, und die Felder wurden nach Thema sortiert – Kalender bei Kalender, Ergebnisse bei Ergebnissen, Leerzeilen als Trenner:

```ts
    private calendarEl: HTMLElement | null = null;
    private readonly calendarCache = new Map<string, NightAvailability>();
    private calendarRequestId = 0;

    private roomsEl: HTMLElement | null = null;
    private customerFormEl: HTMLFormElement | null = null;
    private summaryEl: HTMLElement | null = null;

    private breakfastService: BreakfastService | null = null;
    private roomsState: RoomsState = 'loading';
    private roomsError: string | null = null;
    private quantityNotice: string | null = null;
    private roomsRequestId = 0;
    private nights: NightAvailability | null = null;
    private rejection: { roomTypeId: string | null; night: Date | null; roomHint: string; calendarHint: string | null } | null = null;

    private hotel: HotelRow | null = null;
    private hotelError: string | null = null;
    private hotelLoaded: Promise<void> = Promise.resolve();

    private unsubscribeSummary: (() => void) | null = null;
    private destroyed = false;
    private submitting = false;
```

Das ist eine sinnvolle Idee: Ohne Kommentare übernimmt die **Anordnung** einen Teil der Erklärung. Felder, die zusammengehören, stehen zusammen.

Ein Detail im Diff: An der Stelle eines gelöschten Kommentars in `getGuestFieldHtml` blieb eine Leerzeile mitten im Objektliteral stehen:

```diff
             iconHtml: icon,
-            // Nur die Erwachsenenzahl ist Pflicht (Kinder: leer = keine Kinder), also hängt
-            // auch nur an diesem Feld eine Hinweiszeile.
+
             withNotice: field === 'adults',
```

### 3. Ein neuer Prüfvermerk

Über der Ausstattungstabelle steht jetzt statt der Erklärung eine Frage:

```diff
-/**
- * Ausstattung je Zimmerkategorie.
- *
- * Für diese vier Merkmale gibt es kein Datenbankfeld – die Werte stammen aus dem
- * Figma-Design. Kategorien ohne Eintrag (z. B. `einzelzimmer-alpin`) bekommen keine
- * Ausstattungsliste, statt erfundene Merkmale anzuzeigen.
- */
+// CHECK: Wird das noch verwendet?
 const ROOM_AMENITIES: Readonly<Record<string, readonly roomsTemplate.RoomAmenity[]>> = {
```

Die Antwort lässt sich mit einer Suche schnell finden: Ja – `ROOM_AMENITIES` wird an zwei Stellen gelesen, für die Zimmerkarte und für die Zeile in „Ihre Buchung":

```ts
amenities: ROOM_AMENITIES[room.slug] ?? [],
// …
amenities: (ROOM_AMENITIES[room.slug] ?? []).map((amenity: roomsTemplate.RoomAmenity): string => amenity.label).join(' · '),
```

Die entfernte Erklärung beantwortete übrigens die Frage, **warum** die Tabelle im Frontend steht statt in der Datenbank: Für diese Merkmale gibt es kein Schema, die Werte kommen aus dem Figma-Entwurf.

### 4. Posts-Views gelöscht

Die Kurs-Views `src/views/PostsView/Posts.ts` und `src/views/PostsView/SinglePostView/SinglePost.ts` werden laut Commit-Message entfernt, „as they are no longer needed". Sie stammen aus dem Routing-Spike (Branch `spa-struktur`) und lasen zuletzt über `posts.service.ts` (Commit 032).

```diff
-export class PostsView extends AbstractView {
-    posts: Post[] = [];
-
-    constructor() {
-        super();
-        this.setTitle('Posts View');
-    }
-    …
-}
```

**Achtung – hier ist etwas unvollständig geblieben.** Die Route-Tabelle in `src/main.ts` importiert beide Klassen weiterhin:

```ts
import { PostsView } from './views/PostsView/Posts';
import { SinglePostView } from './views/PostsView/SinglePostView/SinglePost';
// …
    {
        path: '/posts',
        kind: 'static',
        header: postsHeader,
        view: PostsView,
    },
    {
        path: '/posts/:id',
        kind: 'dynamic',
        view: SinglePostView,
    },
```

Ein Type-Check auf dem Stand dieses Commits (`tsc --noEmit`, der erste Schritt von `pnpm build`) meldet deshalb:

```text
src/main.ts(4,27): error TS2307: Cannot find module './views/PostsView/Posts' or its corresponding type declarations.
src/main.ts(5,32): error TS2307: Cannot find module './views/PostsView/SinglePostView/SinglePost' or its corresponding type declarations.
```

Damit ist dies der erste Commit des Branches, nach dem `pnpm build` nicht mehr grün ist – und auch der Vite-Dev-Server kann `main.ts` nicht mehr auflösen. Wer eine Datei löscht, muss alle Stellen mitnehmen, die sie importieren. Zum vollständigen Entfernen gehörten hier:

- die beiden Routen und Imports in `src/main.ts`,
- `postsHeader` in `MainHeader.ts`, falls nicht mehr gebraucht,
- ggf. `posts.service.ts`, die Tabelle `posts` (Migration `…_posts_spike.sql`, `E36`) und der Admin-Link `/admin/posts` – oder eine bewusste Entscheidung, sie zu behalten.

Der schnellste Schutz gegen so etwas ist, vor jedem Commit `pnpm build` (oder zumindest `tsc`) laufen zu lassen. Commit 038 hat diese Prüfung ausdrücklich im Review-Dokument vermerkt („Lint, 214 Tests und Build sind grün").

Auch die Dokumentation erwähnt die Posts-Views noch: `CLAUDE.md` nennt `SinglePostView` als Beispiel für dynamische Views und „Die Posts-Views lesen über `posts.service.ts`".

## Was wurde erreicht?

Der Code der Buchungsseite ist deutlich kürzer – rund 670 Kommentarzeilen weniger –, und `CLAUDE.md` hält eine neue Kommentar-Regel fest. Die Felder der `BookingView` sind thematisch gruppiert.

Offen nach diesem Commit:

- `src/main.ts` importiert die gelöschten Posts-Views – Type-Check und Build schlagen fehl,
- der Prüfvermerk `CHECK` über `ROOM_AMENITIES` (die Tabelle wird verwendet),
- Kommentare, die das **Warum** erklärten, sind jetzt nur noch in der Git-Historie, im Umsetzungsplan und in diesem Tagebuch zu finden.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
