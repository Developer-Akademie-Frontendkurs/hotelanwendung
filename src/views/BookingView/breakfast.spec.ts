import { describe, expect, it } from 'vitest';
import { buildBreakfastService, getBreakfastAmountCents } from './breakfast';

const service = buildBreakfastService({ id: 'x', name: 'Frühstück', amount_cents: 1700, child_amount_cents: 850, currency: 'EUR' });

describe('getBreakfastAmountCents (E47, E48)', () => {
    it('rechnet für die Gäste des Vorgangs, nicht je Zimmer', () => {
        // 2 Erwachsene + 1 Kind, 3 Nächte – egal, auf wie viele Zimmer sie verteilt sind.
        expect(service).not.toBeNull();
        if (service === null) return;
        expect(getBreakfastAmountCents(service, { adults: 2, children: 1 }, 3)).toBe(3 * (2 * 1700 + 850));
    });

    it('lässt Kinder ohne eigenen Preis wie Erwachsene zahlen', () => {
        const ohneKinderpreis = buildBreakfastService({ id: 'x', name: 'Frühstück', amount_cents: 1700, child_amount_cents: null, currency: 'EUR' });
        expect(ohneKinderpreis?.childUnitAmountCents).toBe(1700);
    });
});
