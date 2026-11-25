[← Vorheriger Commit](../014_2026-11-25_room-slider/003_2026-11-25_nach-navigation-oben-starten.md) · [↑ Branch-Übersicht](../015_2026-11-25_staff-roles.md) · [📓 Index](../000_index.md)

# docs: mitarbeitende und rollen planen (E52–E54, phase 11)

- **Commit:** `b5463c1`
- **Datum:** 2026-11-25
- **Autor:** Oliver Jung (Co-Author: Claude)

## Worum geht es?

Bevor eine einzige Zeile SQL entsteht, wird **geplant und entschieden**: Wie sollen Mitarbeitende und ihre Rollen in der Datenbank abgebildet werden, wer darf was, und wie verhindert man, dass sich das Hotel aus seiner eigenen Verwaltung aussperrt?

```text
 GLOSSARY.md                      |  42 ++++++++
 docs/datenbank/README.md         | 167 +++++++++++++++++++++++++++++-
 docs/datenbank/schema.md         |  61 ++++++++++-
 docs/datenbank/umsetzungsplan.md | 212 ++++++++++++++++++++++++++++++++++++++-
 4 files changed, 470 insertions(+), 12 deletions(-)
```

Die vier Dateien haben unterschiedliche Aufgaben – ein Muster, das das Projekt seit der Datenbank-Planung (Branch `datenbank-anbindung`) verfolgt:

| Datei                              | Rolle                                                                 |
| ---------------------------------- | --------------------------------------------------------------------- |
| `GLOSSARY.md` (neu)                | Begriffe: Was bedeutet ein Wort, welches Wort vermeidet man?          |
| `docs/datenbank/README.md`         | Entscheidungsprotokoll: **was** entschieden wurde und **warum**       |
| `docs/datenbank/schema.md`         | normatives Schema: **wie** Tabellen, Funktionen und Policies aussehen |
| `docs/datenbank/umsetzungsplan.md` | Arbeitsplan: **in welcher Reihenfolge** gebaut und getestet wird      |

## Die Änderungen im Detail

### 1. Ein Glossar für die Fachsprache

Datei: `GLOSSARY.md` (neu, im Projektwurzelverzeichnis)

Bei Rechten und Konten werden Wörter schnell unscharf. Ist ein „Benutzer" ein Gast? Ein Mitarbeiter? Beides? Das Glossar legt die Begriffe fest:

```markdown
**Benutzerkonto**:
Eine Anmeldeidentität (E-Mail und Passwort) bei Supabase Auth. Es sagt nur, _wer_ sich angemeldet
hat, nicht _was_ die Person darf.
_Vermeiden_: User, Account, Profil

**Kunde**:
Eine Person, auf deren Namen gebucht wird. Kunden gibt es auch ohne Benutzerkonto. Hat ein Kunde ein
Konto, ist es mit ihm verknüpft.

**Mitarbeiter:in**:
Ein Benutzerkonto, das zum Personal des Hotels gehört und eine **Rolle** hat. Dasselbe Konto kann
zugleich zu einem **Kunden** gehören.

**Admin**:
Ein:e aktive:r Mitarbeiter:in mit der Rolle `admin`. Nur Admins verwalten das Personal. Es gibt immer
mindestens einen aktiven Admin.
_Vermeiden_: Superuser, Root, Service-Role
```

Die Zeile **„_Vermeiden_"** ist das Besondere: Sie nennt die Wörter, die zu Verwechslungen führen. Wer im Code `profile` liest, denkt an etwas anderes als `staff_member` – also wird das Wort gar nicht erst benutzt. Dieses Vorgehen stammt aus dem _Domain-Driven Design_ und heißt dort _Ubiquitous Language_: eine gemeinsame Sprache für Fachleute, Doku und Code.

### 2. Die Entscheidungen E52–E54

Datei: `docs/datenbank/README.md`

Die Grilling-Runde 12 beantwortet zwölf Fragen (Q1–Q12) und fasst die Ergebnisse zu drei Entscheidungen zusammen. Jede folgt demselben Aufbau: **Entscheidung – Begründung – Verworfen**.

#### E52 – Eigene Tabellen statt einer `profiles`-Tabelle

Geplant sind zwei Tabellen:

```text
staff_roles                       staff_members
───────────                       ─────────────
code  text PK  ('admin','staff')  id          uuid PK  → auth.users(id) on delete cascade
label text                        role        text     → staff_roles(code)
                                  first_name  text
                                  last_name   text
                                  email       text     (per Trigger aus auth.users)
                                  is_active   boolean  default true
```

Viele Supabase-Tutorials legen eine Tabelle `profiles` für alle Benutzer an und schreiben die Rolle dort hinein. Hier wurde das **verworfen**, mit dieser Begründung:

