import AbstractView from '../AbstractView';

export class MainLayout extends AbstractView {
    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <nav>
                <ul>
                    <li><a href="/" data-link>Home</a></li>
                    <li><a href="/posts" data-link>Posts</a></li>
                    <li><a href="/about" data-link>About</a></li>
                </ul>
            </nav>
            <div id="content">

            </div>
            <div id="footer">
                < p>Copyright © 2024</>
            </div>
        `;
    }
}
