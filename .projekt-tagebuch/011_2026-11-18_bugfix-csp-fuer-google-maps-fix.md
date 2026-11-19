[← Vorheriger Branch](010_2026-11-18_fix-inputs-on-booking-page.md) · [📓 Index](000_index.md) · [Nächster Branch →](012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md)

# 011 – Branch `bugfix--CSP-für-google-maps-fix`

**Erster Commit:** 2026-11-18 · **Commits:** 1 · **Status:** gemergt in `main` (PR #8, 2026-11-18)

## Ziel des Branches

Auf der Startseite gibt es seit Juli den Abschnitt „So finden sie uns" mit einer eingebetteten Google-Maps-Karte (Branch `startseite-erstellen`). Seit Oktober war diese Karte **leer**: Die Content-Security-Policy (CSP), die im Branch `verbindung-ui-zu-datenbank` als Schutz gegen XSS eingeführt wurde, erlaubte keine fremden `<iframe>`-Quellen – und der Browser blockierte die Karte.

Der Branch behebt das mit einer einzigen neuen Direktive: `frame-src https://www.google.com`.

## Commits

| Nr.                                                                                                     | Datum      | Beschreibung                                                   |
| ------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| [001](011_2026-11-18_bugfix-csp-fuer-google-maps-fix/001_2026-11-18_fix-csp-allow-google-maps-frame.md) | 2026-11-18 | `frame-src https://www.google.com` in der CSP von `index.html` |

Gemergt am 2026-11-18 über **Pull Request #8** (Merge-Commit `429e76a`), 23 Sekunden nach dem Commit.

## Zusammenfassung

Eine Zeile, aber ein Lehrstück über Sicherheitsmechanismen mit Nebenwirkungen. Die CSP arbeitet nach dem Prinzip **„alles verboten, was nicht ausdrücklich erlaubt ist"**. Für Rahmen (`<iframe>`) gab es bisher keine eigene Regel, also galt der Rückfallwert `default-src 'self'` – nur Inhalte vom eigenen Origin. Die Google-Karte wurde deshalb von der Einführung der CSP (Commit `076c88f`, 2026-10-07) bis zu diesem Fix sechs Wochen lang blockiert, ohne dass ein Test oder Build-Schritt es bemerkt hätte. Sichtbar war es nur in der Browser-Konsole.

Die Lösung ist so eng wie möglich gefasst: erlaubt wird genau **ein** Origin und nur für **Rahmen**, nicht für Skripte, Bilder oder Netzwerkzugriffe. `CLAUDE.md` beschreibt genau diesen Pflegeschritt: Kommt eine neue externe Quelle dazu, muss sie in der CSP ergänzt werden.

Dass der Branch-Name ein `ü` enthält, ist für Git kein Problem; für Dateinamen in diesem Tagebuch wird es wie in allen Slugs umgeschrieben (`fuer`).

---

[← Vorheriger Branch](010_2026-11-18_fix-inputs-on-booking-page.md) · [📓 Index](000_index.md) · [Nächster Branch →](012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md)
