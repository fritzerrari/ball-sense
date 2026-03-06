import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export function usePlayers() {
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["players", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("club_id", clubId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function usePlayer(id: string | undefined) {
  return useQuery({
    queryKey: ["player", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreatePlayer() {
  const qc = useQueryClient();
  const { clubId } = useAuth();
  return useMutation({
    mutationFn: async (player: { name: string; number: number | null; position: string | null }) => {
      if (!clubId) throw new Error("Kein Verein");
      const { data, error } = await supabase
        .from("players")
        .insert({ ...player, club_id: clubId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success("Spieler hinzugefügt");
    },
    onError: () => toast.error("Fehler beim Erstellen"),
  });
}

export function useUpdatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; number?: number | null; position?: string | null; active?: boolean }) => {
      const { data, error } = await supabase
        .from("players")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player"] });
      toast.success("Spieler aktualisiert");
    },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      toast.success("Spieler gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });
}
