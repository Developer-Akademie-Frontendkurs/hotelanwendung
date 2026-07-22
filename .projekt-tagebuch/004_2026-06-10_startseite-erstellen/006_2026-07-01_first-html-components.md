[← Vorheriger Commit](005_2026-06-17_mainlayout-mobile-navigation.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# first html components

- **Commit:** `c396891`
- **Datum:** 2026-07-01
- **Autor:** Oliver Jung

## Worum geht es?

Jetzt wird aus dem Gerüst echter Seiteninhalt: Der Header bekommt einen **Hero-Bereich** mit Sternebewertung, Überschrift und handschriftlichem Slogan, und die `HomeView` erhält einen ersten **Willkommenstext**. Nebenbei werden Theme und ESLint-Konfiguration geschärft und der im Vorgängercommit erwähnte CSS-Fehler behoben.

## Die Änderungen im Detail

### `eslint.config.ts` – Baseline-Regel aktivieren

Die Regel `css/use-baseline` warnt vor CSS-Features, die noch nicht breit von Browsern unterstützt werden. `available: 'newly'` erlaubt Features, die erst kürzlich zum „Baseline"-Standard gehören.

```diff
         rules: {
             'css/no-unmatchable-selectors': 'off',
             'css/no-duplicate-keyframe-selectors': 'off',
+            'css/use-baseline': ['error', { available: 'newly' }],
         },
```

### `src/style.css` – Theme aufräumen und erweitern

Die Farbe `--color-creme` wird zu `--color-eggshell` umbenannt (aussagekräftigerer Name), und es kommen zwei feste Textgrößen als Theme-Variablen hinzu. Aus `--text-28` macht Tailwind die Utility-Klasse `text-28`.

```diff
-/* eslint-disable-next-line css/no-invalid-at-rules*/
+/* eslint-disable-next-line css/no-invalid-at-rules */
 @theme {
     --color-purple-haze: #642360;
     --color-purple-haze-dark: #381436;
-    --color-creme: #fffcf6;
+    --color-eggshell: #fffcf6;
     ...
+    --text-28: 1.75rem;
+    --text-32: 2rem;
 }
```

### `src/views/LayoutViews/MainLayout.ts` – Hero-Bereich im Header

Der Header wird umstrukturiert: Die äußere `<section>` entfällt, das Hintergrundbild rutscht direkt auf den `<header>`, und darunter kommt ein **Hero-Block** mit Sterne-Icon, `<h1>` und dem Caveat-Slogan. Auch das neue `stars`-Icon wird importiert.

```diff
 import logo from '../../assets/img/logo.svg';
+import stars from '../../assets/img/icons/stars.svg';
 import './layout.css';
```

```diff
+                    <div class="flex flex-col gap-y-4 items-center mt-12">
+                        <img src="${stars}" alt="Stars">
+                        <h1 class="font-playfair-display font-semibold text-32 text-purple-haze">Luxus in den Alpen</h1>
+                        <p class="font-caveat text-28 text-purple-haze text-center leading-none">
+                            wo sich Fuchs und Hase <br>gute Nacht sagen
+                        </p>
+                    </div>
```

Hier zeigt sich, wie die zuvor angelegten Bausteine zusammenspielen: `font-playfair-display`, `font-caveat`, `text-32`/`text-28` und `text-purple-haze` stammen alle aus dem Theme.

### `src/views/HomeView/Home.ts` – erster echter Inhalt

Die Platzhalter-Absätze mit Blindtext werden durch einen strukturierten Willkommensbereich ersetzt.

```diff
-            <h1 class="bg-yellow-500 text-3xl">Start Seite View</h1>
-            <p class="py-8 text-[24px] font-lato">Diese Datei ist die Haupt-HTML-Datei ...</p>
-            <p class="py-8 text-[24px] font-antic-didone">Diese Datei ist die Haupt-HTML-Datei ...</p>
-            <p class="py-8 text-[24px] font-playfair-display">Diese Datei ist die Haupt-HTML-Datei ...</p>
+            <div class="max-w-360 flex flex-col gap-y-10 pt-6 px-3 pb-16.25 mx-auto">
+                <section class="text-center">
+                    <p class="font-antic-didone text-16 text-purple-haze-dark">
+                        Willkommen im Karawanken Hof – unseren familiengeführten Rückzugsort in den Alpen,
+                        fernab von Stress und im Einklang mit der Natur.
+                    </p>
+                    <p class="mt-6 font-antic-didone text-16 text-purple-haze-dark">
+                        Freuen Sie sich auf exklusive Chalets, unberührte Wanderwege und geführte Rad- und
+                        Kuhwanderungen – alles an einem Ort, der bewusst fern vom Alltag liegt.
+                    </p>
+                </section>
+                <section>
+                    <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. ...</p>
+                </section>
+                <section></section>
+            </div>
```

### `src/views/LayoutViews/layout.css` – Feinschliff

Beim geöffneten Menü wird das Scrollen der Seite unterbunden (`overflow-y: hidden` via `:has()`), das Panel öffnet etwas tiefer (`top: 88px` statt `64px`), und der im vorigen Commit erwähnte Tippfehler im Selektor wird korrigiert.

```diff
+body:has(.mobile-menu__checkbox:checked) {
+    overflow-y: hidden;
+}
```

```diff
-        & :checked ~ .mobile-menu__container {
+        &:checked ~ .mobile-menu__container {
             height: 100%;
             transition-delay: 0s;
         }
```

Das Leerzeichen in `& :checked` hätte den Selektor auf beliebige Kind-Elemente bezogen statt auf die Checkbox selbst – ein kleiner, aber wirkungsvoller Unterschied.

## Was wurde erreicht?

Die Startseite hat erstmals echten Inhalt: einen einladenden Hero-Bereich im Header und einen Willkommenstext in der `HomeView`. Theme und Linting sind aufgeräumt, und das mobile Menü verhält sich jetzt korrekt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](007_2026-07-01_remove-unused-assets-update-homeview.md)
