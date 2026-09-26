/** Die Stammdaten aus `hotels`, die die Zusammenfassung braucht (genau eine Zeile, E14). */
export interface HotelRow {
    name: string;
    address_line1: string | null;
    postal_code: string | null;
    city: string | null;
    country_code: string | null;
    /** `time` kommt über PostgREST als `"14:00:00"`. */
    check_in_time: string;
    check_out_time: string;
}
