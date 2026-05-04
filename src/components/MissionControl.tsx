import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Trophy, Users, Video, BarChart3, Settings as SettingsIcon,
  PlayCircle, Sparkles, RefreshCw, Loader2, ArrowRight, Clock, MapPin,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useMatches } from "@/hooks/use-matches";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { HelpTooltip } from "@/components/HelpTooltip";

function formatDate(d: string, t?: string | null) {
  const dt = new Date(d + (t ? `T${t}` : "T12:00"));
  return dt.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) + (t ? ` · ${t.slice(0, 5)}` : "");
}
function daysUntil(d: string) {
  const ms = new Date(d + "T12:00").getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function MissionControl() {
  const { clubId, clubName } = useAuth();
  const { data: matches } = useMatches();
  const [refreshing, setRefreshing] = useState(false);

  const { data: defaultTeam, refetch: refetchTeam } = useQuery({
    queryKey: ["mc-default-team", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data } = await supabase
        .from("club_teams")
        .select("*")
        .eq("club_id", clubId!)
        .eq("is_default", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: nextFixture, refetch: refetchFixture } = useQuery({
    queryKey: ["mc-next-fixture", defaultTeam?.id],
    enabled: !!defaultTeam?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("team_fixtures")
        .select("*")
        .eq("team_id", defaultTeam!.id)
        .gte("match_date", new Date().toISOString().slice(0, 10))
        .order("match_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: topScorers } = useQuery({
    queryKey: ["mc-top-scorers", defaultTeam?.id],
    enabled: !!defaultTeam?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("team_players")
        .select("player_name,goals,assists,shirt_number")
        .eq("team_id", defaultTeam!.id)
        .order("goals", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: recentResults } = useQuery({
    queryKey: ["mc-recent", defaultTeam?.id],
    enabled: !!defaultTeam?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("team_fixtures")
        .select("home_team_name,away_team_name,home_score,away_score,is_home,match_date")
        .eq("team_id", defaultTeam!.id)
        .not("home_score", "is", null)
        .order("match_date", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const formStr = (recentResults ?? []).slice().reverse().map((r: any) => {
    const us = r.is_home ? r.home_score : r.away_score;
    const them = r.is_home ? r.away_score : r.home_score;
    if (us == null || them == null) return "·";
    return us > them ? "S" : us < them ? "N" : "U";
  }).join(" ");

  const refresh = async () => {
    if (!defaultTeam?.metadata || !(defaultTeam.metadata as any)?.club_root_url) {
      toast.info("Importiere zuerst deinen Verein in Einstellungen → Mannschafts-Bibliothek.");
      return;
    }
    setRefreshing(true);
    const tid = toast.loading("Aktualisiere Live-Daten…");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-club-teams", {
        body: {
          club_url: (defaultTeam.metadata as any).club_root_url,
          club_id: clubId,
          scope: "all",
        },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Fehler");
      toast.success("Live-Daten aktualisiert", { id: tid });
      await Promise.all([refetchTeam(), refetchFixture()]);
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setRefreshing(false);
    }
  };

  // ZONE 1 — what matters most right now
  const heroAction = (() => {
    if (nextFixture) {
      const d = daysUntil(nextFixture.match_date);
      if (d <= 0) return { emoji: "⚽", title: "Spieltag heute!", body: `${nextFixture.is_home ? "vs." : "@"} ${nextFixture.is_home ? nextFixture.away_team_name : nextFixture.home_team_name}`, cta: "Spiel starten", to: "/matches/new" };
      if (d <= 2) return { emoji: "🎯", title: `Spiel in ${d} Tag${d === 1 ? "" : "en"}`, body: `${nextFixture.is_home ? "vs." : "@"} ${nextFixture.is_home ? nextFixture.away_team_name : nextFixture.home_team_name} · Aufstellung & Briefing vorbereiten`, cta: "Spiel anlegen", to: "/matches/new" };
      return { emoji: "📅", title: `Nächstes Spiel in ${d} Tagen`, body: `${formatDate(nextFixture.match_date, nextFixture.kickoff_time)} · ${nextFixture.is_home ? "Heim" : "Auswärts"} ${nextFixture.is_home ? nextFixture.away_team_name : nextFixture.home_team_name}`, cta: "Spiel anlegen", to: "/matches/new" };
    }
    if (!matches?.length) return { emoji: "🚀", title: "Willkommen, Trainer!", body: "Lege dein erstes Spiel an – wir analysieren es automatisch.", cta: "Erstes Spiel anlegen", to: "/matches/new" };
    return { emoji: "✨", title: "Alles im Griff", body: "Kein Spiel in Sicht. Schau dir Trends & Analysen an.", cta: "Trends ansehen", to: "/trend" };
  })();

  return (
    <div className="space-y-6">
      {/* ZONE 1 — HEUTE / NEXT */}
      <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 relative overflow-hidden">
        <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">Heute</div>
        <div className="text-4xl md:text-5xl mb-2">{heroAction.emoji}</div>
        <h2 className="text-xl md:text-2xl font-bold">{heroAction.title}</h2>
        <p className="text-sm md:text-base text-muted-foreground mt-1 max-w-xl">{heroAction.body}</p>
        <Button asChild size="lg" className="mt-4">
          <Link to={heroAction.to}>{heroAction.cta} <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </Card>

      {/* ZONE 2 — DEINE MANNSCHAFT (live) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{defaultTeam ? `Deine ${defaultTeam.name}` : "Deine Mannschaft"}</h3>
            <HelpTooltip>Live-Daten von fussball.de · automatisch jede Nacht aktualisiert.</HelpTooltip>
          </div>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing || !defaultTeam}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Aktualisieren
          </Button>
        </div>

        {!defaultTeam ? (
          <Card className="p-6 border-dashed text-center">
            <Sparkles className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="font-medium">Noch keine Mannschaft ausgewählt</p>
            <p className="text-sm text-muted-foreground mt-1">Importiere in 30 Sek. deinen Verein – Tabelle, Spielplan und Kader landen automatisch hier.</p>
            <Button asChild className="mt-3"><Link to="/settings">Mannschaft einrichten</Link></Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {/* Tabelle / Form */}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Trophy className="h-3.5 w-3.5" /> TABELLE</div>
              <div className="text-2xl font-bold">{defaultTeam.table_position ? `Platz ${defaultTeam.table_position}` : "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {defaultTeam.points != null && `${defaultTeam.points} Pkt`}
                {defaultTeam.goal_difference && ` · ${defaultTeam.goal_difference}`}
              </div>
              {formStr && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Form:</span>
                  <span className="font-mono font-semibold tracking-wider">{formStr}</span>
                </div>
              )}
            </Card>

            {/* Nächstes Spiel */}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Calendar className="h-3.5 w-3.5" /> NÄCHSTES SPIEL</div>
              {nextFixture ? (
                <>
                  <div className="font-semibold truncate">
                    {nextFixture.is_home ? `vs. ${nextFixture.away_team_name}` : `@ ${nextFixture.home_team_name}`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDate(nextFixture.match_date, nextFixture.kickoff_time)}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {nextFixture.is_home ? "Heim" : "Auswärts"}
                    {nextFixture.competition && ` · ${nextFixture.competition}`}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Kein Spiel geplant</div>
              )}
            </Card>

            {/* Top Scorer */}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Users className="h-3.5 w-3.5" /> TOP SCORER</div>
              {topScorers && topScorers.length > 0 ? (
                <ul className="space-y-1 mt-1">
                  {topScorers.slice(0, 3).map((p: any, i) => (
                    <li key={i} className="text-sm flex items-center justify-between gap-2">
                      <span className="truncate">
                        {p.shirt_number ? <span className="text-muted-foreground mr-1">#{p.shirt_number}</span> : null}
                        {p.player_name}
                      </span>
                      <span className="font-semibold tabular-nums">{p.goals ?? 0}⚽</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">Noch keine Stats</div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ZONE 3 — Werkzeuge */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Was möchtest du tun?</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ToolTile to="/matches/new" icon={Video} title="Spiel aufnehmen" desc="Mit dem Handy filmen – wir analysieren automatisch." accent />
          <ToolTile to="/matches" icon={BarChart3} title="Analysen ansehen" desc="Heatmaps, Pässe, Highlights aller Spiele." />
          <ToolTile to="/players" icon={Users} title="Mannschaft verwalten" desc="Kader, Aufstellungen, Spieler-Profile." />
          <ToolTile to="/settings" icon={SettingsIcon} title="Einstellungen" desc="Verein, Helfer-Codes, Team-Bibliothek." />
        </div>
      </div>
    </div>
  );
}

function ToolTile({ to, icon: Icon, title, desc, accent }: { to: string; icon: any; title: string; desc: string; accent?: boolean }) {
  return (
    <Link to={to} className="group">
      <Card className={`p-4 h-full transition hover:shadow-md hover:border-primary/40 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${accent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        <div className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
          Öffnen <ArrowRight className="h-3 w-3" />
        </div>
      </Card>
    </Link>
  );
}
