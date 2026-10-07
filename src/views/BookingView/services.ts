/**
 * Zusatzleistungen je Vorgang (E49).
 *
 * Wie beim Frühstück (`breakfast.ts`) ist die Rechnung hier eine **Bequemlichkeit, keine
 * zweite Wahrheit**: Verbindlich rechnet `create_booking`. Was hier steht, ist nur die
 * Zahl, die der Gast vor dem Absenden sieht.
 */

import type { ServiceQuantities } from '../../shared/state/bookingState';

/** Der Code des Kinderbetts – die einzige Leistung mit Menge (E49). */
export const CHILD_BED = 'CHILD_BED';

/** Der Code des Frühstücks in `services` – es läuft je Person und Nacht, nicht als Leistung je Vorgang. */
export const BREAKFAST = 'BREAKFAST';

/** Bezugsgröße der Leistungen je Vorgang. `per_person_night` gehört dem Frühstück. */
export type ExtraChargeBasis = 'per_night' | 'per_stay' | 'per_unit';

/** Eine Zeile aus `services`, so wie PostgREST sie liefert. */
export interface ServiceRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    charge_basis: string;
    amount_cents: number;
    /** `null` heißt: kein eigener Kinderpreis hinterlegt. */
    child_amount_cents: number | null;
    currency: string;
    sort_order: number;
}

/** Eine buchbare Leistung je Vorgang, so wie die Oberfläche sie braucht. */
export interface ExtraService {
    code: string;
    name: string;
    description: string | null;
    chargeBasis: ExtraChargeBasis;
    unitAmountCents: number;
    currency: string;
}

/** Was die Grenzen einer Auswahl bestimmt. */
export type ServiceContext = {
    rooms: number;
    children: number;
};

/**
 * Macht aus den Zeilen die Leistungen je Vorgang, sortiert nach `sort_order`.
 *
 * Das Frühstück fällt heraus: Es hat seinen eigenen Parameter (`p_with_breakfast`), und
 * `create_booking` lehnt es in `p_services` ab.
 */
export function buildExtraServices(rows: readonly ServiceRow[]): ExtraService[] {
    return rows
        .filter((row: ServiceRow): boolean => isExtraChargeBasis(row.charge_basis))
        .sort((a: ServiceRow, b: ServiceRow): number => a.sort_order - b.sort_order)
        .map(
            (row: ServiceRow): ExtraService => ({
                code: row.code,
                name: row.name,
                description: row.description,
                chargeBasis: row.charge_basis as ExtraChargeBasis,
                unitAmountCents: row.amount_cents,
                currency: row.currency,
            }),
        );
}

/**
 * Was eine Leistung kostet – dieselbe Mengenregel wie in `create_booking`:
 * `per_night` × Nächte, `per_stay` einmal, `per_unit` × gewählte Menge.
 */
export function getServiceAmountCents(service: ExtraService, quantity: number, nights: number): number {
    if (quantity <= 0) return 0;
    switch (service.chargeBasis) {
        case 'per_night':
            return nights * service.unitAmountCents;
        case 'per_stay':
            return service.unitAmountCents;
        case 'per_unit':
            return quantity * service.unitAmountCents;
    }
}

/** Höchstmenge einer Leistung: 1 bei Checkboxen, beim Kinderbett eines je Kind und Zimmer. */
export function getServiceMax(service: ExtraService, context: ServiceContext): number {
    if (context.rooms === 0) return 0;
    if (service.code === CHILD_BED) return Math.min(context.children, context.rooms);
    return 1;
}

/**
 * Gleicht die Auswahl mit Zimmern und Kindern ab.
 *
 * Ohne Zimmer keine Leistungen, und das Kinderbett sinkt mit, wenn Kinder oder Zimmer
 * weniger werden. Stehen bliebe sonst eine Bestellung, die `create_booking` ablehnt.
 */
export function reconcileServices(selected: ServiceQuantities, services: readonly ExtraService[], context: ServiceContext): ServiceQuantities {
    const next: Record<string, number> = {};
    for (const service of services) {
        const wanted = selected[service.code] ?? 0;
        const value = Math.min(wanted, getServiceMax(service, context));
        if (value > 0) next[service.code] = value;
    }
    return next;
}

function isExtraChargeBasis(value: string): value is ExtraChargeBasis {
    return value === 'per_night' || value === 'per_stay' || value === 'per_unit';
}
