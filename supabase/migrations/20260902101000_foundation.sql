-- Fundament: Erweiterungen und die Funktionen, auf denen alle Policies aufsetzen.
--
-- Entscheidungen: E7 (Schema als Code), E13 (RLS ueber genau zwei Funktionen),
-- E8 (Konventionen), V3 (RLS ab Phase 2).

-- btree_gist erlaubt in einem GiST-Exclusion-Constraint die Gleichheitspruefung auf
-- uuid neben der Ueberlappungspruefung auf daterange. Ohne diese Erweiterung sind
-- `EXCLUDE USING gist (room_id WITH =, period WITH &&)` und alle spaeteren
-- Ueberlappungs-Constraints nicht anlegbar.
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- is_staff() — der EINZIGE Ort, an dem Mitarbeitendenrechte geprueft werden (E13)
-- ---------------------------------------------------------------------------
--
-- v1 gibt hart `false` zurueck: Es gibt noch kein Login fuer Mitarbeitende, und alles
-- Administrative laeuft ueber den Service-Role-Key, der RLS ohnehin umgeht (E35).
--
-- Das ist Absicht und kein Platzhalter, den man vergessen darf: Sobald es Rollen gibt,
-- wird GENAU DIESE Funktion geaendert (z. B. auf eine `profiles.role`-Abfrage) und
-- jede Policy im Schema gilt sofort mit. Wer stattdessen `auth.uid()` in einzelne
-- Policies schreibt, muss sie spaeter alle finden.
create or replace function public.is_staff() returns boolean language sql stable
set search_path = ''
as $$
select false;
$$;

comment on function public.is_staff() is
    'v1: immer false. Einziger Ort fuer Mitarbeitendenrechte (E13) - hier aendern, nicht in Policies.';

-- ---------------------------------------------------------------------------
-- set_updated_at() — Konvention aus E8, an einer Stelle
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
