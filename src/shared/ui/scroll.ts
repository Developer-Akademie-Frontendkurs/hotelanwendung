/**
 * Scrollt zu einem Abschnitt der Seite, sanft nur ohne `prefers-reduced-motion`.
 * Den Abstand zum Sticky-Header regelt `scroll-mt-*` am Ziel.
 */
export function scrollToSection(targetId: string): void {
    const target = document.getElementById(targetId);
    if (!target) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}
