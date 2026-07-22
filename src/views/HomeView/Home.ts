import AbstractView from '../AbstractView';
import seezugang from '../../assets/img/icons/seezugang.svg';
import haubenkueche from '../../assets/img/icons/kitchen.svg';
import wellness from '../../assets/img/icons/wellness.svg';
import fam_stroheim from '../../assets/img/familie-stroheim.jpg';
import double_suite from '../../assets/img/double-suite.jpg';
import kulinarik from '../../assets/img/kulinarik.jpg';
import kuhwanderung from '../../assets/img/kuh-wanderung.jpg';
import yoga from '../../assets/img/yoga.jpg';
import './home.css';

export class HomeView extends AbstractView {
    constructor() {
        super();
        this.setTitle('Start Seite View');
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

            <section class="bg-purple-haze-light flex flex-col gap-y-6 py-10">
                <div class="flex flex-col gap-y-3 456:gap-y-0 items-center">
                    <h2 class="font-playfair-display text-24 456:text-32 768:text-48 text-purple-haze-dark font-medium text-center">Zimmer mit Weitblick</h2>
                    <p class="w-46 456:w-full font-antic-didone text-16 768:text-20 text-purple-haze-dark text-center leading-5">Exklusive Rückzugsorte zwischen Bergen und See</p>
                </div>

                <div class="w-full max-w-300 mx-auto flex items-center gap-x-1 992:gap-x-2">
                    <button type="button" aria-label="Vorheriges Zimmer" class="shrink-0 text-purple-haze">
                        <svg class="w-8 h-8 992:w-10 992:h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="15 6 9 12 15 18"></polyline>
                        </svg>
                    </button>

                    <div class="bg-white flex flex-col 992:flex-row gap-y-6">
                        <div class="w-full 992:w-1/2">
                            <img src="${double_suite}" alt="Double Suite" class="w-full 992:h-full object-cover">
                            <p class="992:hidden px-4 font-antic-didone text-18 text-purple-haze-dark">231€ Nacht / p. P.</p>
                        </div>

                        <div class="992:w-1/2 flex flex-col gap-y-6 pb-4 px-4 992:p-6">
                            <div class="flex flex-col gap-y-4">
                                <p class="hidden 992:block font-antic-didone text-22 text-purple-haze-dark">231€ Nacht / p. P.</p>
                                <h3 class="font-playfair-display text-20 992:text-36 text-purple-haze-dark">Double Suite</h3>
                                <p class="font-antic-didone text-16 992:text-20 text-purple-haze-dark">Edles Design, viel Raum und der Blick in die Karawanken machen sie zum idealen Rückzugsort für zwei.</p>
                            </div>

                            <div class="flex flex-col 576:flex-row 576:flex-wrap gap-y-4 576:gap-y-6 pb-3">
                                <div class="576:w-4/10 flex gap-x-2 pr-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="39" height="35" viewBox="0 0 39 35" fill="none">
                                        <path d="M38.4287 27.2543C38.6945 26.7613 38.9998 25.8782 38.9998 25.1923V22.4559C38.9998 21.3418 38.5292 20.352 37.8049 19.7363C38.513 19.1334 38.9999 18.0194 38.9999 17.0131C38.9999 15.9047 38.5345 14.9193 37.817 14.3024V3.37805C37.817 1.51539 36.5014 0 34.8844 0H20.7446C20.4291 0 20.1734 0.294636 20.1734 0.658062C20.1734 1.02149 20.4291 1.31612 20.7446 1.31612H34.8844C35.8715 1.31612 36.6745 2.2411 36.6745 3.37805V13.7058C36.2997 13.6142 35.8406 13.616 35.4508 13.6324V4.69935C35.4508 3.61074 34.6819 2.72517 33.7369 2.72517H5.2631C4.31803 2.72517 3.54923 3.61074 3.54923 4.69935V13.6324C3.15923 13.6162 2.7006 13.6142 2.32553 13.705V3.37805C2.32553 2.2411 3.12853 1.31612 4.11557 1.31612H18.2554C18.5709 1.31612 18.8266 1.02149 18.8266 0.658062C18.8266 0.294636 18.5709 0 18.2554 0H4.11557C2.49851 0 1.18295 1.51539 1.18295 3.37805V14.3003C0.481711 14.9038 0 16.0133 0 17.0131C0 18.1283 0.471275 19.1191 1.19636 19.7353C0.471352 20.3509 0.000152344 21.3412 0.000152344 22.456V25.1924C0.000152344 25.9681 0.228363 26.6835 0.611432 27.2544H0.571289C0.255785 27.2544 0 27.549 0 27.9124V30.6377C0 31.0011 0.255785 31.2958 0.571289 31.2958H2.3662V33.3632C2.3662 33.7266 2.62199 34.0213 2.93749 34.0213H5.30354C5.61905 34.0213 5.87483 33.7266 5.87483 33.3632V31.2958H10.565C10.8805 31.2958 11.1363 31.0011 11.1363 30.6377C11.1363 30.2743 10.8805 29.9796 10.565 29.9796H1.14258V28.5705H37.8574V29.9796H13.0551C12.7396 29.9796 12.4838 30.2743 12.4838 30.6377C12.4838 31.0011 12.7396 31.2958 13.0551 31.2958H33.1251V33.3632C33.1251 33.7266 33.3808 34.0213 33.6964 34.0213H36.0624C36.378 34.0213 36.6337 33.7266 36.6337 33.3632V31.2958H38.4287C38.7443 31.2958 39 31.0011 39 30.6377V27.9124C39 27.5489 38.7443 27.2543 38.4287 27.2543ZM4.69181 4.69935C4.69181 4.33654 4.94805 4.04129 5.2631 4.04129H33.7368C34.0519 4.04129 34.3081 4.33654 34.3081 4.69935V13.6324H32.9849C33.0494 13.425 33.0845 13.2017 33.0845 12.9691V10.1499C33.0845 9.06134 32.3156 8.17576 31.3706 8.17576H23.0085C22.0635 8.17576 21.2946 9.06134 21.2946 10.1499V12.9691C21.2946 13.2017 21.3297 13.425 21.3942 13.6324H17.6056C17.67 13.425 17.7052 13.2016 17.7052 12.9689V10.1502C17.7052 9.0616 16.9364 8.17603 15.9914 8.17603H7.62922C6.68416 8.17603 5.91536 9.0616 5.91536 10.1502V12.9689C5.91536 13.2016 5.95047 13.425 6.01499 13.6324H4.69188L4.69181 4.69935ZM7.05793 12.9689V10.1502C7.05793 9.78731 7.31418 9.49215 7.62922 9.49215H15.9914C16.3064 9.49215 16.5627 9.78731 16.5627 10.1502V12.9689C16.5627 13.3318 16.3064 13.627 15.9914 13.627H7.62922C7.31418 13.627 7.05793 13.3318 7.05793 12.9689ZM2.9349 14.9485H25.9449C26.2605 14.9485 26.5162 14.6539 26.5162 14.2905C26.5162 14.2896 26.5162 14.2887 26.5162 14.2878C26.5162 14.287 26.5162 14.2861 26.5162 14.2852C26.5162 13.9218 26.2605 13.6271 25.9449 13.6271H23.0085C22.6934 13.6271 22.4372 13.332 22.4372 12.9691V10.1499C22.4372 9.78705 22.6934 9.49189 23.0085 9.49189H31.3706C31.6857 9.49189 31.9419 9.78705 31.9419 10.1499V12.9691C31.9419 13.332 31.6857 13.6271 31.3706 13.6271H28.435C28.1194 13.6271 27.8637 13.9218 27.8637 14.2852V14.2878V14.2905C27.8637 14.6539 28.1194 14.9485 28.435 14.9485H36.0651C37.0534 14.9485 37.8574 15.8747 37.8574 17.0131C37.7548 18.2712 37.1573 18.9595 36.0651 19.0777H2.9349C1.94657 19.0777 1.14258 18.1515 1.14258 17.0131C1.14258 16.4618 1.55695 14.9485 2.9349 14.9485ZM1.14273 22.4559C1.14273 21.3189 1.94573 20.394 2.93277 20.394H36.0672C37.0543 20.394 37.8573 21.3189 37.8573 22.4559V25.1923C37.8573 26.3292 37.0543 27.2542 36.0672 27.2542H2.93277C1.94573 27.2542 1.14273 26.3292 1.14273 25.1923V22.4559ZM4.73225 32.7052H3.50878V31.2958H4.73225V32.7052ZM35.4912 32.7052H34.2677V31.2958H35.4912V32.7052Z" fill="#642360"/>
                                    </svg>
                                    <span class="font-antic-didone text-16 text-purple-haze-dark">King- size Bett</span>
                                </div>

                                <div class="576:w-6/10 flex gap-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="39" height="32" viewBox="0 0 39 32" fill="none">
                                        <path d="M37.2545 11.5559H36.6835V1.67667C36.6835 0.752173 35.9225 0 34.9871 0H31.3594C30.424 0 29.6629 0.752097 29.6629 1.67667V2.34776C28.2952 2.58107 27.2515 3.76207 27.2515 5.17946C27.2515 5.48813 27.5046 5.73838 27.817 5.73838H32.6398C32.9521 5.73838 33.2053 5.48813 33.2053 5.17946C33.2053 3.76207 32.1616 2.58115 30.7939 2.34776V1.67667C30.7939 1.36846 31.0475 1.11776 31.3594 1.11776H34.9871C35.299 1.11776 35.5526 1.36846 35.5526 1.67667V11.5559H27.1927C26.9662 10.8929 26.331 10.4143 25.5848 10.4143H24.4501C24.1378 10.4143 23.8846 10.6645 23.8846 10.9732C23.8846 11.2818 24.1377 11.5321 24.4501 11.5321H25.5848C25.8967 11.5321 26.1503 11.7828 26.1503 12.091V17.3558H19.085V12.0909C19.085 11.7827 19.3387 11.532 19.6505 11.532H21.9855C22.2978 11.532 22.551 11.2818 22.551 10.9731C22.551 10.6644 22.2979 10.4142 21.9855 10.4142H19.6505C18.9157 10.4142 18.2885 10.8784 18.0533 11.5257C16.8606 11.4309 15.6812 11.1076 14.6151 10.5805C12.8423 9.70432 10.857 9.24124 8.8741 9.24124H1.74548C0.782971 9.24131 0 10.0152 0 10.9664C0 11.9176 0.782971 12.6916 1.74548 12.6916H2.73015V19.1634C2.73015 22.2659 4.67025 24.929 7.41442 26.03V27.169C7.41442 27.499 7.14279 27.7675 6.80893 27.7675C5.85145 27.7675 5.07251 28.5373 5.07251 29.4837C5.07251 30.4301 5.85145 31.2 6.80893 31.2H9.15091C10.1084 31.2 10.8874 30.4301 10.8874 29.4837V28.3264C10.8874 27.3582 11.6844 26.5706 12.6639 26.5706H12.6668H17.2899C17.6022 26.5706 17.8554 26.3203 17.8554 26.0117C17.8554 25.703 17.6023 25.4527 17.2899 25.4527H10.2253C6.71607 25.4527 3.86115 22.6314 3.86115 19.1634V12.6916H5.88481C6.19712 12.6916 6.45031 12.4413 6.45031 12.1326C6.45031 11.824 6.19719 11.5737 5.88481 11.5737H1.74548C1.40667 11.5737 1.131 11.3013 1.131 10.9664C1.131 10.6315 1.40667 10.3591 1.74548 10.3591H8.8741C10.6823 10.3591 12.4926 10.7813 14.1092 11.5803C15.3016 12.1698 16.6204 12.532 17.954 12.6392V13.8573C16.4294 13.7475 14.9215 13.3399 13.56 12.6662C11.9503 11.8715 10.1395 11.5388 8.34859 11.5737C8.03628 11.5737 7.78309 11.824 7.78309 12.1326C7.78309 12.4413 8.03621 12.6916 8.34859 12.6916C9.95703 12.6481 11.6097 12.9529 13.0542 13.666C14.5713 14.4167 16.2545 14.8662 17.954 14.9778V20.229C17.954 20.5377 18.2071 20.7879 18.5195 20.7879H26.7158C27.0281 20.7879 27.2813 20.5377 27.2813 20.229V15.006H35.5183V19.1634C35.5183 22.6314 32.6633 25.4527 29.1541 25.4527H19.7545C19.4422 25.4527 19.189 25.703 19.189 26.0117C19.189 26.3203 19.4421 26.5706 19.7545 26.5706H26.7126H26.7155C27.695 26.5706 28.4919 27.3582 28.4919 28.3264V29.4837C28.4919 30.4301 29.2709 31.2 30.2284 31.2H32.5704C33.5279 31.2 34.3068 30.4301 34.3068 29.4837C34.3068 28.5373 33.5279 27.7675 32.5704 27.7675C32.2365 27.7675 31.9649 27.499 31.9649 27.169V26.03C34.7091 24.929 36.6492 22.2659 36.6492 19.1634V15.006H37.2545C38.217 15.006 39 14.2322 39 13.281C39 12.3297 38.217 11.5559 37.2545 11.5559ZM31.9821 4.62054H28.4747C28.7395 3.84315 29.5291 3.45626 30.2978 3.42366C31.0798 3.42359 31.7455 3.92551 31.9821 4.62054ZM10.3637 26.5705C9.98309 27.0564 9.75632 27.6657 9.75632 28.3263V29.4837C9.75632 29.8136 9.48469 30.0821 9.15083 30.0821H6.80878C6.47491 30.0821 6.20336 29.8136 6.20336 29.4837C6.20336 29.1537 6.47499 28.8852 6.80878 28.8852C7.76626 28.8852 8.54527 28.1153 8.54527 27.169V26.3829C9.14756 26.5131 9.75373 26.5756 10.3637 26.5705ZM32.5705 28.8852C32.9043 28.8852 33.1759 29.1537 33.1759 29.4837C33.1759 29.8136 32.9043 30.0821 32.5705 30.0821H30.2285C29.8946 30.0821 29.623 29.8136 29.623 29.4837V28.3263C29.623 27.6657 29.3963 27.0564 29.0156 26.5705C29.6256 26.5756 30.2318 26.5131 30.8341 26.3829V27.169C30.834 28.1153 31.613 28.8852 32.5705 28.8852ZM19.085 19.6702V18.4735H26.1503V19.6702H19.085ZM37.2545 13.8883H27.2813V12.6736H37.2545C37.5933 12.6736 37.869 12.9461 37.869 13.281C37.8691 13.6158 37.5934 13.8883 37.2545 13.8883Z" fill="#642360"/>
                                        <path d="M30.794 8.64257V7.4941C30.794 7.18543 30.5408 6.93518 30.2285 6.93518C29.9161 6.93518 29.663 7.18543 29.663 7.4941V8.64257C29.663 8.95124 29.9161 9.20149 30.2285 9.20149C30.5408 9.20149 30.794 8.95124 30.794 8.64257Z" fill="#642360"/>
                                        <path d="M33.52 8.86952C33.7649 8.678 33.7409 8.29736 33.52 8.07918L32.6984 7.26708C32.4775 7.04883 32.1195 7.04883 31.8986 7.26708C31.6778 7.48533 31.6778 7.83925 31.8986 8.05742L32.7203 8.86952C33.0064 9.11684 33.2515 9.07964 33.52 8.86952Z" fill="#642360"/>
                                        <path d="M27.4647 8.86952L28.2864 8.05742C28.5072 7.83917 28.5072 7.48526 28.2864 7.26708C28.0655 7.04883 27.7076 7.04883 27.4867 7.26708L26.665 8.07918C26.4442 8.29743 26.4442 8.65135 26.665 8.86952C26.7754 8.97869 27.1162 9.1541 27.4647 8.86952Z" fill="#642360"/>
                                        <path d="M18.522 9.20369C19.4758 9.20369 20.2517 8.43676 20.2517 7.49412C20.2517 6.55147 19.4758 5.78455 18.522 5.78455C17.5683 5.78455 16.7922 6.55147 16.7922 7.49412C16.7922 8.43676 17.5682 9.20369 18.522 9.20369ZM18.522 6.9023C18.8522 6.9023 19.1207 7.16776 19.1207 7.49412C19.1207 7.82048 18.8522 8.08593 18.522 8.08593C18.1918 8.08593 17.9232 7.82048 17.9232 7.49412C17.9232 7.16776 18.1918 6.9023 18.522 6.9023Z" fill="#642360"/>
                                        <path d="M13.8313 5.72493C14.7851 5.72493 15.5611 4.958 15.5611 4.01536C15.5611 3.07271 14.7852 2.30579 13.8313 2.30579C12.8775 2.30579 12.1016 3.07271 12.1016 4.01536C12.1016 4.958 12.8776 5.72493 13.8313 5.72493ZM13.8313 3.42354C14.1616 3.42354 14.4301 3.689 14.4301 4.01536C14.4301 4.34172 14.1616 4.60717 13.8313 4.60717C13.5011 4.60717 13.2326 4.34172 13.2326 4.01536C13.2326 3.689 13.5011 3.42354 13.8313 3.42354Z" fill="#642360"/>
                                    </svg>
                                    <span class="font-antic-didone text-16 text-purple-haze-dark">Badewanne, Föhn & eigenes WC</span>
                                </div>

                                <div class="576:w-4/10 flex gap-x-2 items-center pr-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="39" height="34" viewBox="0 0 39 34" fill="none">
                                        <path d="M37.2861 0H26.8704C26.5548 0 26.2991 0.350627 26.2991 0.783116C26.2991 1.2156 26.5548 1.56623 26.8704 1.56623H37.2861C37.6012 1.56623 37.8574 1.91749 37.8574 2.34935V21.9199C37.8574 22.3517 37.6012 22.7031 37.2861 22.7031H36.6341V15.323C36.6341 14.0275 35.8652 12.9736 34.9202 12.9736H12.464C12.1485 12.9736 11.8927 13.3242 11.8927 13.7567C11.8927 14.1892 12.1485 14.5399 12.464 14.5399H34.9202C35.2353 14.5399 35.4915 14.8911 35.4915 15.323V16.2168H3.50848V15.323C3.50848 14.8911 3.7648 14.5399 4.07977 14.5399H9.97395C10.2894 14.5399 10.5452 14.1892 10.5452 13.7567C10.5452 13.3242 10.2894 12.9736 9.97395 12.9736H4.07977C3.1347 12.9736 2.3659 14.0275 2.3659 15.323V22.7031H1.71387C1.39882 22.7031 1.14258 22.3517 1.14258 21.9199V2.34935C1.14258 1.91749 1.39882 1.56623 1.71387 1.56623H24.3811C24.6967 1.56623 24.9524 1.2156 24.9524 0.783116C24.9524 0.350627 24.6967 0 24.3811 0H1.71387C0.768803 0 0 1.05387 0 2.34935V21.9199C0 23.2154 0.768803 24.2693 1.71387 24.2693H37.2861C38.2311 24.2693 39 23.2154 39 21.9199V2.34935C39 1.05387 38.2311 0 37.2861 0ZM3.50848 22.7031V21.0261H18.2554C18.5709 21.0261 18.8266 20.6755 18.8266 20.243C18.8266 19.8105 18.5709 19.4599 18.2554 19.4599H3.50848V17.783H35.4915V19.4599H20.7446C20.4291 19.4599 20.1734 19.8105 20.1734 20.243C20.1734 20.6755 20.4291 21.0261 20.7446 21.0261H35.4915V22.7031H3.50848Z" fill="#642360"/>
                                        <path d="M21.2948 4.02665V7.26979C21.2948 7.70228 21.5505 8.05291 21.8661 8.05291H28.9643C29.2799 8.05291 29.5356 7.70228 29.5356 7.26979V4.02665C29.5356 3.59416 29.2799 3.24353 28.9643 3.24353H21.8661C21.5506 3.24353 21.2948 3.59416 21.2948 4.02665ZM22.4374 4.80976H28.393V6.48668H22.4374V4.80976Z" fill="#642360"/>
                                        <path d="M34.2675 5.6481C34.2675 4.32212 33.4805 3.24341 32.5133 3.24341C31.5461 3.24341 30.7592 4.32212 30.7592 5.6481C30.7592 6.97407 31.5461 8.05278 32.5133 8.05278C33.4805 8.05278 34.2675 6.97407 34.2675 5.6481ZM31.9017 5.6481C31.9017 5.18574 32.1761 4.80964 32.5133 4.80964C32.8505 4.80964 33.1249 5.18574 33.1249 5.6481C33.1249 6.11045 32.8505 6.48655 32.5133 6.48655C32.1761 6.48655 31.9017 6.11045 31.9017 5.6481Z" fill="#642360"/>
                                        <path d="M19.5 25.9468C19.1845 25.9468 18.9287 26.2974 18.9287 26.7299V33.2167C18.9287 33.6492 19.1845 33.9998 19.5 33.9998C19.8156 33.9998 20.0713 33.6492 20.0713 33.2167V26.7299C20.0713 26.2974 19.8156 25.9468 19.5 25.9468Z" fill="#642360"/>
                                        <path d="M14.7678 25.9468C14.4523 25.9468 14.1965 26.2974 14.1965 26.7299C14.3524 29.0035 13.7133 31.4422 12.1463 32.5163C11.864 32.7097 11.7496 33.1801 11.8908 33.5669C12.1111 33.9819 12.3666 34.0986 12.6572 33.9171C14.6282 32.5663 15.4978 29.6288 15.3391 26.7299C15.3391 26.2974 15.0834 25.9468 14.7678 25.9468Z" fill="#642360"/>
                                        <path d="M8.85273 25.9468C8.53722 25.9468 8.28144 26.2974 8.28144 26.7299C8.28144 29.0694 7.34399 31.1676 6.08274 32.6629C5.85963 32.9687 5.85963 33.4646 6.08274 33.7703C6.352 34.0761 6.62135 34.0761 6.89061 33.7703C8.33422 31.869 9.42402 29.5877 9.42402 26.7298C9.42402 26.2974 9.16823 25.9468 8.85273 25.9468Z" fill="#642360"/>
                                        <path d="M26.8536 32.5162C25.2867 31.4423 24.655 29.0067 24.8034 26.7299C24.8034 26.2974 24.5477 25.9468 24.2321 25.9468C23.9165 25.9468 23.6608 26.2974 23.6608 26.7299C23.4906 29.6391 24.3567 32.556 26.3428 33.9171C26.6334 34.0986 26.8889 33.9818 27.1092 33.5669C27.2503 33.1801 27.1359 32.7097 26.8536 32.5162Z" fill="#642360"/>
                                        <path d="M30.7186 26.7299C30.7341 26.2979 30.4629 25.9468 30.1473 25.9468C29.8318 25.9468 29.576 26.2974 29.576 26.7299C29.576 29.5619 30.6703 31.8876 32.1095 33.7704C32.3788 34.0763 32.6481 34.0762 32.9174 33.7704C33.1405 33.4646 33.1405 32.9687 32.9173 32.6629C31.7256 31.1829 30.6512 28.6118 30.7186 26.7299Z" fill="#642360"/>
                                    </svg>
                                    <span class="font-antic-didone text-16 text-purple-haze-dark">Klimaanlage & TV</span>
                                </div>

                                <div class="576:w-6/10 flex gap-x-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="39" height="20" viewBox="0 0 39 20" fill="none">
                                        <path d="M38.4287 7.07325H36.6341V4.1055C36.6341 3.79104 36.3784 3.53624 36.0628 3.53624H34.2674V0.56926C34.2674 0.254801 34.0117 0 33.6962 0H28.9644C28.6488 0 28.3931 0.254801 28.3931 0.56926V7.07325H18.3475C18.0319 7.07325 17.7762 7.32805 17.7762 7.64251C17.7762 7.95696 18.0319 8.21177 18.3475 8.21177H28.3931V11.7882H10.607V8.21177H15.8575C16.173 8.21177 16.4288 7.95696 16.4288 7.64251C16.4288 7.32805 16.173 7.07325 15.8575 7.07325H10.607V0.569336C10.607 0.254877 10.3513 7.58596e-05 10.0357 7.58596e-05H5.30362C4.98804 7.58596e-05 4.73233 0.254877 4.73233 0.569336V3.53662H2.93749C2.62191 3.53662 2.3662 3.79142 2.3662 4.10588V7.07332H0.571289C0.255709 7.07332 0 7.32812 0 7.64258V12.3575C0 12.672 0.255709 12.9268 0.571289 12.9268H2.3662V15.8942C2.3662 16.2087 2.62191 16.4635 2.93749 16.4635H4.73225V19.4307C4.73225 19.7452 4.98796 20 5.30354 20H10.0356C10.3512 20 10.6069 19.7452 10.6069 19.4307V12.9268H28.3931V19.4307C28.3931 19.7452 28.6488 20 28.9644 20H33.6962C34.0117 20 34.2674 19.7452 34.2674 19.4307V16.4638H36.0628C36.3784 16.4638 36.6341 16.209 36.6341 15.8945V12.9268H38.4287C38.7443 12.9268 39 12.672 39 12.3575V7.64251C39 7.32812 38.7443 7.07325 38.4287 7.07325ZM1.14258 11.7882V8.21177H2.3662V11.7882L1.14258 11.7882ZM3.50878 15.3249V4.67514H4.73225V15.3249L3.50878 15.3249ZM8.24104 18.8614V13.5879C8.24104 13.2734 7.98533 13.0186 7.66975 13.0186C7.35417 13.0186 7.09846 13.2734 7.09846 13.5879V18.8614H5.87491V1.1386H7.09846V11.1066C7.09846 11.4211 7.35417 11.6759 7.66975 11.6759C7.98533 11.6759 8.24104 11.4211 8.24104 11.1066V1.1386H9.46443V18.8614H8.24104ZM29.5356 1.13852H30.7591V18.8615H29.5356V1.13852ZM35.4915 15.3252H34.2674V11.2402C34.2674 10.9258 34.0117 10.671 33.6962 10.671C33.3806 10.671 33.1249 10.9258 33.1249 11.2402V18.8615H31.9016V1.13852H33.1249V8.75977C33.1249 9.07423 33.3806 9.32903 33.6962 9.32903C34.0117 9.32903 34.2674 9.07423 34.2674 8.75977V4.67476H35.4915V15.3252ZM37.8574 11.7882H36.6341V8.21177H37.8574V11.7882Z" fill="#642360"/>
                                    </svg>
                                    <span class="font-antic-didone text-16 text-purple-haze-dark">Gym Zugang</span>
                                </div>
                            </div>

                            <button type="button" class="self-start border border-purple-haze text-purple-haze rounded-md py-2 px-4 font-antic-didone text-16">view Room</button>
                        </div>
                    </div>

                    <button type="button" aria-label="Nächstes Zimmer" class="shrink-0 text-purple-haze">
                        <svg class="w-8 h-8 992:w-10 992:h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="9 6 15 12 9 18"></polyline>
                        </svg>
                    </button>
                </div>

                <button class="bg-purple-haze self-center py-2 px-3 rounded-md text-white">Buchen</button>
            </section>

            <section class="flex flex-col gap-y-4 768:gap-y-6 items-center py-16.25 992:py-30 px-4">
                <h2 class="font-playfair-display text-32 text-purple-haze-dark">So finden sie uns</h2>
                <iframe class="w-full max-w-300 h-112.5 rounded-2xl shadow-pic" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d685.4927898019566!2d13.82622416971581!3d46.58780751985834!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x477a7f14b8666013%3A0x6df49d50119e63d2!2sHotel%20Karawankenhof!5e0!3m2!1sde!2sde!4v1784009629674!5m2!1sde!2sde" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </section>
        `;
    }
}
