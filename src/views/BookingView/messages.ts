/**
 * Texte für Gründe und Ablehnungen aus der Datenbank (E28, E31).
 *
 * Beide Tabellen sind `Record` über den jeweiligen Union-Typ: Fehlt für einen Code der
 * Satz, ist das ein Compilerfehler – die Texte können nicht mehr auseinanderlaufen.
 */

import type { RejectionCode, UnavailableReason } from '../../shared/types/booking.codes';

/** Was neben dem Code in den Satz einfließt – Kategorie und Nacht, schon formatiert. */
export type RejectionContext = {
    roomName: string | null;
    /** Die betroffene Nacht, z. B. „12.10.2026", oder `null`, wenn die Datenbank keine nennt. */
    night: string | null;
};

/** Gäste sehen laut `mask_reason` nur `nicht_buchbar`, `vergangenheit` und `ausserhalb_horizont`; die feineren Gründe bekommt nur `is_staff()`. */
const UNAVAILABLE_REASON_TEXTS: Record<UnavailableReason, string> = {
    nicht_buchbar: 'Für diesen Zeitraum nicht buchbar.',
    vergangenheit: 'Der gewählte Zeitraum liegt in der Vergangenheit.',
    ausserhalb_horizont: 'Der gewählte Zeitraum liegt zu weit in der Zukunft.',
    ausgebucht: 'Für diesen Zeitraum ausgebucht.',
    kein_preis: 'Für diesen Zeitraum ist kein Preis hinterlegt.',
    zu_klein: 'Zu klein für die gewählte Belegung.',
};

/** Die Verfügbarkeit hat sich zwischen Anzeige und Buchen geändert – derselbe Satz für alle vier Gründe. */
function noLongerBookable({ roomName, night }: RejectionContext): string {
    const nightText = night === null ? '' : ` für die Nacht vom ${night}`;
    return `${roomName ?? 'Ihre Auswahl'} ist${nightText} leider nicht mehr buchbar. Wir haben die Verfügbarkeit aktualisiert – bitte prüfen Sie Ihre Auswahl.`;
}

const REJECTION_MESSAGES: Record<RejectionCode, (context: RejectionContext) => string> = {
    nicht_buchbar: noLongerBookable,
    ausgebucht: noLongerBookable,
    kein_preis: noLongerBookable,
    zu_klein: noLongerBookable,
    vergangenheit: (): string => UNAVAILABLE_REASON_TEXTS.vergangenheit,
    ausserhalb_horizont: (): string => UNAVAILABLE_REASON_TEXTS.ausserhalb_horizont,
    ungueltiger_zeitraum: (): string => 'Die Abreise muss nach der Anreise liegen.',
    kategorie_unbekannt: ({ roomName }: RejectionContext): string => `${roomName ?? 'Diese Zimmerkategorie'} kann derzeit nicht gebucht werden.`,
    ungueltige_belegung: (): string => 'Die gewählten Zimmer passen nicht zur Anzahl der Gäste.',
    ungueltige_leistung: (): string => 'Die gewählten Zusatzleistungen können so nicht gebucht werden.',
    leistung_unbekannt: (): string => 'Die gewählten Zusatzleistungen können so nicht gebucht werden.',
    ungueltige_adresse: (): string => 'Bitte prüfen Sie Ihre Adresse – sie ist unvollständig oder das Land wird nicht unterstützt.',
};

/** `null` heißt: ein Code, den die Oberfläche nicht kennt – dann der allgemeine Satz. */
export function formatUnavailableReason(reason: UnavailableReason | null): string {
    return reason === null ? UNAVAILABLE_REASON_TEXTS.nicht_buchbar : UNAVAILABLE_REASON_TEXTS[reason];
}

export function getRejectionMessage(code: RejectionCode | null, context: RejectionContext): string {
    if (code === null) return 'Die Buchung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.';
    return REJECTION_MESSAGES[code](context);
}
