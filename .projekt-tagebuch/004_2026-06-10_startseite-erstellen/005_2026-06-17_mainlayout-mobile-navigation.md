[← Vorheriger Commit](004_2026-06-17_add-images-caveat-font.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# Refactor MainLayout to implement mobile navigation and add layout styles

- **Commit:** `5dae588`
- **Datum:** 2026-06-17
- **Autor:** Oliver Jung

## Worum geht es?

Die bisher rein funktionale Navigationsliste im `MainLayout` wird zu einem echten **responsiven Header** ausgebaut. Es gibt nun eine **mobile Navigation** (Burger-Menü, das per reinem CSS aufklappt) und eine **Desktop-Navigation**, die je nach Bildschirmbreite ein- bzw. ausgeblendet wird. Dazu kommt eine neue Datei `layout.css` mit den passenden Styles.

Besonders lehrreich ist hier die **„CSS-only"-Technik**: Das Menü wird ganz ohne JavaScript über eine versteckte Checkbox gesteuert.

## Die Änderungen im Detail

### `src/index.html` – überflüssiges Padding entfernen

Der Layout-Wrapper hatte ein festes Padding (`p-16`), das jetzt das vollflächige Header-Bild stören würde und daher entfällt.

```diff
-        <div id="layout-wrapper" class="p-16"></div>
+        <div id="layout-wrapper"></div>
```

### `src/views/LayoutViews/MainLayout.ts` – Header mit zwei Navigationen

Zunächst werden das Logo (als importiertes SVG) und die neue `layout.css` importiert. In Vite kann man Assets direkt importieren und bekommt die fertige URL als String zurück – ideal, um sie ins Template einzusetzen.

```ts
import AbstractView from '../AbstractView';
import logo from '../../assets/img/logo.svg';
import './layout.css';
```

Das Template ersetzt die einfache `<nav>`-Liste durch einen Header mit Hintergrundbild, einer **mobilen** Navigation (`#mobile-menu`, sichtbar unter dem `768`-Breakpoint) und einer **Desktop**-Navigation (`#desktop-menu`, ab `768` sichtbar). Die Sichtbarkeit steuern die Tailwind-Klassen `768:hidden` bzw. `hidden 768:flex`.

```diff
-            <nav>
-                <ul>
-                    <li><a href="/" data-link>Home</a></li>
-                    <li><a href="/posts" data-link>Posts</a></li>
-                    <li><a href="/about" data-link>About</a></li>
-                </ul>
-            </nav>
+            <section class="min-h-dvh bg-[url('/assets/img/main-header-bg.jpg')] bg-cover bg-center">
+                <header class="mobile-menu w-full max-w-360 min-h-screen mx-auto">
+                    <a href="/" data-link><img src="${logo}" alt="Karawanken Hof Logo"></a>
+                    <div id="mobile-menu" class="flex 768:hidden gap-x-4">
+                        <nav class="flex gap-4 items-center">
+                            <input id="mobile-menu-checkbox" type="checkbox" class="mobile-menu__checkbox">
+                            <label class="mobile-menu__btn" for="mobile-menu-checkbox">
+                                <div class="mobile-menu__icon"></div>
+                            </label>
+                            <div class="mobile-menu__container">
+                                <ul class="mobile-menu__list">
+                                    <li class="mobile-menu__item"><a href="/" class="mobile-menu__link ..." data-link>Startseite</a></li>
+                                    <li class="mobile-menu__item"><a href="/about" class="mobile-menu__link ..." data-link>Über uns</a></li>
+                                </ul>
+                            </div>
+                        </nav>
+                    </div>
+                    <div id="desktop-menu" class="hidden 768:flex">
+                        <nav>...</nav>
+                    </div>
+                </header>
+            </section>
```

Nebenbei wird ein kaputter Footer-Tag repariert:

```diff
             <div id="footer">
-                < p>Copyright © 2024</>
+                <p>Copyright © 2024</p>
             </div>
```

### `src/views/LayoutViews/layout.css` – das Burger-Menü ohne JavaScript

Die neue Datei enthält das komplette Styling des mobilen Menüs. Der Trick: Eine visuell versteckte Checkbox (`.mobile-menu__checkbox`) merkt sich per `:checked` den Zustand „offen/geschlossen". Über Geschwister-Selektoren (`~`) werden dann das aufklappende Panel und die Animation der Burger-Striche (drei Linien werden zum X) gesteuert.

```css
.mobile-menu {
    display: flex;
    align-items: center;
    justify-content: flex-end;

    & .mobile-menu__icon {
        display: block;
        position: relative;
        background: var(--color-purple-haze);
        width: 90%;
        height: 4px;
        transition: 0.25s;

        &::after,
        &::before {
            content: '';
            display: block;
            position: absolute;
            background: var(--color-purple-haze);
            width: 100%;
            height: 4px;
            transition: 0.25s;
        }
        &::after { top: 8px; }
        &::before { top: -8px; }
    }

    & .mobile-menu__container {
        height: 0;
        overflow: hidden;
        transition: 0.25s;
    }

    & .mobile-menu__checkbox {
        display: none;

        /* Beim Anhaken: Panel ausfahren und Burger zum X animieren */
        &:checked ~ .mobile-menu__btn .mobile-menu__icon {
            background: transparent;
            &::after { transform: rotate(-45deg); top: 0; }
            &::before { transform: rotate(45deg); top: 0; }
        }
    }
}
```

Zu beachten: Verschachtelter CSS-Code (Nesting mit `&`) ist hier bereits im Einsatz. Ein kleiner Detailfehler (`& :checked` mit Leerzeichen statt `&:checked`) hat sich eingeschlichen – er wird im nächsten Commit korrigiert.

## Was wurde erreicht?

Der Header ist jetzt responsiv: Auf kleinen Bildschirmen gibt es ein animiertes Burger-Menü, auf großen eine klassische Navigationsleiste. Das Menü funktioniert komplett ohne JavaScript – ein schönes Beispiel dafür, wie viel sich allein mit CSS und einer Checkbox erreichen lässt.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [Nächster Commit →](006_2026-07-01_first-html-components.md)
