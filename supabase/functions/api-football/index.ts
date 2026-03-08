import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get("API_FOOTBALL_KEY");
    if (!API_KEY) throw new Error("API_FOOTBALL_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { action, club_id, ...params } = await req.json();

    // Helper to call API-Football
    async function apiFetch(endpoint: string, queryParams: Record<string, string> = {}) {
      const url = new URL(`${API_FOOTBALL_BASE}/${endpoint}`);
      Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
      const resp = await fetch(url.toString(), {
        headers: { "x-apisports-key": API_KEY! },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API-Football error [${resp.status}]: ${text}`);
      }
      return resp.json();
    }

    // Get club config
    async function getConfig(clubId: string) {
      const { data } = await supabase
        .from("api_football_config")
        .select("*")
        .eq("club_id", clubId)
        .single();
      return data;
    }

    switch (action) {
      // Search for a team in API-Football
      case "search_team": {
        const { query, country } = params;
        const qp: Record<string, string> = { search: query };
        if (country) qp.country = country;
        const result = await apiFetch("teams", qp);
        return new Response(JSON.stringify({ teams: result.response ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Search leagues
      case "search_league": {
        const { query, country } = params;
        const qp: Record<string, string> = {};
        if (query) qp.search = query;
        if (country) qp.country = country;
        const result = await apiFetch("leagues", qp);
        return new Response(JSON.stringify({ leagues: result.response ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save API-Football config for a club
      case "save_config": {
        const { api_team_id, api_league_id, api_season, sync_enabled } = params;
        const { error } = await supabase.from("api_football_config").upsert(
          {
            club_id,
            api_team_id,
            api_league_id,
            api_season: api_season || 2025,
            sync_enabled: sync_enabled ?? false,
          },
          { onConflict: "club_id" }
        );
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sync fixtures (matches) from API-Football
      case "sync_fixtures": {
        const config = await getConfig(club_id);
        if (!config?.api_team_id || !config?.api_league_id) {
          throw new Error("API-Football Konfiguration unvollstaendig");
        }

        const result = await apiFetch("fixtures", {
          team: String(config.api_team_id),
          league: String(config.api_league_id),
          season: String(config.api_season || 2025),
        });

        const fixtures = result.response ?? [];
        let synced = 0;

        for (const fixture of fixtures) {
          const fixtureId = fixture.fixture?.id;
          if (!fixtureId) continue;

          // Check if already exists (deduplizierung)
          const { data: existing } = await supabase
            .from("api_football_match_stats")
            .select("id")
            .eq("api_fixture_id", fixtureId)
            .maybeSingle();

          if (existing) continue;

          const stats = fixture.statistics || [];
          const homeStats = stats[0]?.statistics || [];
          const awayStats = stats[1]?.statistics || [];

          const getStat = (arr: any[], type: string) => {
            const found = arr.find((s: any) => s.type === type);
            return found?.value ?? null;
          };

          const possHome = getStat(homeStats, "Ball Possession");
          const possAway = getStat(awayStats, "Ball Possession");

          await supabase.from("api_football_match_stats").insert({
            club_id,
            api_fixture_id: fixtureId,
            home_goals: fixture.goals?.home ?? null,
            away_goals: fixture.goals?.away ?? null,
            possession_home: possHome ? parseFloat(String(possHome).replace("%", "")) : null,
            possession_away: possAway ? parseFloat(String(possAway).replace("%", "")) : null,
            shots_home: getStat(homeStats, "Total Shots"),
            shots_away: getStat(awayStats, "Total Shots"),
            shots_on_target_home: getStat(homeStats, "Shots on Goal"),
            shots_on_target_away: getStat(awayStats, "Shots on Goal"),
            corners_home: getStat(homeStats, "Corner Kicks"),
            corners_away: getStat(awayStats, "Corner Kicks"),
            fouls_home: getStat(homeStats, "Fouls"),
            fouls_away: getStat(awayStats, "Fouls"),
            offsides_home: getStat(homeStats, "Offsides"),
            offsides_away: getStat(awayStats, "Offsides"),
            yellow_cards_home: getStat(homeStats, "Yellow Cards"),
            yellow_cards_away: getStat(awayStats, "Yellow Cards"),
            red_cards_home: getStat(homeStats, "Red Cards"),
            red_cards_away: getStat(awayStats, "Red Cards"),
            passes_home: getStat(homeStats, "Total passes"),
            passes_away: getStat(awayStats, "Total passes"),
            pass_accuracy_home: getStat(homeStats, "Passes %") ? parseFloat(String(getStat(homeStats, "Passes %")).replace("%", "")) : null,
            pass_accuracy_away: getStat(awayStats, "Passes %") ? parseFloat(String(getStat(awayStats, "Passes %")).replace("%", "")) : null,
            raw_data: fixture,
          });
          synced++;
        }

        // Update last_sync_at
        await supabase
          .from("api_football_config")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("club_id", club_id);

        return new Response(JSON.stringify({ synced, total: fixtures.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sync player stats for a specific fixture
      case "sync_player_stats": {
        const { api_fixture_id } = params;
        const config = await getConfig(club_id);
        if (!config?.api_team_id) throw new Error("API-Football Konfiguration fehlt");

        const result = await apiFetch("fixtures/players", {
          fixture: String(api_fixture_id),
        });

        const teams = result.response ?? [];
        let synced = 0;

        for (const team of teams) {
          if (team.team?.id !== config.api_team_id) continue;

          for (const player of team.players || []) {
            const pStats = player.statistics?.[0];
            if (!pStats) continue;

            const apiPlayerId = player.player?.id;
            if (!apiPlayerId) continue;

            // Deduplizierung
            const { data: existing } = await supabase
              .from("api_football_player_stats")
              .select("id")
              .eq("api_fixture_id", api_fixture_id)
              .eq("api_player_id", apiPlayerId)
              .maybeSingle();

            if (existing) continue;

            // Try to match with local player by name
            const playerName = player.player?.name;
            let localPlayerId = null;
            if (playerName) {
              const { data: localPlayer } = await supabase
                .from("players")
                .select("id")
                .eq("club_id", club_id)
                .ilike("name", `%${playerName.split(" ").pop()}%`)
                .maybeSingle();
              localPlayerId = localPlayer?.id ?? null;
            }

            await supabase.from("api_football_player_stats").insert({
              club_id,
              player_id: localPlayerId,
              api_player_id: apiPlayerId,
              api_fixture_id,
              player_name: playerName,
              minutes_played: pStats.games?.minutes ?? null,
              rating: pStats.games?.rating ? parseFloat(pStats.games.rating) : null,
              goals: pStats.goals?.total ?? 0,
              assists: pStats.goals?.assists ?? 0,
              shots_total: pStats.shots?.total ?? 0,
              shots_on_goal: pStats.shots?.on ?? 0,
              passes_total: pStats.passes?.total ?? 0,
              passes_accuracy: pStats.passes?.accuracy ? parseFloat(pStats.passes.accuracy) : null,
              tackles: pStats.tackles?.total ?? 0,
              duels_won: pStats.duels?.won ?? 0,
              duels_total: pStats.duels?.total ?? 0,
              dribbles_success: pStats.dribbles?.success ?? 0,
              fouls_committed: pStats.fouls?.committed ?? 0,
              fouls_drawn: pStats.fouls?.drawn ?? 0,
              yellow_cards: pStats.cards?.yellow ?? 0,
              red_cards: pStats.cards?.red ?? 0,
              penalty_scored: pStats.penalty?.scored ?? 0,
              penalty_missed: pStats.penalty?.missed ?? 0,
              raw_data: player,
            });
            synced++;
          }
        }

        return new Response(JSON.stringify({ synced }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get team standings
      case "standings": {
        const config = await getConfig(club_id);
        if (!config?.api_league_id) throw new Error("Liga nicht konfiguriert");

        const result = await apiFetch("standings", {
          league: String(config.api_league_id),
          season: String(config.api_season || 2025),
        });

        return new Response(JSON.stringify({ standings: result.response ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get API usage/status
      case "api_status": {
        const url = new URL(`${API_FOOTBALL_BASE}/status`);
        const resp = await fetch(url.toString(), {
          headers: { "x-apisports-key": API_KEY! },
        });
        if (!resp.ok) throw new Error("Status-Abfrage fehlgeschlagen");
        const result = await resp.json();
        return new Response(JSON.stringify({ status: result.response ?? result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get upcoming fixtures
      case "next_fixtures": {
        const config = await getConfig(club_id);
        if (!config?.api_team_id) throw new Error("Team nicht konfiguriert");

        const result = await apiFetch("fixtures", {
          team: String(config.api_team_id),
          next: String(params.count || 5),
        });

        return new Response(JSON.stringify({ fixtures: result.response ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("api-football error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
