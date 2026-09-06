import AbstractView from '../AbstractView';
import { bookingState } from '../../shared/state/bookingState';
import './booking.css';

type DayCell = {
    date: Date;
    inCurrentMonth: boolean;
    isPast: boolean;
    isToday: boolean;
    isStart: boolean;
    isEnd: boolean;
    inRange: boolean;
    isWeekend: boolean;
    selectable: boolean;
};

type Booking = {
    checkIn: string;
    checkOut: string;
    nights: number;
    adults: number | null;
    children: number | null;
};

type GuestField = 'adults' | 'children';

type GuestOption = {
    value: number;
    label: string;
};

const WEEKDAYS: readonly string[] = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const MONTHS: readonly string[] = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const MS_PER_DAY = 86_400_000;

const MAX_ADULTS = 6;
const MAX_CHILDREN = 4;

// Icons aus dem Figma-Design (Frames "icon_adult" / "icon_kid"), als Inline-SVG statt als Asset.
const ADULT_ICON = /*html*/ `
    <svg class="w-6 h-6 768:w-[1.625rem] 768:h-[1.625rem]" viewBox="0 0 26 26" fill="currentColor" aria-hidden="true">
        <path d="M8.40938 11.0906C7.13646 9.81771 6.5 8.2875 6.5 6.5C6.5 4.7125 7.13646 3.18229 8.40938 1.90938C9.68229 0.636458 11.2125 0 13 0C14.7875 0 16.3177 0.636458 17.5906 1.90938C18.8635 3.18229 19.5 4.7125 19.5 6.5C19.5 8.2875 18.8635 9.81771 17.5906 11.0906C16.3177 12.3635 14.7875 13 13 13C11.2125 13 9.68229 12.3635 8.40938 11.0906ZM0 26V21.45C0 20.5292 0.236979 19.6828 0.710938 18.9109C1.1849 18.1391 1.81458 17.55 2.6 17.1438C4.27917 16.3042 5.98542 15.6745 7.71875 15.2547C9.45208 14.8349 11.2125 14.625 13 14.625C14.7875 14.625 16.5479 14.8349 18.2812 15.2547C20.0146 15.6745 21.7208 16.3042 23.4 17.1438C24.1854 17.55 24.8151 18.1391 25.2891 18.9109C25.763 19.6828 26 20.5292 26 21.45V26H0ZM3.25 22.75H22.75V21.45C22.75 21.1521 22.6755 20.8812 22.5266 20.6375C22.3776 20.3937 22.1812 20.2042 21.9375 20.0688C20.475 19.3375 18.999 18.7891 17.5094 18.4234C16.0198 18.0578 14.5167 17.875 13 17.875C11.4833 17.875 9.98021 18.0578 8.49062 18.4234C7.00104 18.7891 5.525 19.3375 4.0625 20.0688C3.81875 20.2042 3.6224 20.3937 3.47344 20.6375C3.32448 20.8812 3.25 21.1521 3.25 21.45V22.75ZM15.2953 8.79531C15.9318 8.15885 16.25 7.39375 16.25 6.5C16.25 5.60625 15.9318 4.84115 15.2953 4.20469C14.6589 3.56823 13.8938 3.25 13 3.25C12.1062 3.25 11.3411 3.56823 10.7047 4.20469C10.0682 4.84115 9.75 5.60625 9.75 6.5C9.75 7.39375 10.0682 8.15885 10.7047 8.79531C11.3411 9.43177 12.1062 9.75 13 9.75C13.8938 9.75 14.6589 9.43177 15.2953 8.79531Z" />
    </svg>
`;

