[← Vorheriger Commit](011_2026-05-23_tsconfig-es2025-eslint-strict.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Router-Klasse, Refactoring der Routing-Struktur

- **Commit:** `2075690`
- **Datum:** 2026-05-27
- **Autor:** Oliver Jung

## Worum geht es?

Bisher steckte die gesamte Routing-Logik als loser Funktions-Wirrwarr in `main.ts`. Jetzt wird sie in eine eigene, gut gekapselte **`Router`-Klasse** ausgelagert. Die Typen wandern in eine eigene Interface-Datei. Das Ergebnis: `main.ts` schrumpft drastisch (ca. 249 Zeilen entfernt), und die Verantwortlichkeiten sind sauber getrennt.

## Die Änderungen im Detail

### `src/router/router.interface.ts` – die Typen

Alle Routing-Typen werden zentral definiert. Neu ist das Feld `kind`, das `static` von `dynamic` unterscheidet – dadurch weiß der Router, ob die View mit oder ohne Parameter erzeugt werden muss.

```ts
export type Params = Record<string, string>;

export type ViewInstance = {
    setTitle: (title: string) => void;
    onInit: () => Promise<void>;
    getHtml: () => Promise<string>;
};

export type StaticRoute = {
    path: string;
    kind: 'static';
    view: new () => ViewInstance;
};

export type DynamicRoute = {
    path: string;
    kind: 'dynamic';
    view: new (params: Params) => ViewInstance;
};

export type Route = StaticRoute | DynamicRoute;

export interface Match {
    route: Route;
    result: RegExpMatchArray | null;
}
```

### `src/router/router.ts` – die Router-Klasse

Die Klasse erhält im Konstruktor die Routen und den Layout-Wrapper. Die Methode `init()` registriert die Event-Listener und rendert zum ersten Mal.

```ts
export class Router {
    private readonly routes: Route[];
    private readonly layoutWrapper: HTMLElement | null;

    constructor(routes: Route[], layoutWrapper: HTMLElement | null) {
        this.routes = routes;
        this.layoutWrapper = layoutWrapper;
    }

    async init(): Promise<void> {
        window.addEventListener('popstate', (): void => { void this.render(); });
        document.addEventListener('click', (event: MouseEvent): void => { void this.handleLinkClick(event); });
        await this.render();
    }
    // ...
}
```

Das Herzstück ist `render()`. Es sucht den passenden Match, wählt anhand von `kind` die richtige View-Erzeugung, ruft `onInit()` (für den Datenabruf) auf und schreibt das HTML in `#content`.

```ts
async render(): Promise<void> {
    const locationPath = window.location.pathname;
    const potentialMatches = this.getPotentialMatches(locationPath);
    let match = potentialMatches.find((m) => m.result !== null);

    if (!match) {
        match = { route: this.routes[0], result: [locationPath] }; // Fallback
    }

    await this.getBaseLayout(locationPath);

    const contentContainer = document.getElementById('content');
    if (!contentContainer) throw new Error('Fehler beim Laden der Seite');

    const view: ViewInstance = match.route.kind === 'dynamic'
        ? new match.route.view(this.getParams(match))
        : new match.route.view();

    await view.onInit();
    contentContainer.innerHTML = await view.getHtml();
}
```

Die Hilfsmethoden `pathToRegex`, `getParams`, `getBaseLayout`, `getPotentialMatches` und `handleLinkClick` kapseln jeweils einen klaren Teilschritt – das macht die Klasse gut lesbar und testbar.

## Was wurde erreicht?

Das Routing ist nun objektorientiert gekapselt. `main.ts` definiert nur noch die Routen-Tabelle und startet den Router. Der Code ist deutlich übersichtlicher und entspricht den strengen Linting-Regeln aus dem vorherigen Commit.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](013_2026-06-03_named-exports-views.md)
