/**
 * Markup für Schritt 3 „persönliche Daten“: Formular, Zusammenfassung „Ihre Buchung“ und
 * das Bestätigungs-Popup.
 *
 * Daten rein, HTML raus – Preise, Texte und welche Zeilen es gibt, bestimmt `Booking.ts`.
 * Text-Parameter werden hier escapt, Parameter mit `Html` im Namen sind fertiges Markup.
 * Eingaben des Gastes kommen hier nie an: Die setzt `renderCustomerSummary()` per
 * `textContent`.
 */

import { escapeHtml } from '../../../shared/ui/html';
import { STEP_TARGET_CLASSES, type SelectOption } from './calendar.template';
import { ICON_REMOVE } from './icons';

export type SummaryRoomView = {
    name: string;
    imageUrl: string | null;
    /** Ausstattung als eine Zeile, z. B. „King-size Bett · Gym Zugang“ – leer, wenn keine hinterlegt ist. */
    amenities: string;
};

export type StayView = {
    checkIn: string;
    checkOut: string;
    /** Belegung und Nächte, z. B. „2 Erwachsene · 3 Nächte“. */
    stay: string;
};

export type OrderRowView = {
    kind: string;
    id: string;
    name: string;
    /** Leer, wenn es nichts zu ergänzen gibt. */
    detail: string;
    price: string;
};

export type SummaryOrderView = {
    hotelHtml: string;
    roomsHtml: string;
    stayHtml: string;
    rowsHtml: readonly string[];
};

export type ConfirmationRowView = {
    label: string;
    values: readonly string[];
};

type AddressSample = {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
};

// Eingabefelder und Auswahl im Adressformular – `aria-invalid` markiert, was beim Klick
// auf „zahlungspflichtig buchen" fehlte.
const FIELD_CLASSES =
    'w-full min-w-0 rounded-[0.3125rem] border-[0.5px] border-purple-haze bg-purple-haze-light/45 p-2 font-antic-didone text-18 456:text-20 leading-tight text-purple-haze-dark focus:outline-none focus:ring-2 focus:ring-purple-haze/40 aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-600';

// Beispielwerte für die Platzhalter: kurz genug für die schmalen Felder (PLZ, Hausnummer)
// und erkennbar erfunden (`beispiel.at`, „Beispiel GmbH").
const RESIDENCE_SAMPLE: AddressSample = { street: 'Hauptplatz', houseNumber: '12a', postalCode: '9500', city: 'Villach' };
const BILLING_SAMPLE: AddressSample = { street: 'Ringstraße', houseNumber: '5', postalCode: '1010', city: 'Wien' };

const MUTED_TEXT_CLASSES = 'font-antic-didone text-16 leading-tight text-purple-haze-dark/70';
const DIVIDER_HTML = /*html*/ `<hr class="border-t-[0.5px] border-purple-haze/45">`;

/**
 * Abschluss-Sektion aus dem Design ("BuchungAbschließen"): Kontaktdaten und Adressen
 * links, Zusammenfassung rechts.
 */
export function getCheckoutHtml(customerFormHtml: string, summaryHtml: string): string {
    return /*html*/ `
        <section id="booking-details" class="${STEP_TARGET_CLASSES} bg-purple-haze-light px-3 py-10 768:py-16">
            <div class="w-full max-w-268 mx-auto flex flex-col gap-10 992:flex-row 992:items-start 992:justify-between 992:gap-8">
                ${customerFormHtml}
                ${summaryHtml}
            </div>
        </section>
    `;
}

/**
 * Kontaktdaten, Wohnadresse und – per Checkbox – eine abweichende Rechnungsadresse
 * (E50, E51). Der Rechnungsblock bleibt im DOM und wird nur ausgeblendet: Wer die
 * Checkbox versehentlich abwählt, verliert seine Eingabe nicht.
 */
