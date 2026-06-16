[← Vorheriger Commit](../001_2026-04-29_project-setup/007_2026-05-06_session-entry-supabase.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# `.gitignore` aktualisieren, `AbstractView` und `HomeView` anlegen

- **Commit:** `0fa80b0`
- **Datum:** 2026-05-06
- **Autor:** Oliver Jung

## Worum geht es?

Ein erster Versuch, die View-Struktur einzuführen. Es entstehen die Basisklasse `AbstractView` und eine erste konkrete View `Home`. In `main.ts` wird ein erster Router-Entwurf skizziert. Dieser Stand wird im nächsten Commit jedoch wieder zurückgenommen (Revert) und in `004` sauber neu aufgebaut.

## Die Änderungen im Detail

### `src/views/AbstractView.ts` – die Basisklasse

Jede View soll einen Seitentitel setzen und HTML liefern können. Diese gemeinsame Funktionalität steckt in der Basisklasse.

```ts
export default class {
    setTitle(title: string) {
        document.title = title;
    }

    async getHTML() {
        return /*html*/ '';
    }
}
```

### `src/views/HomeView/Home.ts` – die erste View

`Home` erbt von `AbstractView`, setzt einen Titel und liefert eine Überschrift als HTML.

```ts
import AbstractView from '../AbstractView';

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle('Home | Hotelanwendung');
    }

    async getHTML() {
        return `
            <h1>Hauptseite</h1>
        `;
    }
}
```

### `src/main.ts` – Router-Skizze

In `main.ts` wird ein erster, noch unvollständiger Router-Ansatz angedeutet.

```diff
+const router = async () => {
+    const routes = [
+        { path: '/', view: Home }
+    ];
+}
```

## Was wurde erreicht?

Die Idee einer View-Hierarchie ist umrissen. Da der Ansatz noch unfertig ist, wird er im nächsten Schritt zurückgesetzt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](002_2026-05-13_revert-abstractview-homeview.md)
