[← Vorheriger Commit](001_2026-09-06_implement-guest-selection.md) · [↑ Branch-Übersicht](../007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](../000_index.md)

# feat: add room interfaces for availability, details, amenities, and card rendering

- **Commit:** `a7efff8`
- **Datum:** 2026-09-06
- **Autor:** Oliver Jung

## Worum geht es?

**Der Commit, in dem die zwei Hälften des Projekts sich zum ersten Mal berühren.** Sieben Phasen Datenbankarbeit haben `search_availability`, `room_types`, `room_type_images` und einen Storage-Bucket hervorgebracht – bis hierher hat sie niemand aus der Anwendung heraus benutzt. Jetzt schon.

```text
 src/views/BookingView/Booking.ts        | 462 ++++++++++++++++++++++++++++++++
 src/views/BookingView/room.interface.ts |  61 +++++
 2 files changed, 523 insertions(+)
```

Der Commit baut zwei Dinge auf einmal, und man sollte sie beim Lesen trennen:

1. Die **Zimmerliste** – echt angebunden: Stammdaten, Bilder aus dem Storage, Preis und Verfügbarkeit aus `search_availability`.
2. Den **Checkout-Bereich** („Buchung abschließen") – reines Markup nach dem Figma-Entwurf, mit Beispielwerten und ohne jede Anbindung.

Dass Nummer 2 eine Attrappe ist, steht ausdrücklich im Code. Das ist wichtiger, als es aussieht – dazu am Ende mehr.

## Teil 1 – Die neue Datei `room.interface.ts`

Die Datei ist 61 Zeilen lang und enthält **sechs** Interfaces. Sie sind nicht alle gleicher Art, und der Unterschied ist die eigentliche Lehre dieses Commits.

### Die datenbanknahen Typen

```ts
/** Eine Zeile aus der Datenbankfunktion `search_availability`. */
export interface RoomAvailability {
    room_type_id: string;
    name: string;
    slug: string;
    max_occupancy: number;
    nights: number;
    // Beide sind NULL, sobald die Kategorie nicht buchbar ist: `search_availability`
    // unterdrückt Preis und Restbestand bewusst, damit nichts wie ein Angebot aussieht.
    rooms_free: number | null;
    total_amount_cents: number | null;
    currency: string;
    is_bookable: boolean;
    unavailable_reason: string | null;
}

/** Ein Bild einer Zimmerkategorie aus `room_type_images`. */
export interface RoomTypeImage {
    storage_path: string;
    alt_text: string;
    sort_order: number;
}

/** Stammdaten einer Kategorie samt Bildern – per Embed in einer Abfrage geholt. */
export interface RoomTypeDetail {
    name: string;
    slug: string;
    description: string | null;
    room_type_images: RoomTypeImage[];
}
```

Drei Beobachtungen:

**`snake_case` mitten im TypeScript-Code.** `room_type_id`, `total_amount_cents`, `is_bookable` – das ist keine Nachlässigkeit, sondern eine bewusste Treue zur Quelle. PostgREST (die Schnittstelle, über die Supabase Tabellen und Funktionen anbietet) liefert die Spaltennamen genau so, wie sie in der Datenbank heißen. Wer sie beim Einlesen umbenennt, muss die Umbenennung an jeder Stelle mitdenken. Wer sie stehen lässt, sieht an der Schreibweise sofort: _das kommt von draußen_.

**`number | null` überall dort, wo die Datenbank maskiert.** Der Kommentar erklärt es: `search_availability` gibt bei nicht buchbaren Kategorien **weder Preis noch Restbestand** zurück. Das ist die Entscheidung `E28` aus dem Datenbank-Branch – die Maskierung betrifft nicht nur den Grund, sondern auch die Zahlen, weil ein Preis ohne Verfügbarkeit wie ein Angebot aussieht. Das Interface muss dieselbe Möglichkeit ausdrücken, sonst lügt der Typ.

**`total_amount_cents`, nicht `total_amount`.** Geldbeträge als Ganzzahl in der kleinsten Einheit – der Standard, weil `0.1 + 0.2 !== 0.3` in Gleitkommaarithmetik gilt. Die Umrechnung passiert erst bei der Anzeige.

### Die Ansichtstypen

```ts
/** Preis und Verfügbarkeit einer Kategorie – gibt es nur mit gewähltem Zeitraum. */
export interface RoomCardAvailability {
    priceLabel: string | null;
    nights: number;
    roomsFree: number | null;
    isBookable: boolean;
    unavailableReason: string | null;
}

/** Alles, was eine Zimmerkarte zum Rendern braucht – aus beiden Abfragen zusammengeführt. */
export interface RoomCard {
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    imageAlt: string;
    /** `null`, solange kein Zeitraum gewählt ist: ohne Datum gibt es weder Preis noch Restbestand. */
    availability: RoomCardAvailability | null;
}
```

Hier ist alles `camelCase`, und `priceLabel` ist bereits ein **fertiger Text** (`'732€'`), keine Zahl. Der Typ beschreibt nicht mehr, was die Datenbank liefert, sondern was die Karte braucht.

Und `RoomAmenity` ist der Sonderfall – ein Typ ohne jede Datenbankentsprechung:

```ts
/**
 * Ausstattungsmerkmal einer Zimmerkategorie.
 *
 * Bewusst kein Datenbankfeld: für die Icons im Design (Bett, Klimaanlage, Bad, Gym)
 * gibt es kein Schema. Die Zuordnung steht als Konstante in `Booking.ts`.
 */
export interface RoomAmenity {
    icon: string;
    label: string;
}
```

### Warum diese Trennung zählt

|                       | Datenbanknahe Typen                                   | Ansichtstypen                                     |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Beispiele             | `RoomAvailability`, `RoomTypeDetail`, `RoomTypeImage` | `RoomCard`, `RoomCardAvailability`, `RoomAmenity` |
| Schreibweise          | `snake_case`                                          | `camelCase`                                       |
| Geldbetrag            | `total_amount_cents: number \| null`                  | `priceLabel: string \| null`                      |
| Ändert sich, wenn …   | eine **Migration** eine Spalte umbenennt              | der **Entwurf** die Karte umbaut                  |
| Können sie _driften_? | **ja** – sie sind eine Kopie der Wahrheit             | nein – sie _sind_ die Wahrheit über die Karte     |

Die letzte Zeile ist der Punkt. Ein handgeschriebenes `RoomAvailability` behauptet etwas über die Datenbank. Ändert eine Migration `rooms_free` in `available_rooms`, bleibt das Interface stehen, `tsc` schweigt, und zur Laufzeit ist der Wert `undefined`. Genau diese Fehlerklasse hat Entscheidung `E7` aus dem Datenbank-Branch im Blick: Das Skript `pnpm db:types` erzeugt die Typen **aus** der laufenden Datenbank, dann entsteht bei einer Umbenennung ein Typfehler.

Dass die Typen hier trotzdem von Hand geschrieben sind, ist also eine bekannte Baustelle. Der nachfolgende Branch macht daraus die Entscheidung `V8`: datenbanknahe Typen werden aus `Database` **abgeleitet**, `RoomCard` & Co. bleiben handgeschrieben, weil sie keine Tabellen beschreiben und deshalb nicht driften können.

## Teil 2 – Die Zimmerliste in `Booking.ts`

### Zustandsmaschine für Ladezustände

```diff
+type RoomsState = 'loading' | 'ready' | 'error';
```

```diff
 export class BookingView extends AbstractView {
     …
+    private roomsEl: HTMLElement | null = null;
+    private rooms: RoomCard[] = [];
+    private roomsState: RoomsState = 'loading';
+    private roomsError: string | null = null;
+    // Zählt die Suchanfragen mit. Trifft eine ältere Antwort nach einer neueren ein,
+    // wird sie verworfen, statt das Ergebnis der neueren zu überschreiben.
+    private roomsRequestId = 0;
```

Drei mögliche Zustände als String-Literal-Union statt zweier Booleans (`isLoading`, `hasError`). Der Unterschied: Mit zwei Booleans gibt es vier Kombinationen, davon eine unsinnige (`isLoading && hasError`). Mit einer Union gibt es genau drei, und `switch` kann sie vollständig abdecken:

```ts
private getRoomsBodyHtml(): string {
    switch (this.roomsState) {
        case 'loading':
            return this.getRoomsNoticeHtml('Zimmer werden geladen …');
        case 'error':
            return this.getRoomsNoticeHtml(`Die Zimmer konnten nicht geladen werden: ${this.roomsError ?? 'Unbekannter Fehler'}`);
        case 'ready':
            if (this.rooms.length === 0) {
                return this.getRoomsNoticeHtml('Zurzeit sind keine Zimmerkategorien hinterlegt.');
            }
            return /*html*/ `
                <div class="flex flex-col gap-8 768:gap-11">
                    ${this.rooms.map((room: RoomCard): string => this.getRoomCardHtml(room)).join('')}
                </div>
            `;
    }
}
```

Der `switch` hat **kein `default`** – und das ist kein Versehen. Weil `RoomsState` genau drei Werte hat und alle drei behandelt werden, weiß TypeScript, dass die Funktion immer etwas zurückgibt. Kommt später ein vierter Zustand dazu, meldet `tsc` „nicht alle Codepfade geben einen Wert zurück". Ein `default: return ''` würde diese Warnung wegnehmen – man tauscht also Bequemlichkeit gegen eine kostenlose Prüfung.

Beachtenswert: Auch der Fall „geladen, aber leer" hat eine eigene Meldung. Eine leere Liste ohne Text sieht aus wie ein Fehler.

### Das Laden der Daten – zwei Abfragen parallel

```ts
/**
 * Lädt die Zimmerkategorien – ohne gewählten Zeitraum nur die Stammdaten, mit
 * Zeitraum zusätzlich Preis und Verfügbarkeit aus `search_availability`.
 */
private async loadRooms(): Promise<void> {
    const { checkIn, checkOut } = bookingState.getDates();

    const requestId = ++this.roomsRequestId;
    this.roomsState = 'loading';
    this.renderRooms();

    try {
        const [details, availability] = await Promise.all([
            supabase.from('room_types').select('name, slug, description, room_type_images(storage_path, alt_text, sort_order)').order('name'),
            checkIn === null || checkOut === null
                ? null
                : supabase.rpc('search_availability', {
                      p_check_in: toISODate(checkIn),
                      p_check_out: toISODate(checkOut),
                      p_adults: this.guests.adults ?? DEFAULT_ADULTS,
                      p_children: this.guests.children ?? DEFAULT_CHILDREN,
                  }),
        ]);

        // Eine überholte Antwort darf das Ergebnis der aktuellen Suche nicht ersetzen.
        if (requestId !== this.roomsRequestId) return;

        if (details.error) throw new Error(details.error.message);
        if (availability !== null && availability.error) throw new Error(availability.error.message);

        this.rooms = buildRoomCards(details.data, availability === null ? null : (availability.data as RoomAvailability[]));
        this.roomsState = 'ready';
        this.roomsError = null;
    } catch (error) {
        if (requestId !== this.roomsRequestId) return;
        this.roomsState = 'error';
        this.roomsError = error instanceof Error ? error.message : 'Unbekannter Fehler';
    }

    this.renderRooms();
}
```

Diese eine Methode enthält fünf Techniken, die sich lohnen:

**1. Der eingebettete Select (`Embed`).**

```ts
.select('name, slug, description, room_type_images(storage_path, alt_text, sort_order)')
```

Die Klammer-Schreibweise holt die verknüpfte Tabelle **in derselben Anfrage** mit. PostgREST erkennt die Fremdschlüsselbeziehung und liefert die Bilder als verschachteltes Array – genau die Form, die `RoomTypeDetail.room_type_images: RoomTypeImage[]` beschreibt. Die Alternative wäre: eine Anfrage für die Kategorien, dann eine pro Kategorie für die Bilder. Das ist das klassische _N+1-Problem_ – bei fünf Kategorien sechs Anfragen statt einer.

**2. `Promise.all` mit einem möglichen `null`.** Beide Abfragen laufen **gleichzeitig**, nicht hintereinander – zwei mal `await` in Folge würde die Wartezeiten addieren. Und der Eintrag für die Verfügbarkeit ist `null`, solange kein Zeitraum gewählt ist. `Promise.all` verträgt Nicht-Promises in der Liste; sie kommen unverändert zurück. Der Ausdruck bleibt so ein einziger, lesbarer Aufruf.

**3. Vernünftige Standardwerte für die Suche.**

```ts
const DEFAULT_ADULTS = 2;
const DEFAULT_CHILDREN = 0;
```

`this.guests.adults ?? DEFAULT_ADULTS` – der Nullish-Operator `??` greift genau bei `null` und `undefined`, **nicht** bei `0`. Mit `||` wäre „0 Kinder" fälschlich zum Standardwert geworden. Genau hier zahlt sich die Entscheidung aus Commit 001 aus, `null` und `0` auseinanderzuhalten.

Ehrlich benannt: Ein stiller Standardwert ist eine Annahme, die der Gast nicht getroffen hat. Die Liste zeigt Preise für zwei Erwachsene, obwohl niemand „zwei" gewählt hat. Der Nachfolge-Branch verwirft das ausdrücklich (`V16`): Die Gästezahl wird **verpflichtend**, kein stiller Suchdefault.

**4. Der Wettlauf der Antworten (`race condition`) – und seine drei Zeilen Lösung.**

```ts
const requestId = ++this.roomsRequestId;
// … await …
if (requestId !== this.roomsRequestId) return;
```

Das Szenario: Der Gast wählt „2 Erwachsene", gleich danach „4 Erwachsene". Zwei Abfragen sind unterwegs. Antwortet die erste **später** als die zweite (Netzwerk, Serverlast, Zufall), überschreibt sie das neuere Ergebnis – die Seite zeigt Preise für 2 Erwachsene, obwohl 4 im Feld stehen.

Die Lösung ist ein monoton wachsender Zähler. Jede Anfrage merkt sich ihre Nummer, und **nach** dem `await` prüft sie, ob sie noch die jüngste ist. Wenn nicht: `return`, ohne etwas zu schreiben.

Warum dieselbe Prüfung ein zweites Mal im `catch`-Block steht: Auch ein _Fehler_ einer überholten Anfrage darf das gültige Ergebnis nicht zerstören. Ohne diese Zeile könnte eine abgebrochene alte Anfrage die Seite auf „Fehler" schalten, obwohl die neue erfolgreich war.

> **Merksatz:** Immer wenn nach einem `await` in einen gemeinsamen Zustand geschrieben wird, muss man sich fragen: _Bin ich noch zuständig?_ Das gilt in jedem Framework – React nennt es „stale state", Angular löst es mit `switchMap`. Der Zähler hier ist die Variante ohne Bibliothek.

**5. `void this.loadRooms()`.** An drei Stellen wird die Methode so aufgerufen:

```diff
 private handleGuestChange(event: Event): void {
     …
     this.guests[field] = target.value === '' ? null : Number(target.value);
+    void this.loadRooms();
 }
```

```diff
         bookingState.setDates(checkIn, date);
     }
     this.renderCalendar();
+    void this.loadRooms();
 }

 private clearSelection(): void {
     bookingState.setDates(null, null);
     this.renderCalendar();
+    void this.loadRooms();
 }
```

`loadRooms()` gibt ein `Promise` zurück, die Aufrufer sind aber synchron. Das `void` sagt ausdrücklich: „Ich weiß, dass hier ein Promise entsteht, und ich warte absichtlich nicht darauf." Ohne `void` beanstandet die ESLint-Regel `no-floating-promises` den Aufruf – zu Recht, denn ein unbeachtetes Promise verschluckt im Fehlerfall die Ausnahme. Hier ist es sicher, weil `loadRooms()` seine Fehler **selbst** in `roomsState` auffängt und niemals abgelehnt zurückkommt.

Die drei Aufrufstellen zeigen zugleich, welche Ereignisse eine neue Suche auslösen: Gästezahl geändert, Zeitraum gewählt, Auswahl gelöscht.

### Zusammenführen: `buildRoomCards()`

```ts
function buildRoomCards(details: RoomTypeDetail[], availability: RoomAvailability[] | null): RoomCard[] {
    const availabilityBySlug = new Map<string, RoomAvailability>((availability ?? []).map((room: RoomAvailability): [string, RoomAvailability] => [room.slug, room]));

    return details.map((detail: RoomTypeDetail): RoomCard => {
        const image = pickImage(detail.room_type_images);
        const room = availabilityBySlug.get(detail.slug);

        return {
            slug: detail.slug,
            name: detail.name,
            description: detail.description,
            imageUrl: image === null ? null : supabase.storage.from(ROOM_IMAGE_BUCKET).getPublicUrl(image.storage_path).data.publicUrl,
            imageAlt: image?.alt_text ?? '',
            availability:
                room === undefined
                    ? null
                    : {
                          priceLabel: room.total_amount_cents === null ? null : formatPrice(room.total_amount_cents, room.currency),
                          nights: room.nights,
                          roomsFree: room.rooms_free,
                          isBookable: room.is_bookable,
                          unavailableReason: room.unavailable_reason,
                      },
        };
    });
}
```

Das ist die Naht zwischen den beiden Typwelten – und sie hat drei Eigenschaften, die man sich merken kann:

**Eine `Map` statt `find()` in der Schleife.** `availabilityBySlug.get(slug)` ist eine Suche in konstanter Zeit. `availability.find(r => r.slug === slug)` innerhalb von `details.map()` wäre eine verschachtelte Schleife. Bei fünf Kategorien ist das gleichgültig; das Muster ist es nicht, denn es kostet hier nichts.

**Die Reihenfolge kommt aus den Stammdaten, nicht aus der Verfügbarkeit.** Der Kommentar sagt es ausdrücklich:

> Die Kategorien geben die Reihenfolge vor, damit die Liste beim Wählen eines Zeitraums nicht umspringt.

`details.map(...)` iteriert über die Kategorien (sortiert per `.order('name')`) und holt die Verfügbarkeit dazu. Umgekehrt – über die Verfügbarkeit iterieren – würde die Liste bei jeder Suche neu sortiert, und Kategorien, die `search_availability` nicht zurückgibt, verschwänden ganz.

**Die Funktion ist frei (`function`), nicht Methode.** `buildRoomCards`, `pickImage`, `formatPrice`, `formatNights`, `formatRoomsFree`, `formatUnavailableReason` und `getAvailabilityHtml` liegen alle **außerhalb** der Klasse. Sie brauchen kein `this`, hängen also nicht am Zustand der View – und sind damit einzeln testbar. Der Nachfolge-Branch nennt das als eigenen Grundsatz (`V16`, letzter Punkt): Regeln als eigenständige Funktionen herausziehen, **auch** wenn gerade keine Tests geschrieben werden, damit sie später ohne Umbau nachgezogen werden können.

Kleine, aber lehrreiche Ausnahme: Die Zeile mit `supabase.storage…getPublicUrl(...)` macht `buildRoomCards()` doch von einem Modul abhängig. `getPublicUrl` ist übrigens ein **synchroner** Aufruf – er baut nur eine URL zusammen und fragt niemanden. Der Nachfolge-Branch verbietet auch diesen Zugriff außerhalb der Service-Schicht (`V9`) mit einer Begründung, die man sich aufschreiben kann: _„Eine Regel mit einer Ausnahme für ‚nur schnell die Bild-URL' ist nach einer Woche keine Regel mehr."_

### Kleine Helfer mit klaren Aufgaben

```ts
/** Erstes Bild nach `sort_order` – Kategorien ohne Bild sind ein vorgesehener Fall. */
function pickImage(images: RoomTypeImage[]): RoomTypeImage | null {
    if (images.length === 0) return null;
    return [...images].sort((a: RoomTypeImage, b: RoomTypeImage): number => a.sort_order - b.sort_order)[0] ?? null;
}
```

Zwei Details: `[...images]` erzeugt eine **Kopie**, bevor sortiert wird – `Array.prototype.sort` verändert das Original, und das Original gehört zum Ergebnis der Abfrage. Und das `?? null` am Ende ist keine Paranoia, sondern eine Folge der strengen `tsconfig.json` dieses Projekts: Mit `noUncheckedIndexedAccess` hat `array[0]` den Typ `RoomTypeImage | undefined`, auch nach der Längenprüfung.

```ts
/** Zahl vor dem Symbol wie im Design ("732€") – `style: 'currency'` stellt das € bei de-AT voran. */
function formatPrice(cents: number, currency: string): string {
    const amount = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(cents / 100);
    return currency === 'EUR' ? `${amount}€` : `${amount} ${currency}`;
}
```

`Intl.NumberFormat` ist im Browser eingebaut und macht die Tausender-Trennung richtig (`1.464`). Der Kommentar erklärt, warum nicht `style: 'currency'` verwendet wird: Für die Region `de-AT` erzeugt das `€ 732,00` – Symbol vorn, Nachkommastellen erzwungen. Der Entwurf zeigt `732€`. Man nimmt also die Zahlenformatierung aus `Intl` und setzt das Symbol selbst – und dokumentiert, dass das Absicht ist.

```ts
function formatNights(nights: number): string {
    return nights === 1 ? '1 Nacht' : `${nights.toString()} Nächte`;
}

function formatRoomsFree(roomsFree: number): string {
    return roomsFree === 1 ? 'noch 1 Zimmer frei' : `noch ${roomsFree.toString()} Zimmer frei`;
}
```

Dieselbe Ein-/Mehrzahl-Behandlung wie bei den Gäste-Optionen. Und `.toString()` überall: Die ESLint-Regel `restrict-template-expressions` aus `strictTypeChecked` verlangt eine ausdrückliche Umwandlung, statt sich auf die implizite Konvertierung im Template-String zu verlassen.

### Die Gründe aus der Datenbank übersetzen

```ts
/**
 * Übersetzt die Gründe aus `search_availability`.
 *
 * Gäste sehen laut `mask_reason` nur `nicht_buchbar`, `vergangenheit` und
 * `ausserhalb_horizont`; die feineren Gründe bekommt nur `is_staff()`.
 */
function formatUnavailableReason(reason: string): string {
    switch (reason) {
        case 'nicht_buchbar':
            return 'Für diesen Zeitraum nicht buchbar.';
        case 'vergangenheit':
            return 'Der gewählte Zeitraum liegt in der Vergangenheit.';
        case 'ausserhalb_horizont':
            return 'Der gewählte Zeitraum liegt zu weit in der Zukunft.';
        case 'ausgebucht':
            return 'Für diesen Zeitraum ausgebucht.';
        case 'kein_preis':
            return 'Für diesen Zeitraum ist kein Preis hinterlegt.';
        case 'zu_klein':
            return 'Zu klein für die gewählte Belegung.';
        default:
            return 'Für diesen Zeitraum nicht buchbar.';
    }
}
```

Diese Funktion ist ein schönes Beispiel dafür, wie Datenbankentscheidungen im Frontend sichtbar werden. Die Datenbank liefert **maschinenlesbare Codes**, nicht Sätze – das ist richtig, weil ein Text in der Datenbank sich nicht übersetzen und nicht ohne Migration ändern lässt.

Und drei der sechs Fälle sind für Gäste **toter Code**: `ausgebucht`, `kein_preis` und `zu_klein` kommen nur bei `is_staff()` durch die Maskierung `mask_reason` (`E28`). Sie hier trotzdem zu behandeln ist verteidigbar – der Kommentar sagt ausdrücklich, dass sie nur für Personal auftreten. Der `default`-Zweig ist die Absicherung gegen einen neuen Grund, den eine künftige Migration einführt: Dann zeigt die Seite den allgemeinen Satz und nicht einen rohen Code wie `wartungsfenster`.

### Die Karte selbst

```ts
private getRoomCardHtml(room: RoomCard): string {
    const amenities = ROOM_AMENITIES[room.slug] ?? [];
    const isBookable = room.availability === null || room.availability.isBookable;
    …
    return /*html*/ `
        <article class="flex flex-col 768:flex-row overflow-hidden ${isBookable ? '' : 'opacity-60'}">
            ${this.getRoomImageHtml(room)}
            <div class="flex-1 flex flex-col justify-center gap-3 bg-purple-haze-light px-5 py-6 768:px-8 768:py-8">
                ${amenitiesHtml}
                ${description}
                ${getAvailabilityHtml(room.availability)}
            </div>
        </article>
    `;
}
```

`room.availability === null || room.availability.isBookable` – ohne gewählten Zeitraum gilt die Karte als buchbar. Das ist die richtige Voreinstellung: Eine ausgegraute Karte, bevor der Gast überhaupt ein Datum gewählt hat, wäre eine Aussage, die niemand geprüft hat.

Die Ausstattungsmerkmale kommen aus einer Konstante, und die Begründung steht darüber:

```ts
/**
 * Ausstattung je Zimmerkategorie.
 *
 * Für diese vier Merkmale gibt es kein Datenbankfeld – die Werte stammen aus dem
 * Figma-Design. Kategorien ohne Eintrag (z. B. `einzelzimmer-alpin`) bekommen keine
 * Ausstattungsliste, statt erfundene Merkmale anzuzeigen.
 */
const ROOM_AMENITIES: Readonly<Record<string, readonly RoomAmenity[]>> = {
    'double-suite': [
        { icon: ICON_BED, label: 'King-size Bett' },
        { icon: ICON_AIR_CONDITIONING, label: 'Klimaanlage & TV' },
        { icon: ICON_BATH, label: 'Badewanne, Föhn & eigenes WC' },
        { icon: ICON_GYM, label: 'Gym Zugang' },
    ],
    'double-premium': [ … ],
};
```

Der zweite Satz des Kommentars ist die interessante Entscheidung: **Kategorien ohne Eintrag bekommen keine Liste, statt erfundene Merkmale anzuzeigen.** Das ist die kleine Schwester des Grundsatzes aus dem Datenbank-Branch – nichts anzeigen, was man nicht weiß. Der Nachteil ist benannt: Die Zuordnung liegt im Code und muss bei einer neuen Kategorie dort nachgetragen werden. Sie in ein Schema zu heben (`E42`-Nachbarschaft: „Ausstattungsmerkmale" steht in `schema.md` ausdrücklich unter „bewusst nicht im Schema") wäre eine eigene Entscheidung.

```ts
private getRoomImageHtml(room: RoomCard): string {
    const image =
        room.imageUrl === null
            ? /*html*/ `<div class="absolute inset-0 bg-purple-haze-dark"></div>`
            : /*html*/ `<img src="${room.imageUrl}" alt="${room.imageAlt}" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />`;
    …
}
```

`loading="lazy"` lädt Bilder erst, wenn sie in Sichtweite kommen – ein Attribut, kein JavaScript. Und `alt="${room.imageAlt}"` kommt aus der Spalte `alt_text` von `room_type_images`: Der Alternativtext ist ein **Datenfeld**, nicht etwas, das das Frontend erfindet. Wer das Bild pflegt, pflegt seine Beschreibung mit.

## Teil 3 – Der Checkout: bewusst eine Attrappe

Rund 200 der 462 Zeilen in `Booking.ts` sind der Abschnitt „Buchung abschließen". Und darüber steht:

```ts
/**
 * Abschluss-Sektion aus dem Design ("BuchungAbschließen"): Rechnungsadresse links,
 * Zusammenfassung rechts.
 *
 * Noch reines Markup – die Beispielwerte stammen aus dem Figma-Entwurf und sind
 * bewusst nicht an `bookingState` oder Supabase angebunden.
 */
private getCheckoutHtml(): string { … }
```

Was dort fest verdrahtet steht: „Double Suite", „13.06.2026 ab 14:00 Uhr", „732€", „Maxime Musterfrau", „Extra Angebot 23€". Nichts davon kommt aus Daten.

**Warum das in Ordnung ist – und was daran der Trick ist.** Ein Markup-Gerüst mit Beispielwerten zu bauen, bevor die Anbindung existiert, ist legitim: Man sieht das Layout, kann es mit dem Entwurf vergleichen und die Struktur festlegen. Der Unterschied zwischen einer nützlichen Attrappe und technischer Schuld liegt allein darin, **ob sie als solche gekennzeichnet ist**. Hier ist sie es – in einem Doc-Kommentar, an der Stelle, an der man sie liest.

Der Beweis, dass es funktioniert hat: Die Bestandsaufnahme im nächsten Branch listet „Checkout ist Figma-Attrappe („Double Suite", „732 €", „Maxime Musterfrau")" als eigene Zeile in der Lückentabelle. Der Kommentar hat seinen Zweck erfüllt.

Trotzdem ist das Formular schon sorgfältig gebaut:

```ts
/** Die Werte aus dem Design stehen als `placeholder` im Feld – die Eingabe bleibt leer. */
private getBillingFieldHtml(id: string, label: string, sample: string, autocomplete: string, type: string, widthClass: string): string {
    return /*html*/ `
        <div class="flex flex-col ${widthClass}">
            <label for="booking-${id}" class="…">${label}</label>
            <input
                id="booking-${id}"
                name="${id}"
                type="${type}"
                autocomplete="${autocomplete}"
                placeholder="${sample}"
                class="…"
            />
        </div>
    `;
}
```

- **`placeholder`, nicht `value`.** Die Beispielwerte aus dem Entwurf sind Andeutungen, keine Vorbelegung. Ein `value="Maxime"` müsste der Gast erst löschen.
- **`<label for>` mit passender `id`.** Hier gibt es sichtbare Beschriftungen – also echte `<label>`-Elemente statt `aria-label`. Ein Klick auf die Beschriftung setzt den Fokus ins Feld.
- **`autocomplete="given-name" / "postal-code" / "country-name"`.** Die standardisierten Werte, mit denen Browser und Passwortmanager Adressformulare automatisch füllen können. Kostet ein Attribut, spart dem Gast das Tippen.
- **`type="email"` / `type="tel"`.** Auf dem Handy erscheint dadurch die passende Tastatur.

Und eine Zeile, die im nächsten Branch zur Entscheidung führt:

```html
<p class="font-antic-didone text-14 leading-tight text-[#74687e]">Ich bestätige, dass ich die Datenschutzvereinbarung gelesen habe.</p>
```

Ein **Satz**, keine Checkbox. Der Nachfolge-Branch entscheidet ausdrücklich, dass es dabei bleibt (`V16`), und begründet es: Eine echte Einwilligung bräuchte Checkbox **und** eine Datenbankspalte mit Zeitpunkt – „ein eigener Vorgang, kein Nebenprodukt".

## Was wurde erreicht?

Zum ersten Mal in diesem Projekt zeigt eine Seite **echte Daten aus der Datenbank**: Zimmerkategorien, Beschreibungen, Bilder aus dem Storage – und bei gewähltem Zeitraum Preis und Restbestand aus `search_availability`. Das Frontend kennt die Maskierungsregeln der Datenbank und hält sich daran, statt sie zu umgehen.

**Übertragbare Techniken aus diesem Commit:**

| Technik                                                              | Wozu                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `'loading' \| 'ready' \| 'error'` statt Booleans                     | keine unsinnigen Zustandskombinationen, vollständiger `switch` |
| Zähler + Prüfung nach `await`                                        | überholte Antworten überschreiben keine neueren                |
| Eingebetteter Select (`tabelle(spalten)`)                            | eine Anfrage statt N+1                                         |
| `Promise.all` mit optionalem Eintrag                                 | parallel laden, ein lesbarer Aufruf                            |
| `??` statt `\|\|`                                                    | `0` ist ein Wert, kein fehlender Wert                          |
| `void promise()`                                                     | absichtlich nicht warten, Lint-Regel bewusst erfüllen          |
| Trennung DB-Typ ↔ Ansichtstyp mit einer `build…`-Funktion dazwischen | Umbenennungen im Schema treffen nur eine Stelle                |
| `Map` statt `find()` in der Schleife                                 | konstante statt verschachtelter Suche                          |
| Freie Funktionen ohne `this`                                         | später testbar, ohne Umbau                                     |

**Was offen bleibt** – vollständig in der [Branch-Übersicht](../007_2026-09-06_buchungsseite-ui-fertigstellen.md) aufgeführt und Stoff des nächsten Branches: Kalender ohne `availability_calendar`, keine Zimmerauswahl, Checkout als Attrappe, `submit()` mit `console.log`, kein Ziel im Schema für die Rechnungsadresse, direkte `supabase`-Aufrufe in den Views und handgeschriebene Typen.

Unmittelbar nach diesem Commit ging der Branch über **Pull Request #4** in `main` (Merge-Commit `9b81803` vom 2026-09-09) – und nahm dabei den Branch `datenbank-anbindung` mit, von dem er abgezweigt war.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [Nächster Commit →](../008_2026-09-09_verbindung-ui-zu-datenbank/001_2026-09-09_umsetzungsplan-erstellt.md)
