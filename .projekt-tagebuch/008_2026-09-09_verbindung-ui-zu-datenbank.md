[← Vorheriger Branch](007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](000_index.md)

# 008 – Branch `verbindung-ui-zu-datenbank`

**Erster Commit:** 2026-09-09 · **Commits:** 1 · **Status:** offen

## Ziel des Branches

Der Branch löst die Vertagung aus `V1` auf. Nach `datenbank-anbindung` (Datenbank fertig, Phasen 1–7) und `buchungsseite-ui-fertigstellen` (Oberfläche gebaut, teils angebunden) steht jetzt die Aufgabe an, die dem Branch ihren Namen gibt: **die Buchungsseite vollständig mit der Datenbank verbinden.**

Vollständig heißt hier mehr, als der ursprüngliche Plan vorsah. Beim Erheben des Ist-Standes kamen zehn Lücken zusammen – und drei davon konnte man nicht durch Programmieren schließen, weil ihnen im Schema das Ziel fehlte. Ein Rechnungsadress-Formular ohne Adressspalten in der Datenbank ist keine Aufgabe für das Frontend.

Deshalb beginnt der Branch **wieder** mit einem reinen Doku-Commit – so wie `datenbank-anbindung` mit zwei begonnen hat. Fünf Fragerunden, 30 Fragen, fünf neue Domänenentscheidungen (`E42`–`E46`), zehn neue Vorgehensentscheidungen (`V8`–`V17`) und ein Plan aus vier Phasen und fünf Commits.

Was der Branch nach diesem Plan bauen wird:

| Phase  | Inhalt                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| **7b** | Tabelle `billing_addresses` samt RLS; `create_booking` neu mit Positionen und Rechnungsadresse                      |
| **8**  | `pnpm db:types`, Service-Schicht (`availability`, `booking`, `roomTypes`), `bookingState` als vollständiger Entwurf |
| **9**  | Kalender aus `availability_calendar`, Wählbarkeitsregeln, Horizont-Kappung                                          |
| **9b** | Mengenwähler je Zimmerkarte, echter Checkout, `create_booking`-Aufruf, Bestätigungs-Popup                           |

Vertagt bleibt allein Phase 10 (Cloud-Deployment).

## Commits

| Nr.                                                                                        | Datum      | Beschreibung                                                                     |
| ------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------- |
| [001](008_2026-09-09_verbindung-ui-zu-datenbank/001_2026-09-09_umsetzungsplan-erstellt.md) | 2026-09-09 | Grilling-Runde 8: `E42`–`E46`, `V8`–`V17`, Phasen 7b/8/9/9b (reiner Doku-Commit) |

## Zusammenfassung

Der Branch besteht bislang aus **einem** Commit, und der enthält keine Zeile ausführbaren Code – 469 geänderte Zeilen in drei Markdown-Dateien. Für Lernende ist gerade das der Punkt, an dem sich das Muster dieses Projekts am deutlichsten zeigt.

**Das Muster: erst fragen, dann bauen.** Es ist dasselbe wie in `datenbank-anbindung`, nur diesmal von der anderen Seite. Dort wurde das Schema entworfen, bevor es die Oberfläche gab. Hier wird die Oberfläche befragt, und dabei fallen Widersprüche im Schema auf. Der Commit hält beides fest: die zehn gefundenen Lücken **und** die 30 Fragen, mit denen sie geklärt wurden.

Die Lückentabelle ist deshalb lesenswert, weil sie zeigt, wie viel man findet, wenn man den Ist-Stand systematisch abgeht statt nach Gefühl:

| Lücke                                                                        | Konsequenz                   |
| ---------------------------------------------------------------------------- | ---------------------------- |
| Keine generierten Typen, Client untypisiert                                  | Phase 8                      |
| Keine Service-Schicht – Views rufen `supabase.from`/`.rpc`/`.storage` direkt | Phase 8, `V9`                |
| Kalender kennt `availability_calendar` nicht: `selectable: !isPast`          | Phase 9                      |
| Keine Zimmerauswahl – `room_type_id` landet nirgends                         | war im Plan nicht vorgesehen |
| Checkout ist Figma-Attrappe                                                  | war im Plan nicht vorgesehen |
| `submit()` endet in `console.log`                                            | war im Plan nicht vorgesehen |
| Rechnungsadress-Formular hat **kein Ziel im Schema**                         | neue Tabelle → `E42`         |
| Kalender blättert unbegrenzt vorwärts                                        | `E30`, `V14`                 |
| Gästezahl doppeldeutig: pro Zimmer vs. gesamt                                | `E45`                        |
| Popup verspricht eine Mail, `bookings` kennt kein `pending`                  | `E11` → `E46`                |

