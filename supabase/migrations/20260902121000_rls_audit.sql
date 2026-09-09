-- rls_audit() — die Abnahme aus Phase 7, als Funktion statt als Checkliste.
--
-- Eine Vollstaendigkeitspruefung, die jemand von Hand durchgeht, ist genau einmal
-- richtig: an dem Tag, an dem sie gemacht wurde. Die naechste Tabelle entsteht in
-- einer spaeteren Migration, und ob sie eine Policy bekommen hat, faellt niemandem
-- auf - eine fehlende Policy erzeugt keine Fehlermeldung, sie erzeugt nur zu viel
-- Sichtbarkeit.
--
-- Diese Funktion liefert AUSSCHLIESSLICH Befunde. Keine Zeilen heisst: alles in
-- Ordnung. Der zugehoerige Test erwartet null Zeilen und schlaegt damit an, sobald
-- jemand eine Tabelle ohne Policy hinzufuegt.

create or replace function public.rls_audit()
returns table (schwere text, objekt text, befund text)
language sql
stable
security definer
set search_path = ''
as $$

-- 1. Tabelle ohne RLS. Deny by default gilt nur, wenn RLS ueberhaupt an ist (E13).
select 'fehler'::text, c.relname::text, 'Tabelle ohne ENABLE ROW LEVEL SECURITY'::text
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all

-- 2. RLS an, aber keine einzige Policy: die Tabelle ist fuer alle Rollen unsichtbar.
-- Das kann Absicht sein, ist aber haeufiger ein Vergessen - deshalb Warnung.
select 'warnung', c.relname::text, 'RLS aktiv, aber keine einzige Policy'
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_catalog.pg_policy p where p.polrelid = c.oid)

union all

-- 3. Verstreutes auth.uid() (E13). Identitaet gehoert in current_customer_id() und
-- Rollen in is_staff() - sonst muss man beim naechsten Rollenmodell jede Policy
-- einzeln finden.
select 'fehler', p.polrelid::regclass::text || ' / ' || p.polname, 'Policy benutzt auth.uid() direkt statt current_customer_id() (E13)'
from pg_catalog.pg_policy p
where pg_catalog.pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
   or pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%'

union all

-- 4. SECURITY DEFINER ohne fixiertes search_path. Eine solche Funktion laeuft mit
-- den Rechten ihres Eigentuemers und sucht ihre Tabellen dort, wo der AUFRUFER
-- hinzeigt - der klassische Weg, eine Datenbank zu uebernehmen.
select 'fehler', p.proname::text, 'SECURITY DEFINER ohne fixiertes search_path'
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')

union all

-- 5. Interne Funktionen, die der Browser aufrufen kann. availability_nights gibt
-- unmaskierte Zahlen heraus - waere sie erreichbar, waere die Zweistufigkeit aus
-- E28 mit einem einzigen Aufruf umgangen.
select 'fehler', p.proname::text, 'interne Funktion ist fuer anon ausfuehrbar'
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('availability_nights', 'reject_booking', 'find_rate_gaps', 'generate_booking_reference', 'set_updated_at')
  and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')

union all

-- 6. Append-only der Historie (E12). Nicht nur fuer anon: auch der service_role
-- umgeht RLS und duerfte die Historie sonst umschreiben.
select 'fehler', 'booking_events', 'UPDATE/DELETE fuer ' || r.rolname || ' nicht entzogen (E12)'
from unnest(array['anon', 'authenticated', 'service_role']) as r(rolname)
where pg_catalog.has_table_privilege(r.rolname, 'public.booking_events', 'UPDATE')
   or pg_catalog.has_table_privilege(r.rolname, 'public.booking_events', 'DELETE')

union all

-- 7. Direktes Schreiben auf bookings (E6). Gebucht wird ueber create_booking, sonst
-- ist die Vertrauensgrenze nur eine Absprache.
select 'fehler', 'bookings / ' || p.polname, 'Schreib-Policy auf bookings - gebucht wird nur ueber create_booking (E6)'
from pg_catalog.pg_policy p
where p.polrelid = 'public.bookings'::regclass and p.polcmd in ('a', 'w', 'd', '*');

$$;

comment on function public.rls_audit() is
    'Phase 7: liefert nur Befunde. Keine Zeilen = Abnahme bestanden.';

revoke all on function public.rls_audit() from public;
revoke all on function public.rls_audit() from anon, authenticated;
grant execute on function public.rls_audit() to service_role;
