import AbstractView from '../AbstractView';
import { Post } from './post.interface';
import { supabase } from '../../shared/services/supabase';

export default class extends AbstractView {
    posts: Post[] = [];

    constructor() {
        super();
        this.setTitle('Posts View');
    }

    async onInit(): Promise<void> {
        console.log('init');
        await this.fetchPosts();
        console.log('Posts: ', this.posts);
    }

    async fetchPosts(): Promise<void> {
        const { data, error } = await supabase.from('posts').select();

        if (error) {
            console.error('Error fetching posts: ', error);
            return;
        } else {
            this.posts = data as Post[];
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
                                <a href="/posts/${post.id}" data-link class="text-blue-500 hover:underline">
                                    ${post.title}
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
