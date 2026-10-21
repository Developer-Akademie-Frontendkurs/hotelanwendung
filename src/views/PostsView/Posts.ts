import AbstractView from '../AbstractView';
import { fetchPosts, type Post } from '../../shared/services/posts.service';
import { escapeHtml } from '../../shared/ui/html';

export class PostsView extends AbstractView {
    posts: Post[] = [];

    constructor() {
        super();
        this.setTitle('Posts View');
    }

    async onInit(): Promise<void> {
        console.log('init');
        await this.loadPosts();
        console.log('Posts: ', this.posts);
    }

    async loadPosts(): Promise<void> {
        try {
            this.posts = await fetchPosts();
        } catch (error: unknown) {
            console.error('Error fetching posts: ', error);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">Posts View</h1>
            <ul>
            ${this.posts
                .map(
                    (post) => `
                        <li class="mb-2">
                            <strong>
                                <a href="/posts/${escapeHtml(encodeURIComponent(post.id))}" data-link class="text-blue-500 hover:underline">
                                    ${escapeHtml(post.title)}
                                </a>
                            </strong>
                        </li>
                    `,
                )
                .join('')}
            </ul>
        `;
    }
}
