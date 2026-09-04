[← Vorheriger Commit](001_2026-08-26_datenbank-schema-und-umsetzungsplan.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# docs(datenbank): Runde 6 (E32-E36) und Vorgehensentscheidungen V1-V7

- **Commit:** `2935b66`
- **Datum:** 2026-09-02
- **Autor:** Oliver Jung

## Worum geht es?

Zwischen dem Schema-Entwurf und der ersten Migration liegt eine weitere Runde – und wieder ohne eine Zeile SQL:

```text
 docs/datenbank/README.md         | 155 +++++++++++++++++++++++++++++----
 docs/datenbank/schema.md         |  42 ++++++---
 docs/datenbank/umsetzungsplan.md | 180 ++++++++++++++++++++++++++-------------
 3 files changed, 287 insertions(+), 90 deletions(-)
```

Der Grund: Beim Durchgehen des Plans mit Blick auf die konkrete Umsetzung fielen **Lücken** auf. Nicht Fehler im Modell, sondern Stellen, an denen das Schema eine Regel forderte, aber offen ließ, _wie_ sie durchgesetzt wird. Fünf davon werden hier als `E32`–`E36` entschieden.

Dazu kommt etwas Neues: eine zweite Nummernreihe `V1`–`V7` für **Vorgehensentscheidungen**. Die Trennung ist sauber gedacht:

```markdown
Domänenentscheidungen stehen als E1–E36 in `README.md`. Was hier steht, ist **Vorgehen** — es
ändert das Schema nicht, aber es bestimmt, wie diese Umsetzung abläuft.
```

Eine `E`-Entscheidung betrifft die Fachlichkeit („gebucht wird die Kategorie"). Eine `V`-Entscheidung betrifft die Arbeitsweise („ein Commit pro Phase"). Beides braucht Begründungen, aber es sind verschiedene Dinge – und wer sie in eine Liste mischt, findet später keine davon wieder.

Wichtig ist auch die **Reihenfolge**, in der die drei Dokumente geändert werden. Sie steht in der Commit-Message:

```text
schema.md ist zuerst geaendert, README.md begruendet, umsetzungsplan.md setzt es in Phasen um.
```

Das ist die Regel aus dem ersten Commit in Aktion: `schema.md` ist normativ. Also wird dort zuerst geändert – nicht im Plan, der sie umsetzt.

## 1. `E32` – Case-Insensitivität als generierte Spalte

Die Ausgangslage: `E26` hatte entschieden, dass die E-Mail-Adresse den Kunden identifiziert und dabei Groß-/Kleinschreibung ignorieren muss. `Anna@Muster.de` und `anna@muster.de` sind derselbe Mensch. Aber _wie_ das erreicht wird, blieb offen – `schema.md` nannte zwei Möglichkeiten.

Der Diff in `schema.md` zeigt die Auflösung:

```diff
     CUSTOMERS {
         uuid id PK
         uuid user_id FK "nullable - E4"
-        citext email UK "case-insensitive - E26"
+        text email "Originalschreibweise - E26"
+        text email_normalized UK "generiert lower(email) - E32"
```

Und in der Tabellenbeschreibung:

```diff
-| `email` | `citext` | `NOT NULL UNIQUE` |
+| `email` | `text` | `NOT NULL` — Originalschreibweise, so wie der Gast sie eingegeben hat |
+| `email_normalized` | `text` | `GENERATED ALWAYS AS (lower(email)) STORED`, `NOT NULL UNIQUE` (E32) |
```

Es entstehen also **zwei** Spalten: die eingegebene Adresse und eine automatisch daraus berechnete Kleinschreibversion. In SQL sieht das so aus:

```sql
create table public.customers (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    email_normalized text generated always as (lower(email)) stored not null unique,
    ...
);
```

Eine `generated always as (...) stored`-Spalte wird von der Datenbank bei jedem `INSERT`/`UPDATE` selbst berechnet und gespeichert. Man kann sie nicht von Hand setzen – der Versuch ist ein Fehler.

### Warum nicht die naheliegenden Alternativen?

Die Begründung in `README.md` geht drei Alternativen durch, und jede Zurückweisung ist lehrreich:

```markdown
**Verworfen:**

- **`citext`:** löst dasselbe eleganter, ist aber eine Extension, und die Case-Insensitivität
  wäre eine Eigenschaft des Typs statt eine sichtbare Spalte. Vertretbar, nur nicht gewählt.
- **Normalisierender Trigger** (`email` beim Schreiben kleinschreiben): zerstört die
  Originalschreibweise unwiederbringlich — sie steht in jeder Bestätigungsmail.
- **Funktionaler Index + Disziplin:** E26 bündelt die Kundensuche zwar auf genau eine Stelle
  (`create_booking`), aber „ist ja nur eine Stelle" ist der Satz, nach dem es zwei werden.
```

Der dritte Punkt ist der interessanteste. Ein funktionaler Index

```sql
create unique index on customers (lower(email));
```

garantiert die Eindeutigkeit genauso gut. Aber er hilft beim **Suchen** nicht:

```sql
-- Findet die Zeile NICHT, obwohl der Kunde existiert:
select * from customers where email = 'Max@Muster.de';

-- Findet sie, aber nur, wenn man daran denkt:
select * from customers where lower(email) = lower('Max@Muster.de');
```

Die Regel wandert damit in die Aufmerksamkeit jedes einzelnen Aufrufers. Mit einer generierten Spalte ist die Abfrage ein gewöhnlicher Spaltenvergleich:

```sql
select * from customers where email_normalized = lower($1);
```

Das ist genau Leitsatz 7 aus dem ersten Commit: **Korrektheit by construction schlägt Korrektheit by Aufmerksamkeit.**

## 2. `E33` – der Advisory-Lock wird hotelweit

Die zweite Schema-Abweichung betrifft den Überbuchungsschutz. `E10` hatte entschieden, dass die Buchungsfunktion einen **Advisory-Lock** nimmt, damit nicht zwei gleichzeitige Anfragen dasselbe letzte Zimmer verkaufen. Offen blieb, wie fein dieser Lock greift.

```diff
-1. pg_advisory_xact_lock(...)                      -- serialisiert Buchungen (E10)
+1. pg_advisory_xact_lock(hashtext('booking:' || hotel_id))  -- EIN Lock fuers Hotel (E10, E33)
```

Ein Lock pro Zimmerkategorie hätte theoretisch mehr Durchsatz erlaubt – zwei Gäste, die verschiedene Kategorien buchen, müssten nicht aufeinander warten. Die Begründung gegen diese Verfeinerung ist ein Klassiker der Nebenläufigkeit:

```markdown
**Begründung:** Ein Lock pro Kategorie sähe nach mehr Durchsatz aus, verlangt aber, dass eine
Mehrzimmerbuchung über mehrere Kategorien (E20/E27) mehrere Locks hält — und zwar in
garantiert sortierter Reihenfolge, sonst verklemmen sich zwei gleichzeitige Gruppenbuchungen
gegenseitig. Das ist ein Fehler, der nur unter Last auftritt und deshalb im Betrieb entdeckt
wird, nicht in der Entwicklung.
```

Das beschriebene Problem ist ein **Deadlock**: Buchung A hält den Lock für „Suite" und will „Premium"; Buchung B hält „Premium" und will „Suite". Beide warten für immer. Die Lösung wäre, Locks immer in derselben Reihenfolge zu nehmen (z. B. sortiert nach ID) – möglich, aber eine Regel, die man vergessen kann, und deren Verletzung sich erst unter echter Last zeigt.

Der Abwägungssatz dazu ist bemerkenswert nüchtern:

```markdown
Bei einem Hotel mit ~15 Zimmern ist der Durchsatz belanglos (E10 sagt das bereits:
„Buchungen pro Sekunde ≈ 0"), der Deadlock aber real.
```

Und der Hinweis für später:

```markdown
**Wichtig für später:** Wer feiner sperren will, löst das falsche Problem. Der benannte
Upgrade-Pfad für Durchsatz ist die Inventartabelle aus E10, nicht eine feinere
Lock-Granularität.
```

## 3. `E34` – sechs Tests, und das Auswahlkriterium dahinter

Der Plan sah bisher „negative Tests" vor, ohne Werkzeug und Umfang festzulegen. `E34` entscheidet: **Vitest** gegen die lokale Instanz, hinter einem eigenen Skript `pnpm test:db`. Und sechs konkrete Kriterien:

```markdown
| #   | Kriterium                                                             | beweist  |
| --- | --------------------------------------------------------------------- | -------- |
| 1   | überlappende Sperrung desselben Zimmers wird abgelehnt                | E18      |
| 2   | überlappender Preiszeitraum derselben Kategorie wird abgelehnt        | E5       |
| 3   | **Abreise = Anreise der nächsten Buchung wird akzeptiert**            | E8, E29  |
| 4   | Nacht ohne Preiszeile → `kein_preis`, nicht Preis 0                   | E25      |
| 5   | zwei gleichzeitige Buchungen aufs letzte Zimmer → genau eine gewinnt  | E10, E33 |
| 6   | eingefrorener Preis bleibt nach Änderung der Saisonpreise unverändert | E5, E21  |
```

Das Auswahlkriterium ist der eigentliche Lernwert dieser Entscheidung:

```markdown
**Begründung:** Auswahlkriterium ist nicht „wichtig", sondern **„fällt lautlos aus"**. Ein
fehlender `CHECK` meldet sich nie — es wird irgendwann doppelt gebucht.
```

„Fällt lautlos aus" ist ein deutlich besseres Kriterium als „ist wichtig". Fast alles in einer Anwendung ist irgendwie wichtig. Aber ein fehlendes Constraint erzeugt **keine Fehlermeldung** – es erzeugt stille Falschheit. Genau dort lohnt ein Test am meisten.

Zwei weitere Begründungen erklären die Werkzeugwahl:

```markdown
**Warum nicht pgTAP:** Test 5 braucht zwei gleichzeitige Sessions. In TypeScript ist das
`Promise.allSettled([rpc(), rpc()])`, in pgTAP eine Übung in `dblink`.

**Warum nicht in `pnpm test`:** Der Standardlauf muss ohne Docker durchlaufen, sonst schlägt
er bei jedem fehl, der nur das Frontend ansieht.
```

Der zweite Punkt ist eine Rücksicht auf die anderen Kursteilnehmenden: Wer nur an einer CSS-Datei arbeitet, soll nicht erst Docker starten müssen, um die Tests grün zu sehen.

Und schließlich benennt die Entscheidung, was sie **nicht** leistet:

```markdown
**Bewusst ungeprüft:** die Wirksamkeit des Locks unter realem Lastprofil. Test 5 zeigt, dass
Serialisierung greift, nicht wie sie sich bei hundert Anfragen verhält.
```

## 4. `E35` – `VITE_` ist keine Konvention, sondern ein Schutzmechanismus

Bisher standen die Supabase-Zugangsdaten hart im Quellcode:

```ts
export const supabase = createClient('https://halbtcgvbacahayzrpip.supabase.co', 'sb_publishable_…');
```

`E35` entscheidet drei Dinge:

```markdown
1. Entwicklung läuft ausschließlich gegen die lokale Instanz (`http://127.0.0.1:54321`).
   Docker wird damit Projektvoraussetzung.
2. `.env` wird aus der Versionskontrolle genommen (`git rm --cached`) und in `.gitignore`
   aufgenommen; committet wird `.env.example` mit den lokalen Standardwerten.
3. Der Service-Role-Key heißt `SUPABASE_SERVICE_ROLE_KEY` — **ohne** `VITE_`-Präfix.
```

Punkt 3 ist der wichtigste, und er ist ein Vite-Spezifikum, das man kennen muss:

```markdown
**Begründung:** Zu 3 ist die Regel keine Konvention, sondern ein Schutzmechanismus: Vite
bündelt _alles_ mit `VITE_`-Präfix in den Browser. Ein `VITE_SUPABASE_SERVICE_ROLE_KEY` wäre
ein Key, der RLS umgeht, ausgeliefert an jeden Besucher. Die Namensregel verhindert das,
bevor ein Review es bemerken müsste.
```

Zum Verständnis: Supabase kennt zwei Arten von Schlüsseln.

| Schlüssel                  | darf in den Browser? | Wirkung                                       |
| -------------------------- | -------------------- | --------------------------------------------- |
| `publishable` / `anon` key | **ja**               | unterliegt vollständig den RLS-Regeln         |
| `service_role` key         | **niemals**          | **umgeht RLS komplett** – darf alles, überall |

Der erste ist kein Geheimnis. Er identifiziert nur das Projekt; der Schutz kommt von Row Level Security. Der zweite ist der Generalschlüssel. Landet er im Browser-Bundle, ist die gesamte Zugriffskontrolle wertlos – und zwar rückwirkend, weil ausgelieferte JavaScript-Dateien nicht zurückgeholt werden können.

Die Namensregel macht diesen Fehler **unmöglich statt verboten**: Ohne `VITE_`-Präfix packt Vite die Variable gar nicht ein.

Dazu kommt eine ehrliche Fußnote:

```markdown
**Ausdrücklich benannt:** Der bisherige publishable key bleibt in der Git-Historie. Das ist
folgenlos — er ist öffentlich (siehe E13) — soll aber nicht später für ein Versäumnis
gehalten werden.
```

Und ein Ausblick auf die Falle, in die man bei so einem Setup tappt:

```markdown
In v1 gibt `is_staff()` hart `false` zurück; alles Administrative läuft über den
Service-Role-Key. Der Tag, an dem jemand diesen Key ins Frontend legt, weil „der
Admin-Bereich sonst nicht geht", ist der Tag, an dem RLS wertlos wird. Der Ausweg ist dann
nicht der Key, sondern der in E13 benannte Seam: `is_staff()` an genau einer Stelle ändern.
```

## 5. `E36` – die Tutorial-Tabelle `posts` bleibt, aber sichtbar markiert

Ein kleines, praktisches Problem: Die Anwendung hat drei Views (`PostsView`, `SinglePostView`, `AdminPostsView`), die aus der Tabelle `posts` lesen. Diese Tabelle stammt aus einem Tutorial und gehört fachlich nicht zum Hotel. Wenn die neue Migrationshistorie bei `hotels` beginnt, existiert `posts` in der lokalen Datenbank nicht mehr – und drei Routen laufen ins Leere.

```markdown
**Entscheidung:** Die Tutorial-Tabelle `posts` bekommt eine eigene, **letzte** Migration mit
Kommentarkopf „Kurs-Spike, nicht Teil der Domäne" plus Seed-Zeilen.

**Begründung:** … Ein Kursprojekt, in dem die Hälfte der Routen bricht, ist als Lehrmaterial
wertlos. Als eigene, klar gekennzeichnete Migration bleibt sichtbar, dass sie nicht zur
Domäne gehört, und ihr Entfernen ist später ein `git rm` plus eine Drop-Migration.
```

Das ist eine brauchbare Technik für Altlasten generell: Nicht verstecken und nicht wegwerfen, sondern **klar als Altlast markieren** und den Weg zum Entfernen aufschreiben.

## 6. Die Vorgehensentscheidungen `V1`–`V7`

Der neue Abschnitt `0b` im Umsetzungsplan enthält sieben Entscheidungen über die Arbeitsweise. Vier davon prägen alles Folgende:

```markdown
| **V2** | Die bestehende Cloud-Instanz ist ein **Wegwerf-Spike**. Die Migrationshistorie
beginnt bei `hotels`; **kein** `supabase db pull`. | Ein `db pull` würde die Spike-Tabelle
`posts` für immer als Migration 0 zementieren. |

| **V3** | **RLS geht direkt nach Phase 2 an**, nicht erst in Phase 7. Seeds laufen über den
Service-Role-Key. | Sonst baut man fünf Phasen gegen eine offene Datenbank und weiß beim
Anschalten nicht mehr, welche Abfrage aus welchem Grund leer ist. |

| **V4** | **Minimalseed:** 1 Hotel, 3 Kategorien, 8 Zimmer, Rate-Plan `STANDARD`, 12 Monate
Preise, **null Buchungen**. `hotels.booking_horizon_days` im Seed auf **365**. | Der
Horizont-Default 540 würde bei 12 Monaten Preisen ~5 Monate „nicht buchbar" erzeugen —
korrekt laut E25, sieht aber aus wie ein Bug. |

| **V6** | Ein Themenbranch, **ein Commit pro Phase**. | Sieben PRs für sieben aufeinander
aufbauende Migrationen sind Zeremonie ohne Nutzen. |
```

`V3` verdient eine eigene Betrachtung, weil sie eine sehr verbreitete Reihenfolge umdreht. Der übliche Weg ist: erst alles bauen, dann Zugriffskontrolle „drüberlegen". Das Problem daran ist diagnostischer Natur. Sobald RLS aktiv ist, liefert eine Abfrage **null Zeilen statt eines Fehlers** – das ist der Sinn von RLS. Wenn man fünf Phasen lang ohne RLS entwickelt und es dann anschaltet, sind plötzlich zehn Abfragen leer, und man weiß bei keiner, ob eine Policy fehlt, ob die Daten fehlen oder ob die Abfrage falsch ist.

Wird RLS dagegen von Anfang an mit jeder Tabelle gemeinsam angelegt, kann immer nur die **eine gerade neue** Tabelle schuld sein.

`V4` zeigt eine feine Beobachtung über Testdaten: Der Buchungshorizont (wie weit im Voraus man buchen kann) hat standardmäßig 540 Tage, der Seed legt aber nur 12 Monate Preise an. Das Ergebnis wäre ein Kalender, der fünf Monate lang „nicht buchbar" zeigt – laut Schema völlig korrekt (`E25`: keine Preiszeile = nicht buchbar), aber von einem Fehler nicht zu unterscheiden. Also wird der Horizont im Seed auf 365 gesetzt.

**Seed-Daten sollen die Anwendung nicht nur füllen, sondern plausibel aussehen lassen** – sonst verbringt man Stunden mit der Suche nach Bugs, die es nicht gibt.

## 7. Nebenbei: ein toter Verweis und ein `text`-Fence

Zwei kleine Aufräumarbeiten, die man leicht überliest:

```diff
-Vor jeder Phase: **Branch anlegen** (dieses Repo arbeitet mit Themenbranches, siehe
-`FORK-WORKFLOW.md`).
+**Branch- und Commit-Schnitt (V6):** Phasen 1–7 laufen auf **einem** Themenbranch
+(`datenbank-anbindung`), **ein Commit pro Phase**. …
+(Der frühere Verweis auf `FORK-WORKFLOW.md` ist entfernt: diese Datei existiert im Repo nicht.)
```

Der Plan verwies auf eine Datei, die es nie gab. Solche toten Verweise sind in Dokumentation heimtückisch, weil sie Vertrauen kosten: Wer einem Link folgt und ins Leere läuft, glaubt dem Rest des Dokuments auch weniger.

Außerdem bekommen mehrere Code-Blöcke eine Sprachkennung:

````diff
-```
+```text
 Nacht:        3.   4.   5.   6.
````

Ein Code-Block ohne Kennung wird von manchen Werkzeugen geraten und dann falsch eingefärbt. `text` sagt ausdrücklich: hier ist keine Programmiersprache, färbe nichts ein.

## Was wurde erreicht?

Der Entscheidungsbaum ist mit `E36` vollständig, die Vorgehensfragen sind mit `V1`–`V7` geklärt, und beide Nummernreihen sind sauber getrennt. Der Umsetzungsplan sagt jetzt nicht nur, _was_ in welcher Phase passiert, sondern auch, auf welchem Branch, in wie vielen Commits, mit welchen Testdaten und ab wann mit aktivem RLS.

Damit ist die Vorarbeit abgeschlossen. Ab dem nächsten Commit entsteht Code – und zwar genau in der Reihenfolge, die dieser Plan vorgibt: eine Phase, ein Commit.

Eine letzte Beobachtung zu diesem Commit als Ganzes: Er ändert `schema.md`, **bevor** irgendetwas gebaut ist. Genau das ist `V7`:

```markdown
| **V7** | Dokumentation wird **vor** der ersten Migration fortgeschrieben, nicht danach. |
Migrationen kann man später lesen, Begründungen nicht rekonstruieren. |
```

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](003_2026-09-02_phase-1-cli-umgebungstrennung-testgeruest.md)
