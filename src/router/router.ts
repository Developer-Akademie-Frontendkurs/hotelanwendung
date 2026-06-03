import { Match, Params, Route, ViewInstance } from './router.interface';
import { AdminLayout } from '../views/LayoutViews/AdminLayout';
import { MainLayout } from '../views/LayoutViews/MainLayout';

export class Router {
    private readonly routes: Route[];
    private readonly layoutWrapper: HTMLElement | null;

    constructor(routes: Route[], layoutWrapper: HTMLElement | null) {
        this.routes = routes;
        this.layoutWrapper = layoutWrapper;
    }

    async init(): Promise<void> {
        window.addEventListener('popstate', (): void => {
            void this.render();
        });
        document.addEventListener('click', (event: MouseEvent): void => {
            void this.handleLinkClick(event);
        });

        await this.render();
    }

    private pathToRegex: (path: string) => RegExp = (path: string): RegExp => new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '([^/]+)') + '$');

    getParams: (match: Match) => Params = (match: Match): Params => {
        const values: string[] = match.result?.slice(1) || [];
        const keys: string[] = Array.from(match.route.path.matchAll(/:(\w+)/g)).map((result: RegExpMatchArray) => result[1] || '');

        console.log(
            'match Array: ',
            Array.from(match.route.path.matchAll(/:(\w+)/g)).map((result: RegExpMatchArray) => result[1]),
        );

        return Object.fromEntries(
            keys.map((key: string, i: number): [string, string] => {
                return [key, values[i] || ''];
            }),
        );
    };

    async navigateTo(path: string): Promise<void> {
        if (window.location.pathname === path) return;
        history.pushState(null, '', path);
        await this.render();
    }

    async render(): Promise<void> {
        const locationPath: string = window.location.pathname;
        const potentialMatches: Match[] = this.getPotentialMatches(locationPath);
        let match: Match | undefined = potentialMatches.find((match: Match): boolean => match.result !== null);

        if (!match) {
            const fallbackRoute: Route | undefined = this.routes[0];
            if (!fallbackRoute) {
                throw new Error('Fehler beim Laden!');
            }
            match = {
                route: fallbackRoute,
                result: [locationPath],
            };
        }

        await this.getBaseLayout(locationPath);

        const contentContainer: HTMLElement | null = document.getElementById('content');
        if (!contentContainer) {
            throw new Error('Fehler beim Laden der Seite');
        }

        const view: ViewInstance = match.route.kind === 'dynamic' ? new match.route.view(this.getParams(match)) : new match.route.view();
        await view.onInit();
        contentContainer.innerHTML = await view.getHtml();
        // await view.afterRender();
    }

    private async getBaseLayout(locationPath: string): Promise<void> {
        if (!this.layoutWrapper) {
            throw new Error('Fehler beim Laden der Seite');
        } else if (locationPath.length > 1 && locationPath.endsWith('/')) {
            const correctedLocationPath = locationPath.slice(0, -1);
            console.log('corrected path: ', correctedLocationPath);
            await this.navigateTo(correctedLocationPath);
            return;
        } else if (locationPath.startsWith('/admin')) {
            this.layoutWrapper.innerHTML = await new AdminLayout().getHtml();
        } else {
            this.layoutWrapper.innerHTML = await new MainLayout().getHtml();
        }
    }

    private getPotentialMatches(locationPath: string): Match[] {
        return this.routes.map((route: Route): Match => {
            return {
                route,
                result: locationPath.match(this.pathToRegex(route.path)),
            };
        });
    }

    private async handleLinkClick(event: MouseEvent): Promise<void> {
        if ((event.target as HTMLElement).matches('a[data-link]')) {
            event.preventDefault();
            await this.navigateTo((event.target as HTMLAnchorElement).href);
        }
    }
}
