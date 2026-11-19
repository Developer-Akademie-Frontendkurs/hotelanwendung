[← Vorheriger Branch](011_2026-11-18_bugfix-csp-fuer-google-maps-fix.md) · [📓 Index](000_index.md) · [Nächster Branch →](013_2026-11-18_calendar-unavailable-days.md)

# 012 – Branch `feat-ausgebuchte-tage-im-callender-anzeigen`

**Erster Commit:** 2026-11-18 · **Commits:** 1 (direkt auf `main`) · **Status:** ohne eigene Commits, zeigt auf `main` (`e08e20d`)

## Ziel des Branches

Dieser Eintrag ist ein **Sonderfall** – und gerade deshalb lehrreich, wenn man Git-Historien liest.

Der Branchname kündigt das nächste Feature an: Ausgebuchte Tage sollen im Kalender der Buchungsseite erkennbar sein. Bevor es losgeht, wird aber aufgeräumt: Die Unit-Tests der Buchungsseite ziehen in einen eigenen Unterordner `tests/`. Dieser Commit (`e08e20d`) entstand allerdings **direkt auf `main`**, nicht auf einem Branch. Erst 21 Minuten danach wurde `feat-ausgebuchte-tage-im-callender-anzeigen` an genau dieser Stelle angelegt – und blieb danach unverändert. Das eigentliche Feature wurde 14 Sekunden später auf einem zweiten, neu benannten Branch umgesetzt: [`feature/calendar-unavailable-days`](013_2026-11-18_calendar-unavailable-days.md).

Wie sich das nachweisen lässt:

```bash
git log main..feat-ausgebuchte-tage-im-callender-anzeigen   # leer – kein eigener Commit
git rev-parse --short main                                  # e08e20d
git rev-parse --short feat-ausgebuchte-tage-im-callender-anzeigen   # e08e20d
git reflog --date=iso main -1
# e08e20d main@{2026-11-18 17:52:54 +0100}: commit: test: create new test folder per view
git reflog --date=iso feat-ausgebuchte-tage-im-callender-anzeigen
# e08e20d …@{2026-11-18 18:14:23 +0100}: branch: Created from HEAD
```

Der Reflog ist das lokale Protokoll, wann welcher Zeiger wohin gesetzt wurde. Er zeigt eindeutig: zuerst der Commit auf `main`, dann der Branch. Damit der Commit in diesem Tagebuch nicht verloren geht, wird er hier dem Branch zugeordnet, auf dessen Spitze er steht.

## Commits

| Nr.                                                                                                             | Datum      | Beschreibung                                                              |
| --------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| [001](012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen/001_2026-11-18_create-test-folder-per-view.md) | 2026-11-18 | Sechs Spec-Dateien der Buchungsseite nach `BookingView/tests/` verschoben |

Kein Merge-Commit, kein Pull Request: Der Commit liegt bereits auf `main`.

## Zusammenfassung

Inhaltlich ist der Commit eine reine **Umstrukturierung**: sechs Testdateien umbenannt, in jeder nur die relativen Importpfade um eine Ebene angepasst. Keine Testlogik ändert sich, Vitest findet die Dateien über sein Standardmuster `**/*.spec.ts` weiterhin.

Für die Git-Praxis zeigt der Eintrag zwei Dinge:

- **Ein Branch ist nur ein Zeiger.** `git branch <name>` legt keinen Commit an, sondern nur ein Etikett auf den aktuellen Commit. Solange darauf nichts committet wird, ist der Branch von `main` nicht zu unterscheiden.
- **Direkte Commits auf `main` umgehen den Pull Request.** Bei einer reinen Ordnerumstellung von Tests ist das Risiko klein. Gewöhnt man sich daran, entfällt aber genau die Stelle, an der sonst jemand (oder eine CI) draufschaut. Viele Teams schützen `main` deshalb auf GitHub mit einer _Branch Protection Rule_.

---

[← Vorheriger Branch](011_2026-11-18_bugfix-csp-fuer-google-maps-fix.md) · [📓 Index](000_index.md) · [Nächster Branch →](013_2026-11-18_calendar-unavailable-days.md)
