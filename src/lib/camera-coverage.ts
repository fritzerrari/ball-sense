import { supabase } from "@/integrations/supabase/client";

export interface CameraCoverageEntry {
  camera_index: number;
  first_ts: number | null;
  last_ts: number | null;
  frame_count: number;
}

export interface CameraCoverageResult {
  recording_started_at: string | null;
  recording_ended_at: string | null;
  cameras: CameraCoverageEntry[];
}

/**
 * Fetch per-camera coverage spans for a match.
 * Trainer-only: requires an authenticated session whose club owns the match.
 * Returns first/last timestamp + frame count for each `_cam{i}.json` present.
 */
export async function fetchCameraCoverage(matchId: string): Promise<CameraCoverageResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "list-coverage", match_id: matchId }),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as CameraCoverageResult;
  } catch {
    return null;
  }
}

const CAMERA_LABELS: Record<number, string> = {
  0: "Trainer",
  1: "Helfer A",
  2: "Helfer B",
  3: "Helfer C",
};

export function cameraLabel(cameraIndex: number): string {
  return CAMERA_LABELS[cameraIndex] ?? `Cam ${cameraIndex}`;
}
