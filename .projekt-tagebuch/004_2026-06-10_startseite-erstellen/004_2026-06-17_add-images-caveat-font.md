[← Vorheriger Commit](003_2026-06-16_implement-routing-posts-supabase.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# Add images, caveat font

- **Commit:** `4d4ac80`
- **Datum:** 2026-06-17
- **Autor:** Oliver Jung

## Worum geht es?

Dieser Commit erweitert das Design-Fundament um eine weitere Schriftart – die handschriftlich wirkende **Caveat** – und **optimiert die Bilddateien**. Die zuvor eingecheckten Fotos waren mit teils über 10 MB pro Datei viel zu groß für eine Website. Sie werden durch stark verkleinerte, web-taugliche Versionen ersetzt.

## Die Änderungen im Detail

### `src/css/fonts.css` – die Caveat-Schnitte registrieren

Für die neue Schrift werden drei `@font-face`-Regeln ergänzt (Regular 400, Medium 500, Bold 700). Wie bei den anderen Fonts sorgt `font-display: swap` dafür, dass Text sofort sichtbar ist, während die Schrift noch geladen wird.

```css
/* caveat-regular - cyrillic_latin */
@font-face {
    font-display: swap;
    font-family: 'Caveat';
    font-style: normal;
    font-weight: 400;
    src: url('../assets/fonts/caveat-v23-cyrillic_latin-regular.woff2') format('woff2');
}
/* caveat-500 - cyrillic_latin */
@font-face {
    font-display: swap;
    font-family: 'Caveat';
    font-style: normal;
    font-weight: 500;
    src: url('../assets/fonts/caveat-v23-cyrillic_latin-500.woff2') format('woff2');
}
/* caveat-700 - cyrillic_latin */
@font-face {
    font-display: swap;
    font-family: 'Caveat';
    font-style: normal;
    font-weight: 700;
    src: url('../assets/fonts/caveat-v23-cyrillic_latin-700.woff2') format('woff2');
}
```

### `src/style.css` – Caveat als Theme-Variable

Damit die Schrift als Utility-Klasse `font-caveat` nutzbar wird, kommt eine neue Font-Variable ins `@theme`. Der Fallback `cursive` greift, falls die Webfont nicht geladen werden kann.

```diff
     --font-lato: 'Lato', sans-serif;
     --font-playfair-display: 'Playfair Display', serif;
     --font-antic-didone: 'Antic Didone', serif;
+    --font-caveat: 'Caveat', cursive;
```

### Bilder verkleinern und ersetzen

Die großen Originalbilder werden durch komprimierte Versionen ausgetauscht. Zwei Bilder wechseln dabei auch das Format von PNG zu JPG (JPG eignet sich für Fotos deutlich besser). Die Größenersparnis ist enorm:

| Datei | vorher | nachher |
|-------|--------|---------|
| `double-premium.jpg` | ~13,6 MB | ~1,1 MB |
| `double-suite.jpg` | ~11,5 MB | ~0,85 MB |
| `familie-strohheim.jpg` | ~12,5 MB | ~1,1 MB |
| `kuh-wamderung.jpg` | ~10,0 MB | ~0,8 MB |
| `kulinarik.png` → `kulinarik.jpg` | ~10,0 MB | ~0,43 MB |
| `main-header-bg.png` → `main-header-bg.jpg` | ~11,8 MB | ~3,6 MB |
| `yoga.jpg` | ~6,4 MB | ~0,94 MB |

## Was wurde erreicht?

Mit Caveat steht eine dekorative Handschrift für Akzente (z.B. Slogans) bereit, und die Bilder sind jetzt web-tauglich. Kleinere Bilddateien bedeuten kürzere Ladezeiten und eine bessere Performance – ein wichtiger Aspekt bei jeder echten Website.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](005_2026-06-17_mainlayout-mobile-navigation.md)
