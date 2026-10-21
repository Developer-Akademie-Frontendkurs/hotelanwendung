export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "16.1"
  }
  public: {
    Tables: {
      booking_events: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_kind: string
          actor_user_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_extras: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          guest_kind: string
          quantity: number
          service_id: string
          unit_amount_cents: number
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          guest_kind: string
          quantity: number
          service_id: string
          unit_amount_cents: number
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          guest_kind?: string
          quantity?: number
          service_id?: string
          unit_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_extras_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_extras_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_groups: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      booking_nights: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          night: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          night: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          night?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_nights_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          adults: number
          billing_address_id: string | null
          booking_group_id: string | null
          booking_reference: string
          cancelled_at: string | null
          check_in: string
          check_out: string
          children: number
          created_at: string
          currency: string
          customer_id: string
          extras_amount_cents: number
          grand_total_cents: number | null
          id: string
          rate_plan_id: string
          residence_address_id: string | null
          room_id: string | null
          room_type_id: string
          status: string
          stay: unknown
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          adults: number
          billing_address_id?: string | null
          booking_group_id?: string | null
          booking_reference?: string
          cancelled_at?: string | null
          check_in: string
          check_out: string
          children?: number
          created_at?: string
          currency?: string
          customer_id: string
          extras_amount_cents?: number
          grand_total_cents?: number | null
          id?: string
          rate_plan_id: string
          residence_address_id?: string | null
          room_id?: string | null
          room_type_id: string
          status?: string
          stay?: unknown
          total_amount_cents: number
          updated_at?: string
        }
        Update: {
          adults?: number
          billing_address_id?: string | null
          booking_group_id?: string | null
          booking_reference?: string
          cancelled_at?: string | null
          check_in?: string
          check_out?: string
          children?: number
          created_at?: string
          currency?: string
          customer_id?: string
          extras_amount_cents?: number
          grand_total_cents?: number | null
          id?: string
          rate_plan_id?: string
          residence_address_id?: string | null
          room_id?: string | null
          room_type_id?: string
          status?: string
          stay?: unknown
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_billing_address_fkey"
            columns: ["billing_address_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "bookings_booking_group_id_fkey"
            columns: ["booking_group_id"]
            isOneToOne: false
            referencedRelation: "booking_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_residence_address_fkey"
            columns: ["residence_address_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          archived_at: string | null
          city: string
          company: string | null
          country_code: string
          created_at: string
          customer_id: string
          house_number: string
          id: string
          kind: string
          match_key: string
          postal_code: string
          street: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          city: string
          company?: string | null
          country_code: string
          created_at?: string
          customer_id: string
          house_number: string
          id?: string
          kind: string
          match_key?: string
          postal_code: string
          street: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          city?: string
          company?: string | null
          country_code?: string
          created_at?: string
          customer_id?: string
          house_number?: string
          id?: string
          kind?: string
          match_key?: string
          postal_code?: string
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string
          email_normalized: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          email_normalized?: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          email_normalized?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hotels: {
        Row: {
          address_line1: string | null
          booking_horizon_days: number
          check_in_time: string
          check_out_time: string
          city: string | null
          country_code: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          booking_horizon_days?: number
          check_in_time: string
          check_out_time: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          booking_horizon_days?: number
          check_in_time?: string
          check_out_time?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          created_at: string
          description: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      rate_plans: {
        Row: {
          archived_at: string | null
          code: string
          created_at: string
          description: string | null
          hotel_id: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          code: string
          created_at?: string
          description?: string | null
          hotel_id: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          code?: string
          created_at?: string
          description?: string | null
          hotel_id?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_plans_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          note: string | null
          period: unknown
          reason: string
          room_id: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          note?: string | null
          period?: unknown
          reason: string
          room_id: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          note?: string | null
          period?: unknown
          reason?: string
          room_id?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_type_images: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          room_type_id: string
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text: string
          created_at?: string
          id?: string
          room_type_id: string
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          room_type_id?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_type_images_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_type_rates: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          rate_plan_id: string
          room_type_id: string
          updated_at: string
          valid_from: string
          valid_to: string
          validity: unknown
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          rate_plan_id: string
          room_type_id: string
          updated_at?: string
          valid_from: string
          valid_to: string
          validity?: unknown
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          rate_plan_id?: string
          room_type_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string
          validity?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "room_type_rates_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_type_rates_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          hotel_id: string
          id: string
          max_occupancy: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          hotel_id: string
          id?: string
          max_occupancy: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          hotel_id?: string
          id?: string
          max_occupancy?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          archived_at: string | null
          created_at: string
          hotel_id: string
          id: string
          room_number: string
          room_type_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          room_number: string
          room_type_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          room_number?: string
          room_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          amount_cents: number
          archived_at: string | null
          charge_basis: string
          child_amount_cents: number | null
          code: string
          created_at: string
          currency: string
          description: string | null
          hotel_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          archived_at?: string | null
          charge_basis: string
          child_amount_cents?: number | null
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          hotel_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          archived_at?: string | null
          charge_basis?: string
          child_amount_cents?: number | null
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          hotel_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      address_match_key: {
        Args: {
          p_city: string
          p_company: string
          p_country_code: string
          p_house_number: string
          p_postal_code: string
          p_street: string
        }
        Returns: string
      }
      availability_calendar: {
        Args: {
          p_adults: number
          p_children?: number
          p_from: string
          p_hotel_id?: string
          p_room_type_id?: string
          p_to: string
        }
        Returns: {
          is_available: boolean
          night: string
          rooms_free: number
          unavailable_reason: string
        }[]
      }
      availability_nights: {
        Args: {
          p_from: string
          p_hotel_id: string
          p_room_type_id?: string
          p_to: string
        }
        Returns: {
          capacity: number
          currency: string
          max_occupancy: number
          night: string
          rate_cents: number
          room_type_id: string
          rooms_free: number
        }[]
      }
      create_booking: {
        Args: {
          p_adults: number
          p_billing_city?: string
          p_billing_company?: string
          p_billing_country_code?: string
          p_billing_house_number?: string
          p_billing_postal_code?: string
          p_billing_street?: string
          p_check_in: string
          p_check_out: string
          p_children?: number
          p_city?: string
          p_country_code?: string
          p_email: string
          p_first_name: string
          p_house_number?: string
          p_last_name: string
          p_phone?: string
          p_positions: Json
          p_postal_code?: string
          p_services?: Json
          p_street?: string
          p_with_breakfast?: boolean
        }
        Returns: Json
      }
      current_customer_id: { Args: never; Returns: string }
      find_rate_gaps: {
        Args: { tage?: number }
        Returns: {
          gap_end: string
          gap_start: string
          hotel_id: string
          nights: number
          rate_plan_code: string
          rate_plan_id: string
          room_type_id: string
          room_type_name: string
        }[]
      }
      generate_booking_reference: { Args: never; Returns: string }
      group_capacity: {
        Args: { p_occupancy: number[]; p_room_limit: number; p_rooms: number[] }
        Returns: number
      }
      is_blocking_status: { Args: { status: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_supported_country: { Args: { p_code: string }; Returns: boolean }
      mask_reason: { Args: { reason: string }; Returns: string }
      normalize_address_part: { Args: { p_value: string }; Returns: string }
      reject_booking: {
        Args: { p_code: string; p_date?: string; p_room_type_id?: string }
        Returns: undefined
      }
      rls_audit: {
        Args: never
        Returns: {
          befund: string
          objekt: string
          schwere: string
        }[]
      }
      search_availability: {
        Args: {
          p_adults: number
          p_check_in: string
          p_check_out: string
          p_children?: number
          p_hotel_id?: string
        }
        Returns: {
          currency: string
          is_bookable: boolean
          max_occupancy: number
          name: string
          nights: number
          room_type_id: string
          rooms_free: number
          slug: string
          total_amount_cents: number
          unavailable_reason: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
