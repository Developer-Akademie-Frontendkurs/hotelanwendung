import AbstractView from '../AbstractView';

export class HomeView extends AbstractView {
    constructor() {
        super();
        this.setTitle('Start Seite View');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <div class="max-w-360 flex flex-col gap-y-10 pt-6 px-3 pb-16.25 mx-auto">
                <section class="text-center">
                    <p class="font-antic-didone text-16 text-purple-haze-dark">
                        Willkommen im Karawanken Hof – unseren familiengeführten Rückzugsort in den Alpen,
                        fernab von Stress und im Einklang mit der Natur.
                    </p>
                    <p class="mt-6 font-antic-didone text-16 text-purple-haze-dark">
                        Freuen Sie sich auf exklusive Chalets, unberührte Wanderwege und geführte Rad- und
                        Kuhwanderungen – alles an einem Ort, der bewusst fern vom Alltag liegt.
                    </p>
                </section>

                <section>
                    <p>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Incidunt rerum dolor alias perferendis debitis natus. Ipsum impedit eum maiores sequi, quaerat, in esse eos perspiciatis inventore ad autem exercitationem placeat.</p>
                </section>

                <section></section>
            </div>
        `;
    }
}
