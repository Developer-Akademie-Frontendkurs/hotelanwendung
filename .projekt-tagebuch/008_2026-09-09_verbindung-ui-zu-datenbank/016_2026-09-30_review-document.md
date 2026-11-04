[← Vorheriger Commit](015_2026-09-26_update-project-diary.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(review): add review document for verbindung-ui-zu-datenbank branch

- **Commit:** `aa69693`
- **Datum:** 2026-09-30
- **Autor:** Oliver Jung

## Worum geht es?

Bevor der Branch nach `main` geht, wird er **reviewt** – und das Ergebnis landet nicht in einem Chatverlauf oder einem PR-Kommentar, sondern als Datei im Repo: `docs/reviews/2026-09-30_verbindung-ui-zu-datenbank.md`. Der Commit enthält keinen Anwendungscode.

```text
 CLAUDE.md                                          |   2 +
 .../2026-09-30_verbindung-ui-zu-datenbank.md       | 146 +++++++++++++++++++++
 2 files changed, 148 insertions(+)
```

Diese Datei ist für den Rest des Branches der **Fahrplan**: Jeder der folgenden Commits (017–023) hakt darin Punkte ab. Wer verstehen will, warum ab hier so viel aufgeräumt statt neu gebaut wird, findet die Antwort in diesem Dokument.

## Die Änderungen im Detail

### 1. Der Kopf: Umfang, Grundlagen, Werkzeuge

```markdown
# Review `verbindung-ui-zu-datenbank` (gegen `main`), 2026-09-30

Umfang: 15 Commits von `e724f6c` bis `813760d`.
Grundlagen: `CLAUDE.md`, `tsconfig.json`, `eslint.config.ts` und `.prettierrc` für die Standards; `docs/datenbank/umsetzungsplan.md` (0c, 7b, 8, 9, 9b) für die Spec.

Tooling:
- `pnpm build` läuft durch.
- `pnpm vitest run src` läuft durch (29 Tests).
- `pnpm lint` schlägt mit 2 Fehlern fehl:
  - `vite.config.ts:3`: `checker` wird nicht benutzt.
  - `.projekt-tagebuch/…006…md:51`: fehlendes Label.
- `pnpm test:db` wurde nicht ausgeführt.
```

Drei Dinge machen diesen Kopf nützlich:

- **Der Umfang ist exakt benannt** (von welchem bis zu welchem Commit). Spätere Commits können sich darauf beziehen, ohne dass unklar ist, welcher Stand gemeint war.
- **Die Maßstäbe sind genannt.** Ein Review ohne Maßstab ist eine Geschmacksfrage. Hier wird gegen zwei Dinge geprüft: die Projektregeln (Konfigurationsdateien, `CLAUDE.md`) und die Spezifikation (Umsetzungsplan).
- **Die Werkzeuge laufen zuerst.** Was Build, Tests und Linter finden, muss kein Mensch suchen. Und was **nicht** geprüft wurde (`pnpm test:db`), steht ausdrücklich da.

### 2. Die Checkliste – geordnet nach Dringlichkeit

Der Hauptteil ist eine Checkliste mit sieben Gruppen. Die Reihenfolge ist begründet: _„zuerst Bugs, dann schnelle Aufräumarbeiten, dann Struktur, dann offene Spec-Punkte. Jeder Punkt ist für sich allein umsetzbar."_

| Gruppe | Thema                                  | Punkte | Beispiel                                                          |
| ------ | -------------------------------------- | ------ | ----------------------------------------------------------------- |
| **A**  | Bugs und Sicherheit                    | 6      | „Der Knopf ‚weiter' im Kalender bucht verbindlich."               |
| **B**  | Schnelle Aufräumarbeiten               | 8      | Lint grün machen, veraltete Kommentare, Magic Strings             |
| **C**  | Typen und Duplikate                    | 5      | `ServiceRow` existiert doppelt und unterschiedlich                |
| **D**  | Trennen von Design, Datenfluss, Logik  | 9      | `catalog.service.ts`, Templates auslagern – `Booking.ts` hat 2073 Zeilen |
| **E**  | Tests                                  | 4      | `address.spec.ts`, Datenbanktests für `E50`/`E51`                 |
| **F**  | Offene Punkte aus dem Umsetzungsplan   | 6      | Phase 8 (`V8`, `V9`), Phase 9 (Kalender an `availability_calendar`) |
| **G**  | Barrierefreiheit                       | 4      | `aria-describedby` statt nur `aria-invalid`                       |

Jeder Punkt folgt demselben Aufbau: **Wo** (Datei und Zeile), **Folge** (was passiert, wenn man es lässt) und **Lösung** (ein konkreter Vorschlag). Ein Beispiel aus Gruppe A:

```markdown
- [ ] **A2: Netzwerkfehler sehen aus wie Ablehnungen, das kann zu Doppelbuchungen führen.**
  - Wo: `booking.service.ts:109`. Dort wird jeder `error` zu `{ ok: false }`.
  - Das widerspricht V15: „Ablehnung als Ergebnis, Infrastrukturfehler werfen“.
  - Lösung: Nur `P0001` mit `DETAIL`-JSON ist eine Ablehnung, alles andere wird geworfen. …
```

Bemerkenswert ist der Bezug auf **`V15`**: Die Entscheidung stand schon im Umsetzungsplan, die Umsetzung in Commit 012 hatte sie aber nur halb eingehalten. Ohne schriftliche Entscheidung hätte der Review hier nur „fühlt sich riskant an" schreiben können.

### 3. Die Zielarchitektur als Skizze

Gruppe D enthält eine Verzeichnisskizze, wohin die Buchungsseite sich entwickeln soll:

```text
src/views/BookingView/
  Booking.ts                  – nur Orchestrierung: afterRender, Events → Aktionen, subscribe → render
  templates/                  – icons.ts, calendar.template.ts, rooms.template.ts, checkout.template.ts
  domain/                     – booking.types.ts, calendar.ts, validation.ts, messages.ts
                                + roomQuantity/services/breakfast/summary/address (wie bisher)
src/shared/
  format.ts                   – formatPrice, formatNights, formatGuests, formatStayDate
  ui/html.ts                  – escapeHtml
  services/catalog.service.ts – fetchRoomTypes, fetchServices, fetchHotel, searchAvailability, buildRoomCards
  state/bookingState.ts       – inkl. guests, Aktionen mit genau einem notify
```

Das Ziel in einem Satz: _„Die View orchestriert nur noch. Templates sind reine Funktionen (Daten rein, String raus), die Fachlogik bleibt rein und getestet, Supabase wird nur noch in `services/` angesprochen."_

### 4. Was gut gelöst ist

Ein Review, das nur Mängel listet, sagt nicht, was man **beibehalten** soll. Deshalb endet die Datei mit einer Positivliste:

```markdown
- Die reine Fachlogik (`roomQuantity`, `services`, `breakfast`, `summary`) ist klein und getestet.
- Die Anfrage-ID schützt vor veralteten Suchantworten.
- Die Sperre `submitting` verhindert Doppelklicks.
- …
- Gästedaten werden per `textContent` eingefügt.
```

### 5. Ein Ausrutscher in `CLAUDE.md`

Außerdem hängt der Commit zwei Zeilen an `CLAUDE.md` an:

```diff
 - Synchrone Methoden ohne `await` im Body, … kein Einzelfall zum Beheben.
+
+<script></script>
```

Ein leeres `<script>`-Tag hat in einer Markdown-Anleitung keine Funktion – offensichtlich ein versehentlich mitcommitteter Rest. Der nächste Commit (017) entfernt ihn wieder. Ein guter Anlass, vor jedem Commit `git diff --staged` durchzusehen: Dateien, an denen man „eigentlich nichts geändert" hat, sind die verdächtigsten.

## Was wurde erreicht?

Der Branch hat jetzt eine **abhakbare Liste** dessen, was vor dem Merge noch zu tun ist – priorisiert, mit Fundstellen und Lösungsvorschlag. Die folgenden sieben Commits arbeiten die Gruppen A, B und C vollständig ab und markieren jeden erledigten Punkt in derselben Datei mit `[x]`. So lässt sich am Review-Dokument selbst ablesen, wie weit die Nacharbeit ist.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](017_2026-09-30_booking-error-handling-ui-flow.md)
