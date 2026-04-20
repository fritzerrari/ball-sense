import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Loader2, Target, AlertTriangle, Dumbbell,
  Shuffle, Shield, Zap, Lock, MoveDown, MoveUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatIfResult {
  predicted_outcome: string;
  confidence: "low" | "medium" | "high";
  key_changes: string[];
  risks: string[];
  training_focus: string;
}

interface ScenarioResponse {
  scenario: string;
  scenario_key: string;
  result: WhatIfResult;
  generated_at: string;
}

interface Props {
  matchId: string;
}

const PRESETS: { key: string; label: string; icon: typeof Shuffle; color: string }[] = [
  { key: "no_early_fouls", label: "Ohne frühe Fouls", icon: Shield, color: "text-amber-500" },
  { key: "switch_formation", label: "Andere Formation", icon: Shuffle, color: "text-primary" },
  { key: "high_press", label: "Hohes Pressing", icon: MoveUp, color: "text-emerald-500" },
  { key: "deep_block", label: "Tiefer Block", icon: MoveDown, color: "text-blue-500" },
  { key: "no_concession", label: "Kein frühes Gegentor", icon: Lock, color: "text-destructive" },
  { key: "more_possession", label: "Mehr Ballbesitz", icon: Zap, color: "text-purple-500" },
];

const CONFIDENCE_CONFIG = {
  high: { label: "Hohe Konfidenz", color: "bg-emerald-500/15 text-emerald-500" },
  medium: { label: "Mittlere Konfidenz", color: "bg-amber-500/15 text-amber-500" },
  low: { label: "Niedrige Konfidenz", color: "bg-muted text-muted-foreground" },
};

export default function WhatIfBoard({ matchId }: Props) {
  const [scenarios, setScenarios] = useState<ScenarioResponse[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");

  const runScenario = async (scenarioKey?: string, customText?: string) => {
    const id = scenarioKey ?? "custom";
    setLoading(id);
    try {
      const { data, error } = await supabase.functions.invoke("what-if-scenario", {
        body: {
          match_id: matchId,
          scenario_key: scenarioKey,
          custom_prompt: customText,
        },
      });
      if (error) throw error;
      if (data?.error === "rate_limited") {
        toast.error("Rate-Limit erreicht — kurz warten.");
        return;
      }
      if (data?.error === "credits_required") {
        toast.error("KI-Guthaben aufgebraucht.");
        return;
      }
      if (data?.result) {
        setScenarios((prev) => [data as ScenarioResponse, ...prev].slice(0, 5));
        if (customText) setCustomPrompt("");
      }
    } catch (err) {
      console.error("what-if error", err);
      toast.error("Szenario konnte nicht erstellt werden.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">Was-wäre-wenn</p>
          <p className="text-xs text-muted-foreground">KI-Szenarien für alternative Spielverläufe</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
        {PRESETS.map(({ key, label, icon: Icon, color }) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() => runScenario(key)}
            className="justify-start gap-2 h-auto py-2.5 px-2.5 text-xs min-w-0"
          >
            {loading === key ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
            )}
            <span className="truncate text-left flex-1 min-w-0">{label}</span>
          </Button>
        ))}
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Eigenes Szenario</p>
          <Textarea
            placeholder="z. B. Was wäre, wenn der Stürmer die Großchance in Min 34 verwandelt hätte?"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />
          <Button
            size="sm"
            disabled={!customPrompt.trim() || loading !== null}
            onClick={() => runScenario(undefined, customPrompt.trim())}
            className="gap-1.5 w-full sm:w-auto"
          >
            {loading === "custom" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Szenario berechnen
          </Button>
        </CardContent>
      </Card>

      {loading && !scenarios.length && <Skeleton className="h-32 w-full" />}

      <AnimatePresence>
        {scenarios.map((s, idx) => {
          const cfg = CONFIDENCE_CONFIG[s.result.confidence];
          return (
            <motion.div
              key={s.generated_at}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="border-primary/20 bg-card/80 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs italic text-muted-foreground flex-1">"{s.scenario}"</p>
                    <Badge className={`${cfg.color} border-0 text-[10px] shrink-0`}>{cfg.label}</Badge>
                  </div>

                  <div className="rounded-lg bg-primary/10 px-3 py-2 flex items-start gap-2">
                    <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Prognose</p>
                      <p className="text-sm font-semibold text-foreground">{s.result.predicted_outcome}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Veränderungen im Spielverlauf
                    </p>
                    <ul className="space-y-1">
                      {s.result.key_changes.map((c, i) => (
                        <li key={i} className="text-xs text-foreground/90 flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Risiken</p>
                      <p className="text-[11px] text-foreground/90">{s.result.risks.join(" · ")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-2">
                    <Dumbbell className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold">
                        Trainings-Fokus
                      </p>
                      <p className="text-[11px] text-foreground/90">{s.result.training_focus}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!scenarios.length && !loading && (
        <p className="text-[11px] text-center text-muted-foreground/60 py-4">
          Wähle ein Preset oder formuliere ein eigenes Szenario, um eine KI-Prognose zu erhalten.
        </p>
      )}
    </div>
  );
}
