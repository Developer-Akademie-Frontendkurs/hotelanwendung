[← Vorheriger Commit](../006_2026-08-26_datenbank-anbindung/012_2026-09-06_add-envdir-configuration-to-vite.md) · [↑ Branch-Übersicht](../007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](../000_index.md)

# feat(booking): implement guest selection for adults and children with dynamic options

- **Commit:** `a57e0f0`
- **Datum:** 2026-09-06
- **Autor:** Oliver Jung

## Worum geht es?

Der erste Baustein, der auf der Buchungsseite **über** dem Kalender landet: die Auswahl „Anzahl der Gäste" mit zwei Feldern (Erwachsene, Kinder), jeweils mit einem Icon aus dem Figma-Entwurf.

```text
 src/views/BookingView/Booking.ts | 101 +++++++++++++++++++++++++++++++++++++++
 1 file changed, 101 insertions(+)
```

Eine Datei, 101 neue Zeilen, keine gelöschten. Der Commit ist inhaltlich klein – aber er enthält vier Techniken, die man in einem Projekt **ohne Framework** immer wieder braucht. Genau darum lohnt es, ihn genau anzusehen.

## Die Änderungen im Detail

### 1. Der Datentyp bekommt die neuen Felder – als `number | null`

```diff
 type Booking = {
     checkIn: string;
     checkOut: string;
     nights: number;
+    adults: number | null;
+    children: number | null;
+};
+
+type GuestField = 'adults' | 'children';
+
+type GuestOption = {
+    value: number;
+    label: string;
 };
```

Drei Entscheidungen in wenigen Zeilen:

**`number | null` statt `number`.** `null` heißt „der Gast hat noch nichts gewählt", `0` heißt „null Kinder". Das ist nicht dasselbe, und man kann es später nicht mehr auseinanderhalten, wenn man beides auf `0` abbildet. Für Kinder ist `0` sogar eine gültige, sinnvolle Wahl – es gibt die Option „Keine Kinder".

**`type GuestField = 'adults' | 'children'`** ist ein **String-Literal-Union**. Der Typ erlaubt genau zwei Werte. Wer sich später vertippt (`'adult'`), bekommt einen Fehler von `tsc`, nicht ein stilles `undefined` zur Laufzeit. Das ist der billigste Typsicherheitsgewinn, den TypeScript zu bieten hat.

**`GuestOption`** trennt den _Wert_ (`2`) von der _Beschriftung_ (`'2 Erwachsene'`). Klingt selbstverständlich, ist es aber nicht: Wer nur Zahlen speichert und die Beschriftung im Template zusammenbaut, hat die Sprachlogik an drei Stellen.

### 2. Der Zustand liegt in der Klasse – als `Record`

```diff
 export class BookingView extends AbstractView {
     private readonly today: Date;
     private displayedYear: number;
     private displayedMonth: number;
     private calendarEl: HTMLElement | null = null;
+    private readonly guests: Record<GuestField, number | null> = { adults: null, children: null };
```

`Record<GuestField, number | null>` ist ein Objekt mit genau den Schlüsseln aus `GuestField`. Der Vorteil gegenüber zwei einzelnen Feldern (`private adults`, `private children`) zeigt sich sofort im Änderungs-Handler: Man kann den Schlüssel als **Variable** verwenden.

`readonly` steht dabei nur am Feld selbst – das Objekt darf nicht ausgetauscht werden, seine Werte schon. Für einen Zustandsbehälter ist das genau richtig.

### 3. Icons als Inline-SVG-Konstanten

```ts
// Icons aus dem Figma-Design (Frames "icon_adult" / "icon_kid"), als Inline-SVG statt als Asset.
const ADULT_ICON = /*html*/ `
    <svg class="w-6 h-6 768:w-[1.625rem] 768:h-[1.625rem]" viewBox="0 0 26 26" fill="currentColor" aria-hidden="true">
        <path d="M8.40938 11.0906C7.13646 9.81771 …" />
    </svg>