export function getCustomerFormHtml(countryOptions: readonly SelectOption[]): string {
    return /*html*/ `
        <div class="w-full 992:max-w-124.25 flex flex-col gap-5">
            <div class="flex flex-col gap-2">
                <h2 class="font-playfair-display text-28 768:text-36 leading-none text-purple-haze-dark">Ihre Daten</h2>
                <p class="font-antic-didone text-16 leading-tight text-purple-haze-dark">Die Rechnung geht an Ihre Wohnadresse – außer Sie geben eine abweichende Rechnungsadresse an.</p>
            </div>
            <form id="booking-customer" novalidate class="flex flex-col gap-8 rounded-[0.625rem] border-[0.5px] border-purple-haze bg-surface px-5 py-4">
                <div class="flex flex-col gap-3">
                    ${getInputFieldHtml('first-name', 'Vorname', 'Maria', 'given-name', 'text', 'w-full')}
                    ${getInputFieldHtml('last-name', 'Nachname', 'Huber', 'family-name', 'text', 'w-full')}
                </div>
                <div class="flex flex-col gap-3">
                    ${getInputFieldHtml('email', 'E-Mail', 'maria.huber@beispiel.at', 'email', 'email', 'w-full')}
                    ${getInputFieldHtml('phone', 'Telefon (optional)', '+43 660 1234567', 'tel', 'tel', 'w-full', false)}
                </div>
                <fieldset class="flex flex-col gap-3">
                    <legend class="mb-3 font-playfair-display font-medium text-20 leading-tight text-purple-haze-dark">Wohnadresse</legend>
                    ${getAddressFieldsHtml('', '', RESIDENCE_SAMPLE, countryOptions)}
                </fieldset>

                <label class="flex items-center gap-3 cursor-pointer font-antic-didone text-16 leading-tight text-purple-haze-dark">
                    <input type="checkbox" name="billing-differs" data-billing-toggle class="w-5 h-5 shrink-0 accent-purple-haze cursor-pointer" />
                    Rechnungsadresse weicht von der Wohnadresse ab
                </label>

                <fieldset id="booking-billing" hidden class="flex flex-col gap-3">
                    <legend class="mb-3 font-playfair-display font-medium text-20 leading-tight text-purple-haze-dark">Rechnungsadresse</legend>
                    ${getInputFieldHtml('billing-company', 'Firma / z. Hd. (optional)', 'Beispiel GmbH', 'billing organization', 'text', 'w-full', false)}
                    ${getAddressFieldsHtml('billing-', 'billing ', BILLING_SAMPLE, countryOptions)}
                </fieldset>
            </form>
        </div>
    `;
}

/**
 * Straße bis Land – für Wohn- und Rechnungsadresse dieselben Felder, nur mit Präfix.
 * Die Beispiele unterscheiden sich, damit die beiden Blöcke nicht wie eine Kopie wirken.
 */
function getAddressFieldsHtml(prefix: string, autocompleteSection: string, sample: AddressSample, countryOptions: readonly SelectOption[]): string {
    return /*html*/ `
        ${getInputFieldHtml(`${prefix}street`, 'Straße', sample.street, `${autocompleteSection}address-line1`, 'text', 'w-full')}
        <div class="flex gap-3 576:gap-8">
            ${getInputFieldHtml(`${prefix}house-number`, 'Hausnummer', sample.houseNumber, `${autocompleteSection}address-line2`, 'text', 'flex-1 min-w-0 576:w-46 576:flex-none')}
            ${getInputFieldHtml(`${prefix}postal-code`, 'PLZ', sample.postalCode, `${autocompleteSection}postal-code`, 'text', 'w-20 shrink-0 576:w-[4.3125rem]')}
            ${getInputFieldHtml(`${prefix}city`, 'Ort', sample.city, `${autocompleteSection}address-level2`, 'text', 'flex-1 min-w-0')}
        </div>
        ${getCountryFieldHtml(`${prefix}country`, `${autocompleteSection}country`, countryOptions)}
    `;
}

/**
 * Das Beispiel steht als `placeholder` im Feld, nicht als `value` – die Eingabe bleibt
 * leer, und der Gast muss nichts löschen. Grau statt in der Schriftfarbe der Eingabe,
 * damit ein leeres Feld nicht wie ein ausgefülltes aussieht.
 */
function getInputFieldHtml(id: string, label: string, sample: string, autocomplete: string, type: string, widthClass: string, required = true): string {
    return /*html*/ `
        <div class="flex flex-col ${widthClass}">
            <label for="booking-${id}" class="font-playfair-display font-medium text-16 leading-tight text-purple-haze">${escapeHtml(label)}</label>
            <input
                id="booking-${id}"
                name="${id}"
                type="${type}"
                autocomplete="${autocomplete}"
                placeholder="${escapeHtml(sample)}"
                ${required ? 'aria-required="true"' : ''}
                class="${FIELD_CLASSES} placeholder:text-gray-500"
            />
        </div>
    `;
}

