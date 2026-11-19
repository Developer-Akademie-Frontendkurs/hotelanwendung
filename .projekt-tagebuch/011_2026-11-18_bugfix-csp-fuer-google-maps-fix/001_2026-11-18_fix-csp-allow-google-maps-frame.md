[← Vorheriger Commit](../010_2026-11-18_fix-inputs-on-booking-page/001_2026-11-18_adjust-input-styles-booking-page.md) · [↑ Branch-Übersicht](../011_2026-11-18_bugfix-csp-fuer-google-maps-fix.md) · [📓 Index](../000_index.md)

# Fix Content Security Policy to allow Google Maps frame

- **Commit:** `54ec9b3`
- **Datum:** 2026-11-18
- **Autor:** Oliver Jung

## Worum geht es?

Die eingebettete Google-Maps-Karte auf der Startseite wurde von der Content-Security-Policy blockiert. Der Commit erlaubt genau diese eine Quelle für Rahmen.

```text
 src/index.html | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

## Hintergrund: Wie kam es zu dem Fehler?

Die Karte steckt seit Juli in `src/views/HomeView/Home.ts` (Branch [`startseite-erstellen`](../004_2026-06-10_startseite-erstellen/011_2026-07-14_find-us-component-project-diary.md)):

```html
<section class="flex flex-col gap-y-4 768:gap-y-6 items-center py-16.25 992:py-30 px-4">
    <h2 class="font-playfair-display text-32 text-purple-haze-dark">So finden sie uns</h2>
    <iframe
        class="w-full max-w-300 h-112.5 rounded-2xl shadow-pic"
        src="https://www.google.com/maps/embed?pb=…"
        allowfullscreen=""
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
</section>
```

Im Oktober kam die CSP dazu ([Commit 018 im Branch `verbindung-ui-zu-datenbank`](../008_2026-09-09_verbindung-ui-zu-datenbank/018_2026-10-07_escape-html-xss-protection.md)). Ihre Direktiven, aufgeschlüsselt:

```text
default-src 'self';
script-src  'self';
style-src   'self' 'unsafe-inline';
img-src     'self' data: %VITE_SUPABASE_URL%;
font-src    'self' data:;
connect-src 'self' %VITE_SUPABASE_URL%;
object-src  'none';
base-uri    'self';
form-action 'self'
```

Für `<iframe>` ist die Direktive `frame-src` zuständig. Sie fehlte. Dann greift die Kette der **Rückfallwerte**: `frame-src` → `child-src` → `default-src`. Auch `child-src` war nicht gesetzt, also galt `default-src 'self'` – und `https://www.google.com` ist nicht `'self'`. Der Browser lädt den Rahmen nicht und meldet in der Konsole sinngemäß:

```text
Refused to frame 'https://www.google.com/' because it violates the following Content Security Policy directive: "default-src 'self'". Note that 'frame-src' was not explicitly set, so 'default-src' is used as a fallback.
```

Auf der Seite selbst bleibt nur ein leerer bzw. grauer Kasten. Weder `tsc` noch ESLint noch Vitest prüfen so etwas – CSP-Verstöße fallen erst im Browser auf.

## Die Änderung im Detail

Datei: `src/index.html`

```diff
         <meta
             http-equiv="Content-Security-Policy"
-            content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: %VITE_SUPABASE_URL%; font-src 'self' data:; connect-src 'self' %VITE_SUPABASE_URL%; object-src 'none'; base-uri 'self'; form-action 'self'"
+            content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src https://www.google.com; img-src 'self' data: %VITE_SUPABASE_URL%; font-src 'self' data:; connect-src 'self' %VITE_SUPABASE_URL%; object-src 'none'; base-uri 'self'; form-action 'self'"
         />
```

Neu ist nur der Abschnitt:

```text
frame-src https://www.google.com;
```

Was das bedeutet – und was nicht:

| Frage                                                      | Antwort                                                                                                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Darf die Seite jetzt Google-Skripte laden?                 | Nein. `script-src 'self'` bleibt unverändert. Die Karte läuft **im** Rahmen, als eigenes Dokument mit eigenem Origin – ihre Skripte betreffen unsere CSP nicht. |
| Darf jede beliebige Seite eingebettet werden?              | Nein, nur `https://www.google.com` und nur über HTTPS.                                                                                                          |
| Dürfen Rahmen vom eigenen Origin noch geladen werden?      | Nein. Wer `frame-src` setzt, ersetzt den Rückfallwert vollständig. `'self'` müsste ausdrücklich mit drinstehen. Das Projekt nutzt aber keine eigenen Rahmen.    |
| Kann ein Angreifer per XSS nun ein Google-iframe einbauen? | Theoretisch ja, aber er könnte darüber nichts auf unserer Seite ausführen. Das Risiko ist gegenüber einer offenen `frame-src` sehr gering.                      |

Die Direktive ist zwischen `style-src` und `img-src` eingefügt. Die Reihenfolge der Direktiven spielt für den Browser keine Rolle.

> **Tipp:** `frame-src` (welche Rahmen **darf meine Seite** laden?) wird gern mit `frame-ancestors` verwechselt (wer **darf meine Seite** in einen Rahmen laden?). Letzteres schützt vor Clickjacking, wirkt allerdings nicht in einer `<meta>`-CSP, sondern nur als HTTP-Header.

## Was wurde erreicht?

Die Karte „So finden sie uns" wird wieder angezeigt. Die CSP bleibt dabei so streng wie zuvor – sie kennt jetzt nur eine weitere, eng begrenzte Ausnahme.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../011_2026-11-18_bugfix-csp-fuer-google-maps-fix.md) · [Nächster Commit →](../012_2026-11-18_feat-ausgebuchte-tage-im-callender-anzeigen/001_2026-11-18_create-test-folder-per-view.md)
