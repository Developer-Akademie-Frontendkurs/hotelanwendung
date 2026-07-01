import AbstractView from '../AbstractView';
import logo from '../../assets/img/logo.svg';
import stars from '../../assets/img/icons/stars.png';
import './layout.css';

export class MainLayout extends AbstractView {
    // eslint-disable-next-line @typescript-eslint/require-await
    async getHtml(): Promise<string> {
        return /*html*/ `
            <header class="mobile-menu bg-[url('./assets/img/main-header-bg.jpg')] bg-cover bg-center">
                <div class="w-full max-w-360 min-h-screen mx-auto">
                    <div class="w-full flex items-center justify-between pt-4">
                        <img src="${logo}" alt="Karawanken Hof Logo">

                        <div id="mobile-menu" class="flex gap-x-4">
                            <nav class="768:hidden flex gap-4 items-center">
                                <a href="/buchung" class="hidden 456:inline bg-purple-haze px-3 py-1 rounded-2xl font-lato text-18 font-semibold text-white opacity-85 hover:opacity-100" data-link>Buchen</a>
                                <input id="mobile-menu-checkbox" type="checkbox" class="mobile-menu__checkbox">
                                <label class="mobile-menu__btn" for="mobile-menu-checkbox">
                                    <div class="mobile-menu__icon"></div>
                                </label>
                                <div class="mobile-menu__container">
                                    <ul class="mobile-menu__list">
                                        <li class="mobile-menu__item"><a href="/" class="mobile-menu__link border-b-2 border-transparent hover:border-purple-haze" data-link>Startseite</a></li>
                                        <li class="mobile-menu__item"><a href="/about" class="mobile-menu__link border-b-2 border-transparent hover:border-purple-haze" data-link>Über uns</a></li>
                                        <li class="mobile-menu__item"><a href="/buchung" class="456:hidden bg-purple-haze px-3 py-2 rounded-2xl font-lato text-18 font-semibold text-white opacity-85 hover:opacity-100" data-link>Buchen</a></li>
                                    </ul>
                                </div>
                            </nav>
                        </div>

                        <div id="desktop-menu" class="hidden 768:block">
                            <nav>
                                <ul class="flex gap-x-16">
                                    <li><a href="/" class="border-b-2 border-transparent hover:border-purple-haze font-playfair text-24 text-purple-haze" data-link>Startseite</a></li>
                                    <li><a href="/about" class="border-b-2 border-transparent hover:border-purple-haze font-playfair text-24 text-purple-haze" data-link>Über uns</a></li>
                                    <li><a href="/buchung" class="bg-purple-haze py-2 px-3 rounded-2xl font-lato text-white text-24 font-semibold opacity-85 hover:opacity-100" data-link>Buchen</a></li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                    <div class="flex flex-col gap-y-4 items-center mt-12">
                        <img src="${stars}" alt="Stars">
                        <h1 class="font-playfair-display font-semibold text-32 576:text-48 992:text-64 text-purple-haze">Luxus in den Alpen</h1>
                        <p class="font-caveat text-28 576:text-32 992:text-48 text-purple-haze text-center leading-none">
                            wo sich Fuchs und Hase <br>gute Nacht sagen
                        </p>
                    </div>
                </div>
            </header>

            <div id="content">

            </div>

            <div id="footer">
                <p>Copyright © 2024</p>
            </div>
        `;
    }
}
