import AbstractView from '../AbstractView';
import { bookingState } from '../../shared/state/bookingState';
import { supabase } from '../../shared/services/supabase';
import { createBooking, type BookingRejection, type CreatedBooking } from '../../shared/services/booking.service';
import { openModal } from '../../shared/ui/modal';
import logo from '../../assets/img/logo-small.svg';
import { RoomAmenity, RoomAvailability, RoomCard, RoomCardAvailability, RoomTypeDetail, RoomTypeImage } from './room.interface';
import { clampQuantity, getLimitMessage, getMissingBeds, getRoomLimit, getRoomMax, getTotalRooms, normalizeQuantityInput, reconcileQuantities } from './roomQuantity';
import { buildBreakfastService, getBreakfastAmountCents, type BreakfastService } from './breakfast';
import { buildExtraServices, CHILD_BED, getServiceAmountCents, getServiceMax, reconcileServices, type ExtraService, type ServiceRow } from './services';
import {
    COUNTRIES,
    DEFAULT_COUNTRY,
    formatAddressLines,
    getCountryLabel,
    getInvalidFields,
    isCountryCode,
    toOptional,
    type CountryCode,
    type CustomerDetails,
    type InvalidField,
} from './address';
import { buildOrderLines, getOrderTotalCents, type OrderLine } from './summary';
import type { HotelRow } from './hotel.interface';
import './booking.css';

/*
    *** Vorbereitung und Verknüpfung BookingView zu Datenbank ***
        TODO: Buchungssteps verknüpfen
        TODO: Migrations notwending? Eventuelle Änderungen an der Datenbank?
*/

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

type BookingPosition = {
    roomTypeId: string;
    rooms: number;
};

/** Eine Zusatzleistung je Vorgang – die Form von `p_services` in `create_booking` (E49). */
type BookingService = {
    code: string;
    quantity: number;
};

/**
 * Gäste als Gesamtzahl des Vorgangs (E48) – verteilt werden sie in `create_booking`.
 * Kontaktdaten und Adressen gelten ebenso für den ganzen Vorgang (E51).
 */
type Booking = CustomerDetails & {
    checkIn: string;
    checkOut: string;
    nights: number;
    adults: number;
    children: number;
    positions: BookingPosition[];
    withBreakfast: boolean;
    services: BookingService[];
};

/** Stand der Buchung während der Eingabe – was noch fehlt, ist `null`. */
type BookingDraft = Omit<Booking, 'checkIn' | 'checkOut' | 'nights' | 'adults'> & {
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
    adults: number | null;
};

type GuestField = 'adults' | 'children';

type GuestOption = {
    value: number;
    label: string;
};

type RoomsState = 'loading' | 'ready' | 'error';

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

// Ausstattungs-Icons aus dem Design (Instanzen "Room_Stat"), Originalfarbe #642360 = purple-haze.
const ICON_BED = /*html*/ `
    <svg class="w-9 shrink-0 text-purple-haze" viewBox="0 0 39 35" fill="currentColor" aria-hidden="true">
        <path d="M38.4287 27.2543C38.6945 26.7613 38.9998 25.8782 38.9998 25.1923V22.4559C38.9998 21.3418 38.5292 20.352 37.8049 19.7363C38.513 19.1334 38.9999 18.0194 38.9999 17.0131C38.9999 15.9047 38.5345 14.9193 37.817 14.3024V3.37805C37.817 1.51539 36.5014 0 34.8844 0H20.7446C20.4291 0 20.1734 0.294636 20.1734 0.658062C20.1734 1.02149 20.4291 1.31612 20.7446 1.31612H34.8844C35.8715 1.31612 36.6745 2.2411 36.6745 3.37805V13.7058C36.2997 13.6142 35.8406 13.616 35.4508 13.6324V4.69935C35.4508 3.61074 34.6819 2.72517 33.7369 2.72517H5.2631C4.31803 2.72517 3.54923 3.61074 3.54923 4.69935V13.6324C3.15923 13.6162 2.7006 13.6142 2.32553 13.705V3.37805C2.32553 2.2411 3.12853 1.31612 4.11557 1.31612H18.2554C18.5709 1.31612 18.8266 1.02149 18.8266 0.658062C18.8266 0.294636 18.5709 0 18.2554 0H4.11557C2.49851 0 1.18295 1.51539 1.18295 3.37805V14.3003C0.481711 14.9038 0 16.0133 0 17.0131C0 18.1283 0.471275 19.1191 1.19636 19.7353C0.471352 20.3509 0.000152344 21.3412 0.000152344 22.456V25.1924C0.000152344 25.9681 0.228363 26.6835 0.611432 27.2544H0.571289C0.255785 27.2544 0 27.549 0 27.9124V30.6377C0 31.0011 0.255785 31.2958 0.571289 31.2958H2.3662V33.3632C2.3662 33.7266 2.62199 34.0213 2.93749 34.0213H5.30354C5.61905 34.0213 5.87483 33.7266 5.87483 33.3632V31.2958H10.565C10.8805 31.2958 11.1363 31.0011 11.1363 30.6377C11.1363 30.2743 10.8805 29.9796 10.565 29.9796H1.14258V28.5705H37.8574V29.9796H13.0551C12.7396 29.9796 12.4838 30.2743 12.4838 30.6377C12.4838 31.0011 12.7396 31.2958 13.0551 31.2958H33.1251V33.3632C33.1251 33.7266 33.3808 34.0213 33.6964 34.0213H36.0624C36.378 34.0213 36.6337 33.7266 36.6337 33.3632V31.2958H38.4287C38.7443 31.2958 39 31.0011 39 30.6377V27.9124C39 27.5489 38.7443 27.2543 38.4287 27.2543ZM4.69181 4.69935C4.69181 4.33654 4.94805 4.04129 5.2631 4.04129H33.7368C34.0519 4.04129 34.3081 4.33654 34.3081 4.69935V13.6324H32.9849C33.0494 13.425 33.0845 13.2017 33.0845 12.9691V10.1499C33.0845 9.06134 32.3156 8.17576 31.3706 8.17576H23.0085C22.0635 8.17576 21.2946 9.06134 21.2946 10.1499V12.9691C21.2946 13.2017 21.3297 13.425 21.3942 13.6324H17.6056C17.67 13.425 17.7052 13.2016 17.7052 12.9689V10.1502C17.7052 9.0616 16.9364 8.17603 15.9914 8.17603H7.62922C6.68416 8.17603 5.91536 9.0616 5.91536 10.1502V12.9689C5.91536 13.2016 5.95047 13.425 6.01499 13.6324H4.69188L4.69181 4.69935ZM7.05793 12.9689V10.1502C7.05793 9.78731 7.31418 9.49215 7.62922 9.49215H15.9914C16.3064 9.49215 16.5627 9.78731 16.5627 10.1502V12.9689C16.5627 13.3318 16.3064 13.627 15.9914 13.627H7.62922C7.31418 13.627 7.05793 13.3318 7.05793 12.9689ZM2.9349 14.9485H25.9449C26.2605 14.9485 26.5162 14.6539 26.5162 14.2905C26.5162 14.2896 26.5162 14.2887 26.5162 14.2878C26.5162 14.287 26.5162 14.2861 26.5162 14.2852C26.5162 13.9218 26.2605 13.6271 25.9449 13.6271H23.0085C22.6934 13.6271 22.4372 13.332 22.4372 12.9691V10.1499C22.4372 9.78705 22.6934 9.49189 23.0085 9.49189H31.3706C31.6857 9.49189 31.9419 9.78705 31.9419 10.1499V12.9691C31.9419 13.332 31.6857 13.6271 31.3706 13.6271H28.435C28.1194 13.6271 27.8637 13.9218 27.8637 14.2852V14.2878V14.2905C27.8637 14.6539 28.1194 14.9485 28.435 14.9485H36.0651C37.0534 14.9485 37.8574 15.8747 37.8574 17.0131C37.7548 18.2712 37.1573 18.9595 36.0651 19.0777H2.9349C1.94657 19.0777 1.14258 18.1515 1.14258 17.0131C1.14258 16.4618 1.55695 14.9485 2.9349 14.9485ZM1.14273 22.4559C1.14273 21.3189 1.94573 20.394 2.93277 20.394H36.0672C37.0543 20.394 37.8573 21.3189 37.8573 22.4559V25.1923C37.8573 26.3292 37.0543 27.2542 36.0672 27.2542H2.93277C1.94573 27.2542 1.14273 26.3292 1.14273 25.1923V22.4559ZM4.73225 32.7052H3.50878V31.2958H4.73225V32.7052ZM35.4912 32.7052H34.2677V31.2958H35.4912V32.7052Z" />
    </svg>
`;

