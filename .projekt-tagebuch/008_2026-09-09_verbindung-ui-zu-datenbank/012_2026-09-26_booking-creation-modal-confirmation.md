[← Vorheriger Commit](011_2026-09-26_booking-summary-dynamic-pricing.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): integrate booking creation and error handling with modal confirmation

- **Commit:** `bb243ce`
- **Datum:** 2026-09-26
- **Autor:** Oliver Jung

## Worum geht es?

Der Moment, auf den der ganze Branch hingearbeitet hat: **Der Knopf „zahlungspflichtig buchen" bucht.** Bis hierher endete `submit()` in einem `console.log` – eine der zehn Lücken aus der Bestandsaufnahme von Commit 001. Jetzt ruft er `create_booking` auf, wertet Ablehnungen aus und zeigt bei Erfolg ein Bestätigungs-Popup.

```text
 src/shared/services/booking.service.ts | 185 +++++++++++++++++++++++++++++++++
 src/shared/ui/modal.ts                 |  50 +++++++++
 src/views/BookingView/Booking.ts       | 180 +++++++++++++++++++++++++-------
 3 files changed, 376 insertions(+), 39 deletions(-)
```

Auffällig: Beide neuen Dateien liegen unter `src/shared/` – die erste **Service-Datei** für Schreibzugriffe (`booking.service.ts`) und die erste **wiederverwendbare UI-Komponente** (`modal.ts`) des Projekts. Beides hatte der Umsetzungsplan mit `V9` (Service-Schicht) und `V16` (Popup) angekündigt.

Der letzte fachliche TODO-Punkt aus Commit 003 verschwindet:

```diff
     *** Vorbereitung und Verknüpfung BookingView zu Datenbank ***
         TODO: Buchungssteps verknüpfen
         TODO: Migrations notwending? Eventuelle Änderungen an der Datenbank?
-        TODO: Integration Datenbank Buchungspeichern
 */
```

## Die Änderungen im Detail

### 1. `booking.service.ts`: Ergebnis statt Exception

Die Datei beginnt mit einer Designentscheidung, die man sich merken sollte:

```ts
/**
 * Buchen über `create_booking` (Phase 9b, Punkt 8; V9, V15).
 *
 * Anders als die Lesezugriffe **wirft** diese Funktion bei einer Ablehnung nicht: Eine
 * ausgebuchte Nacht ist ein erwartetes Ergebnis, kein Ausnahmefall. Die Oberfläche
 * bekommt stattdessen `{ ok: false, error }` mit Code, Datum und Kategorie aus dem
 * `DETAIL`-JSON von `reject_booking` (E31).
 */
```

Der Rückgabetyp ist eine **Discriminated Union**:

```ts
export type CreateBookingResult = { ok: true; data: CreatedBooking } | { ok: false; error: BookingRejection };
```

Das Feld `ok` ist der **Diskriminator**. Prüft der Aufrufer `if (!result.ok)`, weiß TypeScript im `if`-Zweig, dass es `result.error` gibt, und danach, dass es `result.data` gibt. Man kann nicht versehentlich auf `data` zugreifen, ohne vorher den Fehlerfall behandelt zu haben.

Die Unterscheidung „erwartet vs. unerwartet" ist die eigentliche Lektion: **Exceptions sind für Dinge, mit denen niemand rechnet.** Dass ein Zimmer gerade von jemand anderem gebucht wurde, ist in einem Hotelsystem Alltag.

#### Die Übersetzung in `p_*`-Parameter

Die Service-Funktion nimmt ein Objekt in **camelCase** entgegen und übersetzt es in die Parameternamen der Datenbank:

```ts
/** Was `create_booking` braucht – camelCase, die Übersetzung in `p_*` passiert hier. */
export type BookingRequest = {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    positions: readonly { roomTypeId: string; rooms: number }[];
    withBreakfast: boolean;
    services: readonly { code: string; quantity: number }[];
    customer: { firstName: string; lastName: string; email: string; phone: string | null };
    residence: BookingRequestAddress;
    /** `null` heißt: Rechnung an die Sitzadresse. */
    billing: (BookingRequestAddress & { company: string | null }) | null;
};
```