const CHILD_ICON = /*html*/ `
    <svg class="w-6 h-6 768:w-[1.625rem] 768:h-[1.625rem]" viewBox="0 0 26 26" fill="currentColor" aria-hidden="true">
        <path d="M15.3292 12.1153C14.9801 11.7662 14.8056 11.3389 14.8056 10.8333C14.8056 10.3278 14.9801 9.90046 15.3292 9.55139C15.6782 9.20232 16.1056 9.02778 16.6111 9.02778C17.1167 9.02778 17.544 9.20232 17.8931 9.55139C18.2421 9.90046 18.4167 10.3278 18.4167 10.8333C18.4167 11.3389 18.2421 11.7662 17.8931 12.1153C17.544 12.4644 17.1167 12.6389 16.6111 12.6389C16.1056 12.6389 15.6782 12.4644 15.3292 12.1153ZM8.10695 12.1153C7.75787 11.7662 7.58333 11.3389 7.58333 10.8333C7.58333 10.3278 7.75787 9.90046 8.10695 9.55139C8.45602 9.20232 8.88333 9.02778 9.38889 9.02778C9.89444 9.02778 10.3218 9.20232 10.6708 9.55139C11.0199 9.90046 11.1944 10.3278 11.1944 10.8333C11.1944 11.3389 11.0199 11.7662 10.6708 12.1153C10.3218 12.4644 9.89444 12.6389 9.38889 12.6389C8.88333 12.6389 8.45602 12.4644 8.10695 12.1153ZM9.08194 19.0306C7.91435 18.2361 7.0537 17.1889 6.5 15.8889H19.5C18.9463 17.1889 18.0856 18.2361 16.9181 19.0306C15.7505 19.825 14.4444 20.2222 13 20.2222C11.5556 20.2222 10.2495 19.825 9.08194 19.0306ZM7.92639 24.9708C6.34954 24.2847 4.97731 23.3579 3.80972 22.1903C2.64213 21.0227 1.71528 19.6505 1.02917 18.0736C0.343056 16.4968 0 14.8056 0 13C0 11.1944 0.343056 9.50324 1.02917 7.92639C1.71528 6.34954 2.64213 4.97731 3.80972 3.80972C4.97731 2.64213 6.34954 1.71528 7.92639 1.02917C9.50324 0.343056 11.1944 0 13 0C14.8056 0 16.4968 0.343056 18.0736 1.02917C19.6505 1.71528 21.0227 2.64213 22.1903 3.80972C23.3579 4.97731 24.2847 6.34954 24.9708 7.92639C25.6569 9.50324 26 11.1944 26 13C26 14.8056 25.6569 16.4968 24.9708 18.0736C24.2847 19.6505 23.3579 21.0227 22.1903 22.1903C21.0227 23.3579 19.6505 24.2847 18.0736 24.9708C16.4968 25.6569 14.8056 26 13 26C11.1944 26 9.50324 25.6569 7.92639 24.9708ZM20.15 20.15C22.1241 18.1759 23.1111 15.7926 23.1111 13C23.1111 10.2074 22.1241 7.82407 20.15 5.85C18.1759 3.87593 15.7926 2.88889 13 2.88889H12.5667C12.4222 2.88889 12.2778 2.91296 12.1333 2.96111C11.9889 3.10556 11.8926 3.26204 11.8444 3.43056C11.7963 3.59907 11.7722 3.77963 11.7722 3.97222C11.7722 4.47778 11.9468 4.90509 12.2958 5.25417C12.6449 5.60324 13.0722 5.77778 13.5778 5.77778C13.7944 5.77778 13.9931 5.74167 14.1736 5.66944C14.3542 5.59722 14.5407 5.56111 14.7333 5.56111C15.0222 5.56111 15.263 5.66944 15.4556 5.88611C15.6481 6.10278 15.7444 6.35556 15.7444 6.64444C15.7444 7.19815 15.4856 7.55324 14.9681 7.70972C14.4505 7.8662 13.987 7.94444 13.5778 7.94444C12.4944 7.94444 11.5616 7.55324 10.7792 6.77083C9.99676 5.98843 9.60556 5.05556 9.60556 3.97222V3.75556C9.60556 3.68333 9.61759 3.58704 9.64167 3.46667C7.64352 4.18889 6.01852 5.40463 4.76667 7.11389C3.51481 8.82315 2.88889 10.7852 2.88889 13C2.88889 15.7926 3.87593 18.1759 5.85 20.15C7.82407 22.1241 10.2074 23.1111 13 23.1111C15.7926 23.1111 18.1759 22.1241 20.15 20.15Z" />
    </svg>
`;

