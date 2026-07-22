import AbstractView from '../AbstractView';

export class AdminLayout extends AbstractView {
    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <nav>
                <ul>
                    <li><a href="/admin/dashboard" data-link>Home</a></li>
                    <li><a href="/admin/posts" data-link>Posts</a></li>
                </ul>
            </nav>
            <div id="content">

            </div>
            <div id="footer">
                <p>Copyright © 2024</p>
            </div>
        `;
    }
}
