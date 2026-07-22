[← Vorheriger Commit](003_2026-04-29_enhance-eslint-prettier-typescript.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [📓 Index](../000_index.md)

# Header-Farbe und Vite-Server-Einstellungen

- **Commit:** `0c6c1c6`
- **Datum:** 2026-04-29
- **Autor:** Oliver Jung

## Worum geht es?

Kleine, aber praktische Verbesserungen: Die Überschrift in der `index.html` bekommt eine andere Tailwind-Farbklasse, und der Vite-Server wird so eingestellt, dass er beim Start automatisch den Browser öffnet.

## Die Änderungen im Detail

### `index.html` – Farbklasse der Überschrift

Hier wird lediglich die Hintergrund-Utility-Klasse von `bg-amber-500` auf `bg-yellow-500` geändert. Das zeigt anschaulich, wie man mit Tailwind ohne eigenes CSS direkt im HTML stylt.

```diff
         <div id="app">
-            <h1 class="bg-amber-500 text-3xl">Unsere Hotelanwendung</h1>
+            <h1 class="bg-yellow-500 text-3xl">Unsere Hotelanwendung</h1>
         </div>
```

### `vite.config.ts` – Browser automatisch öffnen

Die Option `server.open` sorgt dafür, dass `npm run dev` direkt einen Browser-Tab öffnet.

```diff
 export default defineConfig({
     plugins: [tailwindcss(), checker({ typescript: true })],
+    server: {
+        open: true,
+    },
 });
```

## Was wurde erreicht?

Der Entwicklungs-Workflow wird komfortabler. Außerdem demonstriert dieser Commit das Arbeiten mit Tailwind-Utility-Klassen direkt im Markup.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../001_2026-04-29_project-setup.md) · [Nächster Commit →](005_2026-04-29_update-docs-eslint-ignore-node-modules.md)
