[← Vorheriger Commit](036_2026-10-21_update-project-diary.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# docs(plan): bring implementation plan up to date (F6)

- **Commit:** `98207d0`
- **Datum:** 2026-10-28
- **Autor:** Oliver Jung

## Worum geht es?

Review-Punkt **F6**: „Den Plan pflegen". Der Umsetzungsplan `docs/datenbank/umsetzungsplan.md` wurde am 2026-09-09 (Commit 001) geschrieben. Seitdem sind fünf neue Domänenentscheidungen (`E47`–`E51`), ein komplettes Review und gut dreißig Commits dazugekommen. Der Plan beschrieb also an mehreren Stellen einen Zustand, den es so nie gegeben hat – etwa eine Tabelle `billing_addresses`, die nie migriert wurde.

Ein **reiner Doku-Commit**, aber kein Tagebuch-Commit: Er ändert die **Projektdokumentation**, nach der künftige Sessions arbeiten.

```text
 docs/datenbank/umsetzungsplan.md                   | 123 ++++++++++++++++-----
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |   4 +-
 2 files changed, 98 insertions(+), 29 deletions(-)
```

Die Commit-Message nennt die Regel, nach der gepflegt wurde:

```text
Superseded text is struck through, not deleted.
```

Das ist der Kern dieses Commits und zieht sich durch alle Änderungen: **Überholtes wird durchgestrichen oder mit einem datierten Nachtrag versehen, nicht gelöscht.** Wer den Plan liest, sieht so beides – was geplant war und was daraus wurde.

## Die Änderungen im Detail

### 1. Kopf und Vorgehensentscheidungen: E1–E46 → E1–E51

Datei: `docs/datenbank/umsetzungsplan.md`

Die einfachste Änderung, aber die mit der größten Wirkung: Die Kopiervorlage für den ersten Prompt einer neuen Session nannte noch `E1–E46`. Eine Session, die sich daran hält, hätte die Entscheidungen `E47`–`E51` (Frühstück, Gesamtbelegung, Zusatzleistungen, Adressen) gar nicht erst gelesen.

```diff
-> E1–E46 und die Vorgehensentscheidungen V1–V17; wenn dir etwas widersprüchlich vorkommt, frag
+> E1–E51 und die Vorgehensentscheidungen V1–V17; wenn dir etwas widersprüchlich vorkommt, frag
 > nach, statt zu raten.
```

### 2. V9, V12 und V17 bekommen einen „Stand"

**V9** sah drei Service-Dateien vor (`availability`, `booking`, `roomTypes`). Umgesetzt wurde ein anderer Zuschnitt. Die Regel bleibt, der Weg ändert sich – und die Begründung wird ergänzt:

```diff
-| **V9** | Drei Dateien unter `src/shared/services/`: … | Phase 8.4 verlangt es. … |
+| **V9** | Drei Dateien unter `src/shared/services/`: … **Stand 2026-10-28:** Umgesetzt mit anderem
+  Zuschnitt: `catalog.service.ts` (alle Lesezugriffe der Buchungsseite samt `buildRoomCards`),
+  `booking.service.ts` (`create_booking`) und `posts.service.ts` (Kurs-Spike, E36). Die Regel
+  selbst gilt unverändert. | … Kalender und Zimmerliste lesen dieselben Stammdaten, deshalb ein
+  Katalog-Service statt zweier Dateien, die sich gegenseitig bräuchten. |
```

**V12** („vorerst keine Tests für die Frontend-Seite") ist überholt. Hier sieht man die Durchstreich-Regel in Aktion:

```diff
-| **V12** | **Vorerst keine Tests** für die Frontend-Seite; werden später nachgezogen. …
+| **V12** | ~~**Vorerst keine Tests** für die Frontend-Seite; werden später nachgezogen.~~
+  **Nachgezogen (Stand 2026-10-28):** `pnpm vitest run src` prüft 210 Fälle in 15 Dateien: …
+  Ungetestet bleibt die View selbst (`Booking.ts`, Templates): sie ist nur im Browser geprüft. |
+  … Dass die Tests ohne Umbau nachgezogen werden konnten, ist der Ertrag von V16, letzter Punkt:
+  Die Regeln waren schon eigenständige Funktionen. |
```

Für Lernende ist die neue Begründungsspalte der interessanteste Teil: In Commit 001 hieß es noch, die Regeln würden „trotzdem als eigenständige Funktionen herausgezogen – es kostet nichts und ist die Voraussetzung dafür, dass die Tests später ohne Umbau nachgezogen werden können". Sieben Wochen später kann der Plan festhalten: **Genau so ist es gekommen.** Eine Vorhersage, die man aufgeschrieben hat, lässt sich später überprüfen.

**V17** („Fünf Commits") wird ebenfalls durchgestrichen – mit diesem Commit sind es 37 auf dem Branch.

### 3. Ein Nachtrag „tatsächlicher Schnitt"

Unter der ursprünglichen Commit-Tabelle steht jetzt eine zweite, die Plan und Wirklichkeit nebeneinanderstellt – samt echten Commit-Hashes:

```markdown
> | Plan | Tatsächlich                                                                                                                             | Commit(s)                       |
> | ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
> | 1    | `customer_addresses` statt `billing_addresses` (E50), siehe Phase 7b                                                                    | `04be98d`                       |
> | 2    | in **drei** Schritten: Positionen + Gesamtbelegung (E44, E48), Leistungen je Vorgang (E49), Adressen (E51). …                           | `f959c92`, `5cdbbc9`, `04be98d` |
> | 3    | Service-Schicht und Store in Etappen über das Review (D4–D7), generierte Typen zuletzt (F1, F2)                                         | `d04fce0` … `17a26ff`           |
> | 4    | Kalender aus `availability_calendar`, E29-Regel, Horizont (F3)                                                                          | `8276f2b`                       |
> | 5    | Mengenwähler vorgezogen (`2e05149`), Checkout und Buchen (`2900cdf`, `bb243ce`), Auswahlleiste (F4) und Ablehnungshinweise (F5) zuletzt | `2e05149` … `006ce87`           |
>
> Phase 8 kam damit **nach** 9b statt davor. Das Risiko, das die geplante Reihenfolge vermeiden
> sollte – Oberfläche gegen untypisierte Zugriffe –, hat sich gezeigt: Erst der typisierte Client
> fand `p_services` (readonly) sowie `p_phone`/`p_billing_company` (`null` statt weglassen).
```

Der letzte Absatz ist ehrlich und lehrreich: Der Plan hatte die generierten Typen **bewusst an den Anfang** gestellt. In der Umsetzung kamen sie ans Ende – und prompt traten genau die Fehler auf, vor denen die ursprüngliche Reihenfolge schützen sollte (siehe Commit 032). Die Abweichung wird nicht beschönigt, sondern mit ihrem Preis notiert.

### 4. Phase 7b umgeschrieben

Phase 7b, Commit 1 beschrieb Schritt für Schritt die Tabelle `billing_addresses` mit einer Funktion `billing_address_in_use()` in der RLS-Policy. Beides gibt es nicht: `E50` hat die Tabelle durch `customer_addresses` ersetzt, `E51` die Policy-Sperre durch einen Trigger.

Hier wird ausnahmsweise **ersetzt statt durchgestrichen** – aber mit Hinweis, wo die alte Fassung zu finden ist:

```markdown
> **Umgeschrieben am 2026-10-28.** Ursprünglich stand hier eine Tabelle `billing_addresses` nach E42
> mit einer Funktion `billing_address_in_use()` in der UPDATE-Policy. E50 hat die Tabelle durch
> `customer_addresses` ersetzt (Sitz- **und** Rechnungsadresse), E51 die Policy-Sperre durch einen
> Trigger (auch der Service-Role-Key kann eine benutzte Adresse nicht mehr ändern). Die alte Fassung
> steht in der Git-Historie dieser Datei.
```

Warum hier ersetzen und nicht durchstreichen? Eine 15-zeilige Bauanleitung für eine Tabelle, die nie existiert hat, durchgestrichen stehen zu lassen, hilft niemandem beim Lesen. Die Git-Historie bewahrt sie trotzdem auf – **Git ist das Archiv, das Dokument beschreibt den aktuellen Stand.**

Die neue Fassung beschreibt, was tatsächlich in `20260926101000_customer_addresses.sql` steht – darunter ein Detail, das man sich merken sollte:

```markdown
3. Trigger `guard_customer_address_update` statt `billing_address_in_use()` (E51.3): Sobald eine
   Buchung auf die Adresse zeigt, ist ihr Inhalt unveränderlich, **Archivieren** bleibt erlaubt. Der
   Trigger gilt für jede Rolle, eine Policy hätte der Service-Role-Key umgangen.
```

Row Level Security gilt **nicht** für den Service-Role-Key – der umgeht RLS vollständig. Eine Regel, die wirklich immer gelten soll, gehört deshalb in einen Trigger oder einen `CHECK`, nicht in eine Policy.

### 5. Nachträge an Phase 8, 9 und 9b

Jede Phase bekommt einen datierten Nachtrag „umgesetzt" mit Commit-Hash und den Abweichungen vom Plan. Beispiel Phase 9:

```markdown
> **Nachtrag 2026-10-28 — umgesetzt** in `8276f2b` (Review F3): … Abweichung von Punkt 2:
> `isSelectableAsCheckOut` prüft die **ganze Kette** vom Anreisetag bis zur Vornacht, nicht nur die
> Vornacht — sonst ließe sich ein Zeitraum über eine gesperrte Nacht hinweg wählen. …
```

Phase 9b wird für abgeschlossen erklärt. Die Liste „Bewusst offen nach dieser Phase" verliert dabei einen Punkt – wieder durchgestrichen:

```diff
-**Bewusst offen nach dieser Phase:** keine Tests auf der Frontend-Seite (V12), keine Bestätigungsmail
+**Bewusst offen nach dieser Phase:** ~~keine Tests auf der Frontend-Seite (V12)~~ (inzwischen
+nachgezogen, siehe V12), keine Bestätigungsmail (E46), keine Belegung je Position (E45), keine
+Einwilligung mit Zeitstempel. Alle sind benannt, keine ist versehentlich.
```

### 6. Review-Dokument: F6 abgehakt

Datei: `docs/reviews/2026-09-30_verbindung-ui-zu-datenbank.md`

```diff
-- [ ] F6: **Den Plan pflegen:**
+- [x] F6: **Den Plan pflegen:**
 …
+  Umgesetzt in `docs/datenbank/umsetzungsplan.md`: Kopf und 0b auf E1–E51; V9 mit dem tatsächlichen
+  Zuschnitt (`catalog`/`booking`/`posts`), V12 mit den 210 Frontend-Tests, V17 und ein Nachtrag
+  „tatsächlicher Schnitt" unter dem Commit-Schnitt (Plan gegen Commits). …
```

## Was wurde erreicht?

Der Umsetzungsplan beschreibt wieder den tatsächlichen Stand, ohne seine Geschichte zu verlieren. Eine neue Session, die mit der Kopiervorlage startet, liest jetzt alle 51 Entscheidungen und findet für jede Phase, **ob** und **wie** sie umgesetzt wurde. Damit ist **Gruppe F des Reviews vollständig**; offen bleibt nur Gruppe G (Barrierefreiheit).

Für Lernende: Ein Plan ist kein Vertrag, aber auch kein Wegwerfpapier. Ein Plan, der nach der Umsetzung nicht gepflegt wird, wird zur Falle für jeden, der später danach arbeitet – Mensch oder KI.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](038_2026-10-28_accessibility-form-errors-calendar-live-regions.md)
