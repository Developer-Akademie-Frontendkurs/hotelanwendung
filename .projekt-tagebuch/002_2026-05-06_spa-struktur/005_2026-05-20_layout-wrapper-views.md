[← Vorheriger Commit](004_2026-05-13_spa-grundstruktur.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Layout-Wrapper und Layout-Views

- **Commit:** `6fbf4bc`
- **Datum:** 2026-05-20
- **Autor:** Oliver Jung

## Worum geht es?

Bisher ersetzte jede View die komplette Seite. Jetzt wird ein **Layout-Konzept** eingeführt: Ein äußerer Rahmen (Navigation + Footer) bleibt bestehen, nur der innere Bereich `#content` wechselt. Es gibt zwei Layouts – ein **MainLayout** für den öffentlichen Bereich und ein **AdminLayout** für `/admin`-Routen. Außerdem kommen die Admin-Views `AdminDashboard` und `AdminPosts` hinzu.

## Die Änderungen im Detail

### `src/views/LayoutViews/MainLayout.ts` – der äußere Rahmen

Das Layout liefert Navigation, einen leeren `#content`-Container und einen Footer. Der Router füllt `#content` später mit der konkreten View.

```ts
import AbstractView from '../AbstractView';

export default class extends AbstractView {
    async getHtml(): Promise<string> {
        return /*html*/ `
            <nav>
                <ul>
                    <li><a href="/" data-link>Home</a></li>
                    <li><a href="/posts" data-link>Posts</a></li>
                    <li><a href="/about" data-link>About</a></li>
                </ul>
            </nav>
            <div id="content"></div>
            <div id="footer"><p>Copyright © 2024</p></div>
        `;
    }
}
```

Das `AdminLayout` ist analog aufgebaut, hat aber eine eigene Admin-Navigation.

### `src/main.ts` – Layout-Auswahl im Router

Der Router entscheidet anhand des Pfads, welches Layout in den `#layout-wrapper` geschrieben wird. Pfade unter `/admin` bekommen das AdminLayout, alle anderen das MainLayout. Zusätzlich wird ein abschließender Slash (z.B. `/posts/`) korrigiert.

```diff
 const router: () => void = async (): Promise<void> => {
+    const layoutWrapper: HTMLElement | null = document.getElementById('layout-wrapper');
+    const locationPath: string = location.pathname;
+
+    if (!layoutWrapper) {
+        throw new Error('Fehler beim Laden der Seite');
+    } else if (locationPath.endsWith('/')) {
+        const correctedLocationPath = locationPath.slice(0, -1);
+        navigateTo(correctedLocationPath);
+        return;
+    } else if (locationPath.startsWith('/admin')) {
+        layoutWrapper.innerHTML = await new AdminLayout().getHtml();
+    } else {
+        layoutWrapper.innerHTML = await new MainLayout().getHtml();
+    }
+
     const routes: Route[] = [
         { path: '/', view: Home },
         ...
+        { path: '/admin', view: AdminDashboard },
+        { path: '/admin/posts', view: AdminPosts },
     ];
```

Wichtig ist auch die Umstellung des Render-Ziels: Statt in `#app` wird die View nun in `#content` geschrieben.

```diff
-    const appContainer: HTMLElement | null = document.getElementById('app');
-    if (appContainer) {
-        appContainer.innerHTML = await view.getHtml();
+    const contentContainer: HTMLElement | null = document.getElementById('content');
+    if (contentContainer) {
+        contentContainer.innerHTML = await view.getHtml();
     }
```

## Was wurde erreicht?

Die App trennt nun den gleichbleibenden Rahmen (Layout) vom wechselnden Inhalt. Der Admin-Bereich erhält ein eigenes Layout. Das ist eine typische, gut wartbare Architektur für SPAs.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](006_2026-05-20_routing-posts-single-post-supabase.md)
