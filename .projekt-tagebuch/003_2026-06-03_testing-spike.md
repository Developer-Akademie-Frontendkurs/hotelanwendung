[← Vorheriger Branch](002_2026-05-06_spa-struktur.md) · [📓 Index](000_index.md) · [Nächster Branch →](004_2026-06-10_startseite-erstellen.md)

# 003 – Branch `testing-spike`

**Erster Commit:** 2026-06-03 · **Commits:** 2 · **Status:** offen

## Ziel des Branches

Ein **Spike** ist ein zeitlich begrenztes Experiment, um eine Technik auszuprobieren. Hier geht es um **automatisierte Tests** mit **Vitest**. An einem einfachen Beispiel (Mathe-Funktionen `add` und `subtract`) wird das Schema **Arrange – Act – Assert** geübt, ohne die eigentliche Anwendung zu berühren. Der Code liegt bewusst in einem separaten Ordner `src/_testing-spike/`.

## Commits

| Nr. | Datum | Beschreibung |
|-----|-------|--------------|
| [001](003_2026-06-03_testing-spike/001_2026-06-03_math-functions-tests.md) | 2026-06-03 | Mathe-Funktionen und Tests für Addition/Subtraktion |
| [002](003_2026-06-03_testing-spike/002_2026-06-10_fix-subtraction-test-dynamic-values.md) | 2026-06-10 | Subtraktions-Test auf dynamische Werte umstellen |

## Zusammenfassung

Der Branch führt das Test-Framework Vitest praktisch ein. Es entsteht ein `test`-Skript, ein Beispielmodul und eine Test-Datei. Der zweite Commit verbessert die Aussagekraft eines Tests, indem das erwartete Ergebnis berechnet statt fest verdrahtet wird.

---

[← Vorheriger Branch](002_2026-05-06_spa-struktur.md) · [📓 Index](000_index.md) · [Nächster Branch →](004_2026-06-10_startseite-erstellen.md)
