[← Vorheriger Commit](001_2026-11-25_update-supabase-dependency.md) · [↑ Branch-Übersicht](../014_2026-11-25_room-slider.md) · [📓 Index](../000_index.md)

# feat: zimmerslider auf der startseite aus der datenbank

- **Commit:** `9d40768`
- **Datum:** 2026-11-25
- **Autor:** Oliver Jung (Co-Author: Claude)

## Worum geht es?

Der Abschnitt „Zimmer mit Weitblick" auf der Startseite wird von einer statischen Attrappe zu einem **echten Slider**, der seine Zimmer aus Supabase lädt. Der Commit zieht sich durch alle Schichten des Projekts – von der Datenbank-Migration über Service, Typen und Templates bis zur Buchungsseite:

```text
 src/assets/img/einzel-alpin.jpg                    |  Bin 0 -> 147056 bytes
 src/shared/services/catalog.service.spec.ts        |   79 +-
 src/shared/services/catalog.service.ts             |   65 +-
 src/shared/types/catalog.codes.spec.ts             |   14 +
 src/shared/types/catalog.codes.ts                  |   12 +
 src/shared/types/catalog.types.ts                  |   31 +
 src/shared/types/database.types.ts                 | 1440 +++++++-------------
 src/shared/ui/roomFeatureIcons.ts                  |   55 +
 src/views/BookingView/Booking.ts                   |   17 +-
 src/views/BookingView/domain/preselection.spec.ts  |   55 +
 src/views/BookingView/domain/preselection.ts       |   40 +
 src/views/BookingView/templates/icons.ts           |   36 -
 src/views/HomeView/Home.ts                         |  174 ++-
 src/views/HomeView/roomSlider.ts                   |   11 +
 .../HomeView/templates/roomSlider.template.ts      |   99 ++
 src/views/HomeView/tests/roomSlider.spec.ts        |   31 +
 .../20261125101000_room_type_features.sql          |   27 +
 supabase/scripts/seed-storage.mjs                  |    1 +
 supabase/seed.sql                                  |   22 +
 supabase/tests/rls-stammdaten.spec.ts              |   11 +
 20 files changed, 1173 insertions(+), 1047 deletions(-)
```

Die Commit-Message fasst die Teile zusammen:

