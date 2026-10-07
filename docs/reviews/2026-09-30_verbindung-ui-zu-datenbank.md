# Review `verbindung-ui-zu-datenbank` (gegen `main`), 2026-09-30

Umfang: 15 Commits von `e724f6c` bis `813760d`.
Grundlagen: `CLAUDE.md`, `tsconfig.json`, `eslint.config.ts` und `.prettierrc` für die Standards; `docs/datenbank/umsetzungsplan.md` (0c, 7b, 8, 9, 9b) für die Spec.

Tooling:
- `pnpm build` läuft durch.
- `pnpm vitest run src` läuft durch (29 Tests).
- `pnpm lint` schlägt mit 2 Fehlern fehl:
  - `vite.config.ts:3`: `checker` wird nicht benutzt.
  - `.projekt-tagebuch/…006…md:51`: fehlendes Label.
- `pnpm test:db` wurde nicht ausgeführt.

---

## Refactoring-Checkliste

Die Reihenfolge: zuerst Bugs, dann schnelle Aufräumarbeiten, dann Struktur, dann offene Spec-Punkte. Jeder Punkt ist für sich allein umsetzbar.

### A. Bugs und Sicherheit (zuerst)

- [x] **A1: Der Knopf „weiter“ im Kalender bucht verbindlich.**
  - Wo: `Booking.ts:1471` (`data-action="submit"`) und `:1526` (`case 'submit': void this.submit()`).
  - Folge: `submit()` ruft seit `bb243ce` `createBooking` auf.
  - Lösung: Die Aktion heißt künftig `next-step` und scrollt nur zu `#booking-rooms`. Gebucht wird ausschließlich über `[data-action="checkout"]`.
- [x] **A2: Netzwerkfehler sehen aus wie Ablehnungen, das kann zu Doppelbuchungen führen.**
  - Wo: `booking.service.ts:109`. Dort wird jeder `error` zu `{ ok: false }`.
  - Das widerspricht V15: „Ablehnung als Ergebnis, Infrastrukturfehler werfen“.
  - Lösung: Nur `P0001` mit `DETAIL`-JSON ist eine Ablehnung, alles andere wird geworfen. Bei einem Wurf bleibt der Knopf gesperrt, und der Hinweis sagt „Status unklar, bitte nicht erneut buchen“.
- [x] **A3: Werte aus der Datenbank landen ungeschützt in `innerHTML` (XSS).**
  - Lösung: `src/shared/ui/html.ts` mit `escapeHtml()` anlegen.
  - Anwenden auf `room.name/description/imageAlt`, `service.name/description`, `line.name` (auch im `aria-label`), die Hotelzeilen und `roomsError`.
  - Stellen in `Booking.ts`: ca. Z. 434, 486, 580, 586, 918, 925, 1137, 1165, 1216, 1225.
- [x] **A4: Späte Antworten aus einer alten View-Instanz überschreiben den globalen Zustand.**
  - Wo: `loadRooms` (`Booking.ts:1332–1348`).
  - Lösung: Vor dem Schreiben in den Store `if (!this.roomsEl?.isConnected) return;` prüfen, oder einen `AbortController` verwenden.
- [x] **A5: Kinderbetten werden erst nach dem Laden abgeglichen.**
  - Wird die Zahl der Kinder verringert und schlägt `loadRooms` danach fehl, bleiben zu viele Kinderbetten übrig. `create_booking` antwortet dann mit `ungueltige_leistung`.
  - Lösung: Den Abgleich schon in `handleGuestChange` synchron ausführen.
- [x] **A6: Überzähliges `</output>` entfernen** (`Booking.ts:1138`). Fehlalarm des Reviews, nichts zu ändern: Seit `813760d` steht im Code genau ein `<output>` mit passendem `</output>` (die Mengenanzeige der Zusatzleistungen); `getHotelAddressHtml` endet sauber mit `<hr>` und `</div>`.

### B. Schnelle Aufräumarbeiten

- [x] B1: Lint wieder grün machen: `checker` in `vite.config.ts` benutzen oder entfernen, den Label-Verweis im Tagebuch reparieren.
- [x] B2: Veraltete Kommentare korrigieren:
  - den TODO-Block in `Booking.ts:27-30`,
  - `breakfast.ts:1` (dort steht „je Kategorie“, es gilt inzwischen „je Vorgang“),
  - den JSDoc von `ROOM_AMENITIES`, der jetzt über `SERVICE_ICONS` hängt (`:156`).
- [x] B3: Umbenennen:
  - `getBillingFieldHtml` → `getInputFieldHtml`,
  - `handleClick` → `handleCalendarClick`,
  - gemischte deutsch-englische Bezeichner wie `preise`, `grenze`, `einheit` vereinheitlichen.
