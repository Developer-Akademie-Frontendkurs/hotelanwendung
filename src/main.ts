import './style.css';
import { createClient } from '@supabase/supabase-js';
import Home from './views/HomeView/Home';
import Posts from './views/PostsView/Posts';
import About from './views/AboutView/About';

// eslint-disable-next-line prettier/prettier
// const supabase = createClient(import.meta.env.VITE_SUPABASE_URL,
//     import.meta.env.VITE_SUPABASE_API_KEY,
// );

type ViewInstance = {
    setTitle: (title: string) => void;
    getHTML: () => Promise<string>;
};

interface Route {
    path: string;
    view: new () => ViewInstance;
}

interface Match {
    route: Route;
    isMatch: boolean;
}

const navigateTo: (url: string) => void = (url: string): void => {
    history.pushState(null, '', url);
    void router();
};

const router: () => void = async (): Promise<void> => {
    const routes: Route[] = [
        {
            path: '/',
            view: Home,
        },
        {
            path: '/posts',
            view: Posts,
        },
        {
            path: '/about',
            view: About,
        },
    ];

    const potentialMatches: Match[] = routes.map((route: Route): Match => {
        return {
            route: route,
            isMatch: location.pathname === route.path,
        };
    });

    let match: Match | undefined = potentialMatches.find((potentialMatch: Match): boolean => potentialMatch.isMatch);

    if (!match) {
        const fallbackRoute: Route | undefined = routes[0];
        if (!fallbackRoute) {
            throw new Error('Fehler beim Laden!');
        }
        match = {
            route: fallbackRoute,
            isMatch: true,
        };
    }

    const view: ViewInstance = new match.route.view();
    const appContainer: HTMLElement | null = document.getElementById('app');
    if (appContainer) {
        appContainer.innerHTML = await view.getHtml();
    } else {
        throw new Error('Fehler beim Laden der Seite');
    }

    console.log('potential Matches: ', potentialMatches);
    console.log('Match: ', match);
    console.log('match path:', match.route.path);
};

window.addEventListener('popstate', () => void router());

document.addEventListener('DOMContentLoaded', (): void => {
    document.body.addEventListener('click', (event: MouseEvent): void => {
        if ((event.target as HTMLElement).matches('[data-link]')) {
            event.preventDefault();
            navigateTo((event.target as HTMLElement).href);
        }
    });

    router();
});
