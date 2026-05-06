import AbstractView from '../AbstractView';

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle('Home | Hotelanwendung');
    }

    async getHTML() {
        return `
            <h1>Hauptseite</h1>
        `;
    }
}
