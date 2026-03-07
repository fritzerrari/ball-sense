import { useMemo } from "react";
import { Activity, Zap, Route, Timer, TrendingUp, Footprints } from "lucide-react";
import { getPlayerColor } from "./PitchVisualization";

interface PlayerRosterItem {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  active: boolean;
  stats?: {
    distance_km: number | null;
    top_speed_kmh: number | null;
    avg_speed_kmh: number | null;
    sprint_count: number | null;
    minutes_played: number | null;
    sprint_distance_m: number | null;
  };
}

interface PlayerRosterPanelProps {
  players: PlayerRosterItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  colorMap: Map<string, { color: string; index: number }>;
}

export default function PlayerRosterPanel({
  players,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  colorMap,
}: PlayerRosterPanelProps) {
  const activePlayers = useMemo(() => players.filter(p => p.active), [players]);
  const selectedPlayers = useMemo(() => activePlayers.filter(p => selectedIds.has(p.id)), [activePlayers, selectedIds]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
          Kader ({selectedIds.size}/{activePlayers.length})
        </span>
        <div className="flex gap-1">
          <button
            onClick={onSelectAll}
            className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
          >
            Alle
          </button>
          <button
            onClick={onDeselectAll}
            className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
          >
            Keine
          </button>
        </div>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        {activePlayers.map((player) => {
          const isSelected = selectedIds.has(player.id);
          const cm = colorMap.get(player.id);
          const color = cm?.color ?? "hsl(150, 10%, 45%)";

          return (
            <button
              key={player.id}
              onClick={() => onToggle(player.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all border-l-2 hover:bg-muted/50 ${
                isSelected
                  ? "border-l-current bg-muted/30"
                  : "border-l-transparent"
              }`}
              style={isSelected ? { borderLeftColor: color } : {}}
            >
              {/* Color dot / number */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all"
                style={{
                  backgroundColor: isSelected ? color : "hsl(var(--muted))",
                  color: isSelected ? "white" : "hsl(var(--muted-foreground))",
                  boxShadow: isSelected ? `0 0 8px ${color}40` : "none",
                }}
              >
                {player.number ?? "?"}
              </div>

              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium truncate ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                  {player.name}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {player.position ?? "–"}
                </div>
              </div>

              {/* Mini-indicator */}
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected player stats */}
      {selectedPlayers.length > 0 && (
        <div className="border-t border-border px-3 py-2.5 space-y-2 bg-muted/20">
          <div className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
            {selectedPlayers.length === 1 ? selectedPlayers[0].name : `${selectedPlayers.length} Spieler`} — Statistiken
          </div>

          {selectedPlayers.length === 1 && selectedPlayers[0].stats ? (
            <SinglePlayerStats stats={selectedPlayers[0].stats} />
          ) : selectedPlayers.length > 1 ? (
            <AggregatedStats players={selectedPlayers} />
          ) : (
            <div className="text-[10px] text-muted-foreground italic py-1">Keine Daten verfügbar</div>
          )}
        </div>
      )}
    </div>
  );
}

function SinglePlayerStats({ stats }: { stats: NonNullable<PlayerRosterItem["stats"]> }) {
  const items = [
    { icon: Route, label: "Distanz", value: stats.distance_km != null ? `${stats.distance_km.toFixed(1)} km` : "–" },
    { icon: Zap, label: "Topspeed", value: stats.top_speed_kmh != null ? `${stats.top_speed_kmh.toFixed(1)} km/h` : "–" },
    { icon: TrendingUp, label: "Ø Speed", value: stats.avg_speed_kmh != null ? `${stats.avg_speed_kmh.toFixed(1)} km/h` : "–" },
    { icon: Activity, label: "Sprints", value: stats.sprint_count != null ? `${stats.sprint_count}` : "–" },
    { icon: Footprints, label: "Sprint-Dist.", value: stats.sprint_distance_m != null ? `${Math.round(stats.sprint_distance_m)} m` : "–" },
    { icon: Timer, label: "Minuten", value: stats.minutes_played != null ? `${stats.minutes_played}'` : "–" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map(item => (
        <div key={item.label} className="flex flex-col items-center p-1.5 rounded-lg bg-background/50 border border-border/50">
          <item.icon className="h-3 w-3 text-primary mb-0.5" />
          <span className="text-[10px] font-bold text-foreground">{item.value}</span>
          <span className="text-[8px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function AggregatedStats({ players }: { players: PlayerRosterItem[] }) {
  const withStats = players.filter(p => p.stats);
  if (withStats.length === 0) {
    return <div className="text-[10px] text-muted-foreground italic py-1">Keine Daten verfügbar</div>;
  }

  const totalDist = withStats.reduce((s, p) => s + (p.stats!.distance_km ?? 0), 0);
  const maxSpeed = withStats.reduce((s, p) => Math.max(s, p.stats!.top_speed_kmh ?? 0), 0);
  const totalSprints = withStats.reduce((s, p) => s + (p.stats!.sprint_count ?? 0), 0);
  const avgDist = totalDist / withStats.length;

  const items = [
    { label: "Gesamt-km", value: `${totalDist.toFixed(1)} km` },
    { label: "Ø km/Spieler", value: `${avgDist.toFixed(1)} km` },
    { label: "Max Speed", value: `${maxSpeed.toFixed(1)} km/h` },
    { label: "Σ Sprints", value: `${totalSprints}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map(item => (
        <div key={item.label} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-background/50 border border-border/50">
          <span className="text-[9px] text-muted-foreground">{item.label}</span>
          <span className="text-[10px] font-bold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
