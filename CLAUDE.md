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

- Client liegt in `src/shared/services/supabase.ts` und wird dort direkt mit URL/Key initialisiert (aktuell nicht aus `.env` gelesen, obwohl `VITE_SUPABASE_URL`/`VITE_SUPABASE_API_KEY` dort als Platzhalter existieren). Beim Ändern der Zugangsdaten also `supabase.ts` direkt anpassen, nicht nur `.env`.
- Datenzugriff erfolgt direkt in den Views (`onInit`/eigene `fetch*`-Methoden), keine separate Repository-/Service-Schicht pro Entität. Typen für Tabellen liegen als `*.interface.ts` neben der jeweiligen View (z. B. `src/views/PostsView/post.interface.ts`).

### Styling

- Tailwind v4 wird über `@import 'tailwindcss'` in `src/style.css` eingebunden; Theme-Werte (Farben, Fonts, Font-Größen, **eigene Breakpoint-Namen**: `456`, `576`, `768`, `992`, `1140`, `1440`, `1920`) werden im `@theme`-Block definiert und dann als Utility-Klassen genutzt (z. B. `768:flex`, `text-24`, `text-purple-haze-dark`).
- Eigene Fonts liegen unter `src/assets/fonts`, eingebunden über `src/css/fonts.css`.
- Neben Tailwind-Utilities gibt es pro View/Layout ergänzende CSS-Dateien für Fälle, die sich nicht sinnvoll mit Utilities abbilden lassen (z. B. `activities__*`-Klassen in `home.css` für die Radio-Button-Tabs, `.mobile-menu__*` in `layout.css`).

### Admin-Bereich

- `/admin*`-Routen nutzen `AdminLayout` statt `MainLayout`. Aktuell existiert kein Auth-Schutz für diese Routen – der Login-Link im Footer führt lediglich zu `/admin`.

## Code-Konventionen

- TypeScript ist strikt konfiguriert (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, u. a. – siehe `tsconfig.json`). ESLint erzwingt zusätzlich `strictTypeChecked` von typescript-eslint sowie explizite Rückgabetypen für Funktionen (`@typescript-eslint/explicit-function-return-type`).
- Prettier läuft als ESLint-Regel (nicht nur als Formatter) – `pnpm lint` schlägt bei Formatierungsabweichungen fehl. Kernwerte: 4 Spaces, Single Quotes, Semikolons, `printWidth: 180` (siehe `.prettierrc`).
- Synchrone Methoden ohne `await` im Body, die aber die `ViewInstance`-Schnittstelle (`Promise<...>`) erfüllen müssen, bekommen `// eslint-disable-next-line @typescript-eslint/require-await` – das ist ein bewusstes, wiederkehrendes Muster in den Views, kein Einzelfall zum Beheben.