const ICON_AIR_CONDITIONING = /*html*/ `
    <svg class="w-9 shrink-0 text-purple-haze" viewBox="0 0 39 34" fill="currentColor" aria-hidden="true">
        <path d="M37.2861 0H26.8704C26.5548 0 26.2991 0.350627 26.2991 0.783116C26.2991 1.2156 26.5548 1.56623 26.8704 1.56623H37.2861C37.6012 1.56623 37.8574 1.91749 37.8574 2.34935V21.9199C37.8574 22.3517 37.6012 22.7031 37.2861 22.7031H36.6341V15.323C36.6341 14.0275 35.8652 12.9736 34.9202 12.9736H12.464C12.1485 12.9736 11.8927 13.3242 11.8927 13.7567C11.8927 14.1892 12.1485 14.5399 12.464 14.5399H34.9202C35.2353 14.5399 35.4915 14.8911 35.4915 15.323V16.2168H3.50848V15.323C3.50848 14.8911 3.7648 14.5399 4.07977 14.5399H9.97395C10.2894 14.5399 10.5452 14.1892 10.5452 13.7567C10.5452 13.3242 10.2894 12.9736 9.97395 12.9736H4.07977C3.1347 12.9736 2.3659 14.0275 2.3659 15.323V22.7031H1.71387C1.39882 22.7031 1.14258 22.3517 1.14258 21.9199V2.34935C1.14258 1.91749 1.39882 1.56623 1.71387 1.56623H24.3811C24.6967 1.56623 24.9524 1.2156 24.9524 0.783116C24.9524 0.350627 24.6967 0 24.3811 0H1.71387C0.768803 0 0 1.05387 0 2.34935V21.9199C0 23.2154 0.768803 24.2693 1.71387 24.2693H37.2861C38.2311 24.2693 39 23.2154 39 21.9199V2.34935C39 1.05387 38.2311 0 37.2861 0ZM3.50848 22.7031V21.0261H18.2554C18.5709 21.0261 18.8266 20.6755 18.8266 20.243C18.8266 19.8105 18.5709 19.4599 18.2554 19.4599H3.50848V17.783H35.4915V19.4599H20.7446C20.4291 19.4599 20.1734 19.8105 20.1734 20.243C20.1734 20.6755 20.4291 21.0261 20.7446 21.0261H35.4915V22.7031H3.50848Z" />
        <path d="M21.2948 4.02665V7.26979C21.2948 7.70228 21.5505 8.05291 21.8661 8.05291H28.9643C29.2799 8.05291 29.5356 7.70228 29.5356 7.26979V4.02665C29.5356 3.59416 29.2799 3.24353 28.9643 3.24353H21.8661C21.5506 3.24353 21.2948 3.59416 21.2948 4.02665ZM22.4374 4.80976H28.393V6.48668H22.4374V4.80976Z" />
        <path d="M34.2675 5.64816C34.2675 4.32219 33.4805 3.24347 32.5133 3.24347C31.5461 3.24347 30.7592 4.32219 30.7592 5.64816C30.7592 6.97413 31.5461 8.05285 32.5133 8.05285C33.4805 8.05285 34.2675 6.97413 34.2675 5.64816ZM31.9017 5.64816C31.9017 5.18581 32.1761 4.8097 32.5133 4.8097C32.8505 4.8097 33.1249 5.18581 33.1249 5.64816C33.1249 6.11051 32.8505 6.48661 32.5133 6.48661C32.1761 6.48661 31.9017 6.11051 31.9017 5.64816Z" />
        <path d="M19.5 25.9468C19.1845 25.9468 18.9287 26.2975 18.9287 26.73V33.2168C18.9287 33.6493 19.1845 33.9999 19.5 33.9999C19.8156 33.9999 20.0713 33.6493 20.0713 33.2168V26.73C20.0713 26.2975 19.8156 25.9468 19.5 25.9468Z" />
        <path d="M14.7678 25.9468C14.4523 25.9468 14.1965 26.2975 14.1965 26.73C14.3524 29.0036 13.7133 31.4422 12.1463 32.5163C11.864 32.7097 11.7496 33.1801 11.8908 33.567C12.1111 33.9819 12.3666 34.0987 12.6572 33.9172C14.6282 32.5664 15.4978 29.6288 15.3391 26.73C15.3391 26.2975 15.0834 25.9468 14.7678 25.9468Z" />
        <path d="M8.85273 25.9468C8.53722 25.9468 8.28144 26.2975 8.28144 26.73C8.28144 29.0695 7.34399 31.1676 6.08274 32.6629C5.85963 32.9688 5.85963 33.4646 6.08274 33.7704C6.352 34.0762 6.62135 34.0762 6.89061 33.7704C8.33422 31.8691 9.42402 29.5878 9.42402 26.7298C9.42402 26.2975 9.16823 25.9468 8.85273 25.9468Z" />
        <path d="M26.8536 32.5162C25.2867 31.4423 24.655 29.0067 24.8034 26.73C24.8034 26.2975 24.5477 25.9468 24.2321 25.9468C23.9165 25.9468 23.6608 26.2975 23.6608 26.73C23.4906 29.6392 24.3567 32.556 26.3428 33.9172C26.6334 34.0987 26.8889 33.9818 27.1092 33.567C27.2503 33.1801 27.1359 32.7097 26.8536 32.5162Z" />
        <path d="M30.7186 26.73C30.7341 26.298 30.4629 25.9468 30.1473 25.9468C29.8318 25.9468 29.576 26.2975 29.576 26.73C29.576 29.5619 30.6703 31.8877 32.1095 33.7705C32.3788 34.0763 32.6481 34.0762 32.9174 33.7705C33.1405 33.4646 33.1405 32.9688 32.9173 32.6629C31.7256 31.183 30.6512 28.6118 30.7186 26.73Z" />
    </svg>
`;

const ICON_BATH = /*html*/ `
    <svg class="w-9 shrink-0 text-purple-haze" viewBox="0 0 39 32" fill="currentColor" aria-hidden="true">
        <path d="M37.2545 11.5559H36.6835V1.67667C36.6835 0.752173 35.9225 0 34.9871 0H31.3594C30.424 0 29.6629 0.752097 29.6629 1.67667V2.34776C28.2952 2.58107 27.2515 3.76207 27.2515 5.17946C27.2515 5.48813 27.5046 5.73838 27.817 5.73838H32.6398C32.9521 5.73838 33.2053 5.48813 33.2053 5.17946C33.2053 3.76207 32.1616 2.58115 30.7939 2.34776V1.67667C30.7939 1.36846 31.0475 1.11776 31.3594 1.11776H34.9871C35.299 1.11776 35.5526 1.36846 35.5526 1.67667V11.5559H27.1927C26.9662 10.8929 26.331 10.4143 25.5848 10.4143H24.4501C24.1378 10.4143 23.8846 10.6645 23.8846 10.9732C23.8846 11.2818 24.1377 11.5321 24.4501 11.5321H25.5848C25.8967 11.5321 26.1503 11.7828 26.1503 12.091V17.3558H19.085V12.0909C19.085 11.7827 19.3387 11.532 19.6505 11.532H21.9855C22.2978 11.532 22.551 11.2818 22.551 10.9731C22.551 10.6644 22.2979 10.4142 21.9855 10.4142H19.6505C18.9157 10.4142 18.2885 10.8784 18.0533 11.5257C16.8606 11.4309 15.6812 11.1076 14.6151 10.5805C12.8423 9.70432 10.857 9.24124 8.8741 9.24124H1.74548C0.782971 9.24131 0 10.0152 0 10.9664C0 11.9176 0.782971 12.6916 1.74548 12.6916H2.73015V19.1634C2.73015 22.2659 4.67025 24.929 7.41442 26.03V27.169C7.41442 27.499 7.14279 27.7675 6.80893 27.7675C5.85145 27.7675 5.07251 28.5373 5.07251 29.4837C5.07251 30.4301 5.85145 31.2 6.80893 31.2H9.15091C10.1084 31.2 10.8874 30.4301 10.8874 29.4837V28.3264C10.8874 27.3582 11.6844 26.5706 12.6639 26.5706H12.6668H17.2899C17.6022 26.5706 17.8554 26.3203 17.8554 26.0117C17.8554 25.703 17.6023 25.4527 17.2899 25.4527H10.2253C6.71607 25.4527 3.86115 22.6314 3.86115 19.1634V12.6916H5.88481C6.19712 12.6916 6.45031 12.4413 6.45031 12.1326C6.45031 11.824 6.19719 11.5737 5.88481 11.5737H1.74548C1.40667 11.5737 1.131 11.3013 1.131 10.9664C1.131 10.6315 1.40667 10.3591 1.74548 10.3591H8.8741C10.6823 10.3591 12.4926 10.7813 14.1092 11.5803C15.3016 12.1698 16.6204 12.532 17.954 12.6392V13.8573C16.4294 13.7475 14.9215 13.3399 13.56 12.6662C11.9503 11.8715 10.1395 11.5388 8.34859 11.5737C8.03629 11.5737 7.78309 11.824 7.78309 12.1326C7.78309 12.4413 8.03621 12.6916 8.34859 12.6916C9.95704 12.6481 11.6097 12.9529 13.0542 13.666C14.5713 14.4167 16.2545 14.8662 17.954 14.9778V20.229C17.954 20.5377 18.2071 20.7879 18.5195 20.7879H26.7158C27.0281 20.7879 27.2813 20.5377 27.2813 20.229V15.006H35.5183V19.1634C35.5183 22.6314 32.6633 25.4527 29.1541 25.4527H19.7545C19.4422 25.4527 19.189 25.703 19.189 26.0117C19.189 26.3203 19.4421 26.5706 19.7545 26.5706H26.7126H26.7155C27.695 26.5706 28.4919 27.3582 28.4919 28.3264V29.4837C28.4919 30.4301 29.2709 31.2 30.2284 31.2H32.5704C33.5279 31.2 34.3068 30.4301 34.3068 29.4837C34.3068 28.5373 33.5279 27.7675 32.5704 27.7675C32.2365 27.7675 31.9649 27.499 31.9649 27.169V26.03C34.7091 24.929 36.6492 22.2659 36.6492 19.1634V15.006H37.2545C38.217 15.006 39 14.2322 39 13.281C39 12.3297 38.217 11.5559 37.2545 11.5559ZM31.9821 4.62054H28.4747C28.7395 3.84315 29.5291 3.45626 30.2978 3.42366C31.0798 3.42359 31.7455 3.92551 31.9821 4.62054ZM10.3637 26.5705C9.98309 27.0564 9.75632 27.6657 9.75632 28.3263V29.4837C9.75632 29.8136 9.48469 30.0821 9.15083 30.0821H6.80878C6.47491 30.0821 6.20336 29.8136 6.20336 29.4837C6.20336 29.1537 6.47499 28.8852 6.80878 28.8852C7.76626 28.8852 8.54527 28.1153 8.54527 27.169V26.3829C9.14756 26.5131 9.75373 26.5756 10.3637 26.5705ZM32.5705 28.8852C32.9043 28.8852 33.1759 29.1537 33.1759 29.4837C33.1759 29.8136 32.9043 30.0821 32.5705 30.0821H30.2285C29.8946 30.0821 29.623 29.8136 29.623 29.4837V28.3263C29.623 27.6657 29.3962 27.0564 29.0156 26.5705C29.6256 26.5756 30.2318 26.5131 30.8341 26.3829V27.169C30.834 28.1153 31.613 28.8852 32.5705 28.8852ZM19.085 19.6702V18.4735H26.1503V19.6702H19.085ZM37.2545 13.8883H27.2813V12.6736H37.2545C37.5933 12.6736 37.869 12.9461 37.869 13.281C37.8691 13.6158 37.5934 13.8883 37.2545 13.8883Z" />
        <path d="M30.794 8.64257V7.4941C30.794 7.18543 30.5408 6.93518 30.2285 6.93518C29.9161 6.93518 29.663 7.18543 29.663 7.4941V8.64257C29.663 8.95124 29.9161 9.20149 30.2285 9.20149C30.5408 9.20149 30.794 8.95124 30.794 8.64257Z" />
        <path d="M33.52 8.86959C33.7649 8.67806 33.7409 8.29742 33.52 8.07924L32.6984 7.26714C32.4775 7.04889 32.1195 7.04889 31.8986 7.26714C31.6778 7.48539 31.6778 7.83931 31.8986 8.05749L32.7203 8.86959C33.0064 9.1169 33.2515 9.07971 33.52 8.86959Z" />
        <path d="M27.4647 8.86959L28.2864 8.05749C28.5072 7.83923 28.5072 7.48532 28.2864 7.26714C28.0655 7.04889 27.7076 7.04889 27.4867 7.26714L26.665 8.07924C26.4442 8.29749 26.4442 8.65141 26.665 8.86959C26.7754 8.97875 27.1162 9.15416 27.4647 8.86959Z" />
        <path d="M18.522 9.20369C19.4758 9.20369 20.2517 8.43676 20.2517 7.49412C20.2517 6.55147 19.4758 5.78455 18.522 5.78455C17.5683 5.78455 16.7922 6.55147 16.7922 7.49412C16.7922 8.43676 17.5682 9.20369 18.522 9.20369ZM18.522 6.9023C18.8522 6.9023 19.1207 7.16776 19.1207 7.49412C19.1207 7.82048 18.8522 8.08593 18.522 8.08593C18.1918 8.08593 17.9232 7.82048 17.9232 7.49412C17.9232 7.16776 18.1918 6.9023 18.522 6.9023Z" />
        <path d="M13.8313 5.72499C14.7851 5.72499 15.5611 4.95806 15.5611 4.01542C15.5611 3.07278 14.7852 2.30585 13.8313 2.30585C12.8775 2.30585 12.1016 3.07278 12.1016 4.01542C12.1016 4.95806 12.8776 5.72499 13.8313 5.72499ZM13.8313 3.4236C14.1616 3.4236 14.4301 3.68906 14.4301 4.01542C14.4301 4.34178 14.1616 4.60724 13.8313 4.60724C13.5011 4.60724 13.2326 4.34178 13.2326 4.01542C13.2326 3.68906 13.5011 3.4236 13.8313 3.4236Z" />
    </svg>
`;

