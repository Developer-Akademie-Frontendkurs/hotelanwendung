[← Vorheriger Commit](029_2026-10-21_move-markup-into-templates.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# test(booking): add tests for addresses, service parsing and store rules (E1-E5)

- **Commit:** `d08bab3`
- **Datum:** 2026-10-21
- **Autor:** Oliver Jung

## Worum geht es?

Gruppe **E** des Reviews: Tests. Der Commit fügt keine Funktion hinzu und ändert keine Zeile Anwendungscode – er sichert ab, was in den Wochen davor gebaut wurde.

```text
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |  12 +-
 src/shared/services/booking.service.spec.ts        | 142 +++++++++
 src/shared/state/bookingState.spec.ts              | 121 ++++++++
 src/views/BookingView/address.spec.ts              | 127 ++++++++
 supabase/tests/customer-addresses.spec.ts          | 324 +++++++++++++++++++++
 supabase/tests/rates.spec.ts                       |  26 +-
 6 files changed, 745 insertions(+), 7 deletions(-)
```

| Punkt  | Datei                                         | Was geprüft wird                                                          |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------- |
| **E1** | `src/views/BookingView/address.spec.ts`       | `getInvalidFields` und die Adress-Hilfsfunktionen                         |
| **E2** | `src/shared/services/booking.service.spec.ts` | Auswerten von Ablehnung und Antwort aus `create_booking`, `p_*`-Parameter |
| **E3** | `src/shared/state/bookingState.spec.ts`       | Regeln im Store, z. B. „ohne Zimmer kein Frühstück"                       |
| **E4** | `supabase/tests/customer-addresses.spec.ts`   | Datenbankseite der Adressen (`E50`/`E51`)                                 |
| **E5** | `supabase/tests/rates.spec.ts`                | ein Test, der nach einigen Monaten von selbst rot wurde                   |

Im Review-Dokument werden außerdem **D8** (Commit 029) und **E1–E5** abgehakt.

## Die Änderungen im Detail

### 1. E1 – `address.spec.ts`: Formularprüfung als reine Funktion

`getInvalidFields` bekommt die Kontaktdaten und liefert die Liste der fehlerhaften Felder. Weil sie eine reine Funktion ist (`V16` hatte das so vorbereitet), braucht der Test weder DOM noch Datenbank. Eine kleine **Fabrikfunktion** liefert ein gültiges Formular, das jeder Test gezielt verändert:

```ts
/** Ein vollständiges Formular ohne Rechnungsadresse. */
function details(overrides: Partial<CustomerDetails> = {}): CustomerDetails {
    return {
        customer: { firstName: 'Erika', lastName: 'Muster', email: 'erika@beispiel.at', phone: null },
        residence: { street: 'Hauptplatz', houseNumber: '12a', postalCode: '9500', city: 'Villach', countryCode: 'AT' },
        billing: null,
        ...overrides,
    };
}
```

So zeigt jeder Test nur noch, **was anders ist** als im Normalfall. Mit `it.each` werden viele Eingaben auf einmal geprüft – hier die E-Mail-Grenzfälle:

```ts
describe('E-Mail – grob geprüft wie in create_booking', () => {
    it.each(['erika@beispiel.at', 'e@b', '  erika@beispiel.at  '])('akzeptiert „%s“', (email: string) => {
        expect(getInvalidFields(withCustomer({ email }))).toEqual([]);
    });

    it.each(['erika', '@beispiel.at', 'erika@', 'eri ka@beispiel.at', 'erika@@beispiel.at'])('lehnt „%s“ ab', (email: string) => {
        expect(getInvalidFields(withCustomer({ email }))).toEqual(['customer.email']);
    });
});
```

`%s` im Testnamen wird durch den jeweiligen Wert ersetzt – im Testprotokoll steht dann z. B. „lehnt „erika@" ab". Geprüft wird außerdem die **Reihenfolge** der gemeldeten Felder: Sie muss der Formularreihenfolge entsprechen, denn die View setzt den Fokus ins erste fehlerhafte Feld (Commit 010).

### 2. E2 – `booking.service.spec.ts`: Was kommt aus der Datenbank zurück?

Die Parser `parseRejection` und `parseCreatedBooking` sind **privat** – sie werden nicht exportiert. Getestet werden sie deshalb über die öffentliche Funktion `createBooking`, mit einem gemockten `supabase.rpc`. Das ist ein bewährtes Prinzip: **Teste das Verhalten über die öffentliche Schnittstelle**, nicht die Interna.

Eine Hilfsfunktion baut die Fehlerantwort, wie PostgREST sie bei `reject_booking` liefert (SQL-Fehlercode `P0001`, Details als JSON-String):

```ts
/** Eine P0001-Antwort, wie PostgREST sie für reject_booking liefert. */
function rejectionResponse(details: string | null, message = 'Satz aus der Datenbank'): { data: null; error: { code: string; message: string; details: string | null } } {
    return { data: null, error: { code: 'P0001', message, details } };
}
```

Spannend sind die **Negativfälle**: Formen, die zwar wie eine Ablehnung aussehen, aber keine sind. Sie dürfen nicht als „ausgebucht" o. ä. beim Gast landen, sondern müssen als Fehler geworfen werden:

```ts
it.each([
    ['ohne DETAIL', null],
    ['mit leerem DETAIL', ''],
    ['mit einem Array als DETAIL', JSON.stringify([{ code: 'ausgebucht' }])],
    ['mit JSON ohne code', JSON.stringify({ datum: '2026-10-01' })],
    ['mit einem code, der kein Text ist', JSON.stringify({ code: 7 })],
    ['mit JSON null', 'null'],
])('wirft bei P0001 %s – das ist keine Ablehnung', async (_label: string, details: string | null) => {
    rpc.mockResolvedValue(rejectionResponse(details));

    expect((await failure()).outcomeUnknown).toBe(false);
});
```

Für die Erfolgsantwort gilt das Gegenteil: Ist sie unvollständig, wird geworfen – aber mit `outcomeUnknown: true`, denn die Buchung **kann** in der Datenbank trotzdem angelegt sein (`V15`):

```ts
it.each([
    ['ohne Buchungen', { bookings: [] }],
    ['mit grand_total_cents als Text', { grand_total_cents: '30000' }],
    ['mit einer Zeile ohne Währung', { bookings: [bookingRow(), bookingRow({ currency: null })] }],
    // …
])('wirft %s – angelegt sein kann die Buchung trotzdem', async (_label: string, data: Record<string, unknown>) => {
    rpc.mockResolvedValue(createdResponse(data));

    expect((await failure()).outcomeUnknown).toBe(true);
});
```

Zuletzt prüft der Test die **Übersetzung in die `p_*`-Parameter**: Ohne Rechnungsadresse darf kein einziger `p_billing_*`-Schlüssel mitgeschickt werden.

```ts
expect(Object.keys(params).filter((key: string): boolean => key.startsWith('p_billing_'))).toEqual([]);
```

### 3. E3 – Regeln im Store

`bookingState` enthält fachliche Regeln, die man in der Oberfläche leicht übersieht. Der neue Abschnitt „Regeln (E3)" hält sie als Tests fest – lesbar wie eine Spezifikation:

```ts
it('nimmt das Frühstück mit dem letzten Zimmer weg – es kommt beim nächsten Zimmer nicht unbestellt zurück', () => {
    selectRoom();
    bookingState.setBreakfast(true);

    bookingState.selectRoomQuantity('double', 0);
    bookingState.selectRoomQuantity('double', 1);

    expect(bookingState.getBreakfast()).toBe(false);
});

it('gibt die Mengen als Kopie heraus', () => {
    selectRoom();
    // Was der Aufrufer am Ergebnis ändert, kommt im Store nicht an.
    Object.assign(bookingState.getRoomQuantities(), { double: 5 });
    expect(bookingState.getRoomQuantity('double')).toBe(1);
});
```

Der zweite Test sichert eine Eigenschaft ab, die man sonst nur im Code-Review sieht: Ein Store darf seine internen Objekte nicht herausgeben, sonst kann jeder Aufrufer ihn **an `notify` vorbei** verändern. Weitere Fälle: kein Kinderbett ohne Kind, Mengen von 0 verschwinden ganz, `reset()` leert den ganzen Entwurf und meldet es, nach `unsubscribe` kommt keine Meldung mehr.

### 4. E4 – Datenbanktests für Sitz- und Rechnungsadresse

Die größte neue Datei (324 Zeilen, 29 Fälle) prüft die Datenbankseite von `E50`/`E51` gegen eine laufende lokale Supabase-Instanz. Der Kopfkommentar erklärt, warum zwei Clients im Spiel sind:

```ts
/**
 * Gebucht wird wie in `create-booking.spec.ts` mit dem `anonClient` – Adressen entstehen
 * ausschließlich in create_booking. Geprüft und manipuliert wird mit dem `serviceClient`:
 * Er umgeht RLS, aber nicht den Trigger und nicht die Fremdschlüssel. Genau das ist der
 * Punkt – beides soll auch gegen das Personal halten.
 */
```

Die Testgruppen:

| Gruppe                                  | Beispiel                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| Sitzadresse ist Pflicht                 | ohne Straße, PLZ aus Leerzeichen, Land `FR` → `ungueltige_adresse`                    |
| Rechnungsadresse: alles/nichts          | nur Firma oder ohne Hausnummer → abgelehnt; nur ein Land → **keine** Rechnungsadresse |
| Wiederverwendung über `match_key`       | `'  TESTSTRAßE '` und `'Teststraße'` sind dieselbe Adresse                            |
| Trigger `guard_customer_address_update` | benutzte Adresse ändern → Fehler `55000`, archivieren erlaubt                         |
| Zusammengesetzte Fremdschlüssel         | Buchung darf nicht auf die Adresse eines **anderen** Kunden zeigen → Fehler `23503`   |

Ein schönes Beispiel für einen Test, der eine ganze Geschichte erzählt – der Umzug:

```ts
it('archiviert beim Umzug die alte Sitzadresse und holt sie beim Zurückziehen wieder', async () => {
    const mail = email('umzug');
    const first = await bookOk(mail);
    const moved = await bookOk(mail, { p_street: 'Hauptplatz', p_house_number: '12a' });
    expect(moved.residence_address_id).not.toBe(first.residence_address_id);

    // …
    const back = await bookOk(mail);
    expect(back.residence_address_id).toBe(first.residence_address_id);

    const afterReturn = await addressesOf(mail);
    // Reaktiviert statt dupliziert – und immer genau eine aktive Sitzadresse.
    expect(afterReturn).toHaveLength(2);
});
```

Ehrlich dokumentiert wird auch, was **nicht** geht: Aufräumen. `booking_events` ist nur anhängbar (`E12`), auch für `service_role`. Solange ein Ereignis an einer Buchung hängt, lassen sich Buchung, Adressen und Kunde nicht löschen. Deshalb bekommt jeder Testlauf eindeutige E-Mail-Adressen und jede Buchung ihre eigene Nacht:

```ts
/** Jede Buchung bekommt ihre eigene Nacht – so nimmt kein Fall dem anderen ein Zimmer weg. */
let nextNight = 5;

function email(label: string): string {
    return `adresse.${label}.${fixture.roomTypeId.slice(0, 8)}@muster.test`;
}
```

Laut Review-Dokument wurde zusätzlich eine **Gegenprobe** gemacht: Mit abgeschaltetem Trigger schlagen die Trigger-Tests fehl. Ein Test, der auch ohne die geprüfte Logik grün bliebe, wäre wertlos.

### 5. E5 – ein Test, der mit der Zeit rot wird

Beim Lauf von `pnpm test:db` fiel ein Test in `rates.spec.ts` auf: „meldet für den gedeckten Seed-Bestand keine Lücke". Der Seed legt Preise für 13 Monate **ab dem Tag des letzten Resets** an; der Test prüfte aber 365 Tage **ab heute**. Wer die Datenbank im September zurückgesetzt hat, bekommt im Oktober einen roten Test – obwohl nichts kaputt ist.

```diff
-        const { data, error } = await serviceClient.rpc('find_rate_gaps', { tage: 365 });
+        const { data: lastRate, error: rateError } = await serviceClient
+            .from('room_type_rates')
+            .select('valid_to')
+            .eq('rate_plan_id', SEED_RATE_PLAN_ID)
+            .order('valid_to', { ascending: false })
+            .limit(1)
+            .single();
+        expect(rateError).toBeNull();
+
+        const coveredDays = Math.round((Date.parse((lastRate as { valid_to: string }).valid_to) - Date.parse(isoDay(0))) / 86_400_000);
+        expect(coveredDays, 'Die Seed-Preise sind abgelaufen – lokale Datenbank zurücksetzen (pnpm db:reset).').toBeGreaterThan(0);
+
+        const { data, error } = await serviceClient.rpc('find_rate_gaps', { tage: Math.min(coveredDays, 365) });
```

Zwei Lehren daraus:

- **Tests, die von „heute" abhängen, altern.** Entweder man fixiert die Zeit, oder man prüft – wie hier – relativ zu den tatsächlich vorhandenen Daten.
- **Fehlermeldungen in `expect` sind Dokumentation.** Das zweite Argument von `expect(wert, 'Nachricht')` erscheint im Testprotokoll und sagt direkt, was zu tun ist.

## Was wurde erreicht?

Gruppe **E des Reviews ist erledigt**. Die Buchungsseite hat jetzt Tests auf allen Schichten: reine Funktionen (E1), Service mit gemocktem Client (E2), Store (E3) und Datenbank (E4). Offen sind damit noch Gruppe **F** (die Punkte aus dem Umsetzungsplan) und Gruppe **G** (Barrierefreiheit).

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](031_2026-10-21_posts-spike-migration.md)
