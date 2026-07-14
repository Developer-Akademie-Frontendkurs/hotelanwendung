[← Vorheriger Branch](003_2026-06-03_testing-spike.md) · [📓 Index](000_index.md)

# 004 – Branch `startseite-erstellen`

**Erster Commit:** 2026-06-10 · **Commits:** 10 · **Status:** offen

## Ziel des Branches

In diesem (aktuell jüngsten) Branch entsteht die eigentliche **Startseite** – vom Design-Fundament bis zu fertigen Inhaltsbereichen:

- Einbindung eigener **Schriftarten** (Lato, Antic Didone, Playfair Display, Caveat) als lokale Webfonts
- Aufbau eines **Tailwind-Themes** mit eigenen Farben, Textgrößen, Breakpoints und Font-Variablen
- Hinzufügen und **Optimieren der Bild- und Icon-Assets** für das Hotel-Design
- Verbesserung der **Vite-Build-Konfiguration** für saubere Ausgabe-Dateinamen
- Aufbau eines **responsiven Headers** mit mobiler (CSS-only) und Desktop-Navigation sowie Hero-Bereich
- Ausbau der **`HomeView`** mit Willkommenstext, Highlights-Leiste, Familien-Vorstellung und einem **Zimmer-Bereich**

## Commits

| Nr. | Datum | Beschreibung |
|-----|-------|--------------|
| [001](004_2026-06-10_startseite-erstellen/001_2026-06-10_custom-font-styles.md) | 2026-06-10 | Eigene Schriftarten (Lato, Antic Didone, Playfair Display) |
| [002](004_2026-06-10_startseite-erstellen/002_2026-06-15_assets-vite-config.md) | 2026-06-15 | Assets hinzufügen und Vite-Konfiguration verbessern |
| [003](004_2026-06-10_startseite-erstellen/003_2026-06-16_implement-routing-posts-supabase.md) | 2026-06-16 | Umstellung der Projektdokumentation (Message nennt Routing) |
| [004](004_2026-06-10_startseite-erstellen/004_2026-06-17_add-images-caveat-font.md) | 2026-06-17 | Bilder optimieren und Caveat-Schrift ergänzen |
| [005](004_2026-06-10_startseite-erstellen/005_2026-06-17_mainlayout-mobile-navigation.md) | 2026-06-17 | Responsiver Header mit mobiler Navigation (CSS-only) |
| [006](004_2026-06-10_startseite-erstellen/006_2026-07-01_first-html-components.md) | 2026-07-01 | Erste HTML-Komponenten: Hero-Bereich und Willkommenstext |
| [007](004_2026-06-10_startseite-erstellen/007_2026-07-01_remove-unused-assets-update-homeview.md) | 2026-07-01 | HomeView ausbauen (Highlights, Familie Stroheim), Assets aufräumen |
| [008](004_2026-06-10_startseite-erstellen/008_2026-07-08_project-diary.md) | 2026-07-08 | Projekttagebuch ausbauen (reiner Doku-Commit) |
| [009](004_2026-06-10_startseite-erstellen/009_2026-07-08_room-section.md) | 2026-07-08 | Zimmer-Bereich „Zimmer mit Weitblick" hinzufügen |
| [010](004_2026-06-10_startseite-erstellen/010_2026-07-14_update-typography-layout-room.md) | 2026-07-14 | Zimmer-Bereich: Typografie, Layout und Slider-Buttons |

## Zusammenfassung

Der Branch führt von den Design-Grundlagen zu einer weitgehend fertigen Startseite: eigene Webfonts, ein Tailwind-Theme mit Farben, Textgrößen und Breakpoints sowie web-optimierte Bilder. Darauf aufbauend entsteht ein responsiver Header mit einem rein per CSS gesteuerten Burger-Menü und einem Hero-Bereich. Die `HomeView` wächst schrittweise um Willkommenstext, eine Highlights-Leiste, die Vorstellung der Gastgeberfamilie und schließlich einen ausgearbeiteten Zimmer-Bereich mit Slider-Bedienung – alles konsequent mobile-first über mehrere Breakpoints gestaltet. Ein Zwischencommit stellt zudem die Projektdokumentation von einem Session-Log auf das strukturierte Projekttagebuch um.

---

[← Vorheriger Branch](003_2026-06-03_testing-spike.md) · [📓 Index](000_index.md)
