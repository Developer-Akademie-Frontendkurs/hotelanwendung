[← Vorheriger Commit](031_2026-10-21_posts-spike-migration.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# refactor(types): generated database types and posts service (F1, F2)

- **Commit:** `17a26ff`
- **Datum:** 2026-10-21
- **Autor:** Oliver Jung

## Worum geht es?

Zwei Punkte, die seit dem Umsetzungsplan in Commit 001 offen waren, werden hier geschlossen:

| Punkt  | Plan             | Aufgabe                                                                                  |
| ------ | ---------------- | ---------------------------------------------------------------------------------------- |
| **F1** | Phase 8 / `V8`   | `pnpm db:types` ausführen, Client auf `createClient<Database>` umstellen, Typen ableiten |
| **F2** | Phase 8.4 / `V9` | Kein `supabase`-Import mehr außerhalb von `services/` – auch nicht in den Posts-Views    |

```text
 .prettierignore                                    |    2 +
 CLAUDE.md                                          |    2 +-
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |    4 +-
 eslint.config.ts                                   |    3 +-
 src/shared/services/booking.service.spec.ts        |   22 +-
 src/shared/services/booking.service.ts             |   15 +-
 src/shared/services/posts.service.ts               |   25 +
 src/shared/services/supabase.ts                    |    5 +-
 src/shared/types/booking.types.ts                  |   18 +-
 src/shared/types/catalog.types.ts                  |   53 +-
 src/shared/types/database.types.ts                 | 1025 ++++++++++++++++++++
 src/views/PostsView/Posts.ts                       |   16 +-
 src/views/PostsView/SinglePostView/SinglePost.ts   |   15 +-
 src/views/PostsView/post.interface.ts              |    5 -
 14 files changed, 1132 insertions(+), 78 deletions(-)
```

Das Interessanteste steht im Commit-Body: **Der typisierte Client hat echte Fehler gefunden.** Genau dafür generiert man Typen.

## Die Änderungen im Detail

### 1. Generierte Typen: `database.types.ts`

Das Skript in `package.json` erzeugt die Typen aus der laufenden lokalen Datenbank:

```json
"db:types": "supabase gen types typescript --local > src/shared/types/database.types.ts"
```

Heraus kommt eine über 1000 Zeilen lange Datei, die jede Tabelle, jede View und jede Funktion als TypeScript-Typ beschreibt. Ein Ausschnitt – die Parameter von `create_booking`:

```ts
create_booking: {
  Args: {
    p_adults: number
    p_billing_city?: string
    p_billing_company?: string
    // …
    p_phone?: string
    p_positions: Json
    p_services?: Json
    // …
  }
  Returns: Json
}
```

**Generierter Code wird nicht von Hand geändert** – und auch nicht formatiert oder gelintet, denn beim nächsten `pnpm db:types` wäre jede Änderung wieder weg. Deshalb wird die Datei von beiden Werkzeugen ausgenommen:

```diff
# .prettierignore (neu)
+# Erzeugt von `pnpm db:types` – jede Formatierung wäre beim nächsten Lauf wieder weg.
+src/shared/types/database.types.ts
```

```diff
 export default defineConfig([
-    { ignores: ['dist/**', 'node_modules/**', 'pnpm-lock.yaml'] },
+    // `database.types.ts` erzeugt `pnpm db:types` – generierter Code wird nicht gelintet.
+    { ignores: ['dist/**', 'node_modules/**', 'pnpm-lock.yaml', 'src/shared/types/database.types.ts'] },
```

### 2. Der Client wird typisiert

Datei: `src/shared/services/supabase.ts`

```diff
 import { createClient } from '@supabase/supabase-js';
+import type { Database } from '../types/database.types';
 …
-export const supabase = createClient(supabaseUrl, supabasePublishableKey);
+// Typisiert mit den generierten Typen (V8): Benennt eine Migration eine Spalte um, wird
+// das nach `pnpm db:types` hier zum Typfehler statt im Browser zu `undefined`.
+export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey);
```

Ab jetzt weiß TypeScript bei `supabase.from('hotels').select('name, city')`, welche Spalten es gibt und welchen Typ das Ergebnis hat. Ein Tippfehler im Spaltennamen ist ein Compilerfehler. Laut Review-Dokument wurde das auch gegengeprüft: Eine simulierte Spaltenumbenennung wurde tatsächlich zum Typfehler.

### 3. Handgeschriebene Zeilentypen werden abgeleitet

Bisher standen die Zeilentypen von Hand in `catalog.types.ts` und `booking.types.ts` – eine **zweite Wahrheit** neben dem Schema. Jetzt werden sie mit `Pick<Tables<'…'>, …>` aus den generierten Typen geschnitten:

```diff
-export interface HotelRow {
-    name: string;
-    address_line1: string | null;
-    postal_code: string | null;
-    city: string | null;
-    country_code: string | null;
-    /** `time` kommt über PostgREST als `"14:00:00"`. */
-    check_in_time: string;
-    check_out_time: string;
-}
+export type HotelRow = Pick<Tables<'hotels'>, 'name' | 'address_line1' | 'postal_code' | 'city' | 'country_code' | 'check_in_time' | 'check_out_time'>;
```

Genauso werden `RoomTypeImage`, `RoomTypeDetail`, `ServiceRow` und `Post` abgeleitet. `Tables<'hotels'>` ist ein Hilfstyp aus der generierten Datei und liefert den Typ einer Zeile; `Pick` wählt die Spalten aus, die die Abfrage tatsächlich lädt.

**Eine bewusste Ausnahme:** `RoomAvailability` (die Rückgabe von `search_availability`) bleibt handgeschrieben – und der Kommentar erklärt, warum:

```ts
/**
 * Eine Zeile aus der Datenbankfunktion `search_availability`.
 *
 * Bewusst NICHT aus `Database['public']['Functions']` abgeleitet: Für Rückgaben von
 * Funktionen erzeugt der Generator jede Spalte als nicht-nullbar – `rooms_free` und
 * `total_amount_cents` sind aber gerade dann NULL, wenn eine Kategorie nicht buchbar ist
 * (E37). Abgeleitet würde der Typ diese Prüfung abschaffen.
 */
```

Für Lernende ist das eine wichtige Einsicht: **Generierte Typen sind nur so gut wie die Information, die der Generator hat.** Wo er nachweislich zu optimistisch ist, wäre Ableiten gefährlicher als Handschreiben.

### 4. Was der typisierte Client gefunden hat

Zwei Stellen in `booking.service.ts` kompilierten nach der Umstellung nicht mehr.

**a) `p_services` als `readonly`-Array.** Der Typ `Json` erlaubt nur veränderbare Arrays, `request.services` ist aber `readonly`. Die Lösung baut eine frische Liste:

