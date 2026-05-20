import './style.css';
import Home from './views/HomeView/Home';
import Posts from './views/PostsView/Posts';
import SinglePost from './views/PostsView/SinglePostView/SinglePost';
import About from './views/AboutView/About';
import AdminLayout from './views/LayoutViews/AdminLayout';
import MainLayout from './views/LayoutViews/MainLayout';
import AdminDashboard from './views/admin/AdminDashboardView/AdminDashboard';
import AdminPosts from './views/admin/AdminPostsView/AdminPosts';

type Params = Record<string, string>;

export type ViewInstance = {
    setTitle: (title: string) => void;
    onInit: () => Promise<void>;
    getHtml: () => Promise<string>;
};

type StaticRoute = {
    path: string;
    kind: 'static';
    view: new () => ViewInstance;
};

type DynamicRoute = {
    path: string;
    kind: 'static';
    view: new (params: Params) => ViewInstance;
};

type Route = Static | DynamicRoute;

interface Match {
    route: Route;
    result: RegExpMatchArray | null;
}

const pathToRegex: (path: string) => RegExp = (path: string): RegExp => new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '(.+)') + '$');

const getParams: (match: Match) => Params = (match: Match): Params => {
    const values: string[] = match.result.slice(1);
    const keys: string[] = Array.from(match.route.path.matchAll(/:(\w+)/g)).map((result: RegExpMatchArray) => result[1]);

    console.log(
        'match Array: ',
        Array.from(match.route.path.matchAll(/:(\w+)/g)).map((result: RegExpMatchArray) => result[1]),
    );

    return Object.fromEntries(
        keys.map((key: string, i: number): [string, string] => {
            return [key, values[i]];
        }),
    );
};

const navigateTo: (url: string) => void = (url: string): void => {
    history.pushState(null, '', url);
    void router();
};

const router: () => void = async (): Promise<void> => {
    const layoutWrapper: HTMLElement | null = document.getElementById('layout-wrapper');
    const locationPath: string = location.pathname;

    if (!layoutWrapper) {
        throw new Error('Fehler beim Laden der Seite');
    } //else if (locationPath.endsWith('/')) {
        //const correctedLocationPath = locationPath.slice(0, -1);
        //console.log('corrected path: ', correctedLocationPath);
        //navigateTo(correctedLocationPath);
        //return;
    //}
    else if (locationPath.startsWith('/admin')) {
        layoutWrapper.innerHTML = await new AdminLayout().getHtml();
    } else {
        layoutWrapper.innerHTML = await new MainLayout().getHtml();
    }

    console.log('path to regex: ', pathToRegex('/posts/:id'));
    console.log('path: /posts/1 to regex: ', '/posts/2'.match(pathToRegex('/posts/:id')));

    const routes: Route[] = [
        {
            path: '/',
            kind: 'static',
            view: Home,
        },
        {
            path: '/posts',
            kind: 'static',
            view: Posts,
        },
        {
            path: '/posts/:id',
            kind: 'dynamic',
            view: SinglePost,
        },
        {
            path: '/about',
            kind: 'static',
            view: About,
        },
        {
            path: '/admin',
            kind: 'static',
            view: AdminDashboard,
        },
        {
            path: '/admin/posts',
            kind: 'static',
            view: AdminPosts,
        },
    ];

    const potentialMatches: Match[] = routes.map((route: Route): Match => {
        return {
            route: route,
            result: location.pathname.match(pathToRegex(route.path)),
        };
    });

    let match: Match | undefined = potentialMatches.find((match: Match): boolean => match.result !== null);

    if (!match) {
        const fallbackRoute: Route | undefined = routes[0];
        if (!fallbackRoute) {
            throw new Error('Fehler beim Laden!');
        }
        match = {
            route: fallbackRoute,
            result: [location.pathname],
        };
    }

    const view: ViewInstance = new match.route.view(getParams(match));
    const contentContainer: HTMLElement | null = document.getElementById('content');
    if (contentContainer) {
        await view.onInit();
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
