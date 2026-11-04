[← Vorheriger Commit](030_2026-10-21_tests-addresses-service-store-rules.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(db): add posts spike migration with seed rows (E36)

- **Commit:** `74968b1`
- **Datum:** 2026-10-21
- **Autor:** Oliver Jung

## Worum geht es?

Ein kleiner Commit mit einer langen Vorgeschichte. Ganz am Anfang des Kurses entstand nach dem Supabase-Tutorial eine Tabelle `posts` – direkt in der Cloud-Instanz, ohne Migration. Die Views `PostsView` (`/posts`) und `SinglePostView` (`/posts/:id`) lesen bis heute daraus.

Seit dem Branch `datenbank-anbindung` wird das Schema aber **ausschließlich über Migrationen im Repository** aufgebaut, und die Historie beginnt bei `hotels` (`V2`). Die Folge: Lokal gab es `posts` nie – die beiden Routen liefen ins Leere. Entscheidung `E36` hatte schon festgelegt, wie das zu lösen ist; dieser Commit setzt es um.

```text
 supabase/migrations/20261021101000_posts_spike.sql | 29 ++++++++++++++++++++++
 supabase/seed.sql                                  | 11 ++++++++
 2 files changed, 40 insertions(+)
```

## Die Änderungen im Detail

### 1. Eine eigene, letzte Migration

Datei: `supabase/migrations/20261021101000_posts_spike.sql`

```sql
-- posts (E36) - KURS-SPIKE, NICHT TEIL DER DOMAENE.
--
-- Die Tabelle stammt aus dem Supabase-Tutorial am Anfang des Kurses. An ihr haengen
-- `PostsView` (/posts) und `SinglePostView` (/posts/:id). Weil die Migrationshistorie
-- bei `hotels` beginnt (V2) und die Cloud-Instanz nie eingefangen wurde, gab es sie
-- lokal bisher nicht - die beiden Routen liefen ins Leere.
--
-- Bewusst eine eigene, letzte Migration: Ihr Entfernen ist spaeter ein `git rm` der
-- Views plus eine Drop-Migration, ohne eine Domaenentabelle anzufassen. Die Beispiel-
-- zeilen stehen in `seed.sql`.

create table public.posts (
    id uuid primary key default gen_random_uuid(),
    title text not null check (btrim(title) <> ''),
    description text not null,
    created_at timestamptz not null default now()
);
```

Der Kommentar ist der eigentliche Lehrinhalt: **Ein Spike** – ein Experiment, das man zum Lernen gebaut hat – sollte so im Code stehen, dass man ihn später **sauber wieder entfernen** kann. Deshalb steht `posts` nicht in einer der Domänen-Migrationen, sondern allein in einer eigenen Datei. Wer den Spike loswerden will, löscht die Views und schreibt eine `drop table`-Migration; keine Hoteltabelle muss dafür angefasst werden.

Kleine Details am Schema:

- `check (btrim(title) <> '')` verbietet Titel, die nur aus Leerzeichen bestehen – dieselbe Regel, die das Projekt auch an anderen Textspalten nutzt.
- `comment on table` schreibt die Einordnung zusätzlich **in die Datenbank**. Wer die Tabelle im Supabase-Studio sieht, liest dort sofort „Kurs-Spike, nicht Teil der Domäne".

```sql
comment on table public.posts is
    'E36: Kurs-Spike aus dem Supabase-Tutorial, nicht Teil der Domaene. Lesbar fuer alle, schreibbar nur fuer Mitarbeitende.';
```

### 2. Row Level Security: lesen alle, schreiben nur Mitarbeitende

```sql
alter table public.posts enable row level security;

-- Oeffentlich lesbar - die Posts-Seiten sind ohne Login erreichbar.
create policy posts_select_all on public.posts
for select using (true);

create policy posts_write_staff on public.posts
for all using (public.is_staff()) with check (public.is_staff());
```

Auch eine Übungstabelle bekommt RLS. Ohne `enable row level security` wäre sie über den öffentlichen Schlüssel für **jeden** beschreibbar. Die Schreib-Policy nutzt die bestehende Funktion `public.is_staff()` – dieselbe, die auch die Hoteltabellen schützt.

`using` und `with check` haben unterschiedliche Aufgaben:

- `using (…)` entscheidet, welche **vorhandenen** Zeilen eine Abfrage sehen bzw. ändern/löschen darf.
- `with check (…)` entscheidet, ob eine **neue oder geänderte** Zeile gespeichert werden darf.

Bei `for all` braucht man beide, sonst könnte z. B. ein Insert durchrutschen.

### 3. Zwei Beispielzeilen im Seed

Datei: `supabase/seed.sql`

```sql
-- Zwei Zeilen genuegen, damit /posts eine Liste und /posts/:id einen Treffer zeigt.
-- Feste IDs, damit ein Link aus dem Tutorial nach jedem Reset noch funktioniert.
insert into public.posts (id, title, description)
values
    ('00000000-0000-4000-8000-000000000901', 'Willkommen im Karawanken Hof', 'Der erste Beitrag aus dem Supabase-Tutorial.'),
    ('00000000-0000-4000-8000-000000000902', 'Frühling in den Alpen', 'Ein zweiter Beitrag, damit die Liste nicht nur aus einer Zeile besteht.');
```

**Feste UUIDs im Seed** sind ein Muster, das der ganze Seed nutzt (`…0001` für das Hotel, `…0201` für den Tarif, …). Nach jedem `pnpm db:reset` haben die Zeilen dieselben IDs – Links, Tests und Lesezeichen bleiben gültig. Der Bereich `…09xx` hält die Posts von den Domänendaten getrennt.

## Was wurde erreicht?

`/posts` und `/posts/:id` funktionieren lokal wieder. Das ist zugleich die Voraussetzung für den nächsten Commit: Erst wenn `posts` in der lokalen Datenbank existiert, taucht die Tabelle auch in den **generierten Typen** auf, und die Posts-Views lassen sich typsicher über einen Service anbinden.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](032_2026-10-21_generated-database-types-posts-service.md)
