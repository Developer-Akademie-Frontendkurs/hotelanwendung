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

/**
 * Tooltip an einem gesperrten Kalendertag (E24) – über die Nacht, die an diesem Tag
 * beginnt. Gäste sehen fast immer `nicht_buchbar` (E28): Der Satz muss also ohne feine
 * Unterscheidung etwas sagen.
 */
const NIGHT_BLOCKED_TEXTS: Record<UnavailableReason, string> = {
    nicht_buchbar: 'Anreise nicht möglich – für diese Nacht ist keine Buchung möglich.',
    vergangenheit: 'Dieser Tag liegt in der Vergangenheit.',
    ausserhalb_horizont: 'So weit im Voraus nehmen wir noch keine Buchungen an.',
    ausgebucht: 'Anreise nicht möglich – diese Nacht ist ausgebucht.',
    kein_preis: 'Anreise nicht möglich – für diese Nacht ist kein Preis hinterlegt.',
    zu_klein: 'Anreise nicht möglich – für die gewählte Belegung ist in dieser Nacht nichts frei.',
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

/** Der Tooltip eines gesperrten Tages, z. B. „24.10.2026: Anreise nicht möglich – …". */
export function formatBlockedNight(day: string, reason: UnavailableReason): string {
    return `${day}: ${NIGHT_BLOCKED_TEXTS[reason]}`;
}

/** Ablehnungen, die heißen: Die Verfügbarkeit hat sich zwischen Anzeige und Buchen geändert. */
const AVAILABILITY_REJECTIONS: ReadonlySet<RejectionCode> = new Set<RejectionCode>(['nicht_buchbar', 'ausgebucht', 'kein_preis', 'zu_klein']);

/** Die Hinweise am Ort des Problems (Phase 9b, Punkt 8) – zusätzlich zur Meldung am Buchen-Knopf. */
export type RejectionHints = {
    /** An der Zimmerkarte der abgelehnten Kategorie. */
    room: string;
    /** Unter dem Kalender – nur, wenn die Datenbank eine Nacht nennt. */
    calendar: string | null;
};

/**
 * `null` für Ablehnungen, die nichts mit Karte und Kalender zu tun haben (Adresse,
 * Leistungen, Belegung) – die stehen nur am Buchen-Knopf.
 */
export function getRejectionHints(code: RejectionCode | null, night: string | null): RejectionHints | null {
    if (code === null || !AVAILABILITY_REJECTIONS.has(code)) return null;
    return {
        room: night === null ? 'Nicht mehr buchbar – bitte prüfen Sie Ihre Auswahl.' : `Für die Nacht vom ${night} nicht mehr buchbar.`,
        calendar: night === null ? null : `Die Nacht vom ${night} ist nicht mehr buchbar – bitte prüfen Sie Ihren Zeitraum.`,
    };
}
