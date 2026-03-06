import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import type { CalibrationData } from "@/lib/types";

export function useFields() {
  const { clubId } = useAuth();
  return useQuery({
    queryKey: ["fields", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("fields")
        .select("*")
        .eq("club_id", clubId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useField(id: string | undefined) {
  return useQuery({
    queryKey: ["field", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("fields")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateField() {
  const qc = useQueryClient();
  const { clubId } = useAuth();
  return useMutation({
    mutationFn: async (field: { name: string; width_m?: number; height_m?: number }) => {
      if (!clubId) throw new Error("Kein Verein");
      const { data, error } = await supabase
        .from("fields")
        .insert({ ...field, club_id: clubId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields"] });
      toast.success("Platz hinzugefügt");
    },
    onError: () => toast.error("Fehler beim Erstellen"),
  });
}

export function useUpdateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; width_m?: number; height_m?: number; calibration?: CalibrationData | null }) => {
      const { data, error } = await supabase
        .from("fields")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields"] });
      qc.invalidateQueries({ queryKey: ["field"] });
      toast.success("Platz aktualisiert");
    },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields"] });
      toast.success("Platz gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });
}

export function useSaveCalibration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fieldId, calibration }: { fieldId: string; calibration: CalibrationData }) => {
      // Save to Supabase
      const { error } = await supabase
        .from("fields")
        .update({ calibration: calibration as any })
        .eq("id", fieldId);
      if (error) throw error;
      // Also cache in localStorage
      localStorage.setItem(`calibration_${fieldId}`, JSON.stringify(calibration));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields"] });
      qc.invalidateQueries({ queryKey: ["field"] });
      toast.success("Kalibrierung gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });
}