```diff
-        p_services: request.services,
+        // Neue Objekte statt der `readonly`-Liste: `Json` verlangt ein veränderbares Array.
+        p_services: request.services.map(({ code, quantity }: BookingServiceSelection): BookingServiceSelection => ({ code, quantity })),
```

**b) `null` für Parameter mit Default.** Im Schema haben `p_phone` und `p_billing_company` einen Default (`NULL`). Der Generator beschreibt sie als `p_phone?: string` – **optional, aber nicht `null`**. Der Service schickte bisher `null`. Die Lösung: den Parameter weglassen, dann greift der Default.

```diff
-        p_phone: request.customer.phone,
+        // Ohne Telefon bleibt der Parameter weg – sein Default in `create_booking` ist NULL.
+        ...(request.customer.phone === null ? {} : { p_phone: request.customer.phone }),
```

Das Muster `...(bedingung ? {} : { schluessel: wert })` ist ein gängiger Weg, eine Eigenschaft nur unter einer Bedingung in ein Objekt aufzunehmen. Weil das Projekt `exactOptionalPropertyTypes` aktiviert hat, ist „Eigenschaft fehlt" und „Eigenschaft ist `undefined`" ein Unterschied – daher kein `p_phone: undefined`.

Die Tests aus Commit 030 werden entsprechend angepasst – und um zwei neue Fälle ergänzt:

