/**
 * Schutz gegen XSS in den String-Templates.
 *
 * Alles, was nicht im Quelltext steht – Datenbank, URL, Eingaben, Fehlermeldungen –, geht
 * nur über `escapeHtml()` in ein Template. Das gilt für Text wie für Attributwerte
 * (immer in doppelten Anführungszeichen). Eingaben des Gastes setzen wir weiterhin
 * per `textContent`; das braucht keinen Escape.
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char: string): string => HTML_ESCAPES[char] ?? char);
}
