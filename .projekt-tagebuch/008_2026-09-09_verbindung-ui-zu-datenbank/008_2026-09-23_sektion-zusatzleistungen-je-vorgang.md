[← Vorheriger Commit](007_2026-09-23_belegung-als-gesamtzahl-mehrere-kategorien.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): Sektion Zusatzleistungen je Vorgang (E49)

- **Commit:** `5cdbbc9`
- **Datum:** 2026-09-23
- **Autor:** Oliver Jung

## Worum geht es?

Aus dem Frühstück wird eine ganze **Sektion „Zusatzleistungen"**: Kinderbett, Tiefgarage, Haustier, Late Check-out und Massage kommen hinzu. Der TODO-Punkt aus Commit 003 („Unter Zimmerauswahl neue Section Zusätze") ist damit erledigt.

```text
 docs/datenbank/README.md                           |  39 +-
 docs/datenbank/schema.md                           |  20 +-
 src/shared/state/bookingState.ts                   |  38 +-
 src/views/BookingView/Booking.ts                   | 283 ++++++++--
 src/views/BookingView/breakfast.spec.ts            |   4 +-
 src/views/BookingView/breakfast.ts                 |   3 +
 src/views/BookingView/services.spec.ts             |  52 ++
 src/views/BookingView/services.ts                  | 110 ++++
 .../20260923102000_services_per_booking.sql        | 569 +++++++++++++++++++++
 supabase/seed.sql                                  |  21 +-
 supabase/tests/booking-extras.spec.ts              |  98 ++++
 11 files changed, 1181 insertions(+), 56 deletions(-)
```

Spannend ist dieser Commit, weil er eine **Vorhersage aus Commit 006** an der Wirklichkeit misst. Dort hieß es: _„der nächste Zusatz (Zustellbett, Kinderbett) ist ein `INSERT` in `services`, keine Migration."_ Die Migration am Anfang dieses Commits gibt dazu ehrlich Auskunft:

```sql
-- E47 hatte versprochen, dass der naechste Zusatz ein INSERT ist und keine Migration.
-- Fuer die Zeilen selbst stimmt das (siehe seed.sql). Die Migration braucht es trotzdem,
-- weil die neuen Leistungen etwas anderes zaehlen als das Fruehstueck:
```

Das Versprechen hat also **teilweise** gehalten: Neue Leistungen sind Datenzeilen – aber nur, solange sie dieselbe **Bezugsgröße** haben. Ein Stellplatz rechnet pro Nacht, nicht pro Person und Nacht.

## Die Änderungen im Detail

### 1. Die Entscheidung `E49` in einer Tabelle

In `docs/datenbank/README.md`:

```markdown
| Code | Leistung | `charge_basis` | Preis (Seed) |
| --- | --- | --- | --- |
| `CHILD_BED` | Kinderbett | `per_unit` | 0 € — nur mit Kind, höchstens eines je Zimmer |
| `GARAGE` | Tiefgarage (1 Stellplatz) | `per_night` | 15 € |
| `PET` | Haustier (1 Tier) | `per_stay` | 10 € |
| `LATE_CHECKOUT` | Late Check-out bis 15 Uhr | `per_stay` | 0 € — nach Verfügbarkeit |
| `MASSAGE` | Massage, 50 Minuten | `per_stay` | 75 € — Termin vor Ort |
```

Aus den sechs Punkten der Entscheidung sind drei besonders lehrreich:

- **„Einmal je Vorgang, an der ersten Buchung."** Ein Vorgang mit drei Zimmern besteht aus drei Zeilen in `bookings`. Ein Stellplatz lässt sich nicht durch drei teilen – also hängt er an der **ersten** Zeile.
- **„0 € ist erlaubt."** Kinderbett und Late Check-out kosten nichts, müssen aber trotzdem als Posten gespeichert werden – „sonst weiß niemand, dass das Bett bereitstehen muss". Ein Datensatz ist mehr als ein Preis.
- **„Hinweis statt Kapazitätsprüfung."** In Wirklichkeit hat die Tiefgarage nur begrenzt Plätze. Eine echte Prüfung wäre ein eigenes Inventar – das wird bewusst nicht gebaut; stattdessen steht in der Beschreibung „nach Verfügbarkeit". Eine **benannte Vereinfachung** ist keine verschwiegene.

