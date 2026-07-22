[← Vorheriger Commit](003_2026-05-13_supabase-config-files.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# SPA-Grundstruktur mit Router und Views

- **Commit:** `8e1e659`
- **Datum:** 2026-05-13
- **Autor:** Oliver Jung

## Worum geht es?

Das ist der zentrale Commit für die SPA. Hier entsteht ein **clientseitiger Router**, der je nach URL die passende View anzeigt – ganz ohne Seiten-Neuladen. Außerdem werden mehrere Views (`Home`, `Posts`, `About`) und die Basisklasse `AbstractView` (neu, mit `getHtml()`) angelegt. Die `index.html` zieht in den `src/`-Ordner um.

## Die Änderungen im Detail

### `src/views/AbstractView.ts` – Basisklasse mit Typen

Die Basisklasse definiert jetzt klare Rückgabetypen. `getHtml()` liefert ein Promise mit dem HTML-String.

```ts
export default class {
    setTitle(title: string): void {
        document.title = title;
    }

    async getHtml(): Promise<string> {
        return ``;
    }
}
```

### `src/main.ts` – der Router als Funktion

Der Router ist hier noch eine Funktion. Zentrale Konzepte:

- **Routen-Tabelle:** Jede Route verbindet einen `path` mit einer `view`-Klasse.
- **`navigateTo`:** Ändert per `history.pushState` die URL ohne Neuladen und ruft den Router auf.
- **Matching:** Die aktuelle `location.pathname` wird mit den Routen verglichen.
- **Rendering:** Die gefundene View wird instanziiert und ihr HTML in `#app` geschrieben.

```ts
type ViewInstance = {
    setTitle: (title: string) => void;
    getHTML: () => Promise<string>;
};

interface Route {
    path: string;
    view: new () => ViewInstance;
}

const navigateTo: (url: string) => void = (url: string): void => {
    history.pushState(null, '', url);
    void router();
};

const router: () => void = async (): Promise<void> => {
    const routes: Route[] = [
        { path: '/', view: Home },
        { path: '/posts', view: Posts },
        { path: '/about', view: About },
    ];

    const potentialMatches: Match[] = routes.map((route: Route): Match => ({
        route: route,
        isMatch: location.pathname === route.path,
    }));

    let match = potentialMatches.find((m: Match): boolean => m.isMatch);
    if (!match) {
        match = { route: routes[0], isMatch: true }; // Fallback
    }

    const view: ViewInstance = new match.route.view();
    const appContainer = document.getElementById('app');
    if (appContainer) {
        appContainer.innerHTML = await view.getHtml();
    }
};
```

Damit Links nicht die Seite neu laden, fängt ein zentraler Klick-Listener alle Klicks auf Elemente mit `data-link` ab:

```ts
document.addEventListener('DOMContentLoaded', (): void => {
    document.body.addEventListener('click', (event: MouseEvent): void => {
        if ((event.target as HTMLElement).matches('[data-link]')) {
            event.preventDefault();
            navigateTo((event.target as HTMLElement).href);
        }
    });
    router();
});

window.addEventListener('popstate', () => void router());
```

Der `popstate`-Listener sorgt dafür, dass auch der Zurück-Button des Browsers funktioniert.

### `src/views/HomeView/Home.ts` – Navigation und Inhalt

Die `Home`-View enthält die Navigationsleiste. Die Links tragen das Attribut `data-link`, damit der Router sie abfängt.

```ts
import AbstractView from '../AbstractView';

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle('Start Seite View');
    }

    async getHtml(): Promise<string> {
        return `
            <nav>
                <ul>
                    <li><a href="/" data-link>Home</a></li>
                    <li><a href="/posts" data-link>Posts</a></li>
                    <li><a href="/about" data-link>About</a></li>
                </ul>
            </nav>
            <h1 class="bg-yellow-500 text-3xl">Start Seite View</h1>
        `;
    }
}
```

## Was wurde erreicht?

Die Anwendung ist jetzt eine echte SPA: Über die Navigation wechselt man zwischen Home, Posts und About, ohne dass die Seite neu geladen wird. Browser-Verlauf (Vor/Zurück) funktioniert dank `pushState` und `popstate`.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](005_2026-05-20_layout-wrapper-views.md)
