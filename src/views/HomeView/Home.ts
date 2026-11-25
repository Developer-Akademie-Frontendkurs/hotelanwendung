import AbstractView from '../AbstractView';
import seezugang from '../../assets/img/icons/seezugang.svg';
import haubenkueche from '../../assets/img/icons/kitchen.svg';
import wellness from '../../assets/img/icons/wellness.svg';
import fam_stroheim from '../../assets/img/familie-stroheim.jpg';
import kulinarik from '../../assets/img/kulinarik.jpg';
import kuhwanderung from '../../assets/img/kuh-wanderung.jpg';
import yoga from '../../assets/img/yoga.jpg';
import { buildRoomSlides, fetchRoomShowcase } from '../../shared/services/catalog.service';
import type { RoomSlide, RoomSlideFeature } from '../../shared/types/catalog.types';
import { getRoomFeatureIconHtml } from '../../shared/ui/roomFeatureIcons';
import { toISODate } from '../BookingView/domain/calendar';
import { BOOKING_PATH, getBookingHref } from '../BookingView/domain/preselection';
import { getWrappedIndex, isSlideStep } from './roomSlider';
import * as roomSliderTemplate from './templates/roomSlider.template';
import './home.css';

const ARROW_CLASSES =
    'shrink-0 text-purple-haze rounded-xs cursor-pointer invisible focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-haze data-[visible]:visible';
const ROOM_LOAD_ERROR = 'Unsere Zimmer können gerade nicht angezeigt werden. Bitte versuchen Sie es später noch einmal.';

export class HomeView extends AbstractView {
    private slides: readonly RoomSlide[] = [];
    private currentIndex = 0;
    private destroyed = false;
    private sliderEl: HTMLElement | null = null;