Ausdrücklich verworfen wird das **Zustellbett**, das im TODO-Kommentar noch vorkam: Es hätte die Zimmerkapazität (`max_occupancy`) erhöht und damit Suche, Kalender und Buchung berührt. Ein Kinderbett dagegen ändert nichts an der Belegung.

### 2. Die Migration `20260923102000_services_per_booking.sql`

Zuerst werden bestehende `CHECK`-Constraints erweitert. In PostgreSQL geht das nur durch **Löschen und Neuanlegen**:

```sql
alter table public.services drop constraint services_charge_basis_check;
alter table public.services add constraint services_charge_basis_check
    check (charge_basis in ('per_person_night', 'per_night', 'per_stay', 'per_unit'));

alter table public.services drop constraint services_amount_cents_check;
alter table public.services add constraint services_amount_cents_check check (amount_cents >= 0);

-- Einen Kinderpreis gibt es nur, wo pro Person gerechnet wird. Ein Kinderpreis am
-- Stellplatz waere eine Zahl, die keine Rechnung je liest.
alter table public.services add constraint services_child_price_needs_person
    check (charge_basis = 'per_person_night' or child_amount_cents is null);

alter table public.services
    add column description text,
    add column sort_order int not null default 0;
```

Die Constraint-Namen (`services_charge_basis_check`) hat PostgreSQL beim ursprünglichen `CREATE TABLE` automatisch vergeben – nach dem Schema `<tabelle>_<spalte>_check`. Wer sie später ändern will, muss diese Namen kennen.

Der neue Constraint `services_child_price_needs_person` ist ein Beispiel für eine **Regel über zwei Spalten**: „Entweder rechnet die Leistung pro Person, oder es gibt keinen Kinderpreis."

In `booking_extras` bekommt `guest_kind` einen dritten Wert:

```sql
-- Die Regel "none genau dann, wenn nicht per_person_night" steht in create_booking,
-- nicht als CHECK: Ein Tabellen-CHECK kann nicht in services nachsehen.
alter table public.booking_extras drop constraint booking_extras_guest_kind_check;
alter table public.booking_extras add constraint booking_extras_guest_kind_check
    check (guest_kind in ('adult', 'child', 'none'));
```

Eine wichtige Grenze von `CHECK`-Constraints: Sie sehen nur **die eigene Zeile**. Regeln, die eine andere Tabelle brauchen, gehören in eine Funktion oder einen Trigger.

### 3. `create_booking` bekommt `p_services jsonb`

Die Funktion wird erneut ersetzt (alte Signatur gedroppt), der neue Parameter hat einen Default:

```sql
    p_with_breakfast boolean default false,
    p_services jsonb default '[]'::jsonb
```

Beispielaufruf laut Kommentar: `[{"code": "GARAGE"}, {"code": "CHILD_BED", "quantity": 2}]`.

Die Prüfung läuft in zwei Stufen. Zuerst nur die **Form** (Schritt 0c) – noch bevor bekannt ist, zu welchem Hotel die Buchung gehört:

```sql
for v_element in select value from jsonb_array_elements(v_services)
loop
    if jsonb_typeof(v_element) <> 'object' or jsonb_typeof(v_element -> 'code') is distinct from 'string' then
        perform public.reject_booking('ungueltige_leistung', p_check_in);
    end if;
    if (v_element ->> 'code') = any (v_svc_codes) then
        perform public.reject_booking('ungueltige_leistung', p_check_in);
    end if;

    -- Ohne `quantity` ist es eine Einheit - der Normalfall einer Checkbox.
    v_menge := 1;
    if v_element ? 'quantity' then
        -- … Zahl, ganzzahlig, 1..8
    end if;
    -- …
end loop;
```

Der Operator `?` prüft bei `jsonb`, ob ein Schlüssel existiert.

Danach (Schritt 4b) die **fachlichen** Regeln – mit dem Preis aus der Datenbank, nie aus dem Aufruf:

