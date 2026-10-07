# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projektüberblick

Hotelanwendung ("Karawanken Hof") – eine Single-Page-Application ohne Frontend-Framework: reines TypeScript, ein selbstgeschriebener Router und String-Templates für HTML. Build-Tool ist Vite, Styling erfolgt über Tailwind CSS v4, das Backend ist Supabase. Das Projekt ist ein Lern-/Kursprojekt (Developer Akademie); der `.projekt-tagebuch/`-Ordner dokumentiert jeden Branch/Commit auf Deutsch für Lernende – bei größeren Änderungen lohnt ein Blick hinein für Kontext, muss aber nicht aktiv gepflegt werden, sofern nicht explizit verlangt.

## Befehle

Paketmanager ist **pnpm** (siehe `pnpm-lock.yaml`).

```bash
pnpm install       # Abhängigkeiten installieren
pnpm dev           # Vite-Dev-Server (öffnet automatisch den Browser)
pnpm build         # tsc (Type-Check, kein Emit) + Vite-Production-Build nach dist/
pnpm preview       # Production-Build lokal testen
pnpm test          # Vitest
pnpm lint          # ESLint über das gesamte Repo
pnpm lint:fix      # ESLint mit Autofix
pnpm format        # Prettier über das gesamte Repo
```

Einzelnen Test ausführen: `pnpm vitest run <pfad-oder-name>` bzw. `pnpm vitest -t "<testname>"`.

Es gibt keine separate `vitest.config.ts` – Vitest nutzt die Standardkonfiguration und findet `*.spec.ts`-Dateien im gesamten Projekt.

## Architektur

### Einstiegspunkt & Routing

- `src/index.html` enthält nur `<div id="layout-wrapper"></div>`; alles andere wird zur Laufzeit von `src/main.ts` gerendert.
- `src/main.ts` definiert die Route-Tabelle (`Route[]`) und instanziiert den `Router` aus `src/router/router.ts`.
- Der `Router` ist eine selbstgeschriebene History-API-Implementierung (kein externes Routing-Paket):
    - Matched Pfade per Regex (`pathToRegex`), unterstützt `:param`-Segmente.
    - Unterscheidet `kind: 'static'` (View ohne Konstruktor-Argumente) und `kind: 'dynamic'` (View erhält geparste `Params`) – Typen dazu in `src/router/router.interface.ts`.
    - Wählt das Layout anhand des Pfads: alles unter `/admin` bekommt `AdminLayout`, alles andere `MainLayout` (`src/views/LayoutViews/`). Das Layout-HTML enthält selbst ein `#content`-Element, in das die eigentliche View gerendert wird.
    - Interne Links müssen `data-link` als Attribut tragen, damit Klicks vom Router abgefangen werden (`event.preventDefault()` + `pushState`) statt einen vollen Seitenreload auszulösen.
    - Normalisiert Pfade mit trailing slash (leitet `/foo/` auf `/foo` um).

### Views

- Jede View erbt von `AbstractView` (`src/views/AbstractView.ts`) und implementiert bei Bedarf:
    - `onInit()` – async Vorbereitung/Datenladen, wird vor dem Rendern aufgerufen.
    - `getHtml()` – gibt HTML als Template-String zurück (Kommentar `/*html*/` vor Template-Strings wird für Editor-Syntaxhighlighting genutzt, wo vorhanden).
    - `afterRender()` – wird nach dem Einfügen ins DOM aufgerufen, hier werden Event-Listener gebunden (Beispiel: `BookingView`).
    - Dynamische Views erhalten `params: Record<string, string>` im Konstruktor (Beispiel: `SinglePostView`).
- Views liegen unter `src/views/<Name>View/<Name>.ts`, oft mit einer eigenen `<name>.css` daneben, die per Import in der `.ts`-Datei eingebunden wird.
- Es gibt bislang keine Wiederverwendungs-/Komponentenschicht – jede View baut ihr HTML komplett selbst als String zusammen (inkl. Tailwind-Klassen direkt im Markup).

### Supabase

- Client liegt in `src/shared/services/supabase.ts` und liest `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` aus der `.env` im Projektwurzelverzeichnis (Vorlage: `.env.example`; `vite.config.ts` setzt dafür `envDir: '..'`). Fehlt eins davon, wirft der Client beim Start. Zugangsdaten also nur in der `.env` ändern. `SUPABASE_SERVICE_ROLE_KEY` bekommt bewusst kein `VITE_`-Präfix – er umgeht RLS und darf nie ins Frontend gebündelt werden.
- Service-Schicht unter `src/shared/services/`: `booking.service.ts` kapselt den RPC `create_booking` (Mapping camelCase → `p_*`, Laufzeitprüfung der Antwort). Ablehnungen aus `reject_booking` kommen als Ergebnis `{ ok: false, error }` zurück, alle anderen Fehler werden als `BookingFailedError` geworfen – mit `outcomeUnknown`, falls die Buchung trotzdem angelegt sein kann (V15). Zustand der Buchungsseite liegt in `src/shared/state/bookingState.ts`.
- Ziel laut `docs/datenbank/umsetzungsplan.md` (V9, Phase 8.4): `supabase` wird nur noch innerhalb von `services/` importiert. Aktuell greifen `Booking.ts` (Lesezugriffe auf `room_types`, `services`, `hotels`, `search_availability`, Storage-URLs) sowie `Posts.ts`/`SinglePost.ts` noch direkt zu – neue Datenzugriffe deshalb als Service-Funktion anlegen, nicht in der View. Typen für Tabellen liegen derzeit als `*.interface.ts` neben der jeweiligen View (z. B. `src/views/BookingView/room.interface.ts`), generierte Typen (`pnpm db:types`) stehen noch aus. Typen, die mehrere Schichten nutzen, liegen in `src/shared/types/booking.types.ts`: Mengen (`RoomQuantities`, `ServiceQuantities`), `ServiceRow` sowie der Vertrag mit `create_booking` (`BookingRequest`, `CustomerDetails`, `Address` …). Fachlogik, Store, View und Service importieren von dort – die Fachlogik nichts aus `bookingState`, und View-Typen werden aus `BookingRequest` abgeleitet statt kopiert.

