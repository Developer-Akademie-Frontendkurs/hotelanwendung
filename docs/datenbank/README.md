# Datenbank-Schema Hotelanwendung — Entscheidungsprotokoll

> **Status:** Entscheidungsbaum vollständig (E1–E31), am 2026-08-17 freigegeben
> **Stand:** 2026-08-17
>
> **Dokumente in diesem Ordner:**
>
> - `README.md` (hier) — **warum** es so aussieht: Verlauf, Prompts, Entscheidungen, Begründungen
> - [`schema.md`](./schema.md) — **was** gebaut wird: ERD, Tabellen, Funktionen, RLS. Normativ.
> - [`umsetzungsplan.md`](./umsetzungsplan.md) — **wie** es gebaut wird: Phasen 1–10 für eine
>   spätere Session
> - `schema-uebersicht.html` — Quelle der Artifact-Seite (Ableitung, nicht normativ)
>
> **Ableitungen (E9), beide nicht normativ:**
>
> - Artifact-Seite: https://claude.ai/code/artifact/fa7408b2-1386-48d8-941e-6b2dbdb061f1
> - FigJam-Board: https://www.figma.com/board/q0zJHQCd90iaKyWZt2TiqE
>   (farblich getrennt: **blau** Stammdaten · **ocker** Preise · **petrol** Buchungsvorgang ·
>   **grau** Fremdsystem `auth.users`)
>   **Zweck:** Grundlage für den Call. Hier steht **was** entschieden wurde, **warum**, und **was
>   bewusst verworfen** wurde — inklusive der Original-Prompts, damit die Herleitung nachvollziehbar
>   bleibt und wir im Call nicht bei Null anfangen.

---

## 1. Methode

Das Schema wird nicht "hingeschrieben", sondern als **Entscheidungsbaum** erarbeitet
(`/grill-me`-Session). Jede Entscheidung hängt an Vorentscheidungen. Gearbeitet wird in **Runden**:
pro Runde werden nur die Fragen gestellt, deren Voraussetzungen bereits geklärt sind. Fragen, deren
Antwort von einer noch offenen Frage abhängt, kommen bewusst **später** — sonst rät man.

Das ist der eigentliche Lerneffekt: **Datenmodellierung ist eine Kette von Trade-offs, nicht eine
Liste von Tabellen.**

---

## 2. Ausgangslage (Ist-Zustand des Projekts)

Erhoben am 2026-08-17 aus dem Repo:

| Aspekt        | Befund                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Frontend      | Vanilla TypeScript SPA, Vite, Tailwind 4, **kein** Framework                            |
| Routing       | eigener Router (`src/router/router.ts`), Views erben von `src/views/AbstractView.ts`    |
| Datenzugriff  | `src/shared/services/supabase.ts` — Browser spricht **direkt** mit Supabase             |
| Auth          | keine                                                                                   |
| Schema        | eine Tabelle `posts` (Spike), **keine** `supabase/migrations/`, kein Supabase-CLI-Setup |
| Admin         | `src/views/LayoutViews/AdminLayout.ts` existiert als Hülle                              |
| Doku-Workflow | `.projekt-tagebuch/` (committet), `.tutorials/` (lokal, gitignored)                     |

**Konsequenz für die Modellierung:** Es gibt **kein Backend**. Jede Geschäftsregel, die verlässlich
gelten muss, muss deshalb in der Datenbank liegen — nicht im TypeScript-Code, den jeder Client
umgehen kann. Dieser Satz ist der roteste Faden im ganzen Dokument.

---

## 3. Original-Prompts (verbatim)

Absichtlich unverändert übernommen, inkl. Tippweise — im Call ist die Formulierung der Frage
oft aufschlussreicher als die Antwort.

### Runde 0 — Auftrag

> ich moechte fuer die Anwendung ein erstes Datenbank Schema erstellen. Kannst du dies visualisieren?
>
> - das Hotel hat Zimmerkategorien
> - das Hotel hat Zimmer, jedes Zimmer gehoert zu einer bestimmten Zimmerkategorie
> - das Hotel hat Buchungen
> - wir muessen die Verfuegbarkeit der Zimmer ermitteln und beruecksichtigen
> - wir haben Kunden, die Buchungen vornehmen
> - zimmer koennen ggf. unterschiedliche Preise zu unterschiedlichen Zeiten haben.
> - als Datenbank dient supabase
> - spaeter soll es Kundenkonten geben, in dem die Kunden ihre Buchungen sehen und verwalten koennen
> - ebenfalls spaeter soll es Mitarbeiter mit verschiedenen Berechtigungen geben, die ueber eine
>   Adminumgebungen Buchungen verwalten usw. koennen
>
> Wie kann ich an die Sache herangehen? Es muss so gestaltet werden, dass die Datenbank erweiterbar ist
>
> Ebenfalls sollen die Grundsatze guter software architektur beruecksichtigt werden

### Runde 1 — Antworten auf die Wurzelfragen

> zu 1, a
> zu 2, vorerst wird es nur ein Hotel geben, eine Erweiterung auf mehrere Hotels ist denkbar und soll
> moglichst einfach zu implementieren sein
> zu 3, a
> zu 4, a
> zu 5, wie vorgeschlagen
> zu 6, b, wie vorgeschlagen, geht das ueber Realtime Database oder subscription?
> zu 7, a wie vorgeschlagen
> zu 8, wie vorgeschlagen
> zu 9, a, b, und c das Besprechen von Design und entscheidungen ist dann wesentlich einfacher
>
> Bitte erstelle auch eine Art Readme, die den Verlauf unserer Konversation festhaelt und Entscheidungen
> begruendet, besonders meine Propts sind wichtig, so dass wir im Call moeglichst zu den gleichen
> Ergebnissen kommen

### Runde 2 — Antworten auf die Folgefragen

> zu 10, wie von dir vorgeschlagen
> zu 11, wie von dir vorgeschlagen
> zu 12, wie von dir vorgeschlagen
> zu 13, wie von dir vorgeschlagen
> zu 14, wie von dir vorgeschlagen
> zu 15, 1,2 und 7
> zu 16, wie von dir vorgeschlagen

### Runde 3 — Antworten

