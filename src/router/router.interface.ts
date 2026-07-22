export type Params = Record<string, string>;

export type ViewInstance = {
    setTitle: (title: string) => void;
    onInit: () => Promise<void>;
    getHtml: () => Promise<string>;
    afterRender: () => Promise<void>;
};

export type StaticRoute = {
    path: string;
    kind: 'static';
    view: new () => ViewInstance;
};

export type DynamicRoute = {
    path: string;
    kind: 'dynamic';
    view: new (params: Params) => ViewInstance;
};

export type Route = StaticRoute | DynamicRoute;

export interface Match {
    route: Route;
    result: RegExpMatchArray | null;
}
