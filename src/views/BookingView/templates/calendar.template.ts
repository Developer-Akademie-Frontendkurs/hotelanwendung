/**
 * Markup für Schritt 1 „Datum & Gäste“ und das Gerüst der Seite.
 *
 * Wie alle Templates der Buchungsseite: Daten rein, HTML raus. Was angezeigt wird,
 * entscheidet `Booking.ts`; hier wird nur noch eingesetzt. Text-Parameter werden escapt,
 * Parameter mit `Html` im Namen sind fertiges Markup und bleiben, wie sie sind.
 */

import { escapeHtml } from '../../../shared/ui/html';
import { ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT, ICON_SELECT_CHEVRON } from './icons';

/**
 * Sprungziele der Steps im Sticky-Header: Abstand nach oben, damit der Header den
 * Anfang des Bereichs nicht verdeckt (mobil ist er zweizeilig und höher).
 */
export const STEP_TARGET_CLASSES = 'scroll-mt-40 768:scroll-mt-28';

export type SelectOption = {
    value: string;
    label: string;
    selected: boolean;
};

export type GuestFieldView = {
    field: string;
    ariaLabel: string;
    placeholder: string;
    placeholderSelected: boolean;
    options: readonly SelectOption[];
    iconHtml: string;
    /** Nur die Erwachsenenzahl ist Pflicht – nur dort hängt eine Hinweiszeile. */
    withNotice: boolean;
};

export type DayCellView = {
    /** `YYYY-MM-DD` für `data-date`. */
    iso: string;
    weekday: string;
    /** Zweistellig, z. B. „03“. */
    day: string;
    /** „Anreise“/„Abreise“ – `null` hält die Zeile mit einem geschützten Leerzeichen frei. */
    label: string | null;
    stateClass: string;
    selectable: boolean;
    /**
     * Gesperrt, aber nicht vorbei: `aria-disabled` statt `disabled`, weil manche Browser an
     * deaktivierten Knöpfen keinen Tooltip zeigen – und der Tooltip ist hier der Punkt (E24).
     */
    blocked: boolean;
    /** Datum und Grund für gesperrte Tage. */
    tooltip: string | null;
    /** Nur am Anreisetag sitzt das „ד zum Zurücksetzen. */
    withClearButton: boolean;
};

export type CalendarHeaderView = {
    monthName: string;
    year: string;
    prevDisabled: boolean;
    /** Am Monat mit dem letzten wählbaren Tag (E30). */
    nextDisabled: boolean;
};

/** Die ganze Seite: Datum & Gäste, darunter die Zimmerliste, dann der Abschluss. */
export function getBookingPageHtml(guestsHtml: string, checkoutHtml: string): string {
    return /*html*/ `
        <section class="px-3 py-10 768:py-16">
            <div id="booking-dates" class="${STEP_TARGET_CLASSES} w-full max-w-300 mx-auto bg-eggshell rounded-3xl shadow-pic p-4 456:p-6 768:p-10">
                ${guestsHtml}
                <div id="booking-calendar"></div>
            </div>
            <div id="booking-rooms" class="${STEP_TARGET_CLASSES} w-full max-w-212 mx-auto mt-10 768:mt-16"></div>
        </section>
        ${checkoutHtml}
    `;
}

export function getGuestsHtml(fieldsHtml: readonly string[]): string {
    return /*html*/ `
        <div class="mb-8 768:mb-12">
            <h2 class="font-playfair-display text-28 768:text-36 text-purple-haze-dark text-center mb-5 768:mb-6">Anzahl der Gäste</h2>
            <div id="booking-guests" class="flex flex-col 576:flex-row 576:items-start 576:justify-center gap-4 768:gap-8">
                ${fieldsHtml.join('')}
            </div>
        </div>
    `;
}

