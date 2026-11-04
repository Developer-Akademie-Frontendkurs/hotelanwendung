import type { RejectionCode, UnavailableReason } from '../../shared/types/booking.codes';

export type RejectionContext = {
    roomName: string | null;
    night: string | null;
};

const UNAVAILABLE_REASON_TEXTS: Record<UnavailableReason, string> = {
    nicht_buchbar: 'Für diesen Zeitraum nicht buchbar.',
    vergangenheit: 'Der gewählte Zeitraum liegt in der Vergangenheit.',
    ausserhalb_horizont: 'Der gewählte Zeitraum liegt zu weit in der Zukunft.',
    ausgebucht: 'Für diesen Zeitraum ausgebucht.',
    kein_preis: 'Für diesen Zeitraum ist kein Preis hinterlegt.',
    zu_klein: 'Zu klein für die gewählte Belegung.',
};

const NIGHT_BLOCKED_TEXTS: Record<UnavailableReason, string> = {
    nicht_buchbar: 'Anreise nicht möglich – für diese Nacht ist keine Buchung möglich.',
    vergangenheit: 'Dieser Tag liegt in der Vergangenheit.',
    ausserhalb_horizont: 'So weit im Voraus nehmen wir noch keine Buchungen an.',
    ausgebucht: 'Anreise nicht möglich – diese Nacht ist ausgebucht.',
    kein_preis: 'Anreise nicht möglich – für diese Nacht ist kein Preis hinterlegt.',
    zu_klein: 'Anreise nicht möglich – für die gewählte Belegung ist in dieser Nacht nichts frei.',
};

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

export function formatUnavailableReason(reason: UnavailableReason | null): string {
    return reason === null ? UNAVAILABLE_REASON_TEXTS.nicht_buchbar : UNAVAILABLE_REASON_TEXTS[reason];
}

export function getRejectionMessage(code: RejectionCode | null, context: RejectionContext): string {
    if (code === null) return 'Die Buchung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.';
    return REJECTION_MESSAGES[code](context);
}

export function formatBlockedNight(day: string, reason: UnavailableReason): string {
    return `${day}: ${NIGHT_BLOCKED_TEXTS[reason]}`;
}

const AVAILABILITY_REJECTIONS: ReadonlySet<RejectionCode> = new Set<RejectionCode>(['nicht_buchbar', 'ausgebucht', 'kein_preis', 'zu_klein']);

export type RejectionHints = {
    room: string;
    calendar: string | null;
};

export function getRejectionHints(code: RejectionCode | null, night: string | null): RejectionHints | null {
    if (code === null || !AVAILABILITY_REJECTIONS.has(code)) return null;
    return {
        room: night === null ? 'Nicht mehr buchbar – bitte prüfen Sie Ihre Auswahl.' : `Für die Nacht vom ${night} nicht mehr buchbar.`,
        calendar: night === null ? null : `Die Nacht vom ${night} ist nicht mehr buchbar – bitte prüfen Sie Ihren Zeitraum.`,
    };
}
