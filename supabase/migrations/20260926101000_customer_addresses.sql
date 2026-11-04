-- customer_addresses (E50, E51): Sitzadresse und Rechnungsadressen in EINER Tabelle.
--
-- Revidiert E42 (eigene Tabelle `billing_addresses`, nie migriert): Die Sitzadresse
-- - wo der Kunde wohnt - ist jetzt Teil des Modells, und die Rechnungsadresse ist
-- optional. Beide sind Adressen desselben Kunden, getrennt durch `kind`, nicht durch
-- eine zweite Tabelle mit denselben sechs Spalten.
--
-- Die drei Regeln aus der Grilling-Runde stehen im Schema, nicht in einer Absprache:
--   1. Genau EINE aktive Sitzadresse je Kunde     -> partieller Unique-Index
--   2. Beliebig viele Rechnungsadressen je Kunde  -> 1:n, keine Grenze
--   3. Rechnungsadresse je Buchung optional       -> bookings.billing_address_id nullable

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

-- Die Laenderliste an EINER Stelle: Die Tabelle prueft sie im CHECK, create_booking
-- vor dem Lock - damit ein unbekanntes Land ein strukturierter Fehler ist und kein
-- 23514. Ein neues Land ist eine Zeile hier, keine Tabelle `countries` fuer fuenf
-- Werte (E50).
create or replace function public.is_supported_country(p_code text) returns boolean
language sql
immutable
set search_path = ''
as $$
select p_code in ('AT', 'DE', 'CH', 'IT', 'SI');
$$;

comment on function public.is_supported_country(text) is
    'E50: die Laender, die das Formular anbietet (ISO-3166-1 alpha-2).';

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

comment on function public.normalize_address_part(text) is
    'E51: Vergleichsform eines Adressfelds - trim, lower, Leerzeichen zusammengefasst.';

-- Eine Funktion statt der Formel in Spalte UND create_booking: Zwei Kopien laufen
-- auseinander, und dann findet die Suche die Zeile nicht mehr, die der Index kennt.
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

comment on function public.address_match_key(text, text, text, text, text, text) is
    'E51: Vergleichsschluessel einer Adresse - Grundlage fuer customer_addresses.match_key und die Suche in create_booking.';

-- ---------------------------------------------------------------------------
-- customer_addresses
-- ---------------------------------------------------------------------------

