import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import type { TrackingConsentStatus } from "@/lib/types";

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

type PlayerPayload = {
  name: string;
  number: number | null;
  position: string | null;
  active?: boolean;
  tracking_consent_status?: TrackingConsentStatus;
  tracking_consent_notes?: string | null;
  tracking_consent_updated_at?: string | null;
};

export function useCreatePlayer() {
  const qc = useQueryClient();
  const { clubId } = useAuth();
  return useMutation({
    mutationFn: async (player: PlayerPayload) => {
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<PlayerPayload>) => {
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

export function useUpdatePlayerConsent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerId,
      tracking_consent_status,
      tracking_consent_notes,
    }: {
      playerId: string;
      tracking_consent_status: TrackingConsentStatus;
      tracking_consent_notes: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("player-consent-admin", {
        body: {
          playerId,
          tracking_consent_status,
          tracking_consent_notes,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.player;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player"] });
      qc.invalidateQueries({ queryKey: ["admin_player_consents"] });
      toast.success("Einwilligung aktualisiert");
    },
    onError: (error: Error) => toast.error(error.message || "Fehler beim Aktualisieren der Einwilligung"),
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
