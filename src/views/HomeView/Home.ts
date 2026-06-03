import AbstractView from '../AbstractView';

export class HomeView extends AbstractView {
    constructor() {
        super();
        this.setTitle('Start Seite View');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">Start Seite View</h1>
        `;
    }
}
