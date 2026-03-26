import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search, Loader2, RefreshCw, Globe, Trophy, Users, Calendar,
  CheckCircle2, AlertCircle, Zap, AlertTriangle, BarChart3, Database,
} from "lucide-react";

interface ApiConfig {
  id: string;
  club_id: string;
  api_team_id: number | null;
  api_league_id: number | null;
  api_season: number;
  sync_enabled: boolean;
  last_sync_at: string | null;
}

export default function AdminApiFootball() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [teamSearch, setTeamSearch] = useState("");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("Germany");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [leagueResults, setLeagueResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedLeague, setSelectedLeague] = useState<any>(null);

  // Load all configs (admin view)
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["admin_api_football_configs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("api_football_config")
        .select("*, clubs(name)")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Load synced match stats count
  const { data: syncedStats = [] } = useQuery({
    queryKey: ["admin_api_football_stats_count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("api_football_match_stats")
        .select("id, club_id");
      return data ?? [];
    },
  });

  // Load API usage status
  const { data: apiUsage, isLoading: usageLoading } = useQuery({
    queryKey: ["admin_api_football_usage"],
    queryFn: async () => {
      const data = await callApiFootball("api_status", {});
      return data.status;
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  async function callApiFootball(action: string, params: Record<string, any> = {}) {
    const { data: session } = await supabase.auth.getSession();
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-football`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ action, ...params }),
      }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    return resp.json();
  }

  const searchTeams = async () => {
    if (!teamSearch.trim()) return;
    setSearching(true);
    try {
      const data = await callApiFootball("search_team", {
        query: teamSearch,
        country: countryFilter || undefined,
      });
      setSearchResults(data.teams || []);
      if (data.teams?.length === 0) toast.info("Keine Teams gefunden");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const searchLeagues = async () => {
    setSearching(true);
    try {
      const data = await callApiFootball("search_league", {
        query: leagueSearch || undefined,
        country: countryFilter || undefined,
      });
      setLeagueResults(data.leagues || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearching(false);
    }
  };

  const saveConfig = async (clubId: string) => {
    if (!selectedTeam && !selectedLeague) {
      toast.error("Bitte Team und Liga auswaehlen");
      return;
    }
    try {
      await callApiFootball("save_config", {
        club_id: clubId,
        api_team_id: selectedTeam?.team?.id,
        api_league_id: selectedLeague?.league?.id,
        sync_enabled: true,
      });
      toast.success("API-Football Konfiguration gespeichert");
      qc.invalidateQueries({ queryKey: ["admin_api_football_configs"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const syncFixtures = async (clubId: string) => {
    setSyncing(true);
    try {
      const data = await callApiFootball("sync_fixtures", { club_id: clubId });
      toast.success(`${data.synced} neue Spiele synchronisiert (${data.total} gesamt)`);
      qc.invalidateQueries({ queryKey: ["admin_api_football_stats_count"] });
      qc.invalidateQueries({ queryKey: ["admin_api_football_usage"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleSync = async (config: ApiConfig) => {
    try {
      await callApiFootball("save_config", {
        club_id: config.club_id,
        api_team_id: config.api_team_id,
        api_league_id: config.api_league_id,
        api_season: config.api_season,
        sync_enabled: !config.sync_enabled,
      });
      qc.invalidateQueries({ queryKey: ["admin_api_football_configs"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Parse API usage
  const requestsCurrent = apiUsage?.requests?.current ?? 0;
  const requestsLimit = apiUsage?.requests?.limit_day ?? 100;
  const usagePct = requestsLimit > 0 ? Math.round((requestsCurrent / requestsLimit) * 100) : 0;
  const isWarning = usagePct >= 70;
  const isCritical = usagePct >= 90;
  const planName = apiUsage?.subscription?.plan ?? "—";
  const endDate = apiUsage?.subscription?.end ?? null;

  return (
    <Tabs defaultValue="api-football" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="api-football" className="gap-1.5">
          <Zap className="h-3.5 w-3.5" /> API-Football
        </TabsTrigger>
        <TabsTrigger value="openligadb" className="gap-1.5">
          <Database className="h-3.5 w-3.5" /> OpenLigaDB
        </TabsTrigger>
      </TabsList>

      <TabsContent value="api-football" className="space-y-6">
      {/* API Usage Card */}
      <div className={`glass-card p-5 space-y-4 ${isCritical ? "border-destructive/50" : isWarning ? "border-yellow-500/50" : ""}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold font-display flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            API-Verbrauch
          </h3>
          <Button
            variant="ghost" size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin_api_football_usage"] })}
            className="h-7 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Aktualisieren
          </Button>
        </div>

        {usageLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Verbrauch...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Requests heute</div>
                <div className="text-xl font-bold font-display">{requestsCurrent}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Tages-Limit</div>
                <div className="text-xl font-bold font-display">{requestsLimit}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Plan</div>
                <div className="text-xl font-bold font-display capitalize">{planName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Verbleibend</div>
                <div className="text-xl font-bold font-display">{requestsLimit - requestsCurrent}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Auslastung</span>
                <span className={`font-medium ${isCritical ? "text-destructive" : isWarning ? "text-yellow-500" : "text-primary"}`}>
                  {usagePct}%
                </span>
              </div>
              <Progress
                value={usagePct}
                className={`h-2.5 ${isCritical ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-yellow-500" : ""}`}
              />
            </div>

            {isCritical && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-destructive">Kritisch: API-Limit fast erreicht!</p>
                  <p className="text-muted-foreground mt-0.5">
                    {usagePct}% des Tages-Limits verbraucht. Synchronisierungen sollten pausiert werden, um Ausfälle zu vermeiden.
                  </p>
                </div>
              </div>
            )}

            {isWarning && !isCritical && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-yellow-600 dark:text-yellow-400">Warnung: Hohes API-Volumen</p>
                  <p className="text-muted-foreground mt-0.5">
                    {usagePct}% des Tages-Limits verbraucht. Bitte sparsam synchronisieren.
                  </p>
                </div>
              </div>
            )}

            {endDate && (
              <div className="text-xs text-muted-foreground">
                Abo gültig bis: <span className="font-medium text-foreground">{endDate}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Current configs */}
      <div className="glass-card overflow-x-auto">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Verknuepfte Vereine</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Verein</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">API Team-ID</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Liga-ID</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Sync</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Spiele</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c: any) => {
              const statsCount = syncedStats.filter((s: any) => s.club_id === c.club_id).length;
              return (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium">{c.clubs?.name ?? c.club_id}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.api_team_id ?? "—"}</td>
                  <td className="py-3 px-4 text-muted-foreground">{c.api_league_id ?? "—"}</td>
                  <td className="py-3 px-4">
                    <Switch checked={c.sync_enabled} onCheckedChange={() => toggleSync(c)} />
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary" className="text-[10px]">{statsCount}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncFixtures(c.club_id)}
                      disabled={syncing || isCritical}
                      className="text-xs h-7"
                      title={isCritical ? "Sync gesperrt — API-Limit fast erreicht" : ""}
                    >
                      {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Sync
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {configs.length === 0 && !isLoading && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Noch keine Vereine mit API-Football verknuepft
          </div>
        )}
      </div>

      {/* Setup new connection */}
      <div className="glass-card p-6 space-y-5">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Neuen Verein verbinden
        </h3>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Land</label>
          <Input
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            placeholder="z.B. Germany"
            className="text-sm max-w-xs"
          />
        </div>

        {/* Team search */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground block">Team suchen</label>
          <div className="flex gap-2">
            <Input
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              placeholder="z.B. FC Bayern"
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && searchTeams()}
            />
            <Button variant="outline" size="sm" onClick={searchTeams} disabled={searching}>
              {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map((r: any) => (
                <button
                  key={r.team?.id}
                  onClick={() => { setSelectedTeam(r); setSearchResults([]); }}
                  className={`w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 text-left text-sm border-b border-border/50 last:border-0 ${
                    selectedTeam?.team?.id === r.team?.id ? "bg-primary/10" : ""
                  }`}
                >
                  {r.team?.logo && <img src={r.team.logo} alt="" className="w-6 h-6 object-contain" />}
                  <span className="font-medium">{r.team?.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{r.team?.country}</span>
                </button>
              ))}
            </div>
          )}
          {selectedTeam && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {selectedTeam.team?.logo && <img src={selectedTeam.team.logo} alt="" className="w-5 h-5 object-contain" />}
              <span className="text-sm font-medium">{selectedTeam.team?.name}</span>
              <span className="text-xs text-muted-foreground">ID: {selectedTeam.team?.id}</span>
            </div>
          )}
        </div>

        {/* League search */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground block">Liga suchen</label>
          <div className="flex gap-2">
            <Input
              value={leagueSearch}
              onChange={(e) => setLeagueSearch(e.target.value)}
              placeholder="z.B. Bundesliga"
              className="text-sm"
              onKeyDown={(e) => e.key === "Enter" && searchLeagues()}
            />
            <Button variant="outline" size="sm" onClick={searchLeagues} disabled={searching}>
              {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            </Button>
          </div>
          {leagueResults.length > 0 && (
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
              {leagueResults.map((r: any) => (
                <button
                  key={r.league?.id}
                  onClick={() => { setSelectedLeague(r); setLeagueResults([]); }}
                  className={`w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 text-left text-sm border-b border-border/50 last:border-0 ${
                    selectedLeague?.league?.id === r.league?.id ? "bg-primary/10" : ""
                  }`}
                >
                  {r.league?.logo && <img src={r.league.logo} alt="" className="w-5 h-5 object-contain" />}
                  <span className="font-medium">{r.league?.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{r.country?.name}</span>
                </button>
              ))}
            </div>
          )}
          {selectedLeague && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {selectedLeague.league?.logo && <img src={selectedLeague.league.logo} alt="" className="w-5 h-5 object-contain" />}
              <span className="text-sm font-medium">{selectedLeague.league?.name}</span>
              <span className="text-xs text-muted-foreground">ID: {selectedLeague.league?.id}</span>
            </div>
          )}
        </div>

        {/* Club selector + save */}
        {selectedTeam && selectedLeague && (
          <div className="space-y-2 pt-2">
            <label className="text-xs text-muted-foreground block">Verein zuordnen</label>
            <p className="text-xs text-muted-foreground">
              Waehle einen Verein aus dem Admin-Panel, dem diese API-Football-Daten zugeordnet werden sollen.
            </p>
            <ClubSelector onSave={(clubId) => saveConfig(clubId)} />
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="glass-card p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Deduplizierung</p>
          <p>
            FieldIQ-Trackingdaten (Laufdistanz, Sprints, Heatmaps) und API-Football-Daten (Tore, Paesse, Karten)
            werden getrennt gespeichert und bei der Analyse zusammengefuehrt. Es gibt keine Doppelzaehlung.
          </p>
          <p>
            Tracking-Daten: <Badge variant="secondary" className="text-[10px]">fieldiq</Badge>{" "}
            API-Daten: <Badge variant="secondary" className="text-[10px]">api-football</Badge>
          </p>
        </div>
      </div>
    </TabsContent>

      <TabsContent value="openligadb">
        <OpenLigaDBPanel />
      </TabsContent>
    </Tabs>
  );
}

// Simple club selector component
function ClubSelector({ onSave }: { onSave: (clubId: string) => void }) {
  const [clubSearch, setClubSearch] = useState("");
  const { data: clubs = [] } = useQuery({
    queryKey: ["admin_clubs_for_api"],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("id, name").order("name");
      return data ?? [];
    },
  });

  const filtered = clubSearch
    ? clubs.filter((c: any) => c.name.toLowerCase().includes(clubSearch.toLowerCase()))
    : clubs;

  return (
    <div className="space-y-2">
      <Input
        value={clubSearch}
        onChange={(e) => setClubSearch(e.target.value)}
        placeholder="Verein suchen..."
        className="text-sm"
      />
      <div className="border border-border rounded-lg max-h-32 overflow-y-auto">
        {filtered.map((c: any) => (
          <button
            key={c.id}
            onClick={() => onSave(c.id)}
            className="w-full flex items-center gap-2 p-2.5 hover:bg-muted/50 text-left text-sm border-b border-border/50 last:border-0"
          >
            <Trophy className="h-3 w-3 text-primary" />
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// OpenLigaDB Panel (free, no API key needed)
function OpenLigaDBPanel() {
  const [selectedLeague, setSelectedLeague] = useState("bl1");
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<any[] | null>(null);
  const [matchesData, setMatchesData] = useState<any[] | null>(null);
  const [leagueName, setLeagueName] = useState("");

  const leagues = [
    { key: "bl1", name: "1. Bundesliga" },
    { key: "bl2", name: "2. Bundesliga" },
    { key: "bl3", name: "3. Liga" },
  ];

  async function callOpenLigaDB(action: string, params: Record<string, any> = {}) {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openligadb`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      },
    );
    if (!resp.ok) throw new Error("OpenLigaDB request failed");
    return resp.json();
  }

  const fetchTable = async () => {
    setLoading(true);
    try {
      const data = await callOpenLigaDB("table", { league: selectedLeague });
      setTableData(data.table ?? []);
      setLeagueName(data.league ?? "");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const data = await callOpenLigaDB("current_matchday", { league: selectedLeague });
      setMatchesData(data.matches ?? []);
      setLeagueName(data.league ?? "");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold font-display">OpenLigaDB</h3>
          <Badge variant="secondary" className="text-[10px]">Kostenlos</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          OpenLigaDB liefert Ergebnisse und Tabellen für 1.–3. Liga (Deutschland). Kein API-Key nötig.
          Für Regionalliga und tiefer ist die eigene Kamera-Analyse die einzige Datenquelle.
        </p>

        <div className="flex gap-2 flex-wrap">
          {leagues.map((l) => (
            <Button
              key={l.key}
              variant={selectedLeague === l.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedLeague(l.key)}
              className="text-xs"
            >
              {l.name}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTable} disabled={loading} className="gap-1.5 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trophy className="h-3 w-3" />}
            Tabelle laden
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMatches} disabled={loading} className="gap-1.5 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calendar className="h-3 w-3" />}
            Spieltag laden
          </Button>
        </div>
      </div>

      {tableData && (
        <div className="glass-card overflow-x-auto">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Tabelle — {leagueName}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">#</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">Team</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">Sp</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">S</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">U</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">N</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs">Diff</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium text-xs font-bold">Pkt</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((t: any) => (
                <tr key={t.team_name} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-3 font-medium text-xs">{t.rank}</td>
                  <td className="py-2 px-3 flex items-center gap-2">
                    {t.team_logo && <img src={t.team_logo} alt="" className="w-4 h-4 object-contain" />}
                    <span className="text-xs font-medium">{t.team_name}</span>
                  </td>
                  <td className="py-2 px-3 text-center text-xs text-muted-foreground">{t.matches}</td>
                  <td className="py-2 px-3 text-center text-xs text-muted-foreground">{t.won}</td>
                  <td className="py-2 px-3 text-center text-xs text-muted-foreground">{t.draw}</td>
                  <td className="py-2 px-3 text-center text-xs text-muted-foreground">{t.lost}</td>
                  <td className="py-2 px-3 text-center text-xs text-muted-foreground">{t.goal_diff > 0 ? `+${t.goal_diff}` : t.goal_diff}</td>
                  <td className="py-2 px-3 text-center text-xs font-bold">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {matchesData && (
        <div className="glass-card">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Aktueller Spieltag — {leagueName}</span>
          </div>
          <div className="divide-y divide-border/50">
            {matchesData.map((m: any) => (
              <div key={m.match_id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {m.home_logo && <img src={m.home_logo} alt="" className="w-5 h-5 object-contain shrink-0" />}
                  <span className="text-xs font-medium truncate">{m.home_team}</span>
                </div>
                <div className="px-3 text-center shrink-0">
                  {m.is_finished ? (
                    <span className="text-sm font-bold">{m.home_goals} : {m.away_goals}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">–:–</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-xs font-medium truncate text-right">{m.away_team}</span>
                  {m.away_logo && <img src={m.away_logo} alt="" className="w-5 h-5 object-contain shrink-0" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Hinweis zur Datenverfügbarkeit</p>
          <p>
            OpenLigaDB deckt nur 1.–3. Liga ab. Für <strong>Regionalliga und tiefer</strong> existiert keine externe API.
            Hier ist die eigene Kamera-Analyse von FieldIQ die <strong>einzige und beste Datenquelle</strong> — das ist euer USP.
          </p>
        </div>
      </div>
    </div>
  );
}