```sql
-- Das Fruehstueck hat seinen eigenen Parameter (E47/E48). Kaeme es auch hier
-- an, gaebe es zwei Wege zu derselben Position - und zwei Preise dafuer.
if v_svc_codes[i] = 'BREAKFAST' then
    perform public.reject_booking('ungueltige_leistung', p_check_in);
end if;

-- …

-- Eine Menge gibt es nur, wo die Bezugsgroesse eine Menge ist. "2 Massagen"
-- per Checkbox waere eine Bestellung, die die Oberflaeche nie anbietet.
if v_svc.charge_basis <> 'per_unit' and v_svc_quantities[i] <> 1 then
    perform public.reject_booking('ungueltige_leistung', p_check_in);
end if;

-- Kinderbett: nur mit Kind, hoechstens eines je Zimmer (E49).
if v_svc.code = 'CHILD_BED' and (v_children = 0 or v_svc_quantities[i] > least(v_children, v_zimmer_gesamt)) then
    perform public.reject_booking('ungueltige_belegung', p_check_in);
end if;

v_menge := case v_svc.charge_basis
    when 'per_night' then v_naechte
    when 'per_stay' then 1
    else v_svc_quantities[i]
end;
```

Das `case` über `charge_basis` ist der Kern: Die **Bezugsgröße** bestimmt, was eine Einheit ist. Drei Nächte Tiefgarage sind `quantity = 3`, eine Massage ist `quantity = 1`, egal wie lange der Aufenthalt dauert.

Beim Einfügen hängen die Leistungen nur an der ersten Zimmerzeile:

```sql
-- Die Leistungen je Vorgang haengen an der ERSTEN Buchung (E49). Verteilt auf
-- alle Zeilen hiesse ein Stellplatz "ein Drittel Stellplatz je Zimmer".
if j = 1 then
    v_extra := v_extra + v_svc_total;
end if;

-- …

if j = 1 and array_length(v_svc_ids, 1) is not null then
    insert into public.booking_extras (booking_id, service_id, guest_kind, quantity, unit_amount_cents, amount_cents)
    select v_booking_id, u.id, 'none', u.menge, u.unit, u.menge * u.unit
    from unnest(v_svc_ids, v_svc_mengen, v_svc_units) as u(id, menge, unit);
end if;
```

Wieder das Muster aus Commit 007: `unnest` über parallele Arrays, um mehrere Zeilen mit **einem** `INSERT … SELECT` anzulegen.

### 4. Seed

```sql
insert into public.services (id, hotel_id, code, name, description, sort_order, charge_basis, amount_cents)
values
    ('…302', '…001', 'CHILD_BED', 'Kinderbett', 'Babybett mit Bettwäsche, höchstens eines je Zimmer.', 20, 'per_unit', 0),
    ('…303', '…001', 'GARAGE', 'Tiefgarage', 'Ein Stellplatz in der hauseigenen Tiefgarage.', 30, 'per_night', 1500),
    ('…304', '…001', 'PET', 'Haustier', 'Ein Hund oder eine Katze, inklusive Decke und Napf.', 40, 'per_stay', 1000),
    ('…305', '…001', 'LATE_CHECKOUT', 'Late Check-out', 'Abreise bis 15 Uhr – nach Verfügbarkeit, wir bestätigen vor Ort.', 50, 'per_stay', 0),
    ('…306', '…001', 'MASSAGE', 'Massage', 'Eine Ganzkörpermassage à 50 Minuten – den Termin vereinbaren wir vor Ort.', 60, 'per_stay', 7500);
```

`sort_order` in Zehnerschritten (10, 20, 30 …) ist ein alter Trick: Soll später eine Leistung zwischen zwei bestehende, bekommt sie 25 – ohne die anderen umzunummerieren.

### 5. Frontend: `services.ts`

Die neue Datei `src/views/BookingView/services.ts` folgt dem Muster von `breakfast.ts` – „eine Bequemlichkeit, keine zweite Wahrheit":

```ts
export const CHILD_BED = 'CHILD_BED';

/** Bezugsgröße der Leistungen je Vorgang. `per_person_night` gehört dem Frühstück. */
export type ExtraChargeBasis = 'per_night' | 'per_stay' | 'per_unit';

export function getServiceAmountCents(service: ExtraService, quantity: number, nights: number): number {
    if (quantity <= 0) return 0;
    switch (service.chargeBasis) {
        case 'per_night':
            return nights * service.unitAmountCents;
        case 'per_stay':
            return service.unitAmountCents;
        case 'per_unit':
            return quantity * service.unitAmountCents;
    }
}

/** Höchstmenge einer Leistung: 1 bei Checkboxen, beim Kinderbett eines je Kind und Zimmer. */
export function getServiceMax(service: ExtraService, context: ServiceContext): number {
    if (context.rooms === 0) return 0;
    if (service.code === CHILD_BED) return Math.min(context.children, context.rooms);
    return 1;
}
```

