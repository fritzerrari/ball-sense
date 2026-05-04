import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, Circle, ChevronRight, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CheckItem {
  key: string;
  label: string;
  status: "ok" | "warn" | "todo";
  hint?: string;
  href?: string;
  cta?: string;
}

interface PreFlightCheckCardProps {
  matchId: string;
  homeClubId: string | null;
  fieldId: string | null;
  awayClubName: string | null;
}

/**
 * Pre-match readiness checklist. Shown on Match-Detail page when status='setup'.
 * Verifies: Lineup approved, Field calibrated, Camera codes ready, Consent ok, Opponent set.
 */
export default function PreFlightCheckCard({ matchId, homeClubId, fieldId, awayClubName }: PreFlightCheckCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["preflight", matchId],
    queryFn: async () => {
      const [lineupsRes, fieldRes, codesRes] = await Promise.all([
        supabase
          .from("match_lineups")
          .select("id, players(tracking_consent_status)")
          .eq("match_id", matchId),
        fieldId
          ? supabase.from("fields").select("calibration").eq("id", fieldId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        homeClubId
          ? supabase
              .from("camera_access_codes")
              .select("id, active")
              .eq("club_id", homeClubId)
              .eq("active", true)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const lineups = (lineupsRes.data ?? []) as Array<{ id: string; players: { tracking_consent_status?: string } | null }>;
      const lineupCount = lineups.length;
      const consentOk = lineups.filter((l) => l.players?.tracking_consent_status === "approved").length;
      const consentMissing = lineupCount - consentOk;

      const calibration = (fieldRes.data as { calibration?: unknown } | null)?.calibration;
      const fieldOk = !!calibration;

      const activeCodes = (codesRes.data ?? []).length;

      return { lineupCount, consentOk, consentMissing, fieldOk, activeCodes };
    },
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="glass-card p-5 animate-pulse h-32" />
    );
  }

  const checks: CheckItem[] = [
    {
      key: "opponent",
      label: "Gegner eingetragen",
      status: awayClubName && awayClubName.trim().length > 0 ? "ok" : "warn",
      hint: awayClubName ? awayClubName : "Ohne Gegner-Name keine Scouting-Daten",
      href: `/matches/${matchId}/edit`,
      cta: "Bearbeiten",
    },
    {
      key: "lineup",
      label: "Aufstellung gepflegt",
      status: data.lineupCount >= 7 ? "ok" : data.lineupCount > 0 ? "warn" : "todo",
      hint: data.lineupCount > 0 ? `${data.lineupCount} Spieler aufgestellt` : "Keine Spieler — KI ordnet später per Anonymous-Slots",
      href: `/matches/${matchId}/edit`,
      cta: "Aufstellung",
    },
    {
      key: "consent",
      label: "Tracking-Einwilligung",
      status: data.consentMissing === 0 && data.lineupCount > 0 ? "ok" : data.consentMissing > 0 ? "warn" : "todo",
      hint:
        data.lineupCount === 0
          ? "Erst Aufstellung hinzufügen"
          : data.consentMissing > 0
          ? `${data.consentMissing} Spieler ohne Freigabe — werden nicht analysiert`
          : `Alle ${data.consentOk} Spieler freigegeben`,
      href: "/players",
      cta: "Spieler",
    },
    {
      key: "field",
      label: "Spielfeld kalibriert",
      status: data.fieldOk ? "ok" : "warn",
      hint: data.fieldOk ? "Feld-Geometrie aktiv" : "Auto-Kalibrierung läuft beim ersten Frame",
      href: "/fields",
      cta: "Felder",
    },
    {
      key: "camera",
      label: "Kamera-Codes bereit",
      status: data.activeCodes > 0 ? "ok" : "todo",
      hint:
        data.activeCodes > 0
          ? `${data.activeCodes} aktive${data.activeCodes === 1 ? "r Code" : " Codes"} (max 3)`
          : "Code wird beim Tracking-Start automatisch erstellt",
    },
  ];

  const okCount = checks.filter((c) => c.status === "ok").length;
  const totalCount = checks.length;
  const allCritical = checks.filter((c) => c.key !== "camera" && c.key !== "consent").every((c) => c.status === "ok");

  return (
    <div className="glass-card p-5 space-y-4 glow-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold font-display">Pre-Match Check</h3>
        </div>
        <Badge variant={allCritical ? "default" : "secondary"} className="text-xs">
          {okCount}/{totalCount} bereit
        </Badge>
      </div>

      <div className="space-y-2">
        {checks.map((check) => {
          const Icon =
            check.status === "ok" ? CheckCircle2 : check.status === "warn" ? AlertCircle : Circle;
          const iconColor =
            check.status === "ok"
              ? "text-emerald-500"
              : check.status === "warn"
              ? "text-amber-500"
              : "text-muted-foreground/40";

          return (
            <div
              key={check.key}
              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors"
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{check.label}</div>
                {check.hint && (
                  <div className="text-xs text-muted-foreground mt-0.5">{check.hint}</div>
                )}
              </div>
              {check.href && check.cta && check.status !== "ok" && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs shrink-0"
                >
                  <Link to={check.href}>
                    {check.cta}
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {allCritical && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400 text-center pt-2 border-t border-border">
          ✓ Alle kritischen Checks bestanden — bereit für Anpfiff
        </div>
      )}
    </div>
  );
}
