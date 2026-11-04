import { escapeHtml } from '../../../shared/ui/html';

export type Step = -1 | 1;

export interface RoomAmenity {
    icon: string;
    label: string;
}

export type RoomsListView = {
    quantityNotice: string | null;
    cardsHtml: readonly string[];
    missingBedsNotice: string;
    servicesHtml: string;
    selectionBarHtml: string;
};

export type RoomCardView = {
    roomTypeId: string;
    bookable: boolean;
    selected: boolean;
    imageHtml: string;
    amenities: readonly RoomAmenity[];
    description: string | null;
    quantityHtml: string;
    availabilityHtml: string;
    rejectionHint: string | null;
};

export type RoomImageView = {
    name: string;
    imageUrl: string | null;
    imageAlt: string;
    priceLabel: string | null;
};

export type RoomQuantityView = {
    inputId: string;
    roomTypeId: string;
    quantity: number;
    max: number;
    decreaseHtml: string;
    increaseHtml: string;
};

export type ServicesSectionView = {
    hasRooms: boolean;
    rowsHtml: readonly string[];
};

export type ServiceRowView = {
    code: string;
    inputId: string;
    name: string;
    description: string | null;
    label: string;
    iconHtml: string;
    controlHtml: string;
    selected: boolean;
};

export type CheckboxView = {
    inputId: string;
    dataAttributes: Readonly<Record<string, string>>;
    checked: boolean;
    disabled: boolean;
};

export type ServiceQuantityView = {
    inputId: string;
    code: string;
    quantity: number;
    decreaseHtml: string;
    increaseHtml: string;
};

const NOTICE_CLASSES = 'rounded-[0.625rem] border border-purple-haze bg-purple-haze-light px-4 py-3 font-antic-didone text-16 leading-tight text-purple-haze-dark';

export function getRoomsNoticeHtml(message: string): string {
    return /*html*/ `<p class="font-antic-didone text-18 768:text-20 text-purple-haze-dark/70">${escapeHtml(message)}</p>`;
}

export function getRoomsListHtml(view: RoomsListView): string {
    const quantityNotice = view.quantityNotice === null ? '' : /*html*/ `<p role="status" class="mb-8 768:mb-11 ${NOTICE_CLASSES}">${escapeHtml(view.quantityNotice)}</p>`;

    return /*html*/ `
        ${quantityNotice}
        <div class="flex flex-col gap-8 768:gap-11">
            ${view.cardsHtml.join('')}
        </div>
        <p data-capacity-notice role="status" class="${view.missingBedsNotice === '' ? 'hidden' : ''} mt-8 768:mt-11 ${NOTICE_CLASSES}">${escapeHtml(view.missingBedsNotice)}</p>
        ${view.servicesHtml}
        <div data-selection-bar>${view.selectionBarHtml}</div>
    `;
}

export function getSelectionBarHtml(summary: string): string {
    return /*html*/ `
        <div class="mt-10 768:mt-16 flex flex-col 576:flex-row 576:items-center 576:justify-between gap-4 rounded-[0.625rem] border border-purple-haze bg-purple-haze-light px-5 py-4 768:px-8">
            <p class="font-playfair-display font-medium text-20 768:text-24 leading-tight text-purple-haze-dark text-center 576:text-left">${escapeHtml(summary)}</p>
            <button
                type="button"
                data-action="to-checkout"
                class="shrink-0 bg-purple-haze px-6 py-2.5 rounded-md font-lato font-bold text-18 768:text-20 text-white opacity-85 hover:opacity-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
            >
                weiter zu Ihren Daten
            </button>
        </div>
    `;
}

