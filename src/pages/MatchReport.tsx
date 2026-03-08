import AppLayout from "@/components/AppLayout";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { BarChart3, Zap, Route, Users, ArrowUpDown, ArrowLeft, FileText, Download, Share2, ChevronDown, ChevronUp } from "lucide-react";
import ReportGenerator from "@/components/ReportGenerator";
import ApiFootballStatsCard from "@/components/ApiFootballStatsCard";
import { useMatch, useMatchLineups, useTrackingUploads } from "@/hooks/use-matches";
import { usePlayerMatchStats, useTeamMatchStats, useApiFootballStats } from "@/hooks/use-match-stats";
import { useAuth } from "@/components/AuthProvider";
import { HeatmapField } from "@/components/HeatmapField";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const tabs = ["Übersicht", "Heim", "Auswärts", "Vergleich", "KI-Bericht"];

export default function MatchReport() {
  const { id } = useParams();
  const { clubName } = useAuth();
  const { data: match, isLoading } = useMatch(id);
  const { data: lineups } = useMatchLineups(id);
  const { data: playerStats } = usePlayerMatchStats(id);
  const { data: teamStats } = useTeamMatchStats(id);
  const { data: uploads } = useTrackingUploads(id);
  const [activeTab, setActiveTab] = useState("Übersicht");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("distance_km");
  const [sortAsc, setSortAsc] = useState(false);

  if (isLoading) return <AppLayout><div className="max-w-5xl mx-auto"><SkeletonCard count={3} /></div></AppLayout>;
  if (!match) return <AppLayout><div className="max-w-5xl mx-auto text-muted-foreground text-center py-20">Spiel nicht gefunden</div></AppLayout>;

  const homeTeamStats = teamStats?.find(t => t.team === "home");
  const awayTeamStats = teamStats?.find(t => t.team === "away");
  const homePlayerStats = (playerStats ?? []).filter(s => s.team === "home");
  const awayPlayerStats = (playerStats ?? []).filter(s => s.team === "away");
  const hasStats = (playerStats?.length ?? 0) > 0;

  const sortPlayers = (stats: any[]) => {
    return [...stats].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? va - vb : vb - va;
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort(field)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3" /></span>
    </th>
  );

  const renderTeamCard = (label: string, stats: any) => (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-semibold font-display">{label}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-xs text-muted-foreground">Ø km/Spieler</div><div className="text-xl font-bold font-display">{stats?.avg_distance_km?.toFixed(1) ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Gesamt</div><div className="text-xl font-bold font-display">{stats?.total_distance_km?.toFixed(1) ?? "—"} <span className="text-sm font-normal">km</span></div></div>
        <div><div className="text-xs text-muted-foreground">Topspeed</div><div className="text-xl font-bold font-display">{stats?.top_speed_kmh?.toFixed(1) ?? "—"} <span className="text-sm font-normal">km/h</span></div></div>
        <div><div className="text-xs text-muted-foreground">Ballbesitz</div><div className="text-xl font-bold font-display">{stats?.possession_pct ? `${stats.possession_pct}%` : "—"}</div></div>
      </div>
    </div>
  );

  const renderPlayerTable = (stats: any[]) => {
    if (stats.length === 0) {
      return (
        <div className="glass-card p-8 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Spielerstatistiken verfügbar.</p>
        </div>
      );
    }
    return (
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Spieler</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">#</th>
              <SortHeader label="km" field="distance_km" />
              <SortHeader label="Top km/h" field="top_speed_kmh" />
              <SortHeader label="Sprints" field="sprint_count" />
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden md:table-cell">Min</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sortPlayers(stats).map((p: any) => (
              <>
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setExpandedPlayer(expandedPlayer === p.id ? null : p.id)}>
                  <td className="py-3 px-4 font-medium">{p.players?.name ?? "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.players?.number ?? "—"}</td>
                  <td className="py-3 px-4 font-semibold">{p.distance_km?.toFixed(1) ?? "—"}</td>
                  <td className="py-3 px-4">{p.top_speed_kmh?.toFixed(1) ?? "—"}</td>
                  <td className="py-3 px-4">{p.sprint_count ?? 0}</td>
                  <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{p.minutes_played ?? "—"}</td>
                  <td className="py-3 px-4">{expandedPlayer === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</td>
                </tr>
                {expandedPlayer === p.id && (
                  <tr key={`${p.id}-detail`}>
                    <td colSpan={7} className="p-4 bg-muted/10">
                      <div className="grid md:grid-cols-2 gap-4">
                        <HeatmapField label="Heatmap" grid={p.heatmap_grid as number[][] | null} compact />
                        <div className="space-y-3">
                          <div className="glass-card p-3">
                            <div className="text-xs text-muted-foreground">Ø Geschwindigkeit</div>
                            <div className="text-lg font-bold font-display">{p.avg_speed_kmh?.toFixed(1) ?? "—"} km/h</div>
                          </div>
                          <div className="glass-card p-3">
                            <div className="text-xs text-muted-foreground">Sprint-Distanz</div>
                            <div className="text-lg font-bold font-display">{p.sprint_distance_m ? `${Math.round(p.sprint_distance_m)} m` : "—"}</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link to="/matches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Spiele
        </Link>

        {/* Header */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <StatusBadge status={match.status} />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => toast.info("PDF-Export wird vorbereitet...")}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
              <Button variant="ghost" size="sm" onClick={() => toast.info("Excel-Export wird vorbereitet...")}><Download className="h-4 w-4 mr-1" /> Excel</Button>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link kopiert!"); }}><Share2 className="h-4 w-4 mr-1" /> Teilen</Button>
            </div>
          </div>
          <h1 className="text-2xl font-bold font-display">{clubName} vs {match.away_club_name || "TBD"}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(match.date).toLocaleDateString("de-DE")}
            {match.kickoff && ` · ${match.kickoff}`}
            {match.fields && ` · ${(match.fields as any).name}`}
          </p>
          {/* Tracking links for setup matches */}
          {match.status === "setup" && (
            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-primary font-medium mb-2">Tracking-Links:</p>
              <div className="space-y-1">
                {[0, 1, 2].map(i => (
                  <button
                    key={i}
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/matches/${id}/track?cam=${i}`); toast.success(`Link Kamera ${i+1} kopiert!`); }}
                    className="block text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                  >
                    Kamera {i + 1}: /matches/{id}/track?cam={i}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upload status */}
        {uploads && uploads.length > 0 && (
          <div className="flex gap-3">
            {uploads.map((u: any) => (
              <div key={u.id} className="glass-card p-3 flex-1">
                <div className="text-xs text-muted-foreground">Kamera {u.camera_index + 1}</div>
                <StatusBadge status={u.status} />
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Übersicht" && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              {renderTeamCard(clubName ?? "Heim", homeTeamStats)}
              {renderTeamCard(match.away_club_name ?? "Auswärts", awayTeamStats)}
            </div>
            {hasStats ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <HeatmapField label="Team-Heatmap Heim" grid={homeTeamStats?.formation_heatmap as number[][] | null} />
                <HeatmapField label="Team-Heatmap Auswärts" grid={awayTeamStats?.formation_heatmap as number[][] | null} />
              </div>
            ) : (
              <div className="glass-card p-8 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Statistiken werden nach dem Tracking verfügbar.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "KI-Bericht" && (
          <ReportGenerator
            matchId={match.id}
            matchStatus={match.status}
            clubName={clubName ?? "Heim"}
            awayClubName={match.away_club_name ?? "Gegner"}
            matchDate={match.date}
          />
        )}
        {activeTab === "Heim" && renderPlayerTable(homePlayerStats)}
        {activeTab === "Auswärts" && renderPlayerTable(awayPlayerStats)}

        {activeTab === "Vergleich" && (
          <div className="space-y-6">
            {hasStats ? (
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Distanz", home: homeTeamStats?.total_distance_km?.toFixed(1), away: awayTeamStats?.total_distance_km?.toFixed(1), unit: "km" },
                  { label: "Top Speed", home: homeTeamStats?.top_speed_kmh?.toFixed(1), away: awayTeamStats?.top_speed_kmh?.toFixed(1), unit: "km/h" },
                  { label: "Ø Distanz", home: homeTeamStats?.avg_distance_km?.toFixed(1), away: awayTeamStats?.avg_distance_km?.toFixed(1), unit: "km" },
                ].map(c => (
                  <div key={c.label} className="glass-card p-5 text-center">
                    <div className="text-xs text-muted-foreground mb-3">{c.label}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold font-display text-primary">{c.home ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.unit}</div>
                      <div className="text-xl font-bold font-display">{c.away ?? "—"}</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>Heim</span><span>Auswärts</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-8 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Vergleichs-Charts werden nach dem ersten Tracking verfügbar.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