**Drei der fünf neuen Domänenentscheidungen korrigieren Annahmen aus den Phasen 1–7.** Der Commit benennt das ausdrücklich als erwartbaren Ertrag und nicht als Makel: _„Erst wer die Maske baut, merkt, welche Felder nirgends hinpassen."_ Das ist eine Aussage über Reihenfolge, nicht über Qualität – und sie ist der Grund, warum man Schemata nicht bis zur Perfektion entwirft, bevor man eine Oberfläche daraufsetzt.

Die inhaltlich weitreichendste Änderung ist `E44`: `create_booking` bekommt statt `p_room_type_id`/`p_rooms` einen Parameter `p_positions jsonb` und kann damit **mehrere Zimmerkategorien in einem Vorgang** buchen. Interessant ist die Begründung, weil sie eine frühere Entscheidung nicht widerlegt, sondern deren **Voraussetzung** entfallen lässt: `E41` hatte Positionen abgelehnt – nicht weil sie unmöglich wären, sondern weil „die Oberfläche sie nicht bedienen kann, also wäre es Ballast (`E15`)". Die Oberfläche kann es jetzt. Damit fällt die Begründung, und der bereits vorbereitete Weg (`booking_groups` + Schleife) wird gegangen.

**Und hier zahlt eine Entscheidung von vor einer Woche zum ersten Mal aus.** `E33` legte den Advisory-Lock in `create_booking` **hotelweit** fest, nicht pro Zimmerkategorie – mit der Begründung, dass Locks pro Kategorie eine garantierte Reihenfolge bräuchten. Mit `E44` wird das konkret: Eine Buchung über zwei Kategorien bräuchte jetzt zwei Locks in fester Reihenfolge, sonst droht eine Verklemmung. Der hotelweite Lock deckt beide Positionen ohne Änderung ab. Genau das ist der Ertrag von Entscheidungen, die man mit Begründung aufschreibt: Man erkennt später, dass sie richtig waren – und warum.

**Zwei Fragen haben eine frühere Antwort derselben Runde umgeworfen** – und der Commit lässt sie sichtbar stehen, mit dem Vermerk „_überholt durch Q26_" bzw. „_ersetzt durch Q27_". Q24 kassierte Q12, Q30 zeigte einen Widerspruch zwischen Q28 und Q9. Der Kommentar dazu ist der Kern der Arbeitsweise: _„Beide Widersprüche wären sonst als Code entstanden und erst beim Debuggen aufgefallen."_ Eine durchgestrichene Antwort in einem Protokoll kostet eine Zeile; derselbe Widerspruch in zwei Migrationen kostet einen Nachmittag.

**Was dieser Branch bewusst auslässt, ist ebenfalls entschieden, nicht vergessen.** `V12` legt fest: **vorerst keine Tests** für die Frontend-Seite. Und zieht die Konsequenz gleich mit: Weil die `E29`-Wählbarkeitsregel und `buildRoomCards()` damit nur über die Oberfläche geprüft sind, werden sie trotzdem als **eigenständige Funktionen** herausgezogen (`V16`) – „es kostet nichts und ist die Voraussetzung dafür, dass die Tests später ohne Umbau nachgezogen werden können". Eine bewusste Lücke mit benanntem Ausweg ist etwas anderes als eine verschwiegene.

Ebenfalls bemerkenswert: Der Plan enthält mehrere **Abschlusskriterien, die als Befehl prüfbar sind** statt als guter Vorsatz. Das schärfste steht in Phase 8:

```bash
grep -rn "from.*services/supabase" src/ --include=*.ts | grep -v "src/shared/services/"
```

Findet dieser Befehl noch etwas, ist die Phase nicht fertig. Der Plan schreibt dazu: _„Diese Zeile ist die Prüfung, nicht der gute Vorsatz."_

Der Branch ist **noch nicht in `main` gemergt** und hat von den fünf geplanten Commits erst den vorbereitenden Doku-Commit. Die vier Umsetzungs-Commits folgen – anders als in den Phasen 1–7 soll jeder von ihnen für sich lauffähig sein (`V17`).

---

[← Vorheriger Branch](007_2026-09-06_buchungsseite-ui-fertigstellen.md) · [📓 Index](000_index.md)
