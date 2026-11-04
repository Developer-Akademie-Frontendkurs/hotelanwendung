[← Vorheriger Commit](018_2026-10-07_escape-html-xss-protection.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): update booking logic and clean up code, including service reconciliation and comment adjustments

- **Commit:** `09f29f2`
- **Datum:** 2026-10-07
- **Autor:** Oliver Jung

## Worum geht es?

Dieser Commit schließt die letzten beiden **Bugs** aus Gruppe A des Reviews und erledigt zwei schnelle Aufräumpunkte aus Gruppe B:

| Punkt  | Thema                                                                         |
| ------ | ----------------------------------------------------------------------------- |
| **A4** | Späte Antworten einer alten View-Instanz überschreiben den globalen Zustand   |
| **A5** | Kinderbetten werden erst nach dem Laden der Zimmer abgeglichen                |
| **B1** | `pnpm lint` wieder grün: ungenutzter Import `checker` in `vite.config.ts`      |
| **B2** | Veraltete Kommentare: TODO-Block, `breakfast.ts`, JSDoc von `ROOM_AMENITIES`  |

```text
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |  8 +--
 src/views/BookingView/Booking.ts                   | 66 +++++++++++++++-------
 src/views/BookingView/breakfast.ts                 |  2 +-
 vite.config.ts                                     |  1 -
 4 files changed, 51 insertions(+), 26 deletions(-)
```

## Die Änderungen im Detail

### 1. A4 – Antworten an eine View, die es nicht mehr gibt

Um diesen Fehler zu verstehen, muss man wissen, wie der selbstgeschriebene Router arbeitet: Bei **jeder** Navigation erzeugt er eine **neue** Instanz der View. Die alte wird aus dem DOM genommen – aber das JavaScript-Objekt lebt weiter, solange noch eine Anfrage von ihm unterwegs ist.

Der Ablauf, der schiefgehen konnte:

1. Der Gast ist auf `/buchung`, `loadRooms()` startet eine Anfrage (dauert, sagen wir, 2 Sekunden).
2. Er klickt auf „Startseite" und gleich wieder auf „Buchung". Eine **neue** `BookingView` entsteht und lädt ebenfalls.
3. Die Antwort der **alten** Instanz kommt an – und schreibt ihre Zimmermengen in den **globalen** `bookingState`.

Den bisherigen Schutz – eine Anfrage-ID – gab es zwar, aber er galt nur **je Instanz**: `this.roomsRequestId` der alten Instanz wusste nichts von der neuen.

Die Lösung fragt den DOM, ob die View überhaupt noch angezeigt wird:

```ts
/**
 * Der Router baut bei jeder Navigation eine neue View; eine alte Instanz lebt weiter,
 * bis ihre Anfragen zurück sind. Ob sie noch angezeigt wird, verrät ihr Container: Den
 * hat der Router beim Seitenwechsel aus dem DOM genommen.
 */
private isDisplayed(): boolean {
    return this.roomsEl?.isConnected === true;
}

/**
 * Antwort verwerfen, wenn eine neuere Suche läuft – oder die View nicht mehr angezeigt
 * wird: `roomsRequestId` gilt nur je Instanz, und eine verspätete Antwort der alten
 * würde sonst mit veralteten Zimmern und Gästen in den globalen `bookingState` schreiben.
 */
private isStale(requestId: number): boolean {
    return requestId !== this.roomsRequestId || !this.isDisplayed();
}
```

`Node.isConnected` ist eine DOM-Eigenschaft: `true`, solange ein Element im Dokument hängt, `false`, sobald es (direkt oder über einen Vorfahren) entfernt wurde. Genau das passiert beim Seitenwechsel.

In `loadRooms()` ersetzt `isStale()` die bisherige Prüfung – vor dem Erfolgs- **und** vor dem Fehlerzweig:

```diff
             // Eine überholte Antwort darf das Ergebnis der aktuellen Suche nicht ersetzen.
-            if (requestId !== this.roomsRequestId) return;
+            if (this.isStale(requestId)) return;
 …
         } catch (error) {
-            if (requestId !== this.roomsRequestId) return;
+            if (this.isStale(requestId)) return;
```

Und auch `loadHotel()` prüft jetzt, ob es noch gebraucht wird:

```diff
-        if (error) return;
+        if (error || !this.isDisplayed()) return;
```

Das Review hatte als Alternative einen `AbortController` vorgeschlagen, der die Anfrage tatsächlich abbricht. Der gewählte Weg ist einfacher: Die Anfrage läuft zu Ende, ihr Ergebnis wird nur ignoriert. Für eine Lesefrage ist das völlig ausreichend. Die saubere Lösung – ein `destroy()`-Hook, den der Router beim Verlassen einer View aufruft – steht als Punkt **D7** noch im Review.

### 2. A5 – Kinderbetten sofort abgleichen

Seit Commit 008 gilt: höchstens **ein Kinderbett je Zimmer und Kind**. Verringert der Gast die Zahl der Kinder, muss auch die Zahl der Kinderbetten sinken. Das passierte bisher erst **nach** `loadRooms()`. Schlug das Neuladen fehl, blieben zu viele Kinderbetten in der Bestellung – und `create_booking` lehnte mit `ungueltige_leistung` ab, ohne dass der Gast verstand, warum.

