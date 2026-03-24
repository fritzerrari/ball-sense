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
      ai_reports: {
        Row: {
          content: string
          created_at: string
          depth: string
          id: string
          match_id: string | null
          player_id: string | null
          report_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          depth?: string
          id?: string
          match_id?: string | null
          player_id?: string | null
          report_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          depth?: string
          id?: string
          match_id?: string | null
          player_id?: string | null
          report_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_reports_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      api_football_config: {
        Row: {
          api_league_id: number | null
          api_season: number | null
          api_team_id: number | null
          club_id: string
          created_at: string
          id: string
          last_sync_at: string | null
          sync_enabled: boolean
        }
        Insert: {
          api_league_id?: number | null
          api_season?: number | null
          api_team_id?: number | null
          club_id: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          sync_enabled?: boolean
        }
        Update: {
          api_league_id?: number | null
          api_season?: number | null
          api_team_id?: number | null
          club_id?: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          sync_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "api_football_config_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_football_match_stats: {
        Row: {
          api_fixture_id: number | null
          away_goals: number | null
          club_id: string
          corners_away: number | null
          corners_home: number | null
          data_source: string
          fetched_at: string
          fouls_away: number | null
          fouls_home: number | null
          home_goals: number | null
          id: string
          match_id: string | null
          offsides_away: number | null
          offsides_home: number | null
          pass_accuracy_away: number | null
          pass_accuracy_home: number | null
          passes_away: number | null
          passes_home: number | null
          possession_away: number | null
          possession_home: number | null
          raw_data: Json | null
          red_cards_away: number | null
          red_cards_home: number | null
          shots_away: number | null
          shots_home: number | null
          shots_on_target_away: number | null
          shots_on_target_home: number | null
          yellow_cards_away: number | null
          yellow_cards_home: number | null
        }
        Insert: {
          api_fixture_id?: number | null
          away_goals?: number | null
          club_id: string
          corners_away?: number | null
          corners_home?: number | null
          data_source?: string
          fetched_at?: string
          fouls_away?: number | null
          fouls_home?: number | null
          home_goals?: number | null
          id?: string
          match_id?: string | null
          offsides_away?: number | null
          offsides_home?: number | null
          pass_accuracy_away?: number | null
          pass_accuracy_home?: number | null
          passes_away?: number | null
          passes_home?: number | null
          possession_away?: number | null
          possession_home?: number | null
          raw_data?: Json | null
          red_cards_away?: number | null
          red_cards_home?: number | null
          shots_away?: number | null
          shots_home?: number | null
          shots_on_target_away?: number | null
          shots_on_target_home?: number | null
          yellow_cards_away?: number | null
          yellow_cards_home?: number | null
        }
        Update: {
          api_fixture_id?: number | null
          away_goals?: number | null
          club_id?: string
          corners_away?: number | null
          corners_home?: number | null
          data_source?: string
          fetched_at?: string
          fouls_away?: number | null
          fouls_home?: number | null
          home_goals?: number | null
          id?: string
          match_id?: string | null
          offsides_away?: number | null
          offsides_home?: number | null
          pass_accuracy_away?: number | null
          pass_accuracy_home?: number | null
          passes_away?: number | null
          passes_home?: number | null
          possession_away?: number | null
          possession_home?: number | null
          raw_data?: Json | null
          red_cards_away?: number | null
          red_cards_home?: number | null
          shots_away?: number | null
          shots_home?: number | null
          shots_on_target_away?: number | null
          shots_on_target_home?: number | null
          yellow_cards_away?: number | null
          yellow_cards_home?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_football_match_stats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_football_match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      api_football_player_stats: {
        Row: {
          api_fixture_id: number | null
          api_player_id: number | null
          assists: number | null
          club_id: string
          data_source: string
          dribbles_success: number | null
          duels_total: number | null
          duels_won: number | null
          fetched_at: string
          fouls_committed: number | null
          fouls_drawn: number | null
          goals: number | null
          id: string
          minutes_played: number | null
          passes_accuracy: number | null
          passes_total: number | null
          penalty_missed: number | null
          penalty_scored: number | null
          player_id: string | null
          player_name: string | null
          rating: number | null
          raw_data: Json | null
          red_cards: number | null
          shots_on_goal: number | null
          shots_total: number | null
          tackles: number | null
          yellow_cards: number | null
        }
        Insert: {
          api_fixture_id?: number | null
          api_player_id?: number | null
          assists?: number | null
          club_id: string
          data_source?: string
          dribbles_success?: number | null
          duels_total?: number | null
          duels_won?: number | null
          fetched_at?: string
          fouls_committed?: number | null
          fouls_drawn?: number | null
          goals?: number | null
          id?: string
          minutes_played?: number | null
          passes_accuracy?: number | null
          passes_total?: number | null
          penalty_missed?: number | null
          penalty_scored?: number | null
          player_id?: string | null
          player_name?: string | null
          rating?: number | null
          raw_data?: Json | null
          red_cards?: number | null
          shots_on_goal?: number | null
          shots_total?: number | null
          tackles?: number | null
          yellow_cards?: number | null
        }
        Update: {
          api_fixture_id?: number | null
          api_player_id?: number | null
          assists?: number | null
          club_id?: string
          data_source?: string
          dribbles_success?: number | null
          duels_total?: number | null
          duels_won?: number | null
          fetched_at?: string
          fouls_committed?: number | null
          fouls_drawn?: number | null
          goals?: number | null
          id?: string
          minutes_played?: number | null
          passes_accuracy?: number | null
          passes_total?: number | null
          penalty_missed?: number | null
          penalty_scored?: number | null
          player_id?: string | null
          player_name?: string | null
          rating?: number | null
          raw_data?: Json | null
          red_cards?: number | null
          shots_on_goal?: number | null
          shots_total?: number | null
          tackles?: number | null
          yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_football_player_stats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_football_player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      app_modules: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
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
      camera_access_codes: {
        Row: {
          active: boolean
          club_id: string
          code_hash: string
          created_at: string
          created_by_user_id: string
          id: string
          label: string
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          club_id: string
          code_hash: string
          created_at?: string
          created_by_user_id: string
          id?: string
          label: string
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          club_id?: string
          code_hash?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          label?: string
          last_used_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_access_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_access_sessions: {
        Row: {
          camera_index: number | null
          club_id: string
          code_id: string
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          match_id: string | null
          session_token_hash: string
        }
        Insert: {
          camera_index?: number | null
          club_id: string
          code_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          match_id?: string | null
          session_token_hash: string
        }
        Update: {
          camera_index?: number | null
          club_id?: string
          code_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          match_id?: string | null
          session_token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "camera_access_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_access_sessions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "camera_access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camera_access_sessions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog: {
        Row: {
          change_type: string
          created_at: string
          description: string
          documentation_id: string | null
          id: string
          release_date: string
          title: string
          version: string
        }
        Insert: {
          change_type?: string
          created_at?: string
          description?: string
          documentation_id?: string | null
          id?: string
          release_date?: string
          title: string
          version: string
        }
        Update: {
          change_type?: string
          created_at?: string
          description?: string
          documentation_id?: string | null
          id?: string
          release_date?: string
          title?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_documentation_id_fkey"
            columns: ["documentation_id"]
            isOneToOne: false
            referencedRelation: "documentation"
            referencedColumns: ["id"]
          },
        ]
      }
      club_module_assignments: {
        Row: {
          assigned_by: string | null
          club_id: string
          created_at: string
          enabled: boolean
          id: string
          module_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          club_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          module_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          club_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          module_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_module_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_module_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
            referencedColumns: ["id"]
          },
        ]
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
      documentation: {
        Row: {
          active: boolean
          category: string
          content: string
          created_at: string
          id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
          version: string | null
        }
        Insert: {
          active?: boolean
          category?: string
          content?: string
          created_at?: string
          id?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          content?: string
          created_at?: string
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: string | null
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
          document_type: string | null
          html_content: string
          id: string
          slug: string
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          document_type?: string | null
          html_content?: string
          id?: string
          slug: string
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          document_type?: string | null
          html_content?: string
          id?: string
          slug?: string
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      match_events: {
        Row: {
          affected_line: string | null
          created_at: string
          event_cause: string | null
          event_pattern: string | null
          event_type: Database["public"]["Enums"]["match_event_type"]
          event_zone: string | null
          id: string
          match_id: string
          minute: number
          notes: string | null
          player_id: string | null
          player_name: string | null
          possession_phase: string | null
          related_player_id: string | null
          related_player_name: string | null
          severity: number | null
          team: string
        }
        Insert: {
          affected_line?: string | null
          created_at?: string
          event_cause?: string | null
          event_pattern?: string | null
          event_type: Database["public"]["Enums"]["match_event_type"]
          event_zone?: string | null
          id?: string
          match_id: string
          minute: number
          notes?: string | null
          player_id?: string | null
          player_name?: string | null
          possession_phase?: string | null
          related_player_id?: string | null
          related_player_name?: string | null
          severity?: number | null
          team: string
        }
        Update: {
          affected_line?: string | null
          created_at?: string
          event_cause?: string | null
          event_pattern?: string | null
          event_type?: Database["public"]["Enums"]["match_event_type"]
          event_zone?: string | null
          id?: string
          match_id?: string
          minute?: number
          notes?: string | null
          player_id?: string | null
          player_name?: string | null
          possession_phase?: string | null
          related_player_id?: string | null
          related_player_name?: string | null
          severity?: number | null
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_related_player_id_fkey"
            columns: ["related_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          excluded_from_tracking: boolean
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
          excluded_from_tracking?: boolean
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
          excluded_from_tracking?: boolean
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
          consent_minors_confirmed: boolean
          consent_players_confirmed: boolean
          created_at: string
          date: string
          field_id: string
          home_club_id: string
          home_formation: string | null
          id: string
          kickoff: string | null
          match_type: string
          opponent_consent_confirmed: boolean
          processing_progress: Json | null
          status: string
          track_opponent: boolean
        }
        Insert: {
          away_club_id?: string | null
          away_club_name?: string | null
          away_formation?: string | null
          consent_minors_confirmed?: boolean
          consent_players_confirmed?: boolean
          created_at?: string
          date: string
          field_id: string
          home_club_id: string
          home_formation?: string | null
          id?: string
          kickoff?: string | null
          match_type?: string
          opponent_consent_confirmed?: boolean
          processing_progress?: Json | null
          status?: string
          track_opponent?: boolean
        }
        Update: {
          away_club_id?: string | null
          away_club_name?: string | null
          away_formation?: string | null
          consent_minors_confirmed?: boolean
          consent_players_confirmed?: boolean
          created_at?: string
          date?: string
          field_id?: string
          home_club_id?: string
          home_formation?: string | null
          id?: string
          kickoff?: string | null
          match_type?: string
          opponent_consent_confirmed?: boolean
          processing_progress?: Json | null
          status?: string
          track_opponent?: boolean
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
      module_permissions: {
        Row: {
          action_key: string | null
          allowed: boolean
          created_at: string
          id: string
          module_id: string
          plan: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          scope_id: string | null
          scope_type: string
          tab_key: string | null
          updated_at: string
        }
        Insert: {
          action_key?: string | null
          allowed?: boolean
          created_at?: string
          id?: string
          module_id: string
          plan?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          scope_id?: string | null
          scope_type: string
          tab_key?: string | null
          updated_at?: string
        }
        Update: {
          action_key?: string | null
          allowed?: boolean
          created_at?: string
          id?: string
          module_id?: string
          plan?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          scope_id?: string | null
          scope_type?: string
          tab_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      player_match_stats: {
        Row: {
          aerial_won: number | null
          anomaly_flags: Json
          assists: number | null
          avg_speed_kmh: number | null
          ball_contacts: number | null
          ball_recoveries: number | null
          corrected_avg_speed_kmh: number | null
          corrected_distance_km: number | null
          corrected_top_speed_kmh: number | null
          crosses: number | null
          data_source: string
          distance_km: number | null
          dribbles_success: number | null
          duels_total: number | null
          duels_won: number | null
          fouls_committed: number | null
          fouls_drawn: number | null
          goals: number | null
          heatmap_grid: Json | null
          id: string
          interceptions: number | null
          match_id: string
          minutes_played: number | null
          pass_accuracy: number | null
          passes_completed: number | null
          passes_total: number | null
          player_id: string | null
          positions_raw: Json | null
          quality_score: number | null
          rating: number | null
          raw_metrics: Json
          red_cards: number | null
          shots_on_target: number | null
          shots_total: number | null
          sprint_count: number | null
          sprint_distance_m: number | null
          suspected_cause: string | null
          tackles: number | null
          team: string
          top_speed_kmh: number | null
          yellow_cards: number | null
        }
        Insert: {
          aerial_won?: number | null
          anomaly_flags?: Json
          assists?: number | null
          avg_speed_kmh?: number | null
          ball_contacts?: number | null
          ball_recoveries?: number | null
          corrected_avg_speed_kmh?: number | null
          corrected_distance_km?: number | null
          corrected_top_speed_kmh?: number | null
          crosses?: number | null
          data_source?: string
          distance_km?: number | null
          dribbles_success?: number | null
          duels_total?: number | null
          duels_won?: number | null
          fouls_committed?: number | null
          fouls_drawn?: number | null
          goals?: number | null
          heatmap_grid?: Json | null
          id?: string
          interceptions?: number | null
          match_id: string
          minutes_played?: number | null
          pass_accuracy?: number | null
          passes_completed?: number | null
          passes_total?: number | null
          player_id?: string | null
          positions_raw?: Json | null
          quality_score?: number | null
          rating?: number | null
          raw_metrics?: Json
          red_cards?: number | null
          shots_on_target?: number | null
          shots_total?: number | null
          sprint_count?: number | null
          sprint_distance_m?: number | null
          suspected_cause?: string | null
          tackles?: number | null
          team: string
          top_speed_kmh?: number | null
          yellow_cards?: number | null
        }
        Update: {
          aerial_won?: number | null
          anomaly_flags?: Json
          assists?: number | null
          avg_speed_kmh?: number | null
          ball_contacts?: number | null
          ball_recoveries?: number | null
          corrected_avg_speed_kmh?: number | null
          corrected_distance_km?: number | null
          corrected_top_speed_kmh?: number | null
          crosses?: number | null
          data_source?: string
          distance_km?: number | null
          dribbles_success?: number | null
          duels_total?: number | null
          duels_won?: number | null
          fouls_committed?: number | null
          fouls_drawn?: number | null
          goals?: number | null
          heatmap_grid?: Json | null
          id?: string
          interceptions?: number | null
          match_id?: string
          minutes_played?: number | null
          pass_accuracy?: number | null
          passes_completed?: number | null
          passes_total?: number | null
          player_id?: string | null
          positions_raw?: Json | null
          quality_score?: number | null
          rating?: number | null
          raw_metrics?: Json
          red_cards?: number | null
          shots_on_target?: number | null
          shots_total?: number | null
          sprint_count?: number | null
          sprint_distance_m?: number | null
          suspected_cause?: string | null
          tackles?: number | null
          team?: string
          top_speed_kmh?: number | null
          yellow_cards?: number | null
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
          tracking_consent_notes: string | null
          tracking_consent_status: Database["public"]["Enums"]["tracking_consent_status"]
          tracking_consent_updated_at: string | null
        }
        Insert: {
          active?: boolean
          club_id: string
          created_at?: string
          id?: string
          name: string
          number?: number | null
          position?: string | null
          tracking_consent_notes?: string | null
          tracking_consent_status?: Database["public"]["Enums"]["tracking_consent_status"]
          tracking_consent_updated_at?: string | null
        }
        Update: {
          active?: boolean
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          number?: number | null
          position?: string | null
          tracking_consent_notes?: string | null
          tracking_consent_status?: Database["public"]["Enums"]["tracking_consent_status"]
          tracking_consent_updated_at?: string | null
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
      super_admins: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_match_stats: {
        Row: {
          anomaly_flags: Json
          avg_distance_km: number | null
          data_source: string
          formation_heatmap: Json | null
          id: string
          match_id: string
          possession_pct: number | null
          quality_score: number | null
          raw_metrics: Json
          suspected_cause: string | null
          team: string
          top_speed_kmh: number | null
          total_distance_km: number | null
        }
        Insert: {
          anomaly_flags?: Json
          avg_distance_km?: number | null
          data_source?: string
          formation_heatmap?: Json | null
          id?: string
          match_id: string
          possession_pct?: number | null
          quality_score?: number | null
          raw_metrics?: Json
          suspected_cause?: string | null
          team: string
          top_speed_kmh?: number | null
          total_distance_km?: number | null
        }
        Update: {
          anomaly_flags?: Json
          avg_distance_km?: number | null
          data_source?: string
          formation_heatmap?: Json | null
          id?: string
          match_id?: string
          possession_pct?: number | null
          quality_score?: number | null
          raw_metrics?: Json
          suspected_cause?: string | null
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
          chunks_received: number | null
          duration_sec: number | null
          file_path: string | null
          frames_count: number | null
          id: string
          last_chunk_at: string | null
          match_id: string
          status: string
          upload_mode: string
          uploaded_at: string
        }
        Insert: {
          camera_index?: number
          chunks_received?: number | null
          duration_sec?: number | null
          file_path?: string | null
          frames_count?: number | null
          id?: string
          last_chunk_at?: string | null
          match_id: string
          status?: string
          upload_mode?: string
          uploaded_at?: string
        }
        Update: {
          camera_index?: number
          chunks_received?: number | null
          duration_sec?: number | null
          file_path?: string | null
          frames_count?: number | null
          id?: string
          last_chunk_at?: string | null
          match_id?: string
          status?: string
          upload_mode?: string
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
      user_module_overrides: {
        Row: {
          action_key: string | null
          allowed: boolean
          assigned_by: string | null
          created_at: string
          id: string
          module_id: string
          notes: string | null
          tab_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_key?: string | null
          allowed?: boolean
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_id: string
          notes?: string | null
          tab_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_key?: string | null
          allowed?: boolean
          assigned_by?: string | null
          created_at?: string
          id?: string
          module_id?: string
          notes?: string | null
          tab_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_overrides_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "app_modules"
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
      can_access_module: {
        Args: {
          _action_key?: string
          _club_id: string
          _module_key: string
          _plan: string
          _tab_key?: string
          _user_id: string
        }
        Returns: boolean
      }
      get_user_club_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      match_event_type:
        | "substitution"
        | "red_card"
        | "yellow_red_card"
        | "player_deactivated"
        | "goal"
        | "conceded_goal"
        | "yellow_card"
        | "foul"
        | "assist"
        | "shot"
        | "shot_on_target"
        | "corner"
        | "penalty"
        | "counter_attack"
        | "set_piece"
        | "free_kick"
        | "throw_in"
        | "offside"
        | "save"
        | "blocked_shot"
        | "own_goal"
        | "handball"
        | "injury"
        | "drink_break"
        | "clearance"
        | "bad_pass"
        | "lost_duel"
        | "won_duel"
        | "dribble"
        | "cross"
        | "header"
        | "tackle"
        | "interception"
        | "ball_recovery"
        | "kickoff"
      tracking_consent_status: "unknown" | "granted" | "denied"
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
      match_event_type: [
        "substitution",
        "red_card",
        "yellow_red_card",
        "player_deactivated",
        "goal",
        "conceded_goal",
        "yellow_card",
        "foul",
        "assist",
        "shot",
        "shot_on_target",
        "corner",
        "penalty",
        "counter_attack",
        "set_piece",
        "free_kick",
        "throw_in",
        "offside",
        "save",
        "blocked_shot",
        "own_goal",
        "handball",
        "injury",
        "drink_break",
        "clearance",
        "bad_pass",
        "lost_duel",
        "won_duel",
        "dribble",
        "cross",
        "header",
        "tackle",
        "interception",
        "ball_recovery",
        "kickoff",
      ],
      tracking_consent_status: ["unknown", "granted", "denied"],
    },
  },
} as const
