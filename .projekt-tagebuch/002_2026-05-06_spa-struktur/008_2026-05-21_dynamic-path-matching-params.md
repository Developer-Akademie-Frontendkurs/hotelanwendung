[← Vorheriger Commit](007_2026-05-21_branch-diary-session-entries.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Dynamisches Path-Matching und Parameter-Extraktion

- **Commit:** `2b3147f`
- **Datum:** 2026-05-21
- **Autor:** Oliver Jung

## Worum geht es?

Damit Routen wie `/posts/:id` funktionieren, braucht der Router zwei Dinge: Er muss erkennen, dass `/posts/42` zur Route `/posts/:id` passt, und er muss den Wert `42` als Parameter `id` extrahieren. Genau das wird hier über **reguläre Ausdrücke (RegExp)** umgesetzt – sehr ausführlich kommentiert, damit Lernende den Mechanismus nachvollziehen können.

## Die Änderungen im Detail

### `pathToRegex` – Routenmuster in RegExp umwandeln

Diese Funktion verwandelt ein Muster wie `/posts/:id` in einen regulären Ausdruck. Jeder `:parameter` wird zu einer **Capture Group** `([^/]+)` – das bedeutet „alles außer Slash, mindestens ein Zeichen". So matcht der Parameter genau ein Pfadsegment.

```ts
const pathToRegex = (path: string): RegExp =>
    new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '([^/]+)') + '$');
```

Der entscheidende Schritt gegenüber vorher: `(.+)` (das auch Slashes schluckte) wurde durch `([^/]+)` ersetzt.

```diff
-const pathToRegex: (path: string) => RegExp = (path: string): RegExp => new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '(.+)') + '$');
+const pathToRegex: (path: string) => RegExp = (path: string): RegExp => new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '([^/]+)') + '$');
```

Beispiel: `/posts/:id` wird zu `/^\/posts\/([^/]+)$/`. Das matcht `/posts/1` und `/posts/abc`, aber nicht `/posts/1/comments/2`.

### `getParams` – die Werte den Namen zuordnen

Nach dem Matching liefert die RegExp die Werte (z.B. `['/posts/42', '42']`). `getParams` koppelt diese Werte an die Parameternamen aus dem Routenmuster und baut daraus ein Objekt wie `{ id: '42' }`.

```ts
const getParams = (match: Match): Params => {
    const values: string[] = match.result.slice(1); // Index 0 = Gesamttreffer entfernen
    const keys: string[] = Array.from(match.route.path.matchAll(/:(\w+)/g))
        .map((result: RegExpMatchArray) => result[1]);
    return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
};
```

Wichtig ist die **Reihenfolge**: Die Capture Groups im RegExp und die gefundenen Parameternamen müssen in derselben Reihenfolge stehen, damit `id` auch wirklich den Wert von `:id` bekommt.

### Slash-Korrektur reaktiviert

Die zuvor auskommentierte Logik zur Korrektur eines abschließenden Slashs wird wieder aktiviert – aber nur, wenn der Pfad länger als ein Zeichen ist (damit `/` selbst nicht betroffen ist).

```diff
-    } //else if (locationPath.endsWith('/')) {
-        ...auskommentiert...
-    else if (locationPath.startsWith('/admin')) {
+    } else if (locationPath.length > 1 && locationPath.endsWith('/')) {
+        const correctedLocationPath = locationPath.slice(0, -1);
+        navigateTo(correctedLocationPath);
+        return;
+    } else if (locationPath.startsWith('/admin')) {
```

## Was wurde erreicht?

Der Router versteht jetzt dynamische Routen. `/posts/42` führt zur `SinglePost`-View, die über `params.id` weiß, welcher Beitrag geladen werden soll.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](009_2026-05-21_session-entry-routing.md)
