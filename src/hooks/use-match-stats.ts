import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function useApiFootballStats(matchId: string | undefined) {
  return useQuery({
    queryKey: ["api_football_match_stats", matchId],
    queryFn: async () => {
      if (!matchId) return null;
      const { data, error } = await supabase
        .from("api_football_match_stats")
        .select("*")
        .eq("match_id", matchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });
}

export function usePlayerMatchStats(matchId: string | undefined) {
  return useQuery({
    queryKey: ["player_match_stats", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("player_match_stats")
        .select("*, players(name, number, position)")
        .eq("match_id", matchId);
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });
}

export function useTeamMatchStats(matchId: string | undefined) {
  return useQuery({
    queryKey: ["team_match_stats", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("team_match_stats")
        .select("*")
        .eq("match_id", matchId);
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });
}

export function usePlayerAllStats(playerId: string | undefined) {
  return useQuery({
    queryKey: ["player_all_stats", playerId],
    queryFn: async () => {
      if (!playerId) return [];
      const { data, error } = await supabase
        .from("player_match_stats")
        .select("*, matches(date, away_club_name, status)")
        .eq("player_id", playerId)
        .order("matches(date)", { ascending: false });
      if (error) {
        // Fallback without order if join ordering fails
        const { data: fallback, error: e2 } = await supabase
          .from("player_match_stats")
          .select("*, matches(date, away_club_name, status)")
          .eq("player_id", playerId);
        if (e2) throw e2;
        return fallback ?? [];
      }
      return data ?? [];
    },
    enabled: !!playerId,
  });
}

export function useSeasonStats() {
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["season_stats", clubId],
    queryFn: async () => {
      if (!clubId) return null;
      // Get done matches count
      const { count: matchCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("home_club_id", clubId)
        .eq("status", "done");

      // Get aggregated team stats — filter by club's matches only
      const { data: clubMatches } = await supabase
        .from("matches")
        .select("id")
        .eq("home_club_id", clubId)
        .eq("status", "done");
      
      const matchIds = clubMatches?.map(m => m.id) ?? [];
      let totalKm = 0;
      let topSpeed = 0;
      
      if (matchIds.length > 0) {
        const { data: teamStats } = await supabase
          .from("team_match_stats")
          .select("total_distance_km, top_speed_kmh")
          .in("match_id", matchIds)
          .eq("team", "home");
        
        totalKm = teamStats?.reduce((s, t) => s + (t.total_distance_km || 0), 0) ?? 0;
        topSpeed = teamStats?.reduce((s, t) => Math.max(s, t.top_speed_kmh || 0), 0) ?? 0;
      }

      // Get player count
      const { count: playerCount } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("active", true);

      // Most distance player
      const { data: topPlayer } = await supabase
        .from("player_match_stats")
        .select("player_id, distance_km, players(name)")
        .order("distance_km", { ascending: false })
        .limit(1);

      return {
        matchesTracked: matchCount ?? 0,
        totalKm: Math.round(totalKm * 10) / 10,
        topSpeed: Math.round(topSpeed * 10) / 10,
        playerCount: playerCount ?? 0,
        topPlayerName: topPlayer?.[0]?.players?.name ?? null,
      };
    },
    enabled: !!clubId,
  });
}

export function useMonthlyMatchCount() {
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["monthly_match_count", clubId],
    queryFn: async () => {
      if (!clubId) return 0;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const { count } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("home_club_id", clubId)
        .gte("date", startOfMonth)
        .in("status", ["done", "processing", "live"]);
      return count ?? 0;
    },
    enabled: !!clubId,
  });
}
