export default class {
    params: Record<string, string>;

    constructor(params: Record<string, string> = {}) {
        this.params = params;
    }

    setTitle(title: string): void {
        document.title = title;
    }

    async onInit(): Promise<void> {}

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return ``;
    }

    async afterRender(): Promise<void> {}
}
