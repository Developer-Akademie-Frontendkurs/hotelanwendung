import { escapeHtml } from '../../../shared/ui/html';

export type RoomSlideFeatureView = {
    iconHtml: string;
    label: string;
};

export type RoomSlideView = {
    name: string;
    description: string;
    imageUrl: string | null;
    imageAlt: string;
    priceText: string | null;
    features: readonly RoomSlideFeatureView[];
    roomHref: string;
};

const CARD_CLASSES = 'bg-surface flex flex-col 992:flex-row 992:h-85.5';
const IMAGE_BOX_CLASSES = 'aspect-[561/342] 992:aspect-auto 992:h-full bg-surface-muted';
const MOBILE_PRICE_CLASSES = '992:hidden min-h-[1.2lh] px-4 pt-6 font-antic-didone text-18 leading-[1.2] text-purple-haze-dark';
const INFO_CLASSES = '992:w-1/2 flex flex-col gap-y-6 992:gap-y-2 992:justify-between pt-4 992:pt-2 pb-4 px-4 992:pb-2 992:pl-6 992:pr-2';
const DESCRIPTION_CLASSES = 'line-clamp-3 min-h-[3lh] 992:min-h-0 font-antic-didone text-16 992:text-20 leading-[1.2] text-purple-haze-dark';
const FEATURES_CLASSES = 'grid grid-cols-1 576:grid-cols-2 gap-x-4.5 gap-y-4 992:gap-y-6 992:max-w-97';

export function getRoomSlideHtml(slide: RoomSlideView): string {
    const priceText = slide.priceText === null ? '' : escapeHtml(slide.priceText);

    return /*html*/ `
        <article class="${CARD_CLASSES}">
            <div class="w-full 992:w-1/2 shrink-0">
                <div class="${IMAGE_BOX_CLASSES}">
                    ${
                        slide.imageUrl === null
                            ? /*html*/ `<div role="img" aria-label="${escapeHtml(slide.imageAlt)}" class="w-full h-full flex items-center justify-center font-antic-didone text-16 text-muted">Kein Bild vorhanden</div>`
                            : /*html*/ `<img src="${escapeHtml(slide.imageUrl)}" alt="${escapeHtml(slide.imageAlt)}" class="w-full h-full object-cover">`
                    }
                </div>
                <p class="${MOBILE_PRICE_CLASSES}">${priceText}</p>
            </div>

            <div class="${INFO_CLASSES}">
                <div class="flex flex-col gap-y-4">
                    <p class="hidden 992:block min-h-[1.2lh] font-antic-didone text-24 leading-[1.2] text-purple-haze-dark">${priceText}</p>
                    <h3 class="line-clamp-1 font-playfair-display text-20 992:text-36 leading-[1.2] 992:leading-none text-purple-haze-dark">${escapeHtml(slide.name)}</h3>
                    <p class="${DESCRIPTION_CLASSES}">${escapeHtml(slide.description)}</p>
                </div>

                <ul class="${FEATURES_CLASSES}">
                    ${slide.features
                        .map(
                            (feature: RoomSlideFeatureView): string => /*html*/ `
                                <li class="min-h-12 flex items-center gap-x-2.5 pr-2.5">
                                    <span class="w-9.75 shrink-0 flex justify-center [&>svg]:w-full">${feature.iconHtml}</span>
                                    <span class="font-antic-didone text-16 leading-[1.2] text-purple-haze-dark">${escapeHtml(feature.label)}</span>
                                </li>
                            `,
                        )
                        .join('')}
                </ul>

                <a href="${escapeHtml(slide.roomHref)}" data-link class="self-start border border-purple-haze rounded-xs px-2 py-1 font-antic-didone text-20 leading-[1.2] text-purple-haze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-haze">view Room</a>
            </div>
        </article>
    `;
}

/** Same frame as a slide, so the page does not jump when the data arrives. */
export function getRoomSlideSkeletonHtml(): string {
    const bar = (classes: string): string => /*html*/ `<span class="block rounded-xs bg-purple-haze-light ${classes}"></span>`;

    return /*html*/ `
        <article class="${CARD_CLASSES} animate-pulse" aria-busy="true">
            <span class="sr-only">Zimmer werden geladen …</span>
            <div class="w-full 992:w-1/2 shrink-0">
                <div class="${IMAGE_BOX_CLASSES}"></div>
                <p class="${MOBILE_PRICE_CLASSES}">${bar('w-32 h-[1.2lh]')}</p>
            </div>
            <div class="${INFO_CLASSES}">
                <div class="flex flex-col gap-y-4">
                    <p class="hidden 992:block font-antic-didone text-24 leading-[1.2]">${bar('w-40 h-[1.2lh]')}</p>
                    <p class="font-playfair-display text-20 992:text-36 leading-[1.2] 992:leading-none">${bar('w-2/3 h-[1.2lh]')}</p>
                    <p class="${DESCRIPTION_CLASSES}">${bar('w-full h-[3lh] 992:h-[2lh]')}</p>
                </div>
                <div class="${FEATURES_CLASSES}">
                    ${Array.from({ length: 4 }, (): string => bar('h-12')).join('')}
                </div>
                <p class="self-start border border-transparent font-antic-didone text-20 leading-[1.2] px-2 py-1">${bar('w-24 h-[1.2lh]')}</p>
            </div>
        </article>
    `;
}

export function getRoomSliderNoticeHtml(message: string): string {
    return /*html*/ `
        <div class="${CARD_CLASSES} items-center justify-center min-h-85.5 p-6">
            <p class="font-antic-didone text-16 992:text-20 text-purple-haze-dark text-center">${escapeHtml(message)}</p>
        </div>
    `;
}
