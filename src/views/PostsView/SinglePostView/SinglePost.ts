import AbstractView from '../../AbstractView';
import { fetchPost, type Post } from '../../../shared/services/posts.service';
import { escapeHtml } from '../../../shared/ui/html';

export class SinglePostView extends AbstractView {
    post: Post | undefined;

    constructor(params: Record<string, string>) {
        super(params);
        console.log('Route params for SinglePostView:', this.params);
        console.log('Route param "id" for SinglePostView:', this.params.id);
        this.setTitle('Single Post View');
    }

    async onInit(): Promise<void> {
        await this.loadPost();
    }

    async loadPost(): Promise<void> {
        if (!this.params.id) {
            console.error('Missing route param "id" for single post view');
            return;
        }

        try {
            this.post = (await fetchPost(this.params.id)) ?? undefined;
        } catch (error: unknown) {
            console.error('Error fetching post: ', error);
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        if (!this.post) {
            return `
                <h1 class="bg-yellow-500 text-3xl">Single Post View</h1>
                <p class="mt-4 text-red-500">Post not found.</p>
            `;
        }
        return `
            <h1 class="bg-yellow-500 text-3xl">Single Post View</h1>
            <div class="mt-4">
                <h2 class="text-2xl font-semibold">${escapeHtml(this.post.title)}</h2>
                <p class="mt-2 text-gray-700">${escapeHtml(this.post.description)}</p>
            </div>
        `;
    }
}
