import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export function useBenchmarkOptIn() {
  const { clubId, clubPlan } = useAuth();
  const queryClient = useQueryClient();
  const isPro = clubPlan === "pro";

  const { data: optIn, isLoading } = useQuery({
    queryKey: ["benchmark-opt-in", clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const { data } = await supabase
        .from("benchmark_opt_ins")
        .select("*")
        .eq("club_id", clubId)
        .maybeSingle();
      return data;
    },
    enabled: !!clubId && isPro,
  });

  const toggleMutation = useMutation({
    mutationFn: async (optedIn: boolean) => {
      if (!clubId) throw new Error("No club");

      // Get club league
      const { data: club } = await supabase
        .from("clubs")
        .select("league")
        .eq("id", clubId)
        .single();

      if (optIn) {
        const { error } = await supabase
          .from("benchmark_opt_ins")
          .update({
            opted_in: optedIn,
            opted_in_at: optedIn ? new Date().toISOString() : null,
            league: club?.league || null,
          })
          .eq("club_id", clubId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("benchmark_opt_ins")
          .insert({
            club_id: clubId,
            opted_in: optedIn,
            opted_in_at: optedIn ? new Date().toISOString() : null,
            league: club?.league || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benchmark-opt-in", clubId] });
    },
    onError: () => {
      toast.error("Benchmark-Status konnte nicht geändert werden");
    },
  });

  return {
    optedIn: optIn?.opted_in ?? false,
    loading: isLoading,
    isPro,
    toggle: (value: boolean) => toggleMutation.mutate(value),
    toggling: toggleMutation.isPending,
  };
}

export function useLeagueBenchmarks() {
  const { clubId } = useAuth();

  return useQuery({
    queryKey: ["league-benchmarks", clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const { data, error } = await supabase.rpc("get_league_benchmarks", {
        _club_id: clubId,
        _league: "", // will be resolved by the function from opt-in record
      });
      if (error) return null;
      return data as {
        error?: string;
        count?: number;
        participants?: number;
        league?: string;
        avg_possession_pct?: number;
        avg_total_distance_km?: number;
        avg_top_speed_kmh?: number;
        avg_avg_distance_km?: number;
      } | null;
    },
    enabled: !!clubId,
  });
}
