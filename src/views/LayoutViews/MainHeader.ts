import AbstractView from '../AbstractView';
import logo from '../../assets/img/logo.svg';
import stars from '../../assets/img/icons/stars.png';
import mainHeaderBg from '../../assets/img/main-header-bg.jpg';
import { bookingState, type BookingStep } from '../../shared/state/bookingState';
import type { BookingHeaderConfig, PageHeaderConfig, HeaderConfig, StepState } from './header.types';

type BookingStepDefinition = {
    step: BookingStep;
    label: string;
};

const BOOKING_STEPS: readonly BookingStepDefinition[] = [
    { step: 1, label: 'Datum & Gäste' },
    { step: 2, label: 'Zimmerauswahl' },
    { step: 3, label: 'persönliche Daten' },
];

const STEP_CIRCLE_CLASSES: Record<StepState, string> = {
    pending: 'bg-transparent border-purple-haze/40',
    current: 'bg-transparent border-purple-haze ring-4 ring-purple-haze/45',
    done: 'bg-purple-haze border-purple-haze',
};

const STEP_LABEL_CLASSES: Record<StepState, string> = {
    pending: 'text-purple-haze/80',
    current: 'text-purple-haze',
    done: 'text-purple-haze-dark',
};

function getStepState(step: BookingStep, activeStep: BookingStep): StepState {
    if (bookingState.isStepComplete(step)) {
        return 'done';
    }

    return step === activeStep ? 'current' : 'pending';
}

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

export const bookingHeader: HeaderConfig = {
    variant: 'booking',
    activeStep: 1,
};

export class MainHeader extends AbstractView {
    private readonly config: HeaderConfig;
    private unsubscribe: (() => void) | null = null;

    constructor(config: HeaderConfig) {
        super();
        this.config = config;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return this.config.variant === 'booking' ? this.getBookingHeaderHtml(this.config) : this.getPageHeaderHtml(this.config);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async afterRender(): Promise<void> {
        if (this.config.variant !== 'booking') return;

        this.unsubscribe = bookingState.subscribe((): void => {
            this.renderSteps();
        });
    }

    /**
     * Räumt den Header ab, bevor der Router das Layout neu aufbaut.
     * Reihenfolge ist wichtig: erst abmelden, dann zurücksetzen – so erreicht die
     * Reset-Benachrichtigung diesen Header nicht mehr. Mehrfachaufrufe sind unschädlich.
     */
    destroy(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        if (this.config.variant === 'booking') {
            bookingState.reset();
        }
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
        return /*html*/ `
            <header class="relative w-full bg-cover bg-center mb-0 456:mb-10" style="background-image: url('${mainHeaderBg}')">
                <div class="w-full bg-eggshell/65">
                    <div class="w-full max-w-360 mx-auto flex flex-col 768:flex-row 768:items-center gap-y-6 768:gap-x-24 px-4 pt-4 pb-6">
                        <a href="/" data-link><img src="${logo}" alt="Karawanken Hof Logo"></a>
                    </div>
                    <div class="hidden 456:block absolute -bottom-11 w-full">
                        <ol id="booking-steps" class="w-full max-w-120 flex mx-auto">
                            ${this.getBookingStepsHtml(config.activeStep)}
                        </ol>
                    </div>
                </div>
            </header>
        `;
    }

    /** Ersetzt nur die Steps – dieselbe Funktion für Erst-Render und Neu-Render nach einer Zustandsänderung. */
    private renderSteps(): void {
        const stepsEl: HTMLElement | null = document.getElementById('booking-steps');
        if (!stepsEl || this.config.variant !== 'booking') return;

        stepsEl.innerHTML = this.getBookingStepsHtml(this.config.activeStep);
    }

    private getBookingStepsHtml(activeStep: BookingStep): string {
        const states: StepState[] = BOOKING_STEPS.map((definition: BookingStepDefinition): StepState => getStepState(definition.step, activeStep));
        const items: string[] = BOOKING_STEPS.map((definition: BookingStepDefinition, index: number): string => {
            return this.getBookingStepHtml(definition.label, states[index] ?? 'pending', states[index - 1]);
        });

        return items.join('');
    }

    private getBookingStepHtml(label: string, state: StepState, previousState: StepState | undefined): string {
        // Die Verbinder-Linie zeigt den zurückgelegten Weg, hängt also am Vorgänger-Step.
        const lineColor: string = previousState === 'done' ? 'bg-purple-haze' : 'bg-purple-haze/45';
        const connector: string =
            previousState === undefined
                ? ''
                : /*html*/ `<span class="absolute top-3 -translate-y-1/2 right-[calc(50%+0.75rem)] w-[calc(100%-1.5rem)] h-0.5 transition-colors ${lineColor}"></span>`;
        const currentAttribute: string = state === 'current' ? ' aria-current="step"' : '';

        return /*html*/ `
            <li class="relative flex flex-1 flex-col items-center gap-y-2"${currentAttribute}>
                ${connector}
                <span class="w-6 h-6 rounded-full border-2 transition-colors ${STEP_CIRCLE_CLASSES[state]}"></span>
                <span class="font-lato text-16 transition-colors ${STEP_LABEL_CLASSES[state]}">${label}</span>
            </li>
        `;
    }
}
