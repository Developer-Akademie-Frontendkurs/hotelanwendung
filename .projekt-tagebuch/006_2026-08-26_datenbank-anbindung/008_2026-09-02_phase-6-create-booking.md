[← Vorheriger Commit](007_2026-09-02_phase-5-verfuegbarkeit.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(db): Phase 6 - create_booking mit Lock, Preiseinfrierung und E31

- **Commit:** `f2554b9`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Der Höhepunkt des Branches. Bis jetzt konnte niemand außer dem Service-Role-Key eine Buchung anlegen – es gibt keine `INSERT`-Policy auf `bookings`. Diese Phase baut den **einzigen** Weg, auf dem eine Buchung entsteht: eine Datenbankfunktion.

```text
 .../migrations/20260902120000_create_booking.sql   | 248 +++++++++++++++
 supabase/tests/create-booking.spec.ts              | 346 +++++++++++++++++++++
 2 files changed, 594 insertions(+)
```

Zwei Dateien, fast gleich groß. Und die Tests sind hier nicht Beigabe, sondern der Beweis: Ohne sie ist der Überbuchungsschutz nur eine Behauptung.

Das Konzept dahinter ist die **Vertrauensgrenze** aus `E6`:

```sql
-- create_booking() — die Vertrauensgrenze (E6).
--
-- Lesen darf der Client direkt, buchen nicht. Was der Client pruefen koennte, ist
-- keine Regel, sondern eine Bitte - die Regel steht hier.
```

## 1. `reject_booking` – eine Ablehnung, mit der man arbeiten kann

Zuerst eine Hilfsfunktion, die nur einen Zweck hat: Fehler in einer Form zu erzeugen, die die Oberfläche verarbeiten kann.

```sql
-- Eine Ablehnung muss erklaeren koennen, WARUM sie abgelehnt hat, und WELCHES Datum
-- schuld ist. Ohne das Datum kann die Oberflaeche nur "geht nicht" sagen und der Gast
-- probiert blind weiter.
--
-- Der Code wird durch mask_reason geschickt (E28): Der Gast erfaehrt nicht, ob die
-- Kategorie ausgebucht ist oder ob ein Preis fehlt - aber er erfaehrt das Datum.
create or replace function public.reject_booking(p_code text, p_date date default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
    v_code text := public.mask_reason(p_code);
    v_grund text;
begin
    v_grund := case v_code
        when 'ausgebucht' then 'Fuer dieses Datum sind keine Zimmer dieser Kategorie mehr frei.'
        when 'kein_preis' then 'Fuer dieses Datum ist kein Preis hinterlegt.'
        when 'zu_klein' then 'Die Kategorie ist fuer diese Belegung zu klein.'
        when 'vergangenheit' then 'Das Datum liegt in der Vergangenheit.'
        when 'ausserhalb_horizont' then 'So weit im Voraus sind noch keine Buchungen moeglich.'
        when 'ungueltiger_zeitraum' then 'Die Abreise muss nach der Anreise liegen.'
        when 'kategorie_unbekannt' then 'Diese Zimmerkategorie gibt es nicht.'
        when 'ungueltige_belegung' then 'Die Belegung ist ungueltig.'
        else 'Fuer dieses Datum ist keine Buchung moeglich.'
    end;

    -- DETAIL traegt die maschinenlesbare Fassung. PostgREST reicht sie als
    -- `error.details` durch, MESSAGE als `error.message` - die Oberflaeche liest
    -- also nicht den deutschen Satz, sondern `code` und `datum`.
    raise exception '%', v_grund
        using errcode = 'P0001',
              detail = jsonb_build_object('code', v_code, 'datum', p_date, 'grund', v_grund)::text;
end;
$$;
```

Der Kern dieser Funktion ist eine Idee, die in jeder API vorkommt: **Fehler brauchen eine maschinenlesbare und eine menschenlesbare Form.**

PostgreSQL-Ausnahmen haben mehrere Felder, und PostgREST reicht sie unterschiedlich durch:

| PostgreSQL | im Supabase-Client | Inhalt hier                       |
| ---------- | ------------------ | --------------------------------- |
| `MESSAGE`  | `error.message`    | deutscher Satz für die Anzeige    |
| `DETAIL`   | `error.details`    | JSON mit `code`, `datum`, `grund` |
| `ERRCODE`  | `error.code`       | `P0001`                           |

Damit kann die Oberfläche entscheiden, **ohne den Text zu parsen**:

```ts
const { error } = await supabase.rpc('create_booking', { … });

if (error) {
    const detail = JSON.parse(error.details ?? '{}');
    if (detail.code === 'nicht_buchbar' && detail.datum) {
        // Genau diesen Tag im Kalender markieren und neu laden
        markiereTagAlsBelegt(detail.datum);
    }
}
```

Warum ist das Datum so wichtig? Der Kommentar sagt es: _„Ohne das Datum kann die Oberfläche nur ‚geht nicht' sagen und der Gast probiert blind weiter."_ Bei einem Aufenthalt von zehn Nächten ist „nicht möglich" nutzlos – „am 14. nicht möglich" ist eine Information, mit der man arbeiten kann.

Beachte auch: Der Code läuft durch `mask_reason` (Phase 5), bevor er in die Antwort kommt. Der Gast erfährt also `nicht_buchbar` statt `ausgebucht` – aber das Datum bleibt sichtbar. **Maskiert wird der betriebliche Grund, nicht die brauchbare Information.**

Und die Funktion ist selbst geschützt:

```sql
revoke all on function public.reject_booking(text, date) from public;
revoke all on function public.reject_booking(text, date) from anon, authenticated;
```

Wer sie direkt aufrufen könnte, könnte beliebige Fehlermeldungen erzeugen. Kein großer Schaden, aber auch kein Grund, es zu erlauben.

## 2. `create_booking` – der Ablauf

Die Signatur zeigt, was der Gast mitbringen muss:

```sql
create or replace function public.create_booking(
    p_check_in date,
    p_check_out date,
    p_room_type_id uuid,
    p_adults int,
    p_email text,
    p_first_name text,
    p_last_name text,
    p_children int default 0,
    p_phone text default null,
    p_rooms int default 1
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
```

Auffällig ist, was **nicht** in der Signatur steht: kein Preis, kein `customer_id`, keine Buchungsnummer, kein Status. All das ermittelt die Funktion selbst. Das ist `E6` in Signaturform – der Client übergibt Wünsche, nicht Fakten.

Wäre der Preis ein Parameter, könnte jeder Besucher die Buchung für einen Cent abschließen. Und keine Prüfung im TypeScript-Code könnte das verhindern, weil jeder den Aufruf im Browser nachbauen kann.

### Schritt 0: Eingaben, die gar keine Anfrage sind

```sql
begin
    -- 0. Eingaben, die gar keine Anfrage sind
    if p_check_out <= p_check_in then
        perform public.reject_booking('ungueltiger_zeitraum', p_check_in);
    end if;
    if p_adults < 1 or coalesce(p_children, 0) < 0 or p_rooms < 1 then
        perform public.reject_booking('ungueltige_belegung', p_check_in);
    end if;
    if p_email is null or position('@' in p_email) = 0 then
        raise exception 'E-Mail-Adresse fehlt oder ist ungueltig' using errcode = '22023';
    end if;

    select rt.hotel_id into v_hotel_id
    from public.room_types rt
    where rt.id = p_room_type_id and rt.archived_at is null;

    if v_hotel_id is null then
        perform public.reject_booking('kategorie_unbekannt', p_check_in);
    end if;
```

Die Prüfungen stehen **vor** dem Lock. Warum? Ein Lock ist ein Nadelöhr – solange er gehalten wird, wartet jede andere Buchungsanfrage. Was ohne Lock geprüft werden kann, wird ohne Lock geprüft.

Zur E-Mail-Prüfung: `position('@' in p_email) = 0` ist eine sehr grobe Validierung, und das ist Absicht. Eine vollständige E-Mail-Validierung in SQL wäre eine Regex-Übung mit ungewissem Ausgang – die zuverlässige Prüfung ist ohnehin die Bestätigungsmail. Hier soll nur offensichtlicher Unsinn abgefangen werden.

### Schritt 1: Der Advisory-Lock

```sql
    -- 1. Advisory-Lock, HOTELWEIT (E10, E33)
    --
    -- Ab hier laeuft kein zweiter Buchungsvorgang dieses Hotels parallel. Der Lock
    -- gilt bis zum Ende der Transaktion (xact) und muss nicht freigegeben werden -
    -- auch nicht im Fehlerfall.
    --
    -- Warum nicht feiner, etwa pro Kategorie: Eine Buchung ueber mehrere Kategorien
    -- (E20/E27) muesste dann mehrere Locks in garantiert sortierter Reihenfolge
    -- halten, sonst verklemmen sich zwei gleichzeitige Gruppenbuchungen. Bei einem
    -- Hotel dieser Groesse ist der Durchsatz belanglos, der Deadlock aber real.
    perform pg_advisory_xact_lock(hashtext('booking:' || v_hotel_id::text));
```

Diese eine Zeile ist die Antwort auf das schwierigste Problem des ganzen Schemas. Ohne sie:

```text
Zeit  Anfrage A                        Anfrage B
────  ──────────────────────────────   ──────────────────────────────
 1    prüft: 1 Zimmer frei ✓
 2                                     prüft: 1 Zimmer frei ✓
 3    legt Buchung an
 4                                     legt Buchung an
      → zwei Buchungen, ein Zimmer
```

Beide Anfragen haben korrekt geprüft. Beide haben korrekt eingefügt. Das Ergebnis ist trotzdem falsch. Das ist eine **Race Condition** – und sie fällt im Einzelbetrieb niemals auf. Sie fällt an dem Tag auf, an dem zwei Gäste gleichzeitig klicken.

Ein **Advisory-Lock** ist ein frei benannter Sperrpunkt, der nicht an eine Tabelle gebunden ist. Man bestimmt selbst, was er bedeutet:

```sql
pg_advisory_xact_lock(hashtext('booking:' || v_hotel_id::text))
```

`hashtext` macht aus dem Text `booking:<uuid>` eine Zahl (Advisory-Locks arbeiten mit Zahlen). Jede Transaktion, die dieselbe Zahl sperren will, wartet, bis die erste fertig ist. Damit sind alle Buchungsvorgänge dieses Hotels **serialisiert** – nacheinander statt gleichzeitig.

Das `xact` im Namen ist wichtig: Der Lock wird automatisch am Transaktionsende freigegeben, auch wenn ein Fehler auftritt. Die Variante ohne `xact` (`pg_advisory_lock`) müsste man explizit freigeben – und wenn man das im Fehlerfall vergisst, hängt die Anwendung.

Warum hotelweit statt pro Kategorie? Das ist `E33` aus Commit 002: Feinere Locks würden bei Mehrkategorie-Buchungen mehrere Locks verlangen, und dann droht ein **Deadlock** (A wartet auf B, B wartet auf A). Bei einem Hotel dieser Größe ist der Durchsatzverlust bedeutungslos, das Deadlock-Risiko dagegen real.

### Schritte 2 und 3: Prüfung Nacht für Nacht

```sql
    -- 2./3. Pruefung Nacht fuer Nacht — aus DERSELBEN Quelle, die auch die
    -- Ergebnisliste und den Kalender fuettert (availability_nights). Zwei
    -- Implementierungen derselben Regel waeren die eigentliche Fehlerquelle.
    v_naechte := 0;
    for v_nacht in
        select *
        from public.availability_nights(v_hotel_id, p_check_in, p_check_out, p_adults, p_children, p_room_type_id)
        order by night
    loop
        v_naechte := v_naechte + 1;

        -- Reihenfolge wie im Kalender: zeitlich Unmoegliches vor Fachlichem.
        if v_nacht.night < current_date then
            perform public.reject_booking('vergangenheit', v_nacht.night);
        elsif v_nacht.night >= current_date + v_horizon then
            perform public.reject_booking('ausserhalb_horizont', v_nacht.night);
        elsif not v_nacht.fits then
            perform public.reject_booking('zu_klein', v_nacht.night);
        elsif v_nacht.rooms_free < p_rooms then
            -- 4. Der strukturierte Fehler nennt die ERSTE Nacht, an der es scheitert.
            perform public.reject_booking('ausgebucht', v_nacht.night);
        elsif v_nacht.rate_cents is null then
            -- Niemals Preis 0 (E25): eine fehlende Preiszeile ist keine Gratisnacht.
            perform public.reject_booking('kein_preis', v_nacht.night);
        end if;

        v_total := v_total + v_nacht.rate_cents;
    end loop;

    if v_naechte = 0 then
        perform public.reject_booking('ungueltiger_zeitraum', p_check_in);
    end if;
```

Hier zahlt sich die Entscheidung aus Phase 5 aus: `availability_nights` wird **aufgerufen**, nicht nachgebaut. Der Kalender, die Ergebnisliste und die Buchung rechnen mit derselben Formel. Wären es drei Implementierungen, würde eine davon irgendwann abweichen – und dann zeigt der Kalender „frei", während die Buchung „ausgebucht" sagt.

Drei Feinheiten in der Schleife:

**`order by night`** und Ablehnung beim **ersten** Problem. Der Fehler nennt damit die früheste problematische Nacht. Das ist die brauchbarste Information: Wer bis zum 14. buchen kann, weiß, wo er kürzen muss.

**`rooms_free < p_rooms`**, nicht `rooms_free < 1`. Bei einer Anfrage für zwei Zimmer müssen zwei frei sein. Der Parameter ist Teil der Bedingung.

**Die Preissumme wird in derselben Schleife gebildet.** `v_total := v_total + v_nacht.rate_cents` – der Gesamtpreis entsteht als Nebenprodukt der Prüfung. Kein zweiter Durchlauf, keine Möglichkeit, dass geprüfte und berechnete Nächte auseinanderfallen.

**Und `v_naechte = 0`** fängt einen Fall ab, den die Schleife selbst nicht abfangen kann: Wenn es keine Nächte gibt, läuft die Schleife nie, und keine Prüfung greift. Eine Schleife, die nicht läuft, prüft nichts – ein Muster, das man leicht übersieht.

### Schritt 5: Der Kunde – finden oder anlegen

```sql
    -- 5. Kunde: ueber email_normalized finden oder anlegen (E26, E32).
    --
    -- Kein Update auf Namen und Telefon bei einem bestehenden Kunden: Wer zum
    -- zweiten Mal bucht, soll nicht versehentlich seinen Datensatz ueberschreiben,
    -- nur weil er den Vornamen anders getippt hat. Aenderungen an Stammdaten sind
    -- ein eigener Vorgang.
    select c.id into v_customer_id
    from public.customers c
    where c.email_normalized = lower(p_email);

    if v_customer_id is null then
        insert into public.customers (email, first_name, last_name, phone)
        values (p_email, p_first_name, p_last_name, p_phone)
        returning id into v_customer_id;
    end if;
```

Die generierte Spalte aus Phase 4 in Aktion: `where c.email_normalized = lower(p_email)` – ein gewöhnlicher Spaltenvergleich, kein Funktionsaufruf auf der Spalte.

Die Entscheidung, **nicht** zu aktualisieren, ist `E41`. Ein `UPDATE` bei bestehendem Kunden wäre naheliegend („die Daten sind ja aktueller"), aber gefährlich: Wer beim zweiten Mal „Anna" statt „Anne" tippt, würde seinen Datensatz stillschweigend überschreiben. Stammdatenpflege ist ein eigener Vorgang mit eigener Absicht.

Dass hier ohne Lock-Problem gearbeitet werden kann, liegt am Advisory-Lock aus Schritt 1: Zwei gleichzeitige Buchungen mit derselben E-Mail können nicht beide „nicht gefunden" feststellen.

### Schritte 6 bis 8: Buchung, Nächte, Historie – in einer Transaktion

```sql
    -- 6.-8. Buchung(en), Naechte und Historie — alles in DIESER Transaktion.
    if p_rooms > 1 then
        -- Bewusst nur bei mehreren Zimmern (E27): Eine Gruppe von eins ist keine
        -- Gruppe, und die Tabelle soll nicht stillschweigend zum Vorgang werden.
        insert into public.booking_groups default values returning id into v_group_id;
    end if;

    for i in 1..p_rooms loop
        insert into public.bookings (
            customer_id, room_type_id, rate_plan_id, booking_group_id,
            check_in, check_out, adults, children, total_amount_cents
        )
        values (
            v_customer_id, p_room_type_id, v_rate_plan_id, v_group_id,
            p_check_in, p_check_out, p_adults, coalesce(p_children, 0), v_total
        )
        returning id into v_booking_id;

        -- 7. Preis pro Nacht EINFRIEREN (E21). Ab hier aendert eine Anpassung der
        -- Saisonpreise nichts mehr an dieser Buchung - eine Buchung ist ein Vertrag.
        insert into public.booking_nights (booking_id, night, amount_cents)
        select v_booking_id, an.night, an.rate_cents
        from public.availability_nights(v_hotel_id, p_check_in, p_check_out, p_adults, p_children, p_room_type_id) an;

        -- 8. Historie (E12)
        insert into public.booking_events (booking_id, event_type, payload, actor_kind, actor_user_id)
        values (
            v_booking_id,
            'created',
            jsonb_build_object('zimmer_gesamt', p_rooms, 'gruppe', v_group_id),
            -- Der Weg durch diese Funktion IST der Gastweg (E6). Ereignisse mit
            -- actor_kind 'staff' oder 'system' entstehen an anderen Stellen.
            'customer',
            auth.uid()
        );
        ...
    end loop;
```

Das Entscheidende steht im Kommentar und ist unsichtbar im Code: **alles in einer Transaktion**. Eine PL/pgSQL-Funktion läuft immer in einer Transaktion. Wenn irgendwo ein Fehler auftritt – auch in Schritt 8 –, wird **alles** zurückgerollt. Es kann also keine Buchung ohne Nächte, keine Nächte ohne Historie und keinen Kunden ohne Buchung geben.

Dieser Punkt wird eigens getestet:

```ts
it('legt bei einer Ablehnung KEINEN Kunden an — die Transaktion rollt komplett zurück', async () => {
    const email = `verworfen.${fixture.roomTypeId.slice(0, 8)}@muster.test`;
    await book(fixture, { p_check_in: isoDay(-3), p_check_out: isoDay(-1), p_email: email });

    const { data } = await serviceClient.from('customers').select('id').eq('email_normalized', email);
    // Ohne diesen Test könnten fehlgeschlagene Versuche eine Kundenkartei aus
    // Geistern erzeugen. Die Kundenanlage passiert nach der Prüfung, aber in
    // DERSELBEN Transaktion — beides zusammen macht es dicht.
    expect(data).toHaveLength(0);
});
```

Das Einfrieren des Preises (Schritt 7) ist der Kern von `E21`: `booking_nights` bekommt für jede Nacht den Preis, der **jetzt** gilt. Ändert der Betrieb morgen die Saisonpreise, bleibt diese Buchung unberührt.

Der Rückgabewert ist bewusst `jsonb`:

```sql
    return jsonb_build_object(
        'booking_group_id', v_group_id,
        'bookings', v_bookings,
        'total_amount_cents', v_total * p_rooms,
        'nights', v_naechte
    );
```

Ein JSON-Objekt statt einer Tabelle, weil die Antwort verschachtelt ist: eine Gruppen-ID, eine Liste von Buchungen, eine Gesamtsumme. Für die Oberfläche ist das direkt verwertbar.

### Die Rechte

```sql
-- Gaeste duerfen buchen - das ist der Sinn der Funktion. Sie duerfen aber weiterhin
-- nicht direkt in `bookings` schreiben (keine Insert-Policy, Phase 4).
revoke all on function public.create_booking(...) from public;
grant execute on function public.create_booking(...) to anon, authenticated, service_role;
```

Das ist die Vertrauensgrenze in zwei Zeilen. Der Gast darf **diese Funktion** aufrufen, aber nicht in die Tabelle schreiben. Alles, was zwischen Aufruf und Ergebnis passiert, kontrolliert die Datenbank.

Und die Notiz zum Nicht-Umfang:

```sql
-- Mehrere KATEGORIEN in einem Vorgang sind bewusst noch nicht moeglich: Das
-- verlangte einen jsonb-Parameter mit Positionen. Die Struktur hier ist darauf
-- vorbereitet (Gruppe + Schleife), aber eine Schnittstelle, die die Oberflaeche
-- heute nicht bedienen kann, waere Ballast (E15).
```

`p_rooms` bucht _n_ Zimmer **derselben** Kategorie. Eine Familie, die eine Suite und ein Einzelzimmer will, braucht zwei Aufrufe. Der Grund: Die Oberfläche kann es heute nicht anders anfragen, und eine Schnittstelle, die niemand benutzt, ist Wartungslast ohne Nutzen.

## 3. Die Tests – und eine unangenehme Entdeckung

Die Testdatei enthält den lehrreichsten Moment des ganzen Branches. Zuerst das Grundgerüst:

```ts
/**
 * Test 5 und Test 6 aus E34 — die beiden, ohne die E10 und E5 nur behauptet sind.
 *
 * Gebucht wird durchgehend mit dem `anonClient`: create_booking ist der Gastweg
 * (E6), und nur so ist belegt, dass ein Gast ohne Konto buchen kann, ohne
 * Schreibrecht auf `bookings` zu haben.
 */
```

Und ein Helfer zum Auslesen des strukturierten Fehlers:

```ts
type RejectDetail = { code: string; datum: string | null; grund: string };

/** Liest den strukturierten Fehler aus E31 aus dem PostgREST-Fehler. */
function detailOf(error: { details?: string | null } | null): RejectDetail {
    return JSON.parse(error?.details ?? '{}') as RejectDetail;
}
```

### Der glückliche Pfad

```ts
it('friert den Preis pro Nacht ein — drei Zeilen, nicht vier (E21, E29)', async () => {
    const { data } = await serviceClient.from('booking_nights').select('night, amount_cents').eq('booking_id', result.bookings[0]?.id).order('night');
    expect(data).toHaveLength(3);
    // Der Abreisetag bekommt KEINE Zeile: an ihm wird nicht geschlafen.
    expect((data as { night: string }[]).map((row) => row.night)).toEqual([isoDay(30), isoDay(31), isoDay(32)]);
});
```

„Drei Zeilen, nicht vier" – die halb-offene Konvention, ein letztes Mal geprüft, diesmal am Ergebnis der Buchung. Ein Off-by-one hier hätte den Gast eine Nacht zu viel bezahlen lassen.

```ts
it('legt den Kunden an und erzeugt bei der ZWEITEN Buchung keinen zweiten (E26)', async () => {
    const email = `gast.${fixture.roomTypeId.slice(0, 8)}@muster.test`;

    // Zweite Buchung, andere Nächte, E-Mail in ANDERER Schreibweise. Ohne
    // email_normalized (E32) entstünde hier ein zweiter Kundendatensatz — und
    // das spätere Konto fände nur die Hälfte der eigenen Buchungen.
    const { error } = await book(fixture, { p_check_in: isoDay(40), p_check_out: isoDay(42), p_email: email.toUpperCase() });
    expect(error).toBeNull();

    const { data } = await serviceClient.from('customers').select('id').eq('email_normalized', email);
    expect(data).toHaveLength(1);
});
```

Hier greifen zwei Entscheidungen zusammen: `E32` (generierte Spalte) und `E26` (Identität über E-Mail). Ohne die Normalisierung hätte `GAST.XY@MUSTER.TEST` einen zweiten Kunden erzeugt.

```ts
it('erzeugt für zwei Zimmer eine Gruppe und zwei Buchungen (E20/E27)', async () => {
    const { data, error } = await book(fixture, { p_check_in: isoDay(50), p_check_out: isoDay(52), p_rooms: 2 });
    expect(error).toBeNull();
    const gruppe = data as BookingResult;
    expect(gruppe.booking_group_id).not.toBeNull();
    expect(gruppe.bookings).toHaveLength(2);
    // Zwei Buchungsnummern für zwei Zimmer — branchenüblich, und die Nummer
    // bleibt an der einzelnen Buchung (E23/E27).
    expect(gruppe.bookings[0]?.booking_reference).not.toBe(gruppe.bookings[1]?.booking_reference);
    expect(gruppe.total_amount_cents).toBe(40000);
});
```

### Test 6 aus `E34`: Der Vertrag hält

```ts
it('verdoppelt die Saisonpreise — und die Buchung bleibt unberührt', async () => {
    const vorher = await serviceClient.from('bookings').select('total_amount_cents').eq('id', bookingId).single();
    expect(vorher.data?.total_amount_cents).toBe(20000);

    const { error } = await serviceClient.from('room_type_rates').update({ amount_cents: 20000 }).eq('room_type_id', fixture.roomTypeId);
    expect(error).toBeNull();

    const nachher = await serviceClient.from('bookings').select('total_amount_cents').eq('id', bookingId).single();
    const nights = await serviceClient.from('booking_nights').select('amount_cents').eq('booking_id', bookingId);

    // DAS ist der Beweis, dass eine Buchung ein Vertrag ist (E5): Der Preis wird
    // festgeschrieben, nicht neu berechnet. Ohne booking_nights (E21) wäre diese
    // Eigenschaft nach der ersten Preisrunde nicht mehr nachweisbar.
    expect(nachher.data?.total_amount_cents).toBe(20000);
    expect((nights.data as { amount_cents: number }[]).map((row) => row.amount_cents)).toEqual([10000, 10000]);

    // Gegenprobe: Eine NEUE Buchung derselben Nächte kostet jetzt das Doppelte.
    const { data } = await book(fixture, { p_check_in: isoDay(25), p_check_out: isoDay(27) });
    expect((data as BookingResult).total_amount_cents).toBe(40000);
});
```

Ein einzelner Test mit zwei Aussagen – und beide sind nötig:

1. Die alte Buchung bleibt bei 20 000 ct. → Der Preis ist eingefroren.
2. Eine neue Buchung kostet 40 000 ct. → Die Preisänderung ist tatsächlich angekommen.

Ohne die Gegenprobe wäre der Test auch grün, wenn das `UPDATE` gar nicht gewirkt hätte. Das ist ein sehr häufiger Fehler in Tests: **Man prüft, dass sich nichts geändert hat, ohne zu prüfen, dass überhaupt etwas passiert ist.**

### Test 5 aus `E34`: Der Nebenläufigkeitstest, der nicht reichte

Und hier kommt die eigentliche Lektion dieses Commits. Zuerst der Test, den der Umsetzungsplan verlangte:

```ts
it('lässt GENAU EINE Buchung gewinnen', async () => {
    // Beide Aufrufe gehen gleichzeitig raus. Der hotelweite Advisory-Lock
    // serialisiert sie; der Zweite sieht dann rooms_free = 0.
    //
    // Ohne diesen Test ist E10 nur eine Behauptung: Ein fehlender Lock fällt im
    // Einzelbetrieb NIE auf — er fällt an dem Tag auf, an dem zwei Gäste
    // gleichzeitig klicken, und dann ist ein Zimmer doppelt verkauft.
    //
    // ACHTUNG, nachgemessen am 2026-09-02: Dieser Test allein REICHT NICHT. Mit
    // probeweise entferntem Advisory-Lock blieb er grün — zwei HTTP-Anfragen
    // überschneiden sich nicht zuverlässig genug, um die Lücke zu treffen. Der
    // Test, der die fehlende Serialisierung tatsächlich fängt, ist der folgende
    // mit sechs Anfragen. Diesen hier nicht als Absicherung missverstehen.
    const ergebnisse = await Promise.allSettled([
        book(fixture, { p_check_in: isoDay(35), p_check_out: isoDay(37), p_email: `a.…@muster.test` }),
        book(fixture, { p_check_in: isoDay(35), p_check_out: isoDay(37), p_email: `b.…@muster.test` }),
    ]);
    // …
    expect(erfolge).toHaveLength(1);
    expect(fehler).toHaveLength(1);

    // Und die Datenbank hat wirklich nur eine blockierende Buchung.
    const { data } = await serviceClient.from('bookings').select('id, status').eq('room_type_id', fixture.roomTypeId);
    expect(data).toHaveLength(1);
});
```

Der Kommentar in der Mitte ist das Wertvollste am ganzen Commit: **Der Test wurde gegengeprüft, indem der Lock probeweise entfernt wurde – und er blieb grün.**

Zwei HTTP-Anfragen, mit `Promise.allSettled` gleichzeitig gestartet, überschneiden sich in der Datenbank nicht zuverlässig. Netzwerk-Latenz, Verbindungsaufbau, PostgREST-Scheduling – irgendwo entsteht genug Verzögerung, dass die erste Anfrage fertig ist, bevor die zweite prüft. Der Test war also die ganze Zeit grün, ohne irgendetwas zu belegen.

Der Test, der es tatsächlich fängt:

```ts
it('haelt auch unter 6 gleichzeitigen Anfragen die Kapazitaet von 3 ein', async () => {
    // Der Zwei-Anfragen-Test allein wäre schwach: Er wäre auch grün, wenn die
    // beiden Aufrufe sich zeitlich gar nicht überschnitten hätten. Sechs
    // gleichzeitige Anfragen auf drei Zimmer erzeugen echte Konkurrenz — und
    // die einzig richtige Antwort ist "genau drei".
    //
    // Gegenprobe durchgeführt: Mit entferntem `pg_advisory_xact_lock` gehen ALLE
    // SECHS Buchungen durch. Dieser Test fängt die Lücke also wirklich, statt sie
    // nur zu behaupten.
    const gross = await createFixture({ roomCount: 3, maxOccupancy: 2, withRatePlan: true });
    await withRates(gross, 12000);

    const versuche = Array.from({ length: 6 }, (_, index) =>
        book(gross, {
            p_check_in: isoDay(45),
            p_check_out: isoDay(47),
            p_email: `wettlauf${String(index)}.${gross.roomTypeId.slice(0, 8)}@muster.test`,
        }),
    );
    const ergebnisse = await Promise.allSettled(versuche);
    const antworten = ergebnisse.map((r) => (r.status === 'fulfilled' ? r.value : { data: null, error: { message: 'rejected' } }));

    expect(antworten.filter((a) => a.error === null)).toHaveLength(3);
    expect(antworten.filter((a) => a.error !== null)).toHaveLength(3);

    // Die Datenbank selbst ist der Zeuge, nicht die Antwortzählung: Wäre der
    // Lock wirkungslos, stünden hier mehr als drei blockierende Buchungen.
    const { data } = await serviceClient.from('bookings').select('id').eq('room_type_id', gross.roomTypeId);
    expect(data).toHaveLength(3);
});
```

Sechs Anfragen auf drei Zimmer. Ohne Lock gingen **alle sechs** durch – doppelte Überbuchung. Mit Lock genau drei.

Warum funktioniert das besser? Bei sechs parallelen Anfragen ist die Wahrscheinlichkeit sehr hoch, dass sich mindestens zwei zeitlich überschneiden. Es ist derselbe Effekt, warum man Race Conditions mit Lasttests findet und nicht mit Einzelaufrufen.

Die Commit-Message hält es ausdrücklich fest:

```text
WICHTIG, nachgemessen: Der Zwei-Anfragen-Test aus dem Umsetzungsplan REICHT
NICHT. Mit probeweise entferntem Advisory-Lock blieb er gruen, weil zwei
HTTP-Anfragen sich nicht zuverlaessig ueberschneiden. Erst der Test mit sechs
Anfragen faengt die Luecke: ohne Lock gehen dort ALLE SECHS Buchungen durch.
Beides ist in den Tests dokumentiert, damit der schwache Test nicht als
Absicherung missverstanden wird.
```

Für Lernende sind hier drei Dinge zu lernen:

**1. Einen Test gegenprüfen, indem man ihn absichtlich brechen lässt.** Die Frage lautet nicht „ist der Test grün?", sondern „wird er rot, wenn die Eigenschaft fehlt?" Ein Test, der nie rot werden kann, prüft nichts. Diese Technik heißt oft _Mutation Testing_ – hier von Hand angewandt.

**2. Der schwache Test bleibt trotzdem stehen, mit Vermerk.** Er hätte gelöscht werden können. Stattdessen bleibt er mit einer Warnung, damit niemand später denkt, er sei die Absicherung. Ein irreführender Test ist schlimmer als kein Test, aber ein _als irreführend markierter_ Test ist eine Warnung an die nächste Person.

**3. Die Datenbank ist der Zeuge, nicht die Antwortzählung.** Beide Tests prüfen am Ende die Tabelle, nicht nur die HTTP-Antworten. Eine Antwortzählung könnte auch stimmen, wenn intern etwas anderes passiert wäre.

### Die Ablehnungen

Sieben Tests prüfen jeden Ablehnungsgrund einzeln:

```ts
it('Vergangenheit', async () => {
    const detail = await reject({ p_check_in: isoDay(-3), p_check_out: isoDay(-1) });
    expect(detail.code).toBe('vergangenheit');
    expect(detail.datum).toBe(isoDay(-3));
});

it('Belegung zu groß für die Kategorie — maskiert', async () => {
    const detail = await reject({ p_check_in: isoDay(31), p_check_out: isoDay(33), p_adults: 4 });
    expect(detail.code).toBe('nicht_buchbar');
    expect(detail.datum).toBe(isoDay(31));
});

it('Nacht ohne Preiszeile — maskiert, und niemals gratis (E25)', async () => {
    const detail = await reject({ p_check_in: isoDay(80), p_check_out: isoDay(82) });
    expect(detail.code).toBe('nicht_buchbar');
    expect(detail.datum).toBe(isoDay(80));
});
```

Beachte den Unterschied: `vergangenheit` kommt unmaskiert durch, `zu_klein` und `kein_preis` werden zu `nicht_buchbar`. Das ist `mask_reason` aus Phase 5, hier über den Umweg von `reject_booking` – und die Tests belegen, dass die Zweistufigkeit auch auf diesem Weg wirkt.

Und in jedem Fall ist das **Datum** dabei. Genau das ist `E31`.

## Was wurde erreicht?

Die Phase 6 ist abgeschlossen, **85 Tests grün**, auch im zweiten Lauf ohne Reset.

Damit existiert der vollständige Buchungsweg:

- **Eine** Funktion, die eine Buchung anlegt. Gäste dürfen sie aufrufen, aber nicht in `bookings` schreiben.
- Preis, Kunde, Buchungsnummer und Status kommen von der Datenbank, nicht vom Client.
- Hotelweiter Advisory-Lock: Zwei gleichzeitige Anfragen können nicht dasselbe Zimmer verkaufen.
- Prüfung Nacht für Nacht aus derselben Quelle, die Kalender und Ergebnisliste füttert.
- Preis pro Nacht eingefroren – eine Buchung ist ein Vertrag.
- Kunde, Buchung, Nächte und Historie in **einer** Transaktion.
- Strukturierte Ablehnung mit Code und Datum, maskiert nach `E28`.

Die drei übertragbaren Ideen:

1. **Die Signatur einer Funktion ist eine Sicherheitsentscheidung.** Was als Parameter hereinkommt, kann der Client bestimmen. Der Preis gehört nicht dazu.
2. **Fehler brauchen zwei Formen:** eine für Menschen, eine für Programme. Wer aus einem Fehlertext Bedeutung herausparsen muss, hat eine schlechte Schnittstelle vor sich.
3. **Tests müssen gegengeprüft werden.** Die Frage ist nie „ist er grün?", sondern „wird er rot, wenn die Eigenschaft fehlt?"

Was noch fehlt: eine Abnahme. RLS ist seit Phase 2 aktiv, und bei jeder neuen Tabelle wurde brav eine Policy angelegt. Aber niemand hat das bisher **überprüft** – und eine fehlende Policy erzeugt keine Fehlermeldung. Das ist die Aufgabe der letzten Phase.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](009_2026-09-02_phase-7-rls-abnahme.md)
