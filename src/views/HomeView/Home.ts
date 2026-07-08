import AbstractView from '../AbstractView';
import seezugang from '../../assets/img/icons/seezugang.svg';
import haubenkueche from '../../assets/img/icons/kitchen.svg';
import wellness from '../../assets/img/icons/wellness.svg';
import fam_stroheim from '../../assets/img/familie-stroheim.jpg';
import double_suite from '../../assets/img/double-suite.jpg';
import king_bed from '../../assets/img/icons/kingsize.svg';
import bathroom from '../../assets/img/icons/bathroom.svg';
import klima_tv from '../../assets/img/icons/klima.svg';
import gym from '../../assets/img/icons/gym.svg';

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
                <!-- <section></section> -->
            </div>
            <section class="flex flex-col gap-y-4 768:gap-y-6 items-center px-4">
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
            <section class="bg-purple-haze-light flex flex-col gap-y-6 py-10 px-4">
                <div class="flex flex-col gap-y-3 456:gap-y-0 items-center">
                    <h2 class="font-playfair-display text-24 456:text-32 768:text-48 text-purple-haze-dark font-medium text-center">Zimmer mit Weitblick</h2>
                    <p class="w-46 456:w-full font-antic-didone text-16 768:text-20 text-purple-haze-dark text-center leading-5">Exklusive Rückzugsorte zwischen Bergen und See</p>
                </div>

                <div class="bg-white flex flex-col 768:flex-row gap-y-6">
                    <div>
                        <img src="${double_suite}" alt="Double Suite">
                        <p class="px-4 font-antic-didone text-16 text-purple-haze-dark">231€ Nacht/ p. P.</p>
                    </div>

                    <div class="flex flex-col gap-y-4 px-4">
                        <h3 class="font-playfair-display text-20 text-purple-haze-dark">Double Suite</h3>
                        <p class="font-antic-didone text-16 text-purple-haze-dark">Edles Design, viel Raum und der Blick in die Karawanken machen sie zum idealen Rückzugsort für zwei.</p>
                    </div>

                    <div class="flex flex-col gap-y-4 pb-3">
                        <div class="flex gap-y-2 px-4">
                            <img src="${king_bed}" class="w-9.75 h-6" alt="King- size Bett">
                            <span class="font-antic-didone text-16 text-purple-haze-dark">King- size Bett</span>
                        </div>
                        <div class="flex gap-y-2 px-4">
                            <img src="${bathroom}" class="w-9.75 h-6" alt="Badewanne, Föhn & eigenes WC">
                            <span class="font-antic-didone text-16 text-purple-haze-dark">Badewanne, Föhn & eigenes WC</span>
                        </div>
                        <div class="flex gap-y-2 px-4">
                            <img src="${klima_tv}" class="w-9.75 h-6" alt="Klimaanlage & TV">
                            <span class="font-antic-didone text-16 text-purple-haze-dark">Klimaanlage & TV</span>
                        </div>
                        <div class="flex gap-y-2 px-4">
                            <img src="${gym}" class="w-9.75 h-6 mr-2" alt="Gym Zugang">
                            <span class="font-antic-didone text-16 text-purple-haze-dark">Gym Zugang</span>
                        </div>

                    </div>
                </div>

                <button class="bg-purple-haze self-center py-2 px-3 rounded-md text-white">Buchen</button>
            </section>
        `;
    }
}