> zu 17, wie von dir vorgeschlagen
> zu 18, wie von dir vorgeschlagen
> zu 19, wie von dir vorgeschlagen
> zu 20, wie von dir vorgeschlagen
> zu 21, wie von dir vorgeschlagen
> zu 22, wie von dir vorgeschlagen
> zu 23, wie von dir vorgeschlagen

### Runde 4 — Antworten (Q24 revidiert die Empfehlung)

> zu 24, Buchungsversuche sollen gar nicht moeglich sein. Wenn an einem Tag keine Buchung mehr
> moeglich ist, soll das Dutam im Kalender durchgestrichen sein, und eine Fehlermeldung als tooltip
> erscheinen, an welchem Tag keine Buchung moeglich ist.
> zu 25, b, wie von dir vorgeschlagen
> zu 26, wie von dir vorgeschlagen
> zu 27, wie von dir vorgeschlagen

### Runde 5 — Antworten

> zu 28, wie von dir vorgechlagen, der Kunde soll nur sehen, und den Grundbekommen Buchung nicht
> moeglich
> zu 29, wie von dir vorgeschlagen
> zu 30, wie von dir vorgeschlagen
> zu 31, wie von dir vorgeschlagen

---

## 4. Entschieden (Runde 1)

### E1 — Ergebnis dieser Session: nur Dokument, kein SQL

**Entscheidung:** Diagramm + begründetes Dokument. Noch **keine** Migrationsdateien, noch **kein**
Anwenden auf die Supabase-Instanz.

**Begründung:** Erst Modell verstehen, dann Code. Ein Schema, das man geschrieben hat, bevor man die
Trade-offs benannt hat, wird nicht mehr hinterfragt — es wird zur Legacy, sobald es läuft.

**Wichtig — kein Widerspruch zu E7:** E1 betrifft _diese_ Session, E7 den _Umsetzungsweg_. Sobald das
Modell steht, entsteht es als Migration im Repo, nicht als Klickerei im Dashboard.

### E2 — Ein Hotel, aber die Multi-Hotel-Tür bleibt billig

**Entscheidung (User-Formulierung maßgeblich):** "vorerst wird es nur ein Hotel geben, eine
Erweiterung auf mehrere Hotels ist denkbar und soll möglichst einfach zu implementieren sein."

**Begründung:** Vorauseilende Mandantenfähigkeit (`hotel_id` in jeder Tabelle, in jedem Join, in jeder
RLS-Policy) kostet ab heute — und zwar bei _jeder_ Abfrage. Nachträglich einzuziehen ist eine
mechanische Migration: Spalte hinzufügen, Backfill, `NOT NULL`, Constraints.

**Verworfen:** volle Mandantenfähigkeit ab Tag 1 (YAGNI, teuer im Alltag).

**Offen → Runde 2 (Q14):** _Wie_ genau macht man die Erweiterung billig? Kandidat ist eine
`hotels`-Tabelle mit genau einer Zeile, die sich schon heute selbst rechtfertigt, weil das Hotel
ohnehin Daten hat (Name, Adresse, Kontakt, Check-in-Zeiten, Zeitzone) und diese Daten sonst als
Konstanten im Frontend landen.

### E3 — Gebucht wird die **Kategorie**, nicht das Zimmer

**Entscheidung:** Eine Buchung zeigt auf eine Zimmerkategorie (`room_type_id`). Das physische Zimmer
wird optional zugewiesen (`room_id` nullable), typischerweise beim Check-in.

**Begründung:** Das ist das echte Domänenmodell — Hotels verkaufen "Doppelzimmer Premium", nicht
"Zimmer 214". Es hält den Betrieb flexibel (umziehen, tauschen, spät zuweisen).

**Preis der Entscheidung — offen benannt:** Damit kann Postgres Doppelbuchung **nicht** von selbst
verhindern. Bei zimmergenauer Buchung würde ein `EXCLUDE USING gist (room_id, aufenthalt WITH &&)`
Überbuchung physisch unmöglich machen. Bei Kategorie-Buchung ist Verfügbarkeit eine _Zählung_
("Anzahl Zimmer der Kategorie minus überlappende Buchungen pro Tag"), und Zählungen sind unter
Nebenläufigkeit angreifbar (zwei Anfragen zählen gleichzeitig "1 frei").

→ Deshalb ist **Q10 (Überbuchungsschutz) in Runde 2 die direkte Folgefrage.** Das Modell wurde
zugunsten der Domäne gewählt, die Rechnung dafür wird bewusst bezahlt, nicht verdrängt.

### E4 — Eigene `customers`-Tabelle, `auth.users` nur optional verknüpft

**Entscheidung:** `customers` mit `user_id uuid unique references auth.users(id)` **nullable**.
Buchungen zeigen auf `customers`, **nie** direkt auf `auth.users`.

**Begründung:** Zwei Gründe, beide hart:

1. **Fachlich:** Es muss Buchungen ohne Konto geben (Telefon, Rezeption, Gast-Checkout). Ein
   Pflicht-FK auf `auth.users` würde das verbieten. Später kann ein Konto an einen bestehenden
   Kunden angehängt werden, ohne Buchungen anzufassen.
2. **Architektonisch:** `auth.users` gehört Supabase, nicht der Domäne. Ein FK darauf verdrahtet
   Verträge (= Buchungen) an einen fremden Lebenszyklus (Löschen, Anonymisieren, Provider-Wechsel).
   Die Trennung ist der Seam, der die "Kundenkonten später"-Anforderung überhaupt erst billig macht.

**Verworfen:** Buchung → `auth.users` direkt.

### E5 — Preise: Saison-Zeiträume, `rate_plan`-Seam, **eingefrorener** Buchungspreis

**Entscheidung:** drei Teile.

1. Preise pro Kategorie mit Gültigkeitszeitraum (`daterange`), Überlappung per
   Exclusion-Constraint verboten.
2. `rate_plan_id` von Tag 1 vorhanden, zunächst mit **einer** Zeile ("Standard"). Damit sind
   Flex/Nicht-erstattbar/Frühbucher später eine Datenzeile, keine Schemaänderung.
3. **Nicht verhandelbar:** Der gebuchte Preis wird in der Buchung eingefroren (Betrag pro Nacht
   und/oder Gesamtbetrag, plus Währung).