Zuerst wird der Abgleich, der an drei Stellen gleich kopiert war, in eine Methode gezogen:

```ts
/**
 * Zieht die gewählten Leistungen auf das nach, was Zimmer und Kinder gerade erlauben –
 * das Kinderbett sinkt mit (1 je Zimmer und Kind, E49). Rein lokal, ohne Anfrage: Der
 * Abgleich darf nicht davon abhängen, dass ein Neuladen gelingt.
 */
private reconcileSelectedServices(): void {
    bookingState.setServices(reconcileServices(bookingState.getServices(), this.extraServices, this.getServiceContext()));
}
```

```diff
-        bookingState.setServices(reconcileServices(bookingState.getServices(), this.extraServices, this.getServiceContext()));
+        this.reconcileSelectedServices();
```

Dann wird sie dort aufgerufen, wo sich die Zahl der Kinder ändert – **synchron**, vor jeder Anfrage:

```diff
         this.guests[field] = target.value === '' ? null : Number(target.value);
+        // Sofort, nicht erst nach `loadRooms()`: Schlägt das Neuladen fehl, stünden sonst
+        // mehr Kinderbetten als Kinder in der Bestellung, und `create_booking` lehnt mit
+        // `ungueltige_leistung` ab.
+        if (field === 'children') this.reconcileSelectedServices();
```

Das Prinzip: **Was sich lokal berechnen lässt, hängt nicht vom Netzwerk ab.** Der Abgleich braucht nur Daten, die schon da sind (gewählte Leistungen, Zimmerzahl, Kinderzahl).

### 3. B1 – Lint wieder grün (zur Hälfte)

```diff
 import tailwindcss from '@tailwindcss/vite';
 import { defineConfig } from 'vite';
-import checker from 'vite-plugin-checker';
```

`checker` war importiert, aber nie in `plugins` eingetragen – ESLint meldete das als ungenutzte Variable. Der zweite Lint-Fehler aus dem Review (ein fehlendes Markdown-Label im Projekttagebuch) wurde in diesem Commit **nicht** behoben, obwohl B1 abgehakt ist. Er wurde erst bei der Aktualisierung dieses Tagebucheintrags korrigiert.

### 4. B2 – Kommentare, die nicht mehr stimmen

**Der TODO-Block** am Anfang von `Booking.ts` hatte nur noch einen Punkt, und der ist mit dem Schema-Ausbau der letzten Commits erledigt:

```diff
-/*
-    *** Vorbereitung und Verknüpfung BookingView zu Datenbank ***
-        TODO: Migrations notwending? Eventuelle Änderungen an der Datenbank?
-*/
```

**`breakfast.ts`** sprach noch von „je Zimmerkategorie". Seit `E48` gilt das Frühstück aber für den ganzen Vorgang:

```diff
 /**
- * Frühstück je Zimmerkategorie (E47).
+ * Frühstück je Buchungsvorgang (E47).
```

**Der JSDoc von `ROOM_AMENITIES`** war bei einem früheren Einfügen über `SERVICE_ICONS` gerutscht. Der Commit verschiebt den Block wieder vor `ROOM_AMENITIES`:

```diff
-/**
- * Ausstattung je Zimmerkategorie.
- * …
- */
-// Icons der Zusatzleistungen, zugeordnet über `services.code` – wie die Ausstattung über
-// den `slug`. Darstellung gehört nicht in die Datenbank (E49).
 const SERVICE_ICON_CLASS = 'w-9 h-9 shrink-0 text-purple-haze';
 …
+/**
+ * Ausstattung je Zimmerkategorie.
+ * …
+ */
+// Icons der Zusatzleistungen, zugeordnet über `services.code` – wie die Ausstattung über
+// den `slug`. Darstellung gehört nicht in die Datenbank (E49).
 const ROOM_AMENITIES: Readonly<Record<string, readonly RoomAmenity[]>> = {
```

Wer genau hinsieht, bemerkt: Der Zeilenkommentar **„Icons der Zusatzleistungen …"** ist mitgewandert. Er gehört zu `SERVICE_ICONS` und hängt jetzt über `ROOM_AMENITIES` – der Fehler hat nur die Seite gewechselt. Das passiert leicht, wenn man einen Block „bis zur nächsten Codezeile" ausschneidet, und es fällt nur auf, wenn man den Diff Zeile für Zeile liest. Zum Stand dieses Eintrags ist das noch nicht korrigiert.

## Was wurde erreicht?

Mit diesem Commit sind alle sechs Punkte der Gruppe **A** (Bugs und Sicherheit) erledigt – A6 stellt sich im nächsten Commit als Fehlalarm heraus.

| Technik                                  | Wozu                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `isConnected` als Lebenszeichen der View | verspätete Antworten einer verlassenen Seite verwerfen                  |
| Anfrage-ID **und** Anzeige-Prüfung       | schützt vor überholten Suchen **und** vor alten Instanzen               |
| Lokale Berechnung vor der Anfrage        | ein Netzwerkfehler hinterlässt keinen ungültigen Zustand                |
| Dreifachen Code in eine Methode ziehen   | ein Name (`reconcileSelectedServices`) statt drei gleicher Zeilen       |
| Veraltete Kommentare löschen             | ein falscher Kommentar ist schlimmer als keiner                          |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](020_2026-10-07_standardize-variable-names.md)
