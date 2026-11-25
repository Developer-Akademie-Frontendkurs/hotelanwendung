[← Vorheriger Commit](002_2026-11-25_zimmerslider-startseite-aus-datenbank.md) · [↑ Branch-Übersicht](../014_2026-11-25_room-slider.md) · [📓 Index](../000_index.md)

# fix: nach navigation per link oben auf der neuen seite starten

- **Commit:** `d9a6b8b`
- **Datum:** 2026-11-25
- **Autor:** Oliver Jung (Co-Author: Claude)

## Worum geht es?

Ein kleiner Fehler mit großer Wirkung, der erst durch den Zimmerslider auffiel: Klickt man auf der Startseite im Slider auf „Buchen", öffnet sich die Buchungsseite **mitten auf der Seite** statt oben. Die Commit-Message erklärt die Ursache:

> Der Router behielt die Scroll-Position bei, dadurch öffnete z. B. /buchung aus dem Zimmerslider mitten auf der Seite. Zurück/Vor (popstate) bleibt unverändert.

```text
 src/router/router.ts | 2 ++
 1 file changed, 2 insertions(+)
```

## Warum passiert das überhaupt?

Bei einer klassischen Website lädt jeder Link eine neue HTML-Seite, und der Browser beginnt sie automatisch oben. Eine **Single-Page-Application** lädt dagegen nie neu. Der selbstgeschriebene Router fängt Klicks auf Links mit `data-link` ab und tauscht nur den Inhalt aus:

```ts
private async handleLinkClick(event: MouseEvent): Promise<void> {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[data-link]');
    if (!(link instanceof HTMLAnchorElement)) return;

    event.preventDefault();          // kein echter Seitenwechsel
    await this.navigateTo(link.href);
}
```

Für den Browser ist es also **dieselbe Seite** – nur der Inhalt von `#content` ist ein anderer. Die Scroll-Position bleibt, wo sie war. Der Slider liegt auf der Startseite weit unten. Wer dort klickt, landet auf der Buchungsseite an derselben Höhe.

Bisher fiel das kaum auf, weil die meisten `data-link`-Links im Header sitzen – und wer dort klickt, ist ohnehin oben. Der Slider ist der erste Link mitten in einer langen Seite, der auf eine andere lange Seite führt.

## Die Änderung

Datei: `src/router/router.ts`, Methode `navigateTo()`

```diff
     async navigateTo(path: string): Promise<void> {
         if (window.location.pathname === path) return;
         history.pushState(null, '', path);
         await this.render();
+        // A new page starts at the top; back/forward (popstate) keeps the browser's position.
+        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
     }
```

Drei Details sind wichtig:

1. **Die Reihenfolge:** Erst wird gerendert (`await this.render()`), dann gescrollt. Würde man vorher scrollen, stünde für einen Moment noch die alte Seite oben im Bild – und die neue Seite, die anschließend eingesetzt wird, hätte eine andere Höhe.
2. **`behavior: 'instant'`:** Die Seite springt sofort nach oben, statt sichtbar hochzuscrollen. Das wäre auch dann wichtig, wenn irgendwo im CSS `scroll-behavior: smooth` gesetzt wird – die Option im Aufruf hat Vorrang.
3. **Nur in `navigateTo()`, nicht in `render()`:** `render()` wird auch beim Zurück- und Vor-Knopf des Browsers aufgerufen:

```ts
window.addEventListener('popstate', (): void => {
    void this.render();
});
```

Bei Zurück/Vor erwarten Nutzer:innen, **dort** weiterzulesen, wo sie waren. Diese Position stellt der Browser selbst wieder her (`history.scrollRestoration` steht standardmäßig auf `'auto'`). Ein `scrollTo` in `render()` würde das kaputtmachen. Deshalb sitzt die Zeile genau an der Stelle, die nur für **neue** Navigationen durchlaufen wird.

## Was wurde erreicht?

Jeder interne Link führt jetzt an den Anfang der neuen Seite – wie bei einem echten Seitenwechsel. Zurück und Vor behalten die gewohnte Position. Mit zwei Zeilen verhält sich die SPA an dieser Stelle wie eine klassische Website, ohne deren Neuladen.

Für Lernende ist das ein typisches Beispiel dafür, was ein Router in einer SPA alles **selbst** übernehmen muss, das der Browser bei normalen Links von allein erledigt: Verlauf (`pushState`), Seitentitel – und eben die Scroll-Position.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../014_2026-11-25_room-slider.md) · [Nächster Commit →](../015_2026-11-25_staff-roles/001_2026-11-25_mitarbeitende-und-rollen-planen.md)