- neue Tabelle `room_type_features` (RLS: öffentlich lesen, schreiben nur Personal) samt Seed
- `fetchRoomShowcase`/`buildRoomSlides` in `catalog.service`: Bild, günstigster kommender Standardpreis („ab X€ / Nacht"), Merkmale per Embed in **einer** Abfrage
- Merkmal-Codes als Union-Typ mit `isRoomFeatureCode`, Icons in `shared/ui/roomFeatureIcons`
- Slider mit Umlauf, Lade-, Fehler- und Leerzustand, `aria-live`, ohne Höhensprung
- „Buchen" verlinkt `/buchung?zimmer=<slug>`, die Buchungsseite wählt das Zimmer vor
- Bild für das Einzelzimmer Alpin

Wir gehen die Schichten von unten nach oben durch – so, wie die Daten fließen:

```text
Datenbank            room_types ─┬─ room_type_images
                                 ├─ room_type_features   (neu)
                                 └─ room_type_rates ── rate_plans
                                         │
Service              fetchRoomShowcase(today)  → RoomShowcaseRow[]
                     buildRoomSlides(rows, today) → RoomSlide[]
                                         │
View (Home.ts)       loadRooms() → slides, currentIndex
                                         │
Template             getRoomSlideHtml(view) → HTML-String
```

## Die Änderungen im Detail

### 1. Neue Tabelle `room_type_features`

Datei: `supabase/migrations/20261125101000_room_type_features.sql` (neu)

Bisher gab es in der Datenbank keinen Ort für Ausstattungsmerkmale wie „King-size Bett" oder „Gym Zugang". Die neue Tabelle hängt – wie die Bilder – an der Zimmerkategorie:

```sql
create table public.room_type_features (
    id uuid primary key default gen_random_uuid(),
    -- Cascade like room_type_images: features belong to the room type, they are no contract.
    room_type_id uuid not null references public.room_types on delete cascade,
    code text not null,
    label text not null check (char_length(label) > 0),
    sort_order int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (room_type_id, code)
);

create index room_type_features_order_idx on public.room_type_features (room_type_id, sort_order, id);

create trigger room_type_features_set_updated_at before update on public.room_type_features
for each row execute function public.set_updated_at();
```

Ein paar Entscheidungen darin, die sich zu verstehen lohnen:

- **Zwei Spalten für ein Merkmal: `code` und `label`.** `code` (z. B. `BED`) ist für das Programm und wählt das Icon, `label` (z. B. „King-size Bett") ist der Text für Menschen. So kann das Hotel den Text ändern, ohne dass das Icon verloren geht.
- **`on delete cascade`:** Wird eine Kategorie gelöscht, verschwinden ihre Merkmale mit. Das ist hier richtig, weil an Merkmalen nichts hängt – anders als an Buchungen, die man nie stillschweigend mitlöschen darf.
- **`unique (room_type_id, code)`:** Jedes Merkmal gibt es pro Kategorie nur einmal.
- **Index auf `(room_type_id, sort_order, id)`:** passt genau zur Abfrage „alle Merkmale einer Kategorie, sortiert".
- **`set_updated_at()`** ist der Trigger, den alle Tabellen des Schemas benutzen – `updated_at` muss so niemand von Hand pflegen.

Dazu kommt Row Level Security:

```sql
alter table public.room_type_features enable row level security;

create policy room_type_features_select_all on public.room_type_features
for select using (true);

create policy room_type_features_write_staff on public.room_type_features
for all using (public.is_staff()) with check (public.is_staff());
```

**Lesen darf jeder** (`using (true)`), denn die Startseite ist öffentlich. **Schreiben nur Personal** über die zentrale Funktion `is_staff()`. Ohne diese zweite Policy dürfte niemand schreiben – RLS ist „deny by default".

### 2. Seed-Daten und Datenbanktest

Datei: `supabase/seed.sql`

```sql
-- Amenities for the homepage slider; the order fills the two-column grid row by row.
insert into public.room_type_features (room_type_id, code, label, sort_order)
values
    ('00000000-0000-4000-8000-000000000101', 'BED', 'King-size Bett', 10),
    ('00000000-0000-4000-8000-000000000101', 'AIR_CONDITIONING', 'Klimaanlage & TV', 20),
    ('00000000-0000-4000-8000-000000000101', 'BATHROOM', 'Badewanne, Föhn & eigenes WC', 30),
    ('00000000-0000-4000-8000-000000000101', 'GYM', 'Gym Zugang', 40),
    -- … je vier Zeilen für die Kategorien …102 und …103
    ('00000000-0000-4000-8000-000000000103', 'GYM', 'Gym Zugang', 40);
```

Die `sort_order`-Werte springen in Zehnerschritten. So lässt sich später ein Merkmal dazwischenschieben (`15`), ohne alle anderen umzunummerieren.

Außerdem bekommt die dritte Kategorie („Einzelzimmer Alpin") ein Bild – sowohl als Zeile in `room_type_images` als auch als Datei, die das Skript `supabase/scripts/seed-storage.mjs` in den Storage-Bucket hochlädt:

```diff
 const IMAGES = [
     { file: 'src/assets/img/double-suite.jpg', storagePath: 'double-suite.jpg' },
     { file: 'src/assets/img/double-premium.jpg', storagePath: 'double-premium.jpg' },
+    { file: 'src/assets/img/einzel-alpin.jpg', storagePath: 'einzel-alpin.jpg' },
 ];
```

Ob die RLS-Regeln stimmen, prüft ein neuer Fall in `supabase/tests/rls-stammdaten.spec.ts`:

```ts
it('Gast darf room_type_features lesen, aber nicht schreiben', async () => {
    await serviceClient.from('room_type_features').insert({ room_type_id: fixture.roomTypeId, code: 'GYM', label: 'Gym Zugang' });

    const { data, error } = await anonClient.from('room_type_features').select('code').eq('room_type_id', fixture.roomTypeId);
    expect(error).toBeNull();
    expect(data).toEqual([{ code: 'GYM' }]);

    const insert = await anonClient.from('room_type_features').insert({ room_type_id: fixture.roomTypeId, code: 'BED', label: 'Bett' });
    expect(insert.error?.code).toBe('42501');
});
```

Der `serviceClient` (Service-Role-Key, umgeht RLS) legt die Testdaten an, der `anonClient` (wie ein Besucher der Website) versucht zu lesen und zu schreiben. `42501` ist der PostgreSQL-Fehlercode für „insufficient privilege".

### 3. Generierte Typen

Datei: `src/shared/types/database.types.ts` (generiert mit `pnpm db:types`)

Nach der Migration werden die TypeScript-Typen neu erzeugt. Inhaltlich kommt die Tabelle `room_type_features` dazu:

```ts
"room_type_features": {
    Row: {
        "code": string,"created_at": string,"id": string,"label": string,"room_type_id": string,"sort_order": number,"updated_at": string
    }
    // Insert, Update, Relationships …
}
```

Dass die Statistik über 1 400 Zeilen zeigt, liegt an der neuen CLI-Version aus [Commit 001](001_2026-11-25_update-supabase-dependency.md): Sie schreibt die Datei in einem anderen, kompakteren Format. Die Datei wird nie von Hand bearbeitet und ist von ESLint und Prettier ausgenommen.

### 4. Typen für den Slider

Datei: `src/shared/types/catalog.types.ts`

Die Typen werden **aus den generierten Tabellentypen abgeleitet**, statt sie abzuschreiben. `Pick<Tables<'…'>, …>` nimmt genau die Spalten, die abgefragt werden:

```ts
export type RoomFeatureRow = Pick<Tables<'room_type_features'>, 'code' | 'label' | 'sort_order'>;

export type RoomRateRow = Pick<Tables<'room_type_rates'>, 'amount_cents' | 'currency' | 'valid_to'> & {
    rate_plans: Pick<Tables<'rate_plans'>, 'is_default'>;
};

/** One room type for the homepage slider, with images, features and rates embedded. */
export type RoomShowcaseRow = Pick<Tables<'room_types'>, 'id' | 'name' | 'slug' | 'description'> & {
    room_type_images: RoomTypeImage[];
    room_type_features: RoomFeatureRow[];
    room_type_rates: RoomRateRow[];
};
```

`RoomShowcaseRow` beschreibt die **Rohdaten** aus der Datenbank (mit snake_case-Namen und verschachtelten Listen). Was die View braucht, ist dagegen schon fertig aufbereitet:

```ts
export interface RoomSlideFeature {
    /** `null` for a code the frontend does not know – rendered with the fallback icon. */
    code: RoomFeatureCode | null;
    label: string;
}

export interface RoomSlide {
    slug: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    imageAlt: string;
    /** Cheapest upcoming nightly room price of the default rate plan, formatted – `null` without one. */
    priceLabel: string | null;
    features: RoomSlideFeature[];
}
```

Zwei Typen für „dasselbe" Zimmer – das ist Absicht: Die View soll nicht wissen müssen, wie die Datenbank ihre Spalten nennt.

### 5. Merkmal-Codes als Union-Typ

Datei: `src/shared/types/catalog.codes.ts` (neu)

Die Datenbank liefert `code` als beliebigen `string`. Das Frontend kennt aber nur vier Codes, für die es Icons hat. Das Muster dafür kennt das Projekt schon von den Ablehnungs-Codes der Buchung (`booking.codes.ts`):

```ts
export const ROOM_FEATURE_CODES = ['BED', 'BATHROOM', 'AIR_CONDITIONING', 'GYM'] as const;

export type RoomFeatureCode = (typeof ROOM_FEATURE_CODES)[number];

export function isRoomFeatureCode(value: string): value is RoomFeatureCode {
    return (ROOM_FEATURE_CODES as readonly string[]).includes(value);
}
```

Drei Bausteine:

1. **`as const`** macht aus dem Array ein unveränderliches Tupel mit den exakten Werten statt `string[]`.
2. **`(typeof ROOM_FEATURE_CODES)[number]`** erzeugt daraus den Typ `'BED' | 'BATHROOM' | 'AIR_CONDITIONING' | 'GYM'`. Liste und Typ können so nie auseinanderlaufen.
3. **`value is RoomFeatureCode`** ist ein _Type Guard_: Gibt die Funktion `true` zurück, weiß TypeScript danach, dass `value` einer der vier Codes ist.

Die Prüfung passiert **an der Grenze** – dort, wo Daten von außen ins Programm kommen (in `buildRoomSlides`). Danach rechnet der Code nur noch mit dem sicheren Typ. Ein Test (`catalog.codes.spec.ts`) stellt sicher, dass auch Kleinschreibung (`'bed'`) und der leere String abgelehnt werden.

### 6. Icons wandern nach `shared/ui`

Dateien: `src/shared/ui/roomFeatureIcons.ts` (neu), `src/views/BookingView/templates/icons.ts`

Die vier SVG-Icons für Bett, Bad, Klimaanlage und Gym lagen bisher in den Templates der Buchungsseite. Jetzt braucht sie auch die Startseite. Sie ziehen deshalb in einen gemeinsamen Ordner um – in `icons.ts` werden 36 Zeilen gelöscht, `Booking.ts` importiert von der neuen Stelle:

```diff
-import { ADULT_ICON, CHILD_ICON, ICON_AIR_CONDITIONING, ICON_BATH, ICON_BED, ICON_GYM, SERVICE_ICONS } from './templates/icons';
+import { ADULT_ICON, CHILD_ICON, SERVICE_ICONS } from './templates/icons';
+import { ICON_AIR_CONDITIONING, ICON_BATH, ICON_BED, ICON_GYM } from '../../shared/ui/roomFeatureIcons';
```

Neu ist die Zuordnung Code → Icon:

```ts
export const ROOM_FEATURE_ICONS: Readonly<Record<RoomFeatureCode, string>> = {
    BED: ICON_BED,
    BATHROOM: ICON_BATH,
    AIR_CONDITIONING: ICON_AIR_CONDITIONING,
    GYM: ICON_GYM,
};

export function getRoomFeatureIconHtml(code: RoomFeatureCode | null): string {
    return code === null ? ICON_FEATURE_FALLBACK : ROOM_FEATURE_ICONS[code];
}
```

`Record<RoomFeatureCode, string>` verlangt **für jeden** Code einen Eintrag. Kommt in `catalog.codes.ts` ein fünfter Code dazu, meldet der Compiler hier sofort den fehlenden Eintrag – ein Fehler, der sonst erst im Browser als leere Stelle auffiele. Unbekannte Codes aus der Datenbank (`null`) bekommen `ICON_FEATURE_FALLBACK`, einen neutralen Kreis.

### 7. Der Service: eine Abfrage für alles

Datei: `src/shared/services/catalog.service.ts`

```ts
export async function fetchRoomShowcase(today: string): Promise<RoomShowcaseRow[]> {
    const { data, error } = await supabase
        .from('room_types')
        .select(
            'id, name, slug, description, room_type_images(storage_path, alt_text, sort_order), room_type_features(code, label, sort_order), room_type_rates(amount_cents, currency, valid_to, rate_plans!inner(is_default))',
        )
        .is('archived_at', null)
        .gt('room_type_rates.valid_to', today)
        .eq('room_type_rates.rate_plans.is_default', true)
        .is('room_type_rates.rate_plans.archived_at', null)
        .order('name');
    if (error) throw new Error(error.message);
    return data;
}
```

Hier steckt viel PostgREST-Wissen drin:

- **Embedding:** `room_type_images(…)` im `select` holt die Bilder jeder Kategorie gleich mit – als verschachtelte Liste. PostgREST erkennt die Beziehung über den Fremdschlüssel. Statt vier Anfragen (Kategorien, Bilder, Merkmale, Preise) gibt es **eine**.
- **Filter auf eingebettete Tabellen:** `.gt('room_type_rates.valid_to', today)` filtert nicht die Kategorien, sondern nur die **mitgelieferten Preiszeilen**. Eine Kategorie ohne gültigen Preis kommt trotzdem, nur mit leerer `room_type_rates`-Liste.
- **`!inner`:** `rate_plans!inner(is_default)` verwandelt das Embedding in einen Inner Join. Preiszeilen, deren Tarif den Filter `is_default = true` nicht besteht, fallen ganz heraus, statt mit `rate_plans: null` zu erscheinen.
- **`.is('archived_at', null)`:** archivierte Kategorien bleiben verborgen.
- **Fehler werfen:** Wie alle Lesezugriffe in `catalog.service.ts` wirft die Funktion bei einem Fehler. Die View entscheidet, was angezeigt wird.

Die Umwandlung in `RoomSlide` ist eine **reine Funktion** – ohne Netzwerk, gut testbar:

```ts
export function buildRoomSlides(rows: readonly RoomShowcaseRow[], today: string): RoomSlide[] {
    return rows.map((row: RoomShowcaseRow): RoomSlide => {
        const image = pickImage(row.room_type_images);
        const rate = pickLowestRate(row.room_type_rates, today);

        return {
            slug: row.slug,
            name: row.name,
            description: row.description,
            imageUrl: image === null ? null : getRoomImageUrl(image.storage_path),
            imageAlt: image === null || image.alt_text.trim() === '' ? row.name : image.alt_text,
            priceLabel: rate === null ? null : formatPrice(rate.amount_cents, rate.currency),
            features: [...row.room_type_features]
                .sort((a: RoomFeatureRow, b: RoomFeatureRow): number => a.sort_order - b.sort_order)
                .map((feature: RoomFeatureRow): RoomSlideFeature => ({ code: isRoomFeatureCode(feature.code) ? feature.code : null, label: feature.label })),
        };
    });
}

function pickLowestRate(rates: readonly RoomRateRow[], today: string): RoomRateRow | null {
    // ISO dates compare correctly as strings.
    const upcoming = rates.filter((rate: RoomRateRow): boolean => rate.rate_plans.is_default && rate.valid_to > today);
    return upcoming.reduce<RoomRateRow | null>(
        (lowest: RoomRateRow | null, rate: RoomRateRow): RoomRateRow => (lowest === null || rate.amount_cents < lowest.amount_cents ? rate : lowest),
        null,
    );
}
```

Bemerkenswert:

- **`pickImage`** gab es schon für die Zimmerkarten der Buchungsseite – es wird wiederverwendet.
- **Fehlender alt-Text** fällt auf den Zimmernamen zurück. Ein Bild ohne Beschreibung wäre für Screenreader nutzlos.
- **`[...row.room_type_features].sort(…)`:** `sort()` verändert das Array an Ort und Stelle. Die Kopie mit dem Spread-Operator schützt die Eingabedaten (`readonly`).
- **Der Preisfilter wird wiederholt**, obwohl ihn die Abfrage schon anwendet. Der Kommentar über der Funktion begründet das: Die Umwandlung soll für sich allein korrekt sein – und genau das prüfen die Tests, ohne Datenbank.
- **Datumsvergleich als String:** `'2026-12-01' > '2026-11-25'` ist korrekt, weil ISO-Daten (`YYYY-MM-DD`) von links nach rechts von groß nach klein aufgebaut sind.
- **`reduce`** mit Startwert `null` findet den kleinsten Preis in einem Durchlauf.

Die neuen Tests in `catalog.service.spec.ts` decken die Fälle ab, zum Beispiel:

```ts
it('zeigt den günstigsten noch gültigen Preis des Standardtarifs', () => {
    const rates = [rate(30000, '2027-01-01'), rate(24000, '2026-12-01'), rate(10000, TODAY), rate(9000, '2027-02-01', false)];
    const [slide] = buildRoomSlides([showcase({ room_type_rates: rates })], TODAY);
    expect(slide?.priceLabel).toBe('240€');
});
```

Die beiden günstigeren Preise fallen heraus: 100 € endet heute (`valid_to` ist nicht mehr „nach heute"), 90 € gehört nicht zum Standardtarif. Übrig bleibt 240 €. Weitere Fälle prüfen die Bildauswahl nach `sort_order`, den alt-Text-Rückfall, Zimmer ohne Bild oder Preis und dass ein unbekannter Code (`'SAUNA'`) zu `code: null` wird.

### 8. Die reine Blätterlogik

Datei: `src/views/HomeView/roomSlider.ts` (neu)

```ts
export type SlideStep = -1 | 1;

/** Moves `index` by `step` and wraps around at both ends. */
export function getWrappedIndex(index: number, step: SlideStep, count: number): number {
    if (count <= 0) return 0;
    return (((index + step) % count) + count) % count;
}

export function isSlideStep(value: number): value is SlideStep {
    return value === -1 || value === 1;
}
```

Warum die doppelte Modulo-Rechnung? In JavaScript ist `-1 % 3` gleich **`-1`**, nicht `2`. Der Trick `((x % n) + n) % n` macht daraus immer eine Zahl zwischen `0` und `n - 1`:

| Aufruf                      | `index + step` | `% 3` | `+ 3` | `% 3` |
| --------------------------- | -------------- | ----- | ----- | ----- |
| `getWrappedIndex(2, 1, 3)`  | 3              | 0     | 3     | **0** |
| `getWrappedIndex(0, -1, 3)` | -1             | -1    | 2     | **2** |

So springt der Slider vom letzten Zimmer wieder auf das erste und umgekehrt. Die Tests in `HomeView/tests/roomSlider.spec.ts` beschreiben genau diese Fälle.

### 9. Das Template

Datei: `src/views/HomeView/templates/roomSlider.template.ts` (neu)

Wie bei der Buchungsseite ist das Template eine reine Funktion: Daten rein, HTML raus. Ihr Eingabetyp enthält schon fertige Texte:

```ts
export type RoomSlideView = {
    name: string;
    description: string;
    imageUrl: string | null;
    imageAlt: string;
    priceText: string | null;
    features: readonly RoomSlideFeatureView[];
    roomHref: string;
};
```

Ein Ausschnitt aus `getRoomSlideHtml()`:

```ts
<div class="${IMAGE_BOX_CLASSES}">
    ${
        slide.imageUrl === null
            ? /*html*/ `<div role="img" aria-label="${escapeHtml(slide.imageAlt)}" class="…">Kein Bild vorhanden</div>`
            : /*html*/ `<img src="${escapeHtml(slide.imageUrl)}" alt="${escapeHtml(slide.imageAlt)}" class="w-full h-full object-cover">`
    }
</div>
…
<h3 class="line-clamp-1 font-playfair-display text-20 992:text-36 …">${escapeHtml(slide.name)}</h3>
<p class="${DESCRIPTION_CLASSES}">${escapeHtml(slide.description)}</p>
```

- **Jeder Wert aus der Datenbank läuft durch `escapeHtml()`** – Name, Beschreibung, URL, alt-Text, Merkmal-Texte. Das ist die Schutzschicht gegen XSS, weil das HTML per `innerHTML` eingesetzt wird.
- **Die Icons** (`feature.iconHtml`) werden **nicht** escapt. Sie sind fertiges Markup aus dem Quelltext, nicht aus der Datenbank. Die Namenskonvention hilft: Parameter mit `Html` im Namen sind Markup, alle anderen Text.

Zwei weitere Funktionen beschreiben die Zustände, in denen noch kein Zimmer zu sehen ist:

```ts
/** Same frame as a slide, so the page does not jump when the data arrives. */
export function getRoomSlideSkeletonHtml(): string {
    const bar = (classes: string): string => /*html*/ `<span class="block rounded-xs bg-purple-haze-light ${classes}"></span>`;

    return /*html*/ `
        <article class="${CARD_CLASSES} animate-pulse" aria-busy="true">
            <span class="sr-only">Zimmer werden geladen …</span>
            …
        </article>
    `;
}

export function getRoomSliderNoticeHtml(message: string): string {
    /* … */
}
```

Das **Skelett** benutzt dieselben Klassen-Konstanten (`CARD_CLASSES`, `IMAGE_BOX_CLASSES` …) wie die echte Karte und graue Balken in Zeilenhöhe (`h-[1.2lh]`). Kommen die Daten an, bleibt der Platz gleich – die Seite „springt" nicht (Fachbegriff: _Cumulative Layout Shift_). `animate-pulse` lässt die Balken pulsieren, `aria-busy` und der versteckte Text sagen Screenreadern, dass geladen wird.

### 10. Die View: Laden, Blättern, Aufräumen

Datei: `src/views/HomeView/Home.ts`

Im HTML ersetzt ein Rahmen die bisherige fest eingebaute Karte:

```diff
-            <section class="bg-purple-haze-light flex flex-col gap-y-6 py-10">
+            <section data-room-slider aria-labelledby="room-slider-title" class="bg-purple-haze-light …">
 …
-                    <button type="button" aria-label="Vorheriges Zimmer" class="shrink-0 text-purple-haze">
+                    <button type="button" data-room-step="-1" aria-label="Vorheriges Zimmer" aria-controls="room-slide" class="${ARROW_CLASSES}">
 …
-                    <div class="bg-white flex flex-col 992:flex-row gap-y-6">
-                        <div class="w-full 992:w-1/2">
-                            <img src="${double_suite}" alt="Double Suite" class="w-full 992:h-full object-cover">
-                            <p class="992:hidden px-4 font-antic-didone text-18 text-purple-haze-dark">231€ Nacht / p. P.</p>
-                        … (rund 60 Zeilen fester Inhalt mit vier SVG-Icons)
+                    <div id="room-slide" data-room-slide class="flex-1 min-w-0">${roomSliderTemplate.getRoomSlideSkeletonHtml()}</div>
 …
+                <p data-room-announcement aria-live="polite" class="sr-only"></p>
+
-                <button class="bg-purple-haze self-center py-2 px-3 rounded-md text-white">Buchen</button>
+                <a href="${BOOKING_PATH}" data-link data-room-booking class="self-center bg-purple-haze …">Buchen</a>
```

- Beim ersten Rendern steht das **Skelett** im Slot `#room-slide`.
- Die Pfeile tragen `data-room-step="-1"` bzw. `"1"` und sind zunächst `invisible`. Erst wenn es mehr als ein Zimmer gibt, macht die View sie sichtbar (`data-[visible]:visible`).
- Aus dem wirkungslosen `<button>Buchen</button>` wird ein echter Link mit `data-link` – der Router fängt ihn ab und navigiert ohne Seitenreload.
- `aria-live="polite"` lässt Screenreader vorlesen, was in diesen Absatz geschrieben wird.

Der Ablauf in der Klasse:

```ts
// eslint-disable-next-line @typescript-eslint/require-await
async afterRender(): Promise<void> {
    this.sliderEl = document.querySelector<HTMLElement>('[data-room-slider]');
    this.sliderEl?.addEventListener('click', (event: MouseEvent): void => {
        this.handleSliderClick(event);
    });
    void this.loadRooms();
}

destroy(): void {
    this.destroyed = true;
    this.sliderEl = null;
}

private async loadRooms(): Promise<void> {
    const today = toISODate(new Date());
    try {
        const slides = buildRoomSlides(await fetchRoomShowcase(today), today);
        if (this.destroyed) return;
        this.slides = slides;
        this.currentIndex = 0;
        this.renderSlider();
    } catch (error) {
        if (this.destroyed) return;
        console.error('Zimmer für den Slider konnten nicht geladen werden:', error);
        this.renderSliderNotice(ROOM_LOAD_ERROR);
    }
}
```

- **`void this.loadRooms()`** startet das Laden, ohne darauf zu warten. Die Seite ist sofort sichtbar (mit Skelett), die Zimmer kommen nach.
- **`if (this.destroyed) return;`** ist wichtig: Wechselt der Gast die Seite, bevor die Antwort da ist, ruft der Router `destroy()` auf. Ohne diese Prüfung würde die alte View noch in ein DOM schreiben, das ihr nicht mehr gehört.
- **Fehlerzustand:** Statt einer leeren Fläche erscheint ein freundlicher Hinweis; die technischen Details landen in der Konsole.
- **Ein einziger Click-Listener** auf dem ganzen Slider (_Event Delegation_) statt je einer pro Pfeil.

Blättern:

```ts
private handleSliderClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const step = Number(event.target.closest<HTMLElement>('[data-room-step]')?.dataset.roomStep);
    if (!isSlideStep(step) || this.slides.length < 2) return;

    this.currentIndex = getWrappedIndex(this.currentIndex, step, this.slides.length);
    this.renderSlide();
    const announcementEl = this.sliderEl?.querySelector<HTMLElement>('[data-room-announcement]');
    const slide = this.slides[this.currentIndex];
    if (announcementEl && slide) announcementEl.textContent = `${slide.name}, Zimmer ${(this.currentIndex + 1).toString()} von ${this.slides.length.toString()}`;
}
```

`closest('[data-room-step]')` findet den Pfeil-Button auch dann, wenn genau auf das SVG darin geklickt wurde. Ein Klick irgendwo anders liefert `undefined` → `Number(undefined)` ist `NaN` → `isSlideStep` sagt `false` → nichts passiert. Die Ansage („Double Suite, Zimmer 2 von 3") wird per `textContent` gesetzt, nicht per `innerHTML` – Zimmernamen kommen aus der Datenbank.

Beim Rendern wird nur die **Karte** neu geschrieben, Pfeile und Listener bleiben bestehen:

```ts
/** Re-renders only the card and the booking link – arrows and listeners stay. */
private renderSlide(): void {
    const slide = this.slides[this.currentIndex];
    const slideEl = this.sliderEl?.querySelector<HTMLElement>('[data-room-slide]');
    if (!slide || !slideEl) return;

    slideEl.innerHTML = roomSliderTemplate.getRoomSlideHtml({
        name: slide.name,
        description: slide.description ?? '',
        imageUrl: slide.imageUrl,
        imageAlt: slide.imageAlt,
        priceText: slide.priceLabel === null ? null : `ab ${slide.priceLabel} / Nacht`,
        features: slide.features.map(
            (feature: RoomSlideFeature): roomSliderTemplate.RoomSlideFeatureView => ({ iconHtml: getRoomFeatureIconHtml(feature.code), label: feature.label }),
        ),
        // No room detail page yet (see ticket) – "view Room" leads to the booking page for now.
        roomHref: BOOKING_PATH,
    });
    this.sliderEl?.querySelector<HTMLAnchorElement>('[data-room-booking]')?.setAttribute('href', getBookingHref(slide.slug));
}
```

Hier passiert die Arbeitsteilung aus der Projektkonvention: **Die View** rechnet aus, was angezeigt wird („ab 240€ / Nacht", welches Icon), **das Template** setzt es nur ins Markup. Zum Schluss bekommt der „Buchen"-Link die Adresse des aktuell sichtbaren Zimmers. Gibt es gar keine Zimmer, versteckt `renderSlider()` den ganzen Abschnitt (`hidden = true`).

### 11. Vorauswahl auf der Buchungsseite

Dateien: `src/views/BookingView/domain/preselection.ts` (neu), `src/views/BookingView/Booking.ts`

Der „Buchen"-Link transportiert die Wahl über die URL:

```ts
export const BOOKING_PATH = '/buchung';
const ROOM_PARAM = 'zimmer';

/** Link to the booking page with a room type preselected, e.g. `/buchung?zimmer=double-suite`. */
export function getBookingHref(slug: string): string {
    return `${BOOKING_PATH}?${new URLSearchParams({ [ROOM_PARAM]: slug }).toString()}`;
}

export function readPreselectedSlug(search: string): string | null {
    const slug = new URLSearchParams(search).get(ROOM_PARAM)?.trim() ?? '';
    return slug === '' ? null : slug;
}
```

`URLSearchParams` kümmert sich um das Kodieren von Sonderzeichen. Der Test zeigt, dass Hin- und Rückweg zusammenpassen: Aus `'double suite&x'` wird `/buchung?zimmer=double+suite%26x` und wieder `'double suite&x'`.

Schwieriger ist die Frage, **wann** das Zimmer gewählt werden darf. Die Buchungsseite kennt die Verfügbarkeit erst, wenn Zeitraum und Gäste feststehen. Die reine Funktion `resolvePreselection()` gibt deshalb einen von drei Zuständen zurück:

```ts
export type PreselectionResult =
    /** Keep waiting – no dates yet, or the room type cannot be booked for them. */
    | { status: 'pending' }
    /** Done without a change – the guest already chose rooms, or the room type does not exist. */
    | { status: 'dropped' }
    | { status: 'applied'; roomTypeId: string; quantity: number };

export function resolvePreselection(slug: string, rooms: readonly RoomCard[], quantities: RoomQuantities, roomLimit: number): PreselectionResult {
    if (getTotalRooms(quantities) > 0) return { status: 'dropped' };

    const room = rooms.find((candidate: RoomCard): boolean => candidate.slug === slug);
    if (room === undefined) return rooms.length === 0 ? { status: 'pending' } : { status: 'dropped' };

    const availability = room.availability;
    if (availability === null || !availability.isBookable) return { status: 'pending' };

    const quantity = clampQuantity(1, availability.roomsFree, 0, roomLimit).value;
    return quantity === 0 ? { status: 'pending' } : { status: 'applied', roomTypeId: room.roomTypeId, quantity };
}
```

Ein solcher **Diskriminierter Union-Typ** (das Feld `status` unterscheidet die Fälle) zwingt den Aufrufer, alle Fälle zu bedenken. Und weil nur bei `'applied'` die Felder `roomTypeId` und `quantity` existieren, kann man sie gar nicht versehentlich im falschen Fall lesen.

Die wichtigste Regel steht in der ersten Zeile: **Hat der Gast schon selbst Zimmer gewählt, wird nichts überschrieben.** `clampQuantity` (aus `roomQuantity.ts`, schon vorhanden) begrenzt die Menge auf freie Zimmer und Gruppengröße.

In `Booking.ts` wird der Slug beim Erzeugen der View gelesen und nach jedem Suchergebnis geprüft:

```diff
     private unsubscribeSummary: (() => void) | null = null;
+    // Room type chosen on the homepage slider – applied once dates and guests allow it.
+    private preselectedSlug: string | null = readPreselectedSlug(window.location.search);
 …
             this.quantityNotice = bookingState.applySearchResult(buildRoomCards(roomTypes, availability), buildExtraServices(serviceRows));
+            this.applyPreselection();
```

```ts
private applyPreselection(): void {
    if (this.preselectedSlug === null) return;

    const result = resolvePreselection(this.preselectedSlug, bookingState.getRooms(), bookingState.getRoomQuantities(), getRoomLimit(bookingState.getGuests().adults));
    if (result.status === 'pending') return;

    this.preselectedSlug = null;
    if (result.status === 'applied') bookingState.selectRoomQuantity(result.roomTypeId, result.quantity);
}
```

Bei `'pending'` bleibt der Slug gemerkt und wird nach der nächsten Suche erneut versucht. Bei `'dropped'` und `'applied'` wird er gelöscht – die Vorauswahl wirkt also **höchstens einmal**. Die View macht dabei nur das Nötigste; die Entscheidung liegt in der getesteten Fachlogik (`preselection.spec.ts`, sieben Fälle).

## Was wurde erreicht?

Die Startseite zeigt jetzt alle aktiven Zimmerkategorien aus der Datenbank – mit Bild, Beschreibung, Ausstattung und einem echten „ab"-Preis. Man kann im Kreis blättern, Screenreader erfahren, welches Zimmer gerade zu sehen ist, und während des Ladens springt das Layout nicht. „Buchen" führt direkt zur Buchungsseite und nimmt die Wahl mit.

Für Lernende zeigt der Commit, wie ein Feature sauber durch alle Schichten wandert: Migration mit RLS und Test → generierte Typen → abgeleitete Typen → Service mit reiner Umwandlungsfunktion → reine Hilfsfunktionen (`getWrappedIndex`, `resolvePreselection`) → Template → View. Jede Schicht ist für sich verständlich und, wo sie Logik enthält, getestet.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../014_2026-11-25_room-slider.md) · [Nächster Commit →](003_2026-11-25_nach-navigation-oben-starten.md)