export function getGuestFieldHtml(view: GuestFieldView): string {
    const optionsHtml = view.options
        .map((option: SelectOption): string => /*html*/ `<option value="${escapeHtml(option.value)}"${option.selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
        .join('');

    return /*html*/ `
        <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-3 768:gap-4">
                <div class="relative flex-1 576:flex-none 576:w-60">
                    <select
                        data-guests="${escapeHtml(view.field)}"
                        aria-label="${escapeHtml(view.ariaLabel)}"
                        class="w-full appearance-none rounded-xl border border-purple-haze bg-white py-2 pl-6 pr-12 font-antic-didone text-18 456:text-24 leading-tight text-center text-purple-haze-dark cursor-pointer transition-colors hover:bg-purple-haze-light focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
                    >
                        <option value=""${view.placeholderSelected ? ' selected' : ''}>${escapeHtml(view.placeholder)}</option>
                        ${optionsHtml}
                    </select>
                    ${ICON_SELECT_CHEVRON}
                </div>
                <span class="shrink-0 flex items-center justify-center w-10 h-10 768:w-10.5 768:h-10.5 rounded-full bg-purple-haze text-white">
                    ${view.iconHtml}
                </span>
            </div>
            ${view.withNotice ? /*html*/ `<p data-guests-notice aria-live="polite" class="font-antic-didone text-14 leading-tight text-red-600"></p>` : ''}
        </div>
    `;
}

export function getCalendarHeaderHtml(view: CalendarHeaderView): string {
    return /*html*/ `
        <div class="grid grid-cols-[auto_1fr_auto] items-center gap-6 768:gap-10 mb-6 768:mb-10">
            <button
                type="button"
                data-action="prev"
                aria-label="Vorheriger Monat"
                ${view.prevDisabled ? 'disabled' : ''}
                class="text-purple-haze transition-opacity ${view.prevDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'}"
            >
                ${ICON_CHEVRON_LEFT}
            </button>

            <div class="text-center leading-tight">
                <div class="font-playfair-display text-28 768:text-36 text-purple-haze-dark">${escapeHtml(view.monthName)}</div>
                <div class="font-playfair-display text-18 768:text-22 text-purple-haze">${escapeHtml(view.year)}</div>
            </div>

            <button
                type="button"
                data-action="next"
                aria-label="Nächster Monat"
                ${view.nextDisabled ? 'disabled' : ''}
                class="text-purple-haze transition-opacity ${view.nextDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'}"
            >
                ${ICON_CHEVRON_RIGHT}
            </button>
        </div>
    `;
}

export function getCalendarGridHtml(cells: readonly DayCellView[]): string {
    return /*html*/ `
        <div class="grid grid-cols-7 gap-1.5 456:gap-2 768:gap-3">
            ${cells.map(getDayCellHtml).join('')}
        </div>
    `;
}

function getDayCellHtml(cell: DayCellView): string {
    const clearButton = cell.withClearButton
        ? /*html*/ `<span data-action="clear" role="button" aria-label="Auswahl zurücksetzen" class="booking__clear absolute top-1 right-1 leading-none text-14 768:text-16 cursor-pointer">&times;</span>`
        : '';

    // Durchgestrichen werden nur Wochentag und Datum – nicht die leere Label-Zeile, deren
    // geschütztes Leerzeichen sonst als Strich darunter stünde.
    const strike = cell.blocked ? ' line-through decoration-purple-haze/70' : '';

    return /*html*/ `
        <button
            type="button"
            data-date="${escapeHtml(cell.iso)}"
            ${cell.selectable ? '' : cell.blocked ? 'aria-disabled="true"' : 'disabled'}
            ${cell.tooltip === null ? '' : `title="${escapeHtml(cell.tooltip)}"`}
            class="relative flex flex-col items-center justify-center gap-0.5 456:gap-1 rounded-lg border border-purple-haze/20 py-2 456:py-3 768:py-4 transition-colors ${cell.stateClass}"
        >
            ${clearButton}
            <span class="text-[0.625rem] 456:text-14 768:text-16 tracking-wide${strike}">${escapeHtml(cell.weekday)}</span>
            <span class="font-antic-didone text-18 456:text-24 768:text-28 leading-none${strike}">${escapeHtml(cell.day)}</span>
            <span class="text-14 leading-none">${cell.label === null ? '&nbsp;' : escapeHtml(cell.label)}</span>
        </button>
    `;
}

export function getCalendarFooterHtml(canContinue: boolean): string {
    return /*html*/ `
        <div class="flex justify-center mt-8 768:mt-10">
            <button
                type="button"
                data-action="next-step"
                ${canContinue ? '' : 'disabled'}
                class="bg-purple-haze py-2 px-8 rounded-md font-lato font-semibold text-white transition-opacity ${canContinue ? 'opacity-85 hover:opacity-100 cursor-pointer' : 'opacity-40 cursor-not-allowed'}"
            >
                weiter
            </button>
        </div>
    `;
}
