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

type Route = StaticRoute | DynamicRoute;

interface Match {
    route: Route;
    result: RegExpMatchArray | null;
}

/**
 * Schritt 14-1: Konvertiert ein Routenmuster in einen RegExp-Ausdruck, um auch dynamische Pfade zu matchen.
 *
 * Beispiele mit einzelnen Parametern:
 * - '/posts/:id' wird zu /^\/posts\/([^/]+)$/
 *   Matcht: '/posts/1', '/posts/abc'
 *   Matcht NICHT: '/posts/1/comments/2'
 *
 * Beispiele mit mehreren Parametern:
 * - '/posts/:id/comments/:commentId' wird zu /^\/posts\/([^/]+)\/comments\/([^/]+)$/
 *   Matcht: '/posts/1/comments/2', '/posts/abc/comments/xyz'
 *   Parameter werden extrahiert als: { id: '1', commentId: '2' }
 * - '/posts/:id/comments/:commentId/replies/:replyId'
 *   Matcht: '/posts/1/comments/2/replies/3'
 *   Parameter werden extrahiert als: { id: '1', commentId: '2', replyId: '3' }
 *
 * So funktioniert der Aufbau des RegEx:
 * 1. '^' markiert den Start des Strings (es muss am Anfang passen).
 * 2. Alle '/' werden zu '\/' escaped, damit sie als literale Slash-Zeichen gelten.
 * 3. JEDES ':parameter' wird durch '([^/]+)' ersetzt.
 *    - '([^/]+)' ist eine Capture Group und nimmt den dynamischen Wert auf.
 *    - '[^/]' bedeutet "alles außer Slash" und '+' bedeutet "mindestens eins".
 *    - Der Parameter stoppt also beim nächsten Slash und matcht nicht über Pfadsegmente hinweg.
 * 4. '$' markiert das Ende des Strings (es muss bis zum Ende passen).
 *
 * Wichtig zur Reihenfolge: Die Parameter werden in der Reihenfolge extrahiert, in der sie in der Route definiert sind.
 * Dies muss mit der Reihenfolge der Capture Groups in der generierten Regex übereinstimmen.
 *
 * @param path Routenmuster, z.B. '/posts/:id' oder '/posts/:id/comments/:commentId'
 * @returns Ein RegExp, der den gesamten Pfad gegen das Muster prüft.
 */
const pathToRegex: (path: string) => RegExp = (path: string): RegExp => new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '([^/]+)') + '$');

/**
 * Extrahiert die dynamischen Parameter einer gematchten Route als Objekt.
 *
 * Beispiele:
 * - Route: '/posts/:id', URL: '/posts/2'
 *   RegEx-Match: ['/posts/2', '2']
 *   Ergebnis: { id: '2' }
 *
 * - Route: '/posts/:id/comments/:commentId', URL: '/posts/1/comments/42'
 *   RegEx-Match: ['/posts/1/comments/42', '1', '42']
 *   Ergebnis: { id: '1', commentId: '42' }
 *
 * So funktioniert die Funktion:
 * 1. `match.result.slice(1)` entfernt den kompletten Treffer an Index 0.
 *    Übrig bleiben nur die Werte aus den Capture Groups, z.B. ['2'] oder ['1', '42'].
 * 2. `match.route.path.matchAll(/:(\w+)/g)` sucht im Routenmuster alle Platzhalter wie ':id' oder ':commentId'.
 *    Durch die Capture Group `(\w+)` wird nur der Parametername ohne Doppelpunkt extrahiert.
 * 3. `keys.map(...)` ordnet jeden Parameternamen dem Wert mit demselben Index zu.
 * 4. `Object.fromEntries(...)` baut daraus ein Objekt wie `{ id: '2' }` oder `{ id: '1', commentId: '42' }`.
 *
 * Wichtig ist dabei die Reihenfolge: Die Capture Groups im RegEx und die gefundenen
 * Parameternamen aus der Route müssen in derselben Reihenfolge vorliegen.
 *
 * @param match Das Match-Objekt mit Route und Ergebnis des RegEx-Abgleichs.
 * @returns Ein Objekt mit den extrahierten Routenparametern, z.B. `{ id: '2' }` oder `{ id: '1', commentId: '42' }`.
 */
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
    } else if (locationPath.length > 1 && locationPath.endsWith('/')) {
        const correctedLocationPath = locationPath.slice(0, -1);
        console.log('corrected path: ', correctedLocationPath);
        navigateTo(correctedLocationPath);
        return;
    } else if (locationPath.startsWith('/admin')) {
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
