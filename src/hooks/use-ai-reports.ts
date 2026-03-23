import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

interface AiReport {
  id: string;
  user_id: string;
  match_id: string | null;
  player_id: string | null;
  report_type: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useLatestAiReport(
  type: "analysis" | "training" | "team",
  playerId?: string,
  matchId?: string
) {
  const { user } = useAuth();
  return useQuery<AiReport | null>({
    queryKey: ["ai_report", type, playerId, matchId],
    queryFn: async () => {
      if (!user) return null;
      let q = supabase
        .from("ai_reports" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("report_type", type)
        .order("created_at", { ascending: false })
        .limit(1);

      if (playerId) q = q.eq("player_id", playerId);
      else q = q.is("player_id", null);

      if (matchId) q = q.eq("match_id", matchId);
      else q = q.is("match_id", null);

      const { data, error } = await q;
      if (error) throw error;
      return (data as any)?.[0] ?? null;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useSaveAiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (report: {
      id?: string;
      user_id: string;
      match_id?: string | null;
      player_id?: string | null;
      report_type: string;
      content: string;
      status: string;
    }) => {
      if (report.id) {
        const { error } = await supabase
          .from("ai_reports" as any)
          .update({
            content: report.content,
            status: report.status,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", report.id);
        if (error) throw error;
        return report.id;
      } else {
        const { data, error } = await supabase
          .from("ai_reports" as any)
          .insert({
            user_id: report.user_id,
            match_id: report.match_id ?? null,
            player_id: report.player_id ?? null,
            report_type: report.report_type,
            content: report.content,
            status: report.status,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        return (data as any).id as string;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_report"] });
    },
  });
}

export function useDeleteAiReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_reports" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_report"] });
    },
  });
}