- [x] B4: Magic Strings durch Konstanten ersetzen: `export const BREAKFAST = 'BREAKFAST'`, analog zu `CHILD_BED`; den `'EUR'`-Fallback zentral ablegen.
- [x] B5: Freie Farbwerte (`#ffc571`, `#f6f2f2`, `#fbfbfb`, `#74687e`) als Tokens in den `@theme`-Block von `style.css` aufnehmen.
- [x] B6: `as`-Casts auf `event.target` durch `instanceof`-Guards ersetzen:
  - `Booking.ts:752, 1260, 1512, 1786, 1795`,
  - `modal.ts:41`,
  - in `services.ts:62` den Filter als Type-Guard schreiben.
- [x] B7: `loadHotel` verschluckt Fehler. Den Fehler loggen oder anzeigen (`Booking.ts:1291`). Umgesetzt: Hinweis in der Zusammenfassung statt der Hoteladresse, Details per `console.error` (auch wenn kein Hotel hinterlegt ist).
- [x] B8: `screenshots/fruehstueck-zimmerkarte.png` (258 KB) entweder bewusst behalten oder entfernen. Entscheidung: bewusst behalten.

### C. Typen und Duplikate

- [x] C1: `ServiceRow` existiert doppelt und unterschiedlich (`breakfast.ts:11`, `services.ts:18`). Die Store-Typen (`RoomQuantities`, `ServiceQuantities`) gehören nach `domain/booking.types.ts`, damit die Fachlogik keine Typen mehr aus dem Store importiert. Umgesetzt in `src/shared/types/booking.types.ts` (statt `domain/`), weil Store und Fachlogik beide von dort importieren.
- [x] C2: `Booking`, `BookingPosition` und `BookingService` in `Booking.ts:44-68` doppeln `BookingRequest`. `BookingRequestAddress` doppelt `Address` mit `CountryCode`. Die Typen daraus ableiten, statt sie zu kopieren.
- [x] C3: Einen Union-Typ `RejectionCode` statt `code: string` einführen und eine gemeinsame Map Code → Text anlegen. Sie ersetzt die zwei Switches `getRejectionMessage` und `formatUnavailableReason`.
- [ ] C4: `formatRoomsFree` gibt es doppelt mit unterschiedlichem Text (`roomQuantity.ts:138`, `Booking.ts:2036`). Zusammenführen.
- [ ] C5: Ein gemeinsames `getStepButtonHtml()` für `getServiceStepHtml` (`:637`) und `getQuantityStepHtml` (`:738`) anlegen.

### D. Trennen von Design, Datenfluss und Logik

Ziel: Die View orchestriert nur noch. Templates sind reine Funktionen (Daten rein, String raus), die Fachlogik bleibt rein und getestet, Supabase wird nur noch in `services/` angesprochen.

```
src/views/BookingView/
  Booking.ts                  – nur Orchestrierung: afterRender, Events → Aktionen, subscribe → render
  templates/                  – icons.ts, calendar.template.ts, rooms.template.ts, checkout.template.ts
  domain/                     – booking.types.ts, calendar.ts, validation.ts, messages.ts
                                + roomQuantity/services/breakfast/summary/address (wie bisher)
src/shared/
  format.ts                   – formatPrice, formatNights, formatGuests, formatStayDate
  ui/html.ts                  – escapeHtml
  services/catalog.service.ts – fetchRoomTypes, fetchServices, fetchHotel, searchAvailability, buildRoomCards
  state/bookingState.ts       – inkl. guests, Aktionen mit genau einem notify
```

- [ ] D1: Die Formatierer (`Booking.ts:1980–2073`) nach `src/shared/format.ts` verschieben und Tests dafür schreiben.
- [ ] D2: Die Kalenderfunktionen (`buildDays`, `countNights`, `toISODate`, `parseISODate`) nach `domain/calendar.ts` verschieben. `buildDays` bekommt `today` als Parameter. Tests schreiben.
- [ ] D3: `domain/validation.ts` anlegen mit `getCheckoutError(draft, rooms)` und `getCompletedSteps(state)`. Beide stützen sich auf `getMissingBeds() === 0`, **nicht** auf den Anzeigetext `getCapacityText() === ''` (`Booking.ts:1734, 1752`).
- [ ] D4: `catalog.service.ts` anlegen und alle Lesezugriffe dorthin verschieben: `hotels`, `room_types`, `services`, `search_availability`, `getPublicUrl` sowie das Mapping `buildRoomCards`/`pickImage` (`Booking.ts:1289–1359, 1925–1972`). Das erfüllt zugleich V9 und Phase 8.4.
- [ ] D5: `guests` und die Kontakt-/Adressdaten in den `bookingState` übernehmen (V10). `completedSteps` fliegt aus dem Store, stattdessen leitet `MainHeader` die Schritte über `getCompletedSteps` ab. Damit entfällt auch die Sperre gegen Endlosschleifen in `bookingState.ts:130`.
- [ ] D6: Aktionen im Store bündeln, zum Beispiel `selectRoomQuantity()`. Sie setzt die Menge, gleicht die Leistungen ab (heute dreimal kopiert in `:811`, `:1269`, `:1346`) und löst genau ein `notify` aus.
- [ ] D7: Einen `destroy()`-Hook in `AbstractView` und `router.ts` einführen. Die Abo-Behelfslösung in `renderSummary` (`:1087`) wird dann entfernt, ebenso die versteckte Abhängigkeit vom `reset()` in `MainHeader.destroy()`.
- [ ] D8: Die Templates schrittweise nach `templates/*.ts` verschieben, in dieser Reihenfolge: Icons, Kalender, Zimmer, Checkout. `Booking.ts` hat aktuell 2073 Zeilen.
- [x] D9: `CLAUDE.md` aktualisieren. Dort steht noch „keine Service-Schicht“, es gibt aber inzwischen eine.

