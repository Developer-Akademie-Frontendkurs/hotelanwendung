[← Vorheriger Commit](../011_2026-11-18_bugfix-csp-fuer-google-maps-fix/001_2026-11-18_fix-csp-allow-google-maps-frame.md) · [↑ Branch-Übersicht](../012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md) · [📓 Index](../000_index.md)

# test: create new test folder per view

- **Commit:** `e08e20d`
- **Datum:** 2026-11-18
- **Autor:** Oliver Jung

> **Hinweis:** Dieser Commit wurde direkt auf `main` erstellt. Der Branch `feat-ausgebuchte-tage-im-callender-anzeigen` wurde erst danach an dieser Stelle angelegt (Details in der [Branch-Übersicht](../012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md)).

## Worum geht es?

Die Unit-Tests der Buchungsseite lagen bisher direkt neben dem Code, den sie testen. Dieser Commit verschiebt sie in einen eigenen Unterordner `tests/`.

```text
 src/views/BookingView/{ => tests}/address.spec.ts      | 4 ++--
 src/views/BookingView/{ => tests}/breakfast.spec.ts    | 2 +-
 src/views/BookingView/{ => tests}/messages.spec.ts     | 4 ++--
 src/views/BookingView/{ => tests}/roomQuantity.spec.ts | 4 ++--
 src/views/BookingView/{ => tests}/services.spec.ts     | 4 ++--
 src/views/BookingView/{ => tests}/summary.spec.ts      | 8 ++++----
 6 files changed, 13 insertions(+), 13 deletions(-)
```

Die Schreibweise `{ => tests}` ist Gits Kurzform für eine Umbenennung: Der Pfad vor und nach dem Pfeil wird in den geschweiften Klammern zusammengefasst. `src/views/BookingView/address.spec.ts` heißt jetzt `src/views/BookingView/tests/address.spec.ts`.

## Vorher und nachher

```text
src/views/BookingView/                 src/views/BookingView/
├── Booking.ts                         ├── Booking.ts
├── booking.css                        ├── booking.css
├── address.ts                         ├── address.ts
├── address.spec.ts          ──┐       ├── breakfast.ts
├── breakfast.ts               │       ├── messages.ts
├── breakfast.spec.ts        ──┤       ├── roomQuantity.ts
├── messages.ts                │       ├── services.ts
├── messages.spec.ts         ──┤       ├── summary.ts
├── roomQuantity.ts            │       ├── tests/
├── roomQuantity.spec.ts     ──┼──►    │   ├── address.spec.ts
├── services.ts                │       │   ├── breakfast.spec.ts
├── services.spec.ts         ──┤       │   ├── messages.spec.ts
├── summary.ts                 │       │   ├── roomQuantity.spec.ts
├── summary.spec.ts          ──┘       │   ├── services.spec.ts
├── domain/                            │   └── summary.spec.ts
│   ├── calendar.ts / .spec.ts         ├── domain/
│   ├── draft.ts / .spec.ts            │   ├── calendar.ts / .spec.ts   (unverändert)
│   └── validation.ts / .spec.ts       │   ├── draft.ts / .spec.ts      (unverändert)
└── templates/                         │   └── validation.ts / .spec.ts (unverändert)
                                       └── templates/
```

Der Ordner der Buchungsseite enthielt vorher 14 Dateien auf oberster Ebene, sechs davon Tests. Jetzt sieht man auf einen Blick den Code; die Tests liegen gebündelt daneben.

## Die Änderungen im Detail

### 1. Git erkennt Umbenennungen an der Ähnlichkeit

Git speichert keine „Umbenennung", sondern nur: Datei A ist weg, Datei B ist neu. Beim Anzeigen vergleicht es den Inhalt und meldet eine Umbenennung, wenn beide sich ausreichend ähneln (standardmäßig mindestens 50 %):

```diff
diff --git a/src/views/BookingView/address.spec.ts b/src/views/BookingView/tests/address.spec.ts
similarity index 97%
rename from src/views/BookingView/address.spec.ts
rename to src/views/BookingView/tests/address.spec.ts
```

97 % Ähnlichkeit: Nur die Importzeilen haben sich verändert. Das ist auch der Grund, warum man beim Verschieben von Dateien **Umbenennung und inhaltliche Änderungen in getrennten Commits** halten sollte – sonst sinkt die Ähnlichkeit, und `git log --follow` verliert die Historie der Datei.

### 2. Relative Importe eine Ebene höher