**Begründung zu (3):** Preistabellen sind veränderlich, eine Buchung ist ein **Vertrag**. Würde die
Anwendung den Buchungspreis aus der Preistabelle neu berechnen, änderte sich der Preis einer
bestätigten Buchung rückwirkend, sobald jemand die Saisonpreise pflegt. Das ist kein Bug im Code,
das wäre ein Fehler im Datenmodell.

**Verworfen:** Tagespreis-Zeilen (eine Zeile je Datum) — mächtiger, aber jetzt unnötig; nachrüstbar
als Override-Tabelle. Belegungsabhängige Preise und volle Rate-Plans: später.

### E6 — Vertrauensgrenze: Lesen direkt, **Buchen** über eine Postgres-Funktion (RPC)

**Entscheidung:** Kategorien, Preise und Verfügbarkeit liest der Client direkt (RLS). Das Anlegen
einer Buchung läuft über eine Postgres-Funktion (`supabase.rpc(...)`), die Verfügbarkeitsprüfung und
Insert in **einer** Transaktion ausführt.

**Begründung:** "Prüfe Verfügbarkeit" und "lege Buchung an" als zwei Requests haben eine Lücke
dazwischen — zwei Gäste bekommen das letzte Zimmer. Die Regel "nicht überbuchen" muss dort liegen,
wo sie atomar durchsetzbar ist. Und da es kein Backend gibt (siehe Abschnitt 2), ist das die DB.
Grundsatz: **Die Datenbank ist die letzte Verteidigungslinie, nicht der TypeScript-Code.**

**Verworfen:** alles im Client (nicht absicherbar). **Verschoben:** Edge Functions — erst wenn
externe Effekte dazukommen (Zahlung, Bestätigungsmail), weil die nicht in eine DB-Transaktion gehören.

#### Rückfrage des Users: "geht das ueber Realtime Database oder subscription?"

**Nein — Realtime ist ein anderes Werkzeug, und die Verwechslung ist lehrreich:**

|           | Realtime (Broadcast / Postgres Changes)     | RPC (Postgres-Funktion)                     |
| --------- | ------------------------------------------- | ------------------------------------------- |
| Richtung  | Server → Client, **Push nach** der Änderung | Client → Server, **führt** die Änderung aus |
| Garantien | keine Transaktion, keine Konsistenzprüfung  | eine Transaktion, Constraints, Locks        |
| Zweck     | "sag mir, wenn sich was ändert"             | "tue das hier atomar"                       |

