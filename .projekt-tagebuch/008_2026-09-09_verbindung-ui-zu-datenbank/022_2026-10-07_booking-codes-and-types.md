[← Vorheriger Commit](021_2026-10-07_constants-breakfast-default-currency.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat: add booking codes and types for better handling of booking errors

- **Commit:** `b006707`
- **Datum:** 2026-10-07
- **Autor:** Oliver Jung

## Worum geht es?

Der größte Aufräum-Commit nach dem Review. Er erledigt auf einen Schlag den Rest von Gruppe B und drei der fünf Punkte aus Gruppe C:

| Punkt  | Thema                                                                                     |
| ------ | ----------------------------------------------------------------------------------------- |
| **B5** | Freie Farbwerte (`#ffc571`, `#f6f2f2`, `#fbfbfb`, `#74687e`) als Tokens im `@theme`-Block |
| **B6** | `as`-Casts auf `event.target` durch `instanceof`-Guards ersetzen                          |
| **B7** | `loadHotel` verschluckt Fehler                                                            |
| **B8** | Screenshot im Repo – bewusst behalten (nur Entscheidung, kein Code)                       |
| **C1** | `ServiceRow` doppelt; Store-Typen gehören nicht in den Store                              |
| **C2** | `Booking`, `BookingPosition`, `BookingService` in der View doppeln `BookingRequest`       |
| **C3** | Union-Typ `RejectionCode` statt `code: string`, eine Texttabelle statt zweier `switch`    |

```text
 CLAUDE.md                                          |   4 +-
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |  14 +-
 src/router/router.ts                               |  12 +-
 src/shared/services/booking.service.spec.ts        |  12 ++
 src/shared/services/booking.service.ts             |  38 +----
 src/shared/state/bookingState.ts                   |  18 +--
 src/shared/types/booking.codes.ts                  |  34 ++++
 src/shared/types/booking.types.ts                  | 101 ++++++++++++
 src/shared/ui/modal.ts                             |   3 +-
 src/style.css                                      |   4 +
 src/views/BookingView/Booking.ts                   | 173 +++++++--------------
 src/views/BookingView/address.ts                   |  35 +----
 src/views/BookingView/breakfast.ts                 |  16 +-
 src/views/BookingView/messages.spec.ts             |  46 ++++++
 src/views/BookingView/messages.ts                  |  56 +++++++
 src/views/BookingView/room.interface.ts            |   5 +-
 src/views/BookingView/roomQuantity.ts              |   2 +-
 src/views/BookingView/services.spec.ts             |   3 +-
 src/views/BookingView/services.ts                  |  25 +--
 src/views/BookingView/summary.ts                   |   2 +-
 src/views/HomeView/Home.ts                         |  40 ++---
 src/views/LayoutViews/MainHeader.ts                |   5 +-
 22 files changed, 387 insertions(+), 261 deletions(-)
```

Die Commit-Message nennt nur einen Teil davon – Farb-Tokens, die `instanceof`-Guards im Router und der Fehlerfall von `loadHotel` tauchen in ihr nicht auf. Wer später per `git log --grep` nach „B7" oder „loadHotel" sucht, findet den Commit nicht. Hier hilft nur das Review-Dokument, in dem die Punkte abgehakt sind. Ein Commit, der sieben Review-Punkte erledigt, wäre als drei oder vier kleinere Commits leichter nachzuvollziehen gewesen.

## Die Änderungen im Detail

### 1. Datenbank-Codes als Union-Typ: `src/shared/types/booking.codes.ts`

Bisher war ein Ablehnungs-Code aus `create_booking` einfach ein `string`. Die View verzweigte per `switch` auf rohe Texte wie `'ausgebucht'` – und der Compiler konnte weder einen Tippfehler noch einen vergessenen Fall erkennen.

Die neue Datei legt die Codes als **Liste** an und leitet den Typ daraus ab:

```ts
/** Gründe aus `search_availability` (`unavailable_reason`), für Gäste per `mask_reason` vergröbert (E28). */
export const UNAVAILABLE_REASONS = ['nicht_buchbar', 'vergangenheit', 'ausserhalb_horizont', 'ausgebucht', 'kein_preis', 'zu_klein'] as const;

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

/** Codes aus `reject_booking` (E31): die Gründe der Verfügbarkeit plus die Prüfungen von `create_booking`. */
export const REJECTION_CODES = [
    ...UNAVAILABLE_REASONS,
    'ungueltiger_zeitraum',
    'kategorie_unbekannt',
    'ungueltige_belegung',
    'ungueltige_leistung',
    'leistung_unbekannt',
    'ungueltige_adresse',
] as const;

export type RejectionCode = (typeof REJECTION_CODES)[number];
```

Drei TypeScript-Techniken greifen hier ineinander:

- **`as const`** macht aus dem Array ein `readonly`-Tupel mit **Literal-Typen**. Ohne `as const` wäre der Typ `string[]` – mit ist er `readonly ['nicht_buchbar', 'vergangenheit', …]`.
- **`(typeof X)[number]`** fragt: „Welchen Typ hat ein beliebiges Element dieses Tupels?" Die Antwort ist die Union aller Literale: `'nicht_buchbar' | 'vergangenheit' | …`.
- **Spread in `REJECTION_CODES`** übernimmt die Verfügbarkeitsgründe. Jeder `UnavailableReason` ist damit automatisch auch ein `RejectionCode` – genau wie in der Datenbank, wo `create_booking` die Gründe aus `search_availability` weiterreicht.

Der Vorteil gegenüber einem von Hand geschriebenen Union-Typ: Liste und Typ können nicht auseinanderlaufen, und die Liste ist **zur Laufzeit** vorhanden. Das braucht man für die Prüffunktionen:

```ts
export function isUnavailableReason(value: string): value is UnavailableReason {
    return (UNAVAILABLE_REASONS as readonly string[]).includes(value);
}

export function isRejectionCode(value: string): value is RejectionCode {
    return (REJECTION_CODES as readonly string[]).includes(value);
}
```

Der Rückgabetyp `value is RejectionCode` macht daraus einen **Type Guard**: Nach `if (isRejectionCode(x))` weiß TypeScript, dass `x` ein `RejectionCode` ist. Der Cast `as readonly string[]` ist nötig, weil `includes` auf einem Tupel aus Literalen nur genau diese Literale als Argument annimmt – ein beliebiger `string` wäre ein Typfehler. Der Cast **weitet** den Typ (sicher), er verengt ihn nicht.

Der Kommentar am Kopf der Datei beschreibt das Prinzip dahinter:

```ts
/**
 * Aus der Datenbank kommen sie als beliebiger Text. Erst `isUnavailableReason()` bzw.
 * `isRejectionCode()` an der Grenze macht daraus den engen Typ; ab dort darf der Code
 * dem Typ vertrauen.
 */
```

**Prüfen an der Grenze** ist ein wichtiges Muster: Daten von außen (Datenbank, API, Formular) werden **einmal** an der Stelle geprüft, an der sie ins Programm kommen. Alles dahinter arbeitet mit dem engen Typ und muss nicht mehr misstrauisch sein.

### 2. Die Grenze: `booking.service.ts` und `buildRoomCards`

Im Service wird der Code aus `reject_booking` jetzt geprüft, bevor er weitergegeben wird:

```diff
 export type BookingRejection = {
-    /** Der Code aus `reject_booking` – für Gäste maskiert (`nicht_buchbar`, E28). */
-    code: string;
+    /** Der Code aus `reject_booking` – für Gäste maskiert (`nicht_buchbar`, E28). `null`: ein Code, den die Oberfläche (noch) nicht kennt. */
+    code: RejectionCode | null;
```

```diff
     return {
-        code: parsed.code,
+        code: isRejectionCode(parsed.code) ? parsed.code : null,
         date: typeof parsed.datum === 'string' ? parsed.datum : null,
```

Wichtig ist, was **nicht** passiert: Ein unbekannter Code wirft keinen Fehler und macht aus der Ablehnung keinen Absturz. Er wird zu `null` – die Ablehnung bleibt eine Ablehnung, nur ohne passenden Satz. Fügt jemand in der Datenbank einen neuen Code hinzu, bevor das Frontend nachzieht, sieht der Gast den allgemeinen Text statt einer kaputten Seite. Ein neuer Test hält genau das fest:

```ts
it('bleibt bei einem unbekannten Code eine Ablehnung – mit code null', async () => {
    rpc.mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'neu', details: JSON.stringify({ code: 'neuer_code', datum: null, room_type_id: null }) },
    });

    await expect(createBooking(request)).resolves.toEqual({
        ok: false,
        error: { code: null, date: null, roomTypeId: null, message: 'neu' },
    });
});
```

Dasselbe gilt für die Verfügbarkeitsgründe der Zimmerkarten in `Booking.ts`:

```diff
-                          unavailableReason: room.unavailable_reason,
+                          unavailableReason: room.unavailable_reason !== null && isUnavailableReason(room.unavailable_reason) ? room.unavailable_reason : null,
```

und im zugehörigen Typ in `room.interface.ts`:

```diff
-    unavailableReason: string | null;
+    /** `null` auch bei einem Grund, den die Oberfläche nicht kennt – dann zeigt sie den allgemeinen Satz. */
+    unavailableReason: UnavailableReason | null;
```

### 3. Texte als Tabelle: `src/views/BookingView/messages.ts`

Die beiden `switch`-Blöcke (`getRejectionMessage` mit 13 Fällen und `formatUnavailableReason` mit 7 Fällen) verschwinden aus `Booking.ts` – zusammen gut 50 Zeilen. An ihre Stelle treten zwei **Nachschlagetabellen**:

```ts
const UNAVAILABLE_REASON_TEXTS: Record<UnavailableReason, string> = {
    nicht_buchbar: 'Für diesen Zeitraum nicht buchbar.',
    vergangenheit: 'Der gewählte Zeitraum liegt in der Vergangenheit.',
    ausserhalb_horizont: 'Der gewählte Zeitraum liegt zu weit in der Zukunft.',
    ausgebucht: 'Für diesen Zeitraum ausgebucht.',
    kein_preis: 'Für diesen Zeitraum ist kein Preis hinterlegt.',
    zu_klein: 'Zu klein für die gewählte Belegung.',
};
```

Der Typ `Record<UnavailableReason, string>` ist der Kern des Ganzen: Er verlangt **für jeden** Wert der Union einen Eintrag. Kommt in `booking.codes.ts` ein neuer Grund dazu, meldet der Compiler hier sofort: _„Property 'neuer_grund' is missing"_. Bei einem `switch` mit `default` wäre der neue Code stillschweigend im allgemeinen Fall gelandet. Genau so beschreibt es der Dateikommentar: _„Fehlt für einen Code der Satz, ist das ein Compilerfehler – die Texte können nicht mehr auseinanderlaufen."_

Die Ablehnungstexte brauchen zusätzlich Kontext (Zimmername, Nacht). Die Tabelle enthält deshalb **Funktionen** statt fertiger Strings:

```ts
export type RejectionContext = {
    roomName: string | null;
    /** Die betroffene Nacht, z. B. „12.10.2026", oder `null`, wenn die Datenbank keine nennt. */
    night: string | null;
};

/** Die Verfügbarkeit hat sich zwischen Anzeige und Buchen geändert – derselbe Satz für alle vier Gründe. */
function noLongerBookable({ roomName, night }: RejectionContext): string {
    const nightText = night === null ? '' : ` für die Nacht vom ${night}`;
    return `${roomName ?? 'Ihre Auswahl'} ist${nightText} leider nicht mehr buchbar. Wir haben die Verfügbarkeit aktualisiert – bitte prüfen Sie Ihre Auswahl.`;
}

const REJECTION_MESSAGES: Record<RejectionCode, (context: RejectionContext) => string> = {
    nicht_buchbar: noLongerBookable,
    ausgebucht: noLongerBookable,
    kein_preis: noLongerBookable,
    zu_klein: noLongerBookable,
    vergangenheit: (): string => UNAVAILABLE_REASON_TEXTS.vergangenheit,
    ausserhalb_horizont: (): string => UNAVAILABLE_REASON_TEXTS.ausserhalb_horizont,
    ungueltiger_zeitraum: (): string => 'Die Abreise muss nach der Anreise liegen.',
    kategorie_unbekannt: ({ roomName }: RejectionContext): string => `${roomName ?? 'Diese Zimmerkategorie'} kann derzeit nicht gebucht werden.`,
    ungueltige_belegung: (): string => 'Die gewählten Zimmer passen nicht zur Anzahl der Gäste.',
    ungueltige_leistung: (): string => 'Die gewählten Zusatzleistungen können so nicht gebucht werden.',
    leistung_unbekannt: (): string => 'Die gewählten Zusatzleistungen können so nicht gebucht werden.',
    ungueltige_adresse: (): string => 'Bitte prüfen Sie Ihre Adresse – sie ist unvollständig oder das Land wird nicht unterstützt.',
};
```

Was im `switch` ein „Durchfallen" mehrerer `case`-Zeilen war, ist hier dieselbe Funktion `noLongerBookable` für vier Schlüssel. Und `vergangenheit` holt seinen Text aus der anderen Tabelle – Zimmerkarte und Ablehnung sagen garantiert dasselbe.

Die beiden öffentlichen Funktionen behandeln den `null`-Fall aus Abschnitt 2:

```ts
/** `null` heißt: ein Code, den die Oberfläche nicht kennt – dann der allgemeine Satz. */
export function formatUnavailableReason(reason: UnavailableReason | null): string {
    return reason === null ? UNAVAILABLE_REASON_TEXTS.nicht_buchbar : UNAVAILABLE_REASON_TEXTS[reason];
}

export function getRejectionMessage(code: RejectionCode | null, context: RejectionContext): string {
    if (code === null) return 'Die Buchung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.';
    return REJECTION_MESSAGES[code](context);
}
```

In der View bleibt nur übrig, was nur die View weiß – welcher Zimmername zu einer `roomTypeId` gehört und wie ein Datum formatiert wird:

```diff
-    private getRejectionMessage(error: BookingRejection): string {
-        const room = this.rooms.find((card: RoomCard): boolean => card.roomTypeId === error.roomTypeId)?.name ?? null;
-        const date = error.date === null ? null : formatStayDate(parseISODate(error.date), '', null);
-
-        switch (error.code) {
-            case 'nicht_buchbar':
-            case 'ausgebucht':
-            …
-            default:
-                return 'Die Buchung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.';
-        }
+    private getRejectionText(rejection: BookingRejection): string {
+        const roomName = this.rooms.find((card: RoomCard): boolean => card.roomTypeId === rejection.roomTypeId)?.name ?? null;
+        const night = rejection.date === null ? null : formatStayDate(parseISODate(rejection.date), '', null);
+        return getRejectionMessage(rejection.code, { roomName, night });
     }
```

Die Methode heißt jetzt `getRejectionText`, damit sie nicht mit der importierten Funktion `getRejectionMessage` verwechselt wird.

Damit das Muster auch für künftigen Code gilt, ergänzt der Commit die Namensregel in `CLAUDE.md` um einen Satz:

```markdown
Diese Datenbank-Codes stehen als Union-Typ mit Prüffunktion in `src/shared/types/booking.codes.ts` (`isRejectionCode`, `isUnavailableReason` an der Grenze), ihre Texte als `Record` in `src/views/BookingView/messages.ts` – kein `switch` auf rohe Strings.
```

### 4. Tests für die Texttabellen: `messages.spec.ts`

Weil die Texte jetzt in einer reinen Funktion ohne DOM stecken, lassen sie sich direkt testen. Ein Test ist besonders interessant, weil er über **alle** Codes läuft:

```ts
it('hat für jeden Code einen eigenen, nicht leeren Satz', () => {
    for (const code of REJECTION_CODES) expect(getRejectionMessage(code, noContext)).not.toBe('');
    for (const reason of UNAVAILABLE_REASONS) expect(formatUnavailableReason(reason)).not.toBe('');
});
```

Hier zahlt sich aus, dass die Codes als **Laufzeit-Liste** existieren und nicht nur als Typ: Der Test kann darüber iterieren. Ein reiner `type RejectionCode = 'a' | 'b'` wäre nach dem Kompilieren verschwunden.

Weitere Tests prüfen den vollständigen Satz mit Kontext, den Rückfall auf „Ihre Auswahl", den gemeinsamen Text von Zimmerkarte und Ablehnung sowie den `null`-Fall:

```ts
it('nimmt für Vergangenheit und Horizont denselben Satz wie die Zimmerkarte', () => {
    expect(getRejectionMessage('vergangenheit', noContext)).toBe(formatUnavailableReason('vergangenheit'));
    expect(getRejectionMessage('ausserhalb_horizont', noContext)).toBe(formatUnavailableReason('ausserhalb_horizont'));
});
```

### 5. Gemeinsame Typen: `src/shared/types/booking.types.ts` (C1, C2)

Vor diesem Commit gab es mehrere Kopien derselben Typen:

| Typ                                            | lag in                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| `ServiceRow`                                   | `breakfast.ts` **und** `services.ts` (unterschiedlich!) |
| `RoomQuantities`, `ServiceQuantities`          | `bookingState.ts` (Store)                               |
| `Customer`, `Address`, `CustomerDetails`       | `address.ts`                                            |
| `BookingRequest`, `BookingRequestAddress`      | `booking.service.ts`                                    |
| `Booking`, `BookingPosition`, `BookingService` | `Booking.ts` – Kopie von `BookingRequest`               |

Alles davon zieht in eine Datei. Der Kopfkommentar erklärt, **warum gerade dorthin**:

```ts
/**
 * Typen der Buchung, die Fachlogik (`src/views/BookingView/*.ts`) und Zustand
 * (`bookingState`) gemeinsam nutzen.
 *
 * Sie liegen hier statt im Store, damit die Abhängigkeit nur in eine Richtung läuft:
 * Fachlogik und Store importieren beide von hier, die Fachlogik aber nichts aus dem Store.
 */
```

Vorher importierte `roomQuantity.ts` – eine reine Rechenfunktion – ihren Typ aus `bookingState.ts`, dem globalen Zustand. Damit hing die Fachlogik vom Store ab, obwohl sie nur einen Typ brauchte. Jetzt zeigen beide auf eine neutrale dritte Datei:

```diff
-import type { RoomQuantities } from '../../shared/state/bookingState';
+import type { RoomQuantities } from '../../shared/types/booking.types';
```

Der Vertrag mit `create_booking` wird aus kleinen Bausteinen zusammengesetzt statt einmal am Stück:

```ts
/** Eine Zimmerkategorie mit Menge – die Form von `p_positions` in `create_booking` (E44). */
export type BookingPosition = {
    roomTypeId: string;
    rooms: number;
};

/** Eine Zusatzleistung je Vorgang – die Form von `p_services` in `create_booking` (E49). */
export type BookingServiceSelection = {
    code: string;
    quantity: number;
};

export type BookingRequest = CustomerDetails & {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    positions: readonly BookingPosition[];
    withBreakfast: boolean;
    services: readonly BookingServiceSelection[];
};
```

Und in der View wird der lokale Typ **abgeleitet** statt kopiert:

```diff
-type Booking = CustomerDetails & {
-    checkIn: string;
-    checkOut: string;
+/** Die Anfrage an `create_booking` plus die Nächte, die das Bestätigungs-Popup anzeigt. */
+type Booking = BookingRequest & {
     nights: number;
-    adults: number;
-    children: number;
-    positions: BookingPosition[];
-    withBreakfast: boolean;
-    services: BookingService[];
 };
```

Ändert sich `BookingRequest` (etwa ein neues Feld), ändert sich `Booking` automatisch mit. Vorher hätte man zwei Stellen anpassen müssen – und hätte die zweite womöglich vergessen.

**`ServiceRow` und `Pick`.** Die beiden `ServiceRow`-Versionen unterschieden sich: Die in `breakfast.ts` kannte nur die Felder, die das Frühstück braucht. Statt einer zweiten Definition wird jetzt ein **Ausschnitt** des gemeinsamen Typs gebildet:

```ts
import type { ServiceRow } from '../../shared/types/booking.types';

/** Die Felder der `services`-Zeile, die das Frühstück braucht – ein Ausschnitt, kein eigener Typ. */
type BreakfastServiceRow = Pick<ServiceRow, 'id' | 'name' | 'description' | 'amount_cents' | 'child_amount_cents' | 'currency'>;
```

`Pick<T, K>` ist ein eingebauter Utility-Typ, der aus `T` nur die Schlüssel `K` übernimmt. Benennt jemand in `ServiceRow` ein Feld um, schlägt `Pick` sofort fehl – zwei unabhängige Interfaces hätten das nicht bemerkt.

**Eine bewusste Aufweichung:** `Address.countryCode` ist im gemeinsamen Typ `string`, nicht mehr `CountryCode`:

```ts
/**
 * ISO-Code. Bewusst `string` statt der Länderliste: Welche Länder gültig sind, prüfen
 * `isCountryCode()` (Oberfläche) und `is_supported_country()` (Datenbank).
 */
countryCode: string;
```

Der Grund: Die gemeinsame Typdatei soll nichts aus `address.ts` (einer View-Datei) importieren – sonst liefe die Abhängigkeit wieder in die falsche Richtung. Die Folge zeigt sich in `getCountryLabel`, das jetzt jeden String annimmt:

```diff
-export function getCountryLabel(code: CountryCode): string {
+/** Unbekannte Codes erscheinen so, wie sie sind – ein Land ohne Namen ist besser als keins. */
+export function getCountryLabel(code: string): string {
```

Das vereinfacht nebenbei die Hoteladresse:

```diff
-        const country = hotel.country_code === null ? '' : isCountryCode(hotel.country_code) ? getCountryLabel(hotel.country_code) : hotel.country_code;
+        const country = hotel.country_code === null ? '' : getCountryLabel(hotel.country_code);
```

### 6. Type Guard statt Cast im Filter: `services.ts`

Auch in `buildExtraServices` stand ein Cast, den das Review (B6) ausdrücklich nannte:

```diff
+/** Eine Zeile, deren `charge_basis` schon geprüft ist – das Ergebnis des Filters in `buildExtraServices`. */
+type ExtraServiceRow = ServiceRow & { charge_basis: ExtraChargeBasis };
```

```diff
     return rows
-        .filter((row: ServiceRow): boolean => isExtraChargeBasis(row.charge_basis))
-        .sort((a: ServiceRow, b: ServiceRow): number => a.sort_order - b.sort_order)
+        .filter((row: ServiceRow): row is ExtraServiceRow => isExtraChargeBasis(row.charge_basis))
+        .sort((a: ExtraServiceRow, b: ExtraServiceRow): number => a.sort_order - b.sort_order)
         .map(
-            (row: ServiceRow): ExtraService => ({
+            (row: ExtraServiceRow): ExtraService => ({
                 …
-                chargeBasis: row.charge_basis as ExtraChargeBasis,
+                chargeBasis: row.charge_basis,
```

Ein Callback mit Rückgabetyp `boolean` filtert zwar die richtigen Zeilen heraus, aber der **Typ** des Arrays bleibt `ServiceRow[]` – TypeScript weiß nicht, was der Filter geprüft hat. Mit `row is ExtraServiceRow` wird der Callback zum Type Guard, und `Array.prototype.filter` hat eine Überladung, die dann `ExtraServiceRow[]` zurückgibt. Der Cast `as ExtraChargeBasis` weiter unten wird überflüssig.

### 7. `instanceof` statt `as` bei `event.target` (B6)

`event.target` hat den Typ `EventTarget | null`. Der bisherige Code schrieb überall `event.target as HTMLElement` – eine **Behauptung**, die TypeScript ungeprüft glaubt. Und sie war tatsächlich manchmal falsch: Ein Klick auf ein SVG-Icon trifft ein `SVGElement`, kein `HTMLElement`.

```diff
     private handleRoomsClick(event: MouseEvent): void {
-        const target = event.target as HTMLElement;
+        // `Element` statt `HTMLElement`: Ein Klick auf ein Icon trifft ein SVG-Element.
+        const target = event.target;
+        if (!(target instanceof Element)) return;
```

`instanceof` prüft zur Laufzeit **und** verengt den Typ für den Compiler. `Element` ist die gemeinsame Basisklasse von `HTMLElement` und `SVGElement` und hat `closest()` – mehr braucht der Handler nicht.

Wo ein bestimmter Elementtyp gebraucht wird, prüft der Guard genau diesen:

```diff
         form.addEventListener('change', (event: Event): void => {
-            const target = event.target as HTMLElement;
-            if (!target.hasAttribute('data-billing-toggle')) return;
+            const target = event.target;
+            if (!(target instanceof HTMLInputElement) || !target.hasAttribute('data-billing-toggle')) return;

             const billingEl = document.getElementById('booking-billing');
-            if (billingEl) billingEl.hidden = !(target as HTMLInputElement).checked;
+            if (billingEl) billingEl.hidden = !target.checked;
```

Der zweite Cast `(target as HTMLInputElement)` entfällt, weil TypeScript nach der Prüfung weiß, dass `target` ein Input ist.

**Im Router wird dabei ein echter Bug behoben** – die Commit-Message erwähnt ihn nicht:

```diff
     private async handleLinkClick(event: MouseEvent): Promise<void> {
-        if ((event.target as HTMLElement).matches('a[data-link]')) {
-            event.preventDefault();
-            await this.navigateTo((event.target as HTMLAnchorElement).href);
-        }
+        if (!(event.target instanceof Element)) return;
+        // `closest` statt `matches`: Ein Klick auf ein Kind des Links (z. B. das Logo-`<img>`)
+        // soll ebenfalls über den Router laufen statt die Seite neu zu laden.
+        const link = event.target.closest('a[data-link]');
+        if (!(link instanceof HTMLAnchorElement)) return;
+
+        event.preventDefault();
+        await this.navigateTo(link.href);
     }
```

`matches()` prüft nur das angeklickte Element **selbst**. Steckt im Link ein `<img>` (wie beim Logo), ist `event.target` das Bild – `matches('a[data-link]')` ist `false`, der Router greift nicht ein, und der Browser lädt die Seite komplett neu. `closest()` sucht dagegen vom Element **aufwärts** bis zum nächsten passenden Vorfahren. Dieselbe Umstellung bekommen `modal.ts` und `MainHeader.ts`.

### 8. Farb-Tokens statt freier Hex-Werte (B5)

In `src/style.css` kommen vier Farben in den `@theme`-Block:

```css
--color-golden-wind: #ffc571;
--color-surface: #fbfbfb;
--color-surface-muted: #f6f2f2;
--color-muted: #74687e;
```

Tailwind v4 erzeugt aus jeder `--color-*`-Variable automatisch Utilities wie `bg-surface` oder `text-muted`. Die willkürlichen Werte im Markup werden ersetzt:

```diff
-<form id="booking-customer" novalidate class="… bg-[#fbfbfb] px-5 py-4">
+<form id="booking-customer" novalidate class="… bg-surface px-5 py-4">
```

```diff
-<p class="font-antic-didone text-14 leading-tight text-[#74687e]">Ich bestätige, …</p>
+<p class="font-antic-didone text-14 leading-tight text-muted">Ich bestätige, …</p>
```

Die Namen beschreiben die **Rolle** (`surface`, `muted`), nicht den Farbton – nur `golden-wind` ist ein Eigenname aus dem Design, weil die Farbe als Akzent genau einmal vorkommt. Ändert das Design einmal den Hintergrund aller Karten, reicht eine Zeile im `@theme`.

In `Home.ts` erhalten die Ausstattungs-Icons dabei `fill="currentColor"` statt einer fest eingetragenen Farbe:

```diff
-<svg xmlns="http://www.w3.org/2000/svg" width="39" height="35" viewBox="0 0 39 35" fill="none">
-    <path d="…" fill="#642360"/>
+<svg xmlns="http://www.w3.org/2000/svg" width="39" height="35" viewBox="0 0 39 35" fill="none" class="text-purple-haze" aria-hidden="true">
+    <path d="…" fill="currentColor"/>
```

`currentColor` übernimmt die Textfarbe des Elements – gesetzt per Tailwind-Klasse `text-purple-haze`. Die Farbe kommt damit aus dem Theme statt aus 16 einzelnen `<path>`-Attributen. `aria-hidden="true"` sagt Screenreadern, dass das Icon reine Dekoration ist; der Text daneben („King-size Bett") trägt die Information.

### 9. `loadHotel` meldet Fehler (B7)

Vorher endete ein Fehler beim Laden der Hoteldaten in einem stillen `return`:

```diff
-        if (error || !this.isDisplayed()) return;
-
+        if (!this.isDisplayed()) return;
+
+        if (error) {
+            console.error('Hoteldaten konnten nicht geladen werden:', error);
+            this.hotelError = HOTEL_LOAD_ERROR;
+        } else if (data === null) {
+            // Kein Fehler der Abfrage, aber auch kein Hotel – ein Fehler in den Stammdaten (E14).
+            console.error('In der Tabelle `hotels` ist kein Hotel hinterlegt.');
+            this.hotelError = HOTEL_LOAD_ERROR;
+        } else {
+            this.hotelError = null;
+        }
         this.hotel = data;
         this.renderSummary();
```

Zwei Zielgruppen, zwei Kanäle: Die **Entwicklerin** bekommt die technischen Details in der Konsole, der **Gast** einen verständlichen Satz in der Zusammenfassung:

```ts
const HOTEL_LOAD_ERROR = 'Hoteladresse und Check-in-Zeiten konnten gerade nicht geladen werden. Ihre Buchung ist davon nicht betroffen.';
```

Bemerkenswert ist der zweite Fall: `maybeSingle()` liefert `data === null` **ohne** Fehler, wenn die Tabelle leer ist. Technisch ist das kein Fehler der Abfrage – fachlich schon, denn laut `E14` gibt es genau ein Hotel. Ohne diesen Zweig wäre auch dieser Fall still geblieben.

## Was wurde erreicht?

Ablehnungs- und Verfügbarkeitsgründe sind jetzt typsicher von der Datenbank bis zum Text: einmal geprüft an der Grenze, danach ein enger Union-Typ, und für jeden Code erzwingt der Compiler einen Satz. Die Buchungstypen existieren je genau einmal, und die Fachlogik hängt nicht mehr vom Store ab. Nebenbei verschwinden die `as`-Casts auf Event-Targets – und mit ihnen ein echter Router-Bug bei Klicks auf das Logo.

| Technik                           | Wozu                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `as const` + `(typeof X)[number]` | Liste und Union-Typ aus einer Quelle, Liste auch zur Laufzeit |
| Type Guard (`value is T`)         | Daten von außen einmal an der Grenze prüfen                   |
| Unbekannt → `null` statt Fehler   | neue Datenbank-Codes brechen die Oberfläche nicht             |
| `Record<Union, …>` statt `switch` | fehlender Text ist ein Compilerfehler                         |
| Gemeinsame Typdatei               | Abhängigkeiten laufen in eine Richtung, keine Kopien          |
| `Pick` / Intersection (`&`)       | Typen ableiten statt duplizieren                              |
| `instanceof` statt `as`           | Laufzeitprüfung statt ungeprüfter Behauptung                  |
| `closest` statt `matches`         | Klicks auf Kinder eines Links werden mit erfasst              |
| Theme-Tokens, `currentColor`      | Farben an einer Stelle, nach Rolle benannt                    |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](023_2026-10-07_room-quantity-handling-availability-messages.md)
