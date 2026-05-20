export default class {
    params: Record<string, string>;

    constructor(params: Record<string, string>) {
        this.params = params;
    }

    setTitle(title: string): void {
        document.title = title;
    }

    async onInit() {}

    async getHtml(): Promise<string> {
        return ``;
    }
}
