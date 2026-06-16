[← Vorheriger Commit](../003_2026-06-03_testing-spike/002_2026-06-10_fix-subtraction-test-dynamic-values.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# Eigene Schriftarten (Lato, Antic Didone, Playfair Display)

- **Commit:** `0b5a48f`
- **Datum:** 2026-06-10
- **Autor:** Oliver Jung

## Worum geht es?

Für ein hochwertiges Erscheinungsbild werden drei eigene Schriftarten eingebunden – lokal als `.woff2`-Dateien, also ohne Abhängigkeit von externen Diensten wie Google Fonts. Dazu wird ein **Tailwind-Theme** definiert, das eigene Font-Variablen, Farben und Breakpoints bereitstellt. Die `Home`-View bekommt Beispieltext, um die Schriften sichtbar zu machen.

## Die Änderungen im Detail

### `src/css/fonts.css` – die `@font-face`-Regeln

Jede Schriftschnitt-Variante wird über eine `@font-face`-Regel registriert. `font-display: swap` sorgt dafür, dass Text sofort (mit einer Ersatzschrift) angezeigt wird, bis die eigene Schrift geladen ist.

```css
/* lato-regular - latin */
@font-face {
    font-display: swap;
    font-family: 'Lato';
    font-style: normal;
    font-weight: 400;
    src: url('../assets/fonts/lato-v25-latin-regular.woff2') format('woff2');
}
/* playfair-display-700 - latin */
@font-face {
    font-display: swap;
    font-family: 'Playfair Display';
    font-style: normal;
    font-weight: 700;
    src: url('../assets/fonts/playfair-display-v40-latin-700.woff2') format('woff2');
}
```

### `src/style.css` – das Tailwind-Theme

In Tailwind v4 definiert man eigene Design-Token direkt per `@theme`. Hier werden Font-Familien, Farben und zusätzliche Breakpoints angelegt. Aus `--font-lato` macht Tailwind automatisch die Utility-Klasse `font-lato`.

```css
@import 'tailwindcss';

/* eslint-disable-next-line css/no-invalid-at-rules*/
@theme {
    --font-lato: 'Lato', sans-serif;
    --font-playfair-display: 'Playfair Display', serif;
    --font-antic-didone: 'Antic Didone', serif;

    --color-purple-haze: #642360;
    --color-purple-haze-dark: #381436;
    --color-creme: #fffcf6;

    --breakpoint-768: 48rem;
    --breakpoint-1140: 71.25rem;
    --breakpoint-1440: 90rem;
}
```

### `src/views/HomeView/Home.ts` – Schriften sichtbar machen

Die `Home`-View bekommt drei Absätze, die jeweils eine der neuen Font-Utility-Klassen nutzen (`font-lato`, `font-antic-didone`, `font-playfair-display`).

```diff
-        return `
+        return /*html*/ `
             <h1 class="bg-yellow-500 text-3xl">Start Seite View</h1>
+            <p class="py-8 text-[24px] font-lato">Diese Datei ist die Haupt-HTML-Datei ...</p>
+            <p class="py-8 text-[24px] font-antic-didone">Diese Datei ist die Haupt-HTML-Datei ...</p>
+            <p class="py-8 text-[24px] font-playfair-display">Diese Datei ist die Haupt-HTML-Datei ...</p>
         `;
```

### `src/index.html` – Formatierung

Die `index.html` wird lediglich neu eingerückt/formatiert; inhaltlich bleibt sie gleich (`#layout-wrapper` als Einstiegspunkt).

## Was wurde erreicht?

Die Anwendung verfügt über ein eigenes Schrift- und Farbsystem als Tailwind-Theme. Damit lassen sich die Designvorgaben des Hotels konsequent über Utility-Klassen umsetzen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](002_2026-06-15_assets-vite-config.md)
