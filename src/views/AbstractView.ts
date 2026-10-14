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

    /**
     * Räumt auf, bevor der Router die nächste Seite rendert: Abos lösen, Zustand
     * zurücksetzen, der nur zu dieser Seite gehört. Der Router ruft das genau einmal je
     * Instanz auf; danach wird sie nicht mehr angezeigt.
     */
    destroy(): void {}
}
