import AbstractView from '../../AbstractView';

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle('Admin Posts View');
    }

    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">Admin Posts View</h1>
        `;
    }
}
