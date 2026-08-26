import AbstractView from '../AbstractView';
import mainHeaderBg from '../../assets/img/main-header-bg.jpg';
import facebook from '../../assets/img/icons/facebook.svg';
import instagram from '../../assets/img/icons/instagram.svg';
import tripadvisor from '../../assets/img/icons/tripadvisor.svg';
import './layout.css';

export class MainLayout extends AbstractView {
    private readonly headerHtml: string;

    constructor(headerHtml: string) {
        super();
        this.headerHtml = headerHtml;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            ${this.headerHtml}

            <div id="content">

            </div>

            <footer id="footer" class="w-full bg-cover bg-center" style="background-image: url('${mainHeaderBg}')">
                <div class="w-full bg-eggshell/85">
                    <div class="w-full max-w-360 mx-auto px-6 768:px-12 py-10 768:py-14 flex flex-col 768:flex-row 768:justify-between gap-y-10 768:gap-y-0 text-center 768:text-left">

                        <div class="flex flex-col gap-y-6 items-center 768:items-start">
                            <h3 class="font-playfair-display text-20 768:text-24 text-purple-haze-dark">Kontakt</h3>
                            <address class="not-italic font-antic-didone text-16 768:text-18 text-purple-haze-dark leading-relaxed">
                                Karawanken Hof<br>
                                Kadischen Allee 3<br>
                                A – 3459 Villach
                            </address>
                            <div class="font-antic-didone text-16 768:text-18 text-purple-haze-dark leading-relaxed">
                                Tel: + 43 664 3228827<br>
                                E-Mail: anfrage@karawanken-hof.at
                            </div>
                        </div>

                        <nav class="flex flex-col gap-y-4 items-center 768:items-start font-antic-didone text-16 768:text-18 text-purple-haze-dark">
                            <a href="/impressum" class="hover:text-purple-haze" data-link>Impressum</a>
                            <a href="/datenschutz" class="hover:text-purple-haze" data-link>Datenschutz</a>
                            <a href="/agb" class="hover:text-purple-haze" data-link>AGB</a>
                            <a href="/sicherungsscheine" class="hover:text-purple-haze" data-link>Sicherungsscheine</a>
                            <a href="/newsletter" class="hover:text-purple-haze" data-link>Newsletter</a>
                        </nav>

                        <div class="flex flex-col gap-y-6 items-center">
                            <h3 class="font-playfair-display text-20 768:text-24 text-purple-haze-dark">Social Media</h3>
                            <div class="flex gap-x-4">
                                <a href="#" aria-label="TripAdvisor"><img src="${tripadvisor}" alt="TripAdvisor" class="w-10 h-10"></a>
                                <a href="#" aria-label="Facebook"><img src="${facebook}" alt="Facebook" class="w-10 h-10"></a>
                                <a href="#" aria-label="Instagram"><img src="${instagram}" alt="Instagram" class="w-10 h-10"></a>
                            </div>
                            <a href="/admin" class="border border-purple-haze rounded-2xl px-6 py-2 font-lato font-semibold text-purple-haze hover:bg-purple-haze hover:text-white transition-colors" data-link>
                                Mitarbeitenden-Login
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        `;
    }
}