```ts
const response: { data: unknown; error: { message: string; details: string | null } | null } = await supabase.rpc('create_booking', {
    p_check_in: request.checkIn,
    p_check_out: request.checkOut,
    p_positions: request.positions.map((position) => ({
        room_type_id: position.roomTypeId,
        rooms: position.rooms,
    })),
    p_adults: request.adults,
    // …
    p_street: request.residence.street,
    // …
    // Ohne Rechnungsadresse bleiben die Parameter ganz weg: Schon ein einzelnes
    // gesetztes Feld hieße für `create_booking` „halbe Rechnungsadresse" (E51).
    ...(billing === null
        ? {}
        : {
              p_billing_company: billing.company,
              p_billing_street: billing.street,
              // …
          }),
});
```

Zwei Techniken:

- **Konditionaler Spread** `...(bedingung ? {} : { … })` fügt Felder nur unter einer Bedingung hinzu. Hier ist das fachlich wichtig: Die Datenbank prüft „alles oder nichts" – ein mitgeschicktes `p_billing_company: null` wäre harmlos, aber ein leerer String nicht. Also lieber gar nichts schicken.
- **`data: unknown`** statt dem `any`, das der untypisierte Client liefern würde. Der Kommentar sagt warum: _„Ohne generierte Typen (V8 steht noch aus) ist `data` hier `any` – als `unknown` gelesen, prüft `parseCreatedBooking()` die Form selbst."_

#### Laufzeitprüfung der Antwort

```ts
/**
 * Schmale Laufzeitprüfung des Ergebnisses: `create_booking` liefert `jsonb`, und dafür
 * gibt es keinen Typ, dem man trauen könnte (E44). Geprüft wird nur, was die Oberfläche
 * liest.
 */
function parseCreatedBooking(data: unknown): CreatedBooking | null {
    if (!isRecord(data) || !Array.isArray(data.bookings)) return null;
    const groupId = data.booking_group_id;
    if (groupId !== null && typeof groupId !== 'string') return null;
    if (typeof data.nights !== 'number' || typeof data.grand_total_cents !== 'number') return null;
    // … jede Zeile in `bookings` ebenso prüfen …
    return { bookingGroupId: groupId, bookings, nights: data.nights, grandTotalCents: data.grand_total_cents };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

Das ist ein Grundprinzip im Umgang mit externen Daten: **TypeScript-Typen existieren zur Laufzeit nicht.** Eine Typannotation `as CreatedBooking` wäre nur eine Behauptung. `unknown` zwingt dazu, jede Eigenschaft mit `typeof` zu prüfen, bevor man sie benutzt. (Bibliotheken wie Zod automatisieren das – hier reicht die schmale Handprüfung, weil „nur geprüft wird, was die Oberfläche liest".)

`typeof null === 'object'` ist übrigens eine berühmte JavaScript-Eigenheit – deshalb das zusätzliche `value !== null` in `isRecord`.

#### Der gefährlichste Fall: gebucht, aber Antwort unlesbar

```ts
const created = parseCreatedBooking(data);
if (created === null) {
    // Die Buchung ist angelegt, nur die Antwort hat eine unerwartete Form. Das ist
    // ein Programmierfehler, keine Ablehnung – und darf nicht als „nicht gebucht"
    // beim Gast ankommen, sonst bucht er ein zweites Mal.
    throw new Error('create_booking hat eine unerwartete Antwort geliefert.');
}
```

Hier – und nur hier – wirft die Funktion. Der Kommentar denkt eine Konsequenz zu Ende, die leicht übersehen wird: Würde dieser Fall als `{ ok: false }` gemeldet, sähe der Gast „Buchung fehlgeschlagen", klickte noch einmal – und hätte zwei Buchungen.

#### Ablehnungen lesen

```ts
/**
 * Liest das `DETAIL`-JSON von `reject_booking`. Andere Fehler (E-Mail fehlt, Netzwerk)
 * haben keins – dann bleibt der Code `unbekannt` und die Meldung, was sie ist.
 */