> Eine gemeinsame `profiles`-Tabelle für Gäste und Personal würde genau die Trennung wieder aufheben, die E4 billig gemacht hat. Gäste existieren ohne Konto, Personal nie.

Und warum eine Nachschlagetabelle `staff_roles` statt eines Postgres-`ENUM`?

> Für die Nachschlagetabelle spricht, dass Abteilungsrollen angekündigt sind (Rezeption, Housekeeping, Buchhaltung …). Werte aus einem Postgres-Enum lassen sich nur umständlich wieder entfernen.

Eine neue Rolle ist damit eine neue **Zeile**, keine Schemaänderung.

#### E53 – Die Rechteprüfung an genau einer Stelle

Seit E13 prüfen alle RLS-Policies Personalrechte nur über `is_staff()`. Das war bisher ein Platzhalter mit `false`. Jetzt wird entschieden, was darin stehen soll:

```text
current_staff_member_id()  →  id des angemeldeten Kontos, wenn aktive Zeile in staff_members, sonst null
is_staff()                 =  current_staff_member_id() is not null
is_admin()                 =  aktiv und role = 'admin'
```

Das ist der Lohn einer früheren Entscheidung: Weil die Prüfung an **einer** Stelle steckt, gelten nach dem Umbau dieser einen Funktion sofort alle rund 25 bestehenden Policies für das neue Personal. Die Doku listet dazu ausdrücklich auf, was sich dadurch ändert:

| Stelle                                       | vorher                    | nachher (angemeldet als aktives Personal) |
| -------------------------------------------- | ------------------------- | ----------------------------------------- |
| Schreib-Policies auf Stammdaten, Preisen, …  | niemand außer Service-Key | jede:r Mitarbeiter:in                     |
| Lese-Policies auf `customers`, `bookings`, … | nur eigene                | alle                                      |
| anonym, angemeldeter Gast, `service_role`    | —                         | **unverändert**: `is_staff()` = `false`   |

Bewusst grob: Die Rolle `staff` darf vorerst alles, was hinter `is_staff()` liegt. Der **Upgrade-Pfad** ist aber schon benannt: Bevor eine dritte Rolle dazukommt, wird `is_staff()` in _Fähigkeitsfunktionen_ wie `can_manage_rates()` aufgeteilt – sonst bekäme jede neue Rolle automatisch alle Rechte.

#### E54 – Nie ohne Admin

Ein Trigger auf `staff_members` soll zwei Regeln durchsetzen:

1. **Invariante:** Eine Änderung, nach der es keinen aktiven Admin mehr gäbe, wird abgelehnt (Fehlercode `letzter_admin`).
2. **Selbstschutz:** Ein angemeldeter Admin darf sich nicht selbst herabstufen, deaktivieren oder löschen (Fehlercode `eigene_admin_rechte`).

Warum beides? Die Begründung zeigt ein typisches Denkmuster für Datenbankregeln:

> Der Selbstschutz ist billiger Unfallschutz in der Oberfläche. Er allein reicht aber nicht: Zwei Admins können sich gegenseitig herabstufen, und eine Kaskade von `auth.users` kennt keinen „selbst". Ein `CHECK` kann keine Aussage über andere Zeilen treffen, deshalb ein Trigger.

Und gegen den Fall, dass zwei Admins **gleichzeitig** den jeweils anderen herabstufen, nimmt der Trigger einen transaktionsweiten _Advisory Lock_ – sonst würden beide Zählprüfungen „es gibt noch einen anderen Admin" bestehen, und am Ende gäbe es keinen. Dieselbe Technik schützt im Projekt schon `create_booking` vor Doppelbuchungen (E33).

### 3. Das geplante Schema

Datei: `docs/datenbank/schema.md`

Das normative Schema bekommt die neuen Tabellen bereits jetzt, aber deutlich markiert:

```diff
-> Begründung jeder Entscheidung: [README.md](./README.md) (E1–E51).
+> Begründung jeder Entscheidung: [README.md](./README.md) (E1–E54).
+> **Geplant, noch nicht umgesetzt:** Mitarbeitende und Rollen (E52–E54, Phase 11). Alles dazu ist unten
+> mit „geplant (Phase 11)" markiert.
```

Im ER-Diagramm (Mermaid) kommen zwei Beziehungen dazu:

```diff
     AUTH_USERS |o--o| CUSTOMERS : "Konto (optional, spaeter)"
+    AUTH_USERS ||--o| STAFF_MEMBERS : "Personal (geplant, Phase 11)"
+    STAFF_ROLES ||--o{ STAFF_MEMBERS : "Rolle"
```

