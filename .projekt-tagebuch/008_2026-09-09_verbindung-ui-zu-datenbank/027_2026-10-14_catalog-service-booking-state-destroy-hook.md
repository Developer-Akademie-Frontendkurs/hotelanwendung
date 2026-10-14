[← Vorheriger Commit](026_2026-10-14_checkout-error-handling-completed-steps.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# Refactor booking view: Update validation logic, remove unused interfaces, and implement catalog service

- **Commit:** `d04fce0`
- **Datum:** 2026-10-14
- **Autor:** Oliver Jung

## Worum geht es?

Der größte Umbau seit Beginn des Reviews. Er erledigt vier Punkte der Gruppe D auf einmal – und die Commit-Message listet sie im Body auch einzeln auf:

| Punkt  | Aufgabe                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------- |
| **D4** | `catalog.service.ts`: alle Lesezugriffe der Buchungsseite raus aus der View (erfüllt `V9`/Phase 8.4)    |
| **D5** | Gäste und Kontaktdaten in den `bookingState`; erledigte Schritte leitet der Header selbst ab            |
| **D6** | Store-Aktionen bündeln (`selectRoomQuantity`, `setGuests`, `applySearchResult`) – je genau ein `notify` |
| **D7** | `destroy()`-Hook in `AbstractView` und Router statt Behelfslösungen über `isConnected`                  |

```text
 CLAUDE.md                                          |   5 +-
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |   8 +-
 src/router/router.interface.ts                     |   1 +
 src/router/router.ts                               |  41 ++-
 src/shared/services/catalog.service.spec.ts        | 136 +++++++++
 src/shared/services/catalog.service.ts             | 119 ++++++++
 src/shared/state/bookingState.spec.ts              | 138 +++++++++
 src/shared/state/bookingState.ts                   | 146 +++++++---
 src/shared/types/booking.types.ts                  |  17 ++
 .../types/catalog.types.ts}                        |  33 ++-
 src/views/AbstractView.ts                          |   7 +
 src/views/BookingView/Booking.ts                   | 307 ++++++++-------------
 src/views/BookingView/domain/draft.spec.ts         |  50 ++++
 src/views/BookingView/domain/draft.ts              |  23 ++
 src/views/BookingView/domain/validation.spec.ts    |  16 +-
 src/views/BookingView/domain/validation.ts         |  10 +-
 src/views/BookingView/hotel.interface.ts           |  11 -
 src/views/BookingView/roomQuantity.spec.ts         |   2 +-
 src/views/BookingView/roomQuantity.ts              |   2 +-
 src/views/BookingView/summary.spec.ts              |   2 +-
 src/views/BookingView/summary.ts                   |   2 +-
 src/views/LayoutViews/MainHeader.ts                |  32 +--
 22 files changed, 819 insertions(+), 289 deletions(-)
```

Außerdem repariert der Commit die drei Tailwind-Klassen, die in Commit 026 beschädigt worden waren.

## Die Änderungen im Detail

### 1. `catalog.service.ts` – Lesezugriffe aus der View (D4)

Bis hierher rief `Booking.ts` Supabase direkt auf – vier Abfragen, verteilt auf `loadHotel()` und `loadRooms()`, plus `supabase.storage` für die Bild-URLs. Phase 8.4 des Umsetzungsplans hatte dafür schon in Commit 001 ein prüfbares Kriterium festgelegt:

```bash
grep -rn "from.*services/supabase" src/ --include=*.ts | grep -v "src/shared/services/"
```

Für die Buchungsseite findet dieser Befehl nach diesem Commit nichts mehr – die Zeile verschwindet aus `Booking.ts`:

```diff
-import { supabase } from '../../shared/services/supabase';
 import { BookingFailedError, createBooking, type BookingRejection, type CreatedBooking } from '../../shared/services/booking.service';
+import { buildRoomCards, fetchHotel, fetchRoomTypes, fetchServices, searchAvailability } from '../../shared/services/catalog.service';
```

(Nur `Posts.ts` und `SinglePost.ts` greifen noch direkt zu – das ist als Punkt F2 im Review vorgemerkt.)

Der neue Service beginnt mit einem Kommentar, der eine wichtige Designentscheidung festhält:

```ts
/**
 * Lesezugriffe der Buchungsseite: Hotel, Zimmerkategorien, Leistungen, Verfügbarkeit
 * (V9, Phase 8.4).
 *
 * Anders als `createBooking` kennen diese Funktionen kein „erwartetes Nein": Jeder
 * Fehler der Abfrage wird geworfen, und die View entscheidet, was der Gast sieht.
 */
```

Zur Erinnerung: `createBooking` (Commit 017) unterscheidet zwischen einer fachlichen Ablehnung (`{ ok: false, error }` – „ausgebucht" ist ein normales Ergebnis) und einem technischen Fehler (geworfen). Beim Lesen gibt es diese Unterscheidung nicht – wenn `room_types` nicht lädt, ist das immer ein Fehler. Deshalb werfen alle Lesefunktionen:

```ts
/** Die Zimmerkategorien samt Bildern, nach Name sortiert. */
export async function fetchRoomTypes(): Promise<RoomTypeDetail[]> {
    const { data, error } = await supabase
        .from('room_types')
        .select('id, name, slug, description, max_occupancy, room_type_images(storage_path, alt_text, sort_order)')
        .order('name');
    if (error) throw new Error(error.message);
    return data;
}
```

Eine Ausnahme ist sauber modelliert: Kein Hotel in der Tabelle ist **kein** Abfragefehler, sondern ein leeres Ergebnis – `fetchHotel()` liefert dann `null`, und die View entscheidet, dass das trotzdem ein Problem der Stammdaten ist.

`searchAvailability` übersetzt camelCase in die `p_*`-Parameter der Datenbankfunktion – dasselbe Muster wie `createBooking`:

```ts
export async function searchAvailability(search: AvailabilitySearch): Promise<RoomAvailability[]> {
    // Ohne generierte Typen (V8) kennt der Client die Funktion nicht, `data` wäre `any`.
    const response: { data: unknown; error: { message: string } | null } = await supabase.rpc('search_availability', {
        p_check_in: search.checkIn,
        p_check_out: search.checkOut,
        p_adults: search.adults,
        p_children: search.children,
    });
    // …
}
```

Der Kommentar zeigt, warum die generierten Typen (`V8`) immer noch fehlen: Ohne sie ist das Ergebnis von `rpc()` `any`. Die Zeile deklariert es deshalb ausdrücklich als `unknown` – so erzwingt TypeScript an der Rückgabe eine bewusste Typzusicherung, statt `any` unbemerkt weiterzureichen.

In der View wird `loadRooms()` dadurch deutlich kürzer:

```diff
-            const [details, services, availability] = await Promise.all([
-                supabase.from('room_types').select('…').order('name'),
-                supabase.from('services').select('…').order('sort_order'),
+            const [roomTypes, serviceRows, availability] = await Promise.all([
+                fetchRoomTypes(),
+                fetchServices(),
                 checkIn === null || checkOut === null || adults === null
                     ? null
-                    : supabase.rpc('search_availability', { p_check_in: …, p_check_out: …, p_adults: adults, p_children: … }),
+                    : searchAvailability({ checkIn: toISODate(checkIn), checkOut: toISODate(checkOut), adults, children: children ?? 0 }),
             ]);

             if (this.isStale(requestId)) return;

-            if (details.error) throw new Error(details.error.message);
-            if (availability !== null && availability.error) throw new Error(availability.error.message);
-            if (services.error) throw new Error(services.error.message);
```

Die drei `if (… .error) throw` fallen weg – das erledigt jetzt jede Service-Funktion selbst. `Promise.all` lehnt ab, sobald eine Funktion wirft, und landet im vorhandenen `catch`.

Auch `buildRoomCards` und `pickImage` ziehen in den Service. Begründung im Review-Dokument: Das Mapping braucht `supabase.storage` für die Bild-URL, und Supabase soll nur noch in `services/` vorkommen.

### 2. Typen ziehen nach `shared/types/catalog.types.ts`

Der Service in `shared/` braucht `RoomCard`, `RoomTypeDetail`, `HotelRow` & Co. Die lagen bisher in `views/BookingView/room.interface.ts` und `hotel.interface.ts`. Hätte der Service von dort importiert, hinge `shared/` an `views/` – die Abhängigkeit liefe in die falsche Richtung. Git erkennt den Umzug als Umbenennung:

```text
 rename src/views/BookingView/room.interface.ts → src/shared/types/catalog.types.ts (75 % ähnlich)
 delete src/views/BookingView/hotel.interface.ts
```

`HotelRow` wird in `catalog.types.ts` angehängt. Nur `RoomAmenity` geht den umgekehrten Weg – zurück in `Booking.ts`, weil es kein Datenbanktyp ist, sondern nur die Icons im Design beschreibt:

```ts
/**
 * Ausstattungsmerkmal einer Zimmerkategorie.
 *
 * Bewusst kein Datenbankfeld: für die Icons im Design (Bett, Klimaanlage, Bad, Gym)
 * gibt es kein Schema. Die Zuordnung steht in `ROOM_AMENITIES`.
 */
interface RoomAmenity {
    icon: string;
    label: string;
}
```

Die Regel dahinter: Ein Typ wohnt dort, wo **alle** seine Nutzer hinkommen – und nicht weiter oben. `RoomAmenity` braucht nur die View, also bleibt er in der View.

### 3. Der Store wird zum vollständigen Entwurf (D5)

Bisher hielt die View einen Teil des Zustands selbst:

```diff
-    private readonly guests: Record<GuestField, number | null> = { adults: null, children: null };
-    private rooms: RoomCard[] = [];
-    // Leistungen je Vorgang aus `services`, ohne Frühstück, nach `sort_order` (E49).
-    private extraServices: ExtraService[] = [];
```

Das hatte eine unangenehme Folge: Der Header brauchte für die Schritt-Anzeige Daten, die nur die View kannte. Deshalb musste die View ihm die erledigten Schritte **melden** (`setCompletedSteps`, Commit 014) – inklusive einer Gleichheitsprüfung, damit Melden und Benachrichtigen keine Endlosschleife bilden.

Jetzt führt `bookingState` alles: Gäste, Kontaktdaten und die geladenen Kategorien samt Leistungen.

```ts
let guests: Guests = { adults: null, children: null };
let customerDetails: CustomerDetails = createEmptyCustomerDetails();
// Die zuletzt geladenen Kategorien samt Verfügbarkeit. Kein Teil des Entwurfs, aber ohne
// sie lässt sich nicht sagen, ob die gewählten Zimmer für alle Gäste reichen (E48) – und
// das braucht neben der View auch der Header.
let rooms: readonly RoomCard[] = [];
// Die buchbaren Leistungen je Vorgang – ohne sie lässt sich eine Auswahl nicht abgleichen.
let extraServices: readonly ExtraService[] = [];
```

Und er gibt den ganzen Entwurf auf einmal heraus:

```ts
/** Der ganze Entwurf auf einmal – für alles, was daraus etwas ableitet (Schritte, Anfrage). */
function getSnapshot(): BookingSnapshot {
    return { checkIn, checkOut, guests: getGuests(), roomQuantities: getRoomQuantities(), breakfast, services: getServices(), customerDetails };
}
```

Damit kann der Header die Schritte **selbst ableiten**, statt sie gemeldet zu bekommen:

```ts
/** Die erledigten Schritte, abgeleitet aus dem Entwurf – der Store merkt sich keine Schritte. */
function getCompletedBookingSteps(): BookingStep[] {
    return getCompletedSteps(buildBookingDraft(bookingState.getSnapshot()), bookingState.getRooms());
}
```

Aus dem Store fliegen dafür `completedSteps`, `isStepComplete`, `setCompletedSteps` und `getCurrentStep` heraus. `getCurrentStep` und `BOOKING_STEP_ORDER` ziehen als reine Funktion nach `domain/validation.ts`:

```ts
/** Der fällige Schritt ist der erste, der noch nicht erledigt ist – `null`, wenn alles erledigt ist. */
export function getCurrentStep(completedSteps: readonly BookingStep[]): BookingStep | null {
    return BOOKING_STEP_ORDER.find((step: BookingStep): boolean => !completedSteps.includes(step)) ?? null;
}
```

Das ist der wichtigste Gedanke dieses Commits: **Abgeleiteten Zustand nicht speichern, sondern berechnen.** „Schritt 2 ist erledigt" ist keine eigene Information, sondern eine Folge aus Zimmern und Gästen. Wer sie speichert, muss sie bei jeder Änderung nachführen – und bekommt Synchronisationsprobleme wie die Endlosschleifen-Sperre. Wer sie berechnet, kann sie gar nicht veralten lassen.

Die Umwandlung vom Snapshot in den Entwurf (die Form der `create_booking`-Parameter) zieht als reine Funktion nach `domain/draft.ts`, weil View **und** Header sie brauchen:

```ts
/** Der Zustand in der Form der `create_booking`-Parameter – was noch fehlt, bleibt `null`. */
export function buildBookingDraft(snapshot: BookingSnapshot): BookingDraft {
    const { checkIn, checkOut, guests } = snapshot;

    return {
        checkIn: checkIn === null ? null : toISODate(checkIn),
        checkOut: checkOut === null ? null : toISODate(checkOut),
        nights: countNights(checkIn, checkOut),
        adults: guests.adults,
        // Leeres Kinderfeld heißt „keine Kinder" – keine Vermutung, sondern die Abwesenheit von Kindern.
        children: guests.children ?? 0,
        positions: Object.entries(snapshot.roomQuantities).map(([roomTypeId, rooms]: [string, number]): BookingPosition => ({ roomTypeId, rooms })),
        withBreakfast: snapshot.breakfast,
        services: Object.entries(snapshot.services).map(([code, quantity]: [string, number]): BookingServiceSelection => ({ code, quantity })),
        ...snapshot.customerDetails,
    };
}
```

In der View wird `getBookingDraft()` zum Einzeiler:

```ts
private getBookingDraft(): BookingDraft {
    return buildBookingDraft(bookingState.getSnapshot());
}
```

Das Formular schreibt bei jeder Eingabe in den Store, die Zusammenfassung liest von dort:

```diff
             if (event.target instanceof Element) event.target.removeAttribute('aria-invalid');
-            this.renderCustomerSummary();
-            this.updateBookingSteps();
+            this.saveCustomerDetails();
```

```ts
/** Übernimmt das Formular in den Store – Zusammenfassung und Header folgen über `subscribe`. */
private saveCustomerDetails(): void {
    bookingState.setCustomerDetails(this.readCustomerDetails());
}
```

Der Datenfluss ist jetzt eine Einbahnstraße: **Eingabe → Store → `notify` → alle Abonnenten rendern.** Vorher musste jeder Event-Handler selbst wissen, wen er alles benachrichtigen muss (`renderCustomerSummary()`, `updateBookingSteps()`).

Ein kleines Typdetail: `GuestField` wird nicht mehr von Hand geschrieben, sondern aus dem neuen Typ abgeleitet:

```diff
-type GuestField = 'adults' | 'children';
+type GuestField = keyof Guests;
```

Kommt einmal ein Feld zu `Guests` hinzu, wächst `GuestField` automatisch mit.

### 4. Store-Aktionen mit genau einem `notify` (D6)

Bisher war das Setzen einer Zimmermenge ein Zweischritt in der View – und diesen Zweischritt gab es dreimal:

```ts
bookingState.setRoomQuantity(roomTypeId, clamped.value); // notify Nr. 1
// Weniger Zimmer können das Kinderbett-Maximum senken (1 je Zimmer, E49).
this.reconcileSelectedServices(); // notify Nr. 2
```

Zwei Probleme: Zwischen den beiden Aufrufen ist der Zustand kurz **inkonsistent** (zwei Zimmer weniger, aber noch zwei Kinderbetten), und alle Abonnenten rendern zweimal – einmal davon mit dem inkonsistenten Zustand.

Jetzt bündelt der Store das in **Aktionen**, die mehrere Änderungen machen und am Ende genau einmal benachrichtigen:

```ts
/**
 * Setzt die Menge einer Kategorie und gleicht die Leistungen ab – weniger Zimmer können
 * das Kinderbett-Maximum senken (1 je Zimmer, E49). Geklemmt hat der Aufrufer.
 */
function selectRoomQuantity(roomTypeId: string, quantity: number): void {
    writeRoomQuantities({ ...roomQuantities, [roomTypeId]: quantity });
    reconcileSelectedServices();
    notify();
}
```

Der Trick: Die internen Hilfsfunktionen `writeRoomQuantities` und `reconcileSelectedServices` benachrichtigen **nicht** mehr. Nur die öffentlichen Aktionen tun das, und zwar als letzten Schritt:

```diff
-function setRoomQuantities(next: RoomQuantities): void {
+/** Schreibt die Mengen samt Folgeregeln, ohne zu benachrichtigen – das macht die Aktion einmal am Ende. */
+function writeRoomQuantities(next: RoomQuantities): void {
     …
-    notify();
 }
```

Nach demselben Muster entstehen `setGuests` (gleicht Kinderbetten sofort ab) und `applySearchResult`, das nach jeder Suche Kategorien und Leistungen übernimmt und die Auswahl abgleicht:

```ts
function applySearchResult(nextRooms: readonly RoomCard[], nextExtraServices: readonly ExtraService[]): string | null {
    rooms = nextRooms;
    extraServices = nextExtraServices;
    const reconciled = reconcileQuantities(roomQuantities, rooms, getRoomLimit(guests.adults));
    writeRoomQuantities(reconciled.quantities);
    reconcileSelectedServices();
    notify();
    return reconciled.notice;
}
```

In der View schrumpfen sechs Zeilen auf eine:

```diff
-            this.rooms = buildRoomCards(details.data, …);
-            this.extraServices = buildExtraServices(serviceRows);
-            const reconciled = reconcileQuantities(bookingState.getRoomQuantities(), this.rooms, getRoomLimit(this.guests.adults));
-            bookingState.setRoomQuantities(reconciled.quantities);
-            this.quantityNotice = reconciled.notice;
-            this.reconcileSelectedServices();
+            this.quantityNotice = bookingState.applySearchResult(buildRoomCards(roomTypes, availability), buildExtraServices(serviceRows));
```

Ein Kommentar im Store dokumentiert, in welche Richtung die Abhängigkeit läuft:

```ts
// Der Store wendet die Regeln der Fachlogik an, die Fachlogik kennt den Store nicht –
// die Abhängigkeit läuft nur in diese Richtung.
import { getRoomLimit, getTotalRooms, reconcileQuantities } from '../../views/BookingView/roomQuantity';
```

Die Tests in `bookingState.spec.ts` zählen die Benachrichtigungen ausdrücklich:

```ts
it('selectRoomQuantity senkt die Kinderbetten mit den Zimmern – mit genau einer Benachrichtigung', () => {
    selectFamily();
    expect(
        countNotifications((): void => {
            bookingState.selectRoomQuantity('double', 1);
        }),
    ).toBe(1);
    expect(bookingState.getServices()).toEqual({ [CHILD_BED]: 1, PARKING: 1 });
});
```

Und ein Test prüft, dass `getGuests()` eine **Kopie** herausgibt – sonst könnte ein Aufrufer den Store am `notify` vorbei verändern:

```ts
it('gibt die Gäste als Kopie heraus', () => {
    bookingState.setGuests({ adults: 2, children: 0 });
    const guests = bookingState.getGuests();
    guests.adults = 5;
    expect(bookingState.getGuests().adults).toBe(2);
});
```

### 5. Ein `destroy()`-Hook für Views (D7)

Bisher gab es keinen definierten Moment, an dem eine View erfuhr, dass sie nicht mehr angezeigt wird. Die View half sich mit Prüfungen, ob ihre Elemente noch im DOM hängen:

```ts
// Kein Destroy-Hook: Nach einem Seitenwechsel meldet sich die View hier selbst ab.
if (this.summaryEl?.isConnected !== true) {
    this.unsubscribeSummary?.();
    this.unsubscribeSummary = null;
    return;
}
```

Und das Zurücksetzen des Entwurfs steckte – als versteckte Abhängigkeit – im **Header**:

```ts
destroy(): void {
    // …
    if (this.config.variant === 'booking') {
        bookingState.reset();
    }
}
```

Jetzt bekommt jede View einen eigenen Lebenszyklus-Hook:

```ts
// AbstractView.ts
/**
 * Räumt auf, bevor der Router die nächste Seite rendert: Abos lösen, Zustand
 * zurücksetzen, der nur zu dieser Seite gehört. Der Router ruft das genau einmal je
 * Instanz auf; danach wird sie nicht mehr angezeigt.
 */
destroy(): void {}
```

```diff
 export type ViewInstance = {
     onInit: () => Promise<void>;
     getHtml: () => Promise<string>;
     afterRender: () => Promise<void>;
+    destroy: () => void;
 };
```

Der Router merkt sich die aktuelle View und räumt vor jedem Seitenwechsel ab:

```ts
/**
 * Räumt Header und View der bisherigen Seite ab, bevor die neue entsteht.
 *
 * Erst der Header, dann die View: Setzt die View dabei Zustand zurück (BookingView),
 * erreicht die Benachrichtigung so keinen Header mehr, der gleich ersetzt wird.
 */
private teardown(): void {
    this.currentHeader?.destroy();
    this.currentHeader = null;
    this.currentView?.destroy();
    this.currentView = null;
}
```

```ts
const view: ViewInstance = match.route.kind === 'dynamic' ? new match.route.view(this.getParams(match)) : new match.route.view();
// Schon vor `onInit` merken: Navigiert der Gast weiter, während die View noch lädt,
// muss auch sie abgeräumt werden.
this.currentView = view;
await view.onInit();
```

Die `BookingView` übernimmt jetzt selbst, was ihr gehört:

```ts
/**
 * Meldet sich ab und verwirft den Entwurf: Wer die Buchungsseite verlässt, fängt beim
 * nächsten Besuch von vorn an (V10, kein `sessionStorage`).
 */
destroy(): void {
    this.destroyed = true;
    this.unsubscribeSummary?.();
    this.unsubscribeSummary = null;
    bookingState.reset();
}
```

Und die Prüfung für späte Antworten (Commit 019) wird ehrlicher – statt zu raten, ob ein Element noch im DOM hängt, fragt sie ein Flag ab, das genau dafür gesetzt wird:

```diff
     private isDisplayed(): boolean {
-        return this.roomsEl?.isConnected === true;
+        return !this.destroyed;
     }
```

Der Header macht nur noch, was **ihm** gehört – sein Abo lösen:

```diff
+    /** Löst das Abo, bevor der Router das Layout neu aufbaut. Den Entwurf setzt die BookingView zurück. */
     destroy(): void {
-        if (this.unsubscribe) {
-            this.unsubscribe();
-            this.unsubscribe = null;
-        }
-
-        if (this.config.variant === 'booking') {
-            bookingState.reset();
-        }
+        this.unsubscribe?.();
+        this.unsubscribe = null;
     }
```

Für Lernende, die Angular kennen: Das ist genau die Idee von `ngOnDestroy`. Ein Framework liefert solche Lebenszyklus-Hooks mit; ein selbstgeschriebener Router muss sie sich selbst bauen – und dieser Commit zeigt, welche Krücken entstehen, solange sie fehlen.

### 6. Beifang im Router: doppeltes Rendern beim Trailing Slash

Beim Einbauen von `teardown()` fiel ein alter Fehler auf. Die Umleitung von `/buchung/` auf `/buchung` stand **mitten** in `render()`, nach dem Matching. `navigateTo` rendert selbst – danach lief aber auch der ursprüngliche `render()`-Aufruf weiter. Die Seite entstand zweimal, und die erste View lebte ohne `destroy()` weiter.

Die Umleitung steht jetzt ganz am Anfang:

```ts
async render(): Promise<void> {
    const locationPath: string = window.location.pathname;

    // Erst umleiten, dann rendern: `navigateTo` rendert selbst – ginge es danach hier
    // weiter, entstünde dieselbe Seite ein zweites Mal, und die erste View bliebe ohne
    // `destroy()` am Leben.
    if (locationPath.length > 1 && locationPath.endsWith('/')) {
        const correctedLocationPath = locationPath.slice(0, -1);
        console.log('corrected path: ', correctedLocationPath);
        await this.navigateTo(correctedLocationPath);
        return;
    }
    // …
```

Ein typischer Effekt sauberer Lebenszyklen: Sobald man genau definiert, **wann** etwas abgeräumt wird, fallen Stellen auf, an denen etwas doppelt oder gar nicht abgeräumt wurde.

### 7. Reparatur der Tailwind-Klassen aus Commit 026

```diff
-                <span class="… w-10 h-10 768:w-10.5-[2.625rem] rounded-full …">
+                <span class="… w-10 h-10 768:w-10.5 768:h-10.5 rounded-full …">
```

```diff
-            <div class="relative shrink-0 768:w-76 aspect-304/321
+            <div class="relative shrink-0 768:w-76 aspect-304/321">
```

```diff
-                <h3 class="… text-eggshell wrap-break-wordword">${escapeHtml(room.name)}</h3>
+                <h3 class="… text-eggshell wrap-break-word">${escapeHtml(room.name)}</h3>
```

Das fehlende `">` am Zimmerbild ist damit wieder da, und die Zimmerkarten liegen nicht mehr über dem Kalender.

### 8. Tests, `CLAUDE.md` und Review-Dokument

Vier neue bzw. erweiterte Testdateien: `catalog.service.spec.ts`, `bookingState.spec.ts`, `draft.spec.ts` und `getCurrentStep` in `validation.spec.ts`.

Interessant ist `catalog.service.spec.ts`, weil es den Supabase-Client **mockt**. Die Abfragekette `from().select().order()` wird durch ein Objekt nachgebaut, dessen Glieder sich selbst zurückgeben:

```ts
const query: Query = {
    select: (): Query => query,
    limit: (): Query => query,
    order: (): Promise<Response> => Promise.resolve(response),
    maybeSingle: (): Promise<Response> => Promise.resolve(response),
};
const from = vi.fn((): Query => query);
vi.mock('./supabase', () => ({ supabase: { rpc, from, storage } }));

const { buildRoomCards, fetchHotel, fetchRoomTypes, fetchServices, searchAvailability } = await import('./catalog.service');
```

`vi.mock` ersetzt das Modul `./supabase`, bevor der Service es lädt – deshalb wird der Service erst danach per `await import(…)` geholt. So prüfen die Tests das Verhalten des Services (wirft er? übersetzt er die Parameter richtig?), ohne eine Datenbank zu brauchen:

```ts
it('übersetzt die Suche in die p_*-Parameter', async () => {
    response = { data: [], error: null };
    await searchAvailability({ checkIn: '2026-06-12', checkOut: '2026-06-15', adults: 2, children: 1 });
    expect(rpc).toHaveBeenCalledWith('search_availability', { p_check_in: '2026-06-12', p_check_out: '2026-06-15', p_adults: 2, p_children: 1 });
});
```

In `CLAUDE.md` kommt `destroy()` zur Liste der View-Methoden, und der Supabase-Abschnitt beschreibt den neuen Stand: `catalog.service.ts`, der Store als vollständiger Entwurf, `getCompletedSteps` im Header. Im Review-Dokument werden D4–D7 abgehakt, jeweils mit einer Notiz zur Umsetzung und dem Vermerk „im Browser geprüft" bzw. „im Browser durchgespielt".

## Was wurde erreicht?

`Booking.ts` verliert unterm Strich rund 70 Zeilen (118 hinzu, 189 entfernt) und enthält keinen einzigen Supabase-Aufruf mehr. Von Gruppe D des Reviews sind damit D1–D7 und D9 erledigt; offen ist nur noch **D8** (Templates in eigene Dateien).

| Technik                                                   | Wozu                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Service-Schicht für Lesezugriffe                          | View spricht nicht mehr mit der Datenbank (`V9`, Phase 8.4)                  |
| Typen nach `shared/types/`, `RoomAmenity` zurück zur View | Abhängigkeiten laufen von `views/` nach `shared/`, nie umgekehrt             |
| Abgeleiteten Zustand berechnen statt speichern            | Schritte können nicht veralten, Endlosschleifen-Sperre entfällt              |
| Store-Aktionen mit genau einem `notify`                   | kein inkonsistenter Zwischenzustand, kein doppeltes Rendern                  |
| Datenfluss Eingabe → Store → Abonnenten                   | Event-Handler müssen nicht wissen, wer alles neu rendern muss                |
| `destroy()`-Hook im Router                                | definierter Abbau statt `isConnected`-Krücken und versteckter Abhängigkeiten |
| Supabase-Client mit `vi.mock` ersetzen                    | Service testbar ohne Datenbank                                               |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