function parseRejection(message: string, details: string | null | undefined): BookingRejection {
    const fallback: BookingRejection = { code: 'unbekannt', date: null, roomTypeId: null, message };
    if (!details) return fallback;

    let parsed: unknown;
    try {
        parsed = JSON.parse(details);
    } catch {
        return fallback;
    }
    if (!isRecord(parsed) || typeof parsed.code !== 'string') return fallback;

    return {
        code: parsed.code,
        date: typeof parsed.datum === 'string' ? parsed.datum : null,
        roomTypeId: typeof parsed.room_type_id === 'string' ? parsed.room_type_id : null,
        message: typeof parsed.grund === 'string' ? parsed.grund : message,
    };
}
```

Hier schließt sich ein Kreis aus Branch 006: Dort wurde `reject_booking` so gebaut, dass es neben der lesbaren Meldung ein **maschinenlesbares JSON** im `DETAIL`-Feld der PostgreSQL-Exception mitschickt (`E31`). Erst jetzt, zwei Branches später, wird es zum ersten Mal ausgelesen.

### 2. `modal.ts`: ein Popup mit `<dialog>`

```ts
/**
 * Modales Popup über `<dialog>` und `showModal()` (V16, Q17).
 *
 * Fokusfang, Hintergrundsperre und Escape gibt es damit vom Browser. Das Popup kennt
 * **genau einen Ausgang**: Escape, ein Klick auf den Hintergrund und jedes Element mit
 * `data-modal-close` rufen alle dasselbe `onClose` – es gibt keinen Weg, der nur schließt
 * und etwas anderes tut.
 */
