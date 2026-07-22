import AbstractView from '../AbstractView';
import './booking.css';

type DayCell = {
    date: Date;
    inCurrentMonth: boolean;
    isPast: boolean;
    isToday: boolean;
    isStart: boolean;
    isEnd: boolean;
    inRange: boolean;
    selectable: boolean;
};

type Booking = {
    checkIn: string;
    checkOut: string;
    nights: number;
};

const WEEKDAYS: readonly string[] = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const MONTHS: readonly string[] = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const MS_PER_DAY = 86_400_000;

export class BookingView extends AbstractView {
    private readonly today: Date;
    private displayedYear: number;
    private displayedMonth: number;
    private checkIn: Date | null = null;
    private checkOut: Date | null = null;
    private calendarEl: HTMLElement | null = null;

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
                    <div id="booking-calendar"></div>
                </div>
            </section>
        `;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async afterRender(): Promise<void> {
        this.calendarEl = document.getElementById('booking-calendar');
        if (!this.calendarEl) return;
        this.calendarEl.addEventListener('click', (event: MouseEvent): void => {
            this.handleClick(event);
        });
        this.renderCalendar();
    }

    private renderCalendar(): void {
        if (!this.calendarEl) return;
        this.calendarEl.innerHTML = this.getHeaderHtml() + this.getGridHtml() + this.getFooterHtml();
    }

    private getHeaderHtml(): string {
        const monthName = MONTHS[this.displayedMonth] ?? '';
        const prevDisabled = !this.canGoPrev();

        return /*html*/ `
            <div class="flex items-center justify-center gap-6 768:gap-10 mb-6 768:mb-10">
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
                <span class="text-[0.5rem] 456:text-[0.625rem] 768:text-14 leading-none">${label}</span>
            </button>
        `;
    }

    private getCellStateClass(cell: DayCell): string {
        if (cell.isStart || cell.isEnd) {
            return 'bg-purple-haze text-white cursor-pointer';
        }
        if (cell.inRange) {
            return 'bg-purple-haze-light text-purple-haze-dark cursor-pointer';
        }
        if (cell.isToday) {
            return 'bg-purple-haze-dark text-eggshell cursor-pointer';
        }
        if (!cell.selectable) {
            return 'text-purple-haze-dark/30 cursor-not-allowed';
        }
        return 'text-purple-haze-dark hover:bg-purple-haze-light cursor-pointer';
    }

    private getFooterHtml(): string {
        const canSubmit = this.checkIn !== null && this.checkOut !== null;
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

        const firstOfMonth = new Date(year, month, 1);
        const leading = (firstOfMonth.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

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
                isStart: this.checkIn !== null && isSameDay(date, this.checkIn),
                isEnd: this.checkOut !== null && isSameDay(date, this.checkOut),
                inRange: this.checkIn !== null && this.checkOut !== null && date > this.checkIn && date < this.checkOut,
                selectable: inCurrentMonth && !isPast,
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
        if (this.checkIn === null || this.checkOut !== null || date <= this.checkIn) {
            this.checkIn = date;
            this.checkOut = null;
        } else {
            this.checkOut = date;
        }
        this.renderCalendar();
    }

    private clearSelection(): void {
        this.checkIn = null;
        this.checkOut = null;
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
        if (this.checkIn === null || this.checkOut === null) return;

        const nights = Math.round((this.checkOut.getTime() - this.checkIn.getTime()) / MS_PER_DAY);
        const booking: Booking = {
            checkIn: toISODate(this.checkIn),
            checkOut: toISODate(this.checkOut),
            nights,
        };

        // TODO: Buchungsdaten später an das Backend senden (fetch / Supabase).
        console.log('Buchungsdaten', booking);
    }
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
