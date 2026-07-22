[← Vorheriger Commit](014_2026-07-15_add-last-steps-project-diary.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md) · [📓 Index](../000_index.md)

# Add responsive styles for activities section in home view

- **Commit:** `81d7d93`
- **Datum:** 2026-07-22
- **Autor:** Oliver Jung

## Worum geht es?

Die `HomeView` erhält einen neuen Inhaltsbereich: die **Aktivitäten** des Hotels (Kulinarik, Kuhwanderung, Yoga). Auf großen Bildschirmen stehen die drei Karten einfach nebeneinander; auf kleinen Bildschirmen werden sie zu einem **Karussell** (Slider) umgebaut – interessanterweise **ganz ohne JavaScript**, nur mit CSS und versteckten Radio-Buttons.

Dieses Muster (oft „CSS-only carousel" oder „radio button slider" genannt) ist didaktisch sehr lehrreich: Es zeigt, wie sich mit reinem HTML/CSS ein „Zustand" (welche Karte ist aktiv?) speichern und darauf reagieren lässt – ähnlich wie das bereits im Header genutzte CSS-only-Burger-Menü (siehe [Commit 005](005_2026-06-17_mainlayout-mobile-navigation.md)).

Zusätzlich wurden die zugehörigen Bild-Assets eingebunden und ein Tippfehler im Dateinamen eines Bildes korrigiert.

## Die Änderungen im Detail

### `src/views/HomeView/Home.ts` – neue Importe

Für die drei Aktivitäten-Karten werden die passenden Bilder importiert. Neu ist außerdem der Import der ausgelagerten **`home.css`** – so landen die Stile beim Vite-Build automatisch im Bundle, ohne dass sie global in `style.css` stehen müssen.

```diff
 import fam_stroheim from '../../assets/img/familie-stroheim.jpg';
 import double_suite from '../../assets/img/double-suite.jpg';
+import kulinarik from '../../assets/img/kulinarik.jpg';
+import kuhwanderung from '../../assets/img/kuh-wanderung.jpg';
+import yoga from '../../assets/img/yoga.jpg';
+import './home.css';
```

### `src/views/HomeView/Home.ts` – der Aktivitäten-Bereich

An die Stelle eines auskommentierten Platzhalters (`<!-- <section></section> -->`) tritt der eigentliche Aktivitäten-Bereich. Das Herzstück sind drei **versteckte Radio-Buttons** mit demselben `name="activities"`: Weil sie sich einen Namen teilen, kann immer nur genau einer ausgewählt (`checked`) sein. Genau dieser „ausgewählte" Zustand steuert später per CSS, welche Karte im Karussell vorne steht.

```html
<section class="activities w-full">
    <input type="radio" name="activities" id="activity-0" class="activities__radio">
    <input type="radio" name="activities" id="activity-1" class="activities__radio" checked>
    <input type="radio" name="activities" id="activity-2" class="activities__radio">

    <div class="activities__track 768:flex 768:flex-row 768:justify-between 768:gap-x-6 768:max-w-300 768:mx-auto">
        <label for="activity-0" class="activities__card relative block cursor-pointer select-none aspect-3/4 rounded-2xl overflow-hidden shadow-pic 768:flex-1 768:max-w-80">
            <img src="${kulinarik}" alt="Kulinarik" class="absolute inset-0 w-full h-full object-cover">
            <div class="absolute inset-0 bg-linear-to-t from-purple-haze-dark/85 via-purple-haze-dark/25 to-transparent"></div>
            <h3 class="absolute bottom-5 left-5 max-w-[70%] font-playfair-display text-24 768:text-28 text-white leading-tight">Kulinarik</h3>
            <a href="/aktivitaeten/kulinarik" aria-label="Kulinarik" data-link class="activities__link absolute inset-0 z-10"></a>
        </label>
        <!-- analog: activity-1 (Kuhwanderung), activity-2 (Yoga) -->
    </div>
</section>
```

Wichtige Details für Lernende:

- Jede Karte ist ein `<label for="activity-X">`. Ein Klick oder Tipp auf die Karte aktiviert damit den zugehörigen (unsichtbaren) Radio-Button – das ist der Trick, mit dem die Karten „umgeschaltet" werden.
- Der `<div>` mit dem `bg-linear-to-t`-Verlauf legt einen dunklen Farbverlauf über das Bild, damit die weiße Überschrift lesbar bleibt.
- Der `<a data-link>` deckt die ganze Karte ab (`absolute inset-0`) und führt zur jeweiligen Aktivitäten-Detailseite. `data-link` markiert ihn für den SPA-Router als internen Link.
- Standardmäßig ist `activity-1` (Kuhwanderung) `checked` – diese Karte steht auf dem Handy also anfangs in der Mitte.

### `src/views/HomeView/home.css` – der CSS-only-Slider (neue Datei)

