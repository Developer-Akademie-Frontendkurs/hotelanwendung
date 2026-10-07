/**
 * Modales Popup über `<dialog>` und `showModal()` (V16, Q17).
 *
 * Fokusfang, Hintergrundsperre und Escape gibt es damit vom Browser. Das Popup kennt
 * **genau einen Ausgang**: Escape, ein Klick auf den Hintergrund und jedes Element mit
 * `data-modal-close` rufen alle dasselbe `onClose` – es gibt keinen Weg, der nur schließt
 * und etwas anderes tut.
 */

export type ModalOptions = {
    /** Inhalt des Popups als HTML-String – wird ungeprüft eingesetzt, Werte von außen also vorher mit `escapeHtml()` behandeln. */
    html: string;
    /** Beschriftet den Dialog für Screenreader – die `id` einer Überschrift im Inhalt. */
    labelledBy: string;
    onClose: () => void;
};

export function openModal(options: ModalOptions): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', options.labelledBy);
    dialog.className = 'm-auto w-[calc(100%-2rem)] max-w-[35rem] rounded-[0.8125rem] border-[0.5px] border-purple-haze bg-eggshell p-0 shadow-pic backdrop:bg-purple-haze-dark/60';
    // Der Innenabstand sitzt am Wrapper, nicht am Dialog: sonst träfe ein Klick in den
    // Rand ebenfalls den Dialog selbst und zählte als Klick auf den Hintergrund.
    dialog.innerHTML = /*html*/ `<div class="p-6 768:p-10">${options.html}</div>`;

    let closed = false;
    const close = (): void => {
        // Escape und Klick können beide feuern, bevor der Dialog weg ist.
        if (closed) return;
        closed = true;
        dialog.close();
        dialog.remove();
        options.onClose();
    };

    // Escape: Der Browser würde den Dialog nur schließen – hier läuft er in denselben Ausgang.
    dialog.addEventListener('cancel', (event: Event): void => {
        event.preventDefault();
        close();
    });
    dialog.addEventListener('click', (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        // Ein Klick auf den Hintergrund trifft den Dialog selbst, nicht seinen Inhalt.
        if (target === dialog || target.closest('[data-modal-close]') !== null) close();
    });

    document.body.append(dialog);
    dialog.showModal();
    return dialog;
}
