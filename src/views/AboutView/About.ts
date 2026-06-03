import AbstractView from '../AbstractView';

export class AboutView extends AbstractView {
    constructor() {
        super();
        this.setTitle('About Seite View');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">About Seite View</h1>
        `;
    }
}
