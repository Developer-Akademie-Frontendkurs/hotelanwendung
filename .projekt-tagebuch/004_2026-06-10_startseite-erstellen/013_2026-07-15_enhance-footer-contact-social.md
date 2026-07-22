[← Vorheriger Commit](012_2026-07-14_update-project-diary-find-us.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# feat: enhance footer with contact information and social media links

- **Commit:** `adb109f`
- **Datum:** 2026-07-15
- **Autor:** Oliver Jung

## Worum geht es?

Bisher war der Footer nur ein Platzhalter mit einer einzigen Copyright-Zeile. In diesem Commit wird er zu einem **vollwertigen Seitenfuß** ausgebaut: mit **Kontaktdaten**, einer **Link-Navigation** (Impressum, Datenschutz, AGB …) und einem Bereich für **Social-Media-Icons** samt Mitarbeitenden-Login. Der Footer liegt im gemeinsamen `MainLayout`, erscheint also auf **jeder** Seite der Anwendung.

## Die Änderungen im Detail

Geändert wurde ausschließlich eine Datei:

```text
 src/views/LayoutViews/MainLayout.ts | 46 ++++++++++++++++++++++++++++++++++---
 1 file changed, 43 insertions(+), 3 deletions(-)
```

### `src/views/LayoutViews/MainLayout.ts` – neue Asset-Importe

Zunächst werden das Hintergrundbild und drei Social-Media-Icons importiert. Da das Projekt mit **Vite** gebaut wird, werden Bilder als Module importiert: Vite gibt dabei den fertigen (gehashten) Pfad zur Datei zurück, den man direkt in `src`- bzw. `url(...)`-Attributen verwenden kann.

```diff
 import AbstractView from '../AbstractView';
 import logo from '../../assets/img/logo.svg';
 import stars from '../../assets/img/icons/stars.png';
+import mainHeaderBg from '../../assets/img/main-header-bg.jpg';
+import facebook from '../../assets/img/icons/facebook.svg';
+import instagram from '../../assets/img/icons/instagram.svg';
+import tripadvisor from '../../assets/img/icons/tripadvisor.svg';
 import './layout.css';
```

### `src/views/LayoutViews/MainLayout.ts` – vom Platzhalter zum echten Footer

Der alte `<div id="footer">` mit reinem Copyright-Text wird durch ein semantisches `<footer>`-Element ersetzt:

```diff
-            <div id="footer">
-                <p>Copyright © 2024</p>
-            </div>
+            <footer id="footer" class="w-full bg-cover bg-center" style="background-image: url('${mainHeaderBg}')">
+                ...
+            </footer>
```

Zwei Dinge sind hier didaktisch wichtig:

- **Semantisches HTML:** Statt eines generischen `<div>` wird nun das Element `<footer>` verwendet. Das verbessert die Zugänglichkeit (Screenreader erkennen den Seitenfuß) und die Lesbarkeit des Markups.
- **Dynamischer Bildpfad:** Das zuvor importierte `mainHeaderBg` wird per Template-Literal (`${mainHeaderBg}`) in das `style`-Attribut eingesetzt. So bleibt der Pfad auch nach dem Vite-Build korrekt.

Der gesamte neue Footer-Aufbau im Überblick:

```html
<footer id="footer" class="w-full bg-cover bg-center" style="background-image: url('${mainHeaderBg}')">
    <div class="w-full bg-eggshell/85">
        <div class="w-full max-w-360 mx-auto px-6 768:px-12 py-10 768:py-14 flex flex-col 768:flex-row 768:justify-between gap-y-10 768:gap-y-0 text-center 768:text-left">

            <div class="flex flex-col gap-y-6 items-center 768:items-start">
                <h3 class="font-playfair-display text-20 768:text-24 text-purple-haze-dark">Kontakt</h3>
                <address class="not-italic font-antic-didone text-16 768:text-18 text-purple-haze-dark leading-relaxed">
                    Karawanken Hof<br>
                    Kadischen Allee 3<br>
                    A – 3459 Villach
                </address>
                <div class="font-antic-didone text-16 768:text-18 text-purple-haze-dark leading-relaxed">
                    Tel: + 43 664 3228827<br>
                    E-Mail: anfrage@karawanken-hof.at
                </div>
            </div>

            <nav class="flex flex-col gap-y-4 items-center 768:items-start font-antic-didone text-16 768:text-18 text-purple-haze-dark">
                <a href="/impressum" class="hover:text-purple-haze" data-link>Impressum</a>
                <a href="/datenschutz" class="hover:text-purple-haze" data-link>Datenschutz</a>
                <a href="/agb" class="hover:text-purple-haze" data-link>AGB</a>
                <a href="/sicherungsscheine" class="hover:text-purple-haze" data-link>Sicherungsscheine</a>
                <a href="/newsletter" class="hover:text-purple-haze" data-link>Newsletter</a>
            </nav>

            <div class="flex flex-col gap-y-6 items-center">
                <h3 class="font-playfair-display text-20 768:text-24 text-purple-haze-dark">Social Media</h3>
                <div class="flex gap-x-4">
                    <a href="#" aria-label="TripAdvisor"><img src="${tripadvisor}" alt="TripAdvisor" class="w-10 h-10"></a>
                    <a href="#" aria-label="Facebook"><img src="${facebook}" alt="Facebook" class="w-10 h-10"></a>
                    <a href="#" aria-label="Instagram"><img src="${instagram}" alt="Instagram" class="w-10 h-10"></a>
                </div>
                <a href="/admin" class="border border-purple-haze rounded-2xl px-6 py-2 font-lato font-semibold text-purple-haze hover:bg-purple-haze hover:text-white transition-colors" data-link>
                    Mitarbeitenden-Login
                </a>
            </div>
        </div>
    </div>
</footer>
```

Die einzelnen Bausteine erklärt:

- **Hintergrund und Overlay:** Das `<footer>` bekommt das Header-Bild als Hintergrund (`bg-cover bg-center`). Darüber liegt ein zweites `<div>` mit `bg-eggshell/85` – ein halbtransparentes helles Overlay (85 % Deckkraft), damit der dunkle Text auf dem Bild gut lesbar bleibt.
- **Responsives Drei-Spalten-Layout:** Der innere Container ist mobil eine Spalte (`flex-col`, zentriert) und ab dem Breakpoint `768` eine Zeile mit drei nebeneinander liegenden Blöcken (`768:flex-row 768:justify-between`). `max-w-360 mx-auto` begrenzt die Breite und zentriert den Inhalt.
- **Kontakt-Block:** Für die Adresse wird das semantische Element `<address>` genutzt. Mit `not-italic` wird die vom Browser standardmäßig kursive Darstellung von `<address>` wieder aufgehoben.
- **Navigations-Block:** Ein `<nav>` mit den rechtlichen und weiterführenden Links. Alle Links tragen das Attribut `data-link` – so erkennt der SPA-Router im Projekt interne Links und lädt die Zielseite ohne kompletten Seiten-Reload.
- **Social-Media-Block:** Die drei importierten Icons werden als `<img>` eingebunden. Jeder Link hat ein `aria-label`, weil der Link selbst keinen sichtbaren Text enthält – so wissen Screenreader-Nutzende, wohin der Link führt. Abschließend ein optisch als Button gestalteter „Mitarbeitenden-Login".

## Was wurde erreicht?

Der Footer ist jetzt ein informativer, responsiver Seitenfuß mit Kontaktdaten, rechtlichen Links und Social-Media-Verweisen – konsistent auf allen Seiten. Durch semantisches HTML (`<footer>`, `<address>`, `<nav>`) und `aria-label`-Attribute ist er zudem zugänglich gestaltet.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](014_2026-07-15_add-last-steps-project-diary.md)