`;
```

Drei Details, die man leicht überliest:

- **`fill="currentColor"`** – das SVG nimmt die Textfarbe seines Containers an. Deshalb genügt am umgebenden `<span>` die Klasse `text-white`, und das Icon braucht keine eigene Farbangabe. Bei einer PNG-Datei müsste man für jede Farbvariante eine neue Datei ablegen.
- **`aria-hidden="true"`** – das Icon ist Dekoration. Es trägt keine Information, die nicht schon im Text steht, also soll ein Screenreader es überspringen. Die Information steckt stattdessen im `aria-label` des Auswahlfelds.
- **`/*html*/`** vor dem Template-String – der im Projekt durchgehend verwendete Kommentar, an dem Editor-Erweiterungen HTML-Syntaxhervorhebung in Template-Strings erkennen. Reine Lesbarkeitshilfe, kein Laufzeiteffekt.

Und die eigentliche Abwägung, die im Kommentar steht: **Inline-SVG statt Asset-Datei.** Inline heißt: keine zusätzliche HTTP-Anfrage, färbbar per CSS, aber die Datei `Booking.ts` wird lang und das Markup wiederholt sich bei jeder Verwendung im DOM. Bei zwei Icons in einer Seite ist das die richtige Wahl; bei zwanzig Verwendungen desselben Icons wäre `<use>` mit einem SVG-Sprite besser.

### 4. Die Optionen werden erzeugt, nicht geschrieben

```ts
const MAX_ADULTS = 6;
const MAX_CHILDREN = 4;

function buildAdultOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_ADULTS }, (_unused: unknown, index: number): GuestOption => {
        const value = index + 1;
        return { value, label: value === 1 ? '1 Erwachsener' : `${value.toString()} Erwachsene` };
    });
}

function buildChildOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_CHILDREN + 1 }, (_unused: unknown, value: number): GuestOption => {
        if (value === 0) return { value, label: 'Keine Kinder' };
        return { value, label: value === 1 ? '1 Kind' : `${value.toString()} Kinder` };
    });
}
```

`Array.from({ length: n }, (_, i) => …)` ist das kompakte Idiom für „erzeuge n Elemente". Das erste Argument ist ein Objekt, das nur `length` hat – `Array.from` behandelt es wie ein Array dieser Länge und ruft die Funktion für jeden Index auf.

Die beiden Funktionen sehen ähnlich aus, sind aber **absichtlich nicht dieselbe**:

|                    | Erwachsene      | Kinder             |
| ------------------ | --------------- | ------------------ |
| Kleinster Wert     | 1               | **0**              |
| Länge              | `MAX_ADULTS`    | `MAX_CHILDREN + 1` |
| Beschriftung bei 0 | gibt es nicht   | „Keine Kinder"     |
| Einzahl            | „1 Erwachsener" | „1 Kind"           |

Eine Reise ohne Erwachsene gibt es nicht, eine ohne Kinder schon. Wer versucht, beides in **eine** Funktion mit Parametern zu pressen (`buildOptions(min, max, singular, plural, zeroLabel)`), bekommt eine Signatur mit fünf Argumenten, die an der Aufrufstelle niemand mehr lesen kann. Zwei kurze, klare Funktionen sind hier besser als eine allgemeine – ein Fall, in dem „nicht wiederholen" die falsche Regel wäre.

Die deutsche Ein-/Mehrzahl ist übrigens der Grund, warum die Beschriftung überhaupt in den Daten steht. „1 Erwachsener" ist nicht „1 Erwachsene", und `${n} Erwachsene(r)` wäre keine Lösung, sondern ein Eingeständnis.

### 5. Das Markup: eine Funktion für beide Felder

