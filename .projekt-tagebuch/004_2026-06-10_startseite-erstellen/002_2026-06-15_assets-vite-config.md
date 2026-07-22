[← Vorheriger Commit](001_2026-06-10_custom-font-styles.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# Assets hinzufügen und Vite-Konfiguration verbessern

- **Commit:** `a943eaa`
- **Datum:** 2026-06-15
- **Autor:** Oliver Jung

## Worum geht es?

Dieser Commit bringt die **Medien-Assets** ins Projekt: Bilder (Zimmer, Kulinarik, Yoga, Header-Hintergrund) sowie zahlreiche **SVG-Icons** (Logo, Social-Media, Ausstattungs-Symbole). Außerdem wird die Tailwind-Theme-Struktur aufgeräumt und die **Vite-Build-Konfiguration** verbessert, damit Ausgabedateien vorhersehbare Namen erhalten.

## Die Änderungen im Detail

### `src/style.css` und `src/css/fonts.css` – Aufräumen

Die `fonts.css` wird per `@import` eingebunden, und die Font-Variablen wandern ans Ende des `@theme`-Blocks (rein organisatorisch).

```diff
 @import 'tailwindcss';
+@import './css/fonts.css';

 /* eslint-disable-next-line css/no-invalid-at-rules*/
 @theme {
-    --font-lato: 'Lato', sans-serif;
-    --font-playfair-display: 'Playfair Display', serif;
-    --font-antic-didone: 'Antic Didone', serif;
-
     --color-purple-haze: #642360;
     ...
+    --font-lato: 'Lato', sans-serif;
+    --font-playfair-display: 'Playfair Display', serif;
+    --font-antic-didone: 'Antic Didone', serif;
 }
```

### `vite.config.ts` – kontrollierte Ausgabedateinamen

Über `rollupOptions.output` wird festgelegt, wie die gebauten Dateien heißen. JavaScript bekommt `script-[hash].js`, CSS wird zu `style-[hash].css`, und Assets behalten ihre Ordnerstruktur. Der `[hash]` sorgt für „Cache-Busting": Ändert sich eine Datei, ändert sich ihr Name, und Browser laden garantiert die neue Version.

```diff
     build: {
         emptyOutDir: true,
         outDir: '../dist',
+        rollupOptions: {
+            output: {
+                entryFileNames: 'script-[hash].js',
+                chunkFileNames: 'assets/[name]-[hash].js',
+                assetFileNames: (info) => {
+                    const name = info.names?.[0] ?? '';
+                    if (name.endsWith('.css')) {
+                        return 'style-[hash][extname]';
+                    }
+                    const original = info.originalFileNames?.[0] ?? '';
+                    if (original.startsWith('assets/')) {
+                        const dir = original.slice(0, original.lastIndexOf('/'));
+                        return `${dir}/[name]-[hash][extname]`;
+                    }
+                    return 'assets/[name]-[hash][extname]';
+                },
+            },
+        },
     },
```

### Neue Assets

Hinzugefügt wurden u.a.:

- **Bilder:** `double-premium.jpg`, `double-suite.jpg`, `familie-strohheim.jpg`, `kuh-wamderung.jpg`, `kulinarik.png`, `yoga.jpg`, `main-header-bg.png`
- **Icons (SVG):** `logo.svg`, `logo-small.svg`, `facebook.svg`, `instagram.svg`, `tripadvisor.svg`, `michelin-star.svg`, `gault-milau.svg`, `wellness.svg`, `gym.svg`, `kitchen.svg`, `bathroom.svg`, `kingsize.svg`, `klima.svg`, `seezugang.svg`, `stars.svg`

## Was wurde erreicht?

Alle visuellen Bausteine (Schriften, Farben, Bilder, Icons) liegen nun im Projekt bereit, und der Build erzeugt sauber benannte, cache-freundliche Dateien. Damit ist die Grundlage für die vollständige Gestaltung der Startseite geschaffen. In den folgenden Commits werden diese Bausteine zu einer echten Startseite zusammengesetzt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](003_2026-06-16_implement-routing-posts-supabase.md)