Weil jede Testdatei jetzt einen Ordner tiefer liegt, muss jeder relative Import ein `../` mehr bekommen. Zwei Arten von Importen sind betroffen.

**Importe des getesteten Moduls** – vorher Nachbar, jetzt eine Ebene höher:

Datei: `src/views/BookingView/tests/breakfast.spec.ts`

```diff
 import { describe, expect, it } from 'vitest';
-import { buildBreakfastService, getBreakfastAmountCents } from './breakfast';
+import { buildBreakfastService, getBreakfastAmountCents } from '../breakfast';
```

**Importe aus `src/shared/`** – vorher zwei, jetzt drei Ebenen nach oben:

Datei: `src/views/BookingView/tests/address.spec.ts`

```diff
 import { describe, expect, it } from 'vitest';
-import type { BillingAddress, CustomerDetails } from '../../shared/types/booking.types';
-import { emptyToNull, formatAddressLines, getCountryLabel, getFieldErrorText, getInvalidFields, isCountryCode } from './address';
+import type { BillingAddress, CustomerDetails } from '../../../shared/types/booking.types';
+import { emptyToNull, formatAddressLines, getCountryLabel, getFieldErrorText, getInvalidFields, isCountryCode } from '../address';
```

Der Pfad zählt sich von der Datei aus nach oben: `tests/` → `BookingView/` → `views/` → `src/`, dann hinein in `shared/`.

Am meisten Zeilen ändert `summary.spec.ts`, weil sie Typen und Werte aus drei Nachbarmodulen braucht:

```diff
 import { describe, expect, it } from 'vitest';
-import type { BreakfastService } from './breakfast';
-import type { RoomCard } from '../../shared/types/catalog.types';
-import { BREAKFAST, type ExtraService } from './services';
-import { buildOrderLines, formatSelectionSummary, getOrderTotalCents, type OrderInput } from './summary';
+import type { BreakfastService } from '../breakfast';
+import type { RoomCard } from '../../../shared/types/catalog.types';
+import { BREAKFAST, type ExtraService } from '../services';
+import { buildOrderLines, formatSelectionSummary, getOrderTotalCents, type OrderInput } from '../summary';
```

`messages.spec.ts`, `roomQuantity.spec.ts` und `services.spec.ts` folgen exakt demselben Muster.

> **Merksatz:** Lange `../../../`-Ketten sind ein Hinweis darauf, dass ein **Pfad-Alias** (z. B. `@shared/…` über `paths` in `tsconfig.json` und `resolve.alias` in Vite) die Importe stabiler machen würde. Mit Alias hätten sich die `shared`-Importe beim Verschieben gar nicht geändert.

### 3. Vitest findet die Tests weiterhin

Das Projekt hat keine eigene `vitest.config.ts`. Vitest sucht deshalb mit seinem Standardmuster nach `**/*.{test,spec}.?(c|m)[jt]s?(x)` – egal, in welchem Unterordner. Für das Verschieben ist keine Konfigurationsänderung nötig.

## Was noch nicht einheitlich ist

Der Commit-Titel spricht von „test folder per view". Umgesetzt ist es bisher für die oberste Ebene von `BookingView`. Die Tests unter `BookingView/domain/` (`calendar.spec.ts`, `draft.spec.ts`, `validation.spec.ts`) liegen weiterhin neben ihrem Code, ebenso die Tests unter `src/shared/` (`format.spec.ts`, `booking.service.spec.ts` …). Im Projekt gibt es damit jetzt **beide** Konventionen nebeneinander:

| Konvention                        | Vorteil                                                      | Nachteil                                                    |
| --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Test neben dem Code (_colocated_) | kurze Importe (`./address`), fehlender Test fällt sofort auf | Ordner werden voll                                          |
| eigener `tests/`-Ordner           | Code-Ordner bleibt übersichtlich                             | längere Importe, Test und Code driften leichter auseinander |

Beides ist verbreitet. Wichtig ist, sich im Projekt auf **eine** zu einigen.

## Was wurde erreicht?

Die sechs Testdateien der Buchungsseite liegen gebündelt in `src/views/BookingView/tests/`, alle Importe zeigen auf die richtigen Module, und die Testsuite läuft ohne Konfigurationsänderung weiter. Der Commit ist zugleich die Ausgangsbasis für das Kalender-Feature im nächsten Branch.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen.md) · [Nächster Commit →](../013_2026-11-18_calendar-unavailable-days/001_2026-11-18_nicht-buchbare-tage-im-calender-nicht-waehlbar.md)
