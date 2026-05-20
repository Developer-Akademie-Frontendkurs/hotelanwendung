import AbstractView from '../AbstractView';

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle('Start Seite View');
    }

    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">Start Seite View</h1>
        `;
    }
}
