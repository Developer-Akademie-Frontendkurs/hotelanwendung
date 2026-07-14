[← Vorheriger Commit](010_2026-07-14_update-typography-layout-room.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# feat: find us componen and project diary

- **Commit:** `9c3d7f5`
- **Datum:** 2026-07-14
- **Autor:** Oliver Jung

## Worum geht es?

Die Startseite bekommt einen **„So finden Sie uns"-Bereich** mit einer eingebetteten **Google-Maps-Karte**. Zusätzlich wird das Theme um eine weitere Textgröße ergänzt und der Preis im Zimmer-Bereich geringfügig verkleinert. (Der Commit aktualisiert außerdem das Projekttagebuch, was hier nicht weiter erklärt wird.)

## Die Änderungen im Detail

### `src/style.css` – zusätzliche Textgröße

Für feinere Abstufungen kommt eine weitere Textgröße hinzu.

```diff
     --text-18: 1.125rem;
     --text-20: 1.25rem;
+    --text-22: 1.375rem;
     --text-24: 1.5rem;
     --text-28: 1.75rem;
```

### `src/views/HomeView/Home.ts` – kleinere Preisanzeige

Die neue Textgröße wird direkt genutzt: Der Preis der Suite (Desktop-Variante) wird von `text-24` auf `text-22` verkleinert.

```diff
-                                <p class="hidden 992:block font-antic-didone text-24 text-purple-haze-dark">231€ Nacht / p. P.</p>
+                                <p class="hidden 992:block font-antic-didone text-22 text-purple-haze-dark">231€ Nacht / p. P.</p>
```

### `src/views/HomeView/Home.ts` – der neue „So finden Sie uns"-Bereich

Am Ende des Templates wird eine neue `<section>` mit Überschrift und einem `<iframe>` angehängt. Über das eingebettete Google-Maps-`iframe` wird die Lage des Hotels angezeigt. Die Karte übernimmt mit `w-full max-w-300` die volle verfügbare Breite (bis maximal `max-w-300`) und wird mit `rounded-2xl` sowie der bereits vorhandenen Utility `shadow-pic` gestaltet.

```html
<section class="flex flex-col gap-y-4 768:gap-y-6 items-center py-16.25 992:py-30 px-4">
    <h2 class="font-playfair-display text-32 text-purple-haze-dark">So finden sie uns</h2>
    <iframe
        class="w-full max-w-300 h-112.5 rounded-2xl shadow-pic"
        src="https://www.google.com/maps/embed?pb=..."
        allowfullscreen=""
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"></iframe>
</section>
```

Wichtige Attribute des `<iframe>`:

- `loading="lazy"` lädt die Karte erst, wenn sie in den sichtbaren Bereich scrollt – das verbessert die anfängliche Ladezeit der Seite.
- `referrerpolicy="strict-origin-when-cross-origin"` steuert, welche Referrer-Information an Google gesendet wird.
- `allowfullscreen` erlaubt die Vollbild-Darstellung der Karte.

Außerdem werden zwischen den bestehenden `<section>`-Blöcken Leerzeilen eingefügt – rein zur besseren Lesbarkeit des Template-Codes, ohne Auswirkung auf die Darstellung.

## Was wurde erreicht?

Die Startseite ist um einen **Standort-Bereich** mit interaktiver Karte gewachsen. Damit finden Gäste das Hotel direkt von der Startseite aus. Dies ist der aktuell letzte Commit der Historie.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md)