const ICON_GYM = /*html*/ `
    <svg class="w-9 shrink-0 text-purple-haze" viewBox="0 0 39 20" fill="currentColor" aria-hidden="true">
        <path d="M38.4287 7.07325H36.6341V4.1055C36.6341 3.79104 36.3784 3.53624 36.0628 3.53624H34.2674V0.56926C34.2674 0.254801 34.0117 0 33.6962 0H28.9644C28.6488 0 28.3931 0.254801 28.3931 0.56926V7.07325H18.3475C18.0319 7.07325 17.7762 7.32805 17.7762 7.64251C17.7762 7.95696 18.0319 8.21177 18.3475 8.21177H28.3931V11.7882H10.607V8.21177H15.8575C16.173 8.21177 16.4288 7.95696 16.4288 7.64251C16.4288 7.32805 16.173 7.07325 15.8575 7.07325H10.607V0.569336C10.607 0.254877 10.3513 7.58596e-05 10.0357 7.58596e-05H5.30362C4.98804 7.58596e-05 4.73233 0.254877 4.73233 0.569336V3.53662H2.93749C2.62191 3.53662 2.3662 3.79142 2.3662 4.10588V7.07332H0.571289C0.255709 7.07332 0 7.32812 0 7.64258V12.3575C0 12.672 0.255709 12.9268 0.571289 12.9268H2.3662V15.8942C2.3662 16.2087 2.62191 16.4635 2.93749 16.4635H4.73225V19.4307C4.73225 19.7452 4.98796 20 5.30354 20H10.0356C10.3512 20 10.6069 19.7452 10.6069 19.4307V12.9268H28.3931V19.4307C28.3931 19.7452 28.6488 20 28.9644 20H33.6962C34.0117 20 34.2674 19.7452 34.2674 19.4307V16.4638H36.0628C36.3784 16.4638 36.6341 16.209 36.6341 15.8945V12.9268H38.4287C38.7443 12.9268 39 12.672 39 12.3575V7.64251C39 7.32812 38.7443 7.07325 38.4287 7.07325ZM1.14258 11.7882V8.21177H2.3662V11.7882L1.14258 11.7882ZM3.50878 15.3249V4.67514H4.73225V15.3249L3.50878 15.3249ZM8.24104 18.8614V13.5879C8.24104 13.2734 7.98533 13.0186 7.66975 13.0186C7.35417 13.0186 7.09846 13.2734 7.09846 13.5879V18.8614H5.87491V1.1386H7.09846V11.1066C7.09846 11.4211 7.35417 11.6759 7.66975 11.6759C7.98533 11.6759 8.24104 11.4211 8.24104 11.1066V1.1386H9.46443V18.8614H8.24104ZM29.5356 1.13852H30.7591V18.8615H29.5356V1.13852ZM35.4915 15.3252H34.2674V11.2402C34.2674 10.9258 34.0117 10.671 33.6962 10.671C33.3806 10.671 33.1249 10.9258 33.1249 11.2402V18.8615H31.9016V1.13852H33.1249V8.75977C33.1249 9.07423 33.3806 9.32903 33.6962 9.32903C34.0117 9.32903 34.2674 9.07423 34.2674 8.75977V4.67476H35.4915V15.3252ZM37.8574 11.7882H36.6341V8.21177H37.8574V11.7882Z" />
    </svg>
`;

// "Entfernen"-Icon aus dem Design (Vector in den "preis"-Frames), Originalfarbe #FFC571 = Golden Wind.
const ICON_REMOVE = /*html*/ `
    <svg class="w-5 h-5 shrink-0 text-[#ffc571]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M 6.4 15 L 10 11.4 L 13.6 15 L 15 13.6 L 11.4 10 L 15 6.4 L 13.6 5 L 10 8.6 L 6.4 5 L 5 6.4 L 8.6 10 L 5 13.6 L 6.4 15 Z M 10 20 C 8.62 20 7.32 19.74 6.1 19.21 C 4.88 18.69 3.83 17.98 2.93 17.08 C 2.03 16.18 1.31 15.12 0.79 13.9 C 0.26 12.68 0 11.38 0 10 C 0 8.62 0.26 7.32 0.79 6.1 C 1.31 4.88 2.03 3.83 2.93 2.93 C 3.83 2.03 4.88 1.31 6.1 0.79 C 7.32 0.26 8.62 0 10 0 C 11.38 0 12.68 0.26 13.9 0.79 C 15.12 1.31 16.18 2.03 17.08 2.93 C 17.98 3.83 18.69 4.88 19.21 6.1 C 19.74 7.32 20 8.62 20 10 C 20 11.38 19.74 12.68 19.21 13.9 C 18.69 15.12 17.98 16.18 17.08 17.08 C 16.18 17.98 15.12 18.69 13.9 19.21 C 12.68 19.74 11.38 20 10 20 Z M 10 18 C 12.23 18 14.13 17.23 15.68 15.68 C 17.23 14.13 18 12.23 18 10 C 18 7.77 17.23 5.88 15.68 4.33 C 14.13 2.78 12.23 2 10 2 C 7.77 2 5.88 2.78 4.33 4.33 C 2.78 5.88 2 7.77 2 10 C 2 12.23 2.78 14.13 4.33 15.68 C 5.88 17.23 7.77 18 10 18 Z" />
    </svg>
`;

/**
 * Ausstattung je Zimmerkategorie.
 *
 * Für diese vier Merkmale gibt es kein Datenbankfeld – die Werte stammen aus dem
 * Figma-Design. Kategorien ohne Eintrag (z. B. `einzelzimmer-alpin`) bekommen keine
 * Ausstattungsliste, statt erfundene Merkmale anzuzeigen.
 */
// Icons der Zusatzleistungen, zugeordnet über `services.code` – wie die Ausstattung über
// den `slug`. Darstellung gehört nicht in die Datenbank (E49).
const SERVICE_ICON_CLASS = 'w-9 h-9 shrink-0 text-purple-haze';
const SERVICE_ICONS: Readonly<Record<string, string>> = {
    BREAKFAST: /*html*/ `
        <svg class="${SERVICE_ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-4Z" /><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 3.5v3M12 3.5v3" />
        </svg>`,
    CHILD_BED: /*html*/ `
        <svg class="${SERVICE_ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 5v15M21 5v15M3 9h18M3 17h18M7.5 9v8M12 9v8M16.5 9v8" />
        </svg>`,
    GARAGE: /*html*/ `
        <svg class="${SERVICE_ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 15l1.6-4.6A2 2 0 0 1 8.5 9h7a2 2 0 0 1 1.9 1.4L19 15" /><path d="M3.5 15h17v3.5h-17Z" /><path d="M6 18.5V20M18 18.5V20" /><path d="M7 16.8h.01M17 16.8h.01" />
        </svg>`,
    PET: /*html*/ `
        <svg class="${SERVICE_ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="6" cy="10" r="1.8" /><circle cx="9.5" cy="6" r="1.8" /><circle cx="14.5" cy="6" r="1.8" /><circle cx="18" cy="10" r="1.8" />
            <path d="M12 12c-2.5 0-5 3-5 5.2 0 1.6 1.3 2.3 2.6 2.3.9 0 1.6-.5 2.4-.5s1.5.5 2.4.5c1.3 0 2.6-.7 2.6-2.3 0-2.2-2.5-5.2-5-5.2Z" />
        </svg>`,
    LATE_CHECKOUT: /*html*/ `
        <svg class="${SERVICE_ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" />
        </svg>`,
    MASSAGE: /*html*/ `
        <svg class="${SERVICE_ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20c-4.5 0-8-3-8-7.5 3 0 5.5 1.6 8 4.6 2.5-3 5-4.6 8-4.6 0 4.5-3.5 7.5-8 7.5Z" /><path d="M12 17c-1.6-2-2.4-4-2.4-6.2S10.6 6.4 12 5c1.4 1.4 2.4 3.6 2.4 5.8S13.6 15 12 17Z" />
        </svg>`,
};

