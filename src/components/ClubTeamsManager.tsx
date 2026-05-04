import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Trophy, Star, Trash2, Users, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type ClubTeam = {
  id: string;
  name: string;
  age_group: string | null;
  league: string | null;
  spielklasse: string | null;
  table_position: number | null;
  points: number | null;
  goal_difference: string | null;
  is_default: boolean;
  external_url: string | null;
  last_synced_at: string | null;
};

export function ClubTeamsManager() {
  const { clubId } = useAuth();
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [clubUrl, setClubUrl] = useState("");
  const [counts, setCounts] = useState<Record<string, { fixtures: number; players: number }>>({});

  const load = async () => {
    if (!clubId) return;
    setLoading(true);
    const { data } = await supabase
      .from("club_teams")
      .select("*")
      .eq("club_id", clubId)
      .order("is_default", { ascending: false })
      .order("name");
    setTeams((data ?? []) as ClubTeam[]);

    if (data?.length) {
      const ids = data.map((t) => t.id);
      const [{ data: fx }, { data: pl }] = await Promise.all([
        supabase.from("team_fixtures").select("team_id").in("team_id", ids),
        supabase.from("team_players").select("team_id").in("team_id", ids),
      ]);
      const c: Record<string, { fixtures: number; players: number }> = {};
      data.forEach((t) => (c[t.id] = { fixtures: 0, players: 0 }));
      fx?.forEach((r: any) => c[r.team_id] && c[r.team_id].fixtures++);
      pl?.forEach((r: any) => c[r.team_id] && c[r.team_id].players++);
      setCounts(c);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [clubId]);

  const scrape = async () => {
    if (!clubUrl.trim()) {
      toast.error("Bitte Vereins-URL angeben (z.B. fussball.de Vereinsseite)");
      return;
    }
    setScraping(true);
    const tid = toast.loading("Scrape läuft – das kann 1-2 Minuten dauern...");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-club-teams", {
        body: { club_url: clubUrl.trim(), club_id: clubId, scope: "all" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Unbekannter Fehler");
      toast.success(
        `Import fertig: ${data.teams_imported} Teams · ${data.fixtures_imported} Spiele · ${data.players_imported} Spieler`,
        { id: tid },
      );
      await load();
    } catch (e: any) {
      toast.error(`Fehler: ${e.message}`, { id: tid });
    } finally {
      setScraping(false);
    }
  };

  const setDefault = async (id: string) => {
    await supabase.from("club_teams").update({ is_default: true }).eq("id", id);
    toast.success("Standard-Mannschaft gesetzt");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Mannschaft samt Spielplan/Kader wirklich löschen?")) return;
    await supabase.from("club_teams").delete().eq("id", id);
    toast.success("Gelöscht");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Mannschafts-Bibliothek
          <Badge variant="default" className="ml-1">🆕 NEU</Badge>
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Importiere alle Mannschaften deines Vereins (Kader, Spielplan, Tabelle).
          Beim Anlegen eines neuen Spiels wählst du nur noch die Mannschaft – Datum,
          Gegner, Heim/Auswärts werden automatisch übernommen.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <Label>fussball.de Vereins-URL</Label>
        <div className="flex gap-2">
          <Input
            value={clubUrl}
            onChange={(e) => setClubUrl(e.target.value)}
            placeholder="https://www.fussball.de/verein/sv-viktoria-aschaffenburg-bayern/-/id/..."
            disabled={scraping}
          />
          <Button onClick={scrape} disabled={scraping || !clubId}>
            {scraping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Importieren
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tipp: Suche deinen Verein auf fussball.de und kopiere die URL der Vereinsseite.
        </p>
      </Card>

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : teams.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Noch keine Mannschaften importiert.
        </Card>
      ) : (
        <div className="space-y-2">
          {teams.map((t) => (
            <Card key={t.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{t.name}</span>
                  {t.age_group && <Badge variant="outline">{t.age_group}</Badge>}
                  {t.is_default && (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3" /> Standard
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  {t.league && <span>{t.league}</span>}
                  {t.table_position && (
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> Platz {t.table_position}
                      {t.points != null && ` · ${t.points} Pkt`}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {counts[t.id]?.fixtures ?? 0} Spiele
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {counts[t.id]?.players ?? 0} Spieler
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {!t.is_default && (
                  <Button size="sm" variant="ghost" onClick={() => setDefault(t.id)}>
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
