import AbstractView from '../AbstractView';
import { bookingState } from '../../shared/state/bookingState';
import { BookingFailedError, createBooking, type BookingRejection, type CreatedBooking } from '../../shared/services/booking.service';
import {
    buildNightAvailability,
    buildRoomCards,
    fetchAvailabilityCalendar,
    fetchHotel,
    fetchRoomTypes,
    fetchServices,
    searchAvailability,
} from '../../shared/services/catalog.service';
import { openModal } from '../../shared/ui/modal';
import { scrollToSection } from '../../shared/ui/scroll';
import { formatAdults, formatChildren, formatDate, formatGuests, formatNights, formatPrice, formatStayDate } from '../../shared/format';
import type { BookingDraft, BookingRequest, CustomerDetails, Guests, ServiceRow } from '../../shared/types/booking.types';
import logo from '../../assets/img/logo-small.svg';
import type { HotelRow, NightAvailability, RoomCard, RoomCardAvailability } from '../../shared/types/catalog.types';
import {
    clampQuantity,
    getLimitMessage,
    getMissingBeds,
    getRoomLimit,
    getRoomMax,
    getTotalRooms,
    normalizeQuantityInput,
    formatRoomsFreeLabel,
    formatMissingBedsNotice,
} from './roomQuantity';
import { buildBreakfastService, getBreakfastAmountCents, type BreakfastService } from './breakfast';
import { BREAKFAST, buildExtraServices, CHILD_BED, getServiceAmountCents, getServiceMax, type ExtraService } from './services';
import { COUNTRIES, DEFAULT_COUNTRY, formatAddressLines, getCountryLabel, getInvalidFields, isCountryCode, emptyToNull, type CountryCode, type InvalidField } from './address';
import { buildOrderLines, DEFAULT_CURRENCY, formatSelectionSummary, getOrderTotalCents, type OrderLine } from './summary';
import { formatBlockedNight, formatUnavailableReason, getRejectionHints, getRejectionMessage } from './messages';
import {
    addDays,
    buildDays,
    canGoNext,
    canGoPrev,
    countNights,
    isSameDay,
    isSelectableAsCheckOut,
    parseISODate,
    stripTime,
    toISODate,
    type CalendarRules,
    type DayCell,
} from './domain/calendar';
import { getCheckoutError } from './domain/validation';
import { buildBookingDraft } from './domain/draft';
import { ADULT_ICON, CHILD_ICON, ICON_AIR_CONDITIONING, ICON_BATH, ICON_BED, ICON_GYM, SERVICE_ICONS } from './templates/icons';
import * as calendarTemplate from './templates/calendar.template';
import * as roomsTemplate from './templates/rooms.template';
import * as checkoutTemplate from './templates/checkout.template';
import './booking.css';

/** Die Anfrage an `create_booking` plus die Nächte, die das Bestätigungs-Popup anzeigt. */
type Booking = BookingRequest & {
    nights: number;
};

type GuestField = keyof Guests;

type GuestOption = {
    value: number;
    label: string;
};

type RoomsState = 'loading' | 'ready' | 'error';

const WEEKDAYS: readonly string[] = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const MONTHS: readonly string[] = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const MAX_ADULTS = 6;
const MAX_CHILDREN = 4;

/**
 * Ausstattung je Zimmerkategorie.
 *
 * Für diese vier Merkmale gibt es kein Datenbankfeld – die Werte stammen aus dem
 * Figma-Design. Kategorien ohne Eintrag (z. B. `einzelzimmer-alpin`) bekommen keine
 * Ausstattungsliste, statt erfundene Merkmale anzuzeigen.
 */
const ROOM_AMENITIES: Readonly<Record<string, readonly roomsTemplate.RoomAmenity[]>> = {
    'double-suite': [
        { icon: ICON_BED, label: 'King-size Bett' },
        { icon: ICON_AIR_CONDITIONING, label: 'Klimaanlage & TV' },
        { icon: ICON_BATH, label: 'Badewanne, Föhn & eigenes WC' },
        { icon: ICON_GYM, label: 'Gym Zugang' },
    ],
    'double-premium': [
        { icon: ICON_BED, label: 'Queen-size Bett' },
        { icon: ICON_AIR_CONDITIONING, label: 'Klimaanlage & TV' },
        { icon: ICON_BATH, label: 'Dusche, Föhn & eigenes WC' },
        { icon: ICON_GYM, label: 'Gym Zugang' },
    ],
};

const CHECKOUT_LABEL = 'zahlungspflichtig buchen';
const CHECKOUT_BUSY_LABEL = 'Buchung wird gesendet …';
const HOTEL_LOAD_ERROR = 'Hoteladresse und Check-in-Zeiten konnten gerade nicht geladen werden. Ihre Buchung ist davon nicht betroffen.';
/** Die Buchung kann angelegt sein – deshalb ausdrücklich kein „bitte erneut versuchen". */
const BOOKING_OUTCOME_UNKNOWN = 'Wir konnten nicht feststellen, ob Ihre Buchung angelegt wurde. Bitte buchen Sie nicht erneut, sondern kontaktieren Sie uns.';

/** Welches Formularfeld zu welchem Eintrag aus `getInvalidFields()` gehört. */
const FIELD_NAMES: Record<InvalidField, string> = {
    'customer.firstName': 'first-name',
    'customer.lastName': 'last-name',
    'customer.email': 'email',
    'residence.street': 'street',
    'residence.houseNumber': 'house-number',
    'residence.postalCode': 'postal-code',
    'residence.city': 'city',
    'residence.countryCode': 'country',
    'billing.street': 'billing-street',
    'billing.houseNumber': 'billing-house-number',
    'billing.postalCode': 'billing-postal-code',
    'billing.city': 'billing-city',
    'billing.countryCode': 'billing-country',
};

export class BookingView extends AbstractView {
    private readonly today: Date;
    private displayedYear: number;
    private displayedMonth: number;
    private calendarEl: HTMLElement | null = null;
    private roomsEl: HTMLElement | null = null;
    private customerFormEl: HTMLFormElement | null = null;
    // `null` heißt: für dieses Hotel ist kein Frühstück hinterlegt. Dann wird auch keins
    // angeboten – `create_booking` würde eine Buchung mit Frühstück ablehnen (E25), und
    // eine Checkbox, die in eine Ablehnung führt, ist eine Falle.
    private breakfastService: BreakfastService | null = null;
    private roomsState: RoomsState = 'loading';
    private roomsError: string | null = null;
    // Hinweis über der Liste, wenn eine neue Suche gewählte Mengen angepasst hat (V16.6).
    private quantityNotice: string | null = null;
    // Zählt die Suchanfragen mit. Trifft eine ältere Antwort nach einer neueren ein,
    // wird sie verworfen, statt das Ergebnis der neueren zu überschreiben.
    private roomsRequestId = 0;
    // Adresse und Check-in-/Check-out-Zeiten für „Ihre Buchung". `null`, solange nicht
    // geladen – dann fehlen nur diese Angaben, die Buchung selbst hängt nicht daran.
    private hotel: HotelRow | null = null;
    /** Für den Gast formuliert; die technischen Details landen in der Konsole. */
    private hotelError: string | null = null;
    // Erst mit dem Hotel steht der Buchungshorizont fest (E30) – der Kalender wartet darauf.
    private hotelLoaded: Promise<void> = Promise.resolve();
    // Verfügbarkeit je Nacht über den ganzen Horizont, je Belegung einmal geladen (V14,
    // Schlüssel `${adults}-${children}`). `null`: (noch) keine Daten – dann sperrt nur das Datum.
    private nights: NightAvailability | null = null;
    private readonly calendarCache = new Map<string, NightAvailability>();
    // Wie `roomsRequestId`: Eine Antwort für eine überholte Belegung wird verworfen.
    private calendarRequestId = 0;
    // Die letzte Ablehnung aus `create_booking`, am Ort des Problems angezeigt (Phase 9b,
    // Punkt 8): an der Zimmerkarte und am Kalendertag. Weg, sobald Zeitraum oder Belegung
    // sich ändern – dann gilt die Aussage nicht mehr.
    private rejection: { roomTypeId: string | null; night: Date | null; roomHint: string; calendarHint: string | null } | null = null;
    private summaryEl: HTMLElement | null = null;
    private unsubscribeSummary: (() => void) | null = null;
    // Setzt `destroy()`. Laufende Anfragen kommen danach noch zurück und dürfen dann
    // nichts mehr anfassen.
    private destroyed = false;
    // Solange `create_booking` läuft, zählt kein weiterer Klick: ein Doppelklick wären
    // sonst zwei verbindliche Buchungen.
    private submitting = false;