export function openModal(options: ModalOptions): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', options.labelledBy);
    dialog.className = 'm-auto w-[calc(100%-2rem)] max-w-[35rem] … backdrop:bg-purple-haze-dark/60';
    // Der Innenabstand sitzt am Wrapper, nicht am Dialog: sonst träfe ein Klick in den
    // Rand ebenfalls den Dialog selbst und zählte als Klick auf den Hintergrund.
    dialog.innerHTML = /*html*/ `<div class="p-6 768:p-10">${options.html}</div>`;

    let closed = false;
    const close = (): void => {
        // Escape und Klick können beide feuern, bevor der Dialog weg ist.
        if (closed) return;
        closed = true;
        dialog.close();
        dialog.remove();
        options.onClose();
    };

    // Escape: Der Browser würde den Dialog nur schließen – hier läuft er in denselben Ausgang.
    dialog.addEventListener('cancel', (event: Event): void => {
        event.preventDefault();
        close();
    });
    dialog.addEventListener('click', (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        // Ein Klick auf den Hintergrund trifft den Dialog selbst, nicht seinen Inhalt.
        if (target === dialog || target.closest('[data-modal-close]') !== null) close();
    });

    document.body.append(dialog);
    dialog.showModal();
    return dialog;
}
```

Das native **`<dialog>`-Element** ist eine der größten Erleichterungen im modernen HTML. Mit `showModal()` bekommt man kostenlos, wofür früher eigene Bibliotheken nötig waren:

- **Fokusfang** – Tab bleibt innerhalb des Dialogs,
- **Hintergrundsperre** – der Rest der Seite ist nicht klickbar (`inert`),
- **Escape** schließt – über das `cancel`-Ereignis,
- **`::backdrop`** – das Pseudo-Element für den abgedunkelten Hintergrund, in Tailwind über `backdrop:` stylbar.

Drei Details im Code sind besonders lehrreich:

1. **Der Klick auf den Hintergrund.** Ein Klick auf `::backdrop` wird vom Browser als Klick auf das `<dialog>`-Element selbst gemeldet. Deshalb `target === dialog`. Damit ein Klick in den **Innenabstand** nicht auch so zählt, sitzt das Padding an einem inneren `<div>`, nicht am Dialog.
2. **Der `closed`-Merker** verhindert, dass `onClose` doppelt läuft, wenn Escape und Klick kurz nacheinander feuern.
3. **`event.preventDefault()` bei `cancel`** – sonst würde der Browser den Dialog selbst schließen, ohne `onClose` aufzurufen.

„Genau ein Ausgang" ist hier eine fachliche Forderung: Nach einer getätigten Buchung soll der Gast **nicht** auf dem ausgefüllten Formular landen können.

### 3. `submit()` wird asynchron

```ts
private async submit(): Promise<void> {
    if (this.submitting) return;

    const draft = this.getBookingDraft();
    // … Validierung wie in Commit 011 …
    this.showCheckoutError(message);
    if (message !== null || checkIn === null || checkOut === null || nights === null || adults === null) return;

    const booking: Booking = { ...draft, checkIn, checkOut, nights, adults };

    this.setSubmitting(true);
    let result: Awaited<ReturnType<typeof createBooking>>;
    try {
        result = await createBooking(booking);
    } catch {
        // Nur bei einer unlesbaren Antwort – die Buchung kann trotzdem angelegt sein.
        // Deshalb kein „bitte erneut versuchen" und der Knopf bleibt gesperrt.
        this.showCheckoutError('Bei der Buchung ist ein unerwarteter Fehler aufgetreten. Bitte buchen Sie nicht erneut, sondern kontaktieren Sie uns.');
        return;
    }

    if (!result.ok) {
        this.setSubmitting(false);
        this.showCheckoutError(this.getRejectionMessage(result.error));
        // Eine Ablehnung heißt fast immer: Die Verfügbarkeit hat sich geändert. Die
        // neue Liste passt unmögliche Mengen an und sagt es über der Liste.
        void this.loadRooms();
        return;
    }

    // Der Knopf bleibt gesperrt – die Buchung ist getätigt, und das Popup führt nur
    // noch zur Startseite.
    bookingState.reset();
    this.showConfirmation(booking, result.data);
}
```

Die drei Ausgänge und was mit dem Knopf passiert:

| Ergebnis                    | Knopf               | Meldung                                              |
| --------------------------- | ------------------- | ---------------------------------------------------- |
| Unlesbare Antwort (`catch`) | **bleibt gesperrt** | „Bitte buchen Sie nicht erneut, sondern kontaktieren Sie uns." |
| Ablehnung (`ok: false`)     | wieder aktiv        | übersetzter Grund; Zimmerliste wird neu geladen      |
| Erfolg (`ok: true`)         | **bleibt gesperrt** | Bestätigungs-Popup                                   |

Das `Awaited<ReturnType<typeof createBooking>>` ist eine elegante Typableitung: `typeof createBooking` ist der Funktionstyp, `ReturnType<…>` dessen Rückgabetyp (`Promise<CreateBookingResult>`), und `Awaited<…>` packt das Promise aus. So muss man den Typ nicht noch einmal importieren.

Weil `submit()` jetzt ein Promise zurückgibt, bekommen die Aufrufer ein `void`:

```diff
-            this.submit();
+            void this.submit();
```

Das signalisiert ESLint (Regel `no-floating-promises`): „Das Promise wird absichtlich nicht abgewartet."

#### Schutz vor Doppelklick

```ts
// Solange `create_booking` läuft, zählt kein weiterer Klick: ein Doppelklick wären
// sonst zwei verbindliche Buchungen.
private submitting = false;

private setSubmitting(submitting: boolean): void {
    this.submitting = submitting;
    const button = document.querySelector<HTMLButtonElement>('[data-action="checkout"]');
    if (!button) return;
    button.disabled = submitting;
    button.setAttribute('aria-busy', String(submitting));
    button.textContent = submitting ? CHECKOUT_BUSY_LABEL : CHECKOUT_LABEL;
}
```

Doppelt gesichert: Das Flag `submitting` fängt auch Aufrufe ab, die schneller kommen als das DOM-Update, und `disabled` + `aria-busy` + „Buchung wird gesendet …" zeigen dem Gast, dass etwas passiert.

### 4. Ablehnungen in verständliche Sätze übersetzen

```ts
/**
 * Übersetzt die Ablehnung aus `create_booking` in einen Satz mit Datum und Kategorie
 * (E31). Gäste bekommen die feinen Gründe maskiert als `nicht_buchbar` (E28).
 */