```ts
private getGuestsHtml(): string {
    return /*html*/ `
        <div class="mb-8 768:mb-12">
            <h2 class="font-playfair-display text-28 768:text-36 text-purple-haze-dark text-center mb-5 768:mb-6">Anzahl der Gäste</h2>
            <div id="booking-guests" class="flex flex-col 576:flex-row 576:justify-center gap-4 768:gap-8">
                ${this.getGuestFieldHtml('adults', 'Erwachsene', 'Anzahl der Erwachsenen', buildAdultOptions(), ADULT_ICON)}
                ${this.getGuestFieldHtml('children', 'Kinder', 'Anzahl der Kinder', buildChildOptions(), CHILD_ICON)}
            </div>
        </div>
    `;
}
```

Ein Blick auf die Tailwind-Klassen lohnt, weil dieses Projekt **eigene Breakpoint-Namen** definiert (siehe `src/style.css`): `576:flex-row` heißt „ab 576 px in einer Reihe", darunter gilt das `flex-col` davor. Die Zahlen sind die Namen – nicht `md:` oder `lg:`, sondern die Pixelwerte aus dem Entwurf. Das macht den Abgleich mit Figma direkt möglich.

Das eigentliche Feld:

```ts
private getGuestFieldHtml(field: GuestField, placeholder: string, ariaLabel: string, options: readonly GuestOption[], icon: string): string {
    const selected = this.guests[field];

    const optionsHtml = options
        .map((option: GuestOption): string => {
            const isSelected = selected === option.value ? ' selected' : '';
            return /*html*/ `<option value="${option.value.toString()}"${isSelected}>${option.label}</option>`;
        })
        .join('');

    return /*html*/ `
        <div class="flex items-center gap-3 768:gap-4">
            <div class="relative flex-1 576:flex-none 576:w-60">
                <select
                    data-guests="${field}"
                    aria-label="${ariaLabel}"
                    class="w-full appearance-none rounded-xl border border-purple-haze bg-white py-2 pl-6 pr-12 …"
                >
                    <option value=""${selected === null ? ' selected' : ''}>${placeholder}</option>
                    ${optionsHtml}
                </select>
                <svg class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 …" viewBox="0 0 16 12" fill="none" aria-hidden="true">
                    <path d="M1.5 1.5 7.5 10 14 1.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </div>
            <span class="shrink-0 flex items-center justify-center w-10 h-10 … rounded-full bg-purple-haze text-white">
                ${icon}
            </span>
        </div>
    `;
}
```

Vier Punkte, die über „HTML zusammenbauen" hinausgehen:

**`selected` wird aus dem Zustand gesetzt, nicht vom Browser verwaltet.** Die Methode liest `this.guests[field]` und setzt das Attribut entsprechend. Das ist Voraussetzung dafür, dass ein erneutes Rendern die Auswahl nicht verliert – ein Muster, das jedes Framework „kontrollierte Komponente" nennt und das man hier von Hand baut.

**Der Platzhalter ist eine echte Option mit leerem Wert.** `<option value="">Erwachsene</option>` – bei `<select>` gibt es kein `placeholder`-Attribut. Der leere Wert ist zugleich das Signal für „nichts gewählt", das im Handler nach `null` übersetzt wird.

**`appearance-none` + eigenes Pfeil-SVG.** Die Standard-Darstellung eines `<select>` unterscheidet sich zwischen Browsern und Betriebssystemen erheblich und lässt sich kaum gestalten. Deshalb wird sie abgeschaltet und der Pfeil selbst gezeichnet. Wichtig dabei: **`pointer-events-none`** am SVG – ohne diese Klasse würde ein Klick auf den Pfeil vom SVG abgefangen und das Auswahlfeld öffnete sich nicht.

**`aria-label` statt `<label>`.** Der Entwurf hat keine sichtbare Beschriftung über den Feldern, nur den Platzhalter im Feld. Ein Formularfeld ohne Bezeichnung ist für Screenreader aber wertlos – `aria-label="Anzahl der Erwachsenen"` liefert sie nach, ohne das Layout zu verändern. Ein sichtbares `<label>` wäre die bessere Lösung; `aria-label` ist die richtige, wenn der Entwurf keines vorsieht.

### 6. Event-Delegation über `data`-Attribute

