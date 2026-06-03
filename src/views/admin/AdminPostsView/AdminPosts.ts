import AbstractView from '../../AbstractView';

export class AdminPostsView extends AbstractView {
    constructor() {
        super();
        this.setTitle('Admin Posts View');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">Admin Posts View</h1>
        `;
    }
}
