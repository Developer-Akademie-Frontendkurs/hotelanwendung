[← Vorheriger Commit](004_2026-09-16_mengenwaehler-je-zimmerkategorie.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): Belegung verpflichtend, kein stiller Suchdefault

- **Commit:** `d9d50d6`
- **Datum:** 2026-09-16
- **Autor:** Oliver Jung

## Worum geht es?

Ein Commit, der vor allem etwas **entfernt**: zwei Konstanten, die still eine Belegung erfunden haben.

```text
 docs/datenbank/umsetzungsplan.md |  8 ++++
 src/views/BookingView/Booking.ts | 82 ++++++++++++++++++++++++++++++----------
 2 files changed, 70 insertions(+), 20 deletions(-)
```

Bisher lief die Verfügbarkeitssuche auch dann, wenn der Gast noch gar keine Gästezahl gewählt hatte – mit `DEFAULT_ADULTS = 2`. Die Seite zeigte dann Preise und freie Zimmer für zwei Erwachsene, die niemand angegeben hatte. Mit dem Mengenwähler aus dem vorigen Commit wird das zum echten Problem: Der Gast könnte Zimmer wählen, deren Obergrenze für eine **geratene** Belegung berechnet wurde.

Die Commit-Message fasst die neue Regel zusammen: _„ohne Erwachsenenzahl gibt es keine Suche, keinen Preis, keinen Restbestand, keinen Mengenwähler und keinen aktiven `weiter`-Knopf."_

## Die Änderungen im Detail

### 1. Die Default-Konstanten verschwinden

```diff
-// Ohne getroffene Gästeauswahl sucht die Anwendung mit dieser Belegung – dieselben
-// Werte stehen dann auch in der Info-Leiste über den Zimmern.
-const DEFAULT_ADULTS = 2;
-const DEFAULT_CHILDREN = 0;
```

Und in der Suche wird aus einem stillen Ersatzwert eine Vorbedingung:

```diff
             const [details, availability] = await Promise.all([
                 supabase.from('room_types').select('id, name, slug, description, room_type_images(storage_path, alt_text, sort_order)').order('name'),
-                checkIn === null || checkOut === null
+                // Ohne gewählte Erwachsenenzahl wird nicht gesucht: eine geratene Belegung
+                // liefert Preise und Restbestände, die niemand bestellt hat (V16.7).
+                checkIn === null || checkOut === null || adults === null
                     ? null
                     : supabase.rpc('search_availability', {
                           p_check_in: toISODate(checkIn),
                           p_check_out: toISODate(checkOut),
-                          p_adults: this.guests.adults ?? DEFAULT_ADULTS,
-                          p_children: this.guests.children ?? DEFAULT_CHILDREN,
+                          p_adults: adults,
+                          // Leeres Kinderfeld heißt „keine Kinder" — das ist keine Vermutung,
+                          // sondern die Abwesenheit von Kindern.
+                          p_children: this.guests.children ?? 0,
                       }),
             ]);
```

Auf den ersten Blick sehen `this.guests.children ?? 0` (bleibt) und `this.guests.adults ?? DEFAULT_ADULTS` (fliegt raus) gleich aus. Der Unterschied ist fachlich, nicht technisch:

- Wer kein Kinderfeld ausfüllt, hat **keine Kinder** – der Wert `0` ist die richtige Übersetzung dieser Eingabe.
- Wer kein Erwachsenenfeld ausfüllt, hat **noch nichts gesagt**. Eine `2` ist dann keine Übersetzung, sondern eine Erfindung.

Ein `??` ist also nur dann in Ordnung, wenn der Ersatzwert **dasselbe bedeutet** wie „nichts angegeben".

Beachtenswert ist auch die neue Zeile am Anfang von `loadRooms`:

```ts
const adults = this.guests.adults;
```

Durch das Zwischenspeichern in einer lokalen `const` weiß TypeScript nach der Prüfung `adults === null`, dass `adults` im `else`-Zweig eine `number` ist. Bei `this.guests.adults` direkt wäre diese Verengung (Narrowing) nach dem `await` nicht mehr sicher – ein anderes Stück Code könnte das Feld inzwischen geändert haben.

### 2. Das Kinderfeld: Platzhalter statt doppelter Null

Bisher gab es im Kinderfeld zwei Arten, „keine Kinder" auszudrücken: den leeren Platzhalter und die Option `0 – Keine Kinder`. Jetzt nur noch eine:

```diff
-                    ${this.getGuestFieldHtml('children', 'Kinder', 'Anzahl der Kinder', buildChildOptions(), CHILD_ICON)}
+                    ${this.getGuestFieldHtml('children', 'Keine Kinder', 'Anzahl der Kinder', buildChildOptions(), CHILD_ICON)}
```