const ROOM_AMENITIES: Readonly<Record<string, readonly RoomAmenity[]>> = {
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

const ROOM_IMAGE_BUCKET = 'room-images';

const FORM_INCOMPLETE = 'Bitte tragen Sie alle notwendigen Informationen ein.';
const CHECKOUT_LABEL = 'zahlungspflichtig buchen';
const CHECKOUT_BUSY_LABEL = 'Buchung wird gesendet …';

// Eingabefelder und Auswahl im Adressformular – `aria-invalid` markiert, was beim Klick
// auf „zahlungspflichtig buchen" fehlte.
const FIELD_CLASSES =
    'w-full min-w-0 rounded-[0.3125rem] border-[0.5px] border-purple-haze bg-purple-haze-light/45 p-2 font-antic-didone text-18 456:text-20 leading-tight text-purple-haze-dark focus:outline-none focus:ring-2 focus:ring-purple-haze/40 aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-600';

type AddressSample = {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
};

// Beispielwerte für die Platzhalter: kurz genug für die schmalen Felder (PLZ, Hausnummer)
// und erkennbar erfunden (`beispiel.at`, „Beispiel GmbH").
const RESIDENCE_SAMPLE: AddressSample = { street: 'Hauptplatz', houseNumber: '12a', postalCode: '9500', city: 'Villach' };
const BILLING_SAMPLE: AddressSample = { street: 'Ringstraße', houseNumber: '5', postalCode: '1010', city: 'Wien' };

/** Welches Formularfeld zu welchem Eintrag aus `getInvalidFields()` gehört. */
const FIELD_NAMES: Record<InvalidField, string> = {
    'customer.firstName': 'vorname',
    'customer.lastName': 'nachname',
    'customer.email': 'email',
    'residence.street': 'strasse',
    'residence.houseNumber': 'hausnummer',
    'residence.postalCode': 'plz',
    'residence.city': 'ort',
    'residence.countryCode': 'land',
    'billing.street': 'rechnung-strasse',
    'billing.houseNumber': 'rechnung-hausnummer',
    'billing.postalCode': 'rechnung-plz',
    'billing.city': 'rechnung-ort',
    'billing.countryCode': 'rechnung-land',
};

export class BookingView extends AbstractView {
    private readonly today: Date;
    private displayedYear: number;
    private displayedMonth: number;
    private calendarEl: HTMLElement | null = null;
    private roomsEl: HTMLElement | null = null;
    private customerFormEl: HTMLFormElement | null = null;
    private readonly guests: Record<GuestField, number | null> = { adults: null, children: null };
    private rooms: RoomCard[] = [];
    // `null` heißt: für dieses Hotel ist kein Frühstück hinterlegt. Dann wird auch keins
    // angeboten – `create_booking` würde eine Buchung mit Frühstück ablehnen (E25), und
    // eine Checkbox, die in eine Ablehnung führt, ist eine Falle.
    private breakfastService: BreakfastService | null = null;
    // Leistungen je Vorgang aus `services`, ohne Frühstück, nach `sort_order` (E49).
    private extraServices: ExtraService[] = [];
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
    private summaryEl: HTMLElement | null = null;
    private unsubscribeSummary: (() => void) | null = null;
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
        return /*html*/ `
            <section class="px-3 py-10 768:py-16">
                <div class="w-full max-w-300 mx-auto bg-eggshell rounded-3xl shadow-pic p-4 456:p-6 768:p-10">
                    ${this.getGuestsHtml()}
                    <div id="booking-calendar"></div>
                </div>
                <div id="booking-rooms" class="w-full max-w-212 mx-auto mt-10 768:mt-16"></div>
            </section>
            ${this.getCheckoutHtml()}
        `;
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
        this.unsubscribeSummary?.();
        this.unsubscribeSummary = bookingState.subscribe((): void => {
            this.renderSummary();
        });
        this.renderSummary();
        void this.loadHotel();

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
                <div id="booking-guests" class="flex flex-col 576:flex-row 576:items-start 576:justify-center gap-4 768:gap-8">
                    ${this.getGuestFieldHtml('adults', 'Erwachsene', 'Anzahl der Erwachsenen', buildAdultOptions(), ADULT_ICON)}
                    ${this.getGuestFieldHtml('children', 'Keine Kinder', 'Anzahl der Kinder', buildChildOptions(), CHILD_ICON)}
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

        // Nur die Erwachsenenzahl ist Pflicht (Kinder: leer = keine Kinder), also hängt
        // auch nur an diesem Feld eine Hinweiszeile.
        const notice = field === 'adults' ? /*html*/ `<p data-guests-notice aria-live="polite" class="font-antic-didone text-14 leading-tight text-red-600"></p>` : '';

        return /*html*/ `
            <div class="flex flex-col gap-1.5">
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
            ${notice}
            </div>
        `;
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
        const isMissing = checkIn !== null && checkOut !== null && this.guests.adults === null;
        noticeEl.textContent = isMissing ? 'Bitte wählen Sie die Anzahl der Erwachsenen.' : '';
    }

    private handleGuestChange(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;

        const field = target.dataset.guests;
        if (field !== 'adults' && field !== 'children') return;

        this.guests[field] = target.value === '' ? null : Number(target.value);
        this.renderGuestsNotice();
        // Der weiter-Knopf hängt jetzt mit an der Belegung.
        this.renderCalendar();
        void this.loadRooms();
    }

    private renderRooms(): void {
        if (!this.roomsEl) return;
        this.roomsEl.innerHTML = this.getRoomsBodyHtml();
        // Neue Preise oder eine neue Belegung ändern die Zusammenfassung, ohne dass sich
        // in `bookingState` etwas rührt.
        this.renderSummary();
    }

    private getRoomsBodyHtml(): string {
        switch (this.roomsState) {
            case 'loading':
                return this.getRoomsNoticeHtml('Zimmer werden geladen …');
            case 'error':
                return this.getRoomsNoticeHtml(`Die Zimmer konnten nicht geladen werden: ${this.roomsError ?? 'Unbekannter Fehler'}`);
            case 'ready':
                if (this.rooms.length === 0) {
                    return this.getRoomsNoticeHtml('Zurzeit sind keine Zimmerkategorien hinterlegt.');
                }
                return /*html*/ `
                    ${this.getQuantityNoticeHtml()}
                    <div class="flex flex-col gap-8 768:gap-11">
                        ${this.rooms.map((room: RoomCard): string => this.getRoomCardHtml(room)).join('')}
                    </div>
                    <p data-capacity-notice role="status" aria-live="polite" class="${this.getCapacityText() === '' ? 'hidden' : ''} mt-8 768:mt-11 rounded-[0.625rem] border border-purple-haze bg-purple-haze-light px-4 py-3 font-antic-didone text-16 leading-tight text-purple-haze-dark">${this.getCapacityText()}</p>
                    ${this.getServicesSectionHtml()}
                `;
        }
    }

    private getQuantityNoticeHtml(): string {
        if (this.quantityNotice === null) return '';

        return /*html*/ `
            <p role="status" class="mb-8 768:mb-11 rounded-[0.625rem] border border-purple-haze bg-purple-haze-light px-4 py-3 font-antic-didone text-16 leading-tight text-purple-haze-dark">
                ${this.quantityNotice}
            </p>
        `;
    }

    private getRoomsNoticeHtml(message: string): string {
        return /*html*/ `<p class="font-antic-didone text-18 768:text-20 text-purple-haze-dark/70">${message}</p>`;
    }

    private getRoomCardHtml(room: RoomCard): string {
        const amenities = ROOM_AMENITIES[room.slug] ?? [];
        const isBookable = room.availability === null || room.availability.isBookable;

        const amenitiesHtml =
            amenities.length === 0
                ? ''
                : /*html*/ `
                    <ul class="grid gap-3 576:grid-cols-2 576:gap-x-16">
                        ${amenities
                            .map(
                                (amenity: RoomAmenity): string => /*html*/ `
                                    <li class="flex items-center gap-2.5 font-antic-didone text-16 text-purple-haze-dark">
                                        ${amenity.icon}
                                        <span>${amenity.label}</span>
                                    </li>
                                `,
                            )
                            .join('')}
                    </ul>
                `;

        const description = room.description === null ? '' : /*html*/ `<p class="font-antic-didone text-18 768:text-20 text-purple-haze-dark">${room.description}</p>`;
        const isSelected = bookingState.getRoomQuantity(room.roomTypeId) > 0;

        return /*html*/ `
            <article data-room-card="${room.roomTypeId}" class="flex flex-col 768:flex-row overflow-hidden ${isBookable ? '' : 'opacity-60'} ${isSelected ? 'ring-2 ring-purple-haze' : ''}">
                ${this.getRoomImageHtml(room)}
                <div class="flex-1 flex flex-col justify-center gap-3 bg-purple-haze-light px-5 py-6 768:px-8 768:py-8">
                    ${amenitiesHtml}
                    ${description}
                    ${this.getRoomQuantityHtml(room)}
                    ${getAvailabilityHtml(room.availability)}
                </div>
            </article>
        `;
    }

    /**
     * Mengenwähler der Karte: `−` / Zahl / `+`.
     *
     * Die nativen Spinner des Zahlenfeldes sind ausgeblendet (`booking.css`) — dasselbe
     * Muster wie beim Gäste-`select` mit eigenem Chevron.
     */
    private getRoomQuantityHtml(room: RoomCard): string {
        const availability = room.availability;

        // Ohne Zeitraum und Belegung kennt niemand `rooms_free`. Ein Feld ohne geprüfte
        // Obergrenze würde eine Menge versprechen, die es nicht geben muss.
        if (availability === null) {
            const hint = this.getMissingSelectionHint();
            return hint === '' ? '' : /*html*/ `<p class="font-antic-didone text-16 text-purple-haze-dark/70">${hint}</p>`;
        }

        // Nicht buchbare Kategorien zeigen ihren Grund (Zeile darunter), keinen Wähler.
        if (!availability.isBookable) return '';

        const quantity = bookingState.getRoomQuantity(room.roomTypeId);
        const otherRooms = getTotalRooms(bookingState.getRoomQuantities()) - quantity;
        const max = getRoomMax(availability.roomsFree, otherRooms, getRoomLimit(this.guests.adults));
        const inputId = `booking-rooms-${room.slug}`;

        return /*html*/ `
            <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between gap-4">
                    <label for="${inputId}" class="font-playfair-display font-medium text-16 768:text-18 leading-tight text-purple-haze-dark">Anzahl Zimmer</label>
                    <div class="flex items-center gap-2">
                        ${this.getQuantityStepHtml(room, -1, `Ein Zimmer weniger – ${room.name}`, '&minus;', quantity === 0)}
                        <input
                            id="${inputId}"
                            data-room-quantity="${room.roomTypeId}"
                            type="number"
                            inputmode="numeric"
                            min="0"
                            max="${max.toString()}"
                            step="1"
                            value="${quantity.toString()}"
                            class="booking__quantity w-16 456:w-20 appearance-none rounded-xl border border-purple-haze bg-white px-2 py-2 font-antic-didone text-18 456:text-24 leading-tight text-center text-purple-haze-dark transition-colors hover:bg-purple-haze-light focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
                        />
                        ${this.getQuantityStepHtml(room, 1, `Ein Zimmer mehr – ${room.name}`, '+', quantity >= (availability.roomsFree ?? 0))}
                    </div>
                </div>
                <p data-room-quantity-notice="${room.roomTypeId}" aria-live="polite" class="font-antic-didone text-14 leading-tight text-purple-haze text-right"></p>
            </div>
        `;
    }

    /**
     * Sektion „Zusatzleistungen" unter der Zimmerliste (E47–E49).
     *
     * Das Frühstück steht als erste Zeile darin: Seit die Belegung eine Gesamtzahl ist,
     * gilt es wie alle anderen Leistungen für den ganzen Vorgang (E48). Die Gestaltung
     * folgt der Zimmerkarte – heller Lila-Grund, Ring bei Auswahl.
     */
    private getServicesSectionHtml(): string {
        if (this.breakfastService === null && this.extraServices.length === 0) return '';

        const hasRooms = getTotalRooms(bookingState.getRoomQuantities()) > 0;

        return /*html*/ `
            <section aria-labelledby="booking-services-title" class="mt-10 768:mt-16">
                <h2 id="booking-services-title" class="font-playfair-display text-28 768:text-36 text-purple-haze-dark text-center mb-2">Zusatzleistungen</h2>
                <p class="font-antic-didone text-16 768:text-18 leading-tight text-purple-haze-dark/70 text-center mb-6 768:mb-8">
                    Gilt einmal für Ihren gesamten Aufenthalt – unabhängig von der Zimmeranzahl.
                </p>
                <p data-services-hint class="${hasRooms ? 'hidden' : ''} mb-4 font-antic-didone text-16 text-purple-haze text-center">Bitte zuerst ein Zimmer wählen.</p>
                <ul class="flex flex-col gap-4 768:gap-5">
                    ${this.getBreakfastRowHtml()}
                    ${this.extraServices.map((service: ExtraService): string => this.getServiceRowHtml(service)).join('')}
                </ul>
            </section>
        `;
    }

    /** Eine Zeile der Sektion – Icon, Text, Preis und das Bedienelement rechts. */
    private getServiceRowShellHtml(code: string, inputId: string, name: string, description: string | null, label: string, control: string, selected: boolean): string {
        const descriptionHtml = description === null ? '' : /*html*/ `<p class="font-antic-didone text-14 768:text-16 leading-tight text-purple-haze-dark/80">${description}</p>`;

        return /*html*/ `
            <li data-service-row="${code}" class="flex items-center gap-4 bg-purple-haze-light px-5 py-4 768:px-8 768:py-5 ${selected ? 'ring-2 ring-purple-haze' : ''}">
                ${SERVICE_ICONS[code] ?? ''}
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                    <label for="${inputId}" class="font-playfair-display font-medium text-16 768:text-18 leading-tight text-purple-haze-dark cursor-pointer">${name}</label>
                    ${descriptionHtml}
                    <p data-service-amount="${code}" aria-live="polite" class="font-antic-didone text-14 leading-tight text-purple-haze">${label}</p>
                </div>
                ${control}
            </li>
        `;
    }

    private getCheckboxHtml(inputId: string, dataAttribute: string, checked: boolean, disabled: boolean): string {
        return /*html*/ `
            <input
                id="${inputId}"
                ${dataAttribute}
                type="checkbox"
                ${checked ? 'checked' : ''}
                ${disabled ? 'disabled' : ''}
                class="shrink-0 w-5 h-5 accent-purple-haze cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
            />
        `;
    }

    private getBreakfastRowHtml(): string {
        const service = this.breakfastService;
        if (service === null) return '';

        const checked = bookingState.getBreakfast();
        const disabled = getTotalRooms(bookingState.getRoomQuantities()) === 0;
        const control = this.getCheckboxHtml('booking-breakfast', 'data-breakfast', checked, disabled);
        return this.getServiceRowShellHtml('BREAKFAST', 'booking-breakfast', `${service.name} für alle Gäste`, service.description, this.getBreakfastLabel(), control, checked);
    }

    private getServiceRowHtml(service: ExtraService): string {
        const quantity = bookingState.getServiceQuantity(service.code);
        const max = getServiceMax(service, this.getServiceContext());
        const inputId = `booking-service-${service.code.toLowerCase()}`;

        const control =
            service.chargeBasis === 'per_unit'
                ? /*html*/ `
                    <div class="shrink-0 flex items-center gap-2">
                        ${this.getServiceStepHtml(service, -1, '&minus;', quantity === 0)}
                        <output id="${inputId}" data-service-quantity="${service.code}" aria-live="polite" class="w-8 text-center font-antic-didone text-18 456:text-24 leading-tight text-purple-haze-dark">${quantity.toString()}</output>
                        ${this.getServiceStepHtml(service, 1, '+', quantity >= max)}
                    </div>
                `
                : this.getCheckboxHtml(inputId, `data-service-code="${service.code}"`, quantity > 0, max === 0);

        return this.getServiceRowShellHtml(service.code, inputId, service.name, service.description, this.getServiceLabel(service), control, quantity > 0);
    }

    private getServiceStepHtml(service: ExtraService, step: number, glyph: string, disabled: boolean): string {
        const ariaLabel = `${service.name}: ${step > 0 ? 'eines mehr' : 'eines weniger'}`;
        return /*html*/ `
            <button
                type="button"
                data-service-step="${step.toString()}"
                data-service-code="${service.code}"
                aria-label="${ariaLabel}"
                ${disabled ? 'disabled' : ''}
                class="shrink-0 flex items-center justify-center w-9 h-9 456:w-10 456:h-10 rounded-full bg-purple-haze font-antic-didone text-24 leading-none text-white cursor-pointer transition-colors hover:bg-purple-haze-dark focus:outline-none focus:ring-2 focus:ring-purple-haze/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-haze"
            >${glyph}</button>
        `;
    }

    private getServiceContext(): { rooms: number; children: number } {
        return { rooms: getTotalRooms(bookingState.getRoomQuantities()), children: this.guests.children ?? 0 };
    }

    /** Alle Kategorien haben denselben Zeitraum und damit dieselbe Zahl an Nächten. */
    private getNights(): number | undefined {
        return this.rooms.find((room: RoomCard): boolean => room.availability !== null)?.availability?.nights;
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
        const preise = `${perAdult} pro Erwachsenem, ${perChild} pro Kind und Nacht`;

        const nights = this.getNights();
        if (nights === undefined || !bookingState.getBreakfast()) return preise;

        const occupancy = { adults: this.guests.adults ?? 0, children: this.guests.children ?? 0 };
        const amount = getBreakfastAmountCents(service, occupancy, nights);
        return `+ ${formatPrice(amount, service.currency)} · ${preise}`;
    }

    /** Dasselbe für eine Leistung je Vorgang: Einheit vor der Wahl, Aufschlag danach. */
    private getServiceLabel(service: ExtraService): string {
        const unitPrice = service.unitAmountCents === 0 ? 'kostenlos' : formatPrice(service.unitAmountCents, service.currency);
        const quantity = bookingState.getServiceQuantity(service.code);

        if (service.code === CHILD_BED) {
            if ((this.guests.children ?? 0) === 0) return 'Nur mit Kind buchbar';
            const max = getServiceMax(service, this.getServiceContext());
            const grenze = max > 1 ? `bis zu ${max.toString()}, 1 je Zimmer` : '1 je Zimmer';
            return `${unitPrice} · ${grenze}`;
        }

        const einheit = service.chargeBasis === 'per_night' ? `${unitPrice} pro Nacht` : service.unitAmountCents === 0 ? unitPrice : `${unitPrice} einmalig`;
        const nights = this.getNights();
        if (quantity === 0 || nights === undefined || service.unitAmountCents === 0) return einheit;

        const amount = formatPrice(getServiceAmountCents(service, quantity, nights), service.currency);
        return service.chargeBasis === 'per_night' ? `+ ${amount} für ${formatNights(nights)} · ${einheit}` : `+ ${amount}`;
    }

    /**
     * Hinweis unter der Liste, solange die gewählten Zimmer nicht für alle Gäste reichen (E48).
     *
     * Kein Fehler, sondern der nächste Schritt: Wer zwei Zimmer braucht, wählt erst eines
     * und dann das zweite – dazwischen soll dort stehen, was noch fehlt.
     */
    private getCapacityText(): string {
        const adults = this.guests.adults;
        const quantities = bookingState.getRoomQuantities();
        if (adults === null || getTotalRooms(quantities) === 0) return '';

        const missing = getMissingBeds(quantities, this.rooms, adults + (this.guests.children ?? 0));
        if (missing === 0) return '';
        return missing === 1 ? 'Noch 1 Person ohne Bett – bitte ein weiteres Zimmer wählen.' : `Noch ${missing.toString()} Personen ohne Bett – bitte weitere Zimmer wählen.`;
    }

    /** Der Wähler hat zwei Vorbedingungen: einen Zeitraum und eine Belegung (V16.7 — kein stiller Suchdefault). */
    private getMissingSelectionHint(): string {
        const { checkIn, checkOut } = bookingState.getDates();
        const needsDates = checkIn === null || checkOut === null;
        const needsGuests = this.guests.adults === null;

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
    private getQuantityStepHtml(room: RoomCard, step: number, ariaLabel: string, glyph: string, disabled: boolean): string {
        return /*html*/ `
            <button
                type="button"
                data-room-step="${step.toString()}"
                data-room-type="${room.roomTypeId}"
                aria-label="${ariaLabel}"
                ${disabled ? 'disabled' : ''}
                class="shrink-0 flex items-center justify-center w-9 h-9 456:w-10 456:h-10 rounded-full bg-purple-haze font-antic-didone text-24 leading-none text-white cursor-pointer transition-colors hover:bg-purple-haze-dark focus:outline-none focus:ring-2 focus:ring-purple-haze/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-haze"
            >${glyph}</button>
        `;
    }

    private handleRoomsClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;

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
        const room = this.rooms.find((candidate: RoomCard): boolean => candidate.roomTypeId === roomTypeId);
        const availability = room?.availability;
        if (!availability?.isBookable) return;

        const otherRooms = getTotalRooms(bookingState.getRoomQuantities()) - bookingState.getRoomQuantity(roomTypeId);
        const roomLimit = getRoomLimit(this.guests.adults);
        const clamped = clampQuantity(desired, availability.roomsFree, otherRooms, roomLimit);
        bookingState.setRoomQuantity(roomTypeId, clamped.value);
        // Weniger Zimmer können das Kinderbett-Maximum senken (1 je Zimmer, E49).
        bookingState.setServices(reconcileServices(bookingState.getServices(), this.extraServices, this.getServiceContext()));

        // Der Gast soll sofort erfahren, warum es nicht weitergeht — nicht erst beim Absenden.
        const message = desired > clamped.value ? getLimitMessage(clamped.limitedBy, availability.roomsFree, roomLimit) : null;
        this.updateQuantityUi(message === null ? null : { roomTypeId, message });
    }

    private setServiceQuantity(code: string, desired: number): void {
        const service = this.extraServices.find((candidate: ExtraService): boolean => candidate.code === code);
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
        const roomLimit = getRoomLimit(this.guests.adults);

        this.rooms.forEach((room: RoomCard): void => {
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
            const text = this.getCapacityText();
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

        const markRow = (code: string, selected: boolean, label: string): void => {
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
        markRow('BREAKFAST', bookingState.getBreakfast(), this.getBreakfastLabel());

        const context = this.getServiceContext();
        this.extraServices.forEach((service: ExtraService): void => {
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

            markRow(service.code, quantity > 0, this.getServiceLabel(service));
        });
    }

    private getRoomImageHtml(room: RoomCard): string {
        const image =
            room.imageUrl === null
                ? /*html*/ `<div class="absolute inset-0 bg-purple-haze-dark"></div>`
                : /*html*/ `<img src="${room.imageUrl}" alt="${room.imageAlt}" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />`;

        return /*html*/ `
            <div class="relative shrink-0 768:w-76 aspect-[304/321]">
                ${image}
                <div class="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-purple-haze/75 to-90%"></div>
                ${room.availability?.priceLabel == null ? '' : /*html*/ `<span class="absolute top-4 right-0 bg-purple-haze px-4 py-1 font-antic-didone text-20 768:text-24 text-white">${room.availability.priceLabel}</span>`}
                <h3 class="absolute left-4 bottom-4 right-4 font-playfair-display font-medium text-32 768:text-36 leading-tight text-eggshell break-words">${room.name}</h3>
            </div>
        `;
    }

    /**
     * Abschluss-Sektion aus dem Design ("BuchungAbschließen"): Kontaktdaten und Adressen
     * links, Zusammenfassung rechts.
     *
     * Die Zusammenfassung folgt `bookingState`, der Gästeauswahl, den Preisen aus
     * `search_availability` und der Eingabe links (Phase 9b, Punkte 4–5).
     */
    private getCheckoutHtml(): string {
        return /*html*/ `
            <section class="bg-purple-haze-light px-3 py-10 768:py-16">
                <div class="w-full max-w-268 mx-auto flex flex-col gap-10 992:flex-row 992:items-start 992:justify-between 992:gap-8">
                    ${this.getCustomerFormHtml()}
                    ${this.getBookingSummaryHtml()}
                </div>
            </section>
        `;
    }

    /**
     * Kontaktdaten, Wohnadresse und – per Checkbox – eine abweichende Rechnungsadresse
     * (E50, E51). Der Rechnungsblock bleibt im DOM und wird nur ausgeblendet: Wer die
     * Checkbox versehentlich abwählt, verliert seine Eingabe nicht. In den Entwurf geht
     * er trotzdem nur, solange die Checkbox an ist.
     */
    private getCustomerFormHtml(): string {
        return /*html*/ `
            <div class="w-full 992:max-w-[31.0625rem] flex flex-col gap-5">
                <div class="flex flex-col gap-2">
                    <h2 class="font-playfair-display text-28 768:text-36 leading-none text-purple-haze-dark">Ihre Daten</h2>
                    <p class="font-antic-didone text-16 leading-tight text-purple-haze-dark">Die Rechnung geht an Ihre Wohnadresse – außer Sie geben eine abweichende Rechnungsadresse an.</p>
                </div>
                <form id="booking-customer" novalidate class="flex flex-col gap-8 rounded-[0.625rem] border-[0.5px] border-purple-haze bg-[#fbfbfb] px-5 py-4">
                    <div class="flex flex-col gap-3">
                        ${this.getBillingFieldHtml('vorname', 'Vorname', 'Maria', 'given-name', 'text', 'w-full')}
                        ${this.getBillingFieldHtml('nachname', 'Nachname', 'Huber', 'family-name', 'text', 'w-full')}
                    </div>
                    <div class="flex flex-col gap-3">
                        ${this.getBillingFieldHtml('email', 'E-Mail', 'maria.huber@beispiel.at', 'email', 'email', 'w-full')}
                        ${this.getBillingFieldHtml('telefon', 'Telefon (optional)', '+43 660 1234567', 'tel', 'tel', 'w-full', false)}
                    </div>
                    <fieldset class="flex flex-col gap-3">
                        <legend class="mb-3 font-playfair-display font-medium text-20 leading-tight text-purple-haze-dark">Wohnadresse</legend>
                        ${this.getAddressFieldsHtml('', '', RESIDENCE_SAMPLE)}
                    </fieldset>

                    <label class="flex items-center gap-3 cursor-pointer font-antic-didone text-16 leading-tight text-purple-haze-dark">
                        <input type="checkbox" name="rechnung-abweichend" data-billing-toggle class="w-5 h-5 shrink-0 accent-purple-haze cursor-pointer" />
                        Rechnungsadresse weicht von der Wohnadresse ab
                    </label>

                    <fieldset id="booking-billing" hidden class="flex flex-col gap-3">
                        <legend class="mb-3 font-playfair-display font-medium text-20 leading-tight text-purple-haze-dark">Rechnungsadresse</legend>
                        ${this.getBillingFieldHtml('rechnung-firma', 'Firma / z. Hd. (optional)', 'Beispiel GmbH', 'billing organization', 'text', 'w-full', false)}
                        ${this.getAddressFieldsHtml('rechnung-', 'billing ', BILLING_SAMPLE)}
                    </fieldset>
                </form>
            </div>
        `;
    }

    /**
     * Straße bis Land – für Wohn- und Rechnungsadresse dieselben Felder, nur mit Präfix.
     * Die Beispiele unterscheiden sich, damit die beiden Blöcke nicht wie eine Kopie wirken.
     */
    private getAddressFieldsHtml(prefix: string, autocompleteSection: string, sample: AddressSample): string {
        return /*html*/ `
            ${this.getBillingFieldHtml(`${prefix}strasse`, 'Straße', sample.street, `${autocompleteSection}address-line1`, 'text', 'w-full')}
            <div class="flex gap-3 576:gap-8">
                ${this.getBillingFieldHtml(`${prefix}hausnummer`, 'Hausnummer', sample.houseNumber, `${autocompleteSection}address-line2`, 'text', 'flex-1 min-w-0 576:w-46 576:flex-none')}
                ${this.getBillingFieldHtml(`${prefix}plz`, 'PLZ', sample.postalCode, `${autocompleteSection}postal-code`, 'text', 'w-20 shrink-0 576:w-[4.3125rem]')}
                ${this.getBillingFieldHtml(`${prefix}ort`, 'Ort', sample.city, `${autocompleteSection}address-level2`, 'text', 'flex-1 min-w-0')}
            </div>
            ${this.getCountryFieldHtml(`${prefix}land`, `${autocompleteSection}country`)}
        `;
    }

    /**
     * Das Beispiel steht als `placeholder` im Feld, nicht als `value` – die Eingabe bleibt
     * leer, und der Gast muss nichts löschen. Grau statt in der Schriftfarbe der Eingabe,
     * damit ein leeres Feld nicht wie ein ausgefülltes aussieht.
     */
    private getBillingFieldHtml(id: string, label: string, sample: string, autocomplete: string, type: string, widthClass: string, required = true): string {
        return /*html*/ `
            <div class="flex flex-col ${widthClass}">
                <label for="booking-${id}" class="font-playfair-display font-medium text-16 leading-tight text-purple-haze">${label}</label>
                <input
                    id="booking-${id}"
                    name="${id}"
                    type="${type}"
                    autocomplete="${autocomplete}"
                    placeholder="${sample}"
                    ${required ? 'aria-required="true"' : ''}
                    class="${FIELD_CLASSES} placeholder:text-gray-500"
                />
            </div>
        `;
    }

    /** Land als Auswahl statt Freitext (E42): „Österreich"/„AT"/„Oesterreich" wären drei Länder. */
    private getCountryFieldHtml(id: string, autocomplete: string): string {
        const options = COUNTRIES.map(
            (country: (typeof COUNTRIES)[number]): string =>
                /*html*/ `<option value="${country.code}" ${country.code === DEFAULT_COUNTRY ? 'selected' : ''}>${country.label}</option>`,
        ).join('');

        return /*html*/ `
            <div class="flex flex-col w-full 576:w-[16.1875rem]">
                <label for="booking-${id}" class="font-playfair-display font-medium text-16 leading-tight text-purple-haze">Land</label>
                <select id="booking-${id}" name="${id}" autocomplete="${autocomplete}" aria-required="true" class="${FIELD_CLASSES} cursor-pointer">
                    ${options}
                </select>
            </div>
        `;
    }

    /**
     * Das Gerüst von „Ihre Buchung". Was sich mit der Auswahl ändert, füllt
     * `renderSummary()` in `#booking-summary-order` und `[data-summary-total]`; Name und
     * Adressen kommen aus `renderCustomerSummary()`.
     */
    private getBookingSummaryHtml(): string {
        return /*html*/ `
            <div id="booking-summary" class="w-full 992:max-w-[33.8125rem] flex flex-col gap-5 rounded-[0.8125rem] border-[0.5px] border-purple-haze bg-[#fbfbfb] p-5">
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
                            ${CHECKOUT_LABEL}
                        </button>
                        <div class="flex flex-col gap-4 text-center">
                            <p class="font-antic-didone text-14 leading-tight text-[#74687e]">Ich bestätige, dass ich die Datenschutzvereinbarung gelesen habe.</p>
                            <p id="booking-checkout-error" hidden role="alert" class="font-antic-didone text-[0.8125rem] leading-tight text-red-600">Bitte tragen Sie alle notwendigen Informationen ein.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Baut den veränderlichen Teil von „Ihre Buchung" neu auf.
     *
     * Ein kompletter Neuaufbau ist hier unbedenklich – anders als in der Zimmerliste gibt
     * es in der Zusammenfassung kein Feld, in dem gerade getippt wird.
     */
    private renderSummary(): void {
        // Kein Destroy-Hook: Nach einem Seitenwechsel meldet sich die View hier selbst ab.
        if (this.summaryEl?.isConnected !== true) {
            this.unsubscribeSummary?.();
            this.unsubscribeSummary = null;
            return;
        }

        const orderEl = document.getElementById('booking-summary-order');
        if (!orderEl) return;

        const lines = this.getOrderLines();
        orderEl.innerHTML = /*html*/ `
            ${this.getHotelAddressHtml()}
            ${this.getSummaryRoomsHtml()}
            <div class="flex flex-col gap-6 768:gap-10">
                ${this.getStayHtml()}
                ${lines.length === 0 ? '' : /*html*/ `<div class="flex flex-col gap-4">${lines.map((line: OrderLine): string => this.getOrderRowHtml(line)).join('')}</div>`}
            </div>
        `;

        const totalEl = this.summaryEl.querySelector<HTMLElement>('[data-summary-total]');
        if (totalEl) {
            const total = getOrderTotalCents(lines);
            totalEl.textContent = total === null ? '–' : formatPrice(total, lines[0]?.currency ?? 'EUR');
        }
    }

    private getOrderLines(): OrderLine[] {
        const { checkIn, checkOut } = bookingState.getDates();
        return buildOrderLines({
            rooms: this.rooms,
            quantities: bookingState.getRoomQuantities(),
            nights: countNights(checkIn, checkOut),
            occupancy: { adults: this.guests.adults ?? 0, children: this.guests.children ?? 0 },
            breakfast: this.breakfastService,
            withBreakfast: bookingState.getBreakfast(),
            services: this.extraServices,
            serviceQuantities: bookingState.getServices(),
        });
    }

    /** Hoteladresse aus `hotels` statt aus dem Entwurf – dort stand eine erfundene. */
    private getHotelAddressHtml(): string {
        const hotel = this.hotel;
        if (hotel === null) return '';

        const country = hotel.country_code === null ? '' : isCountryCode(hotel.country_code) ? getCountryLabel(hotel.country_code) : hotel.country_code;
        const lines = [hotel.name, hotel.address_line1 ?? '', `${hotel.postal_code ?? ''} ${hotel.city ?? ''}`.trim(), country].filter((line: string): boolean => line !== '');

        return /*html*/ `
            <div class="flex flex-col gap-4">
                <address class="not-italic font-antic-didone text-16 leading-tight text-purple-haze-dark">${lines.join('<br>')}</address>
                <hr class="border-t-[0.5px] border-purple-haze/45">
            </div>
        `;
    }

    /** Bild, Name und Ausstattung je gewählter Kategorie – der Block aus dem Entwurf, einmal je Kategorie. */
    private getSummaryRoomsHtml(): string {
        const selected = this.rooms.filter((room: RoomCard): boolean => bookingState.getRoomQuantity(room.roomTypeId) > 0);
        if (selected.length === 0) {
            return /*html*/ `<p class="font-antic-didone text-16 leading-tight text-purple-haze-dark/70">Noch kein Zimmer gewählt.</p>`;
        }

        return /*html*/ `
            <ul class="flex flex-col gap-4">
                ${selected
                    .map((room: RoomCard): string => {
                        // Das Bild ist Schmuck: Der Name steht direkt daneben.
                        const image =
                            room.imageUrl === null
                                ? /*html*/ `<div class="shrink-0 w-24 h-18 rounded-[0.6875rem] bg-purple-haze-dark"></div>`
                                : /*html*/ `<img src="${room.imageUrl}" alt="" loading="lazy" class="shrink-0 w-24 h-18 rounded-[0.6875rem] object-cover" />`;
                        const amenities = (ROOM_AMENITIES[room.slug] ?? []).map((amenity: RoomAmenity): string => amenity.label).join(' · ');

                        return /*html*/ `
                            <li class="flex items-center gap-4">
                                ${image}
                                <div class="flex flex-col gap-3 font-antic-didone text-16 leading-tight text-purple-haze-dark">
                                    <span class="font-playfair-display font-medium">${room.name}</span>
                                    ${amenities === '' ? '' : /*html*/ `<span>${amenities}</span>`}
                                </div>
                            </li>
                        `;
                    })
                    .join('')}
            </ul>
        `;
    }

    /** Check-in/Check-out mit den Uhrzeiten aus `hotels`, darunter Belegung und Nächte. */
    private getStayHtml(): string {
        const { checkIn, checkOut } = bookingState.getDates();
        const nights = countNights(checkIn, checkOut);

        const adults = this.guests.adults;
        const guests = adults === null ? 'Anzahl der Gäste noch offen' : formatGuests(adults, this.guests.children ?? 0);
        const stay = nights === null ? guests : `${guests} · ${formatNights(nights)}`;

        return /*html*/ `
            <div class="flex flex-col gap-3">
                <div class="flex flex-col 456:flex-row gap-4">
                    ${this.getCheckTileHtml('Check-in', formatStayDate(checkIn, 'ab', this.hotel?.check_in_time ?? null))}
                    ${this.getCheckTileHtml('Check-out', formatStayDate(checkOut, 'bis', this.hotel?.check_out_time ?? null))}
                </div>
                <p class="font-antic-didone text-16 leading-tight text-purple-haze-dark text-center">${stay}</p>
            </div>
        `;
    }

    private getCheckTileHtml(label: string, value: string): string {
        return /*html*/ `
            <div class="flex-1 flex items-center justify-center rounded-[0.625rem] bg-[#f6f2f2] p-3 text-center font-antic-didone text-16 leading-tight text-purple-haze-dark">
                <span>
                    <span class="block font-playfair-display font-medium">${label}</span>
                    ${value}
                </span>
            </div>
        `;
    }

    /** Eine Bestellzeile. Das Kreuz aus dem Entwurf entfernt sie: Zimmer auf 0, Leistung abgewählt. */
    private getOrderRowHtml(line: OrderLine): string {
        const detail = this.getOrderLineDetail(line);
        const detailHtml = detail === '' ? '' : /*html*/ `<span class="block font-antic-didone">${detail}</span>`;
        const price = line.amountCents === null ? '–' : line.amountCents === 0 ? 'kostenlos' : formatPrice(line.amountCents, line.currency);

        return /*html*/ `
            <div class="flex items-center justify-between gap-4 rounded-[0.625rem] border border-purple-haze p-3">
                <p class="font-playfair-display font-medium text-16 leading-tight text-purple-haze-dark">
                    ${line.name}
                    ${detailHtml}
                </p>
                <div class="flex shrink-0 items-center gap-2">
                    <span class="font-antic-didone text-20 768:text-24 leading-none text-purple-haze-dark">${price}</span>
                    <button
                        type="button"
                        data-summary-remove="${line.kind}"
                        data-summary-id="${line.id}"
                        aria-label="${line.name} entfernen"
                        class="shrink-0 rounded-full cursor-pointer transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-purple-haze/40"
                    >${ICON_REMOVE}</button>
                </div>
            </div>
        `;
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
                const service = this.extraServices.find((candidate: ExtraService): boolean => candidate.code === line.id);
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
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-summary-remove]');
        const id = button?.dataset.summaryId;
        if (!button || id === undefined) return;

        switch (button.dataset.summaryRemove) {
            case 'room':
                // Direkt statt über `setRoomQuantity()`: Entfernen muss auch gehen, wenn die
                // Kategorie gerade keine Verfügbarkeit hat (Zeitraum zurückgesetzt).
                bookingState.setRoomQuantity(id, 0);
                bookingState.setServices(reconcileServices(bookingState.getServices(), this.extraServices, this.getServiceContext()));
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

    /** Die eine Zeile aus `hotels` (E14). */
    private async loadHotel(): Promise<void> {
        const { data, error } = await supabase.from('hotels').select('name, address_line1, postal_code, city, country_code, check_in_time, check_out_time').limit(1).maybeSingle();
        if (error) return;

        this.hotel = data;
        this.renderSummary();
    }

    /**
     * Lädt die Zimmerkategorien – ohne gewählten Zeitraum nur die Stammdaten, mit
     * Zeitraum zusätzlich Preis und Verfügbarkeit aus `search_availability`.
     */
    private async loadRooms(): Promise<void> {
        const { checkIn, checkOut } = bookingState.getDates();
        const adults = this.guests.adults;

        const requestId = ++this.roomsRequestId;
        this.roomsState = 'loading';
        this.renderRooms();

        try {
            const [details, services, availability] = await Promise.all([
                supabase.from('room_types').select('id, name, slug, description, max_occupancy, room_type_images(storage_path, alt_text, sort_order)').order('name'),
                // Preise der Zusatzleistungen kommen aus der Datenbank, nicht als Konstante
                // aus dem Frontend – dasselbe Argument wie beim Buchungshorizont (E30). Ohne
                // `hotel_id`-Filter, weil es genau ein Hotel gibt; `search_availability`
                // nimmt oben dieselbe Abkürzung.
                supabase.from('services').select('id, code, name, description, charge_basis, amount_cents, child_amount_cents, currency, sort_order').order('sort_order'),
                // Ohne gewählte Erwachsenenzahl wird nicht gesucht: eine geratene Belegung
                // liefert Preise und Restbestände, die niemand bestellt hat (V16.7).
                checkIn === null || checkOut === null || adults === null
                    ? null
                    : supabase.rpc('search_availability', {
                          p_check_in: toISODate(checkIn),
                          p_check_out: toISODate(checkOut),
                          p_adults: adults,
                          // Leeres Kinderfeld heißt „keine Kinder" — das ist keine Vermutung,
                          // sondern die Abwesenheit von Kindern.
                          p_children: this.guests.children ?? 0,
                      }),
            ]);

            // Eine überholte Antwort darf das Ergebnis der aktuellen Suche nicht ersetzen.
            if (requestId !== this.roomsRequestId) return;

            if (details.error) throw new Error(details.error.message);
            if (availability !== null && availability.error) throw new Error(availability.error.message);
            if (services.error) throw new Error(services.error.message);

            this.rooms = buildRoomCards(details.data, availability === null ? null : (availability.data as RoomAvailability[]));
            const serviceRows = services.data as ServiceRow[];
            this.breakfastService = buildBreakfastService(serviceRows.find((row: ServiceRow): boolean => row.code === 'BREAKFAST') ?? null);
            this.extraServices = buildExtraServices(serviceRows);

            // Ein neues Suchergebnis kann gewählte Mengen unmöglich gemacht haben (V16.6).
            const reconciled = reconcileQuantities(bookingState.getRoomQuantities(), this.rooms, getRoomLimit(this.guests.adults));
            bookingState.setRoomQuantities(reconciled.quantities);
            this.quantityNotice = reconciled.notice;
            // … und damit auch die Leistungen: weniger Kinder, weniger Kinderbetten.
            bookingState.setServices(reconcileServices(bookingState.getServices(), this.extraServices, this.getServiceContext()));

            this.roomsState = 'ready';
            this.roomsError = null;
        } catch (error) {
            if (requestId !== this.roomsRequestId) return;
            this.roomsState = 'error';
            this.roomsError = error instanceof Error ? error.message : 'Unbekannter Fehler';
        }

        this.renderRooms();
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
        const canSubmit = checkIn !== null && checkOut !== null && this.guests.adults !== null;
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
                    void this.submit();
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
        this.renderGuestsNotice();
        void this.loadRooms();
    }

    private clearSelection(): void {
        bookingState.setDates(null, null);
        this.renderCalendar();
        this.renderGuestsNotice();
        void this.loadRooms();
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
        const message = this.getCheckoutError(draft, invalid);
        // In das Formular springen nur, wenn dort auch das Problem liegt – nicht, wenn
        // noch das Zimmer fehlt.
        this.markInvalidFields(invalid, message === FORM_INCOMPLETE);
        this.showCheckoutError(message);
        if (message !== null || checkIn === null || checkOut === null || nights === null || adults === null) return;

        const booking: Booking = { ...draft, checkIn, checkOut, nights, adults };

        this.setSubmitting(true);
        let result: Awaited<ReturnType<typeof createBooking>>;
        try {
            result = await createBooking(booking);
        } catch {
            // Nur bei einer unlesbaren Antwort – die Buchung kann trotzdem angelegt sein.
            // Deshalb kein „bitte erneut versuchen" und der Knopf bleibt gesperrt.
            this.showCheckoutError('Bei der Buchung ist ein unerwarteter Fehler aufgetreten. Bitte buchen Sie nicht erneut, sondern kontaktieren Sie uns.');
            return;
        }

        if (!result.ok) {
            this.setSubmitting(false);
            this.showCheckoutError(this.getRejectionMessage(result.error));
            // Eine Ablehnung heißt fast immer: Die Verfügbarkeit hat sich geändert. Die
            // neue Liste passt unmögliche Mengen an und sagt es über der Liste.
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
     * Übersetzt die Ablehnung aus `create_booking` in einen Satz mit Datum und Kategorie
     * (E31). Gäste bekommen die feinen Gründe maskiert als `nicht_buchbar` (E28).
     */
    private getRejectionMessage(error: BookingRejection): string {
        const room = this.rooms.find((card: RoomCard): boolean => card.roomTypeId === error.roomTypeId)?.name ?? null;
        const date = error.date === null ? null : formatStayDate(parseISODate(error.date), '', null);

        switch (error.code) {
            case 'nicht_buchbar':
            case 'ausgebucht':
            case 'kein_preis':
            case 'zu_klein': {
                const what = room ?? 'Ihre Auswahl';
                const when = date === null ? '' : ` für die Nacht vom ${date}`;
                return `${what} ist${when} leider nicht mehr buchbar. Wir haben die Verfügbarkeit aktualisiert – bitte prüfen Sie Ihre Auswahl.`;
            }
            case 'vergangenheit':
            case 'ausserhalb_horizont':
                return formatUnavailableReason(error.code);
            case 'ungueltiger_zeitraum':
                return 'Die Abreise muss nach der Anreise liegen.';
            case 'kategorie_unbekannt':
                return `${room ?? 'Diese Zimmerkategorie'} kann derzeit nicht gebucht werden.`;
            case 'ungueltige_belegung':
                return 'Die gewählten Zimmer passen nicht zur Anzahl der Gäste.';
            case 'ungueltige_leistung':
            case 'leistung_unbekannt':
                return 'Die gewählten Zusatzleistungen können so nicht gebucht werden.';
            case 'ungueltige_adresse':
                return 'Bitte prüfen Sie Ihre Adresse – sie ist unvollständig oder das Land wird nicht unterstützt.';
            default:
                return 'Die Buchung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.';
        }
    }

    /**
     * Bestätigungs-Popup nach E46. Genau ein Ausgang (V16): Button, Escape und Klick auf
     * den Hintergrund führen zur Startseite – ein Weg, der nur schließt, ließe den Gast
     * auf einem Formular zurück, dessen Buchung bereits getätigt ist.
     */
    private showConfirmation(booking: Booking, created: CreatedBooking): void {
        const references = created.bookings.map((room: { bookingReference: string }): string => room.bookingReference);
        const currency = created.bookings[0]?.currency ?? 'EUR';
        const stay = `${formatStayDate(parseISODate(booking.checkIn), '', null)} – ${formatStayDate(parseISODate(booking.checkOut), '', null)}`;

        openModal({
            labelledBy: 'booking-confirmation-title',
            // E46: Der Entwurf sagt hier „Bitte bestätigen Sie diese via erhaltener Email."
            // Eine Buchung ist aber sofort `confirmed` (E11), und eine Mail verschickt noch
            // niemand. Der Satz kommt zurück, sobald es die Bestätigungsmail gibt.
            html: /*html*/ `
                <div class="flex flex-col items-center gap-6 text-center text-purple-haze-dark">
                    <img src="${logo}" alt="" class="h-24 w-auto">
                    <h2 id="booking-confirmation-title" class="font-playfair-display text-28 768:text-36 leading-tight">Vielen Dank für Ihre Buchung.</h2>
                    <p class="font-antic-didone text-18 768:text-20 leading-snug">Ihre Buchung ist bestätigt.<br>Wir freuen uns auf Sie.</p>
                    <dl class="w-full flex flex-col gap-3 border-y-[0.5px] border-purple-haze/45 py-4 font-antic-didone text-16 768:text-18">
                        ${this.getConfirmationRowHtml(references.length === 1 ? 'Buchungsnummer' : 'Buchungsnummern', references.join('<br>'))}
                        ${this.getConfirmationRowHtml('Zeitraum', `${stay}<br>${formatNights(created.nights)}`)}
                        ${this.getConfirmationRowHtml('Gesamtpreis', formatPrice(created.grandTotalCents, currency))}
                    </dl>
                    <button type="button" data-modal-close class="w-full bg-purple-haze px-5 py-2.5 font-lato font-bold text-20 768:text-24 text-white opacity-85 hover:opacity-100 cursor-pointer">
                        zurück zur Homepage
                    </button>
                </div>
            `,
            onClose: (): void => {
                // Der Router hört auf `popstate` und rendert dann den neuen Pfad – derselbe
                // Weg wie beim Zurück-Knopf des Browsers, ohne den Router hierher zu reichen.
                history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
            },
        });
    }

    /** Werte kommen aus `create_booking` bzw. sind formatierte Zahlen – keine Eingaben des Gastes. */
    private getConfirmationRowHtml(label: string, value: string): string {
        return /*html*/ `
            <div class="flex items-start justify-between gap-4">
                <dt>${label}</dt>
                <dd class="text-right font-lato font-bold tracking-wide">${value}</dd>
            </div>
        `;
    }

    /**
     * Was vor dem Buchen noch fehlt (Phase 9b, Punkt 7) – in der Reihenfolge der Seite,
     * damit der Gast von oben nach unten arbeiten kann. `null` heißt: alles da.
     */
    private getCheckoutError(draft: BookingDraft, invalid: readonly InvalidField[]): string | null {
        if (draft.checkIn === null || draft.checkOut === null) return 'Bitte wählen Sie zuerst Ihren Zeitraum.';
        if (draft.adults === null) return 'Bitte wählen Sie die Anzahl der Gäste.';
        if (draft.positions.length === 0) return 'Bitte wählen Sie mindestens ein Zimmer.';

        const capacity = this.getCapacityText();
        if (capacity !== '') return capacity;

        return invalid.length === 0 ? null : FORM_INCOMPLETE;
    }

    private getBookingDraft(): BookingDraft {
        const { checkIn, checkOut } = bookingState.getDates();
        const quantities = bookingState.getRoomQuantities();

        return {
            checkIn: checkIn === null ? null : toISODate(checkIn),
            checkOut: checkOut === null ? null : toISODate(checkOut),
            nights: countNights(checkIn, checkOut),
            adults: this.guests.adults,
            children: this.guests.children ?? 0,
            // Eine Position je Kategorie – die Form von `p_positions` in `create_booking`
            // (E44). Frühstück und Gäste gelten für den ganzen Vorgang (E48).
            positions: Object.entries(quantities).map(([roomTypeId, rooms]: [string, number]): BookingPosition => ({ roomTypeId, rooms })),
            withBreakfast: bookingState.getBreakfast(),
            // Die Form von `p_services` (E49). Die Menge ist nur beim Kinderbett mehr als 1.
            services: Object.entries(bookingState.getServices()).map(([code, quantity]: [string, number]): BookingService => ({ code, quantity })),
            ...this.readCustomerDetails(),
        };
    }

    private bindCustomerForm(): void {
        this.customerFormEl = document.querySelector<HTMLFormElement>('#booking-customer');
        const form = this.customerFormEl;
        if (!form) return;

        form.addEventListener('input', (event: Event): void => {
            // Wer ein markiertes Feld korrigiert, soll die Markierung nicht bis zum
            // nächsten Klick behalten.
            (event.target as HTMLElement).removeAttribute('aria-invalid');
            this.renderCustomerSummary();
        });
        form.addEventListener('change', (event: Event): void => {
            const target = event.target as HTMLElement;
            if (!target.hasAttribute('data-billing-toggle')) return;

            const billingEl = document.getElementById('booking-billing');
            if (billingEl) billingEl.hidden = !(target as HTMLInputElement).checked;
            this.renderCustomerSummary();
        });
        form.addEventListener('submit', (event: Event): void => {
            // Enter in einem Feld soll nicht die Seite neu laden.
            event.preventDefault();
        });

        document.querySelector('[data-action="checkout"]')?.addEventListener('click', (): void => {
            void this.submit();
        });

        this.renderCustomerSummary();
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
                firstName: text('vorname').trim(),
                lastName: text('nachname').trim(),
                email: text('email').trim(),
                phone: toOptional(text('telefon')),
            },
            residence: {
                street: text('strasse').trim(),
                houseNumber: text('hausnummer').trim(),
                postalCode: text('plz').trim(),
                city: text('ort').trim(),
                countryCode: country('land'),
            },
            billing:
                data.get('rechnung-abweichend') === null
                    ? null
                    : {
                          company: toOptional(text('rechnung-firma')),
                          street: text('rechnung-strasse').trim(),
                          houseNumber: text('rechnung-hausnummer').trim(),
                          postalCode: text('rechnung-plz').trim(),
                          city: text('rechnung-ort').trim(),
                          countryCode: country('rechnung-land'),
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

        const { customer, residence, billing } = this.readCustomerDetails();
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

/**
 * Baut die Karten aus den Kategorien und ergänzt – falls vorhanden – die Verfügbarkeit.
 *
 * Die Kategorien geben die Reihenfolge vor, damit die Liste beim Wählen eines Zeitraums
 * nicht umspringt.
 */
function buildRoomCards(details: RoomTypeDetail[], availability: RoomAvailability[] | null): RoomCard[] {
    const availabilityBySlug = new Map<string, RoomAvailability>((availability ?? []).map((room: RoomAvailability): [string, RoomAvailability] => [room.slug, room]));

    return details.map((detail: RoomTypeDetail): RoomCard => {
        const image = pickImage(detail.room_type_images);
        const room = availabilityBySlug.get(detail.slug);

        return {
            roomTypeId: detail.id,
            slug: detail.slug,
            name: detail.name,
            description: detail.description,
            imageUrl: image === null ? null : supabase.storage.from(ROOM_IMAGE_BUCKET).getPublicUrl(image.storage_path).data.publicUrl,
            imageAlt: image?.alt_text ?? '',
            maxOccupancy: detail.max_occupancy,
            availability:
                room === undefined
                    ? null
                    : {
                          priceLabel: room.total_amount_cents === null ? null : formatPrice(room.total_amount_cents, room.currency),
                          amountCents: room.total_amount_cents,
                          currency: room.currency,
                          nights: room.nights,
                          roomsFree: room.rooms_free,
                          isBookable: room.is_bookable,
                          unavailableReason: room.unavailable_reason,
                      },
        };
    });
}

/** Zeile unter der Beschreibung – ohne gewählten Zeitraum bleibt sie weg. */
function getAvailabilityHtml(availability: RoomCardAvailability | null): string {
    if (availability === null) return '';

    if (!availability.isBookable) {
        return /*html*/ `<p class="font-antic-didone text-16 text-purple-haze">${formatUnavailableReason(availability.unavailableReason ?? '')}</p>`;
    }

    const roomsFree = availability.roomsFree === null ? '' : `${formatRoomsFree(availability.roomsFree)} · `;
    return /*html*/ `<p class="font-antic-didone text-16 text-purple-haze-dark/70">${roomsFree}${formatNights(availability.nights)}</p>`;
}

/** Erstes Bild nach `sort_order` – Kategorien ohne Bild sind ein vorgesehener Fall. */
function pickImage(images: RoomTypeImage[]): RoomTypeImage | null {
    if (images.length === 0) return null;
    return [...images].sort((a: RoomTypeImage, b: RoomTypeImage): number => a.sort_order - b.sort_order)[0] ?? null;
}

/**
 * Zahl vor dem Symbol wie im Design ("732€") – `style: 'currency'` stellt das € bei de-AT voran.
 *
 * Volle Euro bleiben ohne Nachkommastellen, alles andere bekommt genau zwei: Sonst
 * stünde der Kinderpreis von 850 ct als „8,5€" da – als Betrag gelesen ein Tippfehler.
 */
function formatPrice(cents: number, currency: string): string {
    const digits = cents % 100 === 0 ? 0 : 2;
    const amount = new Intl.NumberFormat('de-AT', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
    return currency === 'EUR' ? `${amount}€` : `${amount} ${currency}`;
}

/**
 * Übersetzt die Gründe aus `search_availability`.
 *
 * Gäste sehen laut `mask_reason` nur `nicht_buchbar`, `vergangenheit` und
 * `ausserhalb_horizont`; die feineren Gründe bekommt nur `is_staff()`.
 */
function formatUnavailableReason(reason: string): string {
    switch (reason) {
        case 'nicht_buchbar':
            return 'Für diesen Zeitraum nicht buchbar.';
        case 'vergangenheit':
            return 'Der gewählte Zeitraum liegt in der Vergangenheit.';
        case 'ausserhalb_horizont':
            return 'Der gewählte Zeitraum liegt zu weit in der Zukunft.';
        case 'ausgebucht':
            return 'Für diesen Zeitraum ausgebucht.';
        case 'kein_preis':
            return 'Für diesen Zeitraum ist kein Preis hinterlegt.';
        case 'zu_klein':
            return 'Zu klein für die gewählte Belegung.';
        default:
            return 'Für diesen Zeitraum nicht buchbar.';
    }
}

/** Nächte zwischen An- und Abreise – `null`, solange der Zeitraum nicht vollständig ist. */
function countNights(checkIn: Date | null, checkOut: Date | null): number | null {
    if (checkIn === null || checkOut === null) return null;
    return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

/** „13.06.2026 ab 14:00 Uhr" wie im Entwurf – ohne geladene Hotelzeile nur das Datum. */
function formatStayDate(date: Date | null, preposition: string, time: string | null): string {
    if (date === null) return 'noch offen';

    const day = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString()}`;
    // `time` kommt als "14:00:00" – die Sekunden interessieren niemanden.
    return time === null ? day : `${day} ${preposition} ${time.slice(0, 5)} Uhr`;
}

function formatGuests(adults: number, children: number): string {
    const adultText = adults === 1 ? '1 Erwachsener' : `${adults.toString()} Erwachsene`;
    if (children === 0) return adultText;
    return `${adultText}, ${children === 1 ? '1 Kind' : `${children.toString()} Kinder`}`;
}

function formatNights(nights: number): string {
    return nights === 1 ? '1 Nacht' : `${nights.toString()} Nächte`;
}

function formatRoomsFree(roomsFree: number): string {
    return roomsFree === 1 ? 'noch 1 Zimmer frei' : `noch ${roomsFree.toString()} Zimmer frei`;
}

function buildAdultOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_ADULTS }, (_unused: unknown, index: number): GuestOption => {
        const value = index + 1;
        return { value, label: value === 1 ? '1 Erwachsener' : `${value.toString()} Erwachsene` };
    });
}

/** Ohne eigene 0-Option: der leere Platzhalter „Keine Kinder" ist dieser Fall (Q17). */
function buildChildOptions(): readonly GuestOption[] {
    return Array.from({ length: MAX_CHILDREN }, (_unused: unknown, index: number): GuestOption => {
        const value = index + 1;
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