Diese neue Datei enthält die komplette Slider-Logik. Sie greift nur auf **kleinen Bildschirmen** (`max-width: 47.9375rem`, also unterhalb von 48rem / 768px), da darüber das einfache Flex-Layout aus dem HTML genügt.

Zuerst werden die Radio-Buttons unsichtbar gemacht – bedient wird ausschließlich über die Labels (die Karten):

```css
.activities__radio {
    display: none;
}
```

Innerhalb des Media-Queries werden alle drei Karten per CSS-Grid **exakt übereinander** gestapelt (alle in `grid-area: 1 / 1`) und mit weichen Übergängen versehen:

```css
@media (max-width: 47.9375rem) {
    .activities {
        overflow: hidden;
    }

    .activities__track {
        display: grid;
        grid-template-columns: 1fr;
        justify-items: center;
        align-items: center;
    }

    .activities__card {
        grid-area: 1 / 1;
        width: 70%;
        transition:
            transform 0.45s ease,
            opacity 0.45s ease;
    }

    .activities__link {
        pointer-events: none;
    }
}
```

Der eigentliche Karussell-Effekt entsteht über den **Geschwister-Kombinator `~`**: Je nachdem, welcher Radio-Button `:checked` ist, werden die dahinterliegenden Karten (`.activities__track .activities__card:nth-child(...)`) unterschiedlich positioniert. Die aktive Karte kommt nach vorne (mittig, volle Deckkraft), die beiden anderen rutschen halbtransparent und verkleinert nach links bzw. rechts:

```css
    /* aktive Karte: mittig, voll sichtbar, oben */
    #activity-0:checked ~ .activities__track .activities__card:nth-child(1),
    #activity-1:checked ~ .activities__track .activities__card:nth-child(2),
    #activity-2:checked ~ .activities__track .activities__card:nth-child(3) {
        transform: translateX(0) scale(1);
        opacity: 1;
        z-index: 3;
    }

    /* jeweils linke Nachbarkarte: nach links, verkleinert, blass */
    #activity-0:checked ~ .activities__track .activities__card:nth-child(3),
    #activity-1:checked ~ .activities__track .activities__card:nth-child(1),
    #activity-2:checked ~ .activities__track .activities__card:nth-child(2) {
        transform: translateX(-27%) scale(0.85);
        opacity: 0.55;
        z-index: 1;
    }

    /* jeweils rechte Nachbarkarte: nach rechts, verkleinert, blass */
    #activity-0:checked ~ .activities__track .activities__card:nth-child(2),
    #activity-1:checked ~ .activities__track .activities__card:nth-child(3),
    #activity-2:checked ~ .activities__track .activities__card:nth-child(1) {
        transform: translateX(27%) scale(0.85);
        opacity: 0.55;
        z-index: 1;
    }
```

Ein durchdachtes Detail ist die Steuerung der Klick-Ziele: Über `.activities__link { pointer-events: none; }` sind zunächst alle Links inaktiv. Nur der Link der **aktuell aktiven** Karte wird wieder klickbar geschaltet:

```css
    #activity-0:checked ~ .activities__track .activities__card:nth-child(1) .activities__link,
    #activity-1:checked ~ .activities__track .activities__card:nth-child(2) .activities__link,
    #activity-2:checked ~ .activities__track .activities__card:nth-child(3) .activities__link {
        pointer-events: auto;
    }
```

Das verhindert, dass ein Tipp auf eine blasse Karte im Hintergrund sofort auf die Detailseite navigiert. Stattdessen holt der erste Tipp die Karte nur nach vorne (er aktiviert über das `<label>` den Radio-Button), und erst ein zweiter Tipp auf die nun aktive Karte folgt dem Link – ein sauberes, rein deklaratives Verhalten ohne JavaScript.

### Bild-Asset: Tippfehler im Dateinamen korrigiert

Nebenbei wird eine Bilddatei umbenannt – der Tippfehler `kuh-wamderung.jpg` wird zu `kuh-wanderung.jpg` korrigiert (passend zum neuen Import in `Home.ts`).

```diff
-src/assets/img/kuh-wamderung.jpg
+src/assets/img/kuh-wanderung.jpg
```

## Was wurde erreicht?

Die Startseite hat nun einen vollständigen **Aktivitäten-Bereich**: Auf dem Desktop als übersichtliche Drei-Karten-Reihe, auf dem Handy als animiertes Karussell, das komplett mit HTML und CSS auskommt. Damit ist ein weiterer inhaltlicher Baustein der `HomeView` fertiggestellt. Für Lernende ist besonders das Zusammenspiel aus versteckten Radio-Buttons, `<label>`-Elementen, dem Geschwister-Kombinator `~` und gezielt gesteuerten `pointer-events` sehenswert – ein Musterbeispiel für „so viel CSS wie möglich, so wenig JavaScript wie nötig".

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../004_2026-06-10_startseite-erstellen.md)