### E. Tests

- [ ] E1: `address.spec.ts` für `getInvalidFields` schreiben.
- [ ] E2: `booking.service.spec.ts` für `parseRejection` und `parseCreatedBooking` schreiben.
- [ ] E3: Die Regeln in `bookingState` testen, zum Beispiel „ohne Zimmer kein Frühstück“.
- [ ] E4: Datenbanktests für E50/E51 schreiben:
  - `ungueltige_adresse`,
  - eine unvollständige Rechnungsadresse (Regel „alles oder nichts“),
  - die Wiederverwendung über `match_key`,
  - den Trigger `guard_customer_address_update`,
  - die zusammengesetzten Fremdschlüssel.

### F. Offene Punkte aus dem Umsetzungsplan

- [ ] F1: **Phase 8 / V8:** `pnpm db:types` ausführen, `src/shared/types/database.types.ts` anlegen, auf `createClient<Database>` umstellen und `post.interface.ts` entfernen.
- [ ] F2: **Phase 8.4 / V9:** Kein `supabase`-Import mehr außerhalb von `services/`. Das betrifft auch `Posts.ts` und `SinglePost.ts`. Siehe D4.
- [ ] F3: **Phase 9 / V14 / E29:** Den Kalender an `availability_calendar` anbinden:
  - `isSelectableAsCheckIn` und `isSelectableAsCheckOut` einführen,
  - ausgebuchte Tage durchgestrichen mit Tooltip zeigen,
  - `canGoNext()` mit `hotels.booking_horizon_days` bauen.

  Heute ist Ausgebuchtes weiterhin wählbar.
- [ ] F4: **9b.2:** Eine Auswahlleiste unter der Zimmerliste bauen, etwa „2 Zimmer · 4 Nächte · 1.464 €“, mit Sprung zum Checkout.
- [ ] F5: **9b.8:** Bei einer Ablehnung den Hinweis zusätzlich an der Zimmerkarte und am Kalenderdatum zeigen und danach Kalender und Zimmerliste neu laden.
- [ ] F6: **Den Plan pflegen:**
  - den Kopf von E1–E46 auf E1–E51 bringen,
  - in 9b festhalten, dass die Punkte 8–9 umgesetzt sind,
  - V12 anpassen, denn es gibt inzwischen Frontend-Tests,
  - Phase 7b auf E50 umschreiben,
  - V17 und den Commit-Schnitt anpassen, weil Phase 8 und 9 noch ausstehen.

### G. Barrierefreiheit

- [ ] G1: Fehlermeldungen pro Feld mit `aria-describedby` verknüpfen, statt nur `aria-invalid` zu setzen.
- [ ] G2: Das „ד zum Zurücksetzen ist ein `span role="button"` innerhalb eines `<button>` (`Booking.ts:1421`). Daraus einen eigenen Knopf außerhalb der Tageszelle machen.
- [ ] G3: Den Tagen im Kalender ein `aria-label` mit dem vollen Datum und `aria-pressed` geben.
- [ ] G4: Die Zahl der `aria-live`-Regionen verringern, zum Beispiel nicht jede `data-service-amount`-Zeile.

---

## Was gut gelöst ist

- Die reine Fachlogik (`roomQuantity`, `services`, `breakfast`, `summary`) ist klein und getestet.
- Die Anfrage-ID schützt vor veralteten Suchantworten.
- Die Sperre `submitting` verhindert Doppelklicks.
- Die RPC-Antwort wird geprüft geparst.
- Das Modal hat genau einen Ausgang.
- Gästedaten werden per `textContent` eingefügt.
- Die Migrationen setzen `revoke`/`grant` sauber neu.
- Es gibt Datenbanktests für zwei Kategorien, den Rollback und die Nebenläufigkeit.
