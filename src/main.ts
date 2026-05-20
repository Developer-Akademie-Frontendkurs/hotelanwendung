import './style.css';
import { createClient } from '@supabase/supabase-js';
import Home from './views/HomeView/Home';
import Posts from './views/PostsView/Posts';
import About from './views/AboutView/About';
import AdminLayout from './views/LayoutViews/AdminLayout';
import MainLayout from './views/LayoutViews/MainLayout';
import AdminDashboard from './views/admin/AdminDashboardView/AdminDashboard';
import AdminPosts from './views/admin/AdminPostsView/AdminPosts';

//eslint-disable-next-line prettier/prettier
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
    const layoutWrapper: HTMLElement | null = document.getElementById('layout-wrapper');
    const locationPath: string = location.pathname;

    if (!layoutWrapper) {
        throw new Error('Fehler beim Laden der Seite');
    } else if (locationPath.endsWith('/')) {
        const correctedLocationPath = locationPath.slice(0, -1);
        console.log('corrected path: ', correctedLocationPath);
        navigateTo(correctedLocationPath);
        return;
    } else if (locationPath.startsWith('/admin')) {
        layoutWrapper.innerHTML = await new AdminLayout().getHtml();
    } else {
        layoutWrapper.innerHTML = await new MainLayout().getHtml();
    }

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
        { path: '/admin', view: AdminDashboard },
        { path: '/admin/posts', view: AdminPosts },
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
    const contentContainer: HTMLElement | null = document.getElementById('content');
    if (contentContainer) {
        contentContainer.innerHTML = await view.getHtml();
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
