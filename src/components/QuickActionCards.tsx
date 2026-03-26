import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, Gamepad2 } from "lucide-react";

interface ReportSection {
  id: string;
  section_type: string;
  title: string;
  content: string;
  confidence: string;
}

interface QuickActionCardsProps {
  insights: ReportSection[];
  riskMatrix: any;
  nextMatchActions: any;
  onTabChange: (tab: string) => void;
}

function parseJson(content: string): any {
  try { return JSON.parse(content); } catch { return null; }
}

export default function QuickActionCards({ insights, riskMatrix, nextMatchActions, onTabChange }: QuickActionCardsProps) {
  // Extract top 3 strengths from insights with highest impact_score
  const parsedInsights = insights
    .map(ins => ({ ...ins, parsed: parseJson(ins.content) }))
    .filter(ins => ins.parsed?.impact_score)
    .sort((a, b) => (b.parsed.impact_score ?? 0) - (a.parsed.impact_score ?? 0));

  const strengths = parsedInsights.slice(0, 3).map(ins => ins.parsed?.description ?? ins.content);

  // Extract top risks
  const risks: string[] = [];
  if (riskMatrix && Array.isArray(riskMatrix)) {
    const urgent = riskMatrix
      .filter((r: any) => r.urgency === "immediate" || r.severity === "high")
      .slice(0, 3);
    urgent.forEach((r: any) => risks.push(r.title ?? r.description ?? "Risiko"));
  }
  if (risks.length === 0 && riskMatrix && Array.isArray(riskMatrix)) {
    riskMatrix.slice(0, 3).forEach((r: any) => risks.push(r.title ?? r.description ?? "Risiko"));
  }

  // Extract do-actions for next match
  const doActions: string[] = [];
  if (nextMatchActions) {
    const actions = nextMatchActions.do ?? nextMatchActions.actions ?? [];
    (Array.isArray(actions) ? actions : []).slice(0, 3).forEach((a: any) =>
      doActions.push(typeof a === "string" ? a : a.action ?? a.description ?? "")
    );
  }

  const cards = [
    {
      key: "strengths",
      title: "Top-Stärken",
      icon: TrendingUp,
      items: strengths.length > 0 ? strengths : ["Analyse noch unvollständig"],
      gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      accent: "bg-emerald-500",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
      tab: "overview",
    },
    {
      key: "fixes",
      title: "Sofort verbessern",
      icon: AlertTriangle,
      items: risks.length > 0 ? risks : ["Keine kritischen Risiken erkannt"],
      gradient: "from-red-500/20 via-red-500/5 to-transparent",
      accent: "bg-red-500",
      iconBg: "bg-red-500/15",
      iconColor: "text-red-500",
      borderColor: "border-red-500/20 hover:border-red-500/40",
      tab: "overview",
    },
    {
      key: "plan",
      title: "Nächstes Spiel",
      icon: Gamepad2,
      items: doActions.length > 0 ? doActions : ["Spielplan wird generiert…"],
      gradient: "from-blue-500/20 via-blue-500/5 to-transparent",
      accent: "bg-blue-500",
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
      borderColor: "border-blue-500/20 hover:border-blue-500/40",
      tab: "opponent",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.button
            key={card.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
            onClick={() => onTabChange(card.tab)}
            className={`group relative overflow-hidden rounded-2xl border ${card.borderColor} bg-card/80 backdrop-blur-sm p-5 text-left transition-all hover:shadow-lg`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${card.accent}`} />
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <h3 className="font-semibold font-display text-sm">{card.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {card.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${card.accent}`} />
                    <span className="line-clamp-2">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
