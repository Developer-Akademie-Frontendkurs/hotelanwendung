[← Vorheriger Commit](008_2026-09-02_phase-6-create-booking.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(db): Phase 7 - RLS-Abnahme als Dauerpruefung, Doku nachgefuehrt

- **Commit:** `e1aef3b`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Die letzte Phase – und sie tut etwas anderes, als der ursprüngliche Plan vorsah. Dort hieß Phase 7 noch „RLS anschalten". Weil Row Level Security aber seit Phase 2 aktiv ist (`V3`), gibt es nichts mehr anzuschalten. Die Phase wird deshalb zur **Abnahme** umgebaut:

```text
 docs/datenbank/README.md                         |  93 +++++++++++++++-
 docs/datenbank/schema.md                         |  58 ++++++++---
 docs/datenbank/umsetzungsplan.md                 |  18 ++--
 supabase/migrations/20260902121000_rls_audit.sql |  94 ++++++++++++++++++
 supabase/tests/rls-abnahme.spec.ts               | 118 +++++++++++++++++++++++
 5 files changed, 362 insertions(+), 19 deletions(-)
```

Und die Abnahme wird nicht als Checkliste erledigt, sondern als **Funktion** – das ist die Entscheidung `E40`:

```sql
-- rls_audit() — die Abnahme aus Phase 7, als Funktion statt als Checkliste.
--
-- Eine Vollstaendigkeitspruefung, die jemand von Hand durchgeht, ist genau einmal
-- richtig: an dem Tag, an dem sie gemacht wurde. Die naechste Tabelle entsteht in
-- einer spaeteren Migration, und ob sie eine Policy bekommen hat, faellt niemandem
-- auf - eine fehlende Policy erzeugt keine Fehlermeldung, sie erzeugt nur zu viel
-- Sichtbarkeit.
```

Der Satz ist die Begründung für die ganze Phase: **Eine fehlende Policy erzeugt keine Fehlermeldung.** Sie erzeugt nur zu viel Sichtbarkeit. Ein Fehler, der sich nicht meldet, braucht eine Prüfung, die von selbst läuft.

## 1. `rls_audit` – eine Funktion, die nur Befunde liefert

```sql
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
```

Das Rückgabeformat ist bewusst schlicht: Schweregrad, betroffenes Objekt, Beschreibung. Und die Semantik ist umgekehrt zu einem gewöhnlichen Bericht: **Keine Zeilen = bestanden.**

Der Körper besteht aus sieben `select`-Abfragen, verbunden mit `union all`. Jede prüft eine Eigenschaft, und alle lesen aus dem **Systemkatalog** von PostgreSQL – den internen Tabellen, in denen die Datenbank ihre eigene Struktur beschreibt.

### Prüfung 1: Tabellen ohne RLS

```sql
-- 1. Tabelle ohne RLS. Deny by default gilt nur, wenn RLS ueberhaupt an ist (E13).
select 'fehler'::text, c.relname::text, 'Tabelle ohne ENABLE ROW LEVEL SECURITY'::text
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
```

`pg_class` enthält eine Zeile pro Tabelle, Index, View und Sequenz. `relkind = 'r'` filtert auf echte Tabellen (`r` für _relation_), `relrowsecurity` ist das Flag, das `alter table … enable row level security` setzt.

Das ist die wichtigste der sieben Prüfungen. Ohne aktives RLS ist eine Tabelle **offen** – Policies auf ihr wären vorhanden, aber ohne Wirkung. Wer eine Tabelle anlegt und das `enable` vergisst, bemerkt nichts: Alles funktioniert, nur zu gut.

### Prüfung 2: RLS an, aber keine Policy

```sql
-- 2. RLS an, aber keine einzige Policy: die Tabelle ist fuer alle Rollen unsichtbar.
-- Das kann Absicht sein, ist aber haeufiger ein Vergessen - deshalb Warnung.
select 'warnung', c.relname::text, 'RLS aktiv, aber keine einzige Policy'
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_catalog.pg_policy p where p.polrelid = c.oid)
```

Der umgekehrte Fall – und deshalb nur `warnung` statt `fehler`. Eine Tabelle mit RLS und ohne Policies ist für alle Rollen leer. Das kann Absicht sein (eine rein interne Tabelle), ist aber häufiger ein Versehen.

Die Unterscheidung zwischen `fehler` und `warnung` ist praktisch gedacht: Ein Befund, der manchmal richtig ist, darf den Test nicht dauerhaft rot machen – man würde ihn abschalten. Hier gibt es derzeit keine solche Tabelle, weshalb der Test trotzdem null Zeilen erwartet.

### Prüfung 3: Verstreutes `auth.uid()`

```sql
-- 3. Verstreutes auth.uid() (E13). Identitaet gehoert in current_customer_id() und
-- Rollen in is_staff() - sonst muss man beim naechsten Rollenmodell jede Policy
-- einzeln finden.
select 'fehler', p.polrelid::regclass::text || ' / ' || p.polname, 'Policy benutzt auth.uid() direkt statt current_customer_id() (E13)'
from pg_catalog.pg_policy p
where pg_catalog.pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
   or pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%'
```

Diese Prüfung ist besonders interessant, weil sie eine **Konvention** durchsetzt, keine technische Eigenschaft. `pg_get_expr` rekonstruiert aus der internen Darstellung einer Policy den lesbaren SQL-Ausdruck – und darin wird nach `auth.uid()` gesucht.

Damit wird die Entscheidung `E13` maschinell überwacht: Identität gehört in `current_customer_id()`, Rollen in `is_staff()`. Schreibt jemand `auth.uid()` direkt in eine Policy, schlägt die Prüfung an.

Solche Prüfungen sind eine Art selbstgebauter Linter für die Datenbank. Ein Code-Review würde es auch finden – aber nur, wenn jemand daran denkt.

### Prüfung 4: `SECURITY DEFINER` ohne festes `search_path`

```sql
-- 4. SECURITY DEFINER ohne fixiertes search_path. Eine solche Funktion laeuft mit
-- den Rechten ihres Eigentuemers und sucht ihre Tabellen dort, wo der AUFRUFER
-- hinzeigt - der klassische Weg, eine Datenbank zu uebernehmen.
select 'fehler', p.proname::text, 'SECURITY DEFINER ohne fixiertes search_path'
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
```

Die sicherheitskritischste Prüfung, und der Angriff dahinter lohnt es, verstanden zu werden.

Eine Funktion mit `SECURITY DEFINER` läuft mit den Rechten ihres Eigentümers. Steht darin `select * from customers` **ohne** Schema-Präfix, entscheidet der `search_path` des **Aufrufers**, welche Tabelle gemeint ist. Ein Angreifer, der ein eigenes Schema anlegen darf, kann dort eine Tabelle `customers` platzieren, seinen `search_path` davorsetzen – und die privilegierte Funktion arbeitet mit seinen Daten. Von dort ist es nicht weit zu beliebigem Code mit Eigentümerrechten.

Deshalb steht bei **jeder** Funktion in diesem Schema `set search_path = ''`, und deshalb prüft `rls_audit` es. Die einzige Ausnahme ist `is_blocking_status()` aus Phase 4 – sie ist nicht `SECURITY DEFINER` und greift auf keine Tabelle zu, fällt also gar nicht in diese Prüfung.

`proconfig` ist die Spalte, in der PostgreSQL solche `SET`-Zusätze speichert; `unnest` löst das Array in Zeilen auf, damit man darin suchen kann.

### Prüfung 5: Interne Funktionen für `anon`

```sql
-- 5. Interne Funktionen, die der Browser aufrufen kann. availability_nights gibt
-- unmaskierte Zahlen heraus - waere sie erreichbar, waere die Zweistufigkeit aus
-- E28 mit einem einzigen Aufruf umgangen.
select 'fehler', p.proname::text, 'interne Funktion ist fuer anon ausfuehrbar'
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('availability_nights', 'reject_booking', 'find_rate_gaps', 'generate_booking_reference', 'set_updated_at')
  and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
```

`has_function_privilege` fragt die Datenbank direkt: „Darf Rolle `anon` diese Funktion ausführen?" Das ist verlässlicher als das Nachlesen von `GRANT`-Anweisungen, weil auch Rechte über Rollenvererbung erfasst werden.

Die Liste der internen Funktionen ist hart eingetragen. Das ist ein bewusster Kompromiss: Eine automatische Erkennung („was ist intern?") wäre Rätselraten. Die Liste muss gepflegt werden – aber sie steht an einer Stelle, und der Test schlägt an, wenn sich ein Recht ändert.

### Prüfung 6: Append-only der Historie

```sql
-- 6. Append-only der Historie (E12). Nicht nur fuer anon: auch der service_role
-- umgeht RLS und duerfte die Historie sonst umschreiben.
select 'fehler', 'booking_events', 'UPDATE/DELETE fuer ' || r.rolname || ' nicht entzogen (E12)'
from unnest(array['anon', 'authenticated', 'service_role']) as r(rolname)
where pg_catalog.has_table_privilege(r.rolname, 'public.booking_events', 'UPDATE')
   or pg_catalog.has_table_privilege(r.rolname, 'public.booking_events', 'DELETE')
```

Prüft, dass der `REVOKE` aus Phase 4 noch gilt – und zwar für alle drei Rollen. Besonders für `service_role`: Er umgeht RLS, also wäre eine Policy allein wertlos.

`unnest(array[...]) as r(rolname)` ist ein praktischer Trick, um über eine feste Werteliste zu iterieren, ohne eine Tabelle dafür zu brauchen.

### Prüfung 7: Keine Schreib-Policy auf `bookings`

```sql
-- 7. Direktes Schreiben auf bookings (E6). Gebucht wird ueber create_booking, sonst
-- ist die Vertrauensgrenze nur eine Absprache.
select 'fehler', 'bookings / ' || p.polname, 'Schreib-Policy auf bookings - gebucht wird nur ueber create_booking (E6)'
from pg_catalog.pg_policy p
where p.polrelid = 'public.bookings'::regclass and p.polcmd in ('a', 'w', 'd', '*');
```

Die Vertrauensgrenze aus `E6` maschinell überwacht. `polcmd` ist der Buchstabencode für die Operation:

| `polcmd` | Operation         |
| -------- | ----------------- |
| `r`      | `SELECT` (read)   |
| `a`      | `INSERT` (append) |
| `w`      | `UPDATE` (write)  |
| `d`      | `DELETE`          |
| `*`      | `ALL`             |

Gesucht wird alles außer `r`. Fügt jemand später eine `INSERT`-Policy auf `bookings` hinzu – etwa weil „der Admin-Bereich sonst nicht geht" –, schlägt der Test an. Die Funktion `create_booking` bliebe umgehbar, und alle Prüfungen darin wären optional.

### Der Zugriffsschutz

```sql
revoke all on function public.rls_audit() from public;
revoke all on function public.rls_audit() from anon, authenticated;
grant execute on function public.rls_audit() to service_role;
```

Wieder das Muster aus `E38`: Zugang über `EXECUTE`-Recht, nicht über einen `is_staff()`-Wachposten. Und mit gutem Grund – der Test formuliert es:

```ts
it('ist für den Gast nicht aufrufbar', async () => {
    // Die Prüfung nennt Tabellennamen, Policy-Namen und Rechte. Das ist eine
    // Landkarte des Schutzes und gehört nicht in den Browser.
    const { error } = await anonClient.rpc('rls_audit');
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
});
```

## 2. Die Gegenprobe – alle sieben Prüfungen wurden ausgelöst

Die Commit-Message hält eine Arbeitsweise fest, die den Unterschied zwischen einer Prüfung und einer Behauptung macht:

```text
Gegenprobe durchgefuehrt: alle sieben Pruefungen wurden mit absichtlichen
Verstoessen ausgeloest und melden korrekt. Eine Prueffunktion, die nie etwas
findet, ist nicht von einer kaputten zu unterscheiden.
```

Das ist derselbe Gedanke wie beim Nebenläufigkeitstest in Phase 6, nur systematisch angewandt. Eine Funktion, die immer null Zeilen liefert, sieht genauso aus wie eine, die richtig arbeitet – solange nichts kaputt ist. Der einzige Weg, den Unterschied festzustellen: absichtlich etwas kaputt machen und schauen, ob es gemeldet wird.

Sieben Prüfungen, sieben absichtliche Verstöße, sieben korrekte Meldungen. Danach zurückgebaut. Das kostet zwanzig Minuten und ist der Unterschied zwischen „läuft" und „funktioniert".

## 3. Die Tests: Katalog **und** Verhalten

Die Testdatei prüft auf zwei Ebenen, und der Kommentar erklärt, warum beide nötig sind:

```ts
/**
 * Das „Fertig, wenn" der Phase, als Verhalten statt als Katalogabfrage. Beides
 * zusammen: die Katalogprüfung sagt, dass die Regeln da sind, dieser Teil sagt,
 * dass sie wirken.
 */
```

Ein schöner Gedanke: Der Katalog sagt, dass eine Policy **existiert**. Er sagt nicht, dass sie das Richtige tut. Dafür braucht es Verhaltenstests.

Der erste Test ist der Kern der ganzen Phase:

```ts
it('meldet keinen einzigen Befund', async () => {
    const { data, error } = await serviceClient.rpc('rls_audit');
    expect(error).toBeNull();

    // Die Ausgabe im Fehlerfall ist wichtiger als die Zusicherung: Wer diesen
    // Test rot sieht, soll sofort lesen können, welche Tabelle die Policy fehlt.
    expect(data, JSON.stringify(data, null, 2)).toHaveLength(0);
});
```

Das zweite Argument von `expect(…)` ist die Fehlermeldung, die Vitest bei einem roten Test anzeigt. Statt „expected length 3 to be 0" liest man dann die konkreten Befunde. Ein kleines Detail mit großer Wirkung: **Ein Test, der bei Rot nicht sagt, was los ist, kostet Zeit.**

Und dieser Test ist eine **Dauerprüfung**: Er läuft bei jedem `pnpm test:db` und schlägt an, sobald irgendwann eine Tabelle ohne Policy dazukommt – auch wenn das erst in einem Jahr passiert.

Dann die Gegenprobe zu allem Bisherigen:

```ts
it('sieht die öffentlichen Stammdaten — die Sperre ist gezielt, nicht pauschal', async () => {
    // Gegenprobe zu allem darüber. Eine Datenbank, in der der Gast NICHTS sieht,
    // wäre trivial sicher und für eine Hotelseite nutzlos.
    //
    // Gefiltert auf das Seed-Hotel: Andere Testdateien legen eigene Hotels mit
    // eigenen Kategorien an, und eine feste Zahl über den Gesamtbestand wäre nur
    // so lange richtig, bis jemand einen Test hinzufügt.
    const hotels = await anonClient.from('hotels').select('name').eq('id', SEED_HOTEL);
    const kategorien = await anonClient.from('room_types').select('slug').eq('hotel_id', SEED_HOTEL);
    const preise = await anonClient.from('room_type_rates').select('amount_cents').limit(1);
    const bilder = await anonClient.from('room_type_images').select('alt_text').in('room_type_id', SEED_KATEGORIEN);

    expect(hotels.error).toBeNull();
    expect(hotels.data).toHaveLength(1);
    expect(kategorien.data).toHaveLength(3);
    expect(preise.data).toHaveLength(1);
    expect(bilder.data).toHaveLength(2);
});
```

Der Satz _„Eine Datenbank, in der der Gast NICHTS sieht, wäre trivial sicher und für eine Hotelseite nutzlos"_ fasst zusammen, warum Sicherheitstests immer Gegenproben brauchen. Man könnte alle Policies löschen und alle „sieht nichts"-Tests wären grün.

Der zweite Kommentar nennt eine wichtige Testhygiene-Regel: Die Abfragen sind auf das **Seed-Hotel** gefiltert. Eine Prüfung wie „es gibt genau 3 Kategorien" über den gesamten Bestand wäre nur so lange richtig, bis eine andere Testdatei eine eigene Kategorie anlegt. Bei geteilter Datenbank muss man auf **die eigenen Daten** filtern.

### Der raffinierteste Test des Commits

```ts
it('darf die drei öffentlichen Funktionen aufrufen — und sonst keine', async () => {
    // Jede Funktion wird mit ihrer ECHTEN Signatur aufgerufen. Ein Aufruf mit
    // leeren Argumenten liefert PGRST202 ("keine passende Funktion") — und dieser
    // Test wäre dann grün, ohne je ein Recht geprüft zu haben.
    const oeffentlich: Record<string, Record<string, unknown>> = {
        availability_calendar: { p_from: '2035-01-01', p_to: '2035-01-02', p_adults: 2 },
        search_availability: { p_check_in: '2035-01-01', p_check_out: '2035-01-03', p_adults: 2 },
        // Absichtlich mit ungültigem Zeitraum: Der Aufruf soll fachlich scheitern
        // (P0001), nicht an den Rechten — und keine echte Buchung anlegen.
        create_booking: {
            p_check_in: '2035-01-03',
            p_check_out: '2035-01-01',
            p_room_type_id: SEED_KATEGORIEN[0],
            p_adults: 2,
            p_email: 'rechtepruefung@muster.test',
            p_first_name: 'Test',
            p_last_name: 'Test',
        },
    };
    const intern: Record<string, Record<string, unknown>> = {
        availability_nights: { p_hotel_id: SEED_HOTEL, p_from: '2035-01-01', p_to: '2035-01-02', p_adults: 2 },
        find_rate_gaps: { tage: 30 },
        reject_booking: { p_code: 'ausgebucht' },
        rls_audit: {},
    };

    for (const [name, args] of Object.entries(oeffentlich)) {
        const { error } = await anonClient.rpc(name, args);
        expect(error?.code, `${name} sollte für anon erlaubt sein`).not.toBe('42501');
        expect(error?.code, `${name} muss für anon auffindbar sein`).not.toBe('PGRST202');
    }

    for (const [name, args] of Object.entries(intern)) {
        const { error } = await anonClient.rpc(name, args);
        expect(error?.code, `${name} darf für anon NICHT erlaubt sein`).toBe('42501');
    }
});
```

Drei Details machen diesen Test besonders:

**1. Die echten Signaturen.** Der naheliegende Weg wäre `anonClient.rpc(name, {})` gewesen – kurz und generisch. Aber PostgREST findet dann keine passende Funktion und antwortet mit `PGRST202`. Der Test wäre grün, ohne je ein Recht geprüft zu haben – er hätte nur bewiesen, dass man Funktionen mit falschen Argumenten nicht aufrufen kann.

Deshalb wird `PGRST202` **ausdrücklich ausgeschlossen**: `expect(error?.code, …).not.toBe('PGRST202')`. Damit fällt der Test auf, wenn jemand eine Funktion umbenennt oder ihre Signatur ändert, ohne den Test anzupassen.

**2. `create_booking` mit absichtlich ungültigem Zeitraum.** Anreise 3. Januar, Abreise 1. Januar. Der Aufruf soll fachlich scheitern (`P0001`), nicht an den Rechten – und dabei keine echte Buchung in der Datenbank hinterlassen. Ein Rechtetest, der als Nebeneffekt Daten anlegt, wäre unangenehm.

**3. Die Meldungstexte in `expect`.** `expect(error?.code, \`${name} sollte für anon erlaubt sein\`)` – bei einem roten Test steht der Funktionsname direkt in der Ausgabe. In einer Schleife über sieben Funktionen ist das der Unterschied zwischen „irgendwas ist falsch" und „`find_rate_gaps` ist falsch".

## 4. Die Dokumentation wird nachgeführt

Der zweite Teil des Commits holt die Doku an den Code-Stand heran. Neu ist ein Abschnitt `4g` in `README.md` mit fünf Entscheidungen, die **während** der Umsetzung entstanden sind:

```markdown
## 4g. Entschieden (Runde 7) — bei der Umsetzung

Diese Runde entstand **während** der Phasen 1–7. Jeder Punkt hier ist eine Stelle, an der die
Umsetzung etwas gezeigt hat, das man am Reißbrett nicht sehen konnte.
```

Diese Formulierung ist bemerkenswert ehrlich. Trotz zweier Planungsrunden mit 36 Entscheidungen sind beim Bauen fünf weitere Fragen aufgetaucht, die man vorher nicht sehen konnte.

| Nr.   | Entscheidung                                             | woran sie sichtbar wurde                        |
| ----- | -------------------------------------------------------- | ----------------------------------------------- |
| `E37` | Verfügbarkeit in **drei** Funktionen, Zahlen mitmaskiert | `create_booking` braucht den genauen Grund      |
| `E38` | Admin-Zugang über `EXECUTE`, nicht über `is_staff()`     | Wachposten hätte auch `service_role` abgewiesen |
| `E39` | Nebenläufigkeitstest braucht **sechs** Anfragen          | Zwei-Anfragen-Test blieb ohne Lock grün         |
| `E40` | Abnahme als Funktion, nicht als Checkliste               | Checkliste ist genau einmal richtig             |
| `E41` | `create_booking` überschreibt keine Kundenstammdaten     | Zweitbuchung mit anderer Tippweise              |

Zwei davon verdienen einen genaueren Blick, weil sie eingestandene Lücken sind.

### `E37` – eine Lücke in `E28`, keine Auslegung

```markdown
**Begründung, Teil 2 — warum auch die Zahlen:** E28 verlangt nur die Maskierung des _Grundes_.
Aber `ausgebucht` bedeutet `rooms_free = 0` und `kein_preis` bedeutet `rooms_free > 0`. Wer die
Zahl zeigt und den Grund verbirgt, hat nichts verborgen. Das war eine Lücke in E28, keine
Auslegung.
```

Der letzte Satz ist wichtig. Eine frühere Entscheidung wird nicht neu interpretiert, sondern als **unvollständig** benannt. Das ist ein deutlicher Unterschied zu „wir haben `E28` so verstanden" – und deutlich hilfreicher für jeden, der später beide Entscheidungen liest.

### `E38` – der Preis wird ausdrücklich benannt

```markdown
**Bekannte Folge, ausdrücklich benannt:** Damit ist der Staff-Zweig von E28 in v1 **toter Code**.
Die feinen Gründe `ausgebucht`, `kein_preis` und `zu_klein` erreichen niemanden, auch nicht über
den Service-Role-Key, und sind deshalb ungetestet. Der billigste Ausweg wäre eine Zeile in
`is_staff()`: `select auth.role() = 'service_role'`. Das ist eine Änderung am Seam aus E13 und
steht bewusst offen.
```

Eine unangenehme Konsequenz, klar ausgesprochen: Weil `is_staff()` immer `false` liefert, sieht **niemand** die feinen Sperrgründe. Der Staff-Zweig in `mask_reason` ist derzeit nicht erreichbar und damit ungetestet.

Und die Lösung steht gleich dabei – eine Zeile in `is_staff()`. Genau das ist der Sinn eines Seams: Die Änderung ist bekannt, klein und lokalisiert.

Solche Notizen sind das Gegenteil von technischer Schuld, die man verschweigt. Eine benannte Lücke mit Lösungsweg kostet drei Zeilen und spart der nächsten Person eine Stunde.

### `E39` – der schwache Test bleibt stehen, mit Vermerk

```markdown
**Warum das hier steht und nicht nur im Testkommentar:** Ein Test, der eine Entscheidung belegen
soll, es aber nicht tut, ist schlimmer als kein Test — er täuscht Sicherheit vor. Beide Varianten
stehen jetzt im Code, jede mit dem Vermerk, welche davon trägt.
```

## 5. Nachgeführtes in `schema.md`

Das normative Dokument bekommt nach, was in den Migrationen anders oder genauer geworden ist:

```markdown
- schema.md: set_updated_at-Trigger als Konvention, Teilindex fuer den
  Standardtarif, is_blocking_status im EXCLUDE-Praedikat samt REINDEX-Hinweis,
  entzogene Rechte auf booking_events, interne Funktionen in der
  Funktionstabelle, Indexliste bereinigt (zwei redundante Eintraege entfernt
  und begruendet)
```

Der interessanteste Punkt ist der letzte: Aus der Indexliste werden **zwei Einträge entfernt**, weil die Umsetzung gezeigt hat, dass sie redundant sind – der Teilindex auf `(room_type_id, stay)` deckt den vollständigen GiST-Index ab, und `booking_reference` bekommt seinen Index durch das `UNIQUE`.

Das ist die Regel aus Commit 001 in Anwendung: `schema.md` ist normativ. Weicht die Umsetzung ab, wird das Dokument geändert – nicht stillschweigend anders gebaut. Ein Schema-Dokument, das nicht mehr stimmt, ist gefährlicher als keines, weil ihm noch geglaubt wird.

Und die Änderungshistorie bekommt ihren Eintrag:

```diff
+| 2026-09-02 | Phasen 1–7 umgesetzt und getestet (91 Tests). Runde 7 (E37–E41) aus der Umsetzung heraus entschieden; `schema.md` um Trigger, Teilindizes, `is_blocking_status` im Prädikat und die internen Funktionen nachgeführt |
```

## Was wurde erreicht?

**91 grüne Tests.** Die Abnahme ist erfolgt – und zwar nicht als abgehakte Liste, sondern als Funktion, die bei jedem Testlauf mitprüft.

Die Datenbankschicht der Anwendung ist damit vollständig:

| Phase | Ergebnis                                           | Tests |
| ----- | -------------------------------------------------- | ----- |
| 1     | CLI, Umgebungstrennung, Testgerüst                 | 3     |
| 2     | Stammdaten, RLS, Storage, Minimalseed              | 16    |
| 3     | Saisonpreise, Überlappungsschutz, `find_rate_gaps` | 24    |
| 4     | Kunden, Buchungen, Nächte, Historie                | 50    |
| 5     | Verfügbarkeit pro Nacht und pro Kategorie          | 66    |
| 6     | `create_booking` mit Lock und Preiseinfrierung     | 85    |
| 7     | `rls_audit` als Dauerprüfung                       | 91    |

Die Idee dieser letzten Phase ist die vielleicht übertragbarste des ganzen Branches:

> **Eine Prüfung, die jemand von Hand durchgeht, ist genau einmal richtig.**

Das gilt weit über RLS hinaus – für Style Guides, Sicherheitsprüfungen, Barrierefreiheit, Namenskonventionen. Was als Checkliste in einer Datei steht, verfällt. Was als Test läuft, bleibt gültig.

Und daneben stehen zwei Sätze, die im ganzen Branch wiederkehren:

> **Eine Prüffunktion, die nie etwas findet, ist nicht von einer kaputten zu unterscheiden.**
>
> **Ein Test, der eine Entscheidung belegen soll, es aber nicht tut, ist schlimmer als kein Test – er täuscht Sicherheit vor.**

### Wie es weitergeht

Der Branch endet hier bewusst. Die Phasen 8–10 sind vertagt (`V1`):

- **Phase 8:** TypeScript-Typen per `pnpm db:types` erzeugen und eine Service-Schicht davor legen.
- **Phase 9:** Die Kalender-UI aus Branch `buchungs-seite` an `availability_calendar` und `create_booking` anschließen – dann wird aus dem Kalender-Prototyp eine echte Buchungsstrecke.
- **Phase 10:** Cloud-Deployment.

Damit schließt sich der Bogen zum vorigen Branch: Dort entstand ein Kalender mit einem `TODO` für die Backend-Anbindung. Hier ist das Backend entstanden – und es ist gemessen, getestet und begründet.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](010_2026-09-04_update-project-diary.md)
