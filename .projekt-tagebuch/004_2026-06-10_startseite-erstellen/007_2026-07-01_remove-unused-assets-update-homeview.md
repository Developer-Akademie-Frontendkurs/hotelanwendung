[← Vorheriger Commit](006_2026-07-01_first-html-components.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# Remove unused image assets and update HomeView with new content and styles

- **Commit:** `a659c89`
- **Datum:** 2026-07-01
- **Autor:** Oliver Jung

## Worum geht es?

Dieser Commit baut die `HomeView` deutlich aus: Es kommen eine **Highlights-Leiste** (Seezugang, Haubenküche, Wellness) und ein **Vorstellungsbereich der Familie Stroheim** mit Bild hinzu. Außerdem wird das Theme um mehr Textgrößen und einen Schatten-Effekt erweitert, und die Inhalte werden über Breakpoints **responsiv** gestaltet.

## Die Änderungen im Detail

### `src/style.css` – mehr Textgrößen und ein Bild-Schatten

Das Theme bekommt weitere feste Textgrößen (`text-20` bis `text-64`) sowie eine Schatten-Definition. Zusätzlich wird eine eigene Utility-Klasse `.shadow-pic` angelegt, um Bildern einen dezenten farbigen Schatten zu geben.

```diff
     --font-caveat: 'Caveat', cursive;

+    --text-20: 1.25rem;
+    --text-24: 1.5rem;
     --text-28: 1.75rem;
     --text-32: 2rem;
+    --text-48: 3rem;
+    --text-64: 4rem;
+
+    --shadow-pic: inset 4px 4px 6px rgba(100, 35, 96, 0.45);
+}
+
+.shadow-pic {
+    box-shadow: 4px 4px 6.3px 0 rgba(100, 35, 96, 0.45);
 }
```

### `src/views/HomeView/Home.ts` – Icons und Bild importieren

Ganz oben werden die benötigten Assets importiert. Beachte den Dateinamen `familie-stroheim.jpg` – die Datei wurde in diesem Commit von `familie-strohheim.jpg` umbenannt (der Tippfehler „strohheim" wird korrigiert).

```ts
import AbstractView from '../AbstractView';
import seezugang from '../../assets/img/icons/seezugang.svg';
import haubenkueche from '../../assets/img/icons/kitchen.svg';
import wellness from '../../assets/img/icons/wellness.svg';
import fam_stroheim from '../../assets/img/familie-stroheim.jpg';
```

### `src/views/HomeView/Home.ts` – Highlights und Familien-Bereich

Der bisherige Blindtext-Abschnitt wird durch eine **Highlights-Leiste** aus drei `<article>`-Karten (Icon + Beschriftung) ersetzt. Auf kleinen Bildschirmen stehen sie untereinander (`flex-col`), ab dem `576`-Breakpoint nebeneinander (`576:flex-row`).

```diff
-                <section>
-                    <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. ...</p>
-                </section>
-                <section></section>
+                <section class="w-full flex flex-col 576:flex-row gap-y-10 576:gap-x-25.5 justify-center items-center">
+                    <article class="flex flex-col gap-y-2 items-center">
+                        <img src="${seezugang}" alt="Seezugang">
+                        <span class="font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">Seezugang</span>
+                    </article>
+                    <article class="flex flex-col gap-y-2 items-center">
+                        <img src="${haubenkueche}" alt="Haubenküche">
+                        <span class="font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">Haubenküche</span>
+                    </article>
+                    <article class="flex flex-col gap-y-2 items-center">
+                        <img src="${wellness}" alt="Wellness">
+                        <span class="font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">Wellness</span>
+                    </article>
+                </section>
```

Darunter folgt ein neuer Abschnitt, der die Gastgeberfamilie vorstellt – mit Überschrift, Bild (samt `shadow-pic`) und zwei beschreibenden Absätzen:

```html
<section class="flex flex-col gap-y-4 768:gap-y-6 items-center px-4">
    <p class="font-antic-didone text-20 text-purple-haze-dark">seit über 80 Jahren</p>
    <h2 class="font-playfair-display text-32 text-purple-haze-dark">Familie Stroheim</h2>
    <img src="${fam_stroheim}" alt="Familie Stroheim" class="w-full max-w-3xl object-cover rounded-xl shadow-pic">
    <p class="max-w-215 font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark text-center">
        Die Familie Stroheim führt den Karawanken Hof mit viel Herz ...
    </p>
</section>
```

Die durchgängigen Klassen-Trios wie `text-16 576:text-20 992:text-24` zeigen das Prinzip von **Mobile-First**: Zuerst wird die kleinste Größe gesetzt, größere Breakpoints überschreiben sie nach oben.

### `src/views/LayoutViews/MainLayout.ts` – Sterne als PNG und responsive Größen

Das Sterne-Icon wird von SVG auf PNG umgestellt (die zugehörige `stars.svg` wird in diesem Commit gelöscht). Überschrift und Slogan im Hero skalieren nun responsiv mit.

```diff
-import stars from '../../assets/img/icons/stars.svg';
+import stars from '../../assets/img/icons/stars.png';
```

```diff
-                        <h1 class="font-playfair-display font-semibold text-32 text-purple-haze">Luxus in den Alpen</h1>
-                        <p class="font-caveat text-28 text-purple-haze text-center leading-none">
+                        <h1 class="font-playfair-display font-semibold text-32 576:text-48 992:text-64 text-purple-haze">Luxus in den Alpen</h1>
+                        <p class="font-caveat text-28 576:text-32 992:text-48 text-purple-haze text-center leading-none">
```

## Was wurde erreicht?

Die Startseite ist jetzt inhaltlich weitgehend fertig: Willkommenstext, Highlights-Leiste und Familien-Vorstellung stehen, alles skaliert sauber über mehrere Breakpoints, und ungenutzte bzw. falsch benannte Assets sind aufgeräumt. In den folgenden Commits wird die Dokumentation umgestellt und ein Zimmer-Bereich ergänzt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](008_2026-07-08_project-diary.md)