    constructor() {
        super();
        this.setTitle('Buchung');
        this.today = stripTime(new Date());
        this.displayedYear = this.today.getFullYear();
        this.displayedMonth = this.today.getMonth();
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return calendarTemplate.getBookingPageHtml(this.getGuestsHtml(), this.getCheckoutHtml());
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async afterRender(): Promise<void> {
        document.getElementById('booking-guests')?.addEventListener('change', (event: Event): void => {
            this.handleGuestChange(event);
        });

        this.roomsEl = document.getElementById('booking-rooms');
        this.roomsEl?.addEventListener('click', (event: MouseEvent): void => {
            this.handleRoomsClick(event);
        });
        this.roomsEl?.addEventListener('change', (event: Event): void => {
            this.handleRoomsChange(event);
        });
        void this.loadRooms();

        this.bindCustomerForm();

        this.summaryEl = document.getElementById('booking-summary');
        this.summaryEl?.addEventListener('click', (event: MouseEvent): void => {
            this.handleSummaryClick(event);
        });
        this.unsubscribeSummary = bookingState.subscribe((): void => {
            this.renderSummary();
            this.renderCustomerSummary();
            this.renderSelectionBar();
        });
        this.renderSummary();
        this.renderCustomerSummary();
        this.hotelLoaded = this.loadHotel();

        this.calendarEl = document.getElementById('booking-calendar');
        if (!this.calendarEl) return;
        this.calendarEl.addEventListener('click', (event: MouseEvent): void => {
            this.handleCalendarClick(event);
        });
        this.renderCalendar();
        void this.loadCalendar();
    }

    private getGuestsHtml(): string {
        return calendarTemplate.getGuestsHtml([
            this.getGuestFieldHtml('adults', 'Erwachsene', 'Anzahl der Erwachsenen', buildAdultOptions(), ADULT_ICON),
            this.getGuestFieldHtml('children', 'Keine Kinder', 'Anzahl der Kinder', buildChildOptions(), CHILD_ICON),
        ]);
    }

    private getGuestFieldHtml(field: GuestField, placeholder: string, ariaLabel: string, options: readonly GuestOption[], icon: string): string {
        const selected = bookingState.getGuests()[field];

        return calendarTemplate.getGuestFieldHtml({
            field,
            ariaLabel,
            placeholder,
            placeholderSelected: selected === null,
            options: options.map(
                (option: GuestOption): calendarTemplate.SelectOption => ({ value: option.value.toString(), label: option.label, selected: option.value === selected }),
            ),
            iconHtml: icon,
            // Nur die Erwachsenenzahl ist Pflicht (Kinder: leer = keine Kinder), also hängt
            // auch nur an diesem Feld eine Hinweiszeile.
            withNotice: field === 'adults',
        });
    }

    /**
     * Sagt am Feld, was fehlt — aber erst, wenn der Zeitraum steht.
     *
     * Vorher wäre der Hinweis eine Begrüßung mit einem Fehler: wer die Seite öffnet, hat
     * noch nichts falsch gemacht.
     */
    private renderGuestsNotice(): void {
        const noticeEl = document.querySelector<HTMLElement>('[data-guests-notice]');
        if (!noticeEl) return;

        const { checkIn, checkOut } = bookingState.getDates();
        const isMissing = checkIn !== null && checkOut !== null && bookingState.getGuests().adults === null;
        noticeEl.textContent = isMissing ? 'Bitte wählen Sie die Anzahl der Erwachsenen.' : '';
    }

    private handleGuestChange(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;

        const field = target.dataset.guests;
        if (field !== 'adults' && field !== 'children') return;

        this.rejection = null;
        // Gleicht die Kinderbetten gleich mit ab (siehe `setGuests`).
        bookingState.setGuests({ ...bookingState.getGuests(), [field]: target.value === '' ? null : Number(target.value) });
        this.renderGuestsNotice();
        // Der weiter-Knopf hängt jetzt mit an der Belegung – und die freien Nächte auch.
        this.renderCalendar();
        void this.loadCalendar();
        void this.loadRooms();
    }

    private renderRooms(): void {
        if (!this.roomsEl) return;
        this.roomsEl.innerHTML = this.getRoomsBodyHtml();
        // Neue Preise oder eine neue Belegung ändern die Zusammenfassung, ohne dass sich
        // in `bookingState` etwas rührt.
        this.renderSummary();
    }

    /** Nur die Leiste neu – Mengen ändern sich ohne `renderRooms()` (siehe `updateQuantityUi`). */
    private renderSelectionBar(): void {
        const barEl = this.roomsEl?.querySelector<HTMLElement>('[data-selection-bar]');
        if (barEl) barEl.innerHTML = this.getSelectionBarHtml();
    }

    /** Erst mit einem Zimmer gibt es etwas zusammenzufassen. */
    private getSelectionBarHtml(): string {
        const totalRooms = getTotalRooms(bookingState.getRoomQuantities());
        if (totalRooms === 0) return '';

        const { checkIn, checkOut } = bookingState.getDates();
        const lines = this.getOrderLines();
        const summary = formatSelectionSummary(totalRooms, countNights(checkIn, checkOut), getOrderTotalCents(lines), lines[0]?.currency ?? DEFAULT_CURRENCY);
        return roomsTemplate.getSelectionBarHtml(summary);
    }

    private getRoomsBodyHtml(): string {
        switch (this.roomsState) {
            case 'loading':
                return roomsTemplate.getRoomsNoticeHtml('Zimmer werden geladen …');
            case 'error':
                return roomsTemplate.getRoomsNoticeHtml(`Die Zimmer konnten nicht geladen werden: ${this.roomsError ?? 'Unbekannter Fehler'}`);
            case 'ready':
                if (bookingState.getRooms().length === 0) {
                    return roomsTemplate.getRoomsNoticeHtml('Zurzeit sind keine Zimmerkategorien hinterlegt.');
                }
                return roomsTemplate.getRoomsListHtml({
                    quantityNotice: this.quantityNotice,
                    cardsHtml: bookingState.getRooms().map((room: RoomCard): string => this.getRoomCardHtml(room)),
                    missingBedsNotice: this.getMissingBedsNotice(),
                    servicesHtml: this.getServicesSectionHtml(),
                    selectionBarHtml: this.getSelectionBarHtml(),
                });
        }
    }

    private getRoomCardHtml(room: RoomCard): string {
        return roomsTemplate.getRoomCardHtml({
            roomTypeId: room.roomTypeId,
            bookable: room.availability === null || room.availability.isBookable,
            selected: bookingState.getRoomQuantity(room.roomTypeId) > 0,
            imageHtml: roomsTemplate.getRoomImageHtml({ name: room.name, imageUrl: room.imageUrl, imageAlt: room.imageAlt, priceLabel: room.availability?.priceLabel ?? null }),
            amenities: ROOM_AMENITIES[room.slug] ?? [],
            description: room.description,
            quantityHtml: this.getRoomQuantityHtml(room),
            availabilityHtml: getAvailabilityHtml(room.availability),
            rejectionHint: this.rejection !== null && this.rejection.roomTypeId === room.roomTypeId ? this.rejection.roomHint : null,
        });
    }

    /** Mengenwähler der Karte – oder an seiner Stelle, warum es (noch) keinen gibt. */
    private getRoomQuantityHtml(room: RoomCard): string {
        const availability = room.availability;

        // Ohne Zeitraum und Belegung kennt niemand `rooms_free`. Ein Feld ohne geprüfte
        // Obergrenze würde eine Menge versprechen, die es nicht geben muss.
        if (availability === null) {
            const hint = this.getMissingSelectionHint();
            return hint === '' ? '' : roomsTemplate.getRoomHintHtml(hint);
        }

        // Nicht buchbare Kategorien zeigen ihren Grund (Zeile darunter), keinen Wähler.
        if (!availability.isBookable) return '';

        const quantity = bookingState.getRoomQuantity(room.roomTypeId);
        const otherRooms = getTotalRooms(bookingState.getRoomQuantities()) - quantity;

        return roomsTemplate.getRoomQuantityHtml({
            inputId: `booking-rooms-${room.slug}`,
            roomTypeId: room.roomTypeId,
            quantity,
            max: getRoomMax(availability.roomsFree, otherRooms, getRoomLimit(bookingState.getGuests().adults)),
            decreaseHtml: this.getQuantityStepHtml(room, -1, quantity === 0),
            increaseHtml: this.getQuantityStepHtml(room, 1, quantity >= (availability.roomsFree ?? 0)),
        });
    }

    /**
     * Sektion „Zusatzleistungen" unter der Zimmerliste (E47–E49).
     *
     * Das Frühstück steht als erste Zeile darin: Seit die Belegung eine Gesamtzahl ist,
     * gilt es wie alle anderen Leistungen für den ganzen Vorgang (E48).
     */
    private getServicesSectionHtml(): string {
        if (this.breakfastService === null && bookingState.getExtraServices().length === 0) return '';

        return roomsTemplate.getServicesSectionHtml({
            hasRooms: getTotalRooms(bookingState.getRoomQuantities()) > 0,
            rowsHtml: [this.getBreakfastRowHtml(), ...bookingState.getExtraServices().map((service: ExtraService): string => this.getServiceRowHtml(service))],
        });
    }

    private getBreakfastRowHtml(): string {
        const service = this.breakfastService;
        if (service === null) return '';

        const checked = bookingState.getBreakfast();
        return roomsTemplate.getServiceRowHtml({
            code: BREAKFAST,
            inputId: 'booking-breakfast',
            name: `${service.name} für alle Gäste`,
            description: service.description,
            label: this.getBreakfastLabel(),
            iconHtml: SERVICE_ICONS[BREAKFAST] ?? '',
            controlHtml: roomsTemplate.getCheckboxHtml({
                inputId: 'booking-breakfast',
                dataAttributes: { 'data-breakfast': '' },
                checked,
                disabled: getTotalRooms(bookingState.getRoomQuantities()) === 0,
            }),
            selected: checked,
        });
    }

    private getServiceRowHtml(service: ExtraService): string {
        const quantity = bookingState.getServiceQuantity(service.code);
        const max = getServiceMax(service, this.getServiceContext());
        const inputId = `booking-service-${service.code.toLowerCase()}`;

        const controlHtml =
            service.chargeBasis === 'per_unit'
                ? roomsTemplate.getServiceQuantityHtml({
                      inputId,
                      code: service.code,
                      quantity,
                      decreaseHtml: this.getServiceStepHtml(service, -1, quantity === 0),
                      increaseHtml: this.getServiceStepHtml(service, 1, quantity >= max),
                  })
                : roomsTemplate.getCheckboxHtml({ inputId, dataAttributes: { 'data-service-code': service.code }, checked: quantity > 0, disabled: max === 0 });

        return roomsTemplate.getServiceRowHtml({
            code: service.code,
            inputId,
            name: service.name,
            description: service.description,
            label: this.getServiceLabel(service),
            iconHtml: SERVICE_ICONS[service.code] ?? '',
            controlHtml,
            selected: quantity > 0,
        });
    }

    private getServiceStepHtml(service: ExtraService, step: roomsTemplate.Step, disabled: boolean): string {
        const ariaLabel = `${service.name}: ${step > 0 ? 'eines mehr' : 'eines weniger'}`;
        return roomsTemplate.getStepButtonHtml(step, { 'data-service-step': step.toString(), 'data-service-code': service.code }, ariaLabel, disabled);
    }

    private getServiceContext(): { rooms: number; children: number } {
        return { rooms: getTotalRooms(bookingState.getRoomQuantities()), children: bookingState.getGuests().children ?? 0 };
    }

    /** Alle Kategorien haben denselben Zeitraum und damit dieselbe Zahl an Nächten. */
    private getNights(): number | undefined {
        return bookingState.getRooms().find((room: RoomCard): boolean => room.availability !== null)?.availability?.nights;
    }

    /**
     * Der Text unter dem Frühstück.
     *
     * Ohne Häkchen der Einzelpreis, mit Häkchen der Betrag, der tatsächlich dazukommt.
     * Ein Aufschlag, den der Gast erst auf der Bestätigung als Zahl sieht, ist kein
     * Angebot, sondern eine Überraschung.
     */
    private getBreakfastLabel(): string {
        const service = this.breakfastService;
        if (service === null) return '';

        const perAdult = formatPrice(service.unitAmountCents, service.currency);
        const perChild = formatPrice(service.childUnitAmountCents, service.currency);
        const priceText = `${perAdult} pro Erwachsenem, ${perChild} pro Kind und Nacht`;

        const nights = this.getNights();
        if (nights === undefined || !bookingState.getBreakfast()) return priceText;

        const { adults, children } = bookingState.getGuests();
        const occupancy = { adults: adults ?? 0, children: children ?? 0 };
        const amount = getBreakfastAmountCents(service, occupancy, nights);
        return `+ ${formatPrice(amount, service.currency)} · ${priceText}`;
    }

    /** Dasselbe für eine Leistung je Vorgang: Einheit vor der Wahl, Aufschlag danach. */
    private getServiceLabel(service: ExtraService): string {
        const unitPrice = service.unitAmountCents === 0 ? 'kostenlos' : formatPrice(service.unitAmountCents, service.currency);
        const quantity = bookingState.getServiceQuantity(service.code);

        if (service.code === CHILD_BED) {
            if ((bookingState.getGuests().children ?? 0) === 0) return 'Nur mit Kind buchbar';
            const max = getServiceMax(service, this.getServiceContext());
            const limitText = max > 1 ? `bis zu ${max.toString()}, 1 je Zimmer` : '1 je Zimmer';
            return `${unitPrice} · ${limitText}`;
        }

        const unitPriceText = service.chargeBasis === 'per_night' ? `${unitPrice} pro Nacht` : service.unitAmountCents === 0 ? unitPrice : `${unitPrice} einmalig`;
        const nights = this.getNights();
        if (quantity === 0 || nights === undefined || service.unitAmountCents === 0) return unitPriceText;

        const amount = formatPrice(getServiceAmountCents(service, quantity, nights), service.currency);
        return service.chargeBasis === 'per_night' ? `+ ${amount} für ${formatNights(nights)} · ${unitPriceText}` : `+ ${amount}`;
    }

    /**
     * Hinweis unter der Liste, solange die gewählten Zimmer nicht für alle Gäste reichen (E48).
     *
     * Kein Fehler, sondern der nächste Schritt: Wer zwei Zimmer braucht, wählt erst eines
     * und dann das zweite – dazwischen soll dort stehen, was noch fehlt.
     */
    private getMissingBedsNotice(): string {
        const { adults, children } = bookingState.getGuests();
        const quantities = bookingState.getRoomQuantities();
        if (adults === null || getTotalRooms(quantities) === 0) return '';

        return formatMissingBedsNotice(getMissingBeds(quantities, bookingState.getRooms(), adults + (children ?? 0)));
    }

    /** Der Wähler hat zwei Vorbedingungen: einen Zeitraum und eine Belegung (V16.7 — kein stiller Suchdefault). */
    private getMissingSelectionHint(): string {
        const { checkIn, checkOut } = bookingState.getDates();
        const needsDates = checkIn === null || checkOut === null;
        const needsGuests = bookingState.getGuests().adults === null;

        if (needsDates && needsGuests) return 'Bitte zuerst Zeitraum und Anzahl der Gäste wählen';
        if (needsDates) return 'Bitte zuerst Zeitraum wählen';
        if (needsGuests) return 'Bitte zuerst die Anzahl der Gäste wählen';
        return '';
    }

    /**
     * Ein Schritt-Knopf.
     *
     * `+` wird nur von `rooms_free` gesperrt, nicht von der Gesamtgrenze: die ist unsere
     * Regel, und ein ausgegrauter Knopf erklärt sie nicht. Der Klick löst stattdessen den
     * Hinweis aus (Q10).
     */
    private getQuantityStepHtml(room: RoomCard, step: roomsTemplate.Step, disabled: boolean): string {
        const ariaLabel = `${step > 0 ? 'Ein Zimmer mehr' : 'Ein Zimmer weniger'} – ${room.name}`;
        return roomsTemplate.getStepButtonHtml(step, { 'data-room-step': step.toString(), 'data-room-type': room.roomTypeId }, ariaLabel, disabled);
    }

    private handleRoomsClick(event: MouseEvent): void {
        // `Element` statt `HTMLElement`: Ein Klick auf ein Icon trifft ein SVG-Element.
        const target = event.target;
        if (!(target instanceof Element)) return;

        if (target.closest('[data-action="to-checkout"]')) {
            scrollToSection('booking-details');
            return;
        }

        const serviceStepEl = target.closest<HTMLElement>('[data-service-step]');
        if (serviceStepEl) {
            const code = serviceStepEl.dataset.serviceCode;
            const serviceStep = Number(serviceStepEl.dataset.serviceStep);
            if (code === undefined || !Number.isFinite(serviceStep)) return;
            this.setServiceQuantity(code, bookingState.getServiceQuantity(code) + serviceStep);
            return;
        }

        const stepEl = target.closest<HTMLElement>('[data-room-step]');
        if (!stepEl) return;

        const roomTypeId = stepEl.dataset.roomType;
        const step = Number(stepEl.dataset.roomStep);
        if (roomTypeId === undefined || !Number.isFinite(step)) return;

        this.setRoomQuantity(roomTypeId, bookingState.getRoomQuantity(roomTypeId) + step);
    }

    /** Geklemmt wird auf `change`, nicht bei jedem Tastendruck: sonst ist „1" auf dem Weg zu „12" nie tippbar. */
    private handleRoomsChange(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        if (target.dataset.breakfast !== undefined) {
            bookingState.setBreakfast(target.checked);
            this.updateQuantityUi(null);
            return;
        }

        const serviceCode = target.dataset.serviceCode;
        if (serviceCode !== undefined) {
            this.setServiceQuantity(serviceCode, target.checked ? 1 : 0);
            return;
        }

        const roomTypeId = target.dataset.roomQuantity;
        if (roomTypeId === undefined) return;

        this.setRoomQuantity(roomTypeId, normalizeQuantityInput(target.value));
    }

    private setRoomQuantity(roomTypeId: string, desired: number): void {
        const room = bookingState.getRooms().find((candidate: RoomCard): boolean => candidate.roomTypeId === roomTypeId);
        const availability = room?.availability;
        if (!availability?.isBookable) return;

        const otherRooms = getTotalRooms(bookingState.getRoomQuantities()) - bookingState.getRoomQuantity(roomTypeId);
        const roomLimit = getRoomLimit(bookingState.getGuests().adults);
        const clamped = clampQuantity(desired, availability.roomsFree, otherRooms, roomLimit);
        bookingState.selectRoomQuantity(roomTypeId, clamped.value);

        // Der Gast soll sofort erfahren, warum es nicht weitergeht — nicht erst beim Absenden.
        const message = desired > clamped.value ? getLimitMessage(clamped.limitedBy, availability.roomsFree, roomLimit) : null;
        this.updateQuantityUi(message === null ? null : { roomTypeId, message });
    }

    private setServiceQuantity(code: string, desired: number): void {
        const service = bookingState.getExtraServices().find((candidate: ExtraService): boolean => candidate.code === code);
        if (service === undefined) return;

        const value = Math.max(0, Math.min(desired, getServiceMax(service, this.getServiceContext())));
        bookingState.setServiceQuantity(code, value);
        this.updateQuantityUi(null);
    }

    /**
     * Schreibt Mengen, Maxima, Knopf-Zustände und Hinweise direkt an die vorhandenen
     * Knoten — ohne `renderRooms()`, weil ein Neuaufbau der Liste den Fokus aus dem Feld
     * nimmt, in dem gerade getippt wird.
     */
    private updateQuantityUi(notice: { roomTypeId: string; message: string } | null): void {
        const roomsEl = this.roomsEl;
        if (!roomsEl) return;

        const quantities = bookingState.getRoomQuantities();
        const totalRooms = getTotalRooms(quantities);
        const roomLimit = getRoomLimit(bookingState.getGuests().adults);

        bookingState.getRooms().forEach((room: RoomCard): void => {
            const quantity = quantities[room.roomTypeId] ?? 0;
            const roomsFree = room.availability?.roomsFree ?? 0;

            const card = roomsEl.querySelector<HTMLElement>(`[data-room-card="${room.roomTypeId}"]`);
            card?.classList.toggle('ring-2', quantity > 0);
            card?.classList.toggle('ring-purple-haze', quantity > 0);

            const input = roomsEl.querySelector<HTMLInputElement>(`[data-room-quantity="${room.roomTypeId}"]`);
            if (input) {
                input.value = quantity.toString();
                input.max = getRoomMax(roomsFree, totalRooms - quantity, roomLimit).toString();
            }

            const minus = roomsEl.querySelector<HTMLButtonElement>(`[data-room-step="-1"][data-room-type="${room.roomTypeId}"]`);
            if (minus) minus.disabled = quantity === 0;

            const plus = roomsEl.querySelector<HTMLButtonElement>(`[data-room-step="1"][data-room-type="${room.roomTypeId}"]`);
            if (plus) plus.disabled = quantity >= roomsFree;

            const noticeEl = roomsEl.querySelector<HTMLElement>(`[data-room-quantity-notice="${room.roomTypeId}"]`);
            if (noticeEl) noticeEl.textContent = notice !== null && notice.roomTypeId === room.roomTypeId ? notice.message : '';
        });

        const capacityEl = roomsEl.querySelector<HTMLElement>('[data-capacity-notice]');
        if (capacityEl) {
            const text = this.getMissingBedsNotice();
            capacityEl.textContent = text;
            capacityEl.classList.toggle('hidden', text === '');
        }

        this.updateServicesUi(roomsEl, totalRooms);
    }

    /**
     * Zieht die Sektion „Zusatzleistungen" aus dem Zustand nach, nicht nur vom Klick: Sind
     * alle Zimmer wieder 0, räumt `bookingState` die Auswahl weg, und dann muss sie auch
     * im DOM verschwinden.
     */
    private updateServicesUi(roomsEl: HTMLElement, totalRooms: number): void {
        roomsEl.querySelector<HTMLElement>('[data-services-hint]')?.classList.toggle('hidden', totalRooms > 0);

        const updateServiceRow = (code: string, selected: boolean, label: string): void => {
            const row = roomsEl.querySelector<HTMLElement>(`[data-service-row="${code}"]`);
            row?.classList.toggle('ring-2', selected);
            row?.classList.toggle('ring-purple-haze', selected);
            const amountEl = roomsEl.querySelector<HTMLElement>(`[data-service-amount="${code}"]`);
            if (amountEl) amountEl.textContent = label;
        };

        const breakfastEl = roomsEl.querySelector<HTMLInputElement>('[data-breakfast]');
        if (breakfastEl) {
            breakfastEl.checked = bookingState.getBreakfast();
            breakfastEl.disabled = totalRooms === 0;
        }
        updateServiceRow(BREAKFAST, bookingState.getBreakfast(), this.getBreakfastLabel());

        const context = this.getServiceContext();
        bookingState.getExtraServices().forEach((service: ExtraService): void => {
            const quantity = bookingState.getServiceQuantity(service.code);
            const max = getServiceMax(service, context);

            const checkbox = roomsEl.querySelector<HTMLInputElement>(`input[data-service-code="${service.code}"]`);
            if (checkbox) {
                checkbox.checked = quantity > 0;
                checkbox.disabled = max === 0;
            }

            const output = roomsEl.querySelector<HTMLOutputElement>(`[data-service-quantity="${service.code}"]`);
            if (output) output.value = quantity.toString();
            const minus = roomsEl.querySelector<HTMLButtonElement>(`[data-service-step="-1"][data-service-code="${service.code}"]`);
            if (minus) minus.disabled = quantity === 0;
            const plus = roomsEl.querySelector<HTMLButtonElement>(`[data-service-step="1"][data-service-code="${service.code}"]`);
            if (plus) plus.disabled = quantity >= max;

            updateServiceRow(service.code, quantity > 0, this.getServiceLabel(service));
        });
    }

    /**
     * Formular und Zusammenfassung. Die Zusammenfassung folgt `bookingState`, der
     * Gästeauswahl, den Preisen aus `search_availability` und der Eingabe links (Phase 9b,
     * Punkte 4–5).
     */
    private getCheckoutHtml(): string {
        const countryOptions = COUNTRIES.map(
            (country: (typeof COUNTRIES)[number]): calendarTemplate.SelectOption => ({ value: country.code, label: country.label, selected: country.code === DEFAULT_COUNTRY }),
        );
        return checkoutTemplate.getCheckoutHtml(checkoutTemplate.getCustomerFormHtml(countryOptions), checkoutTemplate.getBookingSummaryHtml(CHECKOUT_LABEL));
    }

    /**
     * Baut den veränderlichen Teil von „Ihre Buchung" neu auf.
     *
     * Ein kompletter Neuaufbau ist hier unbedenklich – anders als in der Zimmerliste gibt
     * es in der Zusammenfassung kein Feld, in dem gerade getippt wird.
     */
    private renderSummary(): void {
        const summaryEl = this.summaryEl;
        const orderEl = document.getElementById('booking-summary-order');
        if (!summaryEl || !orderEl) return;

        const lines = this.getOrderLines();
        orderEl.innerHTML = checkoutTemplate.getSummaryOrderHtml({
            hotelHtml: this.getHotelAddressHtml(),
            roomsHtml: this.getSummaryRoomsHtml(),
            stayHtml: this.getStayHtml(),
            rowsHtml: lines.map((line: OrderLine): string => this.getOrderRowHtml(line)),
        });

        const totalEl = summaryEl.querySelector<HTMLElement>('[data-summary-total]');
        if (totalEl) {
            const total = getOrderTotalCents(lines);
            totalEl.textContent = total === null ? '–' : formatPrice(total, lines[0]?.currency ?? DEFAULT_CURRENCY);
        }
    }

    private getOrderLines(): OrderLine[] {
        const { checkIn, checkOut } = bookingState.getDates();
        const { adults, children } = bookingState.getGuests();
        return buildOrderLines({
            rooms: bookingState.getRooms(),
            quantities: bookingState.getRoomQuantities(),
            nights: countNights(checkIn, checkOut),
            occupancy: { adults: adults ?? 0, children: children ?? 0 },
            breakfast: this.breakfastService,
            withBreakfast: bookingState.getBreakfast(),
            services: bookingState.getExtraServices(),
            serviceQuantities: bookingState.getServices(),
        });
    }

    /** Hoteladresse aus `hotels` statt aus dem Entwurf – dort stand eine erfundene. */
    private getHotelAddressHtml(): string {
        if (this.hotelError !== null) return checkoutTemplate.getHotelErrorHtml(this.hotelError);

        const hotel = this.hotel;
        if (hotel === null) return '';

        const country = hotel.country_code === null ? '' : getCountryLabel(hotel.country_code);
        const lines = [hotel.name, hotel.address_line1 ?? '', `${hotel.postal_code ?? ''} ${hotel.city ?? ''}`.trim(), country].filter((line: string): boolean => line !== '');
        return checkoutTemplate.getHotelAddressHtml(lines);
    }

    /** Bild, Name und Ausstattung je gewählter Kategorie – der Block aus dem Entwurf, einmal je Kategorie. */
    private getSummaryRoomsHtml(): string {
        const selected = bookingState.getRooms().filter((room: RoomCard): boolean => bookingState.getRoomQuantity(room.roomTypeId) > 0);
        if (selected.length === 0) return checkoutTemplate.getSummaryNoRoomsHtml();

        return checkoutTemplate.getSummaryRoomsHtml(
            selected.map(
                (room: RoomCard): checkoutTemplate.SummaryRoomView => ({
                    name: room.name,
                    imageUrl: room.imageUrl,
                    amenities: (ROOM_AMENITIES[room.slug] ?? []).map((amenity: roomsTemplate.RoomAmenity): string => amenity.label).join(' · '),
                }),
            ),
        );
    }

    /** Check-in/Check-out mit den Uhrzeiten aus `hotels`, darunter Belegung und Nächte. */
    private getStayHtml(): string {
        const { checkIn, checkOut } = bookingState.getDates();
        const nights = countNights(checkIn, checkOut);

        const { adults, children } = bookingState.getGuests();
        const guests = adults === null ? 'Anzahl der Gäste noch offen' : formatGuests(adults, children ?? 0);

        return checkoutTemplate.getStayHtml({
            checkIn: formatStayDate(checkIn, 'ab', this.hotel?.check_in_time ?? null),
            checkOut: formatStayDate(checkOut, 'bis', this.hotel?.check_out_time ?? null),
            stay: nights === null ? guests : `${guests} · ${formatNights(nights)}`,
        });
    }

    /** Eine Bestellzeile. Das Kreuz aus dem Entwurf entfernt sie: Zimmer auf 0, Leistung abgewählt. */
    private getOrderRowHtml(line: OrderLine): string {
        return checkoutTemplate.getOrderRowHtml({
            kind: line.kind,
            id: line.id,
            name: line.name,
            detail: this.getOrderLineDetail(line),
            price: line.amountCents === null ? '–' : line.amountCents === 0 ? 'kostenlos' : formatPrice(line.amountCents, line.currency),
        });
    }

    private getOrderLineDetail(line: OrderLine): string {
        const { checkIn, checkOut } = bookingState.getDates();
        const nights = countNights(checkIn, checkOut);
        const withNights = (text: string): string => (nights === null ? text : `${text} · ${formatNights(nights)}`);

        switch (line.kind) {
            case 'room':
                return withNights(`${line.quantity.toString()} Zimmer`);
            case 'breakfast':
                return withNights(line.quantity === 1 ? 'für 1 Gast' : `für ${line.quantity.toString()} Gäste`);
            case 'service': {
                const service = bookingState.getExtraServices().find((candidate: ExtraService): boolean => candidate.code === line.id);
                switch (service?.chargeBasis) {
                    case 'per_night':
                        return nights === null ? 'pro Nacht' : formatNights(nights);
                    case 'per_unit':
                        return `${line.quantity.toString()} Stück`;
                    case 'per_stay':
                        return 'einmalig';
                    case undefined:
                        return '';
                }
            }
        }
    }

    private handleSummaryClick(event: MouseEvent): void {
        // Der Klick kann das SVG-Icon im Knopf treffen – das ist ein `Element`, kein `HTMLElement`.
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest<HTMLElement>('[data-summary-remove]');
        const id = button?.dataset.summaryId;
        if (!button || id === undefined) return;

        switch (button.dataset.summaryRemove) {
            case 'room':
                // Direkt statt über `setRoomQuantity()`: Entfernen muss auch gehen, wenn die
                // Kategorie gerade keine Verfügbarkeit hat (Zeitraum zurückgesetzt).
                bookingState.selectRoomQuantity(id, 0);
                this.updateQuantityUi(null);
                break;
            case 'breakfast':
                bookingState.setBreakfast(false);
                this.updateQuantityUi(null);
                break;
            case 'service':
                this.setServiceQuantity(id, 0);
                break;
            default:
                return;
        }

        // Der geklickte Knopf ist mit seiner Zeile verschwunden – der Fokus soll nicht ins
        // Leere fallen.
        document.getElementById('booking-summary-title')?.focus();
    }

    /**
     * Meldet sich ab und verwirft den Entwurf: Wer die Buchungsseite verlässt, fängt beim
     * nächsten Besuch von vorn an (V10, kein `sessionStorage`).
     */
    destroy(): void {
        this.destroyed = true;
        this.unsubscribeSummary?.();
        this.unsubscribeSummary = null;
        bookingState.reset();
    }

    /**
     * Der Router baut bei jeder Navigation eine neue View; eine alte Instanz lebt weiter,
     * bis ihre Anfragen zurück sind – dann darf sie nichts mehr rendern oder speichern.
     */
    private isDisplayed(): boolean {
        return !this.destroyed;
    }

    /**
     * Antwort verwerfen, wenn eine neuere Suche läuft – oder die View nicht mehr angezeigt
     * wird: `roomsRequestId` gilt nur je Instanz, und eine verspätete Antwort der alten
     * würde sonst mit veralteten Zimmern und Gästen in den globalen `bookingState` schreiben.
     */
    private isStale(requestId: number): boolean {
        return requestId !== this.roomsRequestId || !this.isDisplayed();
    }

    /** Die eine Zeile aus `hotels` (E14). */
    private async loadHotel(): Promise<void> {
        let hotel: HotelRow | null = null;
        let failure: unknown = null;
        try {
            hotel = await fetchHotel();
        } catch (error: unknown) {
            failure = error;
        }
        if (!this.isDisplayed()) return;

        if (failure !== null) {
            console.error('Hoteldaten konnten nicht geladen werden:', failure);
            this.hotelError = HOTEL_LOAD_ERROR;
        } else if (hotel === null) {
            // Kein Fehler der Abfrage, aber auch kein Hotel – ein Fehler in den Stammdaten (E14).
            console.error('In der Tabelle `hotels` ist kein Hotel hinterlegt.');
            this.hotelError = HOTEL_LOAD_ERROR;
        } else {
            this.hotelError = null;
        }
        this.hotel = hotel;
        this.renderSummary();
        // Der Horizont begrenzt das Vorwärtsblättern.
        this.renderCalendar();
    }

    /**
     * Lädt die Verfügbarkeit je Nacht für den ganzen Horizont (V14) – einmal je Belegung,
     * danach aus dem Speicher. Blättern ist damit nie ein Ladezustand.
     */
    private async loadCalendar(): Promise<void> {
        const { adults, children } = bookingState.getGuests();
        const requestId = ++this.calendarRequestId;
        const isStale = (): boolean => requestId !== this.calendarRequestId || !this.isDisplayed();

        // Ohne Belegung keine Verfügbarkeit: Eine geratene Belegung sperrte Tage, die für
        // die echte frei sind (V16.7).
        if (adults === null) {
            this.nights = null;
            this.renderCalendar();
            return;
        }

        const key = `${adults.toString()}-${(children ?? 0).toString()}`;
        const cached = this.calendarCache.get(key);
        if (cached !== undefined) {
            this.nights = cached;
            this.renderCalendar();
            return;
        }

        await this.hotelLoaded;
        if (isStale()) return;
        // Ohne Hotel kein Horizont – und ohne Horizont keine Grenze, bis zu der sich laden ließe.
        const horizonDays = this.hotel?.booking_horizon_days;
        if (horizonDays === undefined) return;

        try {
            const rows = await fetchAvailabilityCalendar({
                from: toISODate(this.today),
                to: toISODate(addDays(this.today, horizonDays)),
                adults,
                children: children ?? 0,
            });
            if (isStale()) return;
            this.nights = buildNightAvailability(rows);
            this.calendarCache.set(key, this.nights);
        } catch (error: unknown) {
            if (isStale()) return;
            // Der Kalender bleibt bedienbar, nur ohne Sperren – verbindlich prüft ohnehin
            // `create_booking` (E24: Komfort, keine Garantie).
            console.error('Verfügbarkeit für den Kalender konnte nicht geladen werden:', error);
            this.nights = null;
        }
        this.renderCalendar();
    }

    private getCalendarRules(): CalendarRules {
        return { today: this.today, horizonDays: this.hotel?.booking_horizon_days ?? null, nights: this.nights };
    }

    /**
     * Lädt die Zimmerkategorien – ohne gewählten Zeitraum nur die Stammdaten, mit
     * Zeitraum zusätzlich Preis und Verfügbarkeit aus `search_availability`.
     */
    private async loadRooms(): Promise<void> {
        const { checkIn, checkOut } = bookingState.getDates();
        const { adults, children } = bookingState.getGuests();

        const requestId = ++this.roomsRequestId;
        this.roomsState = 'loading';
        this.renderRooms();

        try {
            const [roomTypes, serviceRows, availability] = await Promise.all([
                fetchRoomTypes(),
                fetchServices(),
                // Ohne gewählte Erwachsenenzahl wird nicht gesucht: eine geratene Belegung
                // liefert Preise und Restbestände, die niemand bestellt hat (V16.7).
                checkIn === null || checkOut === null || adults === null
                    ? null
                    : searchAvailability({
                          checkIn: toISODate(checkIn),
                          checkOut: toISODate(checkOut),
                          adults,
                          // Leeres Kinderfeld heißt „keine Kinder" — das ist keine Vermutung,
                          // sondern die Abwesenheit von Kindern.
                          children: children ?? 0,
                      }),
            ]);

            // Eine überholte Antwort darf das Ergebnis der aktuellen Suche nicht ersetzen.
            if (this.isStale(requestId)) return;

            this.breakfastService = buildBreakfastService(serviceRows.find((row: ServiceRow): boolean => row.code === BREAKFAST) ?? null);
            // Ein neues Suchergebnis kann gewählte Mengen unmöglich gemacht haben (V16.6) –
            // der Store gleicht Mengen und Leistungen ab und meldet sich einmal.
            this.quantityNotice = bookingState.applySearchResult(buildRoomCards(roomTypes, availability), buildExtraServices(serviceRows));

            this.roomsState = 'ready';
            this.roomsError = null;
        } catch (error) {
            if (this.isStale(requestId)) return;
            this.roomsState = 'error';
            this.roomsError = error instanceof Error ? error.message : 'Unbekannter Fehler';
        }

        this.renderRooms();
    }

    private renderCalendar(): void {
        if (!this.calendarEl) return;
        this.calendarEl.innerHTML = this.getCalendarHeaderHtml() + this.getCalendarGridHtml() + this.getCalendarFooterHtml();
    }

    private getCalendarHeaderHtml(): string {
        return calendarTemplate.getCalendarHeaderHtml({
            monthName: MONTHS[this.displayedMonth] ?? '',
            year: this.displayedYear.toString(),
            prevDisabled: !canGoPrev(this.displayedYear, this.displayedMonth, this.getCalendarRules()),
            nextDisabled: !canGoNext(this.displayedYear, this.displayedMonth, this.getCalendarRules()),
        });
    }

    private getCalendarGridHtml(): string {
        const { checkIn, checkOut } = bookingState.getDates();
        const cells = buildDays({ year: this.displayedYear, month: this.displayedMonth, checkIn, checkOut, rules: this.getCalendarRules() });
        return calendarTemplate.getCalendarGridHtml(cells.map((cell: DayCell): calendarTemplate.DayCellView => this.getDayCellView(cell)));
    }

    private getDayCellView(cell: DayCell): calendarTemplate.DayCellView {
        let label: string | null = null;
        if (cell.isStart) label = 'Anreise';
        else if (cell.isEnd) label = 'Abreise';

        return {
            iso: toISODate(cell.date),
            weekday: WEEKDAYS[(cell.date.getDay() + 6) % 7] ?? '',
            day: cell.date.getDate().toString().padStart(2, '0'),
            label,
            stateClass: this.getCellStateClass(cell),
            selectable: cell.selectable,
            blocked: cell.blocked,
            tooltip: this.getDayTooltip(cell),
            flagged: this.isRejectedNight(cell.date),
            withClearButton: cell.isStart,
        };
    }

    /** Die abgelehnte Nacht nennt ihre Ablehnung, alle anderen gesperrten Tage ihren Grund. */
    private getDayTooltip(cell: DayCell): string | null {
        const calendarHint = this.rejection?.calendarHint ?? null;
        if (calendarHint !== null && this.isRejectedNight(cell.date)) return calendarHint;
        return cell.blocked && cell.blockReason !== null ? formatBlockedNight(formatDate(cell.date), cell.blockReason) : null;
    }

    private isRejectedNight(date: Date): boolean {
        const night = this.rejection?.night ?? null;
        return night !== null && isSameDay(night, date);
    }

    private getCellStateClass(cell: DayCell): string {
        if (cell.isStart || cell.isEnd) {
            return 'bg-purple-haze/65 text-white cursor-pointer';
        }
        if (cell.inRange) {
            return 'bg-purple-haze/35 text-purple-haze-dark cursor-pointer';
        }
        // Durchgestrichen, aber lesbar: Der Gast soll sehen, DASS es den Tag gibt (E24).
        if (cell.blocked) {
            // Den Strich setzt das Template an Wochentag und Datum.
            return cell.isToday ? 'bg-purple-haze/40 text-white cursor-not-allowed' : 'text-purple-haze-dark/45 cursor-not-allowed';
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

    private getCalendarFooterHtml(): string {
        const { checkIn, checkOut } = bookingState.getDates();
        return calendarTemplate.getCalendarFooterHtml(checkIn !== null && checkOut !== null && bookingState.getGuests().adults !== null, this.rejection?.calendarHint ?? null);
    }

    private handleCalendarClick(event: MouseEvent): void {
        const target = event.target;
        if (!(target instanceof Element)) return;

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
                case 'next-step':
                    // Nur weiter zur Zimmerauswahl – gebucht wird ausschließlich über
                    // `[data-action="checkout"]` in der Zusammenfassung.
                    scrollToSection('booking-rooms');
                    return;
                default:
                    return;
            }
        }

        const dayEl = target.closest<HTMLElement>('[data-date]');
        const iso = dayEl?.dataset.date;
        // Gesperrte Tage tragen `aria-disabled` statt `disabled`, damit ihr Tooltip erscheint.
        if (dayEl && !dayEl.hasAttribute('disabled') && dayEl.getAttribute('aria-disabled') !== 'true' && iso) {
            this.selectDate(iso);
        }
    }

    private selectDate(iso: string): void {
        this.rejection = null;
        const date = parseISODate(iso);
        const { checkIn, checkOut } = bookingState.getDates();

        // Abreise nur, wenn alle Nächte dazwischen frei sind (E29); sonst beginnt mit diesem
        // Tag ein neuer Zeitraum – geklickt werden kann er nur, wenn er als Anreise taugt.
        if (checkIn !== null && checkOut === null && isSelectableAsCheckOut(date, checkIn, this.getCalendarRules())) {
            bookingState.setDates(checkIn, date);
        } else {
            bookingState.setDates(date, null);
        }
        this.renderCalendar();
        this.renderGuestsNotice();
        void this.loadRooms();
    }

    private clearSelection(): void {
        this.rejection = null;
        bookingState.setDates(null, null);
        this.renderCalendar();
        this.renderGuestsNotice();
        void this.loadRooms();
    }

    private changeMonth(delta: number): void {
        const rules = this.getCalendarRules();
        const allowed = delta < 0 ? canGoPrev(this.displayedYear, this.displayedMonth, rules) : canGoNext(this.displayedYear, this.displayedMonth, rules);
        if (!allowed) return;

        const target = new Date(this.displayedYear, this.displayedMonth + delta, 1);
        this.displayedYear = target.getFullYear();
        this.displayedMonth = target.getMonth();
        this.renderCalendar();
    }

    /**
     * Geprüft wird beim Klick, nicht während der Eingabe (V16): Der Knopf ist immer aktiv,
     * und erst dann werden die fehlenden Felder markiert. Ist alles da, bucht
     * `create_booking` (Phase 9b, Punkte 8–9).
     */
    private async submit(): Promise<void> {
        if (this.submitting) return;

        const draft = this.getBookingDraft();
        const { checkIn, checkOut, nights, adults } = draft;
        const invalid = getInvalidFields(draft);
        const checkoutError = getCheckoutError(draft, bookingState.getRooms());
        // In das Formular springen nur, wenn dort auch das Problem liegt – nicht, wenn
        // noch das Zimmer fehlt.
        this.markInvalidFields(invalid, checkoutError?.section === 'form');
        this.showCheckoutError(checkoutError?.message ?? null);
        if (checkoutError !== null || checkIn === null || checkOut === null || nights === null || adults === null) return;

        const booking: Booking = { ...draft, checkIn, checkOut, nights, adults };

        this.setSubmitting(true);
        let result: Awaited<ReturnType<typeof createBooking>>;
        try {
            result = await createBooking(booking);
        } catch (error: unknown) {
            console.error(error);
            // Ist nicht sicher, dass nichts gebucht wurde (V15), bleibt der Knopf gesperrt –
            // ein zweiter Versuch könnte doppelt buchen.
            if (!(error instanceof BookingFailedError) || error.outcomeUnknown) {
                this.showCheckoutError(BOOKING_OUTCOME_UNKNOWN);
                return;
            }
            this.setSubmitting(false);
            this.showCheckoutError('Die Buchung ist aus technischen Gründen nicht zustande gekommen. Bitte versuchen Sie es in einigen Minuten erneut.');
            return;
        }

        if (!result.ok) {
            this.setSubmitting(false);
            this.showCheckoutError(this.getRejectionText(result.error));
            this.rememberRejection(result.error);
            // Eine Ablehnung heißt fast immer: Die Verfügbarkeit hat sich geändert. Die
            // neue Liste passt unmögliche Mengen an und sagt es über der Liste – und der
            // Kalender darf nicht aus dem Speicher weiter alte Nächte anbieten.
            this.calendarCache.clear();
            void this.loadCalendar();
            void this.loadRooms();
            return;
        }

        // Der Knopf bleibt gesperrt – die Buchung ist getätigt, und das Popup führt nur
        // noch zur Startseite.
        bookingState.reset();
        this.showConfirmation(booking, result.data);
    }

    private showCheckoutError(message: string | null): void {
        const errorEl = document.getElementById('booking-checkout-error');
        if (!errorEl) return;
        errorEl.hidden = message === null;
        errorEl.textContent = message ?? '';
    }

    private setSubmitting(submitting: boolean): void {
        this.submitting = submitting;
        const button = document.querySelector<HTMLButtonElement>('[data-action="checkout"]');
        if (!button) return;
        button.disabled = submitting;
        button.setAttribute('aria-busy', String(submitting));
        button.textContent = submitting ? CHECKOUT_BUSY_LABEL : CHECKOUT_LABEL;
    }

    /**
     * Ablehnung aus `create_booking` als Satz mit Kategorie und Nacht (E31). Die Texte
     * stehen in `messages.ts`; hier kommt nur dazu, was die View kennt.
     */
    /**
     * Merkt sich die Ablehnung für Zimmerkarte und Kalender – angezeigt wird sie mit dem
     * Neuladen, das direkt danach folgt. Der Kalender springt in den Monat der Nacht,
     * sonst stünde der Hinweis womöglich auf einem Blatt, das gerade nicht zu sehen ist.
     */
    private rememberRejection(rejection: BookingRejection): void {
        const night = rejection.date === null ? null : parseISODate(rejection.date);
        const hints = getRejectionHints(rejection.code, night === null ? null : formatDate(night));
        this.rejection = hints === null ? null : { roomTypeId: rejection.roomTypeId, night, roomHint: hints.room, calendarHint: hints.calendar };

        if (this.rejection !== null && night !== null) {
            this.displayedYear = night.getFullYear();
            this.displayedMonth = night.getMonth();
        }
    }

    private getRejectionText(rejection: BookingRejection): string {
        const roomName = bookingState.getRooms().find((card: RoomCard): boolean => card.roomTypeId === rejection.roomTypeId)?.name ?? null;
        const night = rejection.date === null ? null : formatDate(parseISODate(rejection.date));
        return getRejectionMessage(rejection.code, { roomName, night });
    }

    /**
     * Bestätigungs-Popup nach E46. Genau ein Ausgang (V16): Button, Escape und Klick auf
     * den Hintergrund führen zur Startseite – ein Weg, der nur schließt, ließe den Gast
     * auf einem Formular zurück, dessen Buchung bereits getätigt ist.
     */
    private showConfirmation(booking: Booking, created: CreatedBooking): void {
        const references = created.bookings.map((room: { bookingReference: string }): string => room.bookingReference);
        const currency = created.bookings[0]?.currency ?? DEFAULT_CURRENCY;
        const stay = `${formatDate(parseISODate(booking.checkIn))} – ${formatDate(parseISODate(booking.checkOut))}`;

        openModal({
            labelledBy: 'booking-confirmation-title',
            html: checkoutTemplate.getConfirmationHtml(logo, [
                { label: references.length === 1 ? 'Buchungsnummer' : 'Buchungsnummern', values: references },
                { label: 'Zeitraum', values: [stay, formatNights(created.nights)] },
                { label: 'Gesamtpreis', values: [formatPrice(created.grandTotalCents, currency)] },
            ]),
            onClose: (): void => {
                // Der Router hört auf `popstate` und rendert dann den neuen Pfad – derselbe
                // Weg wie beim Zurück-Knopf des Browsers, ohne den Router hierher zu reichen.
                history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
            },
        });
    }

    private getBookingDraft(): BookingDraft {
        return buildBookingDraft(bookingState.getSnapshot());
    }

    private bindCustomerForm(): void {
        this.customerFormEl = document.querySelector<HTMLFormElement>('#booking-customer');
        const form = this.customerFormEl;
        if (!form) return;

        form.addEventListener('input', (event: Event): void => {
            // Wer ein markiertes Feld korrigiert, soll die Markierung nicht bis zum
            // nächsten Klick behalten.
            if (event.target instanceof Element) event.target.removeAttribute('aria-invalid');
            this.saveCustomerDetails();
        });
        form.addEventListener('change', (event: Event): void => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) || !target.hasAttribute('data-billing-toggle')) return;

            const billingEl = document.getElementById('booking-billing');
            if (billingEl) billingEl.hidden = !target.checked;
            this.saveCustomerDetails();
        });
        form.addEventListener('submit', (event: Event): void => {
            // Enter in einem Feld soll nicht die Seite neu laden.
            event.preventDefault();
        });

        document.querySelector('[data-action="checkout"]')?.addEventListener('click', (): void => {
            void this.submit();
        });

        // Der Store kennt sonst bis zum ersten Tippen nicht einmal das vorgeschlagene Land.
        this.saveCustomerDetails();
    }

    /** Übernimmt das Formular in den Store – Zusammenfassung und Header folgen über `subscribe`. */
    private saveCustomerDetails(): void {
        bookingState.setCustomerDetails(this.readCustomerDetails());
    }

    /**
     * Liest das Formular in die Form der `create_booking`-Parameter (V13, E51).
     *
     * Ist die Checkbox aus, ist `billing` `null` – auch wenn im ausgeblendeten Block noch
     * etwas steht.
     */
    private readCustomerDetails(): CustomerDetails {
        const data = this.customerFormEl ? new FormData(this.customerFormEl) : new FormData();
        const text = (name: string): string => {
            const value = data.get(name);
            return typeof value === 'string' ? value : '';
        };
        const country = (name: string): CountryCode => {
            const value = text(name);
            return isCountryCode(value) ? value : DEFAULT_COUNTRY;
        };

        return {
            customer: {
                firstName: text('first-name').trim(),
                lastName: text('last-name').trim(),
                email: text('email').trim(),
                phone: emptyToNull(text('phone')),
            },
            residence: {
                street: text('street').trim(),
                houseNumber: text('house-number').trim(),
                postalCode: text('postal-code').trim(),
                city: text('city').trim(),
                countryCode: country('country'),
            },
            billing:
                data.get('billing-differs') === null
                    ? null
                    : {
                          company: emptyToNull(text('billing-company')),
                          street: text('billing-street').trim(),
                          houseNumber: text('billing-house-number').trim(),
                          postalCode: text('billing-postal-code').trim(),
                          city: text('billing-city').trim(),
                          countryCode: country('billing-country'),
                      },
        };
    }

    private markInvalidFields(invalid: readonly InvalidField[], focusFirst: boolean): void {
        const form = this.customerFormEl;
        if (!form) return;

        for (const [field, name] of Object.entries(FIELD_NAMES) as [InvalidField, string][]) {
            const element = form.elements.namedItem(name);
            if (!(element instanceof HTMLElement)) continue;
            if (invalid.includes(field)) {
                element.setAttribute('aria-invalid', 'true');
            } else {
                element.removeAttribute('aria-invalid');
            }
        }

        // In das erste ungültige Feld springen (Phase 9b, Punkt 7) – in Formularreihenfolge,
        // nicht in der von `FIELD_NAMES`.
        if (focusFirst) form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }

    /**
     * Name und Adressen in der Zusammenfassung: immer die Wohnadresse, die
     * Rechnungsadresse nur, wenn es eine gibt.
     *
     * Per `textContent` statt als HTML-String – das sind Eingaben des Gastes.
     */
    private renderCustomerSummary(): void {
        const summaryEl = document.getElementById('booking-summary-customer');
        if (!summaryEl) return;

        const { customer, residence, billing } = bookingState.getCustomerDetails();
        const name = `${customer.firstName} ${customer.lastName}`.trim();
        // Das Land steht schon da, bevor etwas eingegeben ist – das allein ist noch keine
        // Adresse.
        const address = (lines: string[]): string | null => (lines.length > 1 ? lines.join('\n') : null);
        const rows: [string, string | null][] = [
            ['Name', name === '' ? null : name],
            ['Wohnadresse', address(formatAddressLines(residence))],
        ];
        if (billing !== null) rows.push(['Rechnungsadresse', address(formatAddressLines(billing))]);

        summaryEl.replaceChildren(
            ...rows.flatMap(([label, value]: [string, string | null], index: number): HTMLElement[] => {
                const row = document.createElement('div');
                row.className = 'flex items-start justify-between gap-4';

                const labelEl = document.createElement('span');
                labelEl.textContent = label;

                const valueEl = document.createElement('span');
                valueEl.className = 'text-right whitespace-pre-line';
                valueEl.textContent = value ?? '–';

                row.append(labelEl, valueEl);
                if (index === 0) return [row];

                const divider = document.createElement('hr');
                divider.className = 'my-3 border-t-[0.5px] border-purple-haze/45';
                return [divider, row];
            }),
        );
    }
}

/** Zeile unter der Beschreibung – ohne gewählten Zeitraum bleibt sie weg. */
function getAvailabilityHtml(availability: RoomCardAvailability | null): string {
    if (availability === null) return '';
    if (!availability.isBookable) return roomsTemplate.getAvailabilityHtml(formatUnavailableReason(availability.unavailableReason), false);

    const roomsFree = availability.roomsFree === null ? '' : `${formatRoomsFreeLabel(availability.roomsFree)} · `;
    return roomsTemplate.getAvailabilityHtml(`${roomsFree}${formatNights(availability.nights)}`, true);
}

function buildAdultOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_ADULTS }, (_unused: unknown, index: number): GuestOption => {
        const value = index + 1;
        return { value, label: formatAdults(value) };
    });
}

/** Ohne eigene 0-Option: der leere Platzhalter „Keine Kinder" ist dieser Fall (Q17). */
function buildChildOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_CHILDREN }, (_unused: unknown, index: number): GuestOption => {
        const value = index + 1;
        return { value, label: formatChildren(value) };
    });
}
