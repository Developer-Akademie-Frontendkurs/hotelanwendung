import AbstractView from '../../AbstractView';
import { Post } from './../post.interface';
import { supabase } from '../../../shared/services/supabase';

export default class extends AbstractView {
    post: Post | undefined;

    constructor(params: Record<string, string>) {
        super(params);
        console.log('Route params for SinglePostView:', this.params);
        console.log('Route param "id" for SinglePostView:', this.params.id);
        this.setTitle('Single Post View');
    }

    async onInit(): Promise<void> {
        await this.fetchPost();
    }

    async fetchPost(): Promise<void> {
        if (!this.params.id) {
            console.error('Missing route param "id" for single post view');
            return;
        }

        const { data, error } = await supabase.from('posts').select().eq('id', this.params.id).single();

        if (error) {
            console.error('Error fetching post: ', error);
            return;
        }
        this.post = data as Post;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">Single Post View</h1>
            <div class="mt-4">
                <h2 class="text-2xl font-semibold">${this.post.title}</h2>
                <p class="mt-2 text-gray-700">${this.post.description}</p>
            </div>
        `;
    }
}