export class BookingView extends AbstractView {
    private readonly today: Date;
    private displayedYear: number;
    private displayedMonth: number;
    private calendarEl: HTMLElement | null = null;
    private readonly guests: Record<GuestField, number | null> = { adults: null, children: null };

    constructor() {
        super();
        this.setTitle('Buchung');
        this.today = stripTime(new Date());
        this.displayedYear = this.today.getFullYear();
        this.displayedMonth = this.today.getMonth();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <section class="px-3 py-10 768:py-16">
                <div class="w-full max-w-300 mx-auto bg-eggshell rounded-3xl shadow-pic p-4 456:p-6 768:p-10">
                    ${this.getGuestsHtml()}
                    <div id="booking-calendar"></div>
                </div>
            </section>
        `;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async afterRender(): Promise<void> {
        document.getElementById('booking-guests')?.addEventListener('change', (event: Event): void => {
            this.handleGuestChange(event);
        });

        this.calendarEl = document.getElementById('booking-calendar');
        if (!this.calendarEl) return;
        this.calendarEl.addEventListener('click', (event: MouseEvent): void => {
            this.handleClick(event);
        });
        this.renderCalendar();
    }

    private getGuestsHtml(): string {
        return /*html*/ `
            <div class="mb-8 768:mb-12">
                <h2 class="font-playfair-display text-28 768:text-36 text-purple-haze-dark text-center mb-5 768:mb-6">Anzahl der Gäste</h2>
                <div id="booking-guests" class="flex flex-col 576:flex-row 576:justify-center gap-4 768:gap-8">
                    ${this.getGuestFieldHtml('adults', 'Erwachsene', 'Anzahl der Erwachsenen', buildAdultOptions(), ADULT_ICON)}
                    ${this.getGuestFieldHtml('children', 'Kinder', 'Anzahl der Kinder', buildChildOptions(), CHILD_ICON)}
                </div>
            </div>
        `;
    }

    private getGuestFieldHtml(field: GuestField, placeholder: string, ariaLabel: string, options: readonly GuestOption[], icon: string): string {
        const selected = this.guests[field];

        const optionsHtml = options
            .map((option: GuestOption): string => {
                const isSelected = selected === option.value ? ' selected' : '';
                return /*html*/ `<option value="${option.value.toString()}"${isSelected}>${option.label}</option>`;
            })
            .join('');

        return /*html*/ `
            <div class="flex items-center gap-3 768:gap-4">
                <div class="relative flex-1 576:flex-none 576:w-60">
                    <select
                        data-guests="${field}"
                        aria-label="${ariaLabel}"
                        class="w-full appearance-none rounded-xl border border-purple-haze bg-white py-2 pl-6 pr-12 font-antic-didone text-18 456:text-24 leading-tight text-center text-purple-haze-dark cursor-pointer transition-colors hover:bg-purple-haze-light focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
                    >
                        <option value=""${selected === null ? ' selected' : ''}>${placeholder}</option>
                        ${optionsHtml}
                    </select>
                    <svg class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-2.5 text-purple-haze" viewBox="0 0 16 12" fill="none" aria-hidden="true">
                        <path d="M1.5 1.5 7.5 10 14 1.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </div>
                <span class="shrink-0 flex items-center justify-center w-10 h-10 768:w-[2.625rem] 768:h-[2.625rem] rounded-full bg-purple-haze text-white">
                    ${icon}
                </span>
            </div>
        `;
    }

    private handleGuestChange(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;

        const field = target.dataset.guests;
        if (field !== 'adults' && field !== 'children') return;

        this.guests[field] = target.value === '' ? null : Number(target.value);
    }

    private renderCalendar(): void {
        if (!this.calendarEl) return;
        this.calendarEl.innerHTML = this.getHeaderHtml() + this.getGridHtml() + this.getFooterHtml();
    }

    private getHeaderHtml(): string {
        const monthName = MONTHS[this.displayedMonth] ?? '';
        const prevDisabled = !this.canGoPrev();

        return /*html*/ `
            <div class="grid grid-cols-[auto_1fr_auto] items-center gap-6 768:gap-10 mb-6 768:mb-10">
                <button
                    type="button"
                    data-action="prev"
                    aria-label="Vorheriger Monat"
                    ${prevDisabled ? 'disabled' : ''}
                    class="text-purple-haze transition-opacity ${prevDisabled ? 'opacity-25 cursor-not-allowed' : 'hover:opacity-70 cursor-pointer'}"
                >
                    <svg class="w-8 h-8 768:w-10 768:h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="15 6 9 12 15 18"></polyline>
                    </svg>
                </button>

                <div class="text-center leading-tight">
                    <div class="font-playfair-display text-28 768:text-36 text-purple-haze-dark">${monthName}</div>
                    <div class="font-playfair-display text-18 768:text-22 text-purple-haze">${this.displayedYear.toString()}</div>
                </div>

                <button
                    type="button"
                    data-action="next"
                    aria-label="Nächster Monat"
                    class="text-purple-haze transition-opacity hover:opacity-70 cursor-pointer"
                >
                    <svg class="w-8 h-8 768:w-10 768:h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="9 6 15 12 9 18"></polyline>
                    </svg>
                </button>
            </div>
        `;
    }

    private getGridHtml(): string {
        const cells = this.buildDays();
        return /*html*/ `
            <div class="grid grid-cols-7 gap-1.5 456:gap-2 768:gap-3">
                ${cells.map((cell: DayCell): string => this.getDayCellHtml(cell)).join('')}
            </div>
        `;
    }

    private getDayCellHtml(cell: DayCell): string {
        const weekday = WEEKDAYS[(cell.date.getDay() + 6) % 7] ?? '';
        const stateClass = this.getCellStateClass(cell);

        let label = '&nbsp;';
        if (cell.isStart) label = 'Anreise';
        else if (cell.isEnd) label = 'Abreise';

        const clearBtn = cell.isStart
            ? /*html*/ `<span data-action="clear" role="button" aria-label="Auswahl zurücksetzen" class="booking__clear absolute top-1 right-1 leading-none text-14 768:text-16 cursor-pointer">&times;</span>`
            : '';

        return /*html*/ `
            <button
                type="button"
                data-date="${toISODate(cell.date)}"
                ${cell.selectable ? '' : 'disabled'}
                class="relative flex flex-col items-center justify-center gap-0.5 456:gap-1 rounded-lg border border-purple-haze/20 py-2 456:py-3 768:py-4 transition-colors ${stateClass}"
            >
                ${clearBtn}
                <span class="text-[0.625rem] 456:text-14 768:text-16 tracking-wide">${weekday}</span>
                <span class="font-antic-didone text-18 456:text-24 768:text-28 leading-none">${cell.date.getDate().toString().padStart(2, '0')}</span>
                <span class="text-14 leading-none">${label}</span>
            </button>
        `;
    }

    private getCellStateClass(cell: DayCell): string {
        if (cell.isStart || cell.isEnd) {
            return 'bg-purple-haze/65 text-white cursor-pointer';
        }
        if (cell.inRange) {
            return 'bg-purple-haze/35 text-purple-haze-dark cursor-pointer';
        }
        if (cell.isToday) {
            return 'bg-purple-haze text-white cursor-pointer';
        }
        if (!cell.selectable) {
            return 'text-purple-haze-dark/30 cursor-not-allowed';
        }
        if (cell.isWeekend && !cell.inCurrentMonth) {
            return 'bg-purple-haze-dark/5 text-purple-haze-dark/50 hover:bg-purple-haze-dark/10 cursor-pointer';
        }
        if (cell.isWeekend) {
            return 'bg-purple-haze-dark/10 text-purple-haze-dark hover:bg-purple-haze-dark/20 cursor-pointer';
        }
        if (!cell.inCurrentMonth) {
            return 'text-purple-haze-dark/50 hover:bg-purple-haze-light cursor-pointer';
        }
        return 'text-purple-haze-dark hover:bg-purple-haze-light cursor-pointer';
    }

    private getFooterHtml(): string {
        const { checkIn, checkOut } = bookingState.getDates();
        const canSubmit = checkIn !== null && checkOut !== null;
        return /*html*/ `
            <div class="flex justify-center mt-8 768:mt-10">
                <button
                    type="button"
                    data-action="submit"
                    ${canSubmit ? '' : 'disabled'}
                    class="bg-purple-haze py-2 px-8 rounded-md font-lato font-semibold text-white transition-opacity ${canSubmit ? 'opacity-85 hover:opacity-100 cursor-pointer' : 'opacity-40 cursor-not-allowed'}"
                >
                    weiter
                </button>
            </div>
        `;
    }

    private buildDays(): DayCell[] {
        const year = this.displayedYear;
        const month = this.displayedMonth;
        const { checkIn, checkOut } = bookingState.getDates();

        const firstOfMonth = new Date(year, month, 1);
        const leading = (firstOfMonth.getDay() + 6) % 7;
        const totalCells = 42;

        const cells: DayCell[] = [];
        for (let i = 0; i < totalCells; i++) {
            const date = new Date(year, month, 1 - leading + i);
            const inCurrentMonth = date.getMonth() === month;
            const isPast = date < this.today;

            cells.push({
                date,
                inCurrentMonth,
                isPast,
                isToday: isSameDay(date, this.today),
                isStart: checkIn !== null && isSameDay(date, checkIn),
                isEnd: checkOut !== null && isSameDay(date, checkOut),
                inRange: checkIn !== null && checkOut !== null && date > checkIn && date < checkOut,
                isWeekend: date.getDay() === 0 || date.getDay() === 6,
                selectable: !isPast,
            });
        }
        return cells;
    }

    private handleClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;

        const actionEl = target.closest<HTMLElement>('[data-action]');
        if (actionEl) {
            switch (actionEl.dataset.action) {
                case 'prev':
                    this.changeMonth(-1);
                    return;
                case 'next':
                    this.changeMonth(1);
                    return;
                case 'clear':
                    this.clearSelection();
                    return;
                case 'submit':
                    this.submit();
                    return;
                default:
                    return;
            }
        }

        const dayEl = target.closest<HTMLElement>('[data-date]');
        const iso = dayEl?.dataset.date;
        if (dayEl && !dayEl.hasAttribute('disabled') && iso) {
            this.selectDate(iso);
        }
    }

    private selectDate(iso: string): void {
        const date = parseISODate(iso);
        const { checkIn, checkOut } = bookingState.getDates();

        if (checkIn === null || checkOut !== null || date <= checkIn) {
            bookingState.setDates(date, null);
        } else {
            bookingState.setDates(checkIn, date);
        }
        this.renderCalendar();
    }

    private clearSelection(): void {
        bookingState.setDates(null, null);
        this.renderCalendar();
    }

    private changeMonth(delta: number): void {
        const target = new Date(this.displayedYear, this.displayedMonth + delta, 1);
        const firstOfCurrentMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
        if (target < firstOfCurrentMonth) return;

        this.displayedYear = target.getFullYear();
        this.displayedMonth = target.getMonth();
        this.renderCalendar();
    }

    private canGoPrev(): boolean {
        const firstOfDisplayed = new Date(this.displayedYear, this.displayedMonth, 1);
        const firstOfCurrentMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
        return firstOfDisplayed > firstOfCurrentMonth;
    }

    private submit(): void {
        const { checkIn, checkOut } = bookingState.getDates();
        if (checkIn === null || checkOut === null) return;

        const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
        const booking: Booking = {
            checkIn: toISODate(checkIn),
            checkOut: toISODate(checkOut),
            nights,
            adults: this.guests.adults,
            children: this.guests.children,
        };

        // TODO: Buchungsdaten später an das Backend senden (fetch / Supabase).
        console.log('Buchungsdaten', booking);
    }
}

function buildAdultOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_ADULTS }, (_unused: unknown, index: number): GuestOption => {
        const value = index + 1;
        return { value, label: value === 1 ? '1 Erwachsener' : `${value.toString()} Erwachsene` };
    });
}

function buildChildOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_CHILDREN + 1 }, (_unused: unknown, value: number): GuestOption => {
        if (value === 0) return { value, label: 'Keine Kinder' };
        return { value, label: value === 1 ? '1 Kind' : `${value.toString()} Kinder` };
    });
}

function stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISODate(date: Date): string {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseISODate(iso: string): Date {
    const [year, month, day] = iso.split('-').map((part: string): number => Number(part));
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
