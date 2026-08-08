[← Vorheriger Commit](003_2026-08-05_add-header-configurations.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md) · [📓 Index](../000_index.md)

# feat: add booking header configuration to routing for booking view

- **Commit:** `6701417`
- **Datum:** 2026-08-05
- **Autor:** Oliver Jung

## Worum geht es?

Ein kurzer, aber aufschlussreicher Commit: Die im vorigen Schritt gebaute Header-Mechanik wird jetzt endlich **für die Buchungsseite** genutzt. Bisher hatte `/buchung` keinen eigenen Header und bekam über den Fallback `route.header ?? homeHeader` die große Startseiten-Bühne mit „Luxus in den Alpen" – für eine Buchungsstrecke offensichtlich unpassend.

Es sind nur **7 geänderte Zeilen** in zwei Dateien:

- `src/views/LayoutViews/MainHeader.ts` – eine neue Konfiguration `bookingHeader`
- `src/main.ts` – diese Konfiguration an die Route `/buchung` gehängt

## 1. Die Buchungs-Konfiguration

```diff
+export const bookingHeader: HeaderConfig = {
+    variant: 'booking',
+    activeStep: 1,
+};
+
 export class MainHeader extends AbstractView {
```

Mehr braucht es nicht. Interessant ist der Vergleich mit den Seiten-Konfigurationen aus dem letzten Commit: Diese haben sechs Felder (`title`, `subtitle`, `backgroundImage`, `withStars`, `fullHeight`), `bookingHeader` hat **zwei**. Genau dafür wurde die Discriminated Union gebaut – jede Variante trägt nur die Felder, die sie wirklich braucht. Ein `title` wäre hier nicht nur überflüssig, sondern würde vom Compiler als Fehler gemeldet.

`activeStep: 1` sagt: Die Buchungsstrecke startet beim ersten Schritt („Datum & Gäste"). Der Wert ist durch den Typ `activeStep: 1 | 2 | 3` abgesichert – eine `4` oder ein `0` wären ein Typfehler. Solche **Literal-Union-Typen** sind ein einfaches Mittel, um „nur diese Werte sind erlaubt" auszudrücken, ohne extra ein Enum einzuführen.

## 2. Die Route bekommt ihren Header

```diff
-import { homeHeader, postsHeader, aboutHeader } from './views/LayoutViews/MainHeader';
+import { homeHeader, postsHeader, aboutHeader, bookingHeader } from './views/LayoutViews/MainHeader';
```

```diff
     {
         path: '/buchung',
         kind: 'static',
+        header: bookingHeader,
         view: BookingView,
     },
```

Am Router selbst ändert sich **nichts**. Er liest weiterhin nur `route.header ?? homeHeader` und übergibt das an `MainHeader`. Die Fallunterscheidung („welches HTML gehört zu dieser Variante?") passiert vollständig innerhalb der Header-Klasse:

```ts
async getHtml(): Promise<string> {
    return this.config.variant === 'booking' ? this.getBookingHeaderHtml(this.config) : this.getPageHeaderHtml(this.config);
}
```

Genau das ist der Lohn der Vorarbeit: Eine **völlig andere** Header-Darstellung einzuführen kostet drei Zeilen Konfiguration und eine Zeile in der Route-Tabelle. Es musste keine bestehende Zeile umgeschrieben werden – ein gutes Zeichen dafür, dass die Struktur trägt.

## Warum ist so ein Mini-Commit erwähnenswert?

Weil er die typische Reihenfolge sauberer Arbeit zeigt: Zuerst wird die **Struktur** geschaffen (Commit `ba71962`, 171 Zeilen), dann wird sie **genutzt** (dieser Commit, 7 Zeilen). Hätte man beides in einem Rutsch gemacht, wäre im Diff schwer zu erkennen, was Umbau und was neue Funktion ist.

Für Lernende ist das ein brauchbares Signal zur Selbstprüfung: Wenn das Hinzufügen einer neuen Variante viele Zeilen an vielen Stellen kostet, ist die Struktur meist noch nicht richtig. Wenn es fast nichts kostet, passt sie.

## Was wurde erreicht?

Die Buchungsseite hat nun ihren eigenen, schlanken Header mit Fortschrittsanzeige statt der Startseiten-Bühne. Die Schritt-Anzeige ist allerdings noch **statisch**: `activeStep: 1` steht fest in der Konfiguration, und der Header weiß nichts davon, ob der Nutzer im Kalender bereits einen Zeitraum gewählt hat. Diese Verbindung stellt der nächste Commit her.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../005_2026-07-22_buchungs-seite.md) · [Nächster Commit →](005_2026-08-08_booking-state-management-step-tracking.md)
