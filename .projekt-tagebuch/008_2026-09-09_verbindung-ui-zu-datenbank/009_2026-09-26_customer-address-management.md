[← Vorheriger Commit](008_2026-09-23_sektion-zusatzleistungen-je-vorgang.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat: add customer address management and booking address validation

- **Commit:** `04be98d`
- **Datum:** 2026-09-26
- **Autor:** Oliver Jung

## Worum geht es?

Die letzte große Lücke aus der Bestandsaufnahme von Commit 001 wird geschlossen: _„Rechnungsadress-Formular hat **kein Ziel im Schema**."_ Ab diesem Commit landen Name, E-Mail, Telefon, Wohnadresse und – optional – eine abweichende Rechnungsadresse in der Datenbank.

```text
 docs/datenbank/README.md                           |  84 ++-
 docs/datenbank/schema.md                           |  81 ++-
 src/views/BookingView/Booking.ts                   | 340 +++++++++--
 src/views/BookingView/address.ts                   | 115 ++++
 .../20260926101000_customer_addresses.sql          | 206 +++++++
 .../20260926102000_create_booking_addresses.sql    | 641 +++++++++++++++++++++
 supabase/tests/availability.spec.ts                |   2 +
 supabase/tests/booking-extras.spec.ts              |   7 +
 supabase/tests/bookings.spec.ts                    |   6 +
 supabase/tests/create-booking.spec.ts              |   6 +
 supabase/tests/helpers/fixtures.ts                 |  13 +
 supabase/tests/rls-abnahme.spec.ts                 |   5 +
 12 files changed, 1425 insertions(+), 81 deletions(-)
```

Und wieder revidiert ein Commit eine eigene frühere Entscheidung: Die in `E42` geplante Tabelle `billing_addresses` wurde **nie migriert** – sie wird ersetzt durch `customer_addresses`, bevor es sie gab.

## Die Änderungen im Detail

### 1. `E50` und `E51`: Sitzadresse und optionale Rechnungsadresse

In `docs/datenbank/README.md` beginnt die neue Runde mit einer fachlichen Klarstellung:

```markdown
Ausgangslage: Beim Anbinden des Adressformulars kam eine fachliche Unterscheidung dazu, die E42 nur
als Begründung kannte: Die **Sitzadresse** gehört zum Kunden (wo er wohnt), die **Rechnungsadresse**
ist optional. Ein Kunde hat genau eine Sitzadresse, aber über die Zeit mehrere Rechnungsadressen
(Zweitwohnsitz, Firma A, später Firma B). Je Buchungsvorgang gibt es eine Sitzadresse und höchstens
eine Rechnungsadresse. Fehlt sie, geht die Rechnung an die Sitzadresse.
```

Daraus folgen drei Regeln, die der Commit direkt **ins Schema** übersetzt:

| Regel                                          | Umsetzung im Schema                              |
| ---------------------------------------------- | ------------------------------------------------ |
| genau **eine** aktive Sitzadresse je Kunde     | partieller Unique-Index                          |
| beliebig viele Rechnungsadressen je Kunde      | 1:n ohne Grenze                                  |
| Rechnungsadresse je Buchung **optional**       | `bookings.billing_address_id` ist nullable       |

Zwei verworfene Alternativen sind lehrreich:

- **Sitzadresse als Spalten an `customers`.** Sie wäre überschreibbar – und die Rechnung einer alten Buchung hätte nach einem Umzug rückwirkend eine andere Anschrift.
- **Die Sitzadresse als `billing`-Zeile kopieren**, wenn keine Rechnungsadresse angegeben ist. Dann ließe sich nicht mehr unterscheiden, ob der Gast eine abweichende Rechnungsadresse **wollte**.

Und ein ehrlich benannter Preis:

```markdown
**Preis, benannt:** Ohne Login kann **jeder, der die E-Mail eines Kunden kennt**, mit einer Buchung
dessen Namen, Telefon und aktive Sitzadresse ändern. Alte Buchungen sind geschützt, denn ihre
Adressen sind unveränderlich. Die Stammdaten sind es nicht. Das wird mit den Kundenkonten
abgesichert, nicht vorher.
```

Eine bekannte Sicherheitslücke wird hier nicht verschwiegen, sondern mit ihrem Lösungsweg dokumentiert.

### 2. Migration `20260926101000_customer_addresses.sql`

#### Drei kleine `immutable`-Funktionen

```sql
-- Die Laenderliste an EINER Stelle …
create or replace function public.is_supported_country(p_code text) returns boolean
language sql
immutable
set search_path = ''
as $$
select p_code in ('AT', 'DE', 'CH', 'IT', 'SI');
$$;

-- "Gleiche Adresse" heisst: gleich nach trim, Kleinschreibung und zusammengefassten
-- Leerzeichen. "Hauptstr." und "Hauptstrasse" bleiben verschieden - mehr Unschaerfe
-- waere Raten, und eine Adresse zu viel schadet weniger als zwei falsch
-- zusammengelegte (E51).
create or replace function public.normalize_address_part(p_value text) returns text
language sql
immutable
set search_path = ''
as $$
select lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;
```

Und darauf aufbauend ein **Vergleichsschlüssel** für eine ganze Adresse:

```sql
-- Das Trennzeichen (Unit Separator) kommt in keiner Eingabe vor, damit
-- "Haupt|str 1" und "Hauptstr|1" nicht gleich werden.
create or replace function public.address_match_key(
    p_company text, p_street text, p_house_number text, p_postal_code text, p_city text, p_country_code text
) returns text
language sql
immutable
set search_path = ''
as $$
select concat_ws(
    chr(31),
    public.normalize_address_part(p_company),
    public.normalize_address_part(p_street),
    public.normalize_address_part(p_house_number),
    public.normalize_address_part(p_postal_code),
    public.normalize_address_part(p_city),
    upper(btrim(coalesce(p_country_code, '')))
);
$$;
```

Der Kommentar zum Trennzeichen beschreibt ein echtes Problem: Würde man die Teile einfach aneinanderhängen, wären „Haupt" + „str 1" und „Hauptstr" + „1" nach dem Zusammensetzen möglicherweise gleich. `chr(31)` (ASCII „Unit Separator") ist ein Steuerzeichen, das kein Mensch in ein Formular tippt.

Die Wahl bei der Unschärfe ist eine klassische Abwägung: Lieber eine Adresse doppelt speichern (harmlos) als zwei verschiedene Adressen fälschlich zusammenlegen (gefährlich – die Rechnung ginge an die falsche Anschrift).

#### Die Tabelle

```sql
create table public.customer_addresses (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers on delete restrict,
    kind text not null check (kind in ('residence', 'billing')),
    company text,
    street text not null,
    house_number text not null,
    postal_code text not null,
    city text not null,
    country_code text not null,
    match_key text generated always as (
        public.address_match_key(company, street, house_number, postal_code, city, country_code)
    ) stored not null,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint customer_addresses_country_supported check (public.is_supported_country(country_code)),
    constraint customer_addresses_company_billing_only check (kind = 'billing' or company is null),
    constraint customer_addresses_not_blank check (
        btrim(street) <> '' and btrim(house_number) <> '' and btrim(postal_code) <> '' and btrim(city) <> ''
    ),
    -- Ziel des zusammengesetzten Fremdschluessels aus bookings: Eine Buchung kann nur
    -- auf Adressen IHRES Kunden zeigen.
    constraint customer_addresses_id_customer_key unique (id, customer_id)
);
```

Wichtig: Eine generierte Spalte darf nur `immutable`-Funktionen aufrufen – deshalb sind die drei Hilfsfunktionen oben so deklariert.

#### Zwei besondere Indizes

```sql
-- Regel 1: eine aktive Sitzadresse je Kunde.
create unique index customer_addresses_one_residence_idx on public.customer_addresses (customer_id)
    where kind = 'residence' and archived_at is null;

-- Jede Adresse gibt es je Kunde und Art nur EINMAL - auch archiviert.
create unique index customer_addresses_match_idx on public.customer_addresses (customer_id, kind, match_key);
```

Der erste ist ein **partieller Unique-Index**: Die Eindeutigkeit gilt nur für die Zeilen, die das `WHERE` erfüllen. Ein Kunde darf also viele **archivierte** Sitzadressen haben, aber nur eine aktive. Das ist ein sehr nützliches PostgreSQL-Werkzeug, um Regeln wie „höchstens eine aktive …" direkt in der Datenbank zu erzwingen.

#### Unveränderlichkeit per Trigger statt Policy

Die ursprüngliche Planung (`E43`) sah eine UPDATE-Policy vor. Der Commit begründet, warum ein Trigger besser ist:

```sql
-- E43 hatte das als UPDATE-Policy geplant. Ein Trigger ist hier die bessere Wahl:
--   - Die Policy haette auch das ARCHIVIEREN einer benutzten Sitzadresse verboten -
--     und genau das passiert bei jedem Umzug.
--   - Der Service-Role-Key und create_booking (SECURITY DEFINER) umgehen RLS. Einen
--     Trigger umgeht nur, wer ihn abschaltet.
create or replace function public.guard_customer_address_update() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (new.customer_id, new.kind, new.company, new.street, new.house_number, new.postal_code, new.city, new.country_code)
       is distinct from
       (old.customer_id, old.kind, old.company, old.street, old.house_number, old.postal_code, old.city, old.country_code)
       and exists (
           select 1 from public.bookings b
           where b.residence_address_id = old.id or b.billing_address_id = old.id
       ) then
        raise exception 'Adresse ist bereits an einer Buchung - eine Korrektur ist eine neue Adresse'
            using errcode = '55000';
    end if;
    return new;
end;
$$;
```

Zwei Techniken:

- **Zeilenvergleich** `(a, b, c) is distinct from (x, y, z)`: vergleicht mehrere Spalten auf einmal und behandelt dabei `NULL` korrekt (`NULL is distinct from NULL` ist `false`, anders als `NULL <> NULL`, das `NULL` ergibt).
- **`archived_at` fehlt in der Liste** – genau das ist der Trick: Archivieren bleibt erlaubt, inhaltliche Änderungen nicht.

Für Lernende ist der Unterschied zwischen **RLS-Policy** und **Trigger** zentral: Policies filtern, **wer** etwas tun darf, und gelten nicht für Rollen, die RLS umgehen. Trigger prüfen, **was** passiert, und gelten für jeden.

#### Verweise aus `bookings`

```sql
alter table public.bookings
    add column residence_address_id uuid,
    add column billing_address_id uuid,
    add constraint bookings_residence_address_fkey foreign key (residence_address_id, customer_id)
        references public.customer_addresses (id, customer_id) on delete restrict,
    add constraint bookings_billing_address_fkey foreign key (billing_address_id, customer_id)
        references public.customer_addresses (id, customer_id) on delete restrict;

-- Pflicht fuer jede NEUE Buchung. NOT VALID, weil die Buchungen vor dieser Migration
-- keine Adresse haben und keine bekommen koennen - erfinden waere schlimmer als leer.
alter table public.bookings
    add constraint bookings_residence_address_required check (residence_address_id is not null) not valid;
```

- Der **zusammengesetzte Fremdschlüssel** `(residence_address_id, customer_id)` stellt sicher, dass eine Buchung nur auf eine Adresse **ihres eigenen** Kunden zeigen kann. Dafür braucht die Zieltabelle den `UNIQUE (id, customer_id)` von oben.
- **`CHECK … NOT VALID`** ist die Lösung für ein typisches Migrationsproblem: Neue Zeilen sollen die Regel erfüllen, alte können es nicht. PostgreSQL prüft den Constraint dann bei jedem neuen `INSERT`/`UPDATE`, aber nicht rückwirkend.

### 3. Migration `20260926102000_create_booking_addresses.sql`

`create_booking` wird zum vierten Mal in diesem Branch ersetzt und bekommt elf neue Parameter:

```sql
    p_services jsonb default '[]'::jsonb,
    -- Sitzadresse: Pflicht, trotz Default. Parameter mit Default muessen hinten stehen,
    -- und ein fehlender Wert soll 'ungueltige_adresse' sein, keine PGRST202 (E51).
    p_street text default null,
    p_house_number text default null,
    p_postal_code text default null,
    p_city text default null,
    p_country_code text default null,
    -- Rechnungsadresse: optional, alles oder nichts (E51).
    p_billing_company text default null,
    p_billing_street text default null,
    -- …
```

Der Kommentar erklärt eine SQL-Eigenart: Nach dem ersten Parameter mit Default müssen **alle** folgenden einen Default haben. Die Pflichtprüfung erfolgt deshalb im Rumpf – und liefert so eine lesbare Ablehnung statt eines PostgREST-Fehlers.

Die Prüfung „alles oder nichts" bei der Rechnungsadresse:

```sql
-- Die Rechnungsadresse ist alles oder nichts: Ist IRGENDEIN Feld gesetzt, muessen alle
-- Pflichtfelder gesetzt sein. Eine halbe Rechnungsadresse ist kein "ohne
-- Rechnungsadresse", sondern ein Fehler im Formular.
v_with_billing := v_b_company is not null or v_b_street <> '' or v_b_house_number <> '' or v_b_postal_code <> '' or v_b_city <> '';

if v_with_billing and (
    v_b_street = '' or v_b_house_number = '' or v_b_postal_code = '' or v_b_city = ''
    or not public.is_supported_country(v_b_country_code)
) then
    perform public.reject_booking('ungueltige_adresse', p_check_in);
end if;
```

Beim Kunden gewinnt jetzt die **neueste Eingabe** (vorher blieb der erste Datensatz stehen):

```sql
-- Name und Telefon: die neueste Eingabe gewinnt (E51). Die E-Mail bleibt in der
-- Originalschreibweise der ersten Buchung (E32).
```

Und die Sitzadresse wird wiederverwendet oder „umgezogen":

```sql
-- Gesucht wird ueber match_key - auch unter den archivierten: Wer zurueckzieht,
-- bekommt seine alte Zeile zurueck. Die bisher aktive wird archiviert, BEVOR die
-- neue aktiv wird, sonst schlaegt der Index "eine aktive Sitzadresse" an.
v_match_key := public.address_match_key(null, v_street, v_house_number, v_postal_code, v_city, v_country_code);

select a.id, a.archived_at into v_address
from public.customer_addresses a
where a.customer_id = v_customer_id and a.kind = 'residence' and a.match_key = v_match_key;

if v_address.id is null or v_address.archived_at is not null then
    update public.customer_addresses a
    set archived_at = now()
    where a.customer_id = v_customer_id and a.kind = 'residence' and a.archived_at is null;
end if;
```

Die **Reihenfolge** ist entscheidend: Erst archivieren, dann die neue Zeile aktiv machen – sonst gäbe es kurz zwei aktive Sitzadressen, und der partielle Unique-Index würde die Transaktion abbrechen.

### 4. Frontend: `address.ts`

Die neue Datei `src/views/BookingView/address.ts` enthält Typen, Länderliste und Prüfung – wieder „eine Bequemlichkeit, keine zweite Wahrheit".

```ts
/** Die Länder aus `is_supported_country()` – Reihenfolge wie im Auswahlfeld. */
export const COUNTRIES = [
    { code: 'AT', label: 'Österreich' },
    { code: 'DE', label: 'Deutschland' },
    { code: 'CH', label: 'Schweiz' },
    { code: 'IT', label: 'Italien' },
    { code: 'SI', label: 'Slowenien' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];
```

`as const` plus `(typeof COUNTRIES)[number]['code']` ist ein sehr praktisches TypeScript-Muster: Aus einem Array von Objekten wird automatisch der Union-Typ `'AT' | 'DE' | 'CH' | 'IT' | 'SI'` abgeleitet. Kommt ein Land hinzu, passt sich der Typ von selbst an.

Noch eleganter ist der Typ für ungültige Felder – mit **Template Literal Types**:

```ts
/** Ein Feld, das fehlt oder ungültig ist – `<Gruppe>.<Feld>`. */
export type InvalidField = `customer.${'firstName' | 'lastName' | 'email'}` | `${'residence' | 'billing'}.${'street' | 'houseNumber' | 'postalCode' | 'city' | 'countryCode'}`;
```

TypeScript bildet daraus alle Kombinationen: `'customer.firstName'`, `'residence.street'`, `'billing.city'` usw. – 13 erlaubte Werte, ohne sie einzeln aufzuschreiben.

Die Prüfung selbst:

```ts
export function getInvalidFields(details: CustomerDetails): InvalidField[] {
    const invalid: InvalidField[] = [];
    const { customer, residence, billing } = details;

    if (isBlank(customer.firstName)) invalid.push('customer.firstName');
    if (isBlank(customer.lastName)) invalid.push('customer.lastName');
    if (!/^[^\s@]+@[^\s@]+$/.test(customer.email.trim())) invalid.push('customer.email');

    for (const field of ADDRESS_FIELDS) {
        if (isBlank(residence[field])) invalid.push(`residence.${field}`);
    }
    // …
    return invalid;
}
```

Bemerkenswert ist der Kommentar zur E-Mail-Prüfung: _„Die E-Mail wird nur grob geprüft (ein `@` mit etwas davor und danach) … Ob sie ankommt, weiß erst die Bestätigungsmail."_ Perfekte E-Mail-Regex gibt es nicht; eine grobe Prüfung plus echte Zustellung ist der pragmatische Weg.

### 5. Frontend: das Formular in `Booking.ts`

Aus „Rechnungsadresse" wird „Ihre Daten" – mit Wohnadresse und optionalem Rechnungsblock:

```html
<fieldset class="flex flex-col gap-3">
    <legend class="…">Wohnadresse</legend>
    ${this.getAddressFieldsHtml('', '')}
</fieldset>

<label class="…">
    <input type="checkbox" name="rechnung-abweichend" data-billing-toggle class="…" />
    Rechnungsadresse weicht von der Wohnadresse ab
</label>

<fieldset id="booking-billing" hidden class="flex flex-col gap-3">
    <legend class="…">Rechnungsadresse</legend>
    ${this.getBillingFieldHtml('rechnung-firma', 'Firma / z. Hd. (optional)', 'Musterfirma GmbH', 'billing organization', 'text', 'w-full', false)}
    ${this.getAddressFieldsHtml('rechnung-', 'billing ')}
</fieldset>
```

- **`<fieldset>` + `<legend>`** gruppieren zusammengehörige Felder – Screenreader lesen die Legende beim Betreten der Gruppe vor.
- **`autocomplete="billing address-line1"`** – das Präfix `billing` ist ein offizieller Abschnittsname im HTML-Standard. Der Browser kann so Wohn- und Rechnungsadresse getrennt automatisch ausfüllen.
- Der Rechnungsblock wird mit `hidden` nur **ausgeblendet**, nicht entfernt: „Wer die Checkbox versehentlich abwählt, verliert seine Eingabe nicht."

Das Land ist jetzt eine **Auswahl** statt Freitext:

```ts
/** Land als Auswahl statt Freitext (E42): „Österreich"/„AT"/„Oesterreich" wären drei Länder. */
private getCountryFieldHtml(id: string, autocomplete: string): string { /* <select> aus COUNTRIES */ }
```

Beim Absenden wird das Formular mit **`FormData`** ausgelesen:

```ts
private readCustomerDetails(): CustomerDetails {
    const data = this.customerFormEl ? new FormData(this.customerFormEl) : new FormData();
    const text = (name: string): string => {
        const value = data.get(name);
        return typeof value === 'string' ? value : '';
    };
    // …
    return {
        customer: { firstName: text('vorname').trim(), /* … */ },
        residence: { street: text('strasse').trim(), /* … */ },
        billing:
            data.get('rechnung-abweichend') === null
                ? null
                : { company: toOptional(text('rechnung-firma')), /* … */ },
    };
}
```

`FormData.get()` liefert `string | File | null` – deshalb die kleine Hilfsfunktion `text()`, die nur Strings durchlässt. Eine nicht angehakte Checkbox fehlt in `FormData` komplett (`null`), was hier als „keine abweichende Rechnungsadresse" gelesen wird.

Fehlende Felder werden mit **`aria-invalid`** markiert, und Tailwind stylt sie über eine Attribut-Variante:

```ts
const FIELD_CLASSES = '… aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-600';
```

Ein Attribut, zwei Wirkungen: Der Screenreader meldet „ungültig", und die Optik folgt automatisch.

Die Zusammenfassung rechts zeigt jetzt Name und Adressen **aus der Eingabe** – und zwar per `textContent`, nicht per HTML-String:

```ts
/**
 * Per `textContent` statt als HTML-String – das sind Eingaben des Gastes.
 */
private renderCustomerSummary(): void {
    // …
    const valueEl = document.createElement('span');
    valueEl.className = 'text-right whitespace-pre-line';
    valueEl.textContent = value ?? '–';
    // …
}
```

Das ist eine **Sicherheitsmaßnahme gegen XSS** (Cross-Site-Scripting): Tippt jemand `<img src=x onerror=alert(1)>` als Namen ein, würde `innerHTML` das als HTML ausführen. `textContent` zeigt es als Text an. Im ganzen Projekt werden Templates sonst mit Template-Strings gebaut – hier, bei Nutzereingaben, bewusst nicht.

### 6. Übergangsweise: jede Änderung als JSON in der Konsole

Der TODO-Punkt „Console Logs json Buchung" aus Commit 003 wird hier umgesetzt – mit ausdrücklichem Ablaufdatum:

```ts
/**
 * TODO: Übergangsweise – loggt bei jeder Änderung den aktuellen Stand als JSON.
 *
 * Die View bleibt nach einem Seitenwechsel im Listener von `bookingState` hängen (es
 * gibt keinen Destroy-Hook); ist ihr DOM weg, meldet sie sich hier selbst ab.
 */
private logBooking(): void {
    if (this.calendarEl?.isConnected !== true) {
        this.unsubscribeBookingLog?.();
        this.unsubscribeBookingLog = null;
        return;
    }
    console.log(JSON.stringify(this.getBookingDraft(), null, 2));
}
```

Der Kommentar benennt ein strukturelles Problem des selbstgebauten Routers: Views haben **keinen Destroy-Hook** (in Angular wäre das `ngOnDestroy`). Wer sich an einem globalen Zustand anmeldet, bleibt angemeldet, auch wenn die Seite gewechselt wurde – ein klassisches **Speicherleck**. Die Lösung hier: Die View prüft mit `isConnected`, ob ihr DOM noch im Dokument hängt, und meldet sich sonst selbst ab.

Dazu passt der neue Typ `BookingDraft` – der Entwurf, in dem noch Werte fehlen dürfen:

```ts
/** Stand der Buchung während der Eingabe – was noch fehlt, ist `null`. */
type BookingDraft = Omit<Booking, 'checkIn' | 'checkOut' | 'nights' | 'adults'> & {
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
    adults: number | null;
};
```

`Omit<T, K>` entfernt Felder aus einem Typ, `&` fügt neue hinzu. So entsteht aus `Booking` eine Variante mit lockereren Feldern, ohne alles doppelt zu schreiben.

### 7. Tests

Die bestehenden Datenbanktests müssen jetzt überall eine Sitzadresse mitgeben – `helpers/fixtures.ts` legt dafür beim Erzeugen eines Testkunden automatisch eine an:

```ts
const { data: address, error: addressError } = await serviceClient
    .from('customer_addresses')
    .insert({ customer_id: customerId, kind: 'residence', street: 'Teststraße', house_number: '1', postal_code: '9500', city: 'Villach', country_code: 'AT' })
    .select('id')
    .single();
```

Das ist der typische Nachlauf einer neuen Pflichtspalte: Sechs Testdateien werden angefasst, obwohl sie inhaltlich nichts mit Adressen zu tun haben.

## Was wurde erreicht?

Das Formular hat jetzt ein Ziel in der Datenbank. Wohnadresse und optionale Rechnungsadresse werden geprüft, wiederverwendet statt verdoppelt und sind unveränderlich, sobald eine Buchung darauf zeigt.

| Technik                                          | Wozu                                                           |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Partieller Unique-Index                          | „höchstens eine aktive …" direkt in der Datenbank              |
| Zusammengesetzter Fremdschlüssel                 | Buchung zeigt nur auf Adressen ihres eigenen Kunden            |
| `CHECK … NOT VALID`                              | Pflicht für neue Zeilen, ohne Altbestand zu brechen            |
| Trigger statt Policy                             | Regel gilt auch für Rollen, die RLS umgehen                    |
| Zeilenvergleich mit `is distinct from`           | mehrere Spalten NULL-sicher vergleichen                        |
| Vergleichsschlüssel mit Steuerzeichen-Trenner    | Adressen erkennen, ohne falsch zusammenzulegen                 |
| `as const` + abgeleiteter Union-Typ              | Länderliste und Typ aus einer Quelle                           |
| Template Literal Types                           | alle Feldnamen als Typ, ohne sie aufzuzählen                   |
| `textContent` für Nutzereingaben                 | Schutz vor XSS                                                 |
| `isConnected` als Ersatz für einen Destroy-Hook  | Listener räumt sich selbst ab                                  |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](010_2026-09-26_enhance-address-form-validation.md)
