/**
 * Frühstück je Zimmerkategorie (E47).
 *
 * Die Rechnung hier ist eine **Bequemlichkeit, keine zweite Wahrheit** – dasselbe
 * Verhältnis wie bei der Ausgrauung des Mengenwählers (Phase 9b, Punkt 3). Verbindlich
 * rechnet `create_booking`; was hier steht, ist nur die Zahl, die der Gast vor dem
 * Absenden sehen soll. Weichen beide ab, gewinnt die Datenbank – und dann ist diese
 * Datei falsch, nicht die Buchung.
 */

/** Eine Zeile aus `services`, so wie PostgREST sie liefert. */
export interface ServiceRow {
    id: string;
    name: string;
    amount_cents: number;
    /** `null` heißt: kein eigener Kinderpreis hinterlegt. */
    child_amount_cents: number | null;
    currency: string;
}

/** Die Preiszeile aus `services` für `code = 'BREAKFAST'`. */
export interface BreakfastService {
    serviceId: string;
    name: string;
    unitAmountCents: number;
    /** `services.child_amount_cents` – `null` dort heißt: Kinder zahlen wie Erwachsene. */
    childUnitAmountCents: number;
    currency: string;
}

/** Belegung **eines** Zimmers (E45) – „2 Erwachsene" mal 3 Zimmer sind sechs Personen. */
export type Occupancy = {
    adults: number;
    children: number;
};

/**
 * Was das Frühstück für eine Kategorie kostet.
 *
 * Die Zahl der Frühstücke ist die Zahl der **Nächte**: gefrühstückt wird am Morgen nach
 * jeder gebuchten Nacht, das letzte am Abreisetag. Genau so rechnet `create_booking`.
 */
export function getBreakfastAmountCents(service: BreakfastService, occupancy: Occupancy, nights: number, rooms: number): number {
    const perRoom = nights * (occupancy.adults * service.unitAmountCents + occupancy.children * service.childUnitAmountCents);
    return perRoom * rooms;
}

/**
 * Macht aus der Datenbankzeile das, womit die Oberfläche rechnet.
 *
 * Der fehlende Kinderpreis wird hier **einmal** aufgelöst – genauso wie in
 * `create_booking` (`coalesce(child_amount_cents, amount_cents)`). Ein fehlender Preis
 * heißt „wie Erwachsene", nicht „gratis": gratis wäre eine `0` in der Spalte, und die
 * ist dort ausdrücklich erlaubt.
 */
export function buildBreakfastService(row: ServiceRow | null): BreakfastService | null {
    if (row === null) return null;

    return {
        serviceId: row.id,
        name: row.name,
        unitAmountCents: row.amount_cents,
        childUnitAmountCents: row.child_amount_cents ?? row.amount_cents,
        currency: row.currency,
    };
}