    constructor() {
        super();
        this.setTitle('Startseite | Karawanken Hof');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async afterRender(): Promise<void> {
        this.sliderEl = document.querySelector<HTMLElement>('[data-room-slider]');
        this.sliderEl?.addEventListener('click', (event: MouseEvent): void => {
            this.handleSliderClick(event);
        });
        void this.loadRooms();
    }

    destroy(): void {
        this.destroyed = true;
        this.sliderEl = null;
    }

    private async loadRooms(): Promise<void> {
        const today = toISODate(new Date());
        try {
            const slides = buildRoomSlides(await fetchRoomShowcase(today), today);
            if (this.destroyed) return;
            this.slides = slides;
            this.currentIndex = 0;
            this.renderSlider();
        } catch (error) {
            if (this.destroyed) return;
            console.error('Zimmer für den Slider konnten nicht geladen werden:', error);
            this.renderSliderNotice(ROOM_LOAD_ERROR);
        }
    }

    private handleSliderClick(event: MouseEvent): void {
        if (!(event.target instanceof Element)) return;
        const step = Number(event.target.closest<HTMLElement>('[data-room-step]')?.dataset.roomStep);
        if (!isSlideStep(step) || this.slides.length < 2) return;

        this.currentIndex = getWrappedIndex(this.currentIndex, step, this.slides.length);
        this.renderSlide();
        const announcementEl = this.sliderEl?.querySelector<HTMLElement>('[data-room-announcement]');
        const slide = this.slides[this.currentIndex];
        if (announcementEl && slide) announcementEl.textContent = `${slide.name}, Zimmer ${(this.currentIndex + 1).toString()} von ${this.slides.length.toString()}`;
    }

    private renderSlider(): void {
        if (!this.sliderEl) return;
        if (this.slides.length === 0) {
            this.sliderEl.hidden = true;
            return;
        }

        this.sliderEl.querySelectorAll<HTMLElement>('[data-room-step]').forEach((arrow: HTMLElement): void => {
            arrow.toggleAttribute('data-visible', this.slides.length > 1);
        });
        this.renderSlide();
    }

    /** Re-renders only the card and the booking link – arrows and listeners stay. */
    private renderSlide(): void {
        const slide = this.slides[this.currentIndex];
        const slideEl = this.sliderEl?.querySelector<HTMLElement>('[data-room-slide]');
        if (!slide || !slideEl) return;

        slideEl.innerHTML = roomSliderTemplate.getRoomSlideHtml({
            name: slide.name,
            description: slide.description ?? '',
            imageUrl: slide.imageUrl,
            imageAlt: slide.imageAlt,
            priceText: slide.priceLabel === null ? null : `ab ${slide.priceLabel} / Nacht`,
            features: slide.features.map(
                (feature: RoomSlideFeature): roomSliderTemplate.RoomSlideFeatureView => ({ iconHtml: getRoomFeatureIconHtml(feature.code), label: feature.label }),
            ),
            // No room detail page yet (see ticket) – "view Room" leads to the booking page for now.
            roomHref: BOOKING_PATH,
        });
        this.sliderEl?.querySelector<HTMLAnchorElement>('[data-room-booking]')?.setAttribute('href', getBookingHref(slide.slug));
    }

    private renderSliderNotice(message: string): void {
        const slideEl = this.sliderEl?.querySelector<HTMLElement>('[data-room-slide]');
        if (slideEl) slideEl.innerHTML = roomSliderTemplate.getRoomSliderNoticeHtml(message);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <div class="max-w-360 flex flex-col gap-y-10 576:gap-y-22 items-center pt-6 px-3 pb-16.25 mx-auto">
                <section class="max-w-3xl p-4 text-center">
                    <p class="font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">
                        Willkommen im Karawanken Hof – unseren familiengeführten Rückzugsort in den Alpen,
                        fernab von Stress und im Einklang mit der Natur.
                    </p>
                    <p class="mt-6 font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">
                        Freuen Sie sich auf exklusive Chalets, unberührte Wanderwege und geführte Rad- und
                        Kuhwanderungen – alles an einem Ort, der bewusst fern vom Alltag liegt.
                    </p>
                </section>

                <section class="w-full flex flex-col 576:flex-row gap-y-10 576:gap-x-25.5 justify-center items-center">
                    <article class="flex flex-col gap-y-2 items-center">
                        <img src="${seezugang}" alt="Seezugang">
                        <span class="font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">Seezugang</span>
                    </article>

                    <article class="flex flex-col gap-y-2 items-center">
                        <img src="${haubenkueche}" alt="Haubenküche">
                        <span class="font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">Haubenküche</span>
                    </article>

                    <article class="flex flex-col gap-y-2 items-center">
                        <img src="${wellness}" alt="Wellness">
                        <span class="font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark">Wellness</span>
                    </article>
                </section>

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

                        <label for="activity-1" class="activities__card relative block cursor-pointer select-none aspect-3/4 rounded-2xl overflow-hidden shadow-pic 768:flex-1 768:max-w-80">
                            <img src="${kuhwanderung}" alt="Kuhwanderung" class="absolute inset-0 w-full h-full object-cover">
                            <div class="absolute inset-0 bg-linear-to-t from-purple-haze-dark/85 via-purple-haze-dark/25 to-transparent"></div>
                            <h3 class="absolute bottom-5 left-5 max-w-[70%] font-playfair-display text-24 768:text-28 text-white leading-tight">Kuhwanderung</h3>
                            <a href="/aktivitaeten/kuhwanderung" aria-label="Kuh Wanderung" data-link class="activities__link absolute inset-0 z-10"></a>
                        </label>

                        <label for="activity-2" class="activities__card relative block cursor-pointer select-none aspect-3/4 rounded-2xl overflow-hidden shadow-pic 768:flex-1 768:max-w-80">
                            <img src="${yoga}" alt="Yoga" class="absolute inset-0 w-full h-full object-cover">
                            <div class="absolute inset-0 bg-linear-to-t from-purple-haze-dark/85 via-purple-haze-dark/25 to-transparent"></div>
                            <h3 class="absolute bottom-5 left-5 max-w-[70%] font-playfair-display text-24 768:text-28 text-white leading-tight">Yoga</h3>
                            <a href="/aktivitaeten/yoga" aria-label="Yoga am See" data-link class="activities__link absolute inset-0 z-10"></a>
                        </label>
                    </div>
                </section>
            </div>

            <section class="flex flex-col gap-y-4 768:gap-y-6 items-center mb-30 px-4">
                <p class="font-antic-didone text-20 text-purple-haze-dark">
                    seit über 80 Jahren
                </p>
                <h2 class="font-playfair-display text-32 text-purple-haze-dark">
                    Familie Stroheim
                </h2>
                <img src="${fam_stroheim}" alt="Familie Stroheim" class="w-full max-w-3xl object-cover rounded-xl shadow-pic">
                <p class="max-w-215 font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark text-center">
                    Die Familie Stroheim führt den Karawanken Hof mit viel Herz, persönlichem Engagement und
                    einem feinen Gespür für echte Gastfreundschaft.
                </p>
                <p class="max-w-215 mt-6 font-antic-didone text-16 576:text-20 992:text-24 text-purple-haze-dark text-center">
                    Als GastgeberInnen mit enger Verbundenheit zur Region verbinden sie Tradition, Qualität und Liebe zum Detail
                    – und schaffen so eine Atmosphäre, in der sich Gäste vom ersten Moment an willkommen
                    und bestens aufgehoben fühlen.
                </p>
            </section>

            <section data-room-slider aria-labelledby="room-slider-title" class="bg-purple-haze-light flex flex-col gap-y-6 992:gap-y-10 py-10 992:py-10.5 px-1 992:px-4">
                <div class="flex flex-col gap-y-3 items-center">
                    <h2 id="room-slider-title" class="font-playfair-display text-24 456:text-32 768:text-48 leading-[1.2] text-purple-haze-dark font-medium text-center">Zimmer mit Weitblick</h2>
                    <p class="w-46 456:w-full font-antic-didone text-16 768:text-20 text-purple-haze-dark text-center leading-[1.2]">Exklusive Rückzugsorte zwischen Bergen und See</p>
                </div>

                <div class="w-full max-w-300 mx-auto flex items-center gap-x-1 992:gap-x-3.75">
                    <button type="button" data-room-step="-1" aria-label="Vorheriges Zimmer" aria-controls="room-slide" class="${ARROW_CLASSES}">
                        <svg class="w-8 h-8 992:w-10 992:h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="15 6 9 12 15 18"></polyline>
                        </svg>
                    </button>

                    <div id="room-slide" data-room-slide class="flex-1 min-w-0">${roomSliderTemplate.getRoomSlideSkeletonHtml()}</div>

                    <button type="button" data-room-step="1" aria-label="Nächstes Zimmer" aria-controls="room-slide" class="${ARROW_CLASSES}">
                        <svg class="w-8 h-8 992:w-10 992:h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="9 6 15 12 9 18"></polyline>
                        </svg>
                    </button>
                </div>

                <p data-room-announcement aria-live="polite" class="sr-only"></p>

                <a href="${BOOKING_PATH}" data-link data-room-booking class="self-center bg-purple-haze px-3 py-2 font-lato font-bold text-24 leading-[0.8] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-haze">Buchen</a>
            </section>

            <section class="flex flex-col gap-y-4 768:gap-y-6 items-center py-16.25 992:py-30 px-4">
                <h2 class="font-playfair-display text-32 text-purple-haze-dark">So finden sie uns</h2>
                <iframe class="w-full max-w-300 h-112.5 rounded-2xl shadow-pic" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d685.4927898019566!2d13.82622416971581!3d46.58780751985834!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x477a7f14b8666013%3A0x6df49d50119e63d2!2sHotel%20Karawankenhof!5e0!3m2!1sde!2sde!4v1784009629674!5m2!1sde!2sde" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </section>
        `;
    }
}
