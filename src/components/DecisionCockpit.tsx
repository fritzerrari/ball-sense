import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, TrendingUp, ShieldAlert, Star,
  PlayCircle, Dumbbell, RefreshCw, Brain, Loader2, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Priority {
  rank: 1 | 2 | 3;
  impact_type: "kostet_tore" | "bringt_tore" | "risiko" | "staerke";
  title: string;
  evidence: string;
  linked_event_minutes: number[];
  linked_video_id?: string;
  linked_drill_key?: string;
  recommendation: string;
}

interface Cockpit {
  dna_match_score: number;
  dna_comment?: string;
  team_identity?: string;
  priorities: Priority[];
  generated_at?: string;
}

interface Props {
  matchId: string;
  onJumpToTab: (tab: string, extra?: Record<string, string>) => void;
}

const IMPACT_CONFIG: Record<Priority["impact_type"], {
  icon: typeof AlertTriangle;
  label: string;
  border: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  topBar: string;
}> = {
  kostet_tore: {
    icon: AlertTriangle,
    label: "Kostet Tore",
    border: "border-destructive/30",
    iconBg: "bg-destructive/15",
    iconColor: "text-destructive",
    badgeBg: "bg-destructive/15",
    badgeText: "text-destructive",
    topBar: "bg-gradient-to-r from-destructive to-destructive/60",
  },
  risiko: {
    icon: ShieldAlert,
    label: "Risiko",
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-500",
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-500",
    topBar: "bg-gradient-to-r from-amber-500 to-orange-400",
  },
  staerke: {
    icon: Star,
    label: "Stärke ausbauen",
    border: "border-emerald-500/30",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-500",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-500",
    topBar: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  },
  bringt_tore: {
    icon: TrendingUp,
    label: "Bringt Tore",
    border: "border-primary/30",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    badgeBg: "bg-primary/15",
    badgeText: "text-primary",
    topBar: "bg-gradient-to-r from-primary to-primary/60",
  },
};

const IDENTITY_LABELS: Record<string, string> = {
  pressing: "Pressing",
  ballbesitz: "Ballbesitz",
  umschalt: "Umschaltspiel",
  defensiv: "Defensiv-kompakt",
  unbekannt: "Nicht gesetzt",
};

export default function DecisionCockpit({ matchId, onJumpToTab }: Props) {
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("decision-cockpit", {
        body: { match_id: matchId, force_refresh: force },
      });
      if (error) throw error;
      if (data?.cockpit) setCockpit(data.cockpit);
    } catch (err: any) {
      console.error("Cockpit load error", err);
      toast.error(err?.message ?? "Cockpit konnte nicht geladen werden");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (matchId) void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!cockpit?.priorities?.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-10 text-center space-y-3">
          <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Noch keine Entscheidungs-Analyse vorhanden.</p>
          <Button onClick={() => load(true)} disabled={refreshing} size="sm" className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            Cockpit generieren
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dnaScore = Math.round(cockpit.dna_match_score ?? 0);
  const dnaColor =
    dnaScore >= 75 ? "text-emerald-500" :
    dnaScore >= 50 ? "text-primary" :
    dnaScore >= 30 ? "text-amber-500" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">Entscheidungs-Cockpit</p>
            <p className="text-xs text-muted-foreground truncate">
              {cockpit.team_identity && cockpit.team_identity !== "unbekannt"
                ? `Identität: ${IDENTITY_LABELS[cockpit.team_identity] ?? cockpit.team_identity} · DNA-Match `
                : "DNA-Match "}
              <span className={`font-bold ${dnaColor}`}>{dnaScore}%</span>
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => load(true)}
          disabled={refreshing}
          className="gap-1.5 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Neu</span>
        </Button>
      </motion.div>

      {cockpit.dna_comment && (
        <p className="text-xs text-muted-foreground italic px-1">{cockpit.dna_comment}</p>
      )}

      {/* Top 3 priorities */}
      <div className="space-y-3">
        {cockpit.priorities.map((p, idx) => {
          const cfg = IMPACT_CONFIG[p.impact_type] ?? IMPACT_CONFIG.risiko;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={p.rank}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.08 }}
            >
              <Card className={`relative overflow-hidden ${cfg.border} bg-card/80 backdrop-blur-sm`}>
                <div className={`absolute inset-x-0 top-0 h-1 ${cfg.topBar}`} />
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}>
                      <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">#{p.rank}</span>
                        <Badge className={`${cfg.badgeBg} ${cfg.badgeText} border-0 text-[10px]`}>
                          {cfg.label}
                        </Badge>
                        {p.linked_event_minutes?.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            Min {p.linked_event_minutes.join(", ")}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm leading-snug">{p.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{p.evidence}</p>
                      <div className="flex items-start gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2">
                        <Zap className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        <p className="text-[11px] leading-relaxed text-foreground/90">
                          <span className="font-semibold">Handlung: </span>{p.recommendation}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {p.linked_video_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onJumpToTab("tactics", { clip: p.linked_video_id! })}
                            className="gap-1.5 h-8 text-xs"
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Szene ansehen
                          </Button>
                        )}
                        {p.linked_drill_key && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onJumpToTab("training", { drill: p.linked_drill_key! })}
                            className="gap-1.5 h-8 text-xs"
                          >
                            <Dumbbell className="h-3.5 w-3.5" />
                            Training öffnen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {cockpit.generated_at && (
        <p className="text-[10px] text-muted-foreground/60 text-center">
          Generiert: {new Date(cockpit.generated_at).toLocaleString("de-DE")}
        </p>
      )}
    </div>
  );
}