export function getRoomCardHtml(view: RoomCardView): string {
    const amenities =
        view.amenities.length === 0
            ? ''
            : /*html*/ `
                <ul class="grid gap-3 576:grid-cols-2 576:gap-x-16">
                    ${view.amenities
                        .map(
                            (amenity: RoomAmenity): string => /*html*/ `
                                <li class="flex items-center gap-2.5 font-antic-didone text-16 text-purple-haze-dark">
                                    ${amenity.icon}
                                    <span>${escapeHtml(amenity.label)}</span>
                                </li>
                            `,
                        )
                        .join('')}
                </ul>
            `;
    const description = view.description === null ? '' : /*html*/ `<p class="font-antic-didone text-18 768:text-20 text-purple-haze-dark">${escapeHtml(view.description)}</p>`;

    return /*html*/ `
        <article data-room-card="${escapeHtml(view.roomTypeId)}" class="flex flex-col 768:flex-row overflow-hidden ${view.bookable ? '' : 'opacity-60'} ${view.selected ? 'ring-2 ring-purple-haze' : ''}">
            ${view.imageHtml}
            <div class="flex-1 flex flex-col justify-center gap-3 bg-purple-haze-light px-5 py-6 768:px-8 768:py-8">
                ${amenities}
                ${description}
                ${view.quantityHtml}
                ${view.availabilityHtml}
                ${view.rejectionHint === null ? '' : /*html*/ `<p class="font-antic-didone text-16 leading-tight text-red-600">${escapeHtml(view.rejectionHint)}</p>`}
            </div>
        </article>
    `;
}

export function getRoomImageHtml(view: RoomImageView): string {
    const image =
        view.imageUrl === null
            ? /*html*/ `<div class="absolute inset-0 bg-purple-haze-dark"></div>`
            : /*html*/ `<img src="${escapeHtml(view.imageUrl)}" alt="${escapeHtml(view.imageAlt)}" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />`;
    const price =
        view.priceLabel === null
            ? ''
            : /*html*/ `<span class="absolute top-4 right-0 bg-purple-haze px-4 py-1 font-antic-didone text-20 768:text-24 text-white">${escapeHtml(view.priceLabel)}</span>`;

    return /*html*/ `
        <div class="relative shrink-0 768:w-76 aspect-304/321">
            ${image}
            <div class="absolute inset-0 bg-linear-to-b from-transparent from-35% to-purple-haze/75 to-90%"></div>
            ${price}
            <h3 class="absolute left-4 bottom-4 right-4 font-playfair-display font-medium text-32 768:text-36 leading-tight text-eggshell wrap-break-word">${escapeHtml(view.name)}</h3>
        </div>
    `;
}

/** Hinweis an der Stelle des Mengenwählers, solange Zeitraum oder Belegung fehlen. */
export function getRoomHintHtml(hint: string): string {
    return /*html*/ `<p class="font-antic-didone text-16 text-purple-haze-dark/70">${escapeHtml(hint)}</p>`;
}

export function getRoomQuantityHtml(view: RoomQuantityView): string {
    const inputId = escapeHtml(view.inputId);
    const roomTypeId = escapeHtml(view.roomTypeId);

    return /*html*/ `
        <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-4">
                <label for="${inputId}" class="font-playfair-display font-medium text-16 768:text-18 leading-tight text-purple-haze-dark">Anzahl Zimmer</label>
                <div class="flex items-center gap-2">
                    ${view.decreaseHtml}
                    <input
                        id="${inputId}"
                        data-room-quantity="${roomTypeId}"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        max="${view.max.toString()}"
                        step="1"
                        value="${view.quantity.toString()}"
                        class="booking__quantity w-16 456:w-20 appearance-none rounded-xl border border-purple-haze bg-white px-2 py-2 font-antic-didone text-18 456:text-24 leading-tight text-center text-purple-haze-dark transition-colors hover:bg-purple-haze-light focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
                    />
                    ${view.increaseHtml}
                </div>
            </div>
            <p data-room-quantity-notice="${roomTypeId}" aria-live="polite" class="font-antic-didone text-14 leading-tight text-purple-haze text-right"></p>
        </div>
    `;
}

export function getAvailabilityHtml(text: string, bookable: boolean): string {
    return /*html*/ `<p class="font-antic-didone text-16 ${bookable ? 'text-purple-haze-dark/70' : 'text-purple-haze'}">${escapeHtml(text)}</p>`;
}

