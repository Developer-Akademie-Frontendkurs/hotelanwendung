[← Vorheriger Commit](016_2026-09-30_review-document.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): enhance booking error handling and UI flow

- **Commit:** `7054e4c`
- **Datum:** 2026-09-30
- **Autor:** Oliver Jung

## Worum geht es?

Der erste Commit nach dem Review behebt die beiden **gefährlichsten** Punkte aus Gruppe A – beide mit derselben Folge: Ein Gast bucht, ohne es zu wollen, oder er bucht doppelt.

| Punkt  | Problem                                                                 | Folge                                     |
| ------ | ----------------------------------------------------------------------- | ----------------------------------------- |
| **A1** | Der Knopf „weiter" unter dem Kalender ruft `submit()` auf               | Ein Klick auf „weiter" bucht verbindlich  |
| **A2** | Jeder Fehler aus `create_booking` wird zu `{ ok: false }`               | Ein Netzwerkfehler sieht aus wie „nicht gebucht" – der Gast versucht es erneut |

```text
 CLAUDE.md                                          |  2 -
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |  4 +-
 src/shared/services/booking.service.spec.ts        | 75 ++++++++++++++++++++++
 src/shared/services/booking.service.ts             | 52 +++++++++++----
 src/shared/ui/scroll.ts                            | 11 ++++
 src/views/BookingView/Booking.ts                   | 33 ++++++----
 src/views/LayoutViews/MainHeader.ts                |  9 +--
 7 files changed, 154 insertions(+), 32 deletions(-)
```

Nebenbei verschwindet das versehentliche `<script></script>` aus `CLAUDE.md` (siehe Commit 016).

## Die Änderungen im Detail

### 1. A1 – „weiter" heißt jetzt wirklich „weiter"

Unter dem Kalender steht ein Knopf **weiter**. Er stammt aus der Zeit, als die Buchung mehrere Seiten hatte, und war mit `data-action="submit"` an `submit()` gebunden. Solange `submit()` nur `console.log` machte, war das harmlos. Seit Commit 012 ruft `submit()` aber `createBooking()` auf – damit wurde aus „weiter" ein **zweiter, unbeschrifteter Buchen-Knopf**.

```diff
     private getFooterHtml(): string {
         const { checkIn, checkOut } = bookingState.getDates();
-        const canSubmit = checkIn !== null && checkOut !== null && this.guests.adults !== null;
+        const canContinue = checkIn !== null && checkOut !== null && this.guests.adults !== null;
         return /*html*/ `
             <div class="flex justify-center mt-8 768:mt-10">
                 <button
                     type="button"
-                    data-action="submit"
-                    ${canSubmit ? '' : 'disabled'}
+                    data-action="next-step"
+                    ${canContinue ? '' : 'disabled'}
```

```diff
-                case 'submit':
-                    void this.submit();
+                case 'next-step':
+                    // Nur weiter zur Zimmerauswahl – gebucht wird ausschließlich über
+                    // `[data-action="checkout"]` in der Zusammenfassung.
+                    scrollToSection('booking-rooms');
                     return;
```

Die Lehre ist allgemeiner als der Fehler: **Ein Aktionsname beschreibt eine Absicht.** `submit` war ein Name aus einer Zeit, in der „weiter" tatsächlich „absenden" bedeutete. Als sich die Bedeutung von `submit()` änderte, hat niemand nachgesehen, wer es noch aufruft. Mit `next-step` sagt der Name jetzt, was der Knopf tut – und kein Name im Code verweist mehr auf das Buchen außer `checkout`.

### 2. Gemeinsame Scroll-Funktion: `src/shared/ui/scroll.ts`

Zum Scrollen gab es seit Commit 014 schon Code im Header (`handleStepClick`). Statt ihn für den „weiter"-Knopf zu kopieren, wird er in eine eigene Datei gezogen:

```ts
/**
 * Scrollt zu einem Abschnitt der Seite, sanft nur ohne `prefers-reduced-motion`.
 * Den Abstand zum Sticky-Header regelt `scroll-mt-*` am Ziel.
 */