```diff
+/** Ohne eigene 0-Option: der leere Platzhalter „Keine Kinder" ist dieser Fall (Q17). */
 function buildChildOptions(): readonly GuestOption[] {
-    return Array.from({ length: MAX_CHILDREN + 1 }, (_unused: unknown, value: number): GuestOption => {
-        if (value === 0) return { value, label: 'Keine Kinder' };
+    return Array.from({ length: MAX_CHILDREN }, (_unused: unknown, index: number): GuestOption => {
+        const value = index + 1;
         return { value, label: value === 1 ? '1 Kind' : `${value.toString()} Kinder` };
     });
 }
```

Interessant im Rückblick: Im Eintrag zu Branch 007 wurde gerade die **Unterschiedlichkeit** von `buildAdultOptions` und `buildChildOptions` gelobt. Jetzt sind sich die beiden Funktionen fast gleich – weil sich die fachliche Regel geändert hat, nicht der Code-Stil. Code folgt der Fachlichkeit.

### 3. Der Hinweis am Feld – aber nicht zu früh

Unter dem Erwachsenenfeld gibt es jetzt eine Hinweiszeile:

```ts
const notice = field === 'adults' ? /*html*/ `<p data-guests-notice aria-live="polite" class="font-antic-didone text-14 leading-tight text-red-600"></p>` : '';
```

Wann sie etwas anzeigt, entscheidet eine eigene Methode:

```ts
/**
 * Sagt am Feld, was fehlt — aber erst, wenn der Zeitraum steht.
 *
 * Vorher wäre der Hinweis eine Begrüßung mit einem Fehler: wer die Seite öffnet, hat
 * noch nichts falsch gemacht.
 */
private renderGuestsNotice(): void {
    const noticeEl = document.querySelector<HTMLElement>('[data-guests-notice]');
    if (!noticeEl) return;

    const { checkIn, checkOut } = bookingState.getDates();
    const isMissing = checkIn !== null && checkOut !== null && this.guests.adults === null;
    noticeEl.textContent = isMissing ? 'Bitte wählen Sie die Anzahl der Erwachsenen.' : '';
}
```

„Eine Begrüßung mit einem Fehler" – eine treffende Formulierung für ein verbreitetes UX-Problem. Formulare, die schon beim Öffnen rot leuchten, bestrafen den Nutzer für etwas, das er noch gar nicht tun konnte. Der Hinweis erscheint deshalb erst, wenn der Gast zeigt, dass er weitermachen will (Zeitraum gewählt), aber etwas fehlt.

`renderGuestsNotice()` wird an allen Stellen aufgerufen, an denen sich eine der beiden Bedingungen ändern kann: bei Änderung der Gästeauswahl, beim Wählen eines Datums und beim Zurücksetzen.

### 4. Der Hinweis in der Zimmerkarte nennt, was fehlt

Aus dem festen Text „Bitte zuerst Zeitraum wählen" wird eine Methode mit vier Fällen:

```ts
/** Der Wähler hat zwei Vorbedingungen: einen Zeitraum und eine Belegung (V16.7 — kein stiller Suchdefault). */
private getMissingSelectionHint(): string {
    const { checkIn, checkOut } = bookingState.getDates();
    const needsDates = checkIn === null || checkOut === null;
    const needsGuests = this.guests.adults === null;

    if (needsDates && needsGuests) return 'Bitte zuerst Zeitraum und Anzahl der Gäste wählen';
    if (needsDates) return 'Bitte zuerst Zeitraum wählen';
    if (needsGuests) return 'Bitte zuerst die Anzahl der Gäste wählen';
    return '';
}
```

### 5. Der `weiter`-Knopf und der Typ `Booking`

```diff
-        const canSubmit = checkIn !== null && checkOut !== null;
+        const canSubmit = checkIn !== null && checkOut !== null && this.guests.adults !== null;
```

Und weil `submit()` jetzt erst läuft, wenn eine Erwachsenenzahl feststeht, darf der Typ strenger werden:

```diff
 type Booking = {
     checkIn: string;
     checkOut: string;
     nights: number;
-    adults: number | null;
-    children: number | null;
+    adults: number;
+    children: number;
 };
```

Das ist ein schönes Beispiel dafür, wie Typen und Validierung zusammenspielen: Die Prüfung am Anfang von `submit()` („ist `adults` gesetzt?") erlaubt es, im Ergebnistyp das `| null` zu streichen. Alles, was nach dieser Stelle mit einer `Booking` arbeitet, muss sich um den Fall „keine Erwachsenen" nicht mehr kümmern.

## Was wurde erreicht?

Die Buchungsseite zeigt keine Zahlen mehr, die auf einer Annahme beruhen. Preis, Restbestand und Mengenwähler erscheinen erst, wenn der Gast **Zeitraum und Erwachsenenzahl** angegeben hat – und bis dahin sagt die Seite genau, was noch fehlt.

Die übertragbare Regel: **Ein Default ist nur dann harmlos, wenn er dasselbe bedeutet wie „nichts angegeben".** „Keine Kinder" erfüllt das, „zwei Erwachsene" nicht.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](006_2026-09-16_zimmer-anzahl-und-fruehstueck-integriert.md)