Realtime kann eine Buchung nicht _schreiben_ und schon gar nicht prüfen. Es ist ein
Benachrichtigungskanal. **Sinnvoll ist es an anderer Stelle:** die Admin-Umgebung ("neue Buchung
erscheint sofort in der Liste") und das Invalidieren einer Verfügbarkeitsanzeige im Browser.

Wenn Realtime kommt: **Broadcast mit Datenbank-Triggern** (`realtime.broadcast_changes()`),
nicht `postgres_changes`. Supabase empfiehlt Broadcast inzwischen als Standard, weil
`postgres_changes` eine Autorisierungsprüfung **pro Abonnent pro Änderung** macht und
Änderungen single-threaded verarbeitet — das skaliert mit der Zahl der Zuhörer, nicht mit der
Schreibrate. Zusätzlich ist bei einer Verfügbarkeitsanzeige `postgres_changes` fachlich falsch: es
würde **fremde Buchungszeilen** an den Browser pushen. Broadcast erlaubt es, im Trigger nur das zu
senden, was der Client wissen darf ("Kategorie X, Datum Y hat sich geändert").

Quellen: [Realtime: Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database) ·
[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) ·
[Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

### E7 — Schema als Code: Supabase CLI + Migrationen im Repo

**Entscheidung:** `supabase/migrations/*.sql` versioniert im Repo, lokale DB via Docker, TypeScript-
Typen generiert (`supabase gen types typescript`).

**Begründung:** Ohne das ist "gute Software-Architektur" beim Datenmodell nicht einlösbar: kein
Review, kein Diff, kein Rollback, keine Reproduzierbarkeit, kein gemeinsamer Stand im Team. Das
Datenmodell ist der langlebigste Teil der Anwendung — es ist der _letzte_ Ort, an dem man auf
Versionierung verzichten sollte. Nebeneffekt: generierte Typen bedeuten, dass ein Schemafehler
zur Compile-Zeit auffällt, statt zur Laufzeit im Browser.

**Verworfen:** Klicken im Dashboard.

### E8 — Konventionen

| Thema           | Entscheidung                                                                                   | Begründung                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Benennung       | englisch, `snake_case`, Plural (`room_types`, `bookings`)                                      | konsistent mit bestehendem `posts`, Supabase-/Postgres-Idiomatik, keine Umlaut-/Encoding-Fallen                                                                                                                                                                             |
| Primärschlüssel | `uuid` (`gen_random_uuid()`)                                                                   | IDs sind im Client sichtbar und wandern in URLs; fortlaufende Zahlen verraten Buchungsvolumen und laden zum Durchprobieren ein. Außerdem clientseitig erzeugbar.                                                                                                            |
| Geld            | `integer` in Cent + `currency`                                                                 | niemals `float` — Rundungsfehler in Beträgen sind nicht verhandelbar                                                                                                                                                                                                        |
| Aufenthalt      | halb-offenes Intervall `[check_in, check_out)`, `date`-Spalten + generierte `daterange`-Spalte | "der Abreisetag ist keine Nacht". Halb-offen macht Nächte-Zählung, Überlappungsprüfung und Anschlussbuchungen (Abreise = Anreise) korrekt _by construction_, statt per Off-by-one-Handarbeit. Die generierte `daterange`-Spalte ist die Voraussetzung für GiST-Constraints. |
| Zeitstempel     | `timestamptz` für `created_at`/`updated_at`, `date` für Aufenthaltstage                        | ein Aufenthaltstag ist kein Zeitpunkt und darf nicht durch Zeitzonen wandern                                                                                                                                                                                                |

### E9 — Visualisierung: alle drei Kanäle

**Entscheidung:** (a) Mermaid-ERD im Repo als **Quelle der Wahrheit** + (b) gerenderte HTML-Seite
als Artifact + (c) FigJam-Diagramm über die Figma-Anbindung.

**Begründung des Users:** "das Besprechen von Design und entscheidungen ist dann wesentlich einfacher."

**Wichtige Rangordnung:** (a) ist normativ, (b) und (c) sind **Ableitungen**. Sobald ein Diagramm im
Whiteboard zur Quelle wird, driftet es gegen das Schema — dann diskutiert man ein Modell, das es
nicht gibt. Regel: geändert wird immer erst (a).

---

## 4b. Entschieden (Runde 2)

### E10 — Überbuchungsschutz: Advisory-Lock in der RPC, Inventar-Tabelle als Upgrade-Pfad

**Entscheidung:** Die Buchungsfunktion nimmt zu Beginn einen Transaktions-Advisory-Lock
(`pg_advisory_xact_lock`) und serialisiert damit Buchungsvorgänge. Verfügbarkeit bleibt vollständig
aus `bookings` abgeleitet.

**Begründung:** Eine einzige Wahrheit ist bei einem ersten Schema mehr wert als Durchsatz — und
Durchsatz ist hier kein Thema (Buchungen pro Sekunde ≈ 0, ein Lock kostet nichts). Der Lock ist
trivial korrekt und braucht **keine Pflege**.

**Verworfen / verschoben:**

- **Tages-Inventar-Tabelle** (`room_type_inventory` mit `CHECK (rooms_booked <= rooms_total)`):
  atomar korrekt und der Weg für Kontingente, Stop-Sell und Tagespreise — aber sie ist eine
  **zweite Wahrheit** neben `bookings` und muss gepflegt werden (neues Zimmer → Backfill,
  Kalender in die Zukunft verlängern). Das ist der explizite Upgrade-Pfad, sobald eine dieser
  Funktionen kommt.
- **`SERIALIZABLE` + Retry:** verlagert Retry-Logik in den Client.
- **Hybrid (intern Zimmer automatisch zuweisen, Exclusion-Constraint):** datenbanktechnisch der
  stärkste Schutz und kostenlos — aber es untergräbt E3 operativ und erzeugt
  Bin-Packing-Fragmentierung: eine unglückliche Zuweisung kann eine spätere längere Buchung
  ablehnen, obwohl kategorieweit Platz wäre. Ein Umsatzverlust, der schwer zu erklären ist,
  wenn er auftritt.

### E11 — Buchungsstatus: `text` + `CHECK`, ohne `pending`, Blockier-Regel an einer Stelle

**Entscheidung:**

1. Repräsentation: `text` mit `CHECK`-Constraint.
2. Werte: `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`. **Kein** `pending`.
3. Kapazität blockierend: **alles außer `cancelled`** — definiert an _genau einer_ Stelle
   (SQL-Funktion bzw. Prädikat eines Teilindex), nicht in jeder Abfrage neu.

**Begründung:**

- Kein Postgres-`ENUM`, weil Enum-Werte nachträglich nur _hinzugefügt_, aber nicht sauber entfernt
  oder umbenannt werden können. Das kollidiert frontal mit der Erweiterbarkeitsanforderung aus
  Runde 0.
- `pending` erst mit der Zahlung — sonst entsteht ein Zustand, aus dem nichts herausführt
  (niemand bestätigt, niemand storniert, der Platz ist blockiert).
- Ein No-Show blockiert weiter: die Nacht **war** verkauft. Eine Storno nicht. Dass diese Regel
  einmalig definiert wird, ist der Punkt — sonst driftet sie zwischen Suchmaske, Admin-Liste und
  Buchungsfunktion auseinander, und dann widerspricht die Anwendung sich selbst.

### E12 — Änderungshistorie: `booking_events` append-only ab Tag 1

**Entscheidung:** `booking_events(booking_id, event_type, payload jsonb, actor, created_at)`,
ausschließlich Einfügungen.

**Begründung:** Der Grund, es _jetzt_ zu tun: **eine nachträglich eingebaute Historie hat keine
Vergangenheit.** Die Frage „wer hat diese Buchung wann storniert" kommt garantiert, sobald
Mitarbeitende und Kunden Buchungen verwalten — und die Antwort ist dann entweder vorhanden oder
für immer verloren. Kosten: eine Tabelle.

**Verschoben:** generische Audit-Tabelle per Trigger für _alle_ Tabellen — erst, wenn mehr als
Buchungen auditiert werden muss.

### E13 — RLS jetzt an; Rollen nur als Seam

**Entscheidung:**

1. **RLS wird sofort auf allen Tabellen aktiviert, deny by default.**
2. Zwei zentrale SQL-Funktionen — `is_staff()` und `current_customer_id()` — und **alle**
   RLS-Policies werden ausschließlich über diese geschrieben. v1: `is_staff()` liefert `false`.

**Begründung:**

- „RLS später anschalten" bedeutet „bis dahin offene Datenbank". Der Key liegt im Browser im
  Klartext (`src/shared/services/supabase.ts`) — das ist kein Geheimnis, sondern eine öffentliche
  Kennung. Der Schutz _ist_ RLS, es gibt keinen zweiten.
- Der Funktions-Seam ist die eigentliche Antwort auf „Mitarbeiter mit verschiedenen Berechtigungen
  kommen später": Die Änderung findet dann in **einer** Funktion statt, nicht in dreißig verstreuten
  Policies. Verstreutes `auth.uid()` in Policies ist genau die Kopplung, die spätere Rollen teuer
  macht.

**Verschoben:** `profiles.role` (naher Schritt), Rolle als Custom Claim im JWT via Auth Hook
(Performance-Schritt), volles RBAC mit `roles`/`permissions`/`role_permissions` (nur wenn
Berechtigungen wirklich feingranular werden).

### E14 — `hotels`-Tabelle mit einer Zeile; `hotel_id` nur auf `room_types` und `rooms`

**Entscheidung:** `hotels` existiert ab Tag 1 mit genau einer Zeile. `hotel_id` steht auf
`room_types` und `rooms`. **Nicht** auf `bookings` — die erben es über die Kategorie.

**Begründung — und die ist wichtiger als die Entscheidung:** Die Tabelle ist **keine Vorbereitung**.
Das Hotel _hat_ heute Stammdaten (Name, Adresse, Kontakt, Check-in-/Check-out-Zeit, Zeitzone). Die
Alternative wäre, sie als Konstanten ins Frontend zu schreiben — womit Impressum, Kontakt und Footer
an Deploys gekoppelt wären. Die Tabelle rechtfertigt sich **heute durch sich selbst**; dass sie die
Multi-Hotel-Migration fast trivial macht, ist Zugabe.

**Das ist das Muster für „billige Erweiterbarkeit":** Sie fällt als Nebenprodukt aus einer
Entscheidung heraus, die sich schon jetzt lohnt — nicht aus Vorratsbau für hypothetische Zukunft.
Dasselbe Muster wie bei `rate_plan_id` (E5) und der `customers`-Trennung (E4).

### E15 — Scope-Zaun: Belegungsgrenzen, Bilder, Zimmersperrungen

**Entscheidung — drin:** (1) `max_occupancy` pro Kategorie, (2) Bilder pro Kategorie,
(7) Zimmersperrungen / Zimmerstatus.

**Draußen:** Ausstattungsmerkmale, Zusatzleistungen, Zahlungen, Stornobedingungen, Gutscheine,
Mehrsprachigkeit, OTA-Anbindung.

**Begründung der Aufnahmen:**

- **Belegungsgrenzen** sind keine Zusatzfunktion. Ohne sie ist die Verfügbarkeitsabfrage _fachlich
  falsch_ — „Zimmer für 3 Personen" ist nicht beantwortbar.
- **Bilder** müssen rein, weil die Startseite schon Zimmerbilder zeigt
  (`src/assets/img/double-premium.jpg`); die Alternative sind wieder hartcodierte Pfade im Frontend.
- **Zimmersperrungen** (Renovierung, Defekt) beeinflussen die **Verfügbarkeit**. Ohne sie rechnet
  die Kapazität falsch — derselbe Grund wie bei den Belegungsgrenzen.

**Begründung der Ausschlüsse:** alle additiv nachrüstbar, ohne das bestehende Modell zu ändern.

**Wichtige Folge, die in Runde 3 geklärt werden muss:** Sperrungen hängen am **Zimmer**,
Verfügbarkeit wird aber pro **Kategorie** gezählt (E3/E10). Damit ist die Kapazität einer Kategorie
pro Tag nicht mehr die konstante Zimmeranzahl, sondern „Zimmer der Kategorie minus an diesem Tag
gesperrte Zimmer". → siehe Q18.

### E16 — Gästemodell: Zähler, keine Namensliste

**Entscheidung:** Buchung hält `adults`/`children` als Zähler; Hauptgast ist der verknüpfte
`customer`.

**Begründung:** Die Zähler braucht man ohnehin für die Belegungsprüfung gegen `max_occupancy`
(E15.1). Namen der Mitreisenden braucht man erst im Check-in-/Meldescheinprozess, und `booking_guests`
ist dann eine reine Zusatztabelle ohne jede Änderung am Bestehenden — der billigste denkbare
Nachrüstfall.

---

## 4c. Entschieden (Runde 3) (HIER WEITER)

### E17 — Verfügbarkeit: RPC mit `SECURITY DEFINER`, Rückgabe nur als Aggregat

**Entscheidung:** SQL-Funktion, per RPC aufrufbar, `SECURITY DEFINER` mit fixiertem `search_path`.
Sie gibt **ausschließlich Aggregate** zurück (pro Kategorie: freie Anzahl, Preis für den Zeitraum),
niemals Buchungszeilen.

**Begründung — und das ist ein Datenschutzargument, kein Performanceargument:** Verfügbarkeit im
Browser zu berechnen setzt voraus, dass der Browser die Buchungen **fremder Menschen** lesen darf.
Das wäre ein Datenleck als Architekturentscheidung. Mit `SECURITY DEFINER` bleibt `bookings` für
Anonyme vollständig unlesbar, und der Client erfährt nur „Kategorie X: 2 frei, 340 €".

**Verworfen:** View mit Client-Filter (der Client bekäme die Rohdaten), Berechnung im TypeScript
(dito, plus die Regel läge außerhalb der Datenbank — Widerspruch zu Leitsatz 1).

### E18 — Zimmersperrungen: nur verfügbarkeitsrelevant; Sperrung schlägt Constraint

**Entscheidung:** `room_blocks(room_id, zeitraum, reason)` — Renovierung, Defekt, Dauerbelegung.
**Kein** operativer Zimmerstatus (`clean`/`dirty`), **kein** Housekeeping-Subsystem.

**Konsequenz für die Kapazitätsrechnung:** Kapazität einer Kategorie pro Tag ist nicht `count(rooms)`,
sondern `count(aktive Zimmer der Kategorie) − an diesem Tag gesperrte Zimmer`. Sperrungen hängen am
**Zimmer**, gezählt wird die **Kategorie** — diese zweite Dimension muss die Verfügbarkeitsfunktion
kennen.

**Entscheidung zum Konfliktfall (5 Zimmer, 5 Buchungen, dann wird eines gesperrt):** Die Sperrung
**darf** angelegt werden. Die Buchungsfunktion rechnet Sperrungen mit ein, und das Anlegen einer
Sperrung **warnt**, wenn bestätigte Buchungen dadurch die Kapazität übersteigen.

**Begründung:** Ein Constraint, der die Sperrung verbietet, stellt die Datenbank gegen die
Wirklichkeit — das Rohr ist geplatzt, ob die Datenbank das erlaubt oder nicht. Datenmodelle dürfen
Fakten nicht verbieten; sie dürfen sie nur sichtbar machen. Die Auflösung ist ein Betriebsvorgang
(umbuchen, upgraden, absagen), kein Datenbankfehler.

### E19 — Bilder: Supabase Storage, nur `sort_order`, `alt_text NOT NULL`

**Entscheidung:** Dateien in Supabase Storage (öffentlicher Bucket);
`room_type_images(room_type_id, path, alt_text, sort_order)`; Hauptbild = niedrigste `sort_order`;
`alt_text` ist `NOT NULL`.

**Begründung:**

- **Storage statt Repo:** Bilder sind Redaktionsdaten, nicht Code. Im Repo braucht jedes neue
  Zimmerbild einen Deploy.
- **Kein `is_primary`:** Ein Boolean „genau eines pro Kategorie" ist nur über einen Teilindex
  durchsetzbar, und danach gibt es _zwei_ konkurrierende Sortierbegriffe. „Das erste ist das
  Hauptbild" ist eine Regel weniger und kann nicht inkonsistent werden.
- **`alt_text NOT NULL`:** Optionale Barrierefreiheit wird nicht ausgefüllt. Das Schema ist der
  einzige Ort, an dem sie erzwingbar ist.

### E20 — Eine Buchung = ein Zimmer, plus nullable `booking_group_id`

**Entscheidung:** Eine Buchung bezieht sich auf **genau ein** Zimmer einer Kategorie. Mehrere Zimmer
= mehrere Buchungszeilen, die über eine nullable `booking_group_id` als **ein Vorgang**
zusammengefasst werden. Die RPC legt bei „2 Zimmer" zwei Zeilen in einer Transaktion an.

**Begründung — hier liegt die wichtigste Kostenasymmetrie des Modells:** Der Wechsel zum
PMS-Standardmodell (`bookings` + `booking_items`) bedeutet, **fünf Spalten aus `bookings` in eine
Kindtabelle zu verschieben** (Kategorie, Zimmer, Anreise, Abreise, Preis) und jede Abfrage, jede
Policy und die RPC neu zu schreiben. Das ist der einzige _strukturelle_ Umbau in diesem Modell —
alle anderen Erweiterungen sind additiv.

Die gewählte Variante hält gleichzeitig drei Dinge einfach: die Verfügbarkeitszählung (1 Buchung =
1 Zimmer), die Preis-Einfrierung (ein Preis pro Buchung) und die Policies. Und sie deckt den echten
fachlichen Bedarf („zwei Zimmer, ein Vorgang, eine Bestätigung, eine Rechnung") mit **einer Spalte**.

**Diese Frage hätte in Runde 1 gestellt werden müssen** — sie ist erst durch die Antworten zu
Belegungsgrenzen und Gästezahl (E15, E16) sichtbar geworden. Für den Call ist das der interessantere
Teil: _Entscheidungsbäume wachsen beim Durchgehen, und die teuerste Frage ist nicht automatisch die
erste._

### E21 — Preis eingefroren **pro Nacht**

**Entscheidung:** `booking_nights(booking_id, date, amount_cents)` zusätzlich zum Gesamtbetrag.

**Begründung:** Drei Dinge sind mit einem reinen Gesamtbetrag unmöglich:

1. **Umsatz pro Monat** — ein Aufenthalt vom 29. Juni bis 3. Juli lässt sich aus einer Summe nicht
   aufteilen, und Umsatz pro Nacht ist die zentrale Kennzahl des Hotelgeschäfts (ADR/RevPAR).
2. **Verlängerung/Verkürzung** — welchen Preis hat die vierte Nacht?
3. **Teilstorno.**

Die Nacht ist die natürliche Körnung des Geschäfts; das Schema sollte sie kennen. Kosten: eine
Tabelle mit wenigen Zeilen pro Buchung.

### E22 — Nichts wird gelöscht: `ON DELETE RESTRICT` + Archivierung

**Entscheidung:**

- `ON DELETE RESTRICT` auf allen Referenzen; `archived_at` (bzw. `is_active`) auf `room_types` und
  `rooms` — deaktivieren statt löschen.
- **Buchungen werden nie gelöscht.** Storniert wird per Status (E11).
- `cancelled_at` steht denormalisiert in `bookings`, obwohl die Information auch in
  `booking_events` liegt.

**Begründung:**

- Eine Kategorie, auf die historische Buchungen zeigen, ist nicht löschbar, ohne die Vergangenheit
  zu zerstören. Nur die Datenbank kann das garantieren — „in der Anwendung aufpassen" ist keine
  Garantie.
- Zur Denormalisierung: **Historie und abfragbarer Zustand sind zwei verschiedene Jobs.**
  `booking_events` beantwortet „was ist passiert", `cancelled_at` beantwortet „zeig mir alle
  Stornos im Juli" ohne JSON-Wühlen.
- **`ON DELETE SET NULL` ist die schlechteste Variante** und wurde deshalb ausdrücklich verworfen:
  sie zerstört Daten leise und macht jede historische Auswertung falsch, ohne dass irgendwo ein
  Fehler auftaucht.

### E23 — Menschenlesbare Buchungsnummer ab Tag 1

**Entscheidung:** `booking_reference`, 8 Zeichen, `unique`, aus einem Alphabet **ohne** `I`, `O`,
`0`, `1`.

**Begründung:** UUIDs sind am Telefon unbenutzbar. Nachträglich müsste man Bestandsbuchungen
backfillen _und_ Kunden hätten schon UUIDs in Bestätigungsmails gesehen. Das reduzierte Alphabet ist
der eigentliche Zweck der Spalte: Verwechslungen beim Vorlesen ausschließen.

---

## 4d. Entschieden (Runde 4)

### E24 — Verfügbarkeit **pro Tag** mit Grund; Sperrung im Kalender statt Fehler nach dem Klick

**Entscheidung des Users, die meine Empfehlung überstimmt:** Buchungsversuche auf nicht verfügbare
Tage sollen gar nicht möglich sein. Nicht buchbare Tage werden im Kalender **durchgestrichen**, ein
**Tooltip** nennt den Tag und den Grund.

**Meine Empfehlung war** eine Zeile pro Kategorie mit „frei" als Minimum über den Zeitraum. Das ist
für diese Anforderung **zu grob**: Ein Kalender muss _vor_ der Auswahl wissen, welche einzelnen Tage
wählbar sind. Damit gilt:

- Die Verfügbarkeitsfunktion liefert **eine Zeile pro Tag** (und Kategorie), mit `rooms_free` **und**
  einem maschinenlesbaren `unavailable_reason`.
- Die Aggregation „Minimum über den Zeitraum" bleibt trotzdem nötig — für Ergebnisliste, Preis und
  die Prüfung in der Buchungsfunktion. Sie wandert nicht in den Browser (E17).
- **Kein Datenschutzkonflikt mit E17:** freie Anzahl pro Tag ist weiterhin ein Aggregat, keine
  Buchungszeile.

**Warum das lehrreich ist:** Eine reine UI-Anforderung („durchstreichen mit Tooltip") hat die
Schnittstelle der Datenbankfunktion geändert. Datenmodell und Oberfläche sind nicht unabhängig
voneinander entscheidbar — und es ist billiger, das _jetzt_ zu merken als nach dem Schreiben der
Funktion.

**Wichtige Abgrenzung, die dadurch nicht wegfällt:** Der gesperrte Kalender ist **Komfort, keine
Garantie**. Zwischen Seitenaufbau und Klick kann jemand anders buchen — genau dafür existiert E10.
Die Buchungsfunktion prüft weiterhin vollständig. → Q31.

### E25 — Preislücke = nicht buchbar, plus Prüffunktion

**Entscheidung:** Fehlt für eine Nacht eine Preiszeile, ist die Kategorie an diesem Tag **nicht
buchbar** (`unavailable_reason = 'kein_preis'`). Zusätzlich eine Admin-Prüffunktion „Preislücken der
nächsten 365 Tage".

**Begründung:** Ein Fallback-Basispreis verkauft Zimmer **stillschweigend zum falschen Preis** — und
weil der Preis nach E5 in der Buchung eingefroren wird, ist der Fehler danach unumkehrbar. Nicht zu
verkaufen ist der günstigere Fehler. Ein erzwungener Lückenlosigkeits-Constraint wurde verworfen,
weil er normale Pflegezustände blockiert: man müsste die Zukunft permanent abgedeckt halten, bevor
man irgendetwas ändern darf.

### E26 — Kundenidentität über die E-Mail-Adresse

**Entscheidung:** `customers.email` ist eindeutig und groß-/kleinschreibungsunabhängig (`citext`
oder Unique-Index auf `lower(email)`). Eine Buchung ohne Konto verwendet einen bestehenden
Kundendatensatz wieder, wenn die E-Mail bekannt ist.

**Begründung:** Damit erfüllt sich die Anforderung „später Kundenkonten, in denen Kunden ihre
Buchungen sehen" **von selbst**: Konto anlegen → `user_id` an den bestehenden Kunden hängen → alle
früheren Buchungen sind sichtbar. Die Alternative wäre nachträgliches Zusammenführen von
Kundendatensätzen, und Merge-Logik über Verträge gehört zu den unangenehmsten Migrationen überhaupt.

**Ausdrücklich benannt:** Wer mit fremder E-Mail bucht, öffnet damit kein Datenleck — Buchungen
liest nur ein über `current_customer_id()` authentifizierter Account (E13), und Supabase verifiziert
E-Mail-Adressen bei der Kontoerstellung. Semantik: _wer die Adresse nachweislich kontrolliert, sieht
die darauf gebuchten Aufenthalte._ Branchenüblich. Die Groß-/Kleinschreibungsregel ist nicht
optional — sonst legen `Anna@…` und `anna@…` zwei Kunden an und die ganze Mechanik ist wirkungslos.

### E27 — `booking_groups` als Tabelle, nullable FK, Buchungsnummer bleibt an der Buchung

**Entscheidung:** Tabelle `booking_groups(id, created_at)`; `bookings.booking_group_id` nullable.
Die Buchungsnummer (E23) bleibt an der **einzelnen** Buchung — ein Vorgang mit zwei Zimmern erzeugt
zwei Nummern, beide auf der Bestätigung.

**Begründung:** Tabelle statt nackter `uuid`-Spalte, weil eine Gruppen-ID ohne Fremdschlüssel
verwaisen kann, ohne dass es auffällt — und weil die Tabelle der spätere Anker für Rechnung und
Zahlung ist.

**Bewusst nicht gewählt und wichtig zu wissen:** Eine **verpflichtende** Gruppe, die Kunde,
Buchungsnummer und Gesamtsumme trägt, wäre _der Vorgang_ — und damit exakt das
`bookings` + `booking_items`-Modell, das in E20 verworfen wurde, nur mit anderen Namen. Sollte
später „eine Familie muss **eine** Buchungsnummer bekommen" zur harten Anforderung werden, ist das
der Punkt, an dem E20 fällt. Zwei Reservierungsnummern für zwei Zimmer sind branchenüblich; das
trägt bis dahin.

---

## 4e. Entschieden (Runde 5)

### E28 — Zwei Funktionen, zwei Jobs; Sperrgründe **zweistufig**

**Entscheidung:**

- `availability_calendar(von, bis, erwachsene, kinder, kategorie?)` → **eine Zeile pro Tag**
  (füttert den Kalender).
- `search_availability(anreise, abreise, erwachsene, kinder)` → **eine Zeile pro Kategorie**
  mit Minimum über den Zeitraum und Gesamtpreis (füttert Ergebnisliste; `create_booking` nutzt sie
  intern).
- Interne Sperrgründe: `ausgebucht`, `kein_preis`, `zu_klein`, `vergangenheit`,
  `ausserhalb_horizont`.
- **Zweistufig (Anforderung des Users): Gäste sehen nur „Buchung nicht möglich" plus das
  betroffene Datum.** Die feinen Gründe sind für Admin und Diagnose.

**Begründung der zwei Funktionen:** Bei einer einzigen Tages-Funktion wanderten Preissummierung und
die Blockier-Regel in den Browser — genau die Duplizierung, die E11 („Regel an genau einer Stelle")
und E17 verhindern. Es sind zwei verschiedene Fragen: _„welche Tage darf ich anklicken"_ vs.
_„was kann ich buchen und was kostet es"_.

**Begründung der Zweistufigkeit:** `kein_preis` ist ein **Konfigurationsfehler des Betreibers**, kein
Gastthema — nach außen sieht er wie „nicht verfügbar" aus, nach innen muss er alarmieren. Der Gast
braucht die interne Ursache nicht, und sie preiszugeben verrät Betriebsinterna. Nach innen ist die
Unterscheidung dagegen Gold wert: `ausgebucht` ist Erfolg, `kein_preis` ist ein Fehler — im Kalender
sehen beide identisch aus.

**Umsetzungsinterpretation (bitte im Call bestätigen):** Die Funktion liefert den feinen Code nur,
wenn `is_staff()` wahr ist; sonst einen generischen Wert. Damit überschreitet die Information die
Vertrauensgrenze gar nicht erst — konsequent zu E17.

### E29 — Ein Tageswert bedeutet „diese **Nacht** ist verfügbar"

**Entscheidung:** Die Tagesdaten bedeuten „diese Nacht ist verfügbar". UI-Regel:

- **Anreisetag** wählbar, wenn _diese_ Nacht frei ist.
- **Abreisetag** wählbar, wenn die _vorherige_ Nacht frei ist.

**Begründung — das ist die Auszahlung von E8:** Ein als Nacht ausgebuchter Tag ist als Abreisetag
völlig legitim.

```
Nacht:        3.   4.   5.   6.
frei?         ✓    ✓    ✓    VOLL
Buchung 3.→6. (3 Nächte, Abreise am 6.)  ← korrekt und buchbar
Tag 6. komplett durchstreichen  →  diese Buchung wird unmöglich
```

Wer den Tag komplett streicht, macht **Anschlussbuchungen** unmöglich (Abreise = Anreise des
Nächsten) — und genau die sind bei hoher Belegung der wertvollste Fall. Halb-offene Intervalle sind
kein Formalismus; sie kosten oder verdienen Geld.

### E30 — Buchungshorizont als Stammdatum: `hotels.booking_horizon_days`

**Entscheidung:** Spalte an `hotels` (z. B. 540 Tage). Die Verfügbarkeitsfunktion respektiert sie und
liefert `ausserhalb_horizont`.

**Begründung:** Wieder das Muster aus E14 — das Hotel _hat_ Betriebsregeln, und die gehören zu seinen
Stammdaten, nicht in ein Frontend-Konstantenmodul. Und ohne diese Grenze ertrinkt die
Preislücken-Prüfung aus E25 in falschen Treffern: für 2034 fehlen naturgemäß Preise, aber die Ursache
ist nicht „Preis fehlt", sondern „so weit im Voraus nehmen wir keine Buchungen an".

### E31 — `create_booking` antwortet strukturiert: Code + Datum + Grund

**Entscheidung:** Bei Ablehnung liefert die Buchungsfunktion einen maschinenlesbaren Fehler
(Fehlercode, betroffenes Datum, Grund) — nicht `false`, nicht nur einen Fehlertext.

**Begründung:** Die Anforderung „Buchungsversuche sollen gar nicht möglich sein" ist im Client nur
**annäherbar**, nie garantierbar: zwischen Seitenaufbau und Klick kann jemand anders das letzte
Zimmer buchen (dafür existiert E10). Genau in diesem seltenen Fall braucht der Gast eine gute
Erklärung — und die Oberfläche muss denselben Tooltip zeigen können wie der Kalender. Ein Fehlertext,
den das Frontend per String-Vergleich auswertet, ist eine Schnittstelle, die beim nächsten
Umformulieren bricht.

**Das ist Leitsatz 1 in konkret:** Die Prüfung im Client ist eine Bitte, die Prüfung in der Datenbank
ist die Regel — und die Regel muss erklären können, warum sie abgewiesen hat.

---

## 5. Offene Punkte

| #   | Frage | hängt an |
| --- | ----- | -------- |

**Die Frontier ist leer** — alle Entscheidungen des Entscheidungsbaums sind getroffen (E1–E31).

Ein Punkt wartet auf Bestätigung im Call: die **Umsetzungsinterpretation in E28** (feine Sperrgründe
nur für `is_staff()`), weil sie eine Auslegung der Anforderung „der Kunde soll nur ‚Buchung nicht
möglich' sehen" ist und keine ausdrückliche Entscheidung.

Bewusst hinter dem Zaun (E15) und damit **kein** Teil dieses Schemas: Ausstattungsmerkmale,
Zusatzleistungen, Zahlungen, Stornobedingungen, Gutscheine, Mehrsprachigkeit, OTA-Anbindung,
Housekeeping-Abläufe. Alle additiv nachrüstbar.

Benannte Upgrade-Pfade, die aus Entscheidungen folgen: Tages-Inventar-Tabelle (E10), volles RBAC
(E13), `booking_guests` (E16), `bookings` + `booking_items` (E20/E27), Belegungspreise und weitere
Rate-Plans (E5).

---

## 6. Leitsätze, die sich durch alle Entscheidungen ziehen

Für den Call als Zusammenfassung auf einer Folie:

1. **Die Datenbank ist die letzte Verteidigungslinie.** Ohne Backend gilt: was der Client prüfen
   könnte, ist keine Regel — nur eine Bitte. (E6)
2. **Erweiterbar ≠ alle Achsen offen.** Erweiterbarkeit heißt "die spätere Änderung ist eine
   mechanische Migration", nicht "jede Möglichkeit ist heute schon eingebaut". (E2, E5)
3. **Eine Buchung ist ein Vertrag.** Ihre Fakten (Preis, Zeitraum, Kategorie) werden festgeschrieben,
   nicht neu berechnet. (E5)
4. **Fremde Systeme nicht in die Domäne verdrahten.** `auth.users` gehört Supabase. (E4)
5. **Modelliere die Domäne, nicht die einfachste Implementierung** — und benenne den Preis dafür
   sofort und laut. (E3 → Q10)
6. **Schema als Code, oder es existiert nicht überprüfbar.** (E7)
7. **Korrektheit by construction schlägt Korrektheit by Aufmerksamkeit.** Halb-offene Intervalle,
   Cent-Integers, Constraints statt Konventionen. (E8)

---

## 7. Änderungshistorie

| Datum      | Änderung                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-17 | Ausgangslage erhoben, Runde 1 (E1–E9) entschieden und begründet, Realtime-Rückfrage geklärt, Runde 2 aufgesetzt                      |
| 2026-08-17 | Runde 2 (E10–E16) entschieden und begründet, Runde 3 aufgesetzt                                                                      |
| 2026-08-17 | Runde 3 (E17–E23) entschieden und begründet, Runde 4 aufgesetzt                                                                      |
| 2026-08-17 | Runde 4 (E24–E27): Q24 revidiert die Empfehlung — Verfügbarkeit pro Tag statt Minimum. Runde 5 aufgesetzt                            |
| 2026-08-17 | Runde 5 (E28–E31) entschieden. Entscheidungsbaum vollständig, Frontier leer                                                          |
| 2026-08-17 | **Freigabe erteilt.** `schema.md` (ERD + Tabellen + Funktionen + RLS) und `umsetzungsplan.md` (Phasen 1–10) erstellt                 |
| 2026-08-17 | Artifact-Seite und FigJam-Board veröffentlicht; FigJam nach Domänen eingefärbt (Stammdaten / Preise / Buchungsvorgang / Fremdsystem) |