Und die RLS-Tabelle zeigt, wer die neuen Tabellen lesen und schreiben darf:

```diff
+| `staff_roles` (geplant) | `is_staff()` | `is_admin()` |
+| `staff_members` (geplant) | eigene Zeile (`current_staff_member_id()`) oder `is_admin()` | `is_admin()` — Grenzen setzt der Trigger (E54) |
```

Mitarbeitende sehen also ihre eigene Zeile, nur Admins sehen und ändern alle.

### 4. Phase 11 im Umsetzungsplan

Datei: `docs/datenbank/umsetzungsplan.md`

Der größte Teil des Commits (212 Zeilen) beschreibt die Umsetzung in vier Schritten – jeder ein eigener Commit, der für sich `pnpm db:reset` überstehen muss:

1. **Migration** `…_staff_members.sql`: Tabellen, Funktionen, Trigger, RLS – in einer Reihenfolge, die die Abhängigkeiten respektiert (Funktionen brauchen die Tabelle, Policies die Funktionen).
2. **Seed, `.env.example`, README:** ein lokaler Admin `admin@karawanken-hof.local` für die Entwicklung.
3. **Tests:** neue Datei `staff-members.spec.ts` mit 23 Fällen.
4. **Typen, Prüfungen, Doku** nachziehen.

Ein Detail aus Schritt 1 zeigt, wie konkret der Plan ist:

```text
9. Schutzregeln (E54): Triggerfunktion guard_staff_member_admins(), before update or delete,
   security definer, search_path = '':
   - Betroffen ist eine Zeile nur, wenn sie vorher ein aktiver Admin war
     (old.role = 'admin' and old.is_active) und danach keiner mehr ist …
   - Selbstschutz: old.id = auth.uid() → raise exception 'eigene_admin_rechte' using errcode = 'P0001'
   - Invariante: perform pg_advisory_xact_lock(hashtext('staff_members.admins')), danach
     zählen: aktive Admins mit id <> old.id. Ist das null, dann raise exception 'letzter_admin' …
```

Die Testfälle sind als Tabelle vorbereitet, zum Beispiel:

| #   | Fall                                                                         | erwartet                     |
| --- | ---------------------------------------------------------------------------- | ---------------------------- |
| 7   | anonym: `select` auf `staff_members`                                         | **0 Zeilen**, kein Fehler    |
| 12  | `staff`: `update` der eigenen `role` auf `admin`                             | 0 betroffene Zeilen          |
| 17  | Seed-Admin stuft sich selbst herab / deaktiviert sich / löscht sich          | Fehler `eigene_admin_rechte` |
| 18  | `serviceClient` stuft den Seed-Admin herab, während er der einzige Admin ist | Fehler `letzter_admin`       |

Fall 7 und 12 sind lehrreich: **RLS filtert, es blockt nicht.** Ein `select` auf eine verbotene Tabelle liefert keine Fehlermeldung, sondern einfach keine Zeilen. Ebenso wirft ein `update`, das RLS ausfiltert, keinen Fehler – es betrifft nur null Zeilen. Ein Test muss deshalb hinterher den tatsächlichen Zustand prüfen, nicht nur auf einen Fehler warten.

Eine wichtige Sicherheitsregel wird gleich mehrfach festgehalten (V18):

```diff
+5. **Niemals** `supabase db push --include-seed` (V18): `seed.sql` enthält den lokalen Admin mit
+   bekanntem Passwort. Admins der Cloud entstehen nur über die spätere Edge Function (E52–E54)
```

Ein Passwort, das im Repository steht, ist nur für die lokale Entwicklung akzeptabel – niemals in der Cloud-Datenbank.

Ausdrücklich **nicht** Teil von Phase 11 sind Admin-Login im Frontend, Routenschutz für `/admin*`, die Oberfläche der Benutzerverwaltung und die Edge Function. Den Umfang klar abzugrenzen ist genauso wichtig wie ihn zu beschreiben.

## Was wurde erreicht?

Die Grundlage für Mitarbeitende und Rollen ist vollständig **entschieden und dokumentiert**, aber noch nicht gebaut. Wer Phase 11 umsetzt, findet Begriffe, Begründungen, Zielschema, Reihenfolge, Testfälle und Abnahmekriterien an einem Ort.

Für Lernende zeigt der Commit eine Arbeitsweise, die in Schulungsprojekten oft zu kurz kommt: Bei sicherheitsrelevanten Änderungen – hier: wer darf was in der Datenbank – lohnt es sich, **erst zu schreiben, dann zu programmieren**. Fehler in einem Plan kosten einen Absatz, Fehler in RLS-Policies im schlimmsten Fall die Daten der Gäste.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../015_2026-11-25_staff-roles.md)
