[← Vorheriger Commit](005_2026-05-20_layout-wrapper-views.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [📓 Index](../000_index.md)

# Posts-Routing und Supabase-Datenabruf

- **Commit:** `ee8d018`
- **Datum:** 2026-05-20
- **Autor:** Oliver Jung

## Worum geht es?

Jetzt werden echte Daten geladen. Die `Posts`-View holt eine Liste von Beiträgen aus **Supabase** und zeigt sie an. Außerdem entsteht eine `SinglePost`-View für die Detailansicht eines einzelnen Beitrags. Dafür wird ein zentraler Supabase-Service ausgelagert und ein `Post`-Interface definiert.

## Die Änderungen im Detail

### `src/shared/services/supabase.ts` – zentraler Client

Der Supabase-Client wird an einer Stelle erzeugt und überall importiert. So existiert nur eine einzige Verbindungskonfiguration.

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient('https://...supabase.co', 'sb_publishable_...');
```

### `src/views/PostsView/post.interface.ts` – die Datenform

Ein TypeScript-Interface beschreibt, wie ein Post aussieht. Damit ist überall klar, welche Felder verfügbar sind.

```ts
export interface Post {
    id: string;
    title: string;
    desciption: string;
}
```

### `src/views/PostsView/Posts.ts` – Daten laden und rendern

Die View lädt in `onInit()` die Posts und baut in `getHtml()` daraus eine Liste mit Links zur Detailansicht (`/posts/<id>`).

```ts
import AbstractView from '../AbstractView';
import Post from './post.interface';
import { supabase } from '../../shared/services/supabase';

export default class extends AbstractView {
    posts: Post[] = [];

    async onInit() {
        await this.fetchPosts();
    }

    async fetchPosts() {
        const { data, error } = await supabase.from('posts').select();
        if (error) {
            console.error('Error fetching posts: ', error);
        } else {
            this.posts = data as Post[];
        }
    }

    async getHtml(): Promise<string> {
        return `
            <h1 class="bg-yellow-500 text-3xl">Posts View</h1>
            <ul>
            ${this.posts
                .map((post) => `
                    <li class="mb-2">
                        <strong>
                            <a href="/posts/${post.id}" data-link class="text-blue-500 hover:underline">
                                ${post.title}
                            </a>
                        </strong>
                    </li>
                `)
                .join('')}
            </ul>
        `;
    }
}
```

Das Muster `supabase.from('posts').select()` ist die typische Supabase-Abfrage: Sie liefert ein Objekt mit `data` und `error`, die man getrennt behandelt.

### `src/views/PostsView/SinglePostView/SinglePost.ts` – Detailansicht

Die Detail-View bekommt über Route-Parameter eine `id` und lädt damit genau einen Beitrag (`.eq('id', ...).single()`).

```ts
export default class extends AbstractView {
    post: Post | undefined;

    constructor(params: Record<string, string>) {
        super(params);
        this.setTitle('Single Post View');
    }

    async onInit() {
        await this.fetchPost();
    }

    async fetchPost() {
        if (!this.params.id) return;
        const { data, error } = await supabase.from('posts').select().eq('id', this.params.id).single();
        if (error) return;
        this.post = data;
    }
}
```

## Was wurde erreicht?

Die Anwendung zeigt jetzt echte, aus Supabase geladene Daten an – sowohl als Liste als auch in einer Detailansicht. Damit ist klar geworden, dass für die Detailseiten **dynamische Routen** (mit `:id`) gebraucht werden, was im nächsten Commit umgesetzt wird.

---

[📓 Index](../000_index.md) · [↑ Branch-Übersicht](../002_2026-05-06_spa-struktur.md) · [Nächster Commit →](007_2026-05-21_branch-diary-session-entries.md)