export function scrollToSection(targetId: string): void {
    const target = document.getElementById(targetId);
    if (!target) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}
```

Der Header nutzt sie jetzt auch:

```diff
         event.preventDefault();
-        const target = document.getElementById(link.dataset.stepTarget ?? '');
-        if (!target) return;
-
-        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
-        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
+        scrollToSection(link.dataset.stepTarget ?? '');
```

Die Regel dahinter heißt oft „Rule of Three" – einmal schreiben, beim zweiten Mal kopieren, beim dritten Mal extrahieren. Hier wird schon beim **zweiten** Mal extrahiert, und das ist gerechtfertigt: Die Barrierefreiheitsregel (`prefers-reduced-motion`) soll an beiden Stellen gleich gelten. Bei einer Kopie würde sie früher oder später an einer Stelle vergessen.

### 3. A2 – Ablehnung oder Fehler? `booking.service.ts`

Das ist der inhaltlich wichtigste Teil. `create_booking` kann auf drei grundverschiedene Arten „nicht klappen":

| Fall                                              | Woran erkennbar                             | Ist gebucht?          |
| ------------------------------------------------- | ------------------------------------------- | --------------------- |
| **Ablehnung** (ausgebucht, ungültige Adresse …)   | SQLSTATE `P0001` + `DETAIL`-JSON            | sicher **nein**       |
| **Datenbankfehler** (z. B. E-Mail fehlt)          | ein anderer SQLSTATE, z. B. `22023`         | sicher **nein** (Rollback) |
| **Infrastrukturfehler** (Netz, Timeout, Gateway)  | **kein** `code`                             | **unbekannt**         |

Der dritte Fall ist der gefährliche: Die Anfrage kann bei der Datenbank angekommen und committet worden sein, nur die Antwort ist unterwegs verloren gegangen. Bisher wurde er wie eine Ablehnung behandelt – der Gast sah „nicht gebucht" und klickte noch einmal. Ergebnis: **Doppelbuchung**.

#### Eine eigene Fehlerklasse

```ts
/**
 * `create_booking` ist nicht mit einer Ablehnung beantwortet worden.
 *
 * `outcomeUnknown` sagt, ob die Buchung trotzdem angelegt sein kann: Kam keine Antwort
 * der Datenbank an (Netzwerk, Zeitüberschreitung, Gateway), kann der Commit durch sein.
 * Ein erneuter Versuch hieße dann Doppelbuchung. Antwortet dagegen die Datenbank mit
 * einem Fehlercode, ist die Transaktion zurückgerollt – es ist sicher nichts gebucht.
 */
export class BookingFailedError extends Error {
    readonly outcomeUnknown: boolean;

    constructor(message: string, outcomeUnknown: boolean) {
        super(message);
        this.name = 'BookingFailedError';
        this.outcomeUnknown = outcomeUnknown;
    }
}
```

Eine eigene Klasse, die von `Error` erbt, hat zwei Vorteile: Der Aufrufer kann mit `instanceof BookingFailedError` gezielt prüfen, und die Klasse kann **zusätzliche Information** tragen – hier das Flag `outcomeUnknown`. Ein nacktes `throw new Error('…')` könnte das nur über den Meldungstext, und Text auszuwerten ist zerbrechlich.

#### Die Unterscheidung im Service

```diff
     const { data, error } = response;
     if (error) {
-        return { ok: false, error: parseRejection(error.message, error.details) };
+        const rejection = error.code === REJECTION_SQLSTATE ? parseRejection(error.message, error.details) : null;
+        if (rejection !== null) return { ok: false, error: rejection };
+
+        // Ohne `code` stammt der Fehler nicht aus Postgres/PostgREST: postgrest-js meldet
+        // einen gescheiterten `fetch` mit leerem `code`, ein Gateway-Fehler kommt als
+        // reiner Text. Ob die Datenbank committet hat, weiß dann niemand.
+        const outcomeUnknown = error.code === undefined || error.code === '';
+        throw new BookingFailedError(`create_booking fehlgeschlagen: ${error.message}`, outcomeUnknown);
     }
