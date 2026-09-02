-- is_blocking_status(text) — "belegt diese Buchung Kapazitaet?" (E11).
--
-- Genau EINE Stelle. Die Regel lautet: alles ausser `cancelled` blockiert. Ein
-- No-Show blockiert weiter, denn die Nacht WAR verkauft; eine Storno nicht.
--
-- Warum das eine Funktion ist und kein wiederholtes `status <> 'cancelled'`: Diese
-- Bedingung steht sonst im Exclusion-Constraint, im Teilindex, in der
-- Verfuegbarkeitsrechnung und in jeder Admin-Abfrage. Vier Kopien einer Regel
-- driften, und wenn sie driften, widerspricht die Anwendung sich selbst.

create or replace function public.is_blocking_status(status text) returns boolean
language sql
immutable
parallel safe
as $$
select status is distinct from 'cancelled';
$$;

comment on function public.is_blocking_status(text) is
    'E11: belegt Kapazitaet = alles ausser cancelled. Einziger Ort fuer diese Regel.';

-- ACHTUNG, und das ist der Preis dieser Loesung: Weil Indizes und
-- Exclusion-Constraints diese Funktion im Praedikat verwenden, ist sie IMMUTABLE
-- deklariert und Postgres glaubt das. Wer sie spaeter aendert (z. B. "no_show
-- blockiert nicht mehr"), muss die abhaengigen Objekte NEU AUFBAUEN - sonst
-- entscheidet der Index weiter nach der alten Regel, ohne dass etwas auffaellt:
--
--   reindex table public.bookings;
--
-- Kein `set search_path` hier: die Funktion greift auf nichts zu, und ein SET-Zusatz
-- verhindert das Inlining, das sie in Indexpraedikaten billig macht.
