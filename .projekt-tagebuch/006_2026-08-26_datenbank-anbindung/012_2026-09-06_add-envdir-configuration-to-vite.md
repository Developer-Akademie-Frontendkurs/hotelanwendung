[← Vorheriger Commit](011_2026-09-04_clear-sensitive-keys-in-env-example.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [📓 Index](../000_index.md)

# feat(config): add envDir configuration to Vite for proper environment variable loading

- **Commit:** `227ad78`
- **Datum:** 2026-09-06
- **Autor:** Oliver Jung

## Worum geht es?

Der letzte Commit des Branches – und ein **Vier-Zeilen-Fix für einen Fehler, der drei Phasen lang unentdeckt geblieben ist**. Seit Phase 1 liest `src/shared/services/supabase.ts` seine Zugangsdaten aus `import.meta.env`. Nur: Vite hat die `.env` nie gelesen.

```text
 pnpm-lock.yaml | 135 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 vite.config.ts |   4 ++
 2 files changed, 139 insertions(+)
```

Von den 139 Zeilen sind **vier** von Hand geschrieben. Die 135 Zeilen in `pnpm-lock.yaml` sind der nachgezogene Lockfile-Eintrag für die in Phase 1 aufgenommene Abhängigkeit `supabase` (die CLI) samt ihren plattformspezifischen Binärpaketen – kein inhaltlicher Bestandteil des Commits, aber ein guter Anlass, das Muster zu erkennen (dazu unten).

## Die Änderung im Detail

### `vite.config.ts`

```diff
 export default defineConfig({
     plugins: [tailwindcss()],
     root: 'src',
+    // `envDir` ist standardmaessig gleich `root` — mit `root: 'src'` wuerde Vite die `.env`
+    // also in `src/` suchen und die im Projektwurzelverzeichnis nie laden. Relativ zu `root`
+    // aufgeloest zeigt '..' zurueck auf die Wurzel, wo `.env` und `.env.example` liegen (E35).
+    envDir: '..',
     build: {
```

Drei Zeilen Kommentar, eine Zeile Konfiguration. Das Verhältnis ist Absicht: Wer die Zeile `envDir: '..'` ohne Erklärung liest, kann sie nicht von einem Tippfehler unterscheiden.

## Warum der Fehler entstehen konnte

Dieses Projekt hat eine ungewöhnliche Verzeichnisstruktur: Der Einstiegspunkt `index.html` liegt **nicht** im Projekt-Root, sondern in `src/`. Deshalb steht in der Konfiguration `root: 'src'`.

```text
hotelanwendung/
├── .env                 ← Werte (gitignored)
├── .env.example         ← Struktur
├── vite.config.ts
├── package.json
└── src/                 ← Vites `root`
    ├── index.html
    ├── main.ts
    └── shared/services/supabase.ts
```

Und jetzt die Regel, die den Fehler erzeugt: **`envDir` ist standardmäßig gleich `root`.** Vite suchte die `.env` also in `src/` – dort, wo keine liegt und (nach jeder üblichen Konvention) auch keine liegen soll.

Der Wert `'..'` wird **relativ zu `root`** aufgelöst, zeigt also von `src/` aus zurück in das Projektverzeichnis. Genau dorthin, wo `.env` und `.env.example` tatsächlich liegen.

> **Merksatz:** Sobald du `root` in einer Vite-Konfiguration setzt, wandern gleich mehrere Standardpfade mit – `envDir`, `publicDir` und `build.outDir`. Der `outDir` war in diesem Projekt schon von Anfang an angepasst (`outDir: '../dist'`), der `envDir` nicht. Das ist ein typisches „halb umgezogen".

## Die interessantere Frage: Warum ist es niemandem aufgefallen?

Der Client wirft bei fehlenden Werten ausdrücklich einen Fehler:

```ts
// src/shared/services/supabase.ts
const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY fehlen. Lege eine .env nach dem Muster von .env.example an und starte die Datenbank mit `pnpm db:start`.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
```

Diese Prüfung ist gut gemacht: Sie schlägt **früh** zu (beim Import des Moduls, nicht bei der ersten Abfrage) und ihre Meldung nennt die Lösung. Und trotzdem war der Fehler drei Phasen lang unsichtbar – aus einem sehr lehrreichen Grund:

| Was in den Phasen 1–7 lief      | Liest es `import.meta.env`?               |
| ------------------------------- | ----------------------------------------- |
| `pnpm db:reset` (Migrationen)   | nein – Supabase CLI, eigene Konfiguration |
| `pnpm test:db` (91 Tests)       | nein – Node/Vitest lesen `process.env`    |
| `pnpm build` (`tsc` + Vite)     | nein – Typen prüfen keine Laufzeitwerte   |
| `pnpm dev` und die Seite öffnen | **ja** – und nur hier knallt es           |

Die gesamte Arbeit des Branches fand in der Datenbank und in Node-Tests statt. Der Browser wurde in dieser Zeit gar nicht gebraucht. Der Fehler lag also nicht in dem Teil, der gerade gebaut wurde, sondern in dem Teil, der auf den fertigen Teil warten sollte.

**Die übertragbare Lehre:** Ein sauber getrennter Testaufbau (hier `pnpm test` ohne Docker, `pnpm test:db` gegen die lokale Instanz – Entscheidung `E34`) ist wertvoll, aber er prüft nur, was er anfasst. 91 grüne Tests sagen nichts darüber, ob die Anwendung im Browser startet. Genau deshalb steht in den Abschlusskriterien des Umsetzungsplans für die Frontend-Phasen ausdrücklich „die Seite verhält sich im Browser wie vorher" – ein Kriterium, das kein Testlauf ersetzt.

## Was die 135 Lockfile-Zeilen erzählen

`pnpm-lock.yaml` bekommt in diesem Commit den Eintrag für die Abhängigkeit, die in Phase 1 der `package.json` hinzugefügt wurde:

```text
      supabase:
        specifier: ^2.116.0
        version: 2.116.0
```

Und dazu die plattformspezifischen Binärpakete der CLI:

```text
  '@supabase/cli-darwin-arm64@2.116.0':
  '@supabase/cli-darwin-x64@2.116.0':
  '@supabase/cli-linux-arm64@2.116.0':
  '@supabase/cli-linux-arm64-musl@2.116.0':
  '@supabase/cli-linux-x64-musl@2.116.0':
  …
```

Zwei Dinge, die man daran lernen kann:

1. **Der Lockfile gehört ins Repository und muss zum Commit der `package.json` passen.** Hier ist er einen Commit zu spät – das passiert, wenn man `package.json` von Hand editiert und `pnpm install` erst später ausführt. Die Folge: Zwischen `cdb1af7` und `227ad78` gibt es einen Stand, auf dem `pnpm install --frozen-lockfile` (der Standard in CI-Umgebungen!) fehlschlägt.
2. **Warum so viele Pakete für ein Werkzeug?** Die Supabase-CLI ist ein in Go geschriebenes Binärprogramm. npm-Pakete können keine plattformabhängigen Binärdateien in einem Paket bündeln, ohne alle mitzuliefern – deshalb gibt es ein Paket pro Betriebssystem/Architektur (`darwin-arm64`, `linux-x64-musl`, …), und `optionalDependencies` mit `os`/`cpu`-Feldern sorgen dafür, dass nur das passende installiert wird. Dasselbe Muster findet man bei esbuild, SWC oder Rollup.

## Was wurde erreicht?

`pnpm dev` startet die Anwendung wieder mit funktionierendem Supabase-Client – die Voraussetzung dafür, dass überhaupt jemand die Buchungsseite gegen echte Daten anschauen kann. Genau das passiert im **nächsten** Branch: [`buchungsseite-ui-fertigstellen`](../007_2026-09-06_buchungsseite-ui-fertigstellen.md) zweigt direkt von diesem Commit ab und ruft in seinem zweiten Commit erstmals `supabase.rpc('search_availability', …)` aus einer View auf.

Mit diesem Commit endet Branch `datenbank-anbindung`. Er ging **nicht** über einen eigenen Pull Request in `main`, sondern wurde von `buchungsseite-ui-fertigstellen` mitgenommen: Dessen Pull Request #4 (Merge-Commit `9b81803`) enthält beide Branches.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../006_2026-08-26_datenbank-anbindung.md) · [Nächster Commit →](../007_2026-09-06_buchungsseite-ui-fertigstellen/001_2026-09-06_implement-guest-selection.md)
