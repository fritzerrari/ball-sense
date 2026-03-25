import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { Users } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Props {
  preselectedPlayer1?: string;
  preselectedPlayer2?: string;
}

export default function PlayerComparison({ preselectedPlayer1, preselectedPlayer2 }: Props) {
  const { clubId } = useAuth();
  const { language } = useTranslation();
  const de = language === "de";
  const [player1, setPlayer1] = useState(preselectedPlayer1 ?? "");
  const [player2, setPlayer2] = useState(preselectedPlayer2 ?? "");

  const { data: players } = useQuery({
    queryKey: ["compare-players", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase.from("players").select("id, name, number, position").eq("club_id", clubId).eq("active", true).order("name");
      return data ?? [];
    },
    enabled: !!clubId,
  });

  const { data: stats1 } = useQuery({
    queryKey: ["compare-stats", player1],
    queryFn: async () => {
      const { data } = await supabase.from("player_match_stats").select("*, matches(date, away_club_name)").eq("player_id", player1).order("matches(date)", { ascending: true }).limit(10);
      return data ?? [];
    },
    enabled: !!player1,
  });

  const { data: stats2 } = useQuery({
    queryKey: ["compare-stats", player2],
    queryFn: async () => {
      const { data } = await supabase.from("player_match_stats").select("*, matches(date, away_club_name)").eq("player_id", player2).order("matches(date)", { ascending: true }).limit(10);
      return data ?? [];
    },
    enabled: !!player2,
  });

  const calcAvg = (stats: any[], key: string) => {
    const vals = stats.filter(s => s[key] != null).map(s => s[key]);
    return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
  };

  const normalize = (val: number, max: number) => Math.min(100, (val / max) * 100);

  const hasData = stats1?.length && stats2?.length;

  const radarData = hasData ? [
    { metric: de ? "Distanz" : "Distance", p1: normalize(calcAvg(stats1!, "distance_km"), 12), p2: normalize(calcAvg(stats2!, "distance_km"), 12) },
    { metric: de ? "Sprints" : "Sprints", p1: normalize(calcAvg(stats1!, "sprint_count"), 30), p2: normalize(calcAvg(stats2!, "sprint_count"), 30) },
    { metric: de ? "Passquote" : "Pass%", p1: calcAvg(stats1!, "pass_accuracy"), p2: calcAvg(stats2!, "pass_accuracy") },
    { metric: de ? "Zweikampf" : "Duels%", p1: normalize(calcAvg(stats1!, "duels_won"), calcAvg(stats1!, "duels_total") || 1) * 100, p2: normalize(calcAvg(stats2!, "duels_won"), calcAvg(stats2!, "duels_total") || 1) * 100 },
    { metric: de ? "Ballkontakte" : "Touches", p1: normalize(calcAvg(stats1!, "ball_contacts"), 80), p2: normalize(calcAvg(stats2!, "ball_contacts"), 80) },
    { metric: de ? "Ballgewinne" : "Recoveries", p1: normalize(calcAvg(stats1!, "ball_recoveries"), 10), p2: normalize(calcAvg(stats2!, "ball_recoveries"), 10) },
    { metric: de ? "Tore+Assists" : "G+A", p1: normalize(calcAvg(stats1!, "goals") + calcAvg(stats1!, "assists"), 3), p2: normalize(calcAvg(stats2!, "goals") + calcAvg(stats2!, "assists"), 3) },
    { metric: "Rating", p1: normalize(calcAvg(stats1!, "rating"), 10) * 10, p2: normalize(calcAvg(stats2!, "rating"), 10) * 10 },
  ] : [];

  const p1Name = players?.find(p => p.id === player1)?.name ?? "Spieler 1";
  const p2Name = players?.find(p => p.id === player2)?.name ?? "Spieler 2";

  // Trend data
  const trendData = hasData ? stats1!.map((s: any, i: number) => ({
    date: s.matches?.date ? new Date(s.matches.date).toLocaleDateString(de ? "de-DE" : "en-US", { day: "2-digit", month: "short" }) : `#${i + 1}`,
    p1Rating: s.rating ?? 0,
    p2Rating: stats2![Math.min(i, stats2!.length - 1)]?.rating ?? 0,
  })) : [];

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-semibold font-display">{de ? "Spieler-Vergleich" : "Player Comparison"}</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Select value={player1} onValueChange={setPlayer1}>
            <SelectTrigger><SelectValue placeholder={de ? "Spieler 1 wählen" : "Select player 1"} /></SelectTrigger>
            <SelectContent>
              {players?.filter(p => p.id !== player2).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ""}{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={player2} onValueChange={setPlayer2}>
            <SelectTrigger><SelectValue placeholder={de ? "Spieler 2 wählen" : "Select player 2"} /></SelectTrigger>
            <SelectContent>
              {players?.filter(p => p.id !== player1).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.number ? `#${p.number} ` : ""}{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasData && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Radar name={p1Name} dataKey="p1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                <Radar name={p2Name} dataKey="p2" stroke="hsl(0,70%,55%)" fill="hsl(0,70%,55%)" fillOpacity={0.15} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>

            {trendData.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">{de ? "Rating-Trend" : "Rating trend"}</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="p1Rating" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name={p1Name} />
                    <Line type="monotone" dataKey="p2Rating" stroke="hsl(0,70%,55%)" strokeWidth={2} dot={{ r: 3 }} name={p2Name} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {!hasData && player1 && player2 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {de ? "Nicht genug Daten für den Vergleich." : "Not enough data for comparison."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
