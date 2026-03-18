import { useMemo, useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { FORMATIONS, POSITION_LABELS } from "@/lib/constants";
import { AI_DISCLAIMER, AI_RECOMMENDATION_DISCLAIMER } from "@/lib/data-quality";

const FORMATION_LAYOUTS: Record<string, string[]> = {
  "4-4-2": ["TW", "LV", "IV", "IV", "RV", "LM", "ZM", "ZM", "RM", "ST", "ST"],
  "4-3-3": ["TW", "LV", "IV", "IV", "RV", "ZM", "ZDM", "ZM", "LA", "ST", "RA"],
  "3-5-2": ["TW", "LIV", "IV", "RIV", "LM", "ZM", "ZDM", "ZM", "RM", "ST", "ST"],
  "4-2-3-1": ["TW", "LV", "IV", "IV", "RV", "ZDM", "ZDM", "LA", "ZOM", "RA", "ST"],
  "3-4-3": ["TW", "LIV", "IV", "RIV", "LM", "ZM", "ZM", "RM", "LA", "ST", "RA"],
  "5-3-2": ["TW", "LV", "LIV", "IV", "RIV", "RV", "ZM", "ZDM", "ZM", "ST", "ST"],
  "5-4-1": ["TW", "LV", "LIV", "IV", "RIV", "RV", "LM", "ZM", "ZM", "RM", "ST"],
};

const SLOT_CLASSES = [
  "left-[50%] top-[88%] -translate-x-1/2",
  "left-[14%] top-[72%] -translate-x-1/2",
  "left-[36%] top-[72%] -translate-x-1/2",
  "left-[64%] top-[72%] -translate-x-1/2",
  "left-[86%] top-[72%] -translate-x-1/2",
  "left-[14%] top-[50%] -translate-x-1/2",
  "left-[36%] top-[50%] -translate-x-1/2",
  "left-[50%] top-[42%] -translate-x-1/2",
  "left-[64%] top-[50%] -translate-x-1/2",
  "left-[32%] top-[24%] -translate-x-1/2",
  "left-[68%] top-[24%] -translate-x-1/2",
];

export function WhatIfBoard({ players }: { players: Array<{ id?: string | null; players?: { name?: string | null; position?: string | null } | null; pass_accuracy?: number | null; duels_won?: number | null; duels_total?: number | null; ball_recoveries?: number | null; rating?: number | null; }> }) {
  const [formation, setFormation] = useState("4-3-3");
  const layout = FORMATION_LAYOUTS[formation] ?? FORMATION_LAYOUTS["4-3-3"];

  const suggestions = useMemo(() => {
    const defenders = players.filter((player) => ["LV", "RV", "IV", "LIV", "RIV", "ZDM"].includes(player.players?.position || ""));
    const attackers = players.filter((player) => ["LA", "RA", "ST", "HS", "ZOM"].includes(player.players?.position || ""));
    const avgDuelRate = defenders.length
      ? defenders.reduce((sum, player) => {
          const total = player.duels_total || 0;
          return sum + (total > 0 ? ((player.duels_won || 0) / total) * 100 : 0);
        }, 0) / defenders.length
      : 0;
    const avgPassing = players.length
      ? players.reduce((sum, player) => sum + (player.pass_accuracy || 0), 0) / players.length
      : 0;

    return [
      avgDuelRate < 50
        ? "Mehr Absicherung im Zentrum sinnvoll: Eine Formation mit zusätzlichem ZDM oder Dreierkette könnte das Restverteidigen stabilisieren."
        : "Die Defensivbasis wirkt stabil genug, um offensivere Rollen in höheren Zonen zu testen.",
      attackers.length < 3
        ? "Im letzten Datensatz sind wenige klare Offensivrollen erkennbar; ein Umbau auf 4-2-3-1 kann Zwischenräume besser besetzen."
        : "Mehr Breite über LA/RA kann helfen, Außenkorridore im Angriff sauberer zu besetzen.",
      avgPassing < 78
        ? "Wenn du einen passsicheren Spieler tiefer ziehst, verbessert sich wahrscheinlich Aufbau und Pressingresistenz."
        : "Mit der aktuellen Passqualität kann ein zusätzlicher Offensivspieler zwischen den Linien getestet werden.",
    ];
  }, [players]);

  return (
    <div className="glass-card space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="text-base font-semibold font-display">Was-wäre-wenn-Analyse</h3>
          <p className="text-sm text-muted-foreground">Interaktive Ersteinschätzung für Positionswechsel und Formationsumbauten.</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Formation</label>
        <select value={formation} onChange={(event) => setFormation(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          {FORMATIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="relative overflow-x-auto rounded-3xl border border-border bg-pitch/15 p-4">
          <div className="min-w-[640px]">
            <div className="absolute inset-4 rounded-[1.25rem] border border-pitch-line/40" />
            <div className="absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 bg-pitch-line/30" />
            <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-pitch-line/30" />
            <div className="relative h-[420px]">
              {layout.map((slot, index) => {
                const player = players[index];
                return (
                  <div key={`${slot}-${index}`} className={`absolute ${SLOT_CLASSES[index] || SLOT_CLASSES[SLOT_CLASSES.length - 1]}`}>
                    <div className="w-[82px] rounded-2xl border border-border bg-background/90 px-2.5 py-2 text-center shadow-sm sm:w-[96px]">
                      <p className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{POSITION_LABELS[slot] || slot}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4">{player?.players?.name || "Offen"}</p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">{player?.players?.position ? POSITION_LABELS[player.players.position] || player.players.position : "Noch kein Profil"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {suggestions.map((idea) => (
            <div key={idea} className="flex items-start gap-2 rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="leading-6">{idea}</span>
            </div>
          ))}
          <div className="rounded-2xl border border-border bg-secondary/50 p-3 text-xs leading-5 text-muted-foreground">
            <p>{AI_RECOMMENDATION_DISCLAIMER}</p>
            <p className="mt-1">{AI_DISCLAIMER}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
