-- services — Zusatzleistungen als Stammdaten (E47).
--
-- Die erste Zeile ist das Fruehstueck. Damit faellt ein Punkt hinter dem Scope-Zaun
-- aus E15 weg - und zwar additiv, genau wie dort behauptet: keine bestehende Tabelle
-- aendert ihre Bedeutung.
--
-- Warum eine eigene Tabelle und NICHT der Zimmerpreis (E47):
--   1. room_type_rates.amount_cents gilt pro ZIMMER und Nacht. Das Fruehstueck kostet
--      pro PERSON und Morgen - ein Doppelzimmer mit einem Gast kostet dasselbe Zimmer,
--      aber ein Fruehstueck weniger. In einer Preiszeile ist das nicht ausdrueckbar,
--      solange es keine Belegungspreise gibt (E5).
--   2. Der Preis wird beim Buchen eingefroren (E21). Waere das Fruehstueck im
--      Zimmerpreis eingebacken, liesse sich spaeter nie mehr sagen, was Beherbergung
--      und was Verpflegung war - und getrennt ausweisen muss man beides, sobald aus
--      der Buchung eine Rechnung wird.
--   3. Der Client darf den Preis ohnehin nicht setzen (E6). Ein Aufschlag, den nur das
--      Frontend kennt, waere im Checkout sichtbar und in der angelegten Buchung nicht.
--
-- Verworfen wurde auch der naheliegende Zwischenweg "zweiter rate_plan mit Fruehstueck":
-- derselbe Konflikt Person/Zimmer wie unter 1., dazu jede Saison und jede Kategorie
-- doppelt zu pflegen - eine Preisaenderung muesste dann an zwei Stellen passieren.

create table public.services (
    id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references public.hotels on delete restrict,
    code text not null,
    name text not null,

    -- Die Bezugsgroesse sagt, was EINE Einheit in booking_extras.quantity ist. Ohne
    -- sie waere `quantity = 4` nur im Quelltext von create_booking nachschlagbar.
    --
    -- Heute gibt es genau einen Wert. Das ist kein Vorratsbau: Der naechste Zusatz auf
    -- der Buchungsseite ist das Zustellbett, und das rechnet pro Zimmer und Nacht -
    -- dann kommt ein Wert in den CHECK, keine Spalte dazu.
    charge_basis text not null check (charge_basis in ('per_person_night')),

    amount_cents int not null check (amount_cents > 0),

    -- Kinderpreis. NULL heisst "kein eigener Preis" - Kinder zahlen dann wie
    -- Erwachsene, statt still gratis zu fruehstuecken.
    --
    -- Anders als bei room_type_rates ist hier 0 ERLAUBT und bedeutet "Kinder frei".
    -- Dort ist 0 verboten, weil eine fehlende Preiszeile bereits "nicht buchbar" sagt
    -- (E25) und ein Nullpreis deshalb immer ein Versehen waere. Eine Leistung, die es
    -- fuer Kinder gratis gibt, ist dagegen eine echte Konfiguration.
    child_amount_cents int check (child_amount_cents >= 0),

    currency text not null default 'EUR' check (char_length(currency) = 3),

    -- Archivieren statt loeschen: booking_extras verweist mit ON DELETE RESTRICT
    -- hierher, weil eine vergangene Buchung ihren Posten behaelt (E22).
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (hotel_id, code)
);

comment on table public.services is
    'E47: Zusatzleistungen als Stammdaten. Was hier steht, gilt HEUTE - was eine Buchung kostet, steht in booking_extras (E21).';

create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();

alter table public.services enable row level security;

-- Preise sind oeffentlich - sie stehen auf der Buchungsseite an der Zimmerkarte.
-- Dasselbe Muster wie room_type_rates.
create policy services_select_active on public.services
for select using (archived_at is null or public.is_staff());

create policy services_write_staff on public.services
for all using (public.is_staff()) with check (public.is_staff());
