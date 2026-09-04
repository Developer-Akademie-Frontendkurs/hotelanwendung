[← Vorheriger Branch](004_2026-06-10_startseite-erstellen.md) · [📓 Index](000_index.md) · [Nächster Branch →](006_2026-08-26_datenbank-anbindung.md)

# 005 – Branch `buchungs-seite`

**Erster Commit:** 2026-07-22 · **Commits:** 9 · **Status:** gemergt in `main`

## Ziel des Branches

Nachdem die Startseite steht (Branch `startseite-erstellen`), bekommt die Hotelanwendung nun eine **Buchungsseite**. Kern dieses Branches ist ein **interaktiver Kalender**, mit dem Gäste einen An- und Abreisezeitraum auswählen können – und darauf aufbauend eine **Buchungsstrecke** mit eigenem Header und Fortschrittsanzeige:

- Neue **`BookingView`** (`/buchung`), die selbst einen Monatskalender rendert – **ohne externe Bibliothek**, nur mit TypeScript, DOM und `Date`.
- Auswahl eines **Zeitraums** (Anreise → Abreise) inkl. optischer Hervorhebung der Tage dazwischen.
- **Monatsnavigation** (vor/zurück), wobei Vergangenheit gesperrt bleibt.
- Erweiterung des **View-Lebenszyklus** um einen `afterRender`-Schritt, damit eine View nach dem Einfügen ins DOM Event-Listener registrieren kann.
- Registrierung der neuen Route im **Router**.
- Anschließender **Feinschliff** der Optik: festes Kalenderraster, hervorgehobene Wochenenden und auswählbare Tage aus den Nachbarmonaten.
- Herauslösen des **Headers** aus dem Layout in eine eigene, **konfigurierbare Komponente** (`MainHeader`) – jede Route bringt ihren Header selbst mit.
- Einführung eines **geteilten Zustands** (`bookingState`) samt **Observer-Muster**, damit Kalender und Header dieselben Daten nutzen, ohne einander zu kennen.
- Ergänzung des Lebenszyklus um ein **Aufräumen** (`destroy`) beim Seitenwechsel.

## Commits

| Nr.                                                                                           | Datum      | Beschreibung                                                                                      |
| --------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| [001](005_2026-07-22_buchungs-seite/001_2026-07-22_add-booking-view-calendar.md)              | 2026-07-22 | Buchungsseite mit interaktivem Kalender und `afterRender`-Lebenszyklus                            |
| [002](005_2026-07-22_buchungs-seite/002_2026-07-22_new-project-diary-entry.md)                | 2026-07-22 | Projekttagebuch für den neuen Branch anlegen (reiner Doku-Commit)                                 |
| [003](005_2026-07-22_buchungs-seite/003_2026-07-29_update-booking-view-weekend-cell-state.md) | 2026-07-29 | Feinschliff des Kalenders: festes 42-Zellen-Raster, Wochenend-Zustand und Nachbarmonat-Tage       |
| [004](005_2026-07-22_buchungs-seite/004_2026-07-29_update-project-diary-booking-view.md)      | 2026-07-29 | Projekttagebuch nachziehen (reiner Doku-Commit)                                                   |
| [005](005_2026-07-22_buchungs-seite/005_2026-08-05_add-header-configurations.md)              | 2026-08-05 | Header als konfigurierbare Komponente: `MainHeader`, `HeaderConfig` und Header pro Route          |
| [006](005_2026-07-22_buchungs-seite/006_2026-08-05_add-booking-header-to-routing.md)          | 2026-08-05 | Eigener Buchungs-Header für die Route `/buchung`                                                  |
| [007](005_2026-07-22_buchungs-seite/007_2026-08-08_booking-state-management-step-tracking.md) | 2026-08-08 | Geteilter Buchungszustand mit Abo-Mechanismus und live aktualisierte Schritt-Anzeige              |
| [008](005_2026-07-22_buchungs-seite/008_2026-08-08_update-project-diary-booking-page.md)      | 2026-08-08 | Projekttagebuch nachziehen: Header und Buchungszustand (reiner Doku-Commit)                       |
| [009](005_2026-07-22_buchungs-seite/009_2026-08-26_projekttagebuch-aktualisiert.md)           | 2026-08-26 | Tagebuch vervollständigen: Doku-Commits nachdokumentiert, Nummern verschoben (reiner Doku-Commit) |

## Zusammenfassung

