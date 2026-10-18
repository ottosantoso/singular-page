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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      arena_matches: {
        Row: {
          arena_code: string
          court: number
          created_at: string
          events: Json
          id: string
          round: number
          score_a: number
          score_b: number
          slot_key: string | null
          sport: string
          status: string
          team_a: string[]
          team_b: string[]
          updated_at: string
        }
        Insert: {
          arena_code: string
          court?: number
          created_at?: string
          events?: Json
          id?: string
          round?: number
          score_a?: number
          score_b?: number
          slot_key?: string | null
          sport?: string
          status?: string
          team_a?: string[]
          team_b?: string[]
          updated_at?: string
        }
        Update: {
          arena_code?: string
          court?: number
          created_at?: string
          events?: Json
          id?: string
          round?: number
          score_a?: number
          score_b?: number
          slot_key?: string | null
          sport?: string
          status?: string
          team_a?: string[]
          team_b?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_matches_arena_code_fkey"
            columns: ["arena_code"]
            isOneToOne: false
            referencedRelation: "arena_rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      arena_player_stats: {
        Row: {
          arena_code: string
          created_at: string
          foul_count: number
          id: string
          out_count: number
          player_name: string
          point_count: number
          round: number
          sport: string
          updated_at: string
        }
        Insert: {
          arena_code: string
          created_at?: string
          foul_count?: number
          id?: string
          out_count?: number
          player_name: string
          point_count?: number
          round?: number
          sport?: string
          updated_at?: string
        }
        Update: {
          arena_code?: string
          created_at?: string
          foul_count?: number
          id?: string
          out_count?: number
          player_name?: string
          point_count?: number
          round?: number
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_player_stats_arena_code_fkey"
            columns: ["arena_code"]
            isOneToOne: false
            referencedRelation: "arena_rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      arena_players: {
        Row: {
          arena_code: string
          created_at: string
          id: string
          name: string
          tier: string | null
        }
        Insert: {
          arena_code: string
          created_at?: string
          id?: string
          name: string
          tier?: string | null
        }
        Update: {
          arena_code?: string
          created_at?: string
          id?: string
          name?: string
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arena_players_arena_code_fkey"
            columns: ["arena_code"]
            isOneToOne: false
            referencedRelation: "arena_rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      arena_rooms: {
        Row: {
          code: string
          created_at: string
          name: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          name?: string | null
          sport?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string | null
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      courts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sport: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sport: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sport?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_players: {
        Row: {
          checked_in_at: string | null
          consent_to_show_name: boolean
          created_at: string
          display_name: string
          gender: string | null
          email: string | null
          event_id: string
          phone: string | null
          photo_url: string | null
          player_user_id: string | null
          registered_at: string
          registration_token_hash: string | null
          seed: number | null
          status: string
          tier: string | null
        }
        Insert: {
          checked_in_at?: string | null
          consent_to_show_name?: boolean
          created_at?: string
          display_name: string
          gender?: string | null
          email?: string | null
          event_id: string
          phone?: string | null
          photo_url?: string | null
          player_user_id?: string | null
          registered_at?: string
          registration_token_hash?: string | null
          seed?: number | null
          status?: string
          tier?: string | null
        }
        Update: {
          checked_in_at?: string | null
          consent_to_show_name?: boolean
          created_at?: string
          display_name?: string
          gender?: string | null
          email?: string | null
          event_id?: string
          phone?: string | null
          photo_url?: string | null
          player_user_id?: string | null
          registered_at?: string
          registration_token_hash?: string | null
          seed?: number | null
          status?: string
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_players_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          created_at: string
          event_id: string
          role_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          role_code?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string | null
          format: string
          id: string
          max_players: number | null
          name: string
          organization_id: string
          public_code: string
          public_results: boolean
          sport: string
          starts_at: string | null
          status: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at?: string | null
          format?: string
          id?: string
          max_players?: number | null
          name: string
          organization_id: string
          public_code?: string
          public_results?: boolean
          sport?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string | null
          format?: string
          id?: string
          max_players?: number | null
          name?: string
          organization_id?: string
          public_code?: string
          public_results?: boolean
          sport?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      kocok_arena_history: {
        Row: {
          access_key: string
          finished_at: string
          id: number
          summary: Json
        }
        Insert: {
          access_key: string
          finished_at?: string
          id?: never
          summary: Json
        }
        Update: {
          access_key?: string
          finished_at?: string
          id?: never
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "kocok_arena_history_access_key_fkey"
            columns: ["access_key"]
            isOneToOne: false
            referencedRelation: "kocok_arena_venues"
            referencedColumns: ["access_key"]
          },
        ]
      }
      kocok_arena_matches: {
        Row: {
          access_key: string
          court: number
          id: number
          played_at: string
          round: number
          score_a: number | null
          score_b: number | null
          team_a: string[]
          team_b: string[]
          winner: string | null
        }
        Insert: {
          access_key: string
          court: number
          id?: never
          played_at?: string
          round: number
          score_a?: number | null
          score_b?: number | null
          team_a: string[]
          team_b: string[]
          winner?: string | null
        }
        Update: {
          access_key?: string
          court?: number
          id?: never
          played_at?: string
          round?: number
          score_a?: number | null
          score_b?: number | null
          team_a?: string[]
          team_b?: string[]
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kocok_arena_matches_access_key_fkey"
            columns: ["access_key"]
            isOneToOne: false
            referencedRelation: "kocok_arena_venues"
            referencedColumns: ["access_key"]
          },
        ]
      }
      kocok_arena_meta: {
        Row: {
          access_key: string
          code: string | null
          event_id: string | null
          first_seen: string
          last_seen: string
          organization_id: string | null
          owner_id: string | null
          sport: string | null
        }
        Insert: {
          access_key: string
          code?: string | null
          event_id?: string | null
          first_seen?: string
          last_seen?: string
          organization_id?: string | null
          owner_id?: string | null
          sport?: string | null
        }
        Update: {
          access_key?: string
          code?: string | null
          event_id?: string | null
          first_seen?: string
          last_seen?: string
          organization_id?: string | null
          owner_id?: string | null
          sport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kocok_arena_meta_access_key_fkey"
            columns: ["access_key"]
            isOneToOne: true
            referencedRelation: "kocok_arena_venues"
            referencedColumns: ["access_key"]
          },
          {
            foreignKeyName: "kocok_arena_meta_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kocok_arena_meta_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kocok_arena_venues: {
        Row: {
          access_key: string
          current_state: Json | null
          updated_at: string
        }
        Insert: {
          access_key: string
          current_state?: Json | null
          updated_at?: string
        }
        Update: {
          access_key?: string
          current_state?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role_code: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          role_code: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role_code?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invites_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      organization_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          organization_id: string
          role_code: string
          status: string
          user_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role_code: string
          status?: string
          user_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role_code?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          banner_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          public_description: string | null
          secondary_color: string | null
          slug: string
          sport_label: string | null
          subscription_plan: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          banner_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string | null
          public_description?: string | null
          secondary_color?: string | null
          slug: string
          sport_label?: string | null
          subscription_plan?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          banner_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          public_description?: string | null
          secondary_color?: string | null
          slug?: string
          sport_label?: string | null
          subscription_plan?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          code: string
          description: string | null
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          description?: string | null
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string | null
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invite: {
        Args: { p_token: string }
        Returns: {
          organization_id: string
          organization_name: string
          role_code: string
        }[]
      }
      admin_get_game: { Args: { p_game_key: string }; Returns: Json }
      admin_list_games: {
        Args: { p_limit?: number; p_search?: string; p_status?: string }
        Returns: Json
      }
      platform_list_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          email: string | null
          username: string | null
          display_name: string | null
          is_active: boolean
          email_confirmed_at: string | null
          created_at: string
          global_roles: Json
          memberships: Json
        }[]
      }
      platform_list_organizations: {
        Args: Record<PropertyKey, never>
        Returns: { organization_id: string; organization_name: string; slug: string }[]
      }
      platform_set_user_status: {
        Args: { p_user_id: string; p_is_active: boolean }
        Returns: boolean
      }
      platform_set_user_role: {
        Args: { p_user_id: string; p_role_code: string; p_enabled?: boolean }
        Returns: boolean
      }
      platform_set_membership_role: {
        Args: { p_user_id: string; p_organization_id: string; p_role_code: string; p_enabled?: boolean }
        Returns: boolean
      }
      close_abandoned_arena_sessions: {
        Args: { p_idle?: string; p_lookback?: string }
        Returns: Json
      }
      create_organization: {
        Args: { p_name: string; p_slug: string; p_timezone?: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          sport_label: string | null
          subscription_plan: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_event: {
        Args: { p_public_code: string; p_registration_token?: string }
        Returns: {
          event: Json
          history: Json
          matches: Json
          me: Json
          players: Json
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_organization_admin: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string; p_roles?: string[] }
        Returns: boolean
      }
      kocok_access_key: {
        Args: { p_code: string; p_pin: string }
        Returns: string
      }
      kocok_archive_tournament: {
        Args: { p_code: string; p_pin: string; p_summary: Json }
        Returns: number
      }
      kocok_get_updated_at: {
        Args: { p_code: string; p_pin: string }
        Returns: string
      }
      kocok_list_history: {
        Args: { p_code: string; p_pin: string }
        Returns: {
          finished_at: string
          id: number
          summary: Json
        }[]
      }
      kocok_list_matches: {
        Args: { p_code: string; p_limit?: number; p_pin: string }
        Returns: {
          court: number
          id: number
          played_at: string
          round: number
          score_a: number
          score_b: number
          team_a: string[]
          team_b: string[]
          winner: string
        }[]
      }
      kocok_load_state: {
        Args: { p_code: string; p_pin: string }
        Returns: Json
      }
      kocok_log_matches: {
        Args: {
          p_code: string
          p_matches: Json
          p_pin: string
          p_round: number
        }
        Returns: number
      }
      kocok_save_state: {
        Args: { p_code: string; p_pin: string; p_state: Json }
        Returns: string
      }
      register_event_guest: {
        Args: {
          p_consent_to_show_name?: boolean
          p_display_name: string
          p_gender: string
          p_email?: string
          p_phone?: string
          p_photo_url?: string
          p_public_code: string
          p_tier?: string
        }
        Returns: {
          display_name: string
          event_id: string
          event_name: string
          player_id: string
          public_code: string
          registration_token: string
          registration_status: string
        }[]
      }
      check_in_event_guest: {
        Args: { p_public_code: string; p_registration_token: string }
        Returns: {
          checked_in_at: string
          display_name: string
          status: string
        }[]
      }
      claim_event_guest: {
        Args: { p_public_code: string; p_registration_token: string }
        Returns: boolean
      }
      get_player_dashboard: {
        Args: Record<string, never>
        Returns: {
          events: Json
          matches: Json
          profile: Json
          sports: Json
          summary: Json
        }[]
      }
      get_organization_report: {
        Args: {
          p_event_id?: string | null
          p_from?: string | null
          p_organization_id: string
          p_sport?: string | null
          p_to?: string | null
          p_venue_id?: string | null
        }
        Returns: Json
      }
      promote_event_waitlist: {
        Args: { p_event_id: string; p_limit?: number }
        Returns: number
      }
      withdraw_event_guest: {
        Args: { p_public_code: string; p_registration_token: string }
        Returns: boolean
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