private getRejectionMessage(error: BookingRejection): string {
    const room = this.rooms.find((card: RoomCard): boolean => card.roomTypeId === error.roomTypeId)?.name ?? null;
    const date = error.date === null ? null : formatStayDate(parseISODate(error.date), '', null);

    switch (error.code) {
        case 'nicht_buchbar':
        case 'ausgebucht':
        case 'kein_preis':
        case 'zu_klein': {
            const what = room ?? 'Ihre Auswahl';
            const when = date === null ? '' : ` für die Nacht vom ${date}`;
            return `${what} ist${when} leider nicht mehr buchbar. Wir haben die Verfügbarkeit aktualisiert – bitte prüfen Sie Ihre Auswahl.`;
        }
        // …
        case 'ungueltige_adresse':
            return 'Bitte prüfen Sie Ihre Adresse – sie ist unvollständig oder das Land wird nicht unterstützt.';
        default:
            return 'Die Buchung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.';
    }
}
```

Der Datenbanksatz aus `reject_booking` wird bewusst **nicht** angezeigt – der Typkommentar in `booking.service.ts` sagt warum: _„nur als Rückfall gedacht, er kommt ohne Umlaute"_. Die Datenbank liefert Codes, die Oberfläche formuliert. Das ist eine saubere Arbeitsteilung: Texte kann man später ändern oder übersetzen, ohne eine Migration zu schreiben.

Aus der Zimmer-UUID wird dank `roomTypeId` im Fehler-JSON der **Name der Kategorie** – so wird aus „Diese Buchung ist nicht möglich" ein „Double Suite ist für die Nacht vom 13.06.2026 leider nicht mehr buchbar."

### 5. Das Bestätigungs-Popup

```ts
/**
 * Bestätigungs-Popup nach E46. Genau ein Ausgang (V16): Button, Escape und Klick auf
 * den Hintergrund führen zur Startseite – ein Weg, der nur schließt, ließe den Gast
 * auf einem Formular zurück, dessen Buchung bereits getätigt ist.
 */
