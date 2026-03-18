// Core domain types for FieldIQ

export interface Club {
  id: string;
  name: string;
  city: string | null;
  league: string | null;
  plan: string;
  created_at: string;
}

export interface Player {
  id: string;
  club_id: string;
  name: string;
  number: number | null;
  position: string | null;
  active: boolean;
  created_at: string;
}

export interface Field {
  id: string;
  club_id: string;
  name: string;
  width_m: number;
  height_m: number;
  calibration: CalibrationData | null;
  created_at: string;
}

export interface CalibrationData {
  points: { x: number; y: number }[];
  width_m: number;
  height_m: number;
  calibrated_at: string;
}

export interface Match {
  id: string;
  home_club_id: string;
  away_club_id: string | null;
  away_club_name: string | null;
  field_id: string;
  date: string;
  kickoff: string | null;
  status: MatchStatus;
  home_formation: string | null;
  away_formation: string | null;
  consent_players_confirmed: boolean;
  consent_minors_confirmed: boolean;
  track_opponent: boolean;
  opponent_consent_confirmed: boolean;
  created_at: string;
  fields?: Field;
  home_club?: Club;
}

export type MatchStatus = "setup" | "live" | "processing" | "done";

export interface MatchLineup {
  id: string;
  match_id: string;
  player_id: string | null;
  team: "home" | "away";
  starting: boolean;
  shirt_number: number | null;
  player_name: string | null;
  subbed_in_min: number | null;
  subbed_out_min: number | null;
  excluded_from_tracking: boolean;
  players?: Player;
}

export interface TrackingUpload {
  id: string;
  match_id: string;
  camera_index: number;
  file_path: string | null;
  status: "uploaded" | "processing" | "done" | "error";
  frames_count: number | null;
  duration_sec: number | null;
  uploaded_at: string;
}

export interface PlayerMatchStats {
  id: string;
  match_id: string;
  player_id: string | null;
  team: string;
  distance_km: number | null;
  top_speed_kmh: number | null;
  avg_speed_kmh: number | null;
  sprint_count: number | null;
  sprint_distance_m: number | null;
  minutes_played: number | null;
  heatmap_grid: number[][] | null;
  positions_raw: PositionEntry[] | null;
  ball_contacts: number | null;
  passes_total: number | null;
  passes_completed: number | null;
  pass_accuracy: number | null;
  duels_total: number | null;
  duels_won: number | null;
  tackles: number | null;
  interceptions: number | null;
  ball_recoveries: number | null;
  shots_total: number | null;
  shots_on_target: number | null;
  goals: number | null;
  assists: number | null;
  crosses: number | null;
  fouls_committed: number | null;
  fouls_drawn: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  dribbles_success: number | null;
  aerial_won: number | null;
  rating: number | null;
  players?: Player;
}

export interface PositionEntry {
  t: number;
  x: number;
  y: number;
}

export interface TeamMatchStats {
  id: string;
  match_id: string;
  team: string;
  total_distance_km: number | null;
  avg_distance_km: number | null;
  top_speed_kmh: number | null;
  possession_pct: number | null;
  formation_heatmap: number[][] | null;
}

export interface HeatmapGrid {
  cols: number;
  rows: number;
  data: number[][];
}

export type PlanType = "trial" | "starter" | "club" | "pro";

export interface GuestPlayer {
  name: string;
  number: number | null;
  position: string | null;
}
