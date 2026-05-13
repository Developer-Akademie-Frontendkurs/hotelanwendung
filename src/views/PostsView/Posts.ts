import AbstractView from '../AbstractView';

export default class extends AbstractView {
    constructor() {
        super();
        this.setTitle('Posts View');
    }

    async getHtml(): Promise<string> {
        return `
            <nav>
                <ul>
                    <li><a href="/" data-link>Home</a></li>
                    <li><a href="/posts" data-link>Posts</a></li>
                    <li><a href="/about" data-link>About</a></li>
                </ul>
            </nav>
            <h1 class="bg-yellow-500 text-3xl">Posts View</h1>
        `;
    }
}
