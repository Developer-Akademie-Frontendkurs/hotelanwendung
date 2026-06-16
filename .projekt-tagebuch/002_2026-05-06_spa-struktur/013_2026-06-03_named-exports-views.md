[← Vorheriger Commit](012_2026-05-27_router-class-refactor.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Umstellung auf benannte Exporte

- **Commit:** `0aae0d7`
- **Datum:** 2026-06-03
- **Autor:** Oliver Jung

## Worum geht es?

Bisher nutzten die View-Klassen anonyme `export default class extends ...`. Das ist unpraktisch, weil der Name beim Import frei wählbar (und damit uneinheitlich) ist. Hier werden alle Views auf **benannte Exporte** (z.B. `export class HomeView`) umgestellt. Das macht Importe konsistent und das Debugging einfacher.

## Die Änderungen im Detail

### `src/views/HomeView/Home.ts` – benannte Klasse

```diff
 import AbstractView from '../AbstractView';

-export default class extends AbstractView {
+export class HomeView extends AbstractView {
     constructor() {
         super();
         this.setTitle('Start Seite View');
     }
```

### `src/main.ts` – konsistente Importe und Routen

Die Importe wechseln von Default- zu benannten Importen, und die Routen-Tabelle verwendet die neuen Klassennamen.

```diff
-import Home from './views/HomeView/Home';
-import Posts from './views/PostsView/Posts';
-import SinglePost from './views/PostsView/SinglePostView/SinglePost';
+import { HomeView } from './views/HomeView/Home';
+import { PostsView } from './views/PostsView/Posts';
+import { SinglePostView } from './views/PostsView/SinglePostView/SinglePost';
```

```diff
     {
         path: '/',
         kind: 'static',
-        view: Home,
+        view: HomeView,
     },
     {
         path: '/posts/:id',
         kind: 'dynamic',
-        view: SinglePost,
+        view: SinglePostView,
     },
```

### `src/views/AbstractView.ts` – explizite Rückgabetypen

Passend zu den strengen ESLint-Regeln bekommt `onInit()` einen expliziten Rückgabetyp. Wo `await` regeltechnisch erwartet wird, aber nicht nötig ist, wird die Regel gezielt per Kommentar deaktiviert.

```diff
-    async onInit() {}
+    async onInit(): Promise<void> {}

+    // eslint-disable-next-line @typescript-eslint/require-await
     async getHtml(): Promise<string> {
         return ``;
     }
```

## Was wurde erreicht?

Alle Views folgen jetzt einer einheitlichen Namenskonvention (`...View`). Die Importe sind eindeutig, und der Code erfüllt die strengen Lint-Vorgaben. Damit endet der Branch `spa-struktur` mit einer sauberen, konsistenten Architektur.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](../003_2026-06-03_testing-spike/001_2026-06-03_math-functions-tests.md)
