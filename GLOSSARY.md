# Karawanken Hof

Hotelanwendung für ein einzelnes Hotel: Gäste buchen Zimmerkategorien online, das Personal pflegt
Stammdaten, Preise und Buchungen. Begründungen zu den Begriffen stehen in
[`docs/datenbank/README.md`](./docs/datenbank/README.md).

## Personen und Konten

**Benutzerkonto**:
Eine Anmeldeidentität (E-Mail und Passwort) bei Supabase Auth. Es sagt nur, _wer_ sich angemeldet
hat, nicht _was_ die Person darf.
_Vermeiden_: User, Account, Profil

**Kunde**:
Eine Person, auf deren Namen gebucht wird. Kunden gibt es auch ohne Benutzerkonto. Hat ein Kunde ein
Konto, ist es mit ihm verknüpft.
_Vermeiden_: Gastkonto, Kundenprofil (für die Tabelle), Benutzer

**Gast**:
Wer auf der öffentlichen Seite bucht oder im Hotel übernachtet. In Datenbank und Code heißt er
**Kunde**.
_Vermeiden_: Besucher

**Mitarbeiter:in**:
Ein Benutzerkonto, das zum Personal des Hotels gehört und eine **Rolle** hat. Dasselbe Konto kann
zugleich zu einem **Kunden** gehören.
_Vermeiden_: Staff-Profil, Benutzer, Angestellte:r

**Aktiv**:
Ein:e Mitarbeiter:in, die gerade Personalrechte hat. Wer deaktiviert ist, bleibt erhalten, hat aber
keine Rechte mehr.
_Vermeiden_: gesperrt, freigeschaltet

**Rolle**:
Die eine Funktion, die ein:e Mitarbeiter:in im Hotel hat und aus der ihre Rechte folgen. Zurzeit gibt
es `admin` und `staff`. Später kommen Rollen nach Abteilung dazu.
_Vermeiden_: Gruppe, Berechtigung (das ist die feinere Ebene darunter)

**Admin**:
Ein:e aktive:r Mitarbeiter:in mit der Rolle `admin`. Nur Admins verwalten das Personal. Es gibt immer
mindestens einen aktiven Admin.
_Vermeiden_: Superuser, Root, Service-Role
