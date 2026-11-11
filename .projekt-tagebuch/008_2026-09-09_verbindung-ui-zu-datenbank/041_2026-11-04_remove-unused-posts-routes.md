[← Vorheriger Commit](040_2026-11-04_update-project-diary.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# refactor(main): remove unused routes and imports for posts

- **Commit:** `d78f56b`
- **Datum:** 2026-11-04
- **Autor:** Oliver Jung

## Worum geht es?

Dieser Commit **behebt den Build-Bruch aus Commit 039**. Dort wurden die Views `Posts.ts` und `SinglePost.ts` gelöscht, aber `src/main.ts` importierte sie weiterhin und trug sie als Routen ein. Ein Type-Check meldete deshalb:

```text
src/main.ts(4,27): error TS2307: Cannot find module './views/PostsView/Posts' or its corresponding type declarations.
src/main.ts(5,32): error TS2307: Cannot find module './views/PostsView/SinglePostView/SinglePost' or its corresponding type declarations.
```

```text
 src/main.ts | 15 +--------------
 1 file changed, 1 insertion(+), 14 deletions(-)
```

## Die Änderungen im Detail

Datei: `src/main.ts`

### 1. Imports entfernt

```diff
 import './style.css';
 import { HomeView } from './views/HomeView/Home';
-import { homeHeader, postsHeader, aboutHeader, bookingHeader } from './views/LayoutViews/MainHeader';
-import { PostsView } from './views/PostsView/Posts';
-import { SinglePostView } from './views/PostsView/SinglePostView/SinglePost';
+import { homeHeader, aboutHeader, bookingHeader } from './views/LayoutViews/MainHeader';
 import { AboutView } from './views/AboutView/About';
```

Die beiden Zeilen, die auf nicht mehr vorhandene Dateien zeigten, sind weg. Mit ihnen fällt auch `postsHeader` aus dem Import – er wurde nur von der `/posts`-Route gebraucht. Ohne diese Anpassung hätte `noUnusedLocals` aus der strikten `tsconfig.json` den unbenutzten Import als nächsten Fehler gemeldet.

### 2. Routen entfernt

```diff
     {
         path: '/',
         kind: 'static',
         header: homeHeader,
         view: HomeView,
     },
-    {
-        path: '/posts',
-        kind: 'static',
-        header: postsHeader,
-        view: PostsView,
-    },
-    {
-        path: '/posts/:id',
-        kind: 'dynamic',
-        view: SinglePostView,
-    },
     {
         path: '/about',
         kind: 'static',
```

Mit `/posts/:id` verschwindet die **einzige dynamische Route** der Anwendung – die einzige, die den `kind: 'dynamic'`-Zweig des selbstgeschriebenen Routers benutzt hat (siehe Branch `spa-struktur`). Der Router kann das weiterhin; es gibt nur gerade keine Route, die es braucht. Wer `/posts` jetzt aufruft, landet auf der Startseite: Für unbekannte Pfade fällt der Router auf die erste Route der Tabelle (`/`) zurück.

### 3. Prüfung

Auf dem Stand dieses Commits ist der Type-Check wieder sauber:

```bash
pnpm exec tsc --noEmit   # keine Ausgabe, Exit-Code 0
```

Auch ESLint meldet für `src/main.ts` nichts.

## Was bleibt vom Posts-Spike?

Der Commit entfernt nur das, was den Build gebrochen hat. Einige Reste des Kurs-Spikes (`E36`) sind noch da – keiner davon bricht etwas, aber sie sind jetzt ungenutzt bzw. veraltet:

| Rest                                                        | Zustand                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/shared/services/posts.service.ts` (`fetchPosts` …)     | wird von keiner Datei mehr importiert                                                                        |
| `export const postsHeader` in `MainHeader.ts`               | exportiert, aber nirgends verwendet (`noUnusedLocals` prüft keine Exporte)                                   |
| Tabelle `posts` (Migration `…_posts_spike.sql`)             | bleibt in der Datenbank; Migrationen sind geteilt und werden nicht zurückgedreht                             |
| `/admin/posts` (`AdminPostsView`, Link in `AdminLayout.ts`) | eigenständige Platzhalter-View, nutzt den Service nicht – unabhängig vom Spike                               |
| `CLAUDE.md`                                                 | nennt `SinglePostView` als Beispiel für dynamische Views und „Die Posts-Views lesen über `posts.service.ts`" |

Für Lernende ist das die zweite Hälfte der Lektion aus 039: Der Compiler findet **kaputte** Importe zuverlässig – **verwaiste** Dateien und Exporte findet er nicht. Dafür braucht es eine Suche (`grep -rn "posts" src`) oder ein Werkzeug wie `knip`, das ungenutzte Exporte und Dateien meldet. Und Dokumentation wie `CLAUDE.md` prüft gar kein Werkzeug.

## Was wurde erreicht?

`tsc --noEmit` läuft wieder fehlerfrei, der Build ist nach einem Commit Unterbrechung wieder grün, und die Route-Tabelle enthält nur noch Seiten, die es gibt. Offen bleiben die verwaisten Reste des Posts-Spikes und der Prüfvermerk `CHECK` über `ROOM_AMENITIES` aus 039.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](042_2026-11-04_update-project-diary.md)
