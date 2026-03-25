import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export interface OpponentMatchRecord {
  id: string;
  date: string;
  away_club_name: string | null;
  status: string;
  home_formation: string | null;
  away_formation: string | null;
}

export interface OpponentProfile {
  opponent: string;
  matchCount: number;
  matches: OpponentMatchRecord[];
  wins: number;
  draws: number;
  losses: number;
  avgPossession: number | null;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  commonFormation: string | null;
  attackSide: string | null;
  pressingTendency: string | null;
  weaknesses: string[];
}

export function useOpponentHistory(opponentName: string | null | undefined) {
  const { clubId } = useAuth();

  return useQuery({
    queryKey: ["opponent-history", clubId, opponentName],
    enabled: !!clubId && !!opponentName && opponentName.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OpponentProfile | null> => {
      if (!clubId || !opponentName) return null;
      const name = opponentName.trim().toLowerCase();

      // Get all past matches against this opponent
      const { data: matches } = await supabase
        .from("matches")
        .select("id, date, away_club_name, status, home_formation, away_formation")
        .eq("home_club_id", clubId)
        .order("date", { ascending: false });

      if (!matches) return null;

      const filtered = matches.filter(
        (m) => m.away_club_name && m.away_club_name.trim().toLowerCase() === name
      );

      if (filtered.length < 1) return null;

      const matchIds = filtered.map((m) => m.id);

      // Get team stats for these matches
      const { data: teamStats } = await supabase
        .from("team_match_stats")
        .select("match_id, team, possession_pct, total_distance_km")
        .in("match_id", matchIds);

      // Get match events for goal counting
      const { data: events } = await supabase
        .from("match_events")
        .select("match_id, event_type, team")
        .in("match_id", matchIds)
        .in("event_type", ["goal"]);

      // Get analysis results for scouting data
      const { data: analysisResults } = await supabase
        .from("analysis_results")
        .select("match_id, result_type, data")
        .in("match_id", matchIds)
        .in("result_type", ["danger_zones", "match_structure"]);

      // Compute aggregated stats
      let totalGoalsScored = 0;
      let totalGoalsConceded = 0;
      let wins = 0, draws = 0, losses = 0;

      for (const matchId of matchIds) {
        const matchEvents = (events ?? []).filter((e) => e.match_id === matchId);
        const homeGoals = matchEvents.filter((e) => e.team === "home" && e.event_type === "goal").length;
        const awayGoals = matchEvents.filter((e) => e.team === "away" && e.event_type === "goal").length;
        totalGoalsScored += homeGoals;
        totalGoalsConceded += awayGoals;
        if (homeGoals > awayGoals) wins++;
        else if (homeGoals < awayGoals) losses++;
        else draws++;
      }

      // Possession average
      const homePossessions = (teamStats ?? [])
        .filter((s) => s.team === "home" && s.possession_pct != null)
        .map((s) => s.possession_pct!);
      const avgPossession = homePossessions.length > 0
        ? Math.round(homePossessions.reduce((a, b) => a + b, 0) / homePossessions.length)
        : null;

      // Most common formation
      const formations = filtered
        .map((m) => m.home_formation)
        .filter(Boolean) as string[];
      const formationCounts: Record<string, number> = {};
      formations.forEach((f) => { formationCounts[f] = (formationCounts[f] || 0) + 1; });
      const commonFormation = Object.entries(formationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // Attack side from danger zones
      const dangerZoneResults = (analysisResults ?? []).filter((r) => r.result_type === "danger_zones");
      let attackSide: string | null = null;
      if (dangerZoneResults.length > 0) {
        const sides: Record<string, number> = { left: 0, right: 0, center: 0 };
        dangerZoneResults.forEach((r) => {
          const zones: string[] = (r.data as any)?.home_attack_zones ?? [];
          zones.forEach((z) => { if (sides[z] !== undefined) sides[z]++; });
        });
        attackSide = Object.entries(sides).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }

      // Weaknesses from analysis
      const weaknesses: string[] = [];
      const structureResults = (analysisResults ?? []).filter((r) => r.result_type === "match_structure");
      if (structureResults.length > 0) {
        structureResults.forEach((r) => {
          const phases = (r.data as any)?.phases ?? [];
          phases.forEach((p: any) => {
            if (p.momentum === "away" && p.description) {
              weaknesses.push(p.description);
            }
          });
        });
      }

      return {
        opponent: opponentName,
        matchCount: filtered.length,
        matches: filtered,
        wins,
        draws,
        losses,
        avgPossession,
        avgGoalsScored: filtered.length > 0 ? Math.round((totalGoalsScored / filtered.length) * 10) / 10 : 0,
        avgGoalsConceded: filtered.length > 0 ? Math.round((totalGoalsConceded / filtered.length) * 10) / 10 : 0,
        commonFormation,
        attackSide,
        pressingTendency: null,
        weaknesses: weaknesses.slice(0, 3),
      };
    },
  });
}
