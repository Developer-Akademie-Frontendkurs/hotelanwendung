[← Vorheriger Commit](011_2026-07-14_find-us-component-project-diary.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# feat: update project diary - add "find us" section with Google Maps

- **Commit:** `edd24d8`
- **Datum:** 2026-07-14
- **Autor:** Oliver Jung

## Worum geht es?

Dieser Commit ist ein reiner **Dokumentations-Commit**: Er verändert **keinen** Anwendungscode, sondern pflegt das **Projekttagebuch** unter `.projekt-tagebuch/` nach. Konkret wird der zuvor hinzugefügte „So finden Sie uns"-Bereich (siehe [Commit 011](011_2026-07-14_find-us-component-project-diary.md)) im Tagebuch dokumentiert.

Für Lernende ist das ein weiteres Beispiel dafür, dass **Dokumentation getrennt vom Code versioniert** wird: Erst kommt der Feature-Commit, danach ein eigener Commit, der die Doku nachzieht.

## Die Änderungen im Detail

Es wurden ausschließlich Markdown-Dateien im Verzeichnis `.projekt-tagebuch/` bearbeitet:

```text
 .projekt-tagebuch/000_index.md                                      |  2 +-
 .../004_2026-06-10_startseite-erstellen.md                          |  7 ++-
 .../010_2026-07-14_update-typography-layout-room.md                 |  4 +-
 .../011_2026-07-14_find-us-component-project-diary.md               | 66 +++++++++
 4 files changed, 73 insertions(+), 6 deletions(-)
```

Inhaltlich bedeutet das:

- Die **Index-Datei** (`000_index.md`) wurde angepasst (Commit-Zahl des Branches).
- Die **Branch-Hauptdatei** von `startseite-erstellen` erhielt einen Eintrag für den neuen Commit.
- Die zuvor angelegte, noch leere **Commit-Detaildatei 011** (`find-us-component-project-diary`) wurde mit didaktischer Erklärung und Code-Blöcken gefüllt.

## Was wurde erreicht?

Das Projekttagebuch ist nach diesem Commit wieder auf dem Stand des Codes. Wer nur die Programmänderungen nachvollziehen will, kann Doku-Commits wie diesen überspringen.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](013_2026-07-15_enhance-footer-contact-social.md)
