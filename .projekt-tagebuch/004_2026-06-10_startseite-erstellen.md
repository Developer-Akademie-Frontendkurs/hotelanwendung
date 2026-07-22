[← Vorheriger Branch](003_2026-06-03_testing-spike.md) · [📓 Index](000_index.md) · [Nächster Branch →](005_2026-07-22_buchungs-seite.md)

# 004 – Branch `startseite-erstellen`

**Erster Commit:** 2026-06-10 · **Commits:** 15 · **Status:** gemergt in `main`

## Ziel des Branches

In diesem Branch entsteht die eigentliche **Startseite** – vom Design-Fundament bis zu fertigen Inhaltsbereichen:

- Einbindung eigener **Schriftarten** (Lato, Antic Didone, Playfair Display, Caveat) als lokale Webfonts
- Aufbau eines **Tailwind-Themes** mit eigenen Farben, Textgrößen, Breakpoints und Font-Variablen
- Hinzufügen und **Optimieren der Bild- und Icon-Assets** für das Hotel-Design
- Verbesserung der **Vite-Build-Konfiguration** für saubere Ausgabe-Dateinamen
- Aufbau eines **responsiven Headers** mit mobiler (CSS-only) und Desktop-Navigation sowie Hero-Bereich
- Ausbau der **`HomeView`** mit Willkommenstext, Highlights-Leiste, Familien-Vorstellung, einem **Zimmer-Bereich**, einem **Standort-Bereich** mit Karte und einem **Aktivitäten-Bereich** (CSS-only-Karussell)
- Ausbau des **Footers** im `MainLayout` zu einem vollwertigen Seitenfuß mit Kontaktdaten, rechtlicher Navigation und Social-Media-Links

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
| [011](004_2026-06-10_startseite-erstellen/011_2026-07-14_find-us-component-project-diary.md) | 2026-07-14 | „So finden Sie uns"-Bereich mit Google-Maps-Karte |
| [012](004_2026-06-10_startseite-erstellen/012_2026-07-14_update-project-diary-find-us.md) | 2026-07-14 | Projekttagebuch nachziehen (reiner Doku-Commit) |
| [013](004_2026-06-10_startseite-erstellen/013_2026-07-15_enhance-footer-contact-social.md) | 2026-07-15 | Footer mit Kontaktdaten und Social-Media-Links ausbauen |
| [014](004_2026-06-10_startseite-erstellen/014_2026-07-15_add-last-steps-project-diary.md) | 2026-07-15 | Projekttagebuch abschließen (reiner Doku-Commit) |
| [015](004_2026-06-10_startseite-erstellen/015_2026-07-22_add-responsive-styles-activities-section.md) | 2026-07-22 | Aktivitäten-Bereich als responsives CSS-only-Karussell |

## Zusammenfassung

Der Branch führt von den Design-Grundlagen zu einer weitgehend fertigen Startseite: eigene Webfonts, ein Tailwind-Theme mit Farben, Textgrößen und Breakpoints sowie web-optimierte Bilder. Darauf aufbauend entsteht ein responsiver Header mit einem rein per CSS gesteuerten Burger-Menü und einem Hero-Bereich. Die `HomeView` wächst schrittweise um Willkommenstext, eine Highlights-Leiste, die Vorstellung der Gastgeberfamilie, einen ausgearbeiteten Zimmer-Bereich mit Slider-Bedienung, einen Standort-Bereich mit eingebetteter Karte und zuletzt einen **Aktivitäten-Bereich**, der auf kleinen Bildschirmen als reines CSS-Radio-Button-Karussell (ohne JavaScript, mit eigener `home.css`) funktioniert – alles konsequent mobile-first über mehrere Breakpoints gestaltet. Der gemeinsame Footer im `MainLayout` wird vom Platzhalter zu einem vollwertigen, semantischen Seitenfuß mit Kontaktdaten, rechtlicher Navigation und Social-Media-Links ausgebaut. Mehrere Zwischencommits stellen zudem die Projektdokumentation auf das strukturierte Projekttagebuch um bzw. ziehen es nach.

---

[← Vorheriger Branch](003_2026-06-03_testing-spike.md) · [📓 Index](000_index.md) · [Nächster Branch →](005_2026-07-22_buchungs-seite.md)
