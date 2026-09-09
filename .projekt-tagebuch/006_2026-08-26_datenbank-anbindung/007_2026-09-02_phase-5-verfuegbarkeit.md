[← Vorheriger Commit](006_2026-09-02_phase-4-kunden-buchungen-naechte-historie.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(db): Phase 5 - Verfuegbarkeit pro Nacht und pro Kategorie

- **Commit:** `7b08f03`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Jetzt wird gerechnet. Diese Phase beantwortet die zentrale Frage jeder Hotelseite: **Ist in dieser Nacht noch ein Zimmer dieser Kategorie frei – und was kostet es?**

```text
 .../20260902117000_availability_nights.sql         | 149 +++++++++
 .../20260902118000_availability_calendar.sql       |  90 ++++++
 .../20260902119000_search_availability.sql         | 113 +++++++
 supabase/tests/availability.spec.ts                | 359 +++++++++++++++++++++
 4 files changed, 711 insertions(+)
```

Der Plan sah **zwei** Funktionen vor. Es wurden **drei** – und der Grund dafür ist die interessanteste Lektion dieses Commits.

## 1. Warum drei Funktionen statt zwei?

Der Umsetzungsplan verlangte `availability_calendar` (eine Zeile pro Nacht, für den Kalender) und `search_availability` (eine Zeile pro Kategorie, für die Ergebnisliste). Beide sollten die Sperrgründe **maskieren**: Ein Gast soll nur „nicht buchbar" sehen, nicht „ausgebucht" oder „kein Preis hinterlegt" (`E28`).

Beim Bauen von Phase 6 wurde ein Widerspruch sichtbar. `create_booking` muss dem Gast einen **strukturierten Fehler** liefern (`E31`): Code, Datum, Grund. Dafür braucht die Funktion selbst den _genauen_ Grund – sie kann ihn danach maskieren. Und hier lag das Problem:

```sql
-- Warum die Trennung noetig ist: create_booking (Phase 6) muss den GENAUEN Grund
-- einer Ablehnung kennen, um den strukturierten Fehler aus E31 zu erzeugen. Es laeuft
-- als SECURITY DEFINER, aber is_staff() gibt trotzdem false zurueck (E13 ist
-- rollenbasiert, nicht kontextbasiert) - es bekaeme also den maskierten Grund und
-- koennte E31 nicht erfuellen.
```

Der Denkfehler, den man leicht macht: „Die Funktion läuft als `SECURITY DEFINER`, also ist sie privilegiert, also gibt `is_staff()` `true` zurück." Falsch. `SECURITY DEFINER` ändert die **Datenbankrechte**, nicht den Anwendungskontext. `is_staff()` gibt in v1 hart `false` zurück – für jede Rolle, in jedem Kontext. Also hätte `create_booking` selbst nur `nicht_buchbar` erfahren und dem Gast keinen Datumshinweis geben können.

Die Lösung ist eine **Schichtung**:

```text
                    availability_nights()          ← interner Kern
                    rohe Zahlen, feine Gründe
                    kein EXECUTE für anon
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
availability_calendar()  search_availability()  create_booking()
eine Zeile/Nacht         eine Zeile/Kategorie   Phase 6
maskiert                 maskiert               braucht den genauen Grund
```

Und wichtig: Die Forderung des Umsetzungsplans bleibt erfüllt.

```sql
-- Der Umsetzungsplan verlangt, dass Ergebnisliste und Buchung DIESELBE Regel benutzen
-- ("zwei Implementierungen derselben Regel waeren die eigentliche Fehlerquelle").
-- Genau das leistet diese Funktion: alle drei Aufrufer lesen aus ihr.
```

Das ist ein Muster, das über SQL hinaus trägt: **Ein interner Kern mit vollständigen Informationen, darüber mehrere Sichten mit unterschiedlichem Detailgrad.** Die Alternative – zwei Funktionen, die dieselbe Rechnung zweimal enthalten – wäre garantiert irgendwann auseinandergelaufen.

## 2. `availability_nights` – die Kapazitätsformel

```sql
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
```

Die Formel steht in `schema.md` und wird hier umgesetzt:

```text
kapazität = aktive Zimmer − an dieser Nacht gesperrte Zimmer          (E18)
frei      = kapazität − blockierende Buchungen dieser Nacht           (E11)
```

Der Funktionskörper baut sie in nachvollziehbaren Schritten auf.

**Schritt 1 – die Nächte:**

```sql
with naechte as (
    -- Halb-offen: p_to ist der Abreisetag und damit KEINE Nacht (E29).
    select generate_series(p_from, p_to - 1, interval '1 day')::date as night
),
```

Das `p_to - 1` ist die halb-offene Konvention in einer Zeile. Wer vom 10. bis 13. bleibt, schläft in den Nächten 10., 11. und 12. – drei Nächte, nicht vier. Ein `generate_series(p_from, p_to, …)` hätte eine Nacht zu viel erzeugt und jede Rechnung um einen Tag verfälscht.

**Schritt 2 – die betrachteten Kategorien:**

```sql
kategorien as (
    select rt.id, rt.max_occupancy
    from public.room_types rt
    where rt.hotel_id = p_hotel_id
      and rt.archived_at is null
      and (p_room_type_id is null or rt.id = p_room_type_id)
),
```

Der Ausdruck `(p_room_type_id is null or rt.id = p_room_type_id)` ist ein häufig gebrauchtes Muster für **optionale Filter**: Ist der Parameter leer, wirkt die Bedingung nicht; ist er gesetzt, filtert sie. Damit deckt eine Funktion beide Fälle ab, ohne zwei Varianten zu brauchen.

**Schritt 3 – das Kreuzprodukt als Grundlage:**

```sql
basis as (
    select n.night, k.id as room_type_id, k.max_occupancy
    from naechte n
    cross join kategorien k
),
```

Jede Nacht mit jeder Kategorie. Diese Tabelle ist das Gerüst, an das die drei Zählungen angehängt werden – wichtig, weil eine Nacht ohne Buchungen und ohne Sperrungen trotzdem eine Zeile bekommen muss.

**Schritt 4 – die drei Zählungen:**

```sql
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
```

Drei Details zum Mitnehmen:

**`count(distinct rb.room_id)`** bei den Sperrungen, nicht `count(*)`. Hätte ein Zimmer zwei Sperrungen in derselben Nacht, würde `count(*)` es doppelt zählen – und die Kapazität wäre zu niedrig. (Der Exclusion-Constraint aus Phase 2 verhindert das eigentlich, aber Verlassen und Vertrauen sind zwei verschiedene Dinge.)

**`stay @> b.night`** nutzt die generierte `daterange`-Spalte aus Phase 4. Statt `bk.check_in <= b.night and bk.check_out > b.night` steht dort ein einziger Operator, bei dem man `<=` und `<` nicht verwechseln kann.

**`public.is_blocking_status(bk.status)`** – die Regel aus Phase 4 wird **aufgerufen**, nicht nachgebaut. Kein `status <> 'cancelled'` an dieser Stelle. Der Gewinn zeigt sich in Phase 6: Dort steht dieselbe Funktion wieder, und beide bleiben automatisch synchron.

**Schritt 5 – der Preis:**

```sql
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
```

Hier zahlt sich der eindeutige Teilindex aus Phase 3 aus: `rp.is_default` liefert garantiert höchstens eine Zeile pro Hotel. Ohne diesen Index wären die Preise hier vervielfacht worden.

**Schritt 6 – das Ergebnis:**

```sql
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
```

Alle vier Verknüpfungen sind **`LEFT JOIN`** mit `coalesce(…, 0)`. Das ist zwingend: Eine Nacht ohne Buchungen kommt in `belegung` gar nicht vor. Mit einem gewöhnlichen `JOIN` würde die Zeile verschwinden – und eine Nacht, in der alles frei ist, wäre einfach nicht im Ergebnis. Ein klassischer Fehler bei Aggregationen: **Genau die interessanten Fälle sind die, in denen nichts gefunden wird.**

Der Kommentar zu `rooms_free` verdient besondere Aufmerksamkeit. Der reflexhafte Griff wäre `greatest(0, ...)` gewesen – negative freie Zimmer klingen nach Fehler. Aber:

- Drei Zimmer, alle drei gebucht → `rooms_free = 0`.
- Eines geht kaputt und wird gesperrt → Kapazität 2, Buchungen 3 → `rooms_free = -1`.

Das ist keine Rechenpanne, sondern die **Meldung einer Überbuchung**. Die Rezeption muss das erfahren, weil sie einen Gast umlegen muss. Ein auf 0 gedeckelter Wert hätte diese Information vernichtet.

Der Test dazu prüft es ausdrücklich:

```ts
it('Fall 3b: eine Sperrung darf die Kapazität ins Negative drücken (E18)', async () => {
    // Die Storno aus Fall 2 zurücknehmen: 3 Buchungen, 2 Zimmer Kapazität.
    await serviceClient
        .from('bookings')
        .update({ status: 'confirmed', cancelled_at: null })
        .eq('id', bookingIds[0] as string);

    const row = await nightRow();
    // −1 ist kein Rechenfehler, sondern die Meldung einer Überbuchung an den
    // Betrieb. Das Zimmer IST kaputt — die Datenbank darf diese Tatsache nicht
    // ablehnen, aber sie muss sie sichtbar machen.
    expect(row.rooms_free).toBe(-1);
});
```

### Der Zugriffsschutz

```sql
-- Nicht fuer den Browser. Die oeffentlichen Funktionen laufen als SECURITY DEFINER
-- und duerfen sie deshalb aufrufen, ohne dass anon ein EXECUTE-Recht braucht.
revoke all on function public.availability_nights(uuid, date, date, int, int, uuid) from public;
revoke all on function public.availability_nights(uuid, date, date, int, int, uuid) from anon, authenticated;

-- Der Service-Role-Key darf, wie bei find_rate_gaps: In v1 ist er der einzige
-- Admin-Zugang (E35), und die rohen Zahlen sind genau die Betriebssicht, die E18
-- verlangt - eine Ueberbuchung durch eine Sperrung soll SICHTBAR sein.
grant execute on function public.availability_nights(uuid, date, date, int, int, uuid) to service_role;
```

Der erste Satz erklärt, warum die Schichtung überhaupt funktioniert: Eine Funktion mit `SECURITY DEFINER` läuft mit den Rechten ihres Eigentümers. Sie darf also `availability_nights` aufrufen, obwohl der ursprüngliche Aufrufer (`anon`) das nicht darf.

Beachte auch, dass die Signatur beim `revoke`/`grant` vollständig angegeben wird: `(uuid, date, date, int, int, uuid)`. PostgreSQL erlaubt Überladung – zwei Funktionen mit gleichem Namen und verschiedenen Parametern. Ohne Signatur wüsste die Datenbank nicht, welche gemeint ist.

## 3. `mask_reason` – die Zweistufigkeit an einer Stelle

```sql
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
```

Wieder das Muster „eine Regel, eine Stelle" – wie `is_staff()` und `is_blocking_status()`. Die Zuordnung, welcher Grund maskiert wird und welcher nicht, steht genau einmal im Schema.

Die Unterscheidung ist inhaltlich durchdacht:

| Grund                 | maskiert? | Begründung                                          |
| --------------------- | --------- | --------------------------------------------------- |
| `ausgebucht`          | ja        | verrät die Belegungssituation des Hotels            |
| `kein_preis`          | ja        | verrät einen internen Konfigurationsfehler          |
| `zu_klein`            | ja        | verrät die Zimmerausstattung im Detail              |
| `vergangenheit`       | **nein**  | verrät nichts, und der Gast weiß es selbst          |
| `ausserhalb_horizont` | **nein**  | hilfreiche Auskunft: „so weit im Voraus noch nicht" |

Maskierung ist also nicht pauschal, sondern gezielt. Der letzte Punkt ist besonders vernünftig: Wer im März 2028 buchen will und nur „nicht möglich" liest, probiert es blind weiter. „So weit im Voraus nehmen wir noch keine Buchungen an" beendet die Suche höflich.

## 4. `availability_calendar` – eine Zeile pro Nacht

```sql
-- availability_calendar() — eine Zeile PRO NACHT (E24, E28, E29).
--
-- Fuettert den Kalender. Ein Tageswert bedeutet "diese NACHT ist verfuegbar" - nicht
-- "dieser Tag ist frei". Die Oberflaeche leitet daraus ab (E29):
--   Anreisetag waehlbar, wenn DIESE Nacht frei ist
--   Abreisetag waehlbar, wenn die VORHERIGE Nacht frei ist
-- Wer stattdessen den Tag komplett durchstreicht, verkauft keine Anschlussnaechte.
```

Dieser Kommentar ist die Schnittstellenbeschreibung für die Kalender-UI aus Branch 005 – und ein Punkt, an dem sehr leicht ein Fehler entsteht. Ein Kalender zeigt Tage, die Datenbank liefert Nächte. Die Übersetzungsregel muss irgendwo festgeschrieben sein, sonst rät die Oberfläche:

```text
Nacht:        10.  11.  12.  13.
frei?          ✓    ✓    ✓   VOLL

→ Anreise am 10., 11., 12. wählbar
→ Abreise am 11., 12., 13. wählbar  (Nacht davor entscheidet)
→ Der 13. ist als ANREISE nicht wählbar, als ABREISE aber schon
```

Die Bewertungslogik der Funktion:

```sql
bewertet as (
    select
        n.night,
        n.summe_freie,
        case
            -- Reihenfolge ist bedeutungstragend: Was zeitlich unmoeglich ist, muss
            -- vor allem Fachlichen kommen, sonst meldet der Kalender "ausgebucht"
            -- fuer einen Tag, der einfach vorbei ist.
            when n.night < current_date then 'vergangenheit'
            -- Halb-offen wie ueberall: buchbar sind die Naechte
            -- [heute, heute + booking_horizon_days) (E30).
            when n.night >= current_date + (select h.booking_horizon_days from hotel h) then 'ausserhalb_horizont'
            when not coalesce(n.passt_irgendwo, false) then 'zu_klein'
            when coalesce(n.beste_freie, 0) <= 0 then 'ausgebucht'
            when coalesce(n.beste_freie_mit_preis, 0) <= 0 then 'kein_preis'
            else null
        end as grund
    from je_nacht n
)
```

Die **Reihenfolge** der `when`-Zweige ist Teil der Fachlogik, nicht Geschmackssache. Ein `CASE` nimmt den ersten passenden Zweig. Stünde `ausgebucht` vor `vergangenheit`, würde ein längst vergangener Tag mit „ausgebucht" gemeldet – formal nicht falsch, aber irreführend. Zeitliche Unmöglichkeit kommt vor fachlicher.

### Die Erweiterung von `E28`: auch die Zahlen werden maskiert

```sql
select
    b.night,
    (b.grund is null) as is_available,
    -- Fuer Gaeste wird die Zahl bei nicht buchbaren Naechten unterdrueckt, und das
    -- ist kein Zierrat: Der Unterschied zwischen `ausgebucht` (rooms_free = 0) und
    -- `kein_preis` (rooms_free > 0) waere sonst aus der Zahl ablesbar - die
    -- Maskierung des Grundes waere wirkungslos (E28).
    case when b.grund is null or public.is_staff() then b.summe_freie else null end as rooms_free,
    public.mask_reason(b.grund) as unavailable_reason
from bewertet b
order by b.night;
```

Das ist eine der schärfsten Beobachtungen des ganzen Branches. `E28` verlangte nur die Maskierung des **Grundes**. Aber die Zahl verrät ihn:

| Situation  | `unavailable_reason` (maskiert) | `rooms_free` (unmaskiert) |
| ---------- | ------------------------------- | ------------------------- |
| ausgebucht | `nicht_buchbar`                 | `0`                       |
| kein Preis | `nicht_buchbar`                 | `2`                       |

Wer den Grund verbirgt und die Zahl zeigt, hat nichts verborgen. Diese Lücke wurde beim Bauen entdeckt und in Phase 7 als `E37` festgehalten:

> Das war eine Lücke in E28, keine Auslegung.

Ein guter Merksatz für Datenschutz und Sicherheit generell: **Maskierung muss alle Kanäle abdecken, sonst ist sie Dekoration.** Es reicht nicht, das offensichtliche Feld zu verbergen; man muss prüfen, was sich aus den übrigen Feldern zurückrechnen lässt.

Der Test prüft genau das:

```ts
it('Fall 1b: der Gast sieht die Nacht als nicht verfügbar', async () => {
    const { data, error } = await anonClient.rpc('availability_calendar', {
        p_from: NIGHT,
        p_to: NEXT,
        p_adults: 2,
        p_room_type_id: fixture.roomTypeId,
        p_hotel_id: fixture.hotelId,
    });
    expect(error).toBeNull();
    const row = (data as CalendarRow[])[0] as CalendarRow;
    expect(row.is_available).toBe(false);
    // Kein `ausgebucht` nach außen (E28) …
    expect(row.unavailable_reason).toBe('nicht_buchbar');
    // … und keine Zahl, aus der sich `ausgebucht` von `kein_preis`
    // zurückrechnen ließe. Sonst wäre die Maskierung des Grundes wirkungslos.
    expect(row.rooms_free).toBeNull();
});
```

## 5. `search_availability` – eine Zeile pro Kategorie

Diese Funktion füttert die Ergebnisliste („welche Kategorien sind für meinen Aufenthalt buchbar und was kosten sie?"). Der Kommentar erklärt gleich die wichtigste Rechenentscheidung:

```sql
-- Fuettert die Ergebnisliste: Minimum freier Zimmer ueber den Zeitraum und
-- Gesamtpreis. Das Minimum ist der richtige Aggregator, nicht der Durchschnitt:
-- Eine Kategorie, die an drei von vier Naechten frei ist, ist fuer einen
-- viernaechtigen Aufenthalt nicht buchbar.
--
-- Rueckgabe nur als Aggregat (E17): Nie einzelne Zimmer, nie Zimmernummern - nur
-- "so viele sind frei" und "so viel kostet es".
```

Das Minimum statt Durchschnitt ist eine Kleinigkeit mit großer Wirkung. Bei drei Nächten mit 2, 1 und 2 freien Zimmern wäre der Durchschnitt 1,67 – die Kategorie sähe freier aus, als sie für den vollen Aufenthalt ist. Buchbar ist der Aufenthalt aber nur, wenn in **jeder** Nacht ein Zimmer frei ist. Das Minimum ist die einzige richtige Antwort.

Der Test dazu:

```ts
it('nimmt das MINIMUM über den Zeitraum, nicht den Durchschnitt', async () => {
    // Eine Buchung an genau einer der drei Nächte drückt das Minimum auf 1.
    // Ein Durchschnitt wäre hier ~1,67 und die Kategorie sähe freier aus, als
    // sie für den vollen Aufenthalt ist.
    await serviceClient.from('bookings').insert({
        /* … eine Nacht … */
    });

    const { data } = await anonClient.rpc('search_availability', {
        /* … drei Nächte … */
    });
    const row = (data as { rooms_free: number; is_bookable: boolean }[])[0];
    expect(row?.rooms_free).toBe(1);
    expect(row?.is_bookable).toBe(true);
});
```

### Der leere Zeitraum ist ein Fehler, kein leeres Ergebnis

```sql
begin
    if p_check_out <= p_check_in then
        -- Halb-offen heisst: mindestens eine Nacht. Ein leerer Zeitraum ist keine
        -- Anfrage, sondern ein Fehler - und wird als solcher gemeldet, statt still
        -- null Zeilen zu liefern.
        raise exception 'Abreise muss nach der Anreise liegen (% >= %)', p_check_in, p_check_out
            using errcode = '22007';
    end if;
```

Eine Anfrage mit Anreise = Abreise würde ohne diese Prüfung durch `generate_series(p_from, p_to - 1, …)` einfach **null Nächte** erzeugen – und das Ergebnis wäre eine leere Liste. Für die Oberfläche sieht das aus wie „nichts frei", tatsächlich war es „falsch gefragt".

Zwei sehr verschiedene Situationen mit identischer Antwort sind ein Diagnoseproblem. Deshalb ein expliziter Fehler mit dem Code `22007` (`invalid_datetime_format`).

Das gleiche Prinzip wie bei `E25` (Preislücke) und `E28` (Sperrgründe): **Unterschiedliche Ursachen brauchen unterschiedliche Antworten**, sonst ist Fehlersuche unmöglich.

### Preis-Aggregation mit `NULL` statt 0

```sql
je_kategorie as (
    select
        r.room_type_id,
        bool_and(r.fits) as passt,
        min(r.rooms_free) as min_frei,
        count(*)::int as naechte,
        -- Fehlt EINE Nacht im Preis, ist die Summe unbekannt - nicht 0.
        -- Ein Gesamtpreis von 0 waere die gefaehrlichste Antwort von allen (E25).
        case when count(r.rate_cents) = count(*) then sum(r.rate_cents)::int else null end as summe,
        max(r.currency) as currency
    from roh r
    group by r.room_type_id
),
```

Ein SQL-Detail mit großer Wirkung: `count(*)` zählt alle Zeilen, `count(spalte)` zählt nur die Zeilen, in denen die Spalte **nicht `NULL`** ist. Sind beide Zahlen gleich, hat jede Nacht einen Preis, und die Summe ist gültig. Sonst wird `NULL` zurückgegeben.

Warum nicht einfach `sum(r.rate_cents)`? Weil `sum` `NULL`-Werte ignoriert. Bei drei Nächten à 100 € und einer ohne Preis wäre die Summe 300 € – ein Angebot für vier Nächte zum Preis von drei. Das ist die gefährlichste denkbare Antwort, weil sie plausibel aussieht.

Auch `bool_and(r.fits)` ist bewusst gewählt: Alle Nächte müssen passen, nicht nur eine. Das Gegenstück `bool_or` steht in `availability_calendar` – dort ist die Frage „gibt es _irgendeine_ Kategorie, in die die Gäste passen?".

### Nicht buchbare Kategorien werden mitgeliefert

```sql
-- Absichtlich werden AUCH nicht buchbare Kategorien zurueckgegeben, mit Grund. Eine
-- Ergebnisliste, die ausgebuchte Kategorien verschweigt, laesst den Gast glauben, es
-- gaebe sie nicht - und beim naechsten Termin sind sie wieder da.
```

Eine Entscheidung über die Benutzererfahrung, getroffen in der Datenbank. Wer eine Kategorie aus der Liste entfernt, weil sie gerade ausgebucht ist, erzeugt eine falsche Vorstellung vom Angebot. Besser: zeigen, mit Vermerk „für diesen Zeitraum nicht verfügbar".

Und die Sortierung ist entsprechend gedacht:

```sql
    order by b.grund nulls first, b.summe nulls last, rt.name;
```

Buchbare zuerst (`grund` ist `NULL`), darunter nach Preis, dann alphabetisch. `nulls first` und `nulls last` sind explizit angegeben, weil die Standardsortierung von `NULL` je nach Richtung variiert – sich darauf zu verlassen wäre eine unnötige Wette.

## 6. Die Tests: 66 grün, und drei Randfälle, die man leicht übersieht

Die Testdatei prüft die vier geforderten Fälle plus mehrere Grenzen. Drei davon sind besonders lehrreich.

**Der Horizontrand – halb-offen bis in die Zeitgrenze:**

```ts
it('die letzte Nacht innerhalb des Horizonts ist nicht `ausserhalb_horizont`', async () => {
    // Halb-offen: buchbar sind [heute, heute + 365). Tag 364 gehört dazu,
    // Tag 365 nicht. Ohne diesen Test wäre ein Off-by-one am Horizontrand
    // unsichtbar — er zeigt sich erst ein Jahr später.
    expect(await reason(364)).not.toBe('ausserhalb_horizont');
    expect(await reason(365)).toBe('ausserhalb_horizont');
});
```

Zwei Tage nebeneinander, zwei verschiedene Erwartungen – das ist die korrekte Art, eine Grenze zu prüfen. Der Kommentar nennt auch, warum es hier besonders wichtig ist: _„er zeigt sich erst ein Jahr später"_. Ein Off-by-one an dieser Stelle fällt in der Entwicklung niemals auf, weil niemand testweise 365 Tage in die Zukunft klickt.

**Nacht ohne Preis: `NULL`, nicht 0:**

```ts
it('Zimmer sind frei, aber es gibt keinen Preis', async () => {
    const { data } = await serviceClient.rpc('availability_nights', {
        /* … */
    });
    const row = (data as NightRow[])[0] as NightRow;
    expect(row.rooms_free).toBe(2);
    // NULL, nicht 0. Ein Preis von 0 wäre die gefährlichste Antwort von allen:
    // die Buchung ginge durch und der Aufenthalt wäre gratis.
    expect(row.rate_cents).toBeNull();
});
```

Das ist **Fall 4 aus `E34`** und ein direkter Bezug zur Entscheidung `E25` aus Phase 3: Eine fehlende Preiszeile ist keine Gratisnacht.

**Der interne Kern ist für Gäste gesperrt:**

```ts
it('availability_nights ist für den Gast nicht aufrufbar (E17)', async () => {
    // Der interne Kern gibt rohe Zahlen ohne Maskierung heraus. Wäre er
    // erreichbar, wäre die gesamte Zweistufigkeit aus E28 umgehbar.
    const { error } = await anonClient.rpc('availability_nights', {
        /* … */
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
});
```

Ohne diesen Test wäre die ganze Schichtung wirkungslos: Der Gast müsste nur die andere Funktion aufrufen und bekäme alle rohen Zahlen. **Eine Maskierung, die man umgehen kann, ist keine.**

Und die Kapazitätsformel wird schrittweise durchgespielt – jede Änderung einzeln, mit Prüfung dazwischen:

```ts
it('Fall 1: 3 Zimmer, 3 blockierende Buchungen → rooms_free = 0', async () => {
    const row = await nightRow();
    expect(row.capacity).toBe(3);
    expect(row.rooms_free).toBe(0);
});

it('Fall 2: eine Buchung storniert → rooms_free = 1 (E11)', async () => {
    await serviceClient
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', bookingIds[0] as string);
    const row = await nightRow();
    expect(row.rooms_free).toBe(1);
    // Und die Nacht ist für den Gast wieder buchbar.
    // …
});

it('Fall 3: ein Zimmer der Kategorie gesperrt → rooms_free um 1 kleiner (E18)', async () => {
    await serviceClient.from('room_blocks').insert({ room_id: fixture.roomIds[0], starts_on: NIGHT, ends_on: NEXT, reason: 'defekt' });
    const row = await nightRow();
    // Die Sperrung senkt die KAPAZITÄT, nicht die Belegung.
    expect(row.capacity).toBe(2);
    expect(row.rooms_free).toBe(0);
});
```

Beachte Fall 3: Geprüft wird **beides** – `capacity` und `rooms_free`. Eine Sperrung senkt die Kapazität; die Belegung bleibt gleich. Würde die Funktion eine Sperrung fälschlich als Buchung zählen, wäre `rooms_free` zufällig richtig und `capacity` falsch. Wer nur eine der beiden Zahlen prüft, kann diesen Fehler nicht sehen.

## Was wurde erreicht?

Alle vier geforderten Fälle stimmen, dazu die Randfälle – **66 grüne Tests**, auch beim zweiten Lauf ohne Reset.

Konkret existieren jetzt:

- `availability_nights()` als **einzige** Quelle der Kapazitäts- und Preisrechnung – rohe Zahlen, feine Gründe, nicht aus dem Browser erreichbar.
- `availability_calendar()` mit einer Zeile pro Nacht für den Kalender, maskiert.
- `search_availability()` mit einer Zeile pro Kategorie für die Ergebnisliste, Minimum über den Zeitraum, Gesamtpreis nur wenn vollständig.
- `mask_reason()` als einzige Stelle, an der entschieden wird, welcher Grund nach außen gelangt.

Die vier übertragbaren Ideen:

1. **Ein interner Kern, mehrere maskierte Sichten.** Wenn verschiedene Aufrufer unterschiedlich viel wissen dürfen, teilt man nicht die Rechnung auf, sondern legt Sichten darüber.
2. **Maskierung muss alle Felder umfassen.** Was sich aus einer Zahl zurückrechnen lässt, ist nicht verborgen.
3. **`LEFT JOIN` + `coalesce`** bei Aggregationen – die interessanten Fälle sind meist die, in denen nichts gefunden wird.
4. **`NULL` ist eine Antwort, 0 ist eine Aussage.** „Ich weiß es nicht" und „es ist nichts" dürfen nicht denselben Wert haben.

Damit ist alles vorhanden, um eine Buchung zu prüfen. Es fehlt noch der Weg, sie auch **anzulegen** – und zwar so, dass zwei gleichzeitige Anfragen nicht dasselbe letzte Zimmer verkaufen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](008_2026-09-02_phase-6-create-booking.md)
