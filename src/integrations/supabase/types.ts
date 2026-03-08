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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clubs: {
        Row: {
          city: string | null
          created_at: string
          id: string
          league: string | null
          logo_url: string | null
          name: string
          plan: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          league?: string | null
          logo_url?: string | null
          name: string
          plan?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          league?: string | null
          logo_url?: string | null
          name?: string
          plan?: string
        }
        Relationships: []
      }
      device_guides: {
        Row: {
          active: boolean
          brand: string
          created_at: string
          guide_chapters: Json
          id: string
          model: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          brand: string
          created_at?: string
          guide_chapters?: Json
          id?: string
          model: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          brand?: string
          created_at?: string
          guide_chapters?: Json
          id?: string
          model?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      fields: {
        Row: {
          calibration: Json | null
          club_id: string
          created_at: string
          height_m: number
          id: string
          name: string
          width_m: number
        }
        Insert: {
          calibration?: Json | null
          club_id: string
          created_at?: string
          height_m?: number
          id?: string
          name: string
          width_m?: number
        }
        Update: {
          calibration?: Json | null
          club_id?: string
          created_at?: string
          height_m?: number
          id?: string
          name?: string
          width_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "fields_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          active: boolean
          created_at: string
          html_content: string
          id: string
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          html_content?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          html_content?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      match_lineups: {
        Row: {
          id: string
          match_id: string
          player_id: string | null
          player_name: string | null
          shirt_number: number | null
          starting: boolean
          subbed_in_min: number | null
          subbed_out_min: number | null
          team: string
        }
        Insert: {
          id?: string
          match_id: string
          player_id?: string | null
          player_name?: string | null
          shirt_number?: number | null
          starting?: boolean
          subbed_in_min?: number | null
          subbed_out_min?: number | null
          team: string
        }
        Update: {
          id?: string
          match_id?: string
          player_id?: string | null
          player_name?: string | null
          shirt_number?: number | null
          starting?: boolean
          subbed_in_min?: number | null
          subbed_out_min?: number | null
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_club_id: string | null
          away_club_name: string | null
          away_formation: string | null
          created_at: string
          date: string
          field_id: string
          home_club_id: string
          home_formation: string | null
          id: string
          kickoff: string | null
          status: string
        }
        Insert: {
          away_club_id?: string | null
          away_club_name?: string | null
          away_formation?: string | null
          created_at?: string
          date: string
          field_id: string
          home_club_id: string
          home_formation?: string | null
          id?: string
          kickoff?: string | null
          status?: string
        }
        Update: {
          away_club_id?: string | null
          away_club_name?: string | null
          away_formation?: string | null
          created_at?: string
          date?: string
          field_id?: string
          home_club_id?: string
          home_formation?: string | null
          id?: string
          kickoff?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_club_id_fkey"
            columns: ["away_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_club_id_fkey"
            columns: ["home_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      player_match_stats: {
        Row: {
          avg_speed_kmh: number | null
          distance_km: number | null
          heatmap_grid: Json | null
          id: string
          match_id: string
          minutes_played: number | null
          player_id: string | null
          positions_raw: Json | null
          sprint_count: number | null
          sprint_distance_m: number | null
          team: string
          top_speed_kmh: number | null
        }
        Insert: {
          avg_speed_kmh?: number | null
          distance_km?: number | null
          heatmap_grid?: Json | null
          id?: string
          match_id: string
          minutes_played?: number | null
          player_id?: string | null
          positions_raw?: Json | null
          sprint_count?: number | null
          sprint_distance_m?: number | null
          team: string
          top_speed_kmh?: number | null
        }
        Update: {
          avg_speed_kmh?: number | null
          distance_km?: number | null
          heatmap_grid?: Json | null
          id?: string
          match_id?: string
          minutes_played?: number | null
          player_id?: string | null
          positions_raw?: Json | null
          sprint_count?: number | null
          sprint_distance_m?: number | null
          team?: string
          top_speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          active: boolean
          club_id: string
          created_at: string
          id: string
          name: string
          number: number | null
          position: string | null
        }
        Insert: {
          active?: boolean
          club_id: string
          created_at?: string
          id?: string
          name: string
          number?: number | null
          position?: string | null
        }
        Update: {
          active?: boolean
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          number?: number | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          club_id: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      report_generations: {
        Row: {
          club_id: string | null
          created_at: string
          id: string
          match_id: string
          report_type: string
          user_id: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          id?: string
          match_id: string
          report_type?: string
          user_id: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          id?: string
          match_id?: string
          report_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_generations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_generations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      team_match_stats: {
        Row: {
          avg_distance_km: number | null
          formation_heatmap: Json | null
          id: string
          match_id: string
          possession_pct: number | null
          team: string
          top_speed_kmh: number | null
          total_distance_km: number | null
        }
        Insert: {
          avg_distance_km?: number | null
          formation_heatmap?: Json | null
          id?: string
          match_id: string
          possession_pct?: number | null
          team: string
          top_speed_kmh?: number | null
          total_distance_km?: number | null
        }
        Update: {
          avg_distance_km?: number | null
          formation_heatmap?: Json | null
          id?: string
          match_id?: string
          possession_pct?: number | null
          team?: string
          top_speed_kmh?: number | null
          total_distance_km?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_uploads: {
        Row: {
          camera_index: number
          duration_sec: number | null
          file_path: string | null
          frames_count: number | null
          id: string
          match_id: string
          status: string
          uploaded_at: string
        }
        Insert: {
          camera_index?: number
          duration_sec?: number | null
          file_path?: string | null
          frames_count?: number | null
          id?: string
          match_id: string
          status?: string
          uploaded_at?: string
        }
        Update: {
          camera_index?: number
          duration_sec?: number | null
          file_path?: string | null
          frames_count?: number | null
          id?: string
          match_id?: string
          status?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_uploads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_club_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