/** Land als Auswahl statt Freitext (E42): „Österreich"/„AT"/„Oesterreich" wären drei Länder. */
function getCountryFieldHtml(id: string, autocomplete: string, options: readonly SelectOption[]): string {
    const optionsHtml = options
        .map((option: SelectOption): string => /*html*/ `<option value="${escapeHtml(option.value)}" ${option.selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
        .join('');

    return /*html*/ `
        <div class="flex flex-col w-full 576:w-64.75">
            <label for="booking-${id}" class="font-playfair-display font-medium text-16 leading-tight text-purple-haze">Land</label>
            <select id="booking-${id}" name="${id}" autocomplete="${autocomplete}" aria-required="true" class="${FIELD_CLASSES} cursor-pointer">
                ${optionsHtml}
            </select>
        </div>
    `;
}

/**
 * Das Gerüst von „Ihre Buchung". Was sich mit der Auswahl ändert, kommt in
 * `#booking-summary-order` und `[data-summary-total]`; Name und Adressen in
 * `#booking-summary-customer`.
 */
export function getBookingSummaryHtml(checkoutLabel: string): string {
    return /*html*/ `
        <div id="booking-summary" class="w-full 992:max-w-135.25 flex flex-col gap-5 rounded-[0.8125rem] border-[0.5px] border-purple-haze bg-surface p-5">
            <h2 id="booking-summary-title" tabindex="-1" class="font-playfair-display text-28 768:text-36 leading-none text-purple-haze-dark focus:outline-none">Ihre Buchung</h2>

            <div id="booking-summary-order" class="flex flex-col gap-5"></div>

            <div id="booking-summary-customer" class="flex flex-col font-antic-didone text-16 leading-tight text-purple-haze-dark"></div>

            <div class="flex flex-col gap-8 pt-2">
                <hr class="border-t-2 border-purple-haze/45">
                <div class="flex items-baseline justify-between gap-4 font-playfair-display text-24 text-purple-haze-dark">
                    <span>Gesamtsumme</span>
                    <span data-summary-total aria-live="polite">–</span>
                </div>
                <div class="flex flex-col gap-2">
                    <button type="button" data-action="checkout" class="w-full bg-purple-haze px-5 py-2.5 font-lato font-bold text-20 768:text-24 text-white opacity-85 hover:opacity-100 cursor-pointer">
                        ${escapeHtml(checkoutLabel)}
                    </button>
                    <div class="flex flex-col gap-4 text-center">
                        <p class="font-antic-didone text-14 leading-tight text-muted">Ich bestätige, dass ich die Datenschutzvereinbarung gelesen habe.</p>
                        <p id="booking-checkout-error" hidden role="alert" class="font-antic-didone text-[0.8125rem] leading-tight text-red-600">Bitte tragen Sie alle notwendigen Informationen ein.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/** Der veränderliche Teil von „Ihre Buchung“: Hotel, Zimmer, Aufenthalt, Bestellzeilen. */
export function getSummaryOrderHtml(view: SummaryOrderView): string {
    const rows = view.rowsHtml.length === 0 ? '' : /*html*/ `<div class="flex flex-col gap-4">${view.rowsHtml.join('')}</div>`;

    return /*html*/ `
        ${view.hotelHtml}
        ${view.roomsHtml}
        <div class="flex flex-col gap-6 768:gap-10">
            ${view.stayHtml}
            ${rows}
        </div>
    `;
}

/** Hoteladresse – eine Zeile je Eintrag. */
export function getHotelAddressHtml(lines: readonly string[]): string {
    return /*html*/ `
        <div class="flex flex-col gap-4">
            <address class="not-italic font-antic-didone text-16 leading-tight text-purple-haze-dark">${lines.map(escapeHtml).join('<br>')}</address>
            ${DIVIDER_HTML}
        </div>
    `;
}

/** An der Stelle der Adresse, wenn das Hotel nicht geladen werden konnte. */
export function getHotelErrorHtml(message: string): string {
    return /*html*/ `
        <div class="flex flex-col gap-4">
            <p class="${MUTED_TEXT_CLASSES}">${escapeHtml(message)}</p>
            ${DIVIDER_HTML}
        </div>
    `;
}

export function getSummaryNoRoomsHtml(): string {
    return /*html*/ `<p class="${MUTED_TEXT_CLASSES}">Noch kein Zimmer gewählt.</p>`;
}

/** Bild, Name und Ausstattung je gewählter Kategorie – der Block aus dem Entwurf, einmal je Kategorie. */
export function getSummaryRoomsHtml(rooms: readonly SummaryRoomView[]): string {
    return /*html*/ `
        <ul class="flex flex-col gap-4">
            ${rooms.map(getSummaryRoomHtml).join('')}
        </ul>
    `;
}

function getSummaryRoomHtml(room: SummaryRoomView): string {
    // Das Bild ist Schmuck: Der Name steht direkt daneben.
    const image =
        room.imageUrl === null
            ? /*html*/ `<div class="shrink-0 w-24 h-18 rounded-[0.6875rem] bg-purple-haze-dark"></div>`
            : /*html*/ `<img src="${escapeHtml(room.imageUrl)}" alt="" loading="lazy" class="shrink-0 w-24 h-18 rounded-[0.6875rem] object-cover" />`;

    return /*html*/ `
        <li class="flex items-center gap-4">
            ${image}
            <div class="flex flex-col gap-3 font-antic-didone text-16 leading-tight text-purple-haze-dark">
                <span class="font-playfair-display font-medium">${escapeHtml(room.name)}</span>
                ${room.amenities === '' ? '' : /*html*/ `<span>${escapeHtml(room.amenities)}</span>`}
            </div>
        </li>
    `;
}

/** Check-in/Check-out-Kacheln, darunter Belegung und Nächte. */
export function getStayHtml(view: StayView): string {
    return /*html*/ `
        <div class="flex flex-col gap-3">
            <div class="flex flex-col 456:flex-row gap-4">
                ${getCheckTileHtml('Check-in', view.checkIn)}
                ${getCheckTileHtml('Check-out', view.checkOut)}
            </div>
            <p class="font-antic-didone text-16 leading-tight text-purple-haze-dark text-center">${escapeHtml(view.stay)}</p>
        </div>
    `;
}

function getCheckTileHtml(label: string, value: string): string {
    return /*html*/ `
        <div class="flex-1 flex items-center justify-center rounded-[0.625rem] bg-surface-muted p-3 text-center font-antic-didone text-16 leading-tight text-purple-haze-dark">
            <span>
                <span class="block font-playfair-display font-medium">${escapeHtml(label)}</span>
                ${escapeHtml(value)}
            </span>
        </div>
    `;
}

/** Eine Bestellzeile. Das Kreuz aus dem Entwurf entfernt sie: Zimmer auf 0, Leistung abgewählt. */
export function getOrderRowHtml(view: OrderRowView): string {
    const detail = view.detail === '' ? '' : /*html*/ `<span class="block font-antic-didone">${escapeHtml(view.detail)}</span>`;

    return /*html*/ `
        <div class="flex items-center justify-between gap-4 rounded-[0.625rem] border border-purple-haze p-3">
            <p class="font-playfair-display font-medium text-16 leading-tight text-purple-haze-dark">
                ${escapeHtml(view.name)}
                ${detail}
            </p>
            <div class="flex shrink-0 items-center gap-2">
                <span class="font-antic-didone text-20 768:text-24 leading-none text-purple-haze-dark">${escapeHtml(view.price)}</span>
                <button
                    type="button"
                    data-summary-remove="${escapeHtml(view.kind)}"
                    data-summary-id="${escapeHtml(view.id)}"
                    aria-label="${escapeHtml(`${view.name} entfernen`)}"
                    class="shrink-0 rounded-full cursor-pointer transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
                >${ICON_REMOVE}</button>
            </div>
        </div>
    `;
}

/**
 * Inhalt des Bestätigungs-Popups (E46). Der Entwurf sagt hier zusätzlich „Bitte bestätigen
 * Sie diese via erhaltener Email.“ – eine Buchung ist aber sofort `confirmed` (E11), und
 * eine Mail verschickt noch niemand. Der Satz kommt zurück, sobald es die Mail gibt.
 */
export function getConfirmationHtml(logoSrc: string, rows: readonly ConfirmationRowView[]): string {
    return /*html*/ `
        <div class="flex flex-col items-center gap-6 text-center text-purple-haze-dark">
            <img src="${escapeHtml(logoSrc)}" alt="" class="h-24 w-auto">
            <h2 id="booking-confirmation-title" class="font-playfair-display text-28 768:text-36 leading-tight">Vielen Dank für Ihre Buchung.</h2>
            <p class="font-antic-didone text-18 768:text-20 leading-snug">Ihre Buchung ist bestätigt.<br>Wir freuen uns auf Sie.</p>
            <dl class="w-full flex flex-col gap-3 border-y-[0.5px] border-purple-haze/45 py-4 font-antic-didone text-16 768:text-18">
                ${rows.map(getConfirmationRowHtml).join('')}
            </dl>
            <button type="button" data-modal-close class="w-full bg-purple-haze px-5 py-2.5 font-lato font-bold text-20 768:text-24 text-white opacity-85 hover:opacity-100 cursor-pointer">
                zurück zur Homepage
            </button>
        </div>
    `;
}

/** Eine Zeile je Wert – escapt, weil Buchungsnummer und Währung aus der Datenbank kommen. */
function getConfirmationRowHtml(row: ConfirmationRowView): string {
    return /*html*/ `
        <div class="flex items-start justify-between gap-4">
            <dt>${escapeHtml(row.label)}</dt>
            <dd class="text-right font-lato font-bold tracking-wide">${row.values.map(escapeHtml).join('<br>')}</dd>
        </div>
    `;
}