create table public.customer_addresses (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers on delete restrict,
    kind text not null check (kind in ('residence', 'billing')),
    -- "Firma / z. Hd." - der haeufigste Grund fuer eine abweichende Rechnungsadresse.
    -- An der Sitzadresse gibt es keinen Empfaenger ausser dem Kunden selbst.
    company text,
    -- Strasse und Hausnummer getrennt (E42): Zusammenkleben und spaeter wieder
    -- auseinanderparsen verliert genau bei "Musterstrasse 3a/2/17" Information.
    street text not null,
    house_number text not null,
    postal_code text not null,
    city text not null,
    country_code text not null,
    -- Der Vergleich ist eine SPALTE, keine Konvention - dasselbe Argument wie bei
    -- customers.email_normalized (E32).
    match_key text generated always as (
        public.address_match_key(company, street, house_number, postal_code, city, country_code)
    ) stored not null,
    -- NULL = aktiv (E22). Archiviert wird die Sitzadresse beim Umzug; eine
    -- Rechnungsadresse bleibt aktiv, weil ein Kunde mehrere zugleich haben kann.
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

create trigger customer_addresses_set_updated_at before update on public.customer_addresses
for each row execute function public.set_updated_at();

-- Regel 1: eine aktive Sitzadresse je Kunde.
create unique index customer_addresses_one_residence_idx on public.customer_addresses (customer_id)
    where kind = 'residence' and archived_at is null;

-- Jede Adresse gibt es je Kunde und Art nur EINMAL - auch archiviert. Zieht der Gast
-- zurueck, wird die alte Zeile reaktiviert statt dupliziert (E51). Der Index traegt
-- zugleich die Suche in create_booking.
create unique index customer_addresses_match_idx on public.customer_addresses (customer_id, kind, match_key);

-- ---------------------------------------------------------------------------
-- Unveraenderlich, sobald benutzt (E43, verschaerft in E51)
-- ---------------------------------------------------------------------------
--
-- E43 hatte das als UPDATE-Policy geplant. Ein Trigger ist hier die bessere Wahl:
--   - Die Policy haette auch das ARCHIVIEREN einer benutzten Sitzadresse verboten -
--     und genau das passiert bei jedem Umzug.
--   - Der Service-Role-Key und create_booking (SECURITY DEFINER) umgehen RLS. Einen
--     Trigger umgeht nur, wer ihn abschaltet.
--
-- SECURITY DEFINER, damit die Pruefung nicht durch die RLS von `bookings` sieht und je
-- nach Aufrufer ein anderes Ergebnis bekommt.
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

comment on function public.guard_customer_address_update() is
    'E43/E51: benutzte Adressen sind inhaltlich unveraenderlich; archivieren bleibt erlaubt.';

revoke all on function public.guard_customer_address_update() from public, anon, authenticated;

create trigger customer_addresses_guard_update before update on public.customer_addresses
for each row execute function public.guard_customer_address_update();

-- ---------------------------------------------------------------------------
-- RLS (E43)
-- ---------------------------------------------------------------------------

alter table public.customer_addresses enable row level security;

create policy customer_addresses_select_own on public.customer_addresses
for select using (customer_id = (select public.current_customer_id()) or public.is_staff());

-- Aendern duerfen Kunde und Mitarbeitende - der Trigger oben entscheidet, WAS.
create policy customer_addresses_update_own on public.customer_addresses
for update using (customer_id = (select public.current_customer_id()) or public.is_staff())
with check (customer_id = (select public.current_customer_id()) or public.is_staff());

-- Kein INSERT und kein DELETE: Adressen entstehen ausschliesslich in create_booking,
-- damit dieselbe Adresse nie zweimal entsteht (E51). Geloescht wird nichts (E22).

-- ---------------------------------------------------------------------------
-- bookings: Verweis auf Sitz- und optionale Rechnungsadresse (E51)
-- ---------------------------------------------------------------------------
--
-- Verweis statt Kopie (E43): Die Zeile ist unveraenderlich, also bleibt die Anschrift
-- der Buchung von 2026 dieselbe, auch wenn der Gast 2027 umzieht. NULL bei
-- billing_address_id heisst: Rechnung an die Sitzadresse.
--
-- Der zusammengesetzte Fremdschluessel stellt sicher, dass die Adresse zum Kunden der
-- Buchung gehoert. Ob `kind` passt, stellt create_booking sicher - dafuer braeuchte
-- bookings eine Spalte, die nur fuer den Fremdschluessel existiert.
alter table public.bookings
    add column residence_address_id uuid,
    add column billing_address_id uuid,
    add constraint bookings_residence_address_fkey foreign key (residence_address_id, customer_id)
        references public.customer_addresses (id, customer_id) on delete restrict,
    add constraint bookings_billing_address_fkey foreign key (billing_address_id, customer_id)
        references public.customer_addresses (id, customer_id) on delete restrict;

-- Pflicht fuer jede NEUE Buchung. NOT VALID, weil die Buchungen vor dieser Migration
-- keine Adresse haben und keine bekommen koennen - erfinden waere schlimmer als leer.
-- Postgres prueft den CHECK damit bei jedem INSERT/UPDATE, nur nicht rueckwirkend.
alter table public.bookings
    add constraint bookings_residence_address_required check (residence_address_id is not null) not valid;

create index bookings_residence_address_id_idx on public.bookings (residence_address_id);
create index bookings_billing_address_id_idx on public.bookings (billing_address_id) where billing_address_id is not null;
