import AbstractView from '../AbstractView';
import logo from '../../assets/img/logo.svg';
import './layout.css';

export class MainLayout extends AbstractView {
    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <section class="min-h-dvh bg-[url('/assets/img/main-header-bg.jpg')] bg-cover bg-center">
                <header class="mobile-menu w-full max-w-360 min-h-screen mx-auto">
                    <a href="/" data-link><img src="${logo}" alt="Karawanken Hof Logo"></a>
                    <div id="mobile-menu" class="flex 768:hidden gap-x-4">
                            <nav class="flex gap-4 items-center">
                                <a href="/buchung" class="hidden 456:inline bg-purple-haze px-3 py-1 rounded-2xl font-lato text-18 font-semibold text-white opacity-85 hover:opacity-100" data-link>Buchung</a>
                                <input id="mobile-menu-checkbox" type="checkbox" class="mobile-menu__checkbox">
                                <label class="mobile-menu__btn" for="mobile-menu-checkbox">
                                    <div class="mobile-menu__icon"></div>
                                </label>
                                <div class="mobile-menu__container">
                                    <ul class="mobile-menu__list">
                                        <li class="mobile-menu__item"><a href="/" class="mobile-menu__link border-b-2 border-transparent hover:border-purple-haze" data-link>Startseite</a></li>
                                        <li class="mobile-menu__item"><a href="/about" class="mobile-menu__link border-b-2 border-transparent hover:border-purple-haze" data-link>Über uns</a></li>
                                        <li class="mobile-menu__item 456:hidden"><a href="/buchung" class="bg-purple-haze px-3 py-2 rounded-2xl font-lato text-18 font-semibold text-white opacity-85 hover:opacity-100" data-link>Buchen</a></li>
                                    </ul>
                                </div>
                            </nav>
                        </div>

                        <div id="desktop-menu" class="hidden 768:flex">
                            <nav>
                                <ul class="flex gap-x-16">
                                    <li><a href="/" class="border-b-2 border-transparent hover:border-purple-haze font-playfair text-24 text-purple-haze" data-link>Startseite</a></li>
                                    <li><a href="/about" class="border-b-2 border-transparent hover:border-purple-haze font-playfair text-24 text-purple-haze" data-link>Über uns</a></li>
                                    <li><a href="/buchung" class="bg-purple-haze py-1 px-3 rounded-2xl font-lato text-white text-24 font-medium opacity-85 hover:opacity-100" data-link>Buchen</a></li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                </header>
            </section>

            <div id="content">

            </div>

            <div id="footer">
                <p>Copyright © 2024</p>
            </div>
        `;
    }
}