```diff
     // eslint-disable-next-line @typescript-eslint/require-await
     async afterRender(): Promise<void> {
+        document.getElementById('booking-guests')?.addEventListener('change', (event: Event): void => {
+            this.handleGuestChange(event);
+        });
+
         this.calendarEl = document.getElementById('booking-calendar');
```

```ts
private handleGuestChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;

    const field = target.dataset.guests;
    if (field !== 'adults' && field !== 'children') return;

    this.guests[field] = target.value === '' ? null : Number(target.value);
}
```

**Ein Listener am Container, nicht zwei an den Feldern.** Das funktioniert, weil `change`-Ereignisse im DOM nach oben _aufsteigen_ (englisch _bubbling_): Das Ereignis entsteht am `<select>`, läuft aber durch alle Elternelemente. Der Container darf deshalb neu gerendert werden, ohne dass Listener verloren gehen oder doppelt angemeldet werden – ein wiederkehrendes Problem, wenn man Listener an neu erzeugte Kindelemente hängt.

**Die beiden `if`-Zeilen sind keine Zeremonie, sondern Typverengung.** `event.target` ist laut Typdefinition `EventTarget | null` – daraus lässt sich `.value` nicht lesen. `instanceof HTMLSelectElement` verengt den Typ, und TypeScript weiß danach, dass `.value` und `.dataset` existieren. Die zweite Prüfung verengt `target.dataset.guests` von `string | undefined` auf `GuestField`; erst danach ist `this.guests[field]` erlaubt. Das ist derselbe Mechanismus, mit dem der Kalender-Handler aus Branch `buchungs-seite` arbeitet.

**`Number(target.value)`** – der Wert eines `<option>` ist immer ein String. Die Umwandlung ist unvermeidlich; hier ist sie sicher, weil die Werte aus den eigenen `build*Options()`-Funktionen stammen.

### 7. Die Werte landen im Buchungsobjekt

```diff
         checkIn: toISODate(checkIn),
         checkOut: toISODate(checkOut),
         nights,
+        adults: this.guests.adults,
+        children: this.guests.children,
     };

     // TODO: Buchungsdaten später an das Backend senden (fetch / Supabase).
```

Das `TODO` aus Branch `buchungs-seite` steht weiterhin da – und wird zwei Zeilen darüber um zwei Felder reicher. Der Commit erweitert also die Datenmenge, die irgendwann an `create_booking` gehen soll, ohne die Anbindung selbst zu bauen.

## Was wurde erreicht?

Die Buchungsseite hat ihren ersten Block über dem Kalender: eine funktionierende, zustandsbehaftete und barrierefrei beschriftete Gästeauswahl mit erzeugten Optionen.

**Was noch fehlt und im nächsten Commit kommt:** Die Auswahl hat noch **keine Wirkung**. Sie ändert weder den Kalender noch löst sie eine Suche aus – `this.guests` wird nur gelesen, wenn man auf „Buchen" klickt. Genau das ändert Commit 002: Dort ruft `handleGuestChange()` am Ende `void this.loadRooms()` auf, und die Werte werden zu Parametern von `search_availability`.

**Und eine Doppeldeutigkeit, die hier entsteht und erst im Branch `verbindung-ui-zu-datenbank` auffällt:** Eine zentrale Überschrift „Anzahl der Gäste" über der ganzen Seite liest sich wie eine **Gesamtzahl der Reisenden**. Die Datenbank meint mit `p_adults`/`p_children` aber die Belegung **eines Zimmers** – `availability_nights()` prüft `max_occupancy` pro Zimmer. Solange man genau ein Zimmer buchen kann, ist der Unterschied folgenlos. Mit einer Mengenauswahl wird er zu falschen Suchergebnissen. Die Entscheidung `E45` löst das später auf: Die Datenbank gewinnt, und die Beschriftung wird zu „Gäste pro Zimmer".

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [Nächster Commit →](002_2026-09-06_add-room-interfaces-and-card-rendering.md)