```

```ts
/** Der SQLSTATE, mit dem `reject_booking` wirft. */
const REJECTION_SQLSTATE = 'P0001';
```

Nur wenn **beides** stimmt – SQLSTATE `P0001` **und** ein lesbares `DETAIL`-JSON mit `code` –, ist es eine Ablehnung. `parseRejection` gibt deshalb jetzt `null` zurück statt eines Platzhalters mit Code `unbekannt`:

```diff
-function parseRejection(message: string, details: string | null | undefined): BookingRejection {
-    const fallback: BookingRejection = { code: 'unbekannt', date: null, roomTypeId: null, message };
-    if (!details) return fallback;
+function parseRejection(message: string, details: string | null | undefined): BookingRejection | null {
+    if (!details) return null;
```

Das ist der Kern von **`V15`** aus dem Umsetzungsplan: _„Ablehnung als Ergebnis, Infrastrukturfehler werfen."_ Eine Ablehnung ist ein **erwartetes** Ergebnis, mit dem die Oberfläche etwas Sinnvolles tun kann (Verfügbarkeit neu laden). Ein Infrastrukturfehler ist eine **Ausnahme** – und gehört deshalb in den `catch`-Zweig, nicht in den Rückgabewert.

Auch die unlesbare Erfolgsantwort wirft jetzt die neue Klasse – mit `outcomeUnknown: true`, denn die Datenbank hat ja geantwortet, dass alles geklappt hat:

```diff
-        throw new Error('create_booking hat eine unerwartete Antwort geliefert.');
+        throw new BookingFailedError('create_booking hat eine unerwartete Antwort geliefert.', true);
```

### 4. Die Oberfläche reagiert je nach Fall

```diff
-        } catch {
-            // Nur bei einer unlesbaren Antwort – die Buchung kann trotzdem angelegt sein.
-            // Deshalb kein „bitte erneut versuchen" und der Knopf bleibt gesperrt.
-            this.showCheckoutError('Bei der Buchung ist ein unerwarteter Fehler aufgetreten. Bitte buchen Sie nicht erneut, sondern kontaktieren Sie uns.');
+        } catch (error: unknown) {
+            console.error(error);
+            // Ist nicht sicher, dass nichts gebucht wurde (V15), bleibt der Knopf gesperrt –
+            // ein zweiter Versuch könnte doppelt buchen.
+            if (!(error instanceof BookingFailedError) || error.outcomeUnknown) {
+                this.showCheckoutError(BOOKING_OUTCOME_UNKNOWN);
+                return;
+            }
+            this.setSubmitting(false);
+            this.showCheckoutError('Die Buchung ist aus technischen Gründen nicht zustande gekommen. Bitte versuchen Sie es in einigen Minuten erneut.');
             return;
         }
```

```ts
/** Die Buchung kann angelegt sein – deshalb ausdrücklich kein „bitte erneut versuchen". */
const BOOKING_OUTCOME_UNKNOWN = 'Wir konnten nicht feststellen, ob Ihre Buchung angelegt wurde. Bitte buchen Sie nicht erneut, sondern kontaktieren Sie uns.';
```

Zwei Details lohnen den Blick:

- `catch (error: unknown)` – in TypeScript ist der Typ eines gefangenen Fehlers immer `unknown`, denn geworfen werden kann alles. Erst `instanceof` macht daraus etwas, auf dessen Eigenschaften man zugreifen darf.
- Die Bedingung ist **vorsichtig formuliert**: Nur wenn es nachweislich ein `BookingFailedError` mit `outcomeUnknown === false` ist, wird der Knopf wieder freigegeben. Jeder andere Fehler – auch ein unerwarteter Programmierfehler – wird so behandelt, als könnte gebucht worden sein. Im Zweifel lieber einen Anruf beim Hotel als eine Doppelbuchung.

### 5. Die ersten Service-Tests: `booking.service.spec.ts`

Der Service spricht mit Supabase – wie testet man ihn ohne Datenbank? Mit einem **Mock**:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabase', () => ({ supabase: { rpc } }));

const { BookingFailedError, createBooking } = await import('./booking.service');
```

`vi.mock` ersetzt das Modul `./supabase` durch ein Objekt, dessen `rpc` eine steuerbare Attrappe (`vi.fn()`) ist. Der Service wird **danach** per `await import(…)` geladen, damit er garantiert die Attrappe bekommt. In jedem Test legt `rpc.mockResolvedValue(…)` fest, was „die Datenbank" antwortet:

```ts
it('wirft bei einem Netzwerkfehler – das Ergebnis ist unbekannt', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '', message: 'TypeError: Failed to fetch', details: '' }, status: 0 });

    expect((await failure()).outcomeUnknown).toBe(true);
});

it('wirft bei einem Datenbankfehler ohne Ablehnung – sicher nichts gebucht', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'E-Mail-Adresse fehlt oder ist ungueltig', details: null }, status: 400 });

    expect((await failure()).outcomeUnknown).toBe(false);
});
```

Die sechs Tests decken genau die Tabelle aus Abschnitt 3 ab: echte Ablehnung, Netzwerkfehler, Gateway-Fehler ohne Code, Datenbankfehler, `P0001` ohne lesbares `DETAIL` und unlesbare Erfolgsantwort. Die Hilfsfunktion `failure()` fängt den geworfenen Fehler ein und prüft, dass es wirklich ein `BookingFailedError` ist:

```ts
async function failure(): Promise<InstanceType<typeof BookingFailedError>> {
    const error: unknown = await createBooking(request).catch((thrown: unknown): unknown => thrown);
    if (!(error instanceof BookingFailedError)) throw new Error('BookingFailedError erwartet');
    return error;
}
```

### 6. Das Review-Dokument wird abgehakt

```diff
-- [ ] **A1: Der Knopf „weiter“ im Kalender bucht verbindlich.**
+- [x] **A1: Der Knopf „weiter“ im Kalender bucht verbindlich.**
 …
-- [ ] **A2: Netzwerkfehler sehen aus wie Ablehnungen, das kann zu Doppelbuchungen führen.**
+- [x] **A2: Netzwerkfehler sehen aus wie Ablehnungen, das kann zu Doppelbuchungen führen.**
```

## Was wurde erreicht?

Die zwei Wege zu einer ungewollten Buchung sind geschlossen. „weiter" scrollt nur noch, und ein Fehler, bei dem unklar ist, ob gebucht wurde, sperrt den Knopf und rät ausdrücklich vom erneuten Buchen ab.

| Technik                                    | Wozu                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Sprechender Aktionsname (`next-step`)      | der Name im Markup verrät, was der Knopf tut                      |
| Eigene Fehlerklasse mit Zusatzfeld         | Fehlerart per `instanceof` und Flag statt über Meldungstext        |
| SQLSTATE `P0001` als Erkennungsmerkmal     | Ablehnung sauber von allen anderen Fehlern trennen                |
| Defensive Bedingung im `catch`             | im Zweifel „vielleicht gebucht" annehmen                          |
| `vi.mock` + dynamischer `import`           | Service ohne echte Datenbank testen                               |
| Gemeinsame Hilfsfunktion `scrollToSection` | Barrierefreiheitsregel an genau einer Stelle                      |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](018_2026-10-07_escape-html-xss-protection.md)