private showConfirmation(booking: Booking, created: CreatedBooking): void {
    const references = created.bookings.map((room: { bookingReference: string }): string => room.bookingReference);
    // …
    openModal({
        labelledBy: 'booking-confirmation-title',
        // E46: Der Entwurf sagt hier „Bitte bestätigen Sie diese via erhaltener Email."
        // Eine Buchung ist aber sofort `confirmed` (E11), und eine Mail verschickt noch
        // niemand. Der Satz kommt zurück, sobald es die Bestätigungsmail gibt.
        html: /*html*/ `
            <div class="flex flex-col items-center gap-6 text-center text-purple-haze-dark">
                <img src="${logo}" alt="" class="h-24 w-auto">
                <h2 id="booking-confirmation-title" class="…">Vielen Dank für Ihre Buchung.</h2>
                <p class="…">Ihre Buchung ist bestätigt.<br>Wir freuen uns auf Sie.</p>
                <dl class="…">
                    ${this.getConfirmationRowHtml(references.length === 1 ? 'Buchungsnummer' : 'Buchungsnummern', references.join('<br>'))}
                    ${this.getConfirmationRowHtml('Zeitraum', `${stay}<br>${formatNights(created.nights)}`)}
                    ${this.getConfirmationRowHtml('Gesamtpreis', formatPrice(created.grandTotalCents, currency))}
                </dl>
                <button type="button" data-modal-close class="…">zurück zur Homepage</button>
            </div>
        `,
        onClose: (): void => {
            // Der Router hört auf `popstate` und rendert dann den neuen Pfad – derselbe
            // Weg wie beim Zurück-Knopf des Browsers, ohne den Router hierher zu reichen.
            history.pushState(null, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
        },
    });
}
```

Drei Punkte verdienen Aufmerksamkeit:

- **Der Figma-Text wird bewusst nicht übernommen.** Der Entwurf versprach eine Bestätigungsmail – die es noch nicht gibt. Das ist genau die Lücke „Popup verspricht eine Mail, `bookings` kennt kein `pending`" aus Commit 001, hier mit `E46` aufgelöst: Die Oberfläche verspricht nur, was das System hält.
- **`<dl>`/`<dt>`/`<dd>`** (Beschreibungsliste) ist das semantisch passende HTML für Paare aus Bezeichnung und Wert.
- **Navigation ohne Zugriff auf den Router.** Die View kennt die `Router`-Instanz aus `main.ts` nicht. Statt sie durchzureichen, nutzt der Code den Mechanismus, auf den der Router ohnehin hört: `pushState` ändert die URL, und ein künstliches `popstate`-Ereignis löst das Rendern aus – so, als hätte der Nutzer den Zurück-Knopf gedrückt. Ein pragmatischer Weg, Kopplung zu vermeiden.

Das Logo wird per `import logo from '../../assets/img/logo-small.svg'` eingebunden – Vite ersetzt das beim Build durch die finale URL der Datei.

Der Kommentar an `getConfirmationRowHtml` hält fest, warum hier Template-Strings unbedenklich sind: _„Werte kommen aus `create_booking` bzw. sind formatierte Zahlen – keine Eingaben des Gastes."_ Das ist die Gegenprobe zur `textContent`-Regel aus Commit 009.

### 6. Aufräumen: das Übergangs-Logging fliegt raus

Das JSON-Logging aus Commit 009 war ausdrücklich als „übergangsweise – entfernen, sobald die Buchung gespeichert wird" markiert. Genau das passiert:

```diff
-    // TODO: Übergangsweise – entfernen, sobald die Buchung gespeichert wird.
-    private unsubscribeBookingLog: (() => void) | null = null;
```

```diff
-    /**
-     * TODO: Übergangsweise – loggt bei jeder Änderung den aktuellen Stand als JSON.
-     * …
-     */
-    private logBooking(): void {
-        …
-        console.log(JSON.stringify(this.getBookingDraft(), null, 2));
-    }
```

```diff
-        // TODO: Buchungsdaten später an das Backend senden (fetch / Supabase).
-        console.log('Buchungsdaten', booking);
```

Ein Beispiel dafür, wie ein `TODO` mit klarer Abbruchbedingung funktioniert: Die Bedingung („sobald die Buchung gespeichert wird") ist eingetreten, also verschwindet der Code – im selben Commit.

## Was wurde erreicht?

**Die Buchungsseite ist mit der Datenbank verbunden.** Ein Gast kann Zeitraum, Gäste, Zimmer mehrerer Kategorien, Frühstück, Zusatzleistungen und Adressen angeben und verbindlich buchen. Ablehnungen werden verständlich erklärt, Doppelbuchungen durch Doppelklick sind ausgeschlossen, und nach dem Erfolg zeigt ein Popup Buchungsnummer, Zeitraum und Gesamtpreis.

| Technik                                         | Wozu                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- |
| Discriminated Union (`ok: true \| false`)       | erwartete Ablehnungen ohne Exceptions, typsicher               |
| `unknown` + Laufzeitprüfung                     | externen Daten nicht blind vertrauen                           |
| Werfen nur bei „gebucht, aber unlesbar"         | kein „bitte erneut versuchen", das zu Doppelbuchungen führt    |
| Konditionaler Spread                            | Parameter nur bei Bedarf mitschicken                           |
| `Awaited<ReturnType<typeof fn>>`                | Typ aus einer Funktion ableiten                                |
| Flag + `disabled` + `aria-busy`                 | Schutz vor Doppelklick, sichtbar für alle                      |
| Codes aus der DB, Texte in der Oberfläche       | Formulierungen ändern ohne Migration                           |
| Natives `<dialog>` mit `showModal()`            | Fokusfang, Escape und Hintergrund vom Browser                  |
| Genau ein Ausgang aus dem Popup                 | kein Zurück auf ein bereits gebuchtes Formular                 |
| `pushState` + `popstate` statt Router-Referenz  | Navigation ohne Kopplung an den Router                         |

**Was offen bleibt:** Im TODO-Block von `Booking.ts` stehen noch „Buchungssteps verknüpfen" und die Frage nach Migrationen. Die generierten Typen (`V8`) fehlen weiterhin – `booking.service.ts` weist ausdrücklich darauf hin –, und die Lesezugriffe der View laufen noch direkt über `supabase.from`/`.rpc`. Das Prüfkriterium aus Phase 8 (`grep … services/supabase`) wäre also noch nicht erfüllt. Der Branch ist zum Stand dieses Eintrags **noch nicht in `main` gemergt**.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md)
