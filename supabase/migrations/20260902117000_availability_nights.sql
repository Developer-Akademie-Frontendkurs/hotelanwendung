-- availability_nights() — die EINE Wahrheit ueber Kapazitaet und Preis pro Nacht.
--
-- Diese Funktion ist absichtlich nicht die, die das Frontend aufruft. Sie liefert
-- IMMER die feinen Gruende und die rohen Zahlen; die beiden oeffentlichen Funktionen
-- (availability_calendar, search_availability) legen darueber die Maskierung aus E28.
--
-- Warum die Trennung noetig ist: create_booking (Phase 6) muss den GENAUEN Grund
-- einer Ablehnung kennen, um den strukturierten Fehler aus E31 zu erzeugen. Es laeuft
-- als SECURITY DEFINER, aber is_staff() gibt trotzdem false zurueck (E13 ist
-- rollenbasiert, nicht kontextbasiert) - es bekaeme also den maskierten Grund und
-- koennte E31 nicht erfuellen.
--
-- Der Umsetzungsplan verlangt, dass Ergebnisliste und Buchung DIESELBE Regel benutzen
-- ("zwei Implementierungen derselben Regel waeren die eigentliche Fehlerquelle").
-- Genau das leistet diese Funktion: alle drei Aufrufer lesen aus ihr.

create or replace function public.availability_nights(
    p_hotel_id uuid,
    p_from date,
    p_to date,
    p_adults int,
    p_children int default 0,
    p_room_type_id uuid default null
)
returns table (
    night date,
    room_type_id uuid,
    fits boolean,
    capacity int,
    rooms_free int,
    rate_cents int,
    currency text
)
language sql
stable
security definer
set search_path = ''
as $$
with naechte as (
    -- Halb-offen: p_to ist der Abreisetag und damit KEINE Nacht (E29).
    select generate_series(p_from, p_to - 1, interval '1 day')::date as night
),
kategorien as (
    select rt.id, rt.max_occupancy
    from public.room_types rt
    where rt.hotel_id = p_hotel_id
      and rt.archived_at is null
      and (p_room_type_id is null or rt.id = p_room_type_id)
),
basis as (
    select n.night, k.id as room_type_id, k.max_occupancy
    from naechte n
    cross join kategorien k
),
-- Aktive Zimmer der Kategorie. Archivierte zaehlen NICHT (E22).
aktive_zimmer as (
    select r.room_type_id, count(*)::int as anzahl
    from public.rooms r
    join kategorien k on k.id = r.room_type_id
    where r.archived_at is null
    group by r.room_type_id
),
-- Gesperrte Zimmer je Nacht (E18). Sie senken die Kapazitaet, nicht die Belegung.
sperrungen as (
    select b.night, b.room_type_id, count(distinct rb.room_id)::int as anzahl
    from basis b
    join public.rooms r on r.room_type_id = b.room_type_id and r.archived_at is null
    join public.room_blocks rb on rb.room_id = r.id and rb.period @> b.night
    group by b.night, b.room_type_id
),
-- Blockierende Buchungen je Nacht. Was blockiert, entscheidet is_blocking_status -
-- an genau einer Stelle definiert (E11), nicht hier nachgebaut.
belegung as (
    select b.night, b.room_type_id, count(*)::int as anzahl
    from basis b
    join public.bookings bk
      on bk.room_type_id = b.room_type_id
     and bk.stay @> b.night
     and public.is_blocking_status(bk.status)
    group by b.night, b.room_type_id
),
-- Preis der Nacht im Standardtarif des Hotels. Mehrere Tarife (E5) wuerden hier
-- einen Parameter verlangen - v1 hat genau einen.
preise as (
    select b.night, b.room_type_id, rtr.amount_cents, rtr.currency
    from basis b
    join public.rate_plans rp
      on rp.hotel_id = p_hotel_id and rp.is_default and rp.archived_at is null
    join public.room_type_rates rtr
      on rtr.room_type_id = b.room_type_id
     and rtr.rate_plan_id = rp.id
     and rtr.validity @> b.night
)
select
    b.night,
    b.room_type_id,
    (b.max_occupancy >= (p_adults + coalesce(p_children, 0))) as fits,
    (coalesce(az.anzahl, 0) - coalesce(s.anzahl, 0)) as capacity,
    -- BEWUSST NICHT auf 0 begrenzt: Eine Sperrung darf bestaetigte Buchungen ueber
    -- die Kapazitaet heben (E18) - das Zimmer IST kaputt. Ein negativer Wert ist die
    -- Meldung dieser Ueberbuchung an den Betrieb, kein Rechenfehler.
    (coalesce(az.anzahl, 0) - coalesce(s.anzahl, 0) - coalesce(bel.anzahl, 0)) as rooms_free,
    p.amount_cents as rate_cents,
    p.currency
from basis b
left join aktive_zimmer az on az.room_type_id = b.room_type_id
left join sperrungen s on s.night = b.night and s.room_type_id = b.room_type_id
left join belegung bel on bel.night = b.night and bel.room_type_id = b.room_type_id
left join preise p on p.night = b.night and p.room_type_id = b.room_type_id;
$$;

comment on function public.availability_nights(uuid, date, date, int, int, uuid) is
    'Interner Kern (E17): rohe Kapazitaets- und Preiszahlen pro Nacht und Kategorie, ohne Maskierung.';

-- Nicht fuer den Browser. Die oeffentlichen Funktionen laufen als SECURITY DEFINER
-- und duerfen sie deshalb aufrufen, ohne dass anon ein EXECUTE-Recht braucht.
revoke all on function public.availability_nights(uuid, date, date, int, int, uuid) from public;
revoke all on function public.availability_nights(uuid, date, date, int, int, uuid) from anon, authenticated;

-- Der Service-Role-Key darf, wie bei find_rate_gaps: In v1 ist er der einzige
-- Admin-Zugang (E35), und die rohen Zahlen sind genau die Betriebssicht, die E18
-- verlangt - eine Ueberbuchung durch eine Sperrung soll SICHTBAR sein.
grant execute on function public.availability_nights(uuid, date, date, int, int, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Sperrgruende zweistufig (E28)
-- ---------------------------------------------------------------------------
--
-- `ausgebucht` ist Erfolg, `kein_preis` ist ein Konfigurationsfehler, `zu_klein` ist
-- eine Aussage ueber die Belegung - fuer den Gast sehen alle drei gleich aus.
--
-- `vergangenheit` und `ausserhalb_horizont` bleiben sichtbar: Sie verraten nichts
-- ueber den Betrieb, und "so weit im Voraus nehmen wir noch keine Buchungen an" ist
-- eine Auskunft, die dem Gast hilft, statt ihn raten zu lassen (E30).
create or replace function public.mask_reason(reason text) returns text
language sql
stable
set search_path = ''
as $$
select case
    when reason is null then null
    when public.is_staff() then reason
    when reason in ('ausgebucht', 'kein_preis', 'zu_klein') then 'nicht_buchbar'
    else reason
end;
$$;

comment on function public.mask_reason(text) is
    'E28: feine Gruende nur fuer is_staff(); ausgebucht/kein_preis/zu_klein werden sonst zu nicht_buchbar.';
