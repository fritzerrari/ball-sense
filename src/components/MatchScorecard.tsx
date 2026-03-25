import { motion } from "framer-motion";
import { Trophy, Swords, Shield, Zap, Scale } from "lucide-react";

interface MatchRating {
  overall: number;
  offense: number;
  defense: number;
  transitions: number;
  discipline: number;
}

interface Props {
  rating: MatchRating;
  homeTeam: string;
  awayTeam: string;
  date: string;
  kickoff?: string | null;
}

const SUB_SCORES = [
  { key: "offense" as const, label: "Angriff", icon: Swords, color: "hsl(160, 84%, 32%)" },
  { key: "defense" as const, label: "Verteidigung", icon: Shield, color: "hsl(210, 70%, 50%)" },
  { key: "transitions" as const, label: "Umschaltspiel", icon: Zap, color: "hsl(38, 92%, 50%)" },
  { key: "discipline" as const, label: "Disziplin", icon: Scale, color: "hsl(280, 60%, 55%)" },
];

function RadialGauge({ value, max = 10, size = 56, color, delay = 0 }: { value: number; max?: number; size?: number; color: string; delay?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);

  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - pct) }}
        transition={{ duration: 1.2, delay, ease: "easeOut" }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="fill-foreground font-bold font-display" fontSize={size * 0.32}>
        {value.toFixed(1)}
      </text>
    </svg>
  );
}

export default function MatchScorecard({ rating, homeTeam, awayTeam, date, kickoff }: Props) {
  const ratingColor = rating.overall >= 7 ? "text-emerald-400" : rating.overall >= 5 ? "text-amber-400" : "text-red-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-lg"
    >
      {/* Gradient accent bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-accent" />

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Main Rating */}
        <div className="flex flex-col items-center gap-1">
          <Trophy className="h-5 w-5 text-primary/60" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className={`text-5xl font-black font-display ${ratingColor}`}
          >
            {rating.overall.toFixed(1)}
          </motion.div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Match Rating</span>
        </div>

        {/* Match Info */}
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-lg font-bold font-display">{homeTeam} vs {awayTeam}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {kickoff && ` · ${kickoff}`}
          </p>
        </div>

        {/* Sub-Score Gauges */}
        <div className="grid grid-cols-4 gap-3">
          {SUB_SCORES.map((s, i) => (
            <div key={s.key} className="flex flex-col items-center gap-1">
              <RadialGauge value={rating[s.key]} color={s.color} delay={0.3 + i * 0.15} />
              <span className="text-[9px] text-muted-foreground font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