`getServiceAmountCents` ist das **TypeScript-Spiegelbild** des SQL-`case` aus der Migration. Beide müssen dieselbe Regel abbilden; der Test `services.spec.ts` heißt deshalb ausdrücklich „dieselbe Mengenregel wie create_booking".

Beim Einlesen der Datenbankzeilen hilft ein **Type Guard**:

```ts
function isExtraChargeBasis(value: string): value is ExtraChargeBasis {
    return value === 'per_night' || value === 'per_stay' || value === 'per_unit';
}

export function buildExtraServices(rows: readonly ServiceRow[]): ExtraService[] {
    return rows
        .filter((row: ServiceRow): boolean => isExtraChargeBasis(row.charge_basis))
        .sort((a: ServiceRow, b: ServiceRow): number => a.sort_order - b.sort_order)
        .map(/* … */);
}
```

Der Rückgabetyp `value is ExtraChargeBasis` sagt TypeScript: Wenn die Funktion `true` liefert, ist `value` vom engeren Typ. Die Datenbank liefert `charge_basis` als beliebigen `string`; der Guard macht daraus einen der drei erlaubten Werte – und sortiert das Frühstück (`per_person_night`) nebenbei aus.

Und wie bei den Zimmermengen gibt es eine Abgleichsfunktion:

```ts
/**
 * Ohne Zimmer keine Leistungen, und das Kinderbett sinkt mit, wenn Kinder oder Zimmer
 * weniger werden. Stehen bliebe sonst eine Bestellung, die `create_booking` ablehnt.
 */
export function reconcileServices(selected: ServiceQuantities, services: readonly ExtraService[], context: ServiceContext): ServiceQuantities {
    const next: Record<string, number> = {};
    for (const service of services) {
        const wanted = selected[service.code] ?? 0;
        const value = Math.min(wanted, getServiceMax(service, context));
        if (value > 0) next[service.code] = value;
    }
    return next;
}
```

Sie wird an zwei Stellen in `Booking.ts` aufgerufen: nach jeder Änderung der Zimmermenge und nach jeder neuen Suche.

### 6. Frontend: die Sektion in `Booking.ts`

Die Zusatzleistungen werden in **einer** Abfrage geladen, das Frühstück daraus herausgesucht:

```diff
-                supabase.from('services').select('id, name, amount_cents, child_amount_cents, currency').eq('code', 'BREAKFAST').maybeSingle(),
+                supabase.from('services').select('id, code, name, description, charge_basis, amount_cents, child_amount_cents, currency, sort_order').order('sort_order'),
```

```ts
const serviceRows = services.data as ServiceRow[];
this.breakfastService = buildBreakfastService(serviceRows.find((row: ServiceRow): boolean => row.code === 'BREAKFAST') ?? null);
this.extraServices = buildExtraServices(serviceRows);
```

Das Markup ist in kleine Bausteine zerlegt: `getServicesSectionHtml()` (die Sektion), `getServiceRowShellHtml()` (eine Zeile mit Icon, Text und Preis), `getCheckboxHtml()` und `getServiceStepHtml()` (die Bedienelemente). Je nach Bezugsgröße bekommt eine Zeile eine Checkbox oder einen Mengenwähler:

```ts
const control =
    service.chargeBasis === 'per_unit'
        ? /*html*/ `
            <div class="shrink-0 flex items-center gap-2">
                ${this.getServiceStepHtml(service, -1, '&minus;', quantity === 0)}
                <output id="${inputId}" data-service-quantity="${service.code}" aria-live="polite" class="…">${quantity.toString()}</output>
                ${this.getServiceStepHtml(service, 1, '+', quantity >= max)}
            </div>
        `
        : this.getCheckboxHtml(inputId, `data-service-code="${service.code}"`, quantity > 0, max === 0);
```

Beim Kinderbett wird ein **`<output>`** statt eines `<input>` verwendet: Die Menge wird nur über `−`/`+` geändert, nicht eingetippt. `<output>` ist das semantisch passende HTML-Element für einen berechneten oder angezeigten Wert.

