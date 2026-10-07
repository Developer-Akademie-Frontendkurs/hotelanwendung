import { describe, expect, it } from 'vitest';
import { REJECTION_CODES, UNAVAILABLE_REASONS, isRejectionCode, isUnavailableReason } from '../../shared/types/booking.codes';
import { formatUnavailableReason, getRejectionMessage } from './messages';

const noContext = { roomName: null, night: null };

describe('Codes aus der Datenbank', () => {
    it('erkennt bekannte Codes und lehnt fremde ab', () => {
        expect(isRejectionCode('ausgebucht')).toBe(true);
        expect(isRejectionCode('ungueltige_adresse')).toBe(true);
        expect(isRejectionCode('neuer_code')).toBe(false);
        expect(isUnavailableReason('ungueltige_adresse')).toBe(false);
    });

    it('hat für jeden Code einen eigenen, nicht leeren Satz', () => {
        for (const code of REJECTION_CODES) expect(getRejectionMessage(code, noContext)).not.toBe('');
        for (const reason of UNAVAILABLE_REASONS) expect(formatUnavailableReason(reason)).not.toBe('');
    });
});

describe('getRejectionMessage', () => {
    it('nennt Kategorie und Nacht, wenn die Verfügbarkeit sich geändert hat', () => {
        expect(getRejectionMessage('ausgebucht', { roomName: 'Double Suite', night: '12.10.2026' })).toBe(
            'Double Suite ist für die Nacht vom 12.10.2026 leider nicht mehr buchbar. Wir haben die Verfügbarkeit aktualisiert – bitte prüfen Sie Ihre Auswahl.',
        );
    });

    it('fällt ohne Kategorie und Nacht auf „Ihre Auswahl" zurück', () => {
        expect(getRejectionMessage('nicht_buchbar', noContext)).toMatch(/^Ihre Auswahl ist leider nicht mehr buchbar\./);
    });

    it('nimmt für Vergangenheit und Horizont denselben Satz wie die Zimmerkarte', () => {
        expect(getRejectionMessage('vergangenheit', noContext)).toBe(formatUnavailableReason('vergangenheit'));
        expect(getRejectionMessage('ausserhalb_horizont', noContext)).toBe(formatUnavailableReason('ausserhalb_horizont'));
    });

    it('hat für unbekannte Codes einen allgemeinen Satz', () => {
        expect(getRejectionMessage(null, noContext)).toBe('Die Buchung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.');
    });
});

describe('formatUnavailableReason', () => {
    it('zeigt für unbekannte Gründe „nicht buchbar"', () => {
        expect(formatUnavailableReason(null)).toBe('Für diesen Zeitraum nicht buchbar.');
    });
});
