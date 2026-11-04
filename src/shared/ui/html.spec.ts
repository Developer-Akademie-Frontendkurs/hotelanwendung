import { describe, expect, it } from 'vitest';
import { escapeHtml } from './html';

describe('escapeHtml', () => {
    it('entschärft Tags', () => {
        expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    });

    it('verhindert das Ausbrechen aus einem Attribut', () => {
        expect(escapeHtml(`" onmouseover='x'`)).toBe('&quot; onmouseover=&#39;x&#39;');
    });

    it('escapt & zuerst nicht doppelt', () => {
        expect(escapeHtml('Bad & Sauna &amp;')).toBe('Bad &amp; Sauna &amp;amp;');
    });

    it('lässt normalen Text unverändert', () => {
        expect(escapeHtml('Doppelzimmer „Seeblick“ – 2 Nächte')).toBe('Doppelzimmer „Seeblick“ – 2 Nächte');
    });
});
