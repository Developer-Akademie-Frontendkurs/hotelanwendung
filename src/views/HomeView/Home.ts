import AbstractView from '../AbstractView';
import seezugang from '../../assets/img/icons/seezugang.svg';
import haubenkueche from '../../assets/img/icons/kitchen.svg';
import wellness from '../../assets/img/icons/wellness.svg';
import fam_stroheim from '../../assets/img/familie-stroheim.jpg';

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
        `;
    }
}