Die Icons stehen – wie die Ausstattungsmerkmale der Zimmer – im Frontend, zugeordnet über den `code`:

```ts
// Icons der Zusatzleistungen, zugeordnet über `services.code` – wie die Ausstattung über
// den `slug`. Darstellung gehört nicht in die Datenbank (E49).
const SERVICE_ICONS: Readonly<Record<string, string>> = {
    BREAKFAST: /*html*/ `<svg …>…</svg>`,
    CHILD_BED: /*html*/ `<svg …>…</svg>`,
    // …
};
```

Die Sektion erklärt ihren Geltungsbereich direkt unter der Überschrift: _„Gilt einmal für Ihren gesamten Aufenthalt – unabhängig von der Zimmeranzahl."_ Das ist die Oberflächenfassung der Regel „an der ersten Buchung".

### 7. Tests

`src/views/BookingView/services.spec.ts` prüft die Rechenregeln im Frontend:

```ts
describe('getServiceMax und reconcileServices', () => {
    it('Kinderbett: eines je Kind und Zimmer', () => {
        expect(getServiceMax(byCode(CHILD_BED), { rooms: 2, children: 3 })).toBe(2);
        expect(getServiceMax(byCode(CHILD_BED), { rooms: 3, children: 1 })).toBe(1);
        expect(getServiceMax(byCode(CHILD_BED), { rooms: 2, children: 0 })).toBe(0);
    });

    it('senkt das Kinderbett mit und räumt ohne Zimmer alles weg', () => {
        expect(reconcileServices({ [CHILD_BED]: 2, GARAGE: 1 }, services, { rooms: 1, children: 2 })).toEqual({ [CHILD_BED]: 1, GARAGE: 1 });
        expect(reconcileServices({ [CHILD_BED]: 1, GARAGE: 1 }, services, { rooms: 0, children: 2 })).toEqual({});
    });
});
```

`supabase/tests/booking-extras.spec.ts` bekommt einen neuen Block „Zusatzleistungen je Vorgang (E49)", u.a.:

```ts
it('hängt die Leistungen einmal an die erste Buchung — Menge nach Bezugsgröße', async () => {
    // …
    // 3 Nächte Tiefgarage + eine Massage — auf der ersten Buchung, nicht auf jeder.
    const leistungen = 3 * GARAGE_CENTS + MASSAGE_CENTS;
    expect(gebucht.bookings.map((b) => b.extras_amount_cents)).toEqual([leistungen, 0]);
    // …
    // Das Kinderbett steht als 0-Euro-Posten da: kostenlos, aber bestellt.
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.guest_kind === 'none')).toBe(true);
});
```

Weitere Tests prüfen die Ablehnungen: Frühstück in der Liste, doppelte Codes, eine Menge an einer Checkbox-Leistung, eine unbekannte Leistung (maskiert als `nicht_buchbar`) und ein Kinderbett ohne Kind.

## Was wurde erreicht?

Der Gast kann jetzt neben Zimmern und Frühstück fünf weitere Leistungen dazubuchen. Die Datenbank prüft Form, Mengen und die Kinderbett-Regel und friert die Preise ein; die Oberfläche zeigt vorher, was es kostet.

| Technik                                          | Wozu                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Bezugsgröße (`charge_basis`) statt neuer Spalten | neue Leistungen sind Datenzeilen, solange die Einheit passt    |
| `CHECK` droppen und neu anlegen                  | erlaubte Werte in PostgreSQL erweitern                         |
| Regel über zwei Spalten als `CHECK`              | „Kinderpreis nur bei Personenpreis"                            |
| Grenze von `CHECK` kennen                        | tabellenübergreifende Regeln gehören in die Funktion           |
| 0-Euro-Posten speichern                          | eine Bestellung ist mehr als ein Preis                         |
| Type Guard (`value is …`)                        | `string` aus der Datenbank sicher auf erlaubte Werte verengen  |
| `<output>` für angezeigte Werte                  | semantisches HTML statt zweckentfremdetem `<input>`            |
| `sort_order` in Zehnerschritten                  | später einfügen, ohne umzunummerieren                          |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](009_2026-09-26_customer-address-management.md)
