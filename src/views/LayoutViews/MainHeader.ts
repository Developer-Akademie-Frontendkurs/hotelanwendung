import AbstractView from '../AbstractView';
import logo from '../../assets/img/logo.svg';
import stars from '../../assets/img/icons/stars.png';
import mainHeaderBg from '../../assets/img/main-header-bg.jpg';
import type { BookingHeaderConfig, PageHeaderConfig, HeaderConfig } from './header.types';

export const homeHeader: HeaderConfig = {
    variant: 'page',
    title: 'Luxus in den Alpen',
    subtitle: 'wo sich Fuchs und Hase <br>gute Nacht sagen',
    backgroundImage: mainHeaderBg,
    withStars: true,
    fullHeight: true,
};

export const aboutHeader: HeaderConfig = {
    variant: 'page',
    title: 'Über uns',
    subtitle: 'Erfahren Sie mehr über den Karawanken Hof',
    backgroundImage: mainHeaderBg,
    withStars: false,
    fullHeight: true,
};

export const postsHeader: HeaderConfig = {
    variant: 'page',
    title: 'Blog',
    subtitle: 'Neuigkeiten aus dem Karawanken Hof',
    backgroundImage: mainHeaderBg,
    withStars: false,
    fullHeight: true,
};

export class MainHeader extends AbstractView {
    private readonly config: HeaderConfig;

    constructor(config: HeaderConfig) {
        super();
        this.config = config;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return this.config.variant === 'booking' ? this.getBookingHeaderHtml(this.config) : this.getPageHeaderHtml(this.config);
    }

    private getPageHeaderHtml(config: PageHeaderConfig): string {
        const heightClass: string = config.fullHeight ? 'min-h-screen' : 'min-h-125';
        const starsHtml: string = config.withStars ? /*html*/ `<img src="${stars}" alt="Stars">` : '';

        return /*html*/ `
            <header class="mobile-menu bg-cover bg-center" style="background-image: url('${config.backgroundImage}')">
                <div class="w-full max-w-360 ${heightClass} mx-auto">
                    <div class="w-full flex items-center justify-between pt-4">
                        <img src="${logo}" alt="Karawanken Hof Logo">

                        ${this.getMobileNavigationHtml()}

                        ${this.getDesktopNavigationHtml()}
                    </div>
                    <div class="flex flex-col gap-y-4 items-center mt-12">
                        ${starsHtml}
                        <h1 class="font-playfair-display font-semibold text-32 576:text-48 992:text-64 text-purple-haze">${config.title}</h1>
                        <p class="font-caveat text-28 576:text-32 992:text-48 text-purple-haze text-center leading-none">
                            ${config.subtitle}
                        </p>
                    </div>
                </div>
            </header>
        `;
    }

    private getMobileNavigationHtml(): string {
        return /*html*/ `
            <div id="mobile-menu" class="flex gap-x-4">
                <nav class="768:hidden flex gap-4 items-center">
                    <a href="/buchung" class="hidden 456:inline bg-purple-haze px-3 py-1 rounded-2xl font-lato text-18 font-semibold text-white opacity-85 hover:opacity-100" data-link>Buchen</a>
                    <input id="mobile-menu-checkbox" type="checkbox" class="mobile-menu__checkbox">
                    <label class="mobile-menu__btn" for="mobile-menu-checkbox">
                        <div class="mobile-menu__icon"></div>
                    </label>
                    <div class="mobile-menu__container">
                        <ul class="mobile-menu__list">
                            <li class="mobile-menu__item"><a href="/" class="mobile-menu__link border-b-2 border-transparent hover:border-purple-haze" data-link>Startseite</a></li>
                            <li class="mobile-menu__item"><a href="/about" class="mobile-menu__link border-b-2 border-transparent hover:border-purple-haze" data-link>Über uns</a></li>
                            <li class="mobile-menu__item"><a href="/buchung" class="456:hidden bg-purple-haze px-3 py-2 rounded-2xl font-lato text-18 font-semibold text-white opacity-85 hover:opacity-100" data-link>Buchen</a></li>
                        </ul>
                    </div>
                </nav>
            </div>
        `;
    }

    private getDesktopNavigationHtml(): string {
        return /*html*/ `
            <div id="desktop-menu" class="hidden 768:block">
                <nav>
                    <ul class="flex gap-x-16">
                        <li><a href="/" class="border-b-2 border-transparent hover:border-purple-haze font-playfair text-24 text-purple-haze" data-link>Startseite</a></li>
                        <li><a href="/about" class="border-b-2 border-transparent hover:border-purple-haze font-playfair text-24 text-purple-haze" data-link>Über uns</a></li>
                        <li><a href="/buchung" class="bg-purple-haze py-2 px-3 rounded-2xl font-lato text-white text-24 font-semibold opacity-85 hover:opacity-100" data-link>Buchen</a></li>
                    </ul>
                </nav>
            </div>
        `;
    }

    private getBookingHeaderHtml(config: BookingHeaderConfig): string {
        const steps: string[] = ['Datum & Gäste', 'Zimmerauswahl', 'persönliche Daten'];

        return /*html*/ `
            <header class="w-full bg-cover bg-center" style="background-image: url('${mainHeaderBg}')">
                <div class="w-full max-w-360 mx-auto flex flex-col 768:flex-row 768:items-center gap-y-6 768:gap-x-24 px-4 pt-4 pb-6">
                    <a href="/" data-link><img src="${logo}" alt="Karawanken Hof Logo"></a>
                    <ol class="flex justify-center gap-x-8 768:gap-x-16">
                        ${steps.map((label: string, index: number): string => this.getBookingStepHtml(label, index + 1, config.activeStep)).join('')}
                    </ol>
                </div>
            </header>
        `;
    }

    private getBookingStepHtml(label: string, step: number, activeStep: number): string {
        const isDone: boolean = step <= activeStep;
        const circleClass: string = isDone ? 'bg-purple-haze border-purple-haze' : 'bg-transparent border-purple-haze';
        const labelClass: string = isDone ? 'text-purple-haze-dark' : 'text-purple-haze-light';

        return /*html*/ `
            <li class="flex flex-col items-center gap-y-2">
                <span class="w-6 h-6 rounded-full border-2 ${circleClass}"></span>
                <span class="font-antic-didone text-16 ${labelClass}">${label}</span>
            </li>
        `;
    }
}