```diff
-    it('schickt mit Rechnungsadresse alle sechs Felder – auch eine leere Firma als null', async () => {
+    it('schickt mit Rechnungsadresse alle Felder – eine leere Firma bleibt weg, ihr Default ist NULL', async () => {
         …
+        expect(params).not.toHaveProperty('p_billing_company');
         expect(params).toMatchObject({
-            p_billing_company: null,
```

```ts
it('lässt ein fehlendes Telefon weg und schickt ein vorhandenes mit', async () => {
    rpc.mockResolvedValue(createdResponse({}));
    await createBooking(request);
    await createBooking({ ...request, customer: { ...request.customer, phone: '+43 660 1' } });

    const calls = rpc.mock.calls as [string, Record<string, unknown>][];
    expect(calls[0]?.[1]).not.toHaveProperty('p_phone');
    expect(calls[1]?.[1]).toMatchObject({ p_phone: '+43 660 1' });
});
```

### 5. F2 – `posts.service.ts`

Die Posts-Views waren die letzten Stellen, die `supabase` direkt importierten. Sie bekommen einen eigenen Service nach dem Muster von `catalog.service.ts`: Jede Funktion wirft bei einem Fehler, die View entscheidet über die Anzeige.

```ts
import { supabase } from './supabase';
import type { Tables } from '../types/database.types';

export type Post = Pick<Tables<'posts'>, 'id' | 'title' | 'description'>;

/** Alle Beiträge, die neuesten zuerst. */
export async function fetchPosts(): Promise<Post[]> {
    const { data, error } = await supabase.from('posts').select('id, title, description').order('created_at', { ascending: false });
    if (error) throw new Error(`posts konnte nicht geladen werden: ${error.message}`);
    return data;
}

/** Ein Beitrag – `null`, wenn es ihn nicht gibt. */
export async function fetchPost(id: string): Promise<Post | null> {
    const { data, error } = await supabase.from('posts').select('id, title, description').eq('id', id).maybeSingle();
    if (error) throw new Error(`Beitrag ${id} konnte nicht geladen werden: ${error.message}`);
    return data;
}
```

Beachte `return data;` **ohne** Typumwandlung: Weil der Client typisiert ist, leitet postgrest-js den Typ direkt aus dem `select`-String ab. Vorher stand in `SinglePost.ts` noch ein `as { data: Post; error: Error | null }` – eine Behauptung, die niemand geprüft hat.

Außerdem `maybeSingle()` statt `single()`: Gibt es den Beitrag nicht, liefert `single()` einen Fehler, `maybeSingle()` dagegen `null`. „Nicht gefunden" ist kein technischer Fehler, sondern ein normaler Fall.

Die View wird entsprechend schlanker:

```diff
-import { Post } from './post.interface';
-import { supabase } from '../../shared/services/supabase';
+import { fetchPosts, type Post } from '../../shared/services/posts.service';
 …
-    async fetchPosts(): Promise<void> {
-        const { data, error } = await supabase.from('posts').select();
-
-        if (error) {
+    async loadPosts(): Promise<void> {
+        try {
+            this.posts = await fetchPosts();
+        } catch (error: unknown) {
             console.error('Error fetching posts: ', error);
-            return;
-        } else {
-            this.posts = data as Post[];
         }
     }
```

Die Methode in der View heißt jetzt `loadPosts`, damit sie nicht mit der Service-Funktion `fetchPosts` verwechselt wird. `post.interface.ts` wird gelöscht.

Das Prüfkriterium aus dem Umsetzungsplan (Commit 001) ist damit erfüllt – laut Review-Dokument findet dieser Befehl nichts mehr:

```bash
grep -rn "from.*services/supabase" src/ --include=*.ts | grep -v src/shared/services/
```

## Was wurde erreicht?

Phase 8 des Umsetzungsplans ist abgeschlossen: Der Supabase-Client ist typisiert, die tabellennahen Typen folgen dem Schema automatisch, und außerhalb von `services/` spricht kein Code mehr direkt mit der Datenbank. `CLAUDE.md` beschreibt diesen Stand und hält die Regel fest, Parameter mit Default wegzulassen statt `null` zu schicken.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](033_2026-10-21_calendar-availability-horizon-night-rules.md)
