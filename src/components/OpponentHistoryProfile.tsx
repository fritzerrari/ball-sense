import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Trophy, Target, TrendingUp, Shield, Swords, Calendar, BarChart3 } from "lucide-react";
import type { OpponentProfile } from "@/hooks/use-opponent-history";

interface Props {
  profile: OpponentProfile;
}

export default function OpponentHistoryProfile({ profile }: Props) {
  const {
    opponent, matchCount, wins, draws, losses,
    avgPossession, avgGoalsScored, avgGoalsConceded,
    commonFormation, attackSide, weaknesses,
  } = profile;

  const winRate = matchCount > 0 ? Math.round((wins / matchCount) * 100) : 0;

  const sideLabels: Record<string, string> = {
    left: "Links", right: "Rechts", center: "Zentral",
  };

  return (
    <Card className="border-accent/30 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-accent to-primary/50" />
      <CardContent className="pt-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-accent-foreground" />
            <h2 className="font-semibold font-display">Gegner-Profil: {opponent}</h2>
          </div>
          <Badge variant="outline" className="text-[9px] border-accent/30 text-accent-foreground">
            {matchCount} {matchCount === 1 ? "Spiel" : "Spiele"} analysiert
          </Badge>
        </div>

        {/* Record */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={Trophy}
            label="Bilanz"
            value={`${wins}S / ${draws}U / ${losses}N`}
            sub={`${winRate}% Siegquote`}
            color={winRate >= 50 ? "text-primary" : winRate >= 30 ? "text-warning" : "text-destructive"}
          />
          <StatCard
            icon={Target}
            label="⌀ Tore"
            value={`${avgGoalsScored} : ${avgGoalsConceded}`}
            sub="Erzielt : Kassiert"
          />
          {avgPossession != null && (
            <StatCard
              icon={BarChart3}
              label="⌀ Ballbesitz"
              value={`${avgPossession}%`}
              sub="Eigener Durchschnitt"
            />
          )}
          {commonFormation && (
            <StatCard
              icon={Swords}
              label="Häufigste Formation"
              value={commonFormation}
              sub="Eigene Aufstellung"
            />
          )}
        </div>

        {/* Attack tendencies */}
        {attackSide && (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Stärkste Angriffsseite gegen {opponent}
              </p>
            </div>
            <p className="text-lg font-bold font-display">
              {sideLabels[attackSide] ?? attackSide}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Basierend auf Gefahrenzonen-Analyse vergangener Spiele
            </p>
          </div>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-destructive" />
              <p className="text-xs font-semibold text-destructive">
                Phasen mit Gegner-Dominanz
              </p>
            </div>
            <ul className="space-y-1.5">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                  <span className="text-destructive/60 mt-1">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Past matches list */}
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> Vergangene Spiele
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.matches.slice(0, 5).map((m) => (
              <Badge key={m.id} variant="outline" className="text-[10px]">
                {new Date(m.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                {m.status === "complete" && " ✓"}
              </Badge>
            ))}
            {profile.matches.length > 5 && (
              <Badge variant="secondary" className="text-[10px]">
                +{profile.matches.length - 5} weitere
              </Badge>
            )}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center pt-1">
          Dieses Profil basiert ausschließlich auf deinen eigenen Spieldaten — keine externen Quellen.
        </p>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Trophy; label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className={`text-lg font-bold font-display ${color ?? ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
