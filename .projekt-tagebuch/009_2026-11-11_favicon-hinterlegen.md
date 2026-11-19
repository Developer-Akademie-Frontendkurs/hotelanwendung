[← Vorheriger Branch](008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](000_index.md) · [Nächster Branch →](010_2026-11-18_fix-inputs-on-booking-page.md)

# 009 – Branch `favicon-hinterlegen`

**Erster Commit:** 2026-11-11 · **Commits:** 1 · **Status:** gemergt in `main` (PR #6, 2026-11-11)

## Ziel des Branches

Nach zwei Monaten Arbeit an der Buchungsstrecke geht es um den **Feinschliff des Auftritts**. Bisher zeigte der Browser-Tab das Standard-Symbol und Titel wie „Start Seite View" oder „About Seite View" – Arbeitsnamen aus der Zeit, in der der Router entstand (Branch `spa-struktur`). Dieser Branch macht daraus eine erkennbare Marke:

- ein **Favicon** (das kleine Symbol im Browser-Tab und in Lesezeichen),
- einheitliche **Seitentitel** nach dem Muster `Seite | Karawanken Hof`,
- ein **klickbares Logo** im Seitenkopf, das zur Startseite führt.

Damit das Favicon überhaupt ausgeliefert wird, braucht es außerdem eine Zeile in der Vite-Konfiguration: Wegen `root: 'src'` sucht Vite den `public`-Ordner sonst an der falschen Stelle.

## Commits

| Nr.                                                                                        | Datum      | Beschreibung                                                                |
| ------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------- |
| [001](009_2026-11-11_favicon-hinterlegen/001_2026-11-11_add-favicon-update-page-titles.md) | 2026-11-11 | Favicon in `public/`, `publicDir` in Vite, Seitentitel mit Marke, Logo-Link |

Gemergt am 2026-11-11 über **Pull Request #6** (Merge-Commit `cf67390`), zehn Minuten nach dem Commit.

## Zusammenfassung

Ein kleiner Branch mit acht Dateien und 19 neuen Zeilen – aber mit zwei Lektionen, die über das Favicon hinausgehen.

**Erstens: Konfiguration hängt zusammen.** Weil das Projekt `root: 'src'` setzt, rechnet Vite **alle** relativen Pfade ab `src/`. Für `.env` war das schon einmal aufgefallen (`envDir: '..'`, Entscheidung E35), jetzt trifft es den `public`-Ordner: Ohne `publicDir: '../public'` würde Vite in `src/public/` suchen und das Favicon nie finden.

**Zweitens: Ein Link ist nicht automatisch ein Router-Link.** Das Logo im Seitenkopf wird in ein `<a href="/">` gepackt – allerdings **ohne** `data-link`. Der selbstgeschriebene Router fängt aber nur Klicks auf `a[data-link]` ab. Ein Klick aufs Logo lädt die Seite deshalb komplett neu, statt per `pushState` zu wechseln. Funktional landet man trotzdem auf der Startseite, nur eben mit vollem Neuladen. Der Logo-Link im Kopf der Buchungsseite trägt das Attribut übrigens – dort ist es richtig gemacht.

Die Merge-Basis von PR #6 ist identisch mit `main` (`8f61c6b`, ein Tagebuch-Commit direkt auf `main`). Konflikte waren damit ausgeschlossen.

---

[← Vorheriger Branch](008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](000_index.md) · [Nächster Branch →](010_2026-11-18_fix-inputs-on-booking-page.md)
