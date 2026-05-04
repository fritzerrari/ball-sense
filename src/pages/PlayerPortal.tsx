// Player-Portal — Read-Only-Sicht für Spieler/Eltern (verlinkt via player_portal_invites).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonCard } from "@/components/SkeletonCard";
import { HeatmapField } from "@/components/HeatmapField";
import { mergeHeatmaps } from "@/lib/stats";
import { Activity, Gauge, Goal, Trophy, User, Zap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigate } from "react-router-dom";

interface PlayerLike { id: string; name: string; number: number | null; position: string | null }
interface StatLike {
  match_id: string; distance_km: number | null; top_speed_kmh: number | null;
  sprint_count: number | null; goals: number | null; assists: number | null;
  minutes_played: number | null; heatmap_grid: number[][] | null;
}

export default function PlayerPortal() {
  const { user, loading } = useAuth();
  const [player, setPlayer] = useState<PlayerLike | null>(null);
  const [stats, setStats] = useState<StatLike[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("player_portal_player_id").eq("user_id", user.id).maybeSingle();
      const playerId = profile?.player_portal_player_id;
      if (!playerId) { setLoadingData(false); return; }
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("players").select("id, name, number, position").eq("id", playerId).maybeSingle(),
        supabase.from("player_match_stats").select("match_id, distance_km, top_speed_kmh, sprint_count, goals, assists, minutes_played, heatmap_grid").eq("player_id", playerId),
      ]);
      setPlayer(p as PlayerLike);
      setStats((s ?? []) as StatLike[]);
      setLoadingData(false);
    })();
  }, [user, loading]);

  if (loading || loadingData) {
    return <div className="mx-auto max-w-3xl p-6"><SkeletonCard count={3} /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!player) {
    return (
      <div className="mx-auto max-w-md py-20 px-4 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-bold">Spieler-Portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dein Account ist noch keinem Spieler zugeordnet. Bitte deinen Trainer um eine Einladung an deine E-Mail-Adresse.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>
          <LogOut className="mr-2 h-4 w-4" /> Abmelden
        </Button>
      </div>
    );
  }

  const games = stats.length;
  const totalKm = stats.reduce((s, x) => s + (x.distance_km ?? 0), 0);
  const totalGoals = stats.reduce((s, x) => s + (x.goals ?? 0), 0);
  const totalAssists = stats.reduce((s, x) => s + (x.assists ?? 0), 0);
  const totalSprints = stats.reduce((s, x) => s + (x.sprint_count ?? 0), 0);
  const maxSpeed = stats.reduce((m, x) => Math.max(m, x.top_speed_kmh ?? 0), 0);
  const minutes = stats.reduce((s, x) => s + (x.minutes_played ?? 0), 0);

  const heatmap = mergeHeatmaps(stats.map(s => s.heatmap_grid).filter(Boolean) as number[][][]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-12">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-emerald-600 p-6 text-primary-foreground shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white/20 backdrop-blur">
              {player.number ? <span className="text-2xl font-bold">{player.number}</span> : <User className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Mein Spieler-Profil</p>
              <h1 className="text-2xl font-bold">{player.name}</h1>
              {player.position && <p className="text-sm opacity-80">{player.position}</p>}
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <PortalStat big={games} small="Spiele" />
          <PortalStat big={totalGoals} small="Tore" />
          <PortalStat big={totalAssists} small="Assists" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Activity} label="Distanz" value={`${totalKm.toFixed(1)} km`} />
        <KpiCard icon={Gauge} label="Top-Speed" value={`${maxSpeed.toFixed(1)} km/h`} />
        <KpiCard icon={Zap} label="Sprints" value={totalSprints} />
        <KpiCard icon={Goal} label="Spielzeit" value={`${minutes} min`} />
      </div>

      {heatmap && (
        <Card>
          <CardHeader><CardTitle className="text-base">Deine Heatmap (alle Spiele)</CardTitle></CardHeader>
          <CardContent><HeatmapField grid={heatmap} /></CardContent>
        </Card>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Dies ist eine Read-Only-Ansicht. Daten werden automatisch nach jedem analysierten Spiel aktualisiert.
      </p>
    </div>
  );
}

function PortalStat({ big, small }: { big: string | number; small: string }) {
  return (
    <div>
      <p className="text-2xl font-bold leading-none">{big}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider opacity-80">{small}</p>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className="mt-1 text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