Der Branch führt die erste **interaktive** Ansicht der Anwendung ein. Während die bisherigen Seiten im Kern statisches HTML ausliefern, muss der Kalender auf Klicks reagieren, seinen Zustand (gewählter Zeitraum, angezeigter Monat) verwalten und sich neu zeichnen. Dafür wird der bestehende View-Lebenszyklus um die Methode `afterRender` ergänzt: Sie wird vom Router aufgerufen, **nachdem** das gerenderte HTML im DOM steht, und ist damit der richtige Ort, um Event-Listener zu setzen. Die neue `BookingView` kapselt die gesamte Kalenderlogik in einer Klasse – vom Aufbau des Tage-Rasters über die Zeitraum-Auswahl bis zur Monatsnavigation – und liefert so ein anschauliches Beispiel dafür, wie man zustandsbehaftete UI mit reinem TypeScript strukturiert.

Commit 003 poliert diese Grundlage: Ein **festes 42-Zellen-Raster** sorgt dafür, dass der Kalender beim Monatswechsel nicht mehr springt, **Wochenenden** werden über ein neues `isWeekend`-Flag farblich hervorgehoben, und Tage aus dem Vor-/Folgemonat sind nun ebenfalls auswählbar. Schön zu sehen ist dabei, wie sich eine zustandsbasierte UI erweitern lässt, ohne die bestehende Struktur umzubauen – es kommen lediglich neue Zustände und deren optische Übersetzung hinzu.

Ab Commit 005 verschiebt sich der Fokus vom Kalender auf die **Struktur der Anwendung**. Der Header steckte bis dahin fest verdrahtet im `MainLayout` – auf jeder Seite stand also „Luxus in den Alpen". Er wird nun herausgelöst und über eine **Konfiguration** gesteuert: Der Typ `HeaderConfig` beschreibt als **Discriminated Union**, was ein Header anzeigen soll, die neue Klasse `MainHeader` übersetzt das in HTML, und jede Route bringt ihren Header über ein optionales Feld selbst mit. Commit 006 nutzt das dann in nur sieben Zeilen für die Buchungsseite – ein gutes Beispiel dafür, dass sich eine tragfähige Struktur daran erkennen lässt, wie billig neue Varianten werden.

Commit 007 löst schließlich ein Problem, das mit der reinen View-Struktur nicht mehr zu lösen war: Der **Kalender** kennt den gewählten Zeitraum, der **Header** soll ihn in seiner Schritt-Anzeige spiegeln – aber beide liegen an völlig verschiedenen Stellen im Aufbau. Die Antwort ist ein **geteilter Zustand** unter `src/shared/state/`, der die Daten außerhalb beider Views hält und über ein **Abo (`subscribe`/`notify`, Observer-Muster)** über Änderungen informiert. Damit reagiert die Fortschrittsanzeige live auf jeden Klick im Kalender, ohne dass Header und View voneinander wissen. Als notwendige Ergänzung bekommt der Lebenszyklus ein **Aufräumen** (`destroy`): Der Router meldet den alten Header beim Seitenwechsel ab, damit keine verwaisten Listener zurückbleiben.

Zwischen und nach den Code-Commits liegen vier reine **Doku-Commits** (002, 004, 008 und 009), die das Projekttagebuch jeweils an den erreichten Code-Stand nachziehen. Sie sind bewusst mitdokumentiert: Zum einen gehören sie zur Historie des Branches, zum anderen zeigen sie ein Arbeitsmuster, das sich lohnt – **erst das Feature bauen, dann in einem eigenen Commit die Doku nachziehen**. So bleiben Code-Diffs frei von Markdown-Rauschen und umgekehrt.

Commit 009 ist dabei ein Sonderfall: Er dokumentiert die Doku-Commits selbst nach und verschiebt dafür die laufenden Nummern der bestehenden Einträge (aus `003` wird `005`, aus `004` wird `006`, aus `005` wird `007`). Das ist der Preis einer strikt chronologischen Nummerierung – und für ein Lerntagebuch der richtige Preis, weil die Reihenfolge hier der eigentliche Inhalt ist.

Der Branch wurde am 2026-08-26 über **Pull Request #3** (Merge-Commit `19ff5ef`, Titel „Buchungs Seite Kalender") in `main` gemergt und ist damit abgeschlossen. Die im Code als `TODO` markierte Backend-Anbindung der Buchungsdaten wandert in den nächsten Branch: [`datenbank-anbindung`](006_2026-08-26_datenbank-anbindung.md) baut das Datenbankschema, auf dem eine echte Buchung überhaupt erst möglich wird. Die Schritte 2 und 3 der Buchungsstrecke („Zimmer & Gäste", „Bestätigung") stehen weiterhin offen.

---

[← Vorheriger Branch](004_2026-06-10_startseite-erstellen.md) · [📓 Index](000_index.md) · [Nächster Branch →](006_2026-08-26_datenbank-anbindung.md)
