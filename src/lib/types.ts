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
  created_at: string;
  // Joined
  fields?: Field;
  home_club?: Club;
}

export type MatchStatus = 'setup' | 'live' | 'processing' | 'done';

export interface MatchLineup {
  id: string;
  match_id: string;
  player_id: string | null;
  team: 'home' | 'away';
  starting: boolean;
  shirt_number: number | null;
  player_name: string | null;
  subbed_in_min: number | null;
  subbed_out_min: number | null;
  // Joined
  players?: Player;
}

export interface TrackingUpload {
  id: string;
  match_id: string;
  camera_index: number;
  file_path: string | null;
  status: 'uploaded' | 'processing' | 'done' | 'error';
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
  // Joined
  players?: Player;
}

export interface PositionEntry {
  t: number; // timestamp ms
  x: number; // field x (0-1)
  y: number; // field y (0-1)
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

// Plan types
export type PlanType = 'trial' | 'starter' | 'club' | 'pro';

export interface GuestPlayer {
  name: string;
  number: number | null;
  position: string | null;
}