export function getStepButtonHtml(step: Step, dataAttributes: Readonly<Record<string, string>>, ariaLabel: string, disabled: boolean): string {
    return /*html*/ `
        <button
            type="button"
            ${getDataAttributesHtml(dataAttributes)}
            aria-label="${escapeHtml(ariaLabel)}"
            ${disabled ? 'disabled' : ''}
            class="shrink-0 flex items-center justify-center w-9 h-9 456:w-10 456:h-10 rounded-full bg-purple-haze font-antic-didone text-24 leading-none text-white cursor-pointer transition-colors hover:bg-purple-haze-dark focus:outline-none focus:ring-2 focus:ring-purple-haze/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-haze"
        >${step > 0 ? '+' : '&minus;'}</button>
    `;
}

export function getServicesSectionHtml(view: ServicesSectionView): string {
    return /*html*/ `
        <section aria-labelledby="booking-services-title" class="mt-10 768:mt-16">
            <h2 id="booking-services-title" class="font-playfair-display text-28 768:text-36 text-purple-haze-dark text-center mb-2">Zusatzleistungen</h2>
            <p class="font-antic-didone text-16 768:text-18 leading-tight text-purple-haze-dark/70 text-center mb-6 768:mb-8">
                Gilt einmal für Ihren gesamten Aufenthalt – unabhängig von der Zimmeranzahl.
            </p>
            <p data-services-hint class="${view.hasRooms ? 'hidden' : ''} mb-4 font-antic-didone text-16 text-purple-haze text-center">Bitte zuerst ein Zimmer wählen.</p>
            <ul class="flex flex-col gap-4 768:gap-5">
                ${view.rowsHtml.join('')}
            </ul>
        </section>
    `;
}

export function getServiceRowHtml(view: ServiceRowView): string {
    const description =
        view.description === null ? '' : /*html*/ `<p class="font-antic-didone text-14 768:text-16 leading-tight text-purple-haze-dark/80">${escapeHtml(view.description)}</p>`;

    return /*html*/ `
        <li data-service-row="${escapeHtml(view.code)}" class="flex items-center gap-4 bg-purple-haze-light px-5 py-4 768:px-8 768:py-5 ${view.selected ? 'ring-2 ring-purple-haze' : ''}">
            ${view.iconHtml}
            <div class="flex-1 min-w-0 flex flex-col gap-1">
                <label for="${escapeHtml(view.inputId)}" class="font-playfair-display font-medium text-16 768:text-18 leading-tight text-purple-haze-dark cursor-pointer">${escapeHtml(view.name)}</label>
                ${description}
                <p data-service-amount="${escapeHtml(view.code)}" class="font-antic-didone text-14 leading-tight text-purple-haze">${escapeHtml(view.label)}</p>
            </div>
            ${view.controlHtml}
        </li>
    `;
}

export function getCheckboxHtml(view: CheckboxView): string {
    return /*html*/ `
        <input
            id="${escapeHtml(view.inputId)}"
            ${getDataAttributesHtml(view.dataAttributes)}
            type="checkbox"
            ${view.checked ? 'checked' : ''}
            ${view.disabled ? 'disabled' : ''}
            class="shrink-0 w-5 h-5 accent-purple-haze cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
        />
    `;
}

export function getServiceQuantityHtml(view: ServiceQuantityView): string {
    return /*html*/ `
        <div class="shrink-0 flex items-center gap-2">
            ${view.decreaseHtml}
            <output id="${escapeHtml(view.inputId)}" data-service-quantity="${escapeHtml(view.code)}" class="w-8 text-center font-antic-didone text-18 456:text-24 leading-tight text-purple-haze-dark">${view.quantity.toString()}</output>
            ${view.increaseHtml}
        </div>
    `;
}

function getDataAttributesHtml(attributes: Readonly<Record<string, string>>): string {
    return Object.entries(attributes)
        .map(([name, value]: [string, string]): string => `${name}="${escapeHtml(value)}"`)
        .join(' ');
}
