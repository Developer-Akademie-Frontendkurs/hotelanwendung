import { afterAll, describe, expect, it } from 'vitest';
import { anonClient, serviceClient } from './helpers/clients';

/**
 * E26 / E32 — Kundenidentität über die E-Mail-Adresse.
 *
 * Ohne Case-Insensitivität legen `Anna@…` und `anna@…` zwei Kunden an, und die ganze
 * Mechanik aus E26 ist wirkungslos: Das später angelegte Konto findet nur die Hälfte
 * der eigenen Buchungen, und die andere Hälfte gehört einem Kunden, den es
 * eigentlich nicht gibt. Nachträgliches Zusammenführen von Kundendatensätzen über
 * Verträge hinweg gehört zu den unangenehmsten Migrationen überhaupt.
 */
describe('customers: E-Mail-Identität (E32)', () => {
    const stamp = crypto.randomUUID().slice(0, 8);
    const created: string[] = [];

    afterAll(async () => {
        if (created.length > 0) {
            await serviceClient.from('customers').delete().in('id', created);
        }
    });

    async function customer(email: string) {
        const result = await serviceClient.from('customers').insert({ email, first_name: 'Anna', last_name: 'Beispiel' }).select('id, email, email_normalized').single();
        if (result.data) created.push(result.data.id as string);
        return result;
    }

    it('erzeugt email_normalized in Kleinschreibung', async () => {
        const { data, error } = await customer(`Anna.Beispiel.${stamp}@Muster.TEST`);
        expect(error).toBeNull();
        expect(data?.email_normalized).toBe(`anna.beispiel.${stamp}@muster.test`);
    });

    it('behält die Originalschreibweise in email', async () => {
        // Sie steht in der Bestätigungsmail. Ein normalisierender Trigger hätte sie
        // unwiederbringlich zerstört — deshalb eine zweite, generierte Spalte (E32).
        const { data } = await serviceClient.from('customers').select('email').eq('email_normalized', `anna.beispiel.${stamp}@muster.test`).single();
        expect(data?.email).toBe(`Anna.Beispiel.${stamp}@Muster.TEST`);
    });

    it('LEHNT dieselbe Adresse in anderer Schreibweise AB', async () => {
        const { error } = await customer(`ANNA.BEISPIEL.${stamp}@muster.test`);
        expect(error).not.toBeNull();
        expect(error?.code).toBe('23505'); // unique_violation
    });

    it('findet den Kunden über email_normalized mit beliebiger Eingabeschreibweise', async () => {
        // Das ist der eigentliche Gewinn gegenüber einem funktionalen Index: Die
        // Abfrage ist eine gewöhnliche Spaltengleichheit und kann nicht falsch
        // geschrieben werden.
        const eingabe = `aNnA.bEiSpIeL.${stamp}@MuStEr.tEsT`;
        const { data, error } = await serviceClient.from('customers').select('id').eq('email_normalized', eingabe.toLowerCase());
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
    });

    it('email_normalized ist nicht von Hand setzbar — die Spalte ist generiert', async () => {
        const { error } = await serviceClient.from('customers').insert({
            email: `direkt.${stamp}@muster.test`,
            email_normalized: 'etwas.anderes@muster.test',
            first_name: 'Anna',
            last_name: 'Beispiel',
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('428C9'); // generated_always
    });

    it('Gast bekommt bei customers 0 Zeilen — keinen Fehler', async () => {
        const { data, error } = await anonClient.from('customers').select('email');
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('Gast darf keinen Kunden anlegen — das tut nur create_booking (E26)', async () => {
        const { error } = await anonClient.from('customers').insert({
            email: `fremd.${stamp}@muster.test`,
            first_name: 'Fremd',
            last_name: 'Person',
        });
        expect(error).not.toBeNull();
        expect(error?.code).toBe('42501');
    });
});
