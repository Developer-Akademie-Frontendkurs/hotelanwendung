[← Vorheriger Commit](002_2026-09-09_projekttagebuch-aktualisiert.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(booking): update comments for database integration preparation

- **Commit:** `13670ca`
- **Datum:** 2026-09-16
- **Autor:** Oliver Jung

## Worum geht es?

Der kleinste Commit des Branches: elf neue Zeilen, alle in einem Kommentarblock, kein ausführbarer Code.

```text
 src/views/BookingView/Booking.ts | 11 +++++++++++
 1 file changed, 11 insertions(+)
```

Trotzdem lohnt der Blick, denn der Block ist eine **Arbeitsliste**, die in den folgenden Commits Stück für Stück abgearbeitet wird. Wer die Commits 004 bis 012 liest, kann an diesem Block ablesen, wo man gerade steht.

## Die Änderung im Detail

Die Datei `src/views/BookingView/Booking.ts` bekommt direkt unter den Imports einen Kommentar:

```diff
 import { RoomAmenity, RoomAvailability, RoomCard, RoomCardAvailability, RoomTypeDetail, RoomTypeImage } from './room.interface';
 import './booking.css';

+/*
+    *** Vorbereitung und Verknüpfung BookingView zu Datenbank ***
+        TODO: Anzahl der gewünschen Zimmer in jedem Kategorie aufnehmen
+        TODO: Checkbox in Kategorie für mit und ohne Frühstück
+        TODO: Unter Zimmerauswahl neue Section Zusätze (Zustellbestten, Kinderbett)
+        TODO: Buchungssteps verknüpfen
+        TODO: Console Logs json Buchung
+        TODO: Migrations notwending? Eventuelle Änderungen an der Datenbank?
+        TODO: Integration Datenbank Buchungspeichern
+*/
+
 type DayCell = {
```

Sieben Punkte. Verfolgt man, in welchem Commit welche Zeile wieder aus dem Block verschwindet, ergibt sich folgende Zuordnung:

| TODO                                   | aus dem Block entfernt in                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Anzahl Zimmer je Kategorie             | [004 – Mengenwähler](004_2026-09-16_mengenwaehler-je-zimmerkategorie.md)                             |
| Checkbox mit/ohne Frühstück            | [006 – Frühstück](006_2026-09-16_zimmer-anzahl-und-fruehstueck-integriert.md)                        |
| Sektion Zusätze (Kinderbett …)         | [008 – Zusatzleistungen](008_2026-09-23_sektion-zusatzleistungen-je-vorgang.md)                      |
| Console Logs json Buchung              | [009 – Adressen](009_2026-09-26_customer-address-management.md)                                      |
| Integration Datenbank Buchungspeichern | [012 – `create_booking` aus der Oberfläche](012_2026-09-26_booking-creation-modal-confirmation.md)   |
| Buchungssteps verknüpfen               | am Ende des dokumentierten Stands noch offen                                                         |
| Migrations notwendig?                  | steht noch im Block – beantwortet wurde die Frage faktisch mit sieben neuen Migrationen (006–009)     |

## Was wurde erreicht?

Fachlich nichts – organisatorisch einiges. Ein `TODO`-Block direkt im Code ist die leichteste Form eines Plans: Er steht dort, wo man ihn beim Arbeiten sieht, und jeder erledigte Punkt verschwindet mit dem Commit, der ihn erledigt. Im nächsten Commit sieht man das schon im Diff:

```diff
 /*
     *** Vorbereitung und Verknüpfung BookingView zu Datenbank ***
-        TODO: Anzahl der gewünschen Zimmer in jedem Kategorie aufnehmen
         TODO: Checkbox in Kategorie für mit und ohne Frühstück
```

Der Nachteil ist ebenso offensichtlich: `TODO`-Kommentare haben keine Begründung und keine Reihenfolge. Die liefert in diesem Projekt der Umsetzungsplan aus Commit 001 – der Kommentar ist die Kurzfassung für die Datei, die man gerade offen hat.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](004_2026-09-16_mengenwaehler-je-zimmerkategorie.md)
