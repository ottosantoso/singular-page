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
    PostgrestVersion: "14.5"
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
          sport: string
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
          sport?: string
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
          sport?: string
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
        }
        Insert: {
          arena_code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          arena_code?: string
          created_at?: string
          id?: string
          name?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
  public: {
    Enums: {},
  },
} as const
