import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Brain, Shield, Swords, Target, AlertTriangle, Users,
  Loader2, ArrowLeft, Zap, ChevronRight, ClipboardList, Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePdfExport } from "@/hooks/use-pdf-export";

interface Preparation {
  id: string;
  opponent_name: string;
  preparation_data: any;
  created_at: string;
}

export default function MatchPrep() {
  const { clubId, clubName } = useAuth();
  const [searchParams] = useSearchParams();
  const initialOpponent = searchParams.get("opponent") ?? "";
  const [opponentName, setOpponentName] = useState(initialOpponent);
  const [generating, setGenerating] = useState(false);
  const [activePrep, setActivePrep] = useState<Preparation | null>(null);
  const { exportPdf, exporting } = usePdfExport();

  // Fetch past preparations
  const { data: pastPreps, refetch } = useQuery({
    queryKey: ["match-preparations", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from("match_preparations")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as Preparation[];
    },
    enabled: !!clubId,
  });

  // Get unique opponent names from recent matches for autocomplete
  const { data: recentOpponents } = useQuery({
    queryKey: ["recent-opponents", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from("matches")
        .select("away_club_name")
        .eq("home_club_id", clubId)
        .not("away_club_name", "is", null)
        .order("date", { ascending: false })
        .limit(30);
      const names = [...new Set((data ?? []).map((m: any) => m.away_club_name).filter(Boolean))];
      return names as string[];
    },
    enabled: !!clubId,
  });

  const handleGenerate = async () => {
    if (!opponentName.trim() || !clubId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("match-preparation", {
        body: { opponent_name: opponentName.trim(), club_id: clubId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setActivePrep(data.preparation);
      refetch();
      toast.success("Spielvorbereitung erstellt!");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler bei der Erstellung");
    } finally {
      setGenerating(false);
    }
  };

  const prep = activePrep?.preparation_data;

  const severityColors: Record<string, string> = {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    low: "bg-muted text-muted-foreground",
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-display md:text-2xl">KI-Spielvorbereitung</h1>
            <p className="text-xs text-muted-foreground">Taktischer Matchplan basierend auf Gegner-Historie & eigener Formkurve</p>
          </div>
        </div>

        {/* Input */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Nächster Gegner</label>
                <input
                  type="text"
                  value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)}
                  placeholder="Gegner eingeben…"
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground"
                  list="opponents-list"
                />
                <datalist id="opponents-list">
                  {(recentOpponents ?? []).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="flex items-end">
                <Button variant="hero" onClick={handleGenerate} disabled={generating || !opponentName.trim()} className="gap-2 w-full sm:w-auto">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {generating ? "Wird erstellt…" : "Matchplan generieren"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Preparation */}
        {prep && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Formation Recommendation */}
            <Card className="relative overflow-hidden border-primary/20">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Empfohlene Formation</p>
                    <p className="text-2xl font-bold font-display">{prep.recommended_formation}</p>
                  </div>
                </div>
                <p className="text-sm text-foreground/80">{prep.formation_reasoning}</p>
              </CardContent>
            </Card>

            {/* Tactical Priorities */}
            {prep.tactical_priorities?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Swords className="h-4 w-4 text-primary" />
                    Taktische Schwerpunkte
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {prep.tactical_priorities.map((tp: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {tp.priority}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{tp.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{tp.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Opponent Warnings */}
            {prep.opponent_warnings?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Gegner-Warnungen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {prep.opponent_warnings.map((w: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                        <Badge variant="outline" className={`shrink-0 text-[10px] border-0 ${severityColors[w.severity] ?? severityColors.low}`}>
                          {w.severity === "high" ? "Hoch" : w.severity === "medium" ? "Mittel" : "Gering"}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{w.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lineup Suggestions */}
            {prep.lineup_suggestions?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Aufstellungs-Tipps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {prep.lineup_suggestions.map((ls: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30">
                        <Badge variant={ls.recommendation === "start" ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {ls.recommendation === "start" ? "Startelf" : ls.recommendation === "bench" ? "Bank" : "Beobachten"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{ls.player_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{ls.reasoning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Set Piece Plan + Risk Factors */}
            <div className="grid gap-4 sm:grid-cols-2">
              {prep.set_piece_plan && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Standard-Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-foreground/80 leading-relaxed">{prep.set_piece_plan}</p>
                  </CardContent>
                </Card>
              )}

              {prep.own_risk_factors?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-display flex items-center gap-2">
                      <Shield className="h-4 w-4 text-destructive" />
                      Eigene Risiken
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {prep.own_risk_factors.map((rf: any, i: number) => (
                        <div key={i}>
                          <p className="text-xs font-medium">{rf.title}</p>
                          <p className="text-[11px] text-muted-foreground">{rf.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Confidence Note */}
            {prep.confidence_note && (
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  <Brain className="inline h-3 w-3 mr-1" />
                  {prep.confidence_note}
                  {prep.match_history_count > 0 && ` (Basierend auf ${prep.match_history_count} bisherigen Spielen)`}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Past Preparations */}
        {!prep && (pastPreps ?? []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Bisherige Vorbereitungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(pastPreps ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePrep(p)}
                    className="flex items-center justify-between w-full p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">vs. {p.opponent_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("de-DE")} · Formation: {p.preparation_data?.recommended_formation ?? "?"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!prep && (pastPreps ?? []).length === 0 && !generating && (
          <Card className="py-12 text-center">
            <CardContent>
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h2 className="font-semibold font-display text-lg">
                {(recentOpponents ?? []).length === 0 ? "Noch keine Spieldaten" : "Erste Spielvorbereitung"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {(recentOpponents ?? []).length === 0
                  ? "Erstelle zuerst mindestens ein Spiel mit Gegner, damit die KI auf Daten zurückgreifen kann. Die Spielvorbereitung basiert auf deiner Spielhistorie und Gegner-Profilen."
                  : "Gib den nächsten Gegner ein und lass dir einen datenbasierten Matchplan generieren — basierend auf eurer Gegner-Historie und aktueller Teamform."}
              </p>
              {(recentOpponents ?? []).length === 0 && (
                <Link to="/matches/new">
                  <Button variant="hero" size="sm" className="mt-4 gap-2">
                    <Swords className="h-4 w-4" /> Erstes Spiel anlegen
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
