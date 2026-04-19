import { supabase } from "@/integrations/supabase/client";

/**
 * Server-deduplicated match event insert (Trainer direct path).
 *
 * Looks up any existing event with the same (match_id, event_type, team)
 * created within the last `windowSeconds` and returns that ID instead of
 * inserting a new row. This prevents duplicate goals/cards/etc. when both
 * Trainer and Helper tap the same button within seconds of each other.
 *
 * Returns:
 *   - { id, deduplicated: false } when a new row was inserted
 *   - { id, deduplicated: true }  when an existing row was reused
 */
export async function insertMatchEventDeduped(params: {
  matchId: string;
  eventType: string;
  team: "home" | "away";
  minute: number;
  notes?: string;
  windowSeconds?: number;
}): Promise<{ id: string; deduplicated: boolean } | null> {
  const { matchId, eventType, team, minute, notes, windowSeconds = 8 } = params;

  // Look back `windowSeconds` for the same (match, type, team)
  const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { data: existing } = await supabase
    .from("match_events")
    .select("id")
    .eq("match_id", matchId)
    .eq("event_type", eventType as any)
    .eq("team", team)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { id: existing.id, deduplicated: true };
  }

  const { data: inserted, error } = await supabase
    .from("match_events")
    .insert({
      match_id: matchId,
      event_type: eventType as any,
      minute,
      team,
      notes,
    })
    .select("id")
    .single();

  if (error || !inserted) return null;
  return { id: inserted.id, deduplicated: false };
}
