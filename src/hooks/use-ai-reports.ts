import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export interface AiReport {
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

/** Poll a specific report by ID for live status updates */
export function usePollAiReport(reportId: string | null) {
  return useQuery<AiReport | null>({
    queryKey: ["ai_report_poll", reportId],
    queryFn: async () => {
      if (!reportId) return null;
      const { data, error } = await supabase
        .from("ai_reports" as any)
        .select("*")
        .eq("id", reportId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!reportId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "queued" || status === "generating") return 2000;
      return false;
    },
  });
}

/** Get queue position for a given report */
export function useQueuePosition(reportId: string | null, createdAt: string | null) {
  return useQuery<{ position: number; total: number } | null>({
    queryKey: ["ai_queue_position", reportId],
    queryFn: async () => {
      if (!reportId || !createdAt) return null;
      const { data } = await supabase
        .from("ai_reports" as any)
        .select("id, created_at")
        .in("status", ["queued", "generating"])
        .order("created_at", { ascending: true });
      if (!data) return null;
      const items = data as any[];
      const idx = items.findIndex((i: any) => i.id === reportId);
      return { position: idx === -1 ? items.length : idx + 1, total: items.length };
    },
    enabled: !!reportId && !!createdAt,
    refetchInterval: 3000,
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
      depth?: string;
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