### Styling

- Tailwind v4 wird über `@import 'tailwindcss'` in `src/style.css` eingebunden; Theme-Werte (Farben, Fonts, Font-Größen, **eigene Breakpoint-Namen**: `456`, `576`, `768`, `992`, `1140`, `1440`, `1920`) werden im `@theme`-Block definiert und dann als Utility-Klassen genutzt (z. B. `768:flex`, `text-24`, `text-purple-haze-dark`).
- Eigene Fonts liegen unter `src/assets/fonts`, eingebunden über `src/css/fonts.css`.
- Neben Tailwind-Utilities gibt es pro View/Layout ergänzende CSS-Dateien für Fälle, die sich nicht sinnvoll mit Utilities abbilden lassen (z. B. `activities__*`-Klassen in `home.css` für die Radio-Button-Tabs, `.mobile-menu__*` in `layout.css`).

### Sicherheit (XSS)

Weil alle Views ihr HTML als String bauen und per `innerHTML` einsetzen, ist XSS das Hauptrisiko. Zwei Schichten schützen davor:

- **Escapen beim Einsetzen:** Jeder Wert, der nicht wörtlich im Quelltext steht (Datenbank, Route-Params/URL, Supabase-Fehlermeldungen, alles daraus Zusammengesetzte wie Hinweistexte mit Zimmernamen), geht nur über `escapeHtml()` aus `src/shared/ui/html.ts` ins Template – in Text wie in Attributwerten (Attribute immer in doppelten Anführungszeichen). Escapt wird erst an der Ausgabe, nicht schon beim Laden/Mappen der Daten. Werte, die in eine URL gehören (z. B. eine ID im `href`), vorher zusätzlich durch `encodeURIComponent()`.
- **Fertiges Markup** (Icons, Teil-Templates, `options.html` von `openModal()`) wird nicht escapt – Funktionen, die Markup entgegennehmen, escapen deshalb ihre Text-Parameter selbst (Beispiel: `getServiceRowShellHtml` in `Booking.ts`). Mehrzeilige Werte als Liste übergeben, einzeln escapen und erst dann mit `<br>` verbinden.
- **Eingaben des Gastes** werden nicht ins Template interpoliert, sondern nach dem Rendern per `textContent` gesetzt.
- **Content-Security-Policy** als `<meta>` in `src/index.html`: nur Skripte vom eigenen Origin (keine Inline-Skripte, keine `on*`-Attribute), Netzwerk und Bilder nur zu `'self'` und `%VITE_SUPABASE_URL%` (setzt Vite beim Build/Dev-Start aus der `.env` ein). Kommt eine neue externe Quelle dazu (CDN, Fonts, weitere API), muss sie dort ergänzt werden, sonst blockiert der Browser sie. Inline-Event-Handler im Markup funktionieren deshalb nicht – Listener immer in `afterRender()` per `addEventListener` binden.

### Admin-Bereich

- `/admin*`-Routen nutzen `AdminLayout` statt `MainLayout`. Aktuell existiert kein Auth-Schutz für diese Routen – der Login-Link im Footer führt lediglich zu `/admin`.

## Code-Konventionen

- TypeScript ist strikt konfiguriert (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, u. a. – siehe `tsconfig.json`). ESLint erzwingt zusätzlich `strictTypeChecked` von typescript-eslint sowie explizite Rückgabetypen für Funktionen (`@typescript-eslint/explicit-function-return-type`).
- Prettier läuft als ESLint-Regel (nicht nur als Formatter) – `pnpm lint` schlägt bei Formatierungsabweichungen fehl. Kernwerte: 4 Spaces, Single Quotes, Semikolons, `printWidth: 180` (siehe `.prettierrc`).
- Bezeichner im Code sind durchgehend **englisch** und sprechend: Variablen, Funktionen, Typen, Konstanten, aber auch Formularfeld-`name`/`id`, `data-*`-Attribute, CSS-Klassen und Testdaten (z. B. `getInputFieldHtml`, `name="postal-code"`, nicht `getBillingFieldHtml` für alle Felder oder `name="plz"`). Der Name sagt, was die Funktion tut bzw. der Wert enthält – passt kein ehrlicher Name, ist meist der Zuschnitt falsch. Deutsch bleiben: Kommentare, Texte in der Oberfläche, die URL `/buchung` sowie Werte, die die Datenbank vorgibt (Ablehnungs-Codes wie `ausgebucht`, JSON-Schlüssel `datum`/`grund` aus `reject_booking`) – deren Umbenennung bräuchte eine Migration. Diese Datenbank-Codes stehen als Union-Typ mit Prüffunktion in `src/shared/types/booking.codes.ts` (`isRejectionCode`, `isUnavailableReason` an der Grenze), ihre Texte als `Record` in `src/views/BookingView/messages.ts` – kein `switch` auf rohe Strings.
- Werte von außen in HTML-Templates nur über `escapeHtml()` – kein Linter prüft das, es ist Review-Pflicht (Details unter „Sicherheit (XSS)").
- Synchrone Methoden ohne `await` im Body, die aber die `ViewInstance`-Schnittstelle (`Promise<...>`) erfüllen müssen, bekommen `// eslint-disable-next-line @typescript-eslint/require-await` – das ist ein bewusstes, wiederkehrendes Muster in den Views, kein Einzelfall zum Beheben.
