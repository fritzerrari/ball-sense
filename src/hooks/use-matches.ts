import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import type { MatchLineup } from "@/lib/types";

export function useMatches() {
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["matches", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("matches")
        .select("*, fields(name)")
        .eq("home_club_id", clubId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useMatch(id: string | undefined) {
  return useQuery({
    queryKey: ["match", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("matches")
        .select("*, fields(name, width_m, height_m, calibration)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useMatchLineups(matchId: string | undefined) {
  return useQuery({
    queryKey: ["match_lineups", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("match_lineups")
        .select("*, players(name, number, position)")
        .eq("match_id", matchId);
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });
}

export function useCreateMatch() {
  const qc = useQueryClient();
  const { clubId } = useAuth();
  return useMutation({
    mutationFn: async (match: {
      date: string;
      kickoff?: string;
      field_id: string;
      away_club_name?: string;
      away_club_id?: string;
      home_formation?: string;
      away_formation?: string;
      match_type?: string;
      lineups: Omit<MatchLineup, "id" | "match_id" | "players">[];
    }) => {
      if (!clubId) throw new Error("Kein Verein");
      const { lineups, ...matchData } = match;

      const { data: newMatch, error: matchError } = await supabase
        .from("matches")
        .insert({ ...matchData, home_club_id: clubId, status: "setup" })
        .select()
        .single();
      if (matchError) throw matchError;

      if (lineups.length > 0) {
        const lineupsWithMatch = lineups.map(l => ({ ...l, match_id: newMatch.id }));
        const { error: lineupError } = await supabase
          .from("match_lineups")
          .insert(lineupsWithMatch);
        if (lineupError) throw lineupError;
      }

      return newMatch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Spiel erstellt");
    },
    onError: (e) => toast.error("Fehler: " + (e as Error).message),
  });
}

export function useUpdateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from("matches")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["match"] });
    },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });
}

export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Spiel gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });
}

export function useTrackingUploads(matchId: string | undefined) {
  return useQuery({
    queryKey: ["tracking_uploads", matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const { data, error } = await supabase
        .from("tracking_uploads")
        .select("*")
        .eq("match_id", matchId)
        .order("camera_index");
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });
}
