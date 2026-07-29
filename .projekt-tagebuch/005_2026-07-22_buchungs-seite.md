[← Vorheriger Branch](004_2026-06-10_startseite-erstellen.md) · [📓 Index](000_index.md)

# 005 – Branch `buchungs-seite`

**Erster Commit:** 2026-07-22 · **Commits:** 2 · **Status:** offen

## Ziel des Branches

Nachdem die Startseite steht (Branch `startseite-erstellen`), bekommt die Hotelanwendung nun eine **Buchungsseite**. Kern dieses Branches ist ein **interaktiver Kalender**, mit dem Gäste einen An- und Abreisezeitraum auswählen können:

- Neue **`BookingView`** (`/buchung`), die selbst einen Monatskalender rendert – **ohne externe Bibliothek**, nur mit TypeScript, DOM und `Date`.
- Auswahl eines **Zeitraums** (Anreise → Abreise) inkl. optischer Hervorhebung der Tage dazwischen.
- **Monatsnavigation** (vor/zurück), wobei Vergangenheit gesperrt bleibt.
- Erweiterung des **View-Lebenszyklus** um einen `afterRender`-Schritt, damit eine View nach dem Einfügen ins DOM Event-Listener registrieren kann.
- Registrierung der neuen Route im **Router**.
- Anschließender **Feinschliff** der Optik: festes Kalenderraster, hervorgehobene Wochenenden und auswählbare Tage aus den Nachbarmonaten.

## Commits

| Nr.                                                                                           | Datum      | Beschreibung                                                                                |
| --------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| [001](005_2026-07-22_buchungs-seite/001_2026-07-22_add-booking-view-calendar.md)              | 2026-07-22 | Buchungsseite mit interaktivem Kalender und `afterRender`-Lebenszyklus                      |
| [002](005_2026-07-22_buchungs-seite/002_2026-07-29_update-booking-view-weekend-cell-state.md) | 2026-07-29 | Feinschliff des Kalenders: festes 42-Zellen-Raster, Wochenend-Zustand und Nachbarmonat-Tage |

## Zusammenfassung

Der Branch führt die erste **interaktive** Ansicht der Anwendung ein. Während die bisherigen Seiten im Kern statisches HTML ausliefern, muss der Kalender auf Klicks reagieren, seinen Zustand (gewählter Zeitraum, angezeigter Monat) verwalten und sich neu zeichnen. Dafür wird der bestehende View-Lebenszyklus um die Methode `afterRender` ergänzt: Sie wird vom Router aufgerufen, **nachdem** das gerenderte HTML im DOM steht, und ist damit der richtige Ort, um Event-Listener zu setzen. Die neue `BookingView` kapselt die gesamte Kalenderlogik in einer Klasse – vom Aufbau des Tage-Rasters über die Zeitraum-Auswahl bis zur Monatsnavigation – und liefert so ein anschauliches Beispiel dafür, wie man zustandsbehaftete UI mit reinem TypeScript strukturiert.

Der zweite Commit poliert diese Grundlage: Ein **festes 42-Zellen-Raster** sorgt dafür, dass der Kalender beim Monatswechsel nicht mehr springt, **Wochenenden** werden über ein neues `isWeekend`-Flag farblich hervorgehoben, und Tage aus dem Vor-/Folgemonat sind nun ebenfalls auswählbar. Schön zu sehen ist dabei, wie sich eine zustandsbasierte UI erweitern lässt, ohne die bestehende Struktur umzubauen – es kommen lediglich neue Zustände und deren optische Übersetzung hinzu.

Der Branch ist derzeit **noch nicht in `main` gemergt** und damit offen für weitere Commits (z.B. die im Code als `TODO` markierte Backend-Anbindung der Buchungsdaten).

---

[← Vorheriger Branch](004_2026-06-10_startseite-erstellen.md) · [📓 Index](000_index.md)
