[← Vorheriger Branch](012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md) · [📓 Index](000_index.md) · [Nächster Branch →](014_2026-11-25_room-slider.md)

# 013 – Branch `feature/calendar-unavailable-days`

**Erster Commit:** 2026-11-18 · **Commits:** 1 · **Status:** gemergt in `main` (PR #9, 2026-11-19)

## Ziel des Branches

Der Kalender der Buchungsseite kennt seit Phase 9 (Branch `verbindung-ui-zu-datenbank`) die Verfügbarkeit jeder Nacht und lässt ausgebuchte Nächte nicht als Anreise zu. **Sichtbar** war der Unterschied aber kaum: Durchgestrichen wurde jeder gesperrte Tag – egal, ob das Hotel voll war, ob der Tag außerhalb des Buchungshorizonts lag oder ob er nach der gewählten Anreise einfach nicht als Abreise passte. Und solange noch keine Gästezahl gewählt war, ließ der Kalender jeden künftigen Tag anklicken, obwohl er noch gar nicht wusste, was frei ist.

Der Branch (Branchname bewusst neu und englisch, siehe Vorgänger [`feat-ausgebuchte-tage-im-callender-anzeigen`](012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md)) schärft das in drei Richtungen:

1. **Nur echte „nicht buchbar"-Tage werden markiert** – mit einem diagonalen Strich über die ganze Zelle statt durchgestrichenem Text.
2. **Gesperrter Kalender**, solange die Zahl der Erwachsenen fehlt oder die Verfügbarkeit noch lädt – mit Hinweistext darüber.
3. **Seed-Buchungen**, damit sich ausgebuchte Tage in der lokalen Datenbank überhaupt nachstellen lassen.

## Commits

| Nr.                                                                                                              | Datum      | Beschreibung                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| [001](013_2026-11-18_calendar-unavailable-days/001_2026-11-18_nicht-buchbare-tage-im-calender-nicht-waehlbar.md) | 2026-11-18 | `unavailable` und `locked` im Kalendermodell, Diagonale per CSS, Hinweis, Seed-Buchungen |

Der Branch zweigt von `e08e20d` ab, dem damaligen Stand von `main`. Auf GitHub wurde er am 2026-11-19 über **Pull Request #9** (Merge-Commit `b9f4c03`) in `main` gemergt. Ins lokale `main` kam der Merge am selben Tag per `git pull`: Weil dort zuvor ein Tagebuch-Commit (`a611925`) entstanden war, erzeugte Git dabei den zusätzlichen Merge-Commit `824cc44` („Merge branch 'main' of …").

## Zusammenfassung

Ein Commit, sechs Dateien, 145 neue Zeilen – davon fast zwei Drittel Tests und Seed-Daten.

**Das Modell entscheidet, die Ansicht zeigt nur an.** Die neue Unterscheidung steckt in der reinen Funktion `buildDays()` in `domain/calendar.ts`: Jede Tageszelle bekommt neben `blocked` (nicht klickbar) das Feld `unavailable` (von der Datenbank abgelehnt). Vergangene Tage und Tage hinter dem Horizont sind zwar `blocked`, aber nicht `unavailable`. Das Template setzt daraus nur noch eine CSS-Klasse. Weil die Regel in einer reinen Funktion steckt, lässt sie sich ohne Browser testen – fünf neue und vier geschärfte Testfälle in `calendar.spec.ts` beschreiben genau, wann gestrichen wird und wann nicht.

**Ein Zustand mehr: „gesperrt".** `CalendarRules` bekommt `locked: boolean`. Die View setzt ihn, solange `getCalendarNotice()` einen Hinweis liefert („Bitte zuerst die Anzahl der Erwachsenen wählen." bzw. „Verfügbarkeit wird geladen …"). So kann niemand mehr einen Zeitraum wählen, bevor feststeht, welche Nächte für diese Gruppe frei sind.

**Testdaten gehören zum Feature.** Ohne Buchungen ist lokal jeder Tag frei, und die neue Darstellung wäre nie zu sehen. Der Seed legt deshalb zwei Buchungen an – relativ zu `current_date`, damit sie nach jedem `pnpm db:reset` in der Zukunft liegen, und über `create_booking`, damit sie genauso entstehen wie die eines echten Gastes.

Auf dem Stand des Commits laufen alle 132 Tests unter `src/views` grün, und `tsc --noEmit` meldet keine Fehler.

---

[← Vorheriger Branch](012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md) · [📓 Index](000_index.md) · [Nächster Branch →](014_2026-11-25_room-slider.md)
