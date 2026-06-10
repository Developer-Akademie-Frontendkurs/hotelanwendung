import AbstractView from '../AbstractView';

export class HomeView extends AbstractView {
    constructor() {
        super();
        this.setTitle('Start Seite View');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <h1 class="bg-yellow-500 text-3xl">Start Seite View</h1>
            <p class="py-8 text-[24px] font-lato">Diese Datei ist die Haupt-HTML-Datei für die Startseite der Hotelanwendung. Sie enthält die grundlegende Struktur der Seite, einschließlich des Head-Bereichs mit Meta-Tags und des Body-Bereichs, in dem der Inhalt der Seite angezeigt wird. Das Skript am Ende lädt die Haupt-Typescript-Datei, die für die Funktionalität der Seite verantwortlich ist.</p>
            <p class="py-8 text-[24px] font-antic-didone">Diese Datei ist die Haupt-HTML-Datei für die Startseite der Hotelanwendung. Sie enthält die grundlegende Struktur der Seite, einschließlich des Head-Bereichs mit Meta-Tags und des Body-Bereichs, in dem der Inhalt der Seite angezeigt wird. Das Skript am Ende lädt die Haupt-Typescript-Datei, die für die Funktionalität der Seite verantwortlich ist.</p>
            <p class="py-8 text-[24px] font-playfair-display">Diese Datei ist die Haupt-HTML-Datei für die Startseite der Hotelanwendung. Sie enthält die grundlegende Struktur der Seite, einschließlich des Head-Bereichs mit Meta-Tags und des Body-Bereichs, in dem der Inhalt der Seite angezeigt wird. Das Skript am Ende lädt die Haupt-Typescript-Datei, die für die Funktionalität der Seite verantwortlich ist.</p>
        `;
    }
}
