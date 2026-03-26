import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PdfReportType = "full_report" | "training_plan" | "match_prep" | "halftime_tactics";

export function usePdfExport() {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async (
    matchId: string,
    reportType: PdfReportType,
    extras?: { opponentName?: string; clubName?: string }
  ) => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf-report", {
        body: { match_id: matchId, report_type: reportType, ...extras },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const html = data?.html;
      if (!html) throw new Error("Kein Report generiert");

      // Open in new tab and trigger print
      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Pop-up blockiert — bitte Pop-ups erlauben");
        return;
      }
      w.document.write(html);
      w.document.close();
      w.onload = () => {
        setTimeout(() => w.print(), 500);
      };

      toast.success("PDF wird generiert…");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim PDF-Export");
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exporting };
}
